import { RelayWebSocketClient } from './transport/websocket-client.js';
import { installReconnectAlarm, type RelayAlarmApi } from './reconnect-alarm.js';

const relay = new RelayWebSocketClient();
const RECONNECT_ALARM = 'relay:ensure-connected';
const alarms = (chrome as unknown as { alarms?: RelayAlarmApi }).alarms;
const reconnectAlarm = installReconnectAlarm(alarms, RECONNECT_ALARM, () => void relay.connect());

async function ensureReconnectAlarm(): Promise<void> {
  await reconnectAlarm.ensure();
}

chrome.runtime.onInstalled.addListener(() => {
  void ensureReconnectAlarm();
  void relay.connect();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureReconnectAlarm();
  void relay.connect();
});

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (message && typeof message === 'object' && (message as { type?: string }).type === 'relay:reconnect') {
    relay.disconnect();
    setTimeout(() => void relay.connect(), 50);
  }
});

const action = (chrome as unknown as { action?: typeof chrome.action }).action;
action?.onClicked.addListener(() => {
  void chrome.runtime.openOptionsPage();
});

void relay.connect();
void ensureReconnectAlarm();
