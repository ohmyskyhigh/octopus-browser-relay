import type { TargetSnapshot } from '../../../shared/protocol/src/index.js';
import type { RelayRepositories } from '../storage/index.js';

interface LiveConnectionFact {
  epoch: number;
  lastHeartbeatMs: number;
}

export class TargetStateIndex {
  private readonly connections = new Map<string, LiveConnectionFact>();

  constructor(
    private readonly store: RelayRepositories,
    private readonly heartbeatTimeoutMs = 45_000,
    private readonly errorThreshold = 3,
    private readonly clock: () => number = Date.now
  ) {}

  markConnected(targetId: string, epoch: number): void {
    this.connections.set(targetId, { epoch, lastHeartbeatMs: this.clock() });
    this.store.bumpStatusVersion(targetId);
  }

  markHeartbeat(targetId: string, epoch: number): void {
    const current = this.connections.get(targetId);
    if (!current || current.epoch !== epoch) return;
    current.lastHeartbeatMs = this.clock();
    this.store.updateTargetObservation(targetId, 'heartbeat');
  }

  markDisconnected(targetId: string, epoch: number): void {
    const current = this.connections.get(targetId);
    if (!current || current.epoch !== epoch) return;
    this.connections.delete(targetId);
    this.store.bumpStatusVersion(targetId);
  }

  recordSuccess(targetId: string): void {
    this.store.updateTargetObservation(targetId, 'success');
  }

  recordFailure(targetId: string): void {
    this.store.updateTargetObservation(targetId, 'failure');
  }

  connectionEpoch(targetId: string): number | null {
    const fact = this.connections.get(targetId);
    if (!fact || this.clock() - fact.lastHeartbeatMs > this.heartbeatTimeoutMs) return null;
    return fact.epoch;
  }

  snapshot(targetId: string): TargetSnapshot | null {
    const target = this.store.getTargetById(targetId);
    if (!target) return null;
    const now = this.clock();
    const connection = this.connections.get(targetId);
    const connected = Boolean(connection && now - connection.lastHeartbeatMs <= this.heartbeatTimeoutMs);
    const lease = this.store.getActiveLease(targetId, new Date(now).toISOString());
    const health = target.consecutiveFailures >= this.errorThreshold
      ? 'unresponsive'
      : target.consecutiveFailures > 0
        ? 'degraded'
        : 'healthy';
    const occupancy = lease ? 'leased' : 'free';
    const status = !connected
      ? 'offline'
      : health === 'unresponsive'
        ? 'error'
        : occupancy === 'leased'
          ? 'busy'
          : 'available';
    return {
      targetId: target.targetId,
      alias: target.alias,
      connectivity: connected ? 'connected' : 'disconnected',
      health,
      occupancy,
      capabilities: target.capabilities,
      lastSeenAt: target.lastSeenAt,
      consecutiveFailures: target.consecutiveFailures,
      status,
      statusVersion: target.statusVersion
    };
  }

  sweepExpiredConnections(): string[] {
    const expired: string[] = [];
    for (const [targetId, fact] of this.connections) {
      if (this.clock() - fact.lastHeartbeatMs > this.heartbeatTimeoutMs) {
        this.connections.delete(targetId);
        this.store.bumpStatusVersion(targetId);
        expired.push(targetId);
      }
    }
    return expired;
  }
}
