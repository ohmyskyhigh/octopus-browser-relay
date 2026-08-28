export interface DeviceIdentity {
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
  targetId?: string;
  alias?: string;
}

export async function loadOrCreateIdentity(): Promise<DeviceIdentity> {
  const stored = await chrome.storage.local.get(['publicKeyJwk', 'privateKeyJwk', 'targetId', 'targetAlias']);
  if (stored.publicKeyJwk && stored.privateKeyJwk) {
    return {
      publicKeyJwk: stored.publicKeyJwk as JsonWebKey,
      privateKeyJwk: stored.privateKeyJwk as JsonWebKey,
      ...(typeof stored.targetId === 'string' ? { targetId: stored.targetId } : {}),
      ...(typeof stored.targetAlias === 'string' ? { alias: stored.targetAlias } : {})
    };
  }
  const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keys.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keys.privateKey);
  await chrome.storage.local.set({ publicKeyJwk, privateKeyJwk });
  return { publicKeyJwk, privateKeyJwk };
}

export async function savePairing(targetId: string, alias: string): Promise<void> {
  await chrome.storage.local.set({ targetId, targetAlias: alias, pairingCode: null });
}

export async function resetIdentity(): Promise<void> {
  await chrome.storage.local.remove(['publicKeyJwk', 'privateKeyJwk', 'targetId', 'targetAlias', 'pairingCode']);
}

export async function signChallenge(privateKeyJwk: JsonWebKey, nonce: string): Promise<string> {
  const key = await crypto.subtle.importKey('jwk', privateKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(nonce));
  const bytes = new Uint8Array(signature);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
