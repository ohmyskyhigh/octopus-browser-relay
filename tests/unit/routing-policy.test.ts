import { describe, expect, it } from 'vitest';
import { RoutingPolicy } from '../../packages/broker-core/src/index.js';
import type { RequestContext, TargetSnapshot } from '../../packages/protocol/src/index.js';

const snapshot = (overrides: Partial<TargetSnapshot> = {}): TargetSnapshot => ({
  targetId: 'target-private',
  alias: 'profile-a',
  connectivity: 'connected',
  health: 'healthy',
  occupancy: 'free',
  capabilities: ['list_tabs', 'open_url'],
  lastSeenAt: new Date().toISOString(),
  consecutiveFailures: 0,
  status: 'available',
  statusVersion: 7,
  ...overrides
});

const request = (overrides: Partial<RequestContext> = {}): RequestContext => ({
  requestId: crypto.randomUUID(),
  principal: { principalId: 'agent-a', displayName: 'A', scopes: ['browser:read', 'browser:write'] },
  bindingRef: `br_${'a'.repeat(32)}`,
  operation: 'list_tabs',
  deadlineAt: new Date(Date.now() + 10_000).toISOString(),
  requestedWait: false,
  ...overrides
});

describe('routing policy', () => {
  const policy = new RoutingPolicy({ maxQueuedPerTarget: 10, queueDepth: () => 0, ownsLease: () => false });

  it('keeps target facts separate from per-request opinion', () => {
    expect(policy.evaluate(snapshot(), request()).disposition).toBe('deliver');
    expect(policy.evaluate(snapshot({ status: 'offline', connectivity: 'disconnected' }), request()).reasonCode).toBe('TARGET_OFFLINE');
    expect(policy.evaluate(snapshot({ status: 'offline', connectivity: 'disconnected' }), request({ requestedWait: true })).disposition).toBe('wait');
    expect(policy.evaluate(snapshot({ status: 'busy', occupancy: 'leased' }), request({ requestedWait: true })).disposition).toBe('queue');
    expect(policy.evaluate(snapshot({ status: 'error', health: 'unresponsive' }), request()).disposition).toBe('reject');
  });

  it('never delivers unauthorized, unsupported, or expired work', () => {
    expect(policy.evaluate(snapshot(), request({ principal: { principalId: 'x', displayName: 'x', scopes: [] } })).reasonCode).toBe('FORBIDDEN');
    expect(policy.evaluate(snapshot(), request({ operation: 'missing' })).reasonCode).toBe('CAPABILITY_UNSUPPORTED');
    expect(policy.evaluate(snapshot(), request({ deadlineAt: new Date(Date.now() - 1).toISOString() })).reasonCode).toBe('DEADLINE_EXCEEDED');
    expect(policy.evaluate(snapshot(), request({ operation: 'open_url' })).reasonCode).toBe('LEASE_REQUIRED');
  });
});
