export interface ExtensionSettings {
  brokerUrl: string;
  transportMode: 'native' | 'websocket';
}

const DEFAULT_URL = 'ws://127.0.0.1:7332/relay';

export async function loadSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get(['brokerUrl', 'transportMode']);
  return {
    brokerUrl: typeof stored.brokerUrl === 'string' ? stored.brokerUrl : DEFAULT_URL,
    transportMode: stored.transportMode === 'websocket' ? 'websocket' : 'native'
  };
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set({
    brokerUrl: settings.brokerUrl,
    transportMode: settings.transportMode
  });
  await chrome.storage.local.remove('pairingCode');
}
