import { createPublicKey, randomBytes, verify, type JsonWebKey as NodeJsonWebKey } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type { BrokerCore, CommandTransport } from '../../broker-core/src/index.js';
import type { BrokerCommand, RelayEnvelope } from '../../protocol/src/index.js';
import { createRelayEnvelope, parseRelayEnvelope, RELAY_PROTOCOL_VERSION } from '../../protocol/src/index.js';
import type { RelayRepositories } from '../../storage/src/index.js';
import { ConnectionRegistry } from './connection-registry.js';

interface PendingSocketState {
  targetId?: string;
  epoch?: number;
  challenge?: string;
  authenticated: boolean;
  handshakeTimer: NodeJS.Timeout;
}

export interface ExtensionGatewayOptions {
  host: string;
  port: number;
  maxPayloadBytes?: number;
  handshakeTimeoutMs?: number;
}

export class ExtensionGateway implements CommandTransport {
  private readonly registry = new ConnectionRegistry();
  private readonly httpServer: Server;
  private readonly wsServer: WebSocketServer;
  private readonly states = new WeakMap<WebSocket, PendingSocketState>();
  private upgradeAttempts = 0;
  private upgradeAccepted = 0;
  private upgradeRejected = 0;
  private lastUpgradeAt: string | null = null;
  private lastUpgradeResult: 'accepted' | 'rejected-path' | 'rejected-host' | null = null;
  private lastUpgradeHostKind: 'loopback-ip' | 'localhost' | 'other' | 'missing' | null = null;
  private lastUpgradePath: string | null = null;

