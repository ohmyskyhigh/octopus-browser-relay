export interface RelayAlarm {
  name: string;
}

export interface RelayAlarmApi {
  get(name: string): Promise<RelayAlarm | undefined>;
  create(name: string, alarmInfo: { periodInMinutes: number }): void | Promise<void>;
  onAlarm: {
    addListener(listener: (alarm: RelayAlarm) => void): void;
  };
}

export interface ReconnectAlarmController {
  readonly supported: boolean;
  ensure(): Promise<void>;
}

export function installReconnectAlarm(
  alarms: RelayAlarmApi | undefined,
  alarmName: string,
  reconnect: () => void
): ReconnectAlarmController {
  if (!alarms) {
    return {
      supported: false,
      async ensure(): Promise<void> {}
    };
  }

  alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === alarmName) reconnect();
  });

  return {
    supported: true,
    async ensure(): Promise<void> {
      const existing = await alarms.get(alarmName);
      if (!existing) await alarms.create(alarmName, { periodInMinutes: 1 });
    }
  };
}
