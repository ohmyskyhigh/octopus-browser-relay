import { loadSettings, saveSettings } from './config.js';
import { loadOrCreateIdentity, resetIdentity } from './identity/device-identity.js';

const form = document.querySelector<HTMLFormElement>('#settings-form')!;
const brokerUrl = document.querySelector<HTMLInputElement>('#broker-url')!;
const transportMode = document.querySelector<HTMLSelectElement>('#transport-mode')!;
const pairingCode = document.querySelector<HTMLInputElement>('#pairing-code')!;
const profileNickname = document.querySelector<HTMLElement>('#profile-nickname')!;
const status = document.querySelector<HTMLElement>('#status')!;
const reset = document.querySelector<HTMLButtonElement>('#reset')!;

function statusText(value: unknown, alias: unknown, transport: unknown, lastError: unknown): string {
  const state = typeof value === 'string' ? value : 'not connected';
  return `Status: ${state}${typeof alias === 'string' ? ` · alias ${alias}` : ''}${typeof transport === 'string' ? ` · ${transport}` : ''}${typeof lastError === 'string' && lastError ? ` · ${lastError}` : ''}`;
}

async function refresh(): Promise<void> {
  const [settings, identity] = await Promise.all([loadSettings(), loadOrCreateIdentity()]);
  const stored = await chrome.storage.local.get([
    'connectionStatus',
    'endpointNickname',
    'targetAlias',
    'transportKind',
    'lastError'
  ]);
  brokerUrl.value = settings.brokerUrl;
  transportMode.value = settings.transportMode;
  pairingCode.value = settings.pairingCode ?? '';
  const nickname = stored.endpointNickname ?? stored.targetAlias ?? identity.nickname ?? identity.proposedNickname;
  profileNickname.textContent = String(nickname);
  status.textContent = statusText(stored.connectionStatus, nickname, stored.transportKind, stored.lastError);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void (async () => {
    try {
      const normalizedUrl = new URL(brokerUrl.value);
      if (normalizedUrl.protocol !== 'ws:' && normalizedUrl.protocol !== 'wss:') {
        throw new Error('Broker URL must start with ws:// or wss://');
      }
      const mode = transportMode.value;
      if (mode !== 'native' && mode !== 'websocket') throw new Error('Invalid transport mode');
      await saveSettings({
        brokerUrl: normalizedUrl.toString(),
        transportMode: mode,
        ...(pairingCode.value ? { pairingCode: pairingCode.value.trim().toUpperCase() } : {})
      });
      await chrome.storage.local.set({ connectionStatus: 'connecting', transportKind: null, lastError: null });
      await chrome.runtime.sendMessage({ type: 'relay:reconnect' });
    } catch (error) {
      await chrome.storage.local.set({
        connectionStatus: 'error',
        lastError: error instanceof Error ? error.message : 'Connection failed'
      });
    }
  })();
});

reset.addEventListener('click', () => {
  void (async () => {
    await resetIdentity();
    await chrome.runtime.sendMessage({ type: 'relay:reset' });
    await refresh();
  })();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && ['connectionStatus', 'endpointNickname', 'targetAlias', 'transportKind', 'lastError'].some((key) => key in changes)) {
    void refresh();
  }
});

void refresh();
