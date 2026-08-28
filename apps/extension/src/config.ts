export interface ExtensionSettings {
  brokerUrl: string;
  pairingCode?: string;
  transportMode: 'native' | 'websocket';
}

const DEFAULT_URL = 'ws://127.0.0.1:7332/relay';

export async function loadSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get(['brokerUrl', 'pairingCode', 'transportMode']);
  return {
    brokerUrl: typeof stored.brokerUrl === 'string' ? stored.brokerUrl : DEFAULT_URL,
    ...(typeof stored.pairingCode === 'string' && stored.pairingCode.length === 8 ? { pairingCode: stored.pairingCode } : {}),
    transportMode: stored.transportMode === 'websocket' ? 'websocket' : 'native'
  };
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set({
    brokerUrl: settings.brokerUrl,
    pairingCode: settings.pairingCode ?? null,
    transportMode: settings.transportMode
  });
}
