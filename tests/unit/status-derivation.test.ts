import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TargetStateIndex } from '../../apps/broker/src/core/index.js';
import { SqliteRelayStore } from '../../apps/broker/src/storage/index.js';
import { testTarget } from '../helpers.js';

describe('target state derivation', () => {
  let store: SqliteRelayStore;
  let now: number;

  beforeEach(() => {
    store = new SqliteRelayStore(':memory:');
    now = Date.now();
  });
  afterEach(() => store.close());

  it('derives offline, available, busy, error, and heartbeat expiry from facts', () => {
    const { targetId } = testTarget(store);
    const principal = store.createAgent('agent', ['sessions:write']).principal;
    const index = new TargetStateIndex(store, 1_000, 2, () => now);
    expect(index.snapshot(targetId)?.status).toBe('offline');
    index.markConnected(targetId, 1);
    expect(index.snapshot(targetId)?.status).toBe('available');
    store.acquireLease(targetId, principal.principalId, new Date(now + 5_000).toISOString());
    expect(index.snapshot(targetId)?.status).toBe('busy');
    store.updateTargetObservation(targetId, 'failure');
    store.updateTargetObservation(targetId, 'failure');
    expect(index.snapshot(targetId)?.status).toBe('error');
    now += 1_001;
    expect(index.snapshot(targetId)?.status).toBe('offline');
  });
});
