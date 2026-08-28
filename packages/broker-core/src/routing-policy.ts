import type { RequestContext, RoutingDecision, TargetSnapshot } from '../../protocol/src/index.js';

export interface RoutingPolicyOptions {
  maxQueuedPerTarget: number;
  queueDepth: (targetId: string) => number;
  ownsLease: (targetId: string, principalId: string) => boolean;
}

export class RoutingPolicy {
  constructor(private readonly options: RoutingPolicyOptions) {}

  evaluate(snapshot: TargetSnapshot, request: RequestContext): RoutingDecision {
    const deadlineMs = Date.parse(request.deadlineAt);
    if (!Number.isFinite(deadlineMs) || deadlineMs <= Date.now()) {
      return this.reject(snapshot, 'DEADLINE_EXCEEDED');
    }
    const needsWrite = request.operation !== 'list_tabs' && request.operation !== 'get_active_tab' && request.operation !== 'snapshot';
    const requiredScope = needsWrite ? 'browser:write' : 'browser:read';
    if (!request.principal.scopes.includes(requiredScope) && !request.principal.scopes.includes('broker:admin')) {
      return this.reject(snapshot, 'FORBIDDEN');
    }
    if (!snapshot.capabilities.includes(request.operation)) {
      return this.reject(snapshot, 'CAPABILITY_UNSUPPORTED');
    }
    if (snapshot.status === 'error') return this.reject(snapshot, 'TARGET_ERROR');
    if (snapshot.status === 'offline') {
      return request.requestedWait
        ? { disposition: 'wait', reasonCode: 'WAITING_FOR_RECONNECT', evaluatedStatusVersion: snapshot.statusVersion, retryAfterMs: 1_000 }
        : this.reject(snapshot, 'TARGET_OFFLINE');
    }
    if (needsWrite && snapshot.status === 'available' && !this.options.ownsLease(snapshot.targetId, request.principal.principalId)) {
      return this.reject(snapshot, 'LEASE_REQUIRED');
    }
    if (snapshot.status === 'busy' && !this.options.ownsLease(snapshot.targetId, request.principal.principalId)) {
      if (!request.requestedWait) return this.reject(snapshot, 'TARGET_BUSY');
      if (this.options.queueDepth(snapshot.targetId) >= this.options.maxQueuedPerTarget) {
        return this.reject(snapshot, 'QUEUE_CAPACITY_EXCEEDED');
      }
      return { disposition: 'queue', reasonCode: 'WAITING_FOR_LEASE', evaluatedStatusVersion: snapshot.statusVersion, retryAfterMs: 250 };
    }
    return { disposition: 'deliver', reasonCode: 'TARGET_READY', evaluatedStatusVersion: snapshot.statusVersion };
  }

  private reject(snapshot: TargetSnapshot, reasonCode: string): RoutingDecision {
    return { disposition: 'reject', reasonCode, evaluatedStatusVersion: snapshot.statusVersion };
  }
}
