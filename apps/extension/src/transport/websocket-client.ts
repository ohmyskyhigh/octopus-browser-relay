import { loadSettings } from '../config.js';
import { loadOrCreateIdentity, savePairing, signChallenge } from '../identity/device-identity.js';
import { executeBrowserCommand, extensionCapabilities } from '../executor/browser-executor.js';
import { getCachedResult, rememberResult } from '../executor/recent-command-cache.js';
import { openRelayTransport, type RelayTransport, type RelayTransportClose } from './relay-transport.js';

const PROTOCOL_VERSION = 1;

interface Envelope {
  protocolVersion: number;
  messageId: string;
  sentAt: string;
  type: string;
  payload: Record<string, unknown>;
}

const envelope = (type: string, payload: Record<string, unknown>): Envelope => ({
  protocolVersion: PROTOCOL_VERSION,
  messageId: crypto.randomUUID(),
  sentAt: new Date().toISOString(),
  type,
  payload
});

const jitter = (max: number): number => {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return (value[0] ?? 0) % Math.max(1, max);
};

export class RelayWebSocketClient {
  private socket: RelayTransport | null = null;
  private connecting = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempt = 0;
  private connectionEpoch: number | null = null;
  private targetId: string | null = null;
  private activeCommandId: string | null = null;
  private stopped = false;
  private lastProtocolError: string | null = null;

  async connect(): Promise<void> {
    this.stopped = false;
    if (this.socket || this.connecting) return;
    this.connecting = true;
    await chrome.storage.local.set({ connectionStatus: 'connecting', lastError: null });
    try {
      const settings = await loadSettings();
      const identity = await loadOrCreateIdentity();
      this.targetId = identity.targetId ?? null;
      const socket = await openRelayTransport(settings.transportMode, settings.brokerUrl);
      if (this.stopped) {
        socket.close(1000, 'Connection cancelled');
        return;
      }
      this.socket = socket;
      socket.onMessage((message) => void this.onMessage(socket, message));
      socket.onClose((event) => this.onClose(socket, event));
      socket.onError((message) => {
        if (this.socket !== socket) return;
        void chrome.storage.local.set({
          connectionStatus: 'error',
          lastError: message,
          transportKind: socket.kind
        });
      });
      this.reconnectAttempt = 0;
      this.lastProtocolError = null;
      await chrome.storage.local.set({
        connectionStatus: 'authenticating',
        lastError: null,
        transportKind: socket.kind
      });
      socket.send(JSON.stringify(envelope('HELLO', {
        ...(identity.targetId ? { targetId: identity.targetId } : {}),
        ...(settings.pairingCode && !identity.targetId ? { pairingCode: settings.pairingCode } : {}),
        publicKeyJwk: identity.publicKeyJwk,
        capabilities: [...extensionCapabilities],
        extensionVersion: chrome.runtime.getManifest().version
      })));
    } catch (error) {
      await chrome.storage.local.set({
        connectionStatus: 'error',
        lastError: error instanceof Error ? error.message : 'Connection initialization failed',
        transportKind: null
      });
      this.scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  disconnect(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.socket?.close(1000, 'Extension disconnect');
    this.socket = null;
  }

  private async onMessage(socket: RelayTransport, raw: unknown): Promise<void> {
    if (this.socket !== socket) return;
    if (typeof raw !== 'string') return;
    const message = JSON.parse(raw) as Envelope;
    if (message.protocolVersion !== PROTOCOL_VERSION || typeof message.type !== 'string') return;
    const identity = await loadOrCreateIdentity();
    if (message.type === 'CHALLENGE') {
      const nonce = String(message.payload.nonce);
      const connectionEpoch = Number(message.payload.connectionEpoch);
      if (!identity.targetId) return;
      const signature = await signChallenge(identity.privateKeyJwk, nonce);
      this.send('AUTH', { targetId: identity.targetId, signature, connectionEpoch });
    } else if (message.type === 'PAIRED' || message.type === 'READY') {
      const targetId = String(message.payload.targetId);
      const alias = String(message.payload.alias);
      this.connectionEpoch = Number(message.payload.connectionEpoch);
      this.targetId = targetId;
      if (message.type === 'PAIRED') await savePairing(targetId, alias);
      await chrome.storage.local.set({ connectionStatus: 'connected', targetAlias: alias, connectionEpoch: this.connectionEpoch, lastError: null });
      this.startHeartbeat();
    } else if (message.type === 'COMMAND') {
      await this.execute(message.payload);
    } else if (message.type === 'ERROR') {
      this.lastProtocolError = String(message.payload.message ?? message.payload.code);
      this.stopped = true;
      await chrome.storage.local.set({ connectionStatus: 'error', lastError: this.lastProtocolError });
      socket.close(4000, 'Broker rejected handshake');
    }
  }

  private async execute(payload: Record<string, unknown>): Promise<void> {
    if (!this.connectionEpoch) return;
    const commandId = String(payload.commandId);
    this.send('ACK', { commandId, connectionEpoch: this.connectionEpoch });
    const cached = await getCachedResult(commandId);
    if (cached) {
      this.send('RESULT', { commandId, connectionEpoch: this.connectionEpoch, ...cached });
      return;
    }
    this.activeCommandId = commandId;
    try {
      if (Date.parse(String(payload.deadlineAt)) <= Date.now()) throw new Error('DEADLINE_EXCEEDED');
      const output = await executeBrowserCommand(String(payload.operation), payload.parameters);
      const result = { ok: true, output };
      await rememberResult(commandId, result);
      this.send('RESULT', { commandId, connectionEpoch: this.connectionEpoch, ...result });
    } catch (error) {
      const result = {
        ok: false,
        errorCode: error instanceof Error ? error.message : 'EXECUTION_FAILED'
      };
      await rememberResult(commandId, result);
      this.send('RESULT', { commandId, connectionEpoch: this.connectionEpoch, ...result });
    } finally {
      this.activeCommandId = null;
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    const beat = () => {
      if (this.connectionEpoch && this.targetId) {
        this.send('HEARTBEAT', { targetId: this.targetId, connectionEpoch: this.connectionEpoch, activeCommandId: this.activeCommandId });
      }
    };
    beat();
    this.heartbeatTimer = setInterval(beat, 20_000);
  }

  private send(type: string, payload: Record<string, unknown>): void {
    this.socket?.send(JSON.stringify(envelope(type, payload)));
  }

  private onClose(socket: RelayTransport, event: RelayTransportClose): void {
    if (this.socket !== socket) return;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.connectionEpoch = null;
    this.socket = null;
    if (this.lastProtocolError) {
      void chrome.storage.local.set({ connectionStatus: 'error', lastError: this.lastProtocolError });
    } else if (!this.stopped && event.code !== 1000) {
      void chrome.storage.local.set({
        connectionStatus: 'disconnected',
        lastError: event.reason || `Relay closed the connection (code ${event.code})`
      });
    } else {
      void chrome.storage.local.set({ connectionStatus: 'disconnected' });
    }
    if (this.stopped || this.lastProtocolError) return;
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    const base = Math.min(30_000, 500 * 2 ** Math.min(this.reconnectAttempt, 6));
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => void this.connect(), base + jitter(Math.max(1, Math.floor(base / 2))));
  }
}