  constructor(
    private readonly broker: BrokerCore,
    private readonly store: RelayRepositories,
    private readonly options: ExtensionGatewayOptions
  ) {
    this.httpServer = createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          connectedTargets: this.registry.values().length,
          websocketUpgrades: {
            attempts: this.upgradeAttempts,
            accepted: this.upgradeAccepted,
            rejected: this.upgradeRejected,
            lastAttemptAt: this.lastUpgradeAt,
            lastResult: this.lastUpgradeResult,
            lastHostKind: this.lastUpgradeHostKind,
            lastPath: this.lastUpgradePath
          }
        }));
        return;
      }
      res.writeHead(404).end();
    });
    this.wsServer = new WebSocketServer({
      noServer: true,
      maxPayload: options.maxPayloadBytes ?? 1_048_576,
      perMessageDeflate: false
    });
    this.httpServer.on('upgrade', (request, socket, head) => {
      this.upgradeAttempts += 1;
      this.lastUpgradeAt = new Date().toISOString();
      this.lastUpgradePath = request.url ?? null;
      this.lastUpgradeHostKind = this.hostKind(request.headers.host);
      if (request.url !== '/relay') {
        this.upgradeRejected += 1;
        this.lastUpgradeResult = 'rejected-path';
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }
      if (!this.allowedHost(request.headers.host)) {
        this.upgradeRejected += 1;
        this.lastUpgradeResult = 'rejected-host';
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }
      this.upgradeAccepted += 1;
      this.lastUpgradeResult = 'accepted';
      this.wsServer.handleUpgrade(request, socket, head, (ws) => this.wsServer.emit('connection', ws, request));
    });
    this.wsServer.on('connection', (socket) => this.onConnection(socket));
  }

  async start(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.httpServer.once('error', reject);
      this.httpServer.listen(this.options.port, this.options.host, () => {
        this.httpServer.off('error', reject);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    for (const connection of this.registry.values()) connection.socket.close(1001, 'Broker shutting down');
    await new Promise<void>((resolve) => this.wsServer.close(() => resolve()));
    await new Promise<void>((resolve, reject) => this.httpServer.close((error) => error ? reject(error) : resolve()));
  }

  address(): { host: string; port: number } {
    const address = this.httpServer.address();
    if (!address || typeof address === 'string') return { host: this.options.host, port: this.options.port };
    return { host: address.address, port: address.port };
  }

  getConnectionEpoch(targetId: string): number | null {
    const connection = this.registry.get(targetId);
    return connection?.socket.readyState === WebSocket.OPEN ? connection.epoch : null;
  }

  send(targetId: string, epoch: number, command: BrokerCommand): void {
    const connection = this.registry.get(targetId);
    if (!connection || connection.epoch !== epoch || connection.socket.readyState !== WebSocket.OPEN) {
      throw new Error('Target socket is not available.');
    }
    this.sendEnvelope(connection.socket, 'COMMAND', {
      commandId: command.commandId,
      operation: command.operation,
      parameters: command.parameters,
      deadlineAt: command.deadlineAt,
      ...(command.fencingToken === undefined ? {} : { fencingToken: command.fencingToken })
    });
  }

  disconnectTarget(targetId: string): void {
    this.registry.get(targetId)?.socket.close(4003, 'Target revoked');
  }

  sweepHeartbeat(timeoutMs: number): void {
    const cutoff = Date.now() - timeoutMs;
    for (const connection of this.registry.values()) {
      if (connection.lastHeartbeatAt < cutoff) connection.socket.close(4000, 'Heartbeat timeout');
    }
  }

  private onConnection(socket: WebSocket): void {
    const handshakeTimer = setTimeout(() => socket.close(4001, 'Authentication timeout'), this.options.handshakeTimeoutMs ?? 10_000);
    const state: PendingSocketState = { authenticated: false, handshakeTimer };
    this.states.set(socket, state);
    socket.on('message', (data, isBinary) => {
      const text = data.toString();
      if (isBinary || Buffer.byteLength(text) > (this.options.maxPayloadBytes ?? 1_048_576)) {
        socket.close(1009, 'Invalid payload');
        return;
      }
      try {
        const parsed = JSON.parse(text) as unknown;
        this.onMessage(socket, parseRelayEnvelope(parsed));
      } catch (error) {
        this.sendEnvelope(socket, 'ERROR', { code: 'INVALID_MESSAGE', message: error instanceof Error ? error.message : 'Invalid message.' });
      }
    });
    socket.on('close', () => {
      clearTimeout(state.handshakeTimer);
      if (state.targetId && state.epoch && this.registry.remove(state.targetId, state.epoch)) {
        this.broker.onExtensionDisconnected(state.targetId, state.epoch);
      }
    });
    socket.on('error', () => undefined);
  }

  private onMessage(socket: WebSocket, envelope: RelayEnvelope): void {
    const state = this.states.get(socket);
    if (!state) return;
    if (envelope.type === 'HELLO') {
      this.handleHello(socket, state, envelope.payload as {
        targetId?: string;
        publicKeyJwk: JsonWebKey;
        pairingCode?: string;
        capabilities: string[];
        extensionVersion: string;
      });
      return;
    }
    if (envelope.type === 'AUTH') {
      this.handleAuth(socket, state, envelope.payload as { targetId: string; signature: string; connectionEpoch: number });
      return;
    }
    if (!state.authenticated || !state.targetId || !state.epoch) {
      socket.close(4001, 'Authentication required');
      return;
    }
    const payload = envelope.payload as Record<string, unknown>;
    if (Number(payload.connectionEpoch) !== state.epoch) return;
    if (envelope.type === 'HEARTBEAT') {
      const connection = this.registry.get(state.targetId);
      if (connection?.epoch === state.epoch) connection.lastHeartbeatAt = Date.now();
      this.broker.onExtensionHeartbeat(state.targetId, state.epoch);
    } else if (envelope.type === 'ACK') {
      this.broker.onExtensionAck(state.targetId, state.epoch, String(payload.commandId));
    } else if (envelope.type === 'RESULT') {
      this.broker.onExtensionResult(state.targetId, state.epoch, {
        commandId: String(payload.commandId),
        ok: Boolean(payload.ok),
        ...(payload.output === undefined ? {} : { output: payload.output }),
        ...(payload.errorCode === undefined ? {} : { errorCode: String(payload.errorCode) })
      });
    }
  }

  private handleHello(socket: WebSocket, state: PendingSocketState, payload: {
    targetId?: string;
    publicKeyJwk: JsonWebKey;
    pairingCode?: string;
    capabilities: string[];
    extensionVersion: string;
  }): void {
    if (payload.pairingCode && !payload.targetId) {
      const target = this.broker.pairExtension(payload.pairingCode, payload.publicKeyJwk, payload.capabilities);
      const epoch = this.registry.nextEpoch(target.targetId);
      this.authenticateSocket(socket, state, target.targetId, target.alias, epoch);
      this.sendEnvelope(socket, 'PAIRED', { targetId: target.targetId, alias: target.alias, connectionEpoch: epoch });
      return;
    }
    if (!payload.targetId) throw new Error('targetId or pairingCode is required.');
    const target = this.store.getTargetById(payload.targetId);
    if (!target) throw new Error('Unknown or revoked target.');
    const epoch = this.registry.nextEpoch(target.targetId);
    const challenge = randomBytes(32).toString('base64url');
    state.targetId = target.targetId;
    state.epoch = epoch;
    state.challenge = challenge;
    this.sendEnvelope(socket, 'CHALLENGE', { nonce: challenge, connectionEpoch: epoch });
  }

  private handleAuth(socket: WebSocket, state: PendingSocketState, payload: { targetId: string; signature: string; connectionEpoch: number }): void {
    if (!state.targetId || !state.epoch || !state.challenge || payload.targetId !== state.targetId || payload.connectionEpoch !== state.epoch) {
      throw new Error('Authentication state mismatch.');
    }
    const target = this.store.getTargetById(state.targetId);
    if (!target) throw new Error('Unknown or revoked target.');
    const publicKey = createPublicKey({ key: target.publicKeyJwk as unknown as NodeJsonWebKey, format: 'jwk' });
    const valid = verify('sha256', Buffer.from(state.challenge), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(payload.signature, 'base64url'));
    if (!valid) {
      socket.close(4003, 'Authentication failed');
      return;
    }
    this.authenticateSocket(socket, state, target.targetId, target.alias, state.epoch);
    this.sendEnvelope(socket, 'READY', { targetId: target.targetId, alias: target.alias, connectionEpoch: state.epoch });
  }

  private authenticateSocket(socket: WebSocket, state: PendingSocketState, targetId: string, alias: string, epoch: number): void {
    clearTimeout(state.handshakeTimer);
    state.authenticated = true;
    state.targetId = targetId;
    state.epoch = epoch;
    delete state.challenge;
    const previous = this.registry.bind({ targetId, epoch, socket, connectedAt: Date.now(), lastHeartbeatAt: Date.now() });
    if (previous && previous.socket !== socket) previous.socket.close(4002, 'Replaced by newer connection');
    this.store.updateTargetObservation(targetId, 'heartbeat');
    this.broker.onExtensionConnected(targetId, epoch);
    this.store.audit('extension.connected', { targetAlias: alias, connectionEpoch: epoch, protocolVersion: RELAY_PROTOCOL_VERSION });
  }

  private sendEnvelope(socket: WebSocket, type: Parameters<typeof createRelayEnvelope>[0], payload: unknown): void {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(createRelayEnvelope(type, payload)));
  }

  private allowedHost(hostHeader: string | undefined): boolean {
    if (!hostHeader) return false;
    const hostname = hostHeader.replace(/^\[/, '').split(']')[0]!.split(':')[0]!.toLowerCase();
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
  }

  private hostKind(hostHeader: string | undefined): 'loopback-ip' | 'localhost' | 'other' | 'missing' {
    if (!hostHeader) return 'missing';
    const hostname = hostHeader.replace(/^\[/, '').split(']')[0]!.split(':')[0]!.toLowerCase();
    if (hostname === '127.0.0.1' || hostname === '::1') return 'loopback-ip';
    if (hostname === 'localhost') return 'localhost';
    return 'other';
  }
}
