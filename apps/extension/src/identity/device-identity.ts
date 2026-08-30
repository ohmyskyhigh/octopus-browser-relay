export interface DeviceIdentity {
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
  proposedNickname: string;
  endpointId?: string;
  nickname?: string;
}

export async function loadOrCreateIdentity(): Promise<DeviceIdentity> {
  const stored = await chrome.storage.local.get([
    'publicKeyJwk',
    'privateKeyJwk',
    'endpointId',
    'endpointNickname',
    'proposedNickname',
    'targetId',
    'targetAlias'
  ]);
  if (stored.publicKeyJwk && stored.privateKeyJwk) {
    const publicKeyJwk = stored.publicKeyJwk as JsonWebKey;
    const proposedNickname = typeof stored.proposedNickname === 'string'
      ? stored.proposedNickname
      : await createNicknameCandidate(publicKeyJwk);
    if (stored.proposedNickname !== proposedNickname) {
      await chrome.storage.local.set({ proposedNickname });
    }
    return {
      publicKeyJwk,
      privateKeyJwk: stored.privateKeyJwk as JsonWebKey,
      proposedNickname,
      ...(typeof stored.endpointId === 'string'
        ? { endpointId: stored.endpointId }
        : typeof stored.targetId === 'string' ? { endpointId: stored.targetId } : {}),
      ...(typeof stored.endpointNickname === 'string'
        ? { nickname: stored.endpointNickname }
        : typeof stored.targetAlias === 'string' ? { nickname: stored.targetAlias } : {})
    };
  }
  const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keys.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keys.privateKey);
  const proposedNickname = await createNicknameCandidate(publicKeyJwk);
  await chrome.storage.local.set({ publicKeyJwk, privateKeyJwk, proposedNickname });
  return { publicKeyJwk, privateKeyJwk, proposedNickname };
}

export async function savePairing(endpointId: string, nickname: string): Promise<void> {
  await chrome.storage.local.set({
    endpointId,
    endpointNickname: nickname,
    // Keep the previous keys during in-place migration so an older broker can still reconnect.
    targetId: endpointId,
    targetAlias: nickname,
    pairingCode: null
  });
}

export async function resetIdentity(): Promise<void> {
  await chrome.storage.local.remove([
    'publicKeyJwk',
    'privateKeyJwk',
    'proposedNickname',
    'endpointId',
    'endpointNickname',
    'targetId',
    'targetAlias',
    'pairingCode',
    'recentAttemptOutcomesV2'
  ]);
}

async function createNicknameCandidate(publicKeyJwk: JsonWebKey): Promise<string> {
  const stablePublicKey = JSON.stringify({
    kty: publicKeyJwk.kty,
    crv: publicKeyJwk.crv,
    x: publicKeyJwk.x,
    y: publicKeyJwk.y
  });
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stablePublicKey)));
  const suffix = [...digest.slice(0, 4)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `octopus-${suffix}`;
}

export async function signChallenge(privateKeyJwk: JsonWebKey, nonce: string): Promise<string> {
  const key = await crypto.subtle.importKey('jwk', privateKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(nonce));
  const bytes = new Uint8Array(signature);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
