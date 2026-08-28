import { describe, expect, it, vi } from 'vitest';
import { installReconnectAlarm, type RelayAlarmApi } from '../../apps/extension/src/reconnect-alarm.js';

describe('reconnect alarm compatibility', () => {
  it('does not throw when a Chromium derivative omits chrome.alarms', async () => {
    const reconnect = vi.fn();
    const controller = installReconnectAlarm(undefined, 'relay:ensure-connected', reconnect);

    expect(controller.supported).toBe(false);
    await expect(controller.ensure()).resolves.toBeUndefined();
    expect(reconnect).not.toHaveBeenCalled();
  });

  it('creates and handles the reconnect alarm when the API is available', async () => {
    let listener: ((alarm: { name: string }) => void) | undefined;
    const create = vi.fn();
    const alarms: RelayAlarmApi = {
      get: vi.fn().mockResolvedValue(undefined),
      create,
      onAlarm: {
        addListener(next) {
          listener = next;
        }
      }
    };
    const reconnect = vi.fn();
    const controller = installReconnectAlarm(alarms, 'relay:ensure-connected', reconnect);

    expect(controller.supported).toBe(true);
    await controller.ensure();
    expect(create).toHaveBeenCalledWith('relay:ensure-connected', { periodInMinutes: 1 });

    listener?.({ name: 'other' });
    listener?.({ name: 'relay:ensure-connected' });
    expect(reconnect).toHaveBeenCalledTimes(1);
  });
});
