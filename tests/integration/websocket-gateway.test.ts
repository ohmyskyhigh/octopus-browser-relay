import { generateKeyPairSync, sign } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { BrokerCore } from '../../packages/broker-core/src/index.js';
import { ExtensionGateway } from '../../packages/extension-gateway/src/index.js';
import { createRelayEnvelope, parseRelayEnvelope, type RelayEnvelope } from '../../packages/protocol/src/index.js';
import { SqliteRelayStore } from '../../packages/storage/src/index.js';

function nextMessage(socket: WebSocket): Promise<RelayEnvelope> {
  return new Promise((resolve, reject) => {
    const onMessage = (data: WebSocket.RawData) => {
      cleanup();
      try { resolve(parseRelayEnvelope(JSON.parse(data.toString()) as unknown)); }
      catch (error) { reject(error); }
    };
    const onClose = () => { cleanup(); reject(new Error('Socket closed before message.')); };
    const cleanup = () => {
      socket.off('message', onMessage);
      socket.off('close', onClose);
    };
    socket.once('message', onMessage);
    socket.once('close', onClose);
  });
}

describe('extension WebSocket gateway', () => {
  let store: SqliteRelayStore;
  let broker: BrokerCore;
  let gateway: ExtensionGateway;
  let socket: WebSocket | null;

  beforeEach(() => {
    store = new SqliteRelayStore(':memory:');
    broker = new BrokerCore(store);
    gateway = new ExtensionGateway(broker, store, { host: '127.0.0.1', port: 0 });
    broker.setTransport(gateway);
    socket = null;
  });

  afterEach(async () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      await new Promise<void>((resolve) => { socket!.once('close', () => resolve()); socket!.close(); });
    }
    await gateway.stop();
    store.close();
  });

  it('pairs, authenticates, delivers, and correlates a command', async () => {
    const admin = store.createAgent('admin', ['broker:admin', 'browser:read', 'browser:write', 'sessions:write']);
    const pairing = broker.createPairingCode(admin.principal, 'profile-a', 60_000);
    const keys = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    await gateway.start();
    const { port } = gateway.address();
    socket = new WebSocket(`ws://127.0.0.1:${port}/relay`);
    await new Promise<void>((resolve, reject) => { socket!.once('open', () => resolve()); socket!.once('error', reject); });
    const health = await fetch(`http://127.0.0.1:${port}/health`).then(async (response) => response.json()) as {
      websocketUpgrades: { attempts: number; accepted: number; rejected: number; lastResult: string };
    };
    expect(health.websocketUpgrades).toMatchObject({ attempts: 1, accepted: 1, rejected: 0, lastResult: 'accepted' });
    const pairedMessage = nextMessage(socket);
    socket.send(JSON.stringify(createRelayEnvelope('HELLO', {
      publicKeyJwk: keys.publicKey.export({ format: 'jwk' }),
      pairingCode: pairing.pairingCode,
      capabilities: ['list_tabs'],
      extensionVersion: '0.1.0'
    })));
    const paired = await pairedMessage;
    expect(paired.type).toBe('PAIRED');
    const payload = paired.payload as { targetId: string; connectionEpoch: number };
    const bindingRef = broker.bindAgent(admin.principal, admin.principal.principalId, 'profile-a').bindingRef;
    expect(broker.getTarget(admin.principal, bindingRef).status).toBe('available');

    const commandMessage = nextMessage(socket);
    const receipt = broker.dispatch({
      principal: admin.principal,
      bindingRef,
      operation: 'list_tabs',
      parameters: {},
      idempotencyClass: 'read',
      waitMs: 0,
      deadlineMs: 10_000
    });
    const command = await commandMessage;
    expect(command.type).toBe('COMMAND');
    socket.send(JSON.stringify(createRelayEnvelope('ACK', { commandId: receipt.commandId, connectionEpoch: payload.connectionEpoch })));
    socket.send(JSON.stringify(createRelayEnvelope('RESULT', {
      commandId: receipt.commandId,
      connectionEpoch: payload.connectionEpoch,
      ok: true,
      output: { tabs: [{ title: 'fixture-a' }] }
    })));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(broker.getCommand(admin.principal, bindingRef, receipt.commandId).state).toBe('SUCCEEDED');

    const reconnect = new WebSocket(`ws://127.0.0.1:${port}/relay`);
    await new Promise<void>((resolve, reject) => { reconnect.once('open', () => resolve()); reconnect.once('error', reject); });
    const challengeMessage = nextMessage(reconnect);
    reconnect.send(JSON.stringify(createRelayEnvelope('HELLO', {
      targetId: payload.targetId,
      publicKeyJwk: keys.publicKey.export({ format: 'jwk' }),
      capabilities: ['list_tabs'],
      extensionVersion: '0.1.0'
    })));
    const challenge = await challengeMessage;
    expect(challenge.type).toBe('CHALLENGE');
    const challengePayload = challenge.payload as { nonce: string; connectionEpoch: number };
    const signature = sign('sha256', Buffer.from(challengePayload.nonce), { key: keys.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
    const readyMessage = nextMessage(reconnect);
    reconnect.send(JSON.stringify(createRelayEnvelope('AUTH', {
      targetId: payload.targetId,
      signature,
      connectionEpoch: challengePayload.connectionEpoch
    })));
    expect((await readyMessage).type).toBe('READY');
    await new Promise<void>((resolve) => { reconnect.once('close', () => resolve()); reconnect.close(); });
  });
});
