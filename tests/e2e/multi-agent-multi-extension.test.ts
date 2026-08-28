import { generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createRelayApplication, type RelayApplication } from '../../apps/broker/src/bootstrap.js';
import { createRelayEnvelope, parseRelayEnvelope, type RelayEnvelope } from '../../packages/protocol/src/index.js';

const waitFor = async (condition: () => boolean | Promise<boolean>, timeoutMs = 5_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for condition.');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

class SimulatedExtension {
  private socket: WebSocket | null = null;
  private epoch = 0;
  readonly executed: string[] = [];

  constructor(readonly marker: string) {}

  async pair(url: string, pairingCode: string): Promise<void> {
    const keys = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    this.socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => { this.socket!.once('open', () => resolve()); this.socket!.once('error', reject); });
    const paired = this.nextMessage();
    this.socket.send(JSON.stringify(createRelayEnvelope('HELLO', {
      publicKeyJwk: keys.publicKey.export({ format: 'jwk' }),
      pairingCode,
      capabilities: ['list_tabs', 'get_active_tab', 'snapshot'],
      extensionVersion: 'test'
    })));
    const result = await paired;
    if (result.type !== 'PAIRED') throw new Error(`Expected PAIRED, got ${result.type}`);
    this.epoch = Number((result.payload as Record<string, unknown>).connectionEpoch);
    this.socket.on('message', (data) => this.onMessage(data));
    this.send('HEARTBEAT', {
      targetId: String((result.payload as Record<string, unknown>).targetId),
      connectionEpoch: this.epoch,
      activeCommandId: null
    });
  }

  async close(): Promise<void> {
    if (!this.socket || this.socket.readyState === WebSocket.CLOSED) return;
    await new Promise<void>((resolve) => { this.socket!.once('close', () => resolve()); this.socket!.close(); });
  }

  private nextMessage(): Promise<RelayEnvelope> {
    return new Promise((resolve, reject) => {
      const onMessage = (data: WebSocket.RawData) => {
        cleanup();
        try { resolve(parseRelayEnvelope(JSON.parse(data.toString()) as unknown)); }
        catch (error) { reject(error); }
      };
      const onClose = () => { cleanup(); reject(new Error('Socket closed.')); };
      const cleanup = () => { this.socket!.off('message', onMessage); this.socket!.off('close', onClose); };
      this.socket!.once('message', onMessage);
      this.socket!.once('close', onClose);
    });
  }

  private onMessage(data: WebSocket.RawData): void {
    const message = parseRelayEnvelope(JSON.parse(data.toString()) as unknown);
    if (message.type !== 'COMMAND') return;
    const commandId = String((message.payload as Record<string, unknown>).commandId);
    this.executed.push(commandId);
    this.send('ACK', { commandId, connectionEpoch: this.epoch });
    this.send('RESULT', {
      commandId,
      connectionEpoch: this.epoch,
      ok: true,
      output: { marker: this.marker, sequence: this.executed.length }
    });
  }

  private send(type: Parameters<typeof createRelayEnvelope>[0], payload: Record<string, unknown>): void {
    this.socket?.send(JSON.stringify(createRelayEnvelope(type, payload)));
  }
}

async function connectAgent(port: number, token: string, name: string): Promise<Client> {
  const client = new Client({ name, version: '0.1.0' }, { versionNegotiation: { mode: 'auto' } });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } }
  }));
  return client;
}

async function call(client: Client, name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) throw new Error(JSON.stringify(result.structuredContent ?? result.content));
  return result.structuredContent as Record<string, unknown>;
}

async function waitCommand(client: Client, bindingRef: string, commandId: string): Promise<Record<string, unknown>> {
  let command: Record<string, unknown> = {};
  await waitFor(async () => {
    command = await call(client, 'get_command', { bindingRef, commandId });
    return ['SUCCEEDED', 'FAILED', 'TIMED_OUT', 'UNKNOWN_OUTCOME'].includes(String(command.state));
  });
  return command;
}

