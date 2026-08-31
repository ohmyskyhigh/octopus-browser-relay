import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BrokerCore, type CommandTransport } from '../../apps/broker/src/core/index.js';
import type { BrokerCommand } from '../../apps/shared/protocol/src/index.js';
import { SqliteRelayStore } from '../../apps/broker/src/storage/index.js';
import { testBinding, testPrincipal, testTarget } from '../helpers.js';

class CapturingTransport implements CommandTransport {
  sent: BrokerCommand[] = [];
  getConnectionEpoch(): number | null { return 1; }
  send(_targetId: string, _epoch: number, command: BrokerCommand): void { this.sent.push(command); }
  disconnectTarget(): void {}
}

describe('restart recovery', () => {
  const directories: string[] = [];
  afterEach(() => {
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
  });

  it('queues safe work for redelivery but labels ambiguous non-idempotent work unknown', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'relay-recovery-'));
    directories.push(directory);
    const databasePath = join(directory, 'relay.sqlite');
    let store = new SqliteRelayStore(databasePath);
    const safeAgent = testPrincipal(store, 'safe');
    const writeAgent = testPrincipal(store, 'write');
    const writeTarget = testTarget(store, 'profile-write');
    const safeTarget = testTarget(store, 'profile-safe');
    const safeBindingRef = testBinding(store, safeAgent.principal.principalId, safeTarget.targetId);
    const writeBindingRef = testBinding(store, writeAgent.principal.principalId, writeTarget.targetId);
    let broker = new BrokerCore(store);
    const transport = new CapturingTransport();
    broker.setTransport(transport);
    broker.onExtensionConnected(writeTarget.targetId, 1);
    const session = await broker.acquireSession(writeAgent.principal, writeBindingRef, 60_000, 0);
    const safe = broker.dispatch({
      principal: safeAgent.principal, bindingRef: safeBindingRef, operation: 'list_tabs', parameters: {},
      idempotencyClass: 'read', waitMs: 5_000, deadlineMs: 60_000
    });
    expect(safe.state).toBe('QUEUED');
    const risky = broker.dispatch({
      principal: writeAgent.principal, bindingRef: writeBindingRef, sessionHandle: session.sessionHandle, operation: 'open_url',
      parameters: { url: 'http://127.0.0.1/fixture' }, idempotencyClass: 'non-idempotent', waitMs: 0, deadlineMs: 60_000
    });
    expect(risky.state).toBe('DELIVERED');
    store.close();

    store = new SqliteRelayStore(databasePath);
    broker = new BrokerCore(store);
    broker.recover();
    expect(store.getCommand(safe.commandId)?.state).toBe('QUEUED');
    expect(store.getCommand(risky.commandId)?.state).toBe('UNKNOWN_OUTCOME');
    store.close();
  });
});
