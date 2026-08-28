import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BrokerCore, type CommandTransport } from '../../packages/broker-core/src/index.js';
import type { BrokerCommand } from '../../packages/protocol/src/index.js';
import { SqliteRelayStore } from '../../packages/storage/src/index.js';
import { testBinding, testPrincipal, testTarget } from '../helpers.js';

class FakeTransport implements CommandTransport {
  epoch = 1;
  sent: BrokerCommand[] = [];
  getConnectionEpoch(): number | null { return this.epoch; }
  send(_targetId: string, _epoch: number, command: BrokerCommand): void { this.sent.push(command); }
  disconnectTarget(): void { this.epoch = 0; }
}

describe('broker core', () => {
  let store: SqliteRelayStore;
  let broker: BrokerCore;
  let transport: FakeTransport;

  beforeEach(() => {
    store = new SqliteRelayStore(':memory:');
    broker = new BrokerCore(store);
    transport = new FakeTransport();
    broker.setTransport(transport);
  });
  afterEach(() => store.close());

  it('persists, delivers, correlates, and sanitizes one command', () => {
    const agent = testPrincipal(store);
    const { targetId } = testTarget(store);
    const bindingRef = testBinding(store, agent.principal.principalId, targetId);
    broker.onExtensionConnected(targetId, 1);
    const receipt = broker.dispatch({
      principal: agent.principal,
      bindingRef,
      operation: 'list_tabs',
      parameters: {},
      idempotencyClass: 'read',
      idempotencyKey: 'request-0001',
      waitMs: 0,
      deadlineMs: 10_000
    });
    expect(receipt.state).toBe('DELIVERED');
    expect(transport.sent).toHaveLength(1);
    broker.onExtensionAck(targetId, 1, receipt.commandId);
    broker.onExtensionResult(targetId, 1, { commandId: receipt.commandId, ok: true, output: { tabs: [] } });
    expect(broker.getCommand(agent.principal, bindingRef, receipt.commandId).state).toBe('SUCCEEDED');
    expect(broker.getMyBinding(agent.principal).bindingRef).toBe(bindingRef);
    expect(JSON.stringify(broker.listTargets(agent.principal))).not.toContain(targetId);
    expect(broker.dispatch({
      principal: agent.principal,
      bindingRef,
      operation: 'list_tabs',
      parameters: {},
      idempotencyClass: 'read',
      idempotencyKey: 'request-0001',
      waitMs: 0,
      deadlineMs: 10_000
    }).commandId).toBe(receipt.commandId);
    expect(transport.sent).toHaveLength(1);
  });

  it('keeps busy status factual while rejecting foreign binding references', async () => {
    const a = testPrincipal(store, 'a');
    const b = testPrincipal(store, 'b');
    const { targetId } = testTarget(store);
    const bindingRef = testBinding(store, a.principal.principalId, targetId);
    broker.onExtensionConnected(targetId, 1);
    await broker.acquireSession(a.principal, bindingRef, 60_000, 0);
    expect(broker.getTarget(a.principal, bindingRef).status).toBe('busy');
    expect(() => broker.getTarget(b.principal, bindingRef)).toThrow('Binding belongs to another agent.');
    expect(() => broker.dispatch({
      principal: b.principal, bindingRef, operation: 'list_tabs', parameters: {},
      idempotencyClass: 'read', waitMs: 0, deadlineMs: 10_000
    })).toThrow('Binding belongs to another agent.');
  });
});
