import type { AgentPrincipal, SessionHandle } from '../../protocol/src/index.js';
import type { RelayRepositories, ResolvedSession } from '../../storage/src/index.js';

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export class LeaseManager {
  constructor(private readonly store: RelayRepositories) {}

  owns(targetId: string, principalId: string): boolean {
    return this.store.getActiveLease(targetId, new Date().toISOString())?.principalId === principalId;
  }

  async acquire(targetId: string, targetAlias: string, bindingRef: string, principal: AgentPrincipal, ttlMs: number, waitMs: number): Promise<SessionHandle | null> {
    const waitDeadline = Date.now() + waitMs;
    do {
      const expiresAt = new Date(Date.now() + ttlMs).toISOString();
      const grant = this.store.acquireLease(targetId, principal.principalId, expiresAt);
      if (grant) {
        return {
          sessionHandle: grant.sessionHandle,
          bindingRef,
          targetAlias,
          expiresAt,
          fencingToken: grant.lease.fencingToken
        };
      }
      if (Date.now() >= waitDeadline) return null;
      await delay(Math.min(100, waitDeadline - Date.now()));
    } while (Date.now() <= waitDeadline);
    return null;
  }

  resolve(handle: string, principalId: string): ResolvedSession | null {
    return this.store.resolveSession(handle, principalId, new Date().toISOString());
  }

  release(handle: string, principalId: string): boolean {
    return this.store.releaseSession(handle, principalId);
  }
}
