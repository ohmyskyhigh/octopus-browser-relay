import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import type { AgentPrincipal } from '../apps/shared/protocol/src/index.js';
import type { SqliteRelayStore } from '../apps/broker/src/storage/index.js';

export function testPrincipal(store: SqliteRelayStore, name = 'agent', scopes = ['targets:read', 'sessions:write', 'browser:read', 'browser:write']): { principal: AgentPrincipal; token: string } {
  return store.createAgent(name, scopes);
}

export function testTarget(store: SqliteRelayStore, alias = 'profile-a', capabilities = ['list_tabs', 'get_active_tab', 'open_url', 'activate_tab', 'navigate', 'snapshot']): { targetId: string; privateKey: KeyObject; publicKeyJwk: JsonWebKey } {
  const code = store.createPairingCode(alias, new Date(Date.now() + 60_000).toISOString());
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const publicKeyJwk = publicKey.export({ format: 'jwk' });
  const target = store.consumePairingCode(code, publicKeyJwk, capabilities);
  return { targetId: target.targetId, privateKey, publicKeyJwk };
}

export function testBinding(store: SqliteRelayStore, principalId: string, targetId: string): string {
  return store.createBinding(principalId, targetId).bindingRef;
}