describe('multi-agent / multi-extension real transport path', () => {
  let app: RelayApplication | null = null;
  const clients: Client[] = [];
  const extensions: SimulatedExtension[] = [];

  afterEach(async () => {
    for (const client of clients.splice(0)) await client.close();
    for (const extension of extensions.splice(0)) await extension.close();
    if (app) await app.stop();
    app = null;
  });

  it('routes each agent only through its dedicated bindingRef', async () => {
    const adminToken = 'e2e-admin-token-that-is-long-enough';
    app = createRelayApplication({
      host: '127.0.0.1', mcpPort: 0, wsPort: 0, dbPath: ':memory:', logLevel: 'silent',
      heartbeatTimeoutMs: 5_000, errorThreshold: 3, leaseTtlMs: 60_000, adminToken
    });
    const agentRecords = ['a', 'b', 'c'].map((name) => app!.store.createAgent(`agent-${name}`, ['targets:read', 'sessions:write', 'browser:read', 'browser:write']));
    await app.start();
    const mcpPort = app.mcpGateway.address().port;
    const relayPort = app.extensionGateway.address().port;
    const aliases = ['rw-profile-a', 'rw-profile-b', 'rw-profile-c'];
    for (const [index, alias] of aliases.entries()) {
      const pairing = app.broker.createPairingCode(app.store.authenticateAgent(adminToken)!, alias, 60_000);
      const extension = new SimulatedExtension(`fixture-${String.fromCharCode(65 + index)}`);
      extensions.push(extension);
      await extension.pair(`ws://127.0.0.1:${relayPort}/relay`, pairing.pairingCode);
    }
    const admin = app.store.authenticateAgent(adminToken)!;
    const bindingRefs = aliases.map((alias, index) => app!.broker.bindAgent(admin, agentRecords[index]!.principal.principalId, alias).bindingRef);
    for (const [index, record] of agentRecords.entries()) clients.push(await connectAgent(mcpPort, record.token, `agent-${index}`));

    const advertisedBindings = await Promise.all(clients.map((client) => call(client, 'get_my_binding', {})));
    expect(advertisedBindings.map((binding) => binding.bindingRef)).toEqual(bindingRefs);

    const oneToOne = await Promise.all(bindingRefs.map((bindingRef, index) => call(clients[index]!, 'dispatch', {
      bindingRef, operation: 'list_tabs', parameters: {}, idempotencyClass: 'read', deadlineMs: 10_000
    })));
    const oneToOneResults = await Promise.all(oneToOne.map((receipt, index) => waitCommand(clients[index]!, bindingRefs[index]!, String(receipt.commandId))));
    expect(oneToOneResults.map((command) => ((command.result as Record<string, unknown>).output as Record<string, unknown>).marker))
      .toEqual(['fixture-A', 'fixture-B', 'fixture-C']);

    await expect(call(clients[0]!, 'dispatch', {
      bindingRef: bindingRefs[1], operation: 'snapshot', parameters: {}, idempotencyClass: 'read', deadlineMs: 10_000
    })).rejects.toThrow('BINDING_FORBIDDEN');

    const mixedReceipts = await Promise.all(Array.from({ length: 12 }, (_, index) => call(clients[index % clients.length]!, 'dispatch', {
      bindingRef: bindingRefs[index % bindingRefs.length],
      operation: index % 2 === 0 ? 'list_tabs' : 'get_active_tab',
      parameters: {},
      idempotencyClass: 'read',
      deadlineMs: 10_000,
      idempotencyKey: `mixed-${index}-unique`
    })));
    const mixedResults = await Promise.all(mixedReceipts.map((receipt, index) => waitCommand(clients[index % clients.length]!, bindingRefs[index % bindingRefs.length]!, String(receipt.commandId))));
    expect(mixedResults.every((command) => command.state === 'SUCCEEDED')).toBe(true);
    expect(extensions.reduce((total, extension) => total + extension.executed.length, 0)).toBe(3 + 12);
  });
});
