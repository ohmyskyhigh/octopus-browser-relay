import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BrokerCore, type CommandTransport } from '../../packages/broker-core/src/index.js';
import type { BrokerCommand } from '../../packages/protocol/src/index.js';
import { SqliteRelayStore } from '../../packages/storage/src/index.js';
import { testBinding, testPrincipal, testTarget } from '../helpers.js';

class SerialTransport implements CommandTransport {
  sent: BrokerCommand[] = [];
  getConnectionEpoch(): number | null { return 1; }
  send(_targetId: string, _epoch: number, command: BrokerCommand): void { this.sent.push(command); }
  disconnectTarget(): void {}
}

describe('per-target serialization', () => {
  let store: SqliteRelayStore;
  beforeEach(() => { store = new SqliteRelayStore(':memory:'); });
  afterEach(() => store.close());

  it('delivers only one in-flight command per target and advances after result', () => {
    const agent = testPrincipal(store);
    const { targetId } = testTarget(store);
    const bindingRef = testBinding(store, agent.principal.principalId, targetId);
    const broker = new BrokerCore(store);
    const transport = new SerialTransport();
    broker.setTransport(transport);
    broker.onExtensionConnected(targetId, 1);
    const first = broker.dispatch({ principal: agent.principal, bindingRef, operation: 'list_tabs', parameters: {}, idempotencyClass: 'read', waitMs: 0, deadlineMs: 10_000 });
    const second = broker.dispatch({ principal: agent.principal, bindingRef, operation: 'get_active_tab', parameters: {}, idempotencyClass: 'read', waitMs: 0, deadlineMs: 10_000 });
    expect(first.state).toBe('DELIVERED');
    expect(second.state).toBe('QUEUED');
    expect(transport.sent.map((command) => command.commandId)).toEqual([first.commandId]);
    broker.onExtensionAck(targetId, 1, first.commandId);
    broker.onExtensionResult(targetId, 1, { commandId: first.commandId, ok: true, output: {} });
    expect(transport.sent.map((command) => command.commandId)).toEqual([first.commandId, second.commandId]);
  });
});
