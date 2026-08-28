import type { WebSocket } from 'ws';

export interface LiveExtensionConnection {
  targetId: string;
  epoch: number;
  socket: WebSocket;
  connectedAt: number;
  lastHeartbeatAt: number;
}

export class ConnectionRegistry {
  private readonly current = new Map<string, LiveExtensionConnection>();
  private readonly counters = new Map<string, number>();

  nextEpoch(targetId: string): number {
    const epoch = (this.counters.get(targetId) ?? 0) + 1;
    this.counters.set(targetId, epoch);
    return epoch;
  }

  bind(connection: LiveExtensionConnection): LiveExtensionConnection | null {
    const previous = this.current.get(connection.targetId) ?? null;
    this.current.set(connection.targetId, connection);
    return previous;
  }

  get(targetId: string): LiveExtensionConnection | null {
    return this.current.get(targetId) ?? null;
  }

  remove(targetId: string, epoch: number): boolean {
    const current = this.current.get(targetId);
    if (!current || current.epoch !== epoch) return false;
    this.current.delete(targetId);
    return true;
  }

  values(): LiveExtensionConnection[] {
    return [...this.current.values()];
  }
}
