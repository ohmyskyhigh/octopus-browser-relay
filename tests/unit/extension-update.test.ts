import { describe, expect, it } from 'vitest';
import {
  decideExtensionReload,
  normalizeLegacyReadyEnvelope
} from '../../apps/browser-extension/src/update/extension-update.js';

describe('extension update decision', () => {
  it('continues when the extension already matches the broker requirement', () => {
    expect(decideExtensionReload({
      currentVersion: '0.3.0', requiredVersion: '0.3.0', reloadRequested: false, attemptedVersion: null
    })).toEqual({ kind: 'continue' });
  });

  it('requests one reload when updated files should be available', () => {
    expect(decideExtensionReload({
      currentVersion: '0.3.0', requiredVersion: '0.4.0', reloadRequested: true, attemptedVersion: null
    })).toEqual({ kind: 'reload', requiredVersion: '0.4.0' });
  });

  it('blocks a repeated mismatch instead of creating a reload loop', () => {
    const decision = decideExtensionReload({
      currentVersion: '0.3.0', requiredVersion: '0.4.0', reloadRequested: true, attemptedVersion: '0.4.0'
    });
    expect(decision.kind).toBe('blocked');
    expect(decision).toMatchObject({ message: expect.stringContaining('still version 0.3.0') });
  });

  it('fails closed when broker reload facts are internally inconsistent', () => {
    expect(decideExtensionReload({
      currentVersion: '0.3.0', requiredVersion: '0.4.0', reloadRequested: false, attemptedVersion: null
    }).kind).toBe('blocked');
    expect(decideExtensionReload({
      currentVersion: '0.4.0', requiredVersion: '0.4.0', reloadRequested: true, attemptedVersion: null
    }).kind).toBe('blocked');
  });
});

describe('legacy READY migration', () => {
  it('adds updater facts to the complete pre-updater READY shape', () => {
    const legacy = {
      version: 2,
      type: 'READY',
      payload: { endpointId: 'endpoint-1' }
    };

    expect(normalizeLegacyReadyEnvelope(legacy, '0.3.0')).toEqual({
      version: 2,
      type: 'READY',
      payload: {
        endpointId: 'endpoint-1',
        brokerVersion: '0.3.0',
        requiredExtensionVersion: '0.3.0',
        reloadExtension: false
      }
    });
  });

  it('does not repair a partially specified updater-aware READY message', () => {
    const inconsistent = {
      version: 2,
      type: 'READY',
      payload: { endpointId: 'endpoint-1', brokerVersion: '0.3.0' }
    };

    expect(normalizeLegacyReadyEnvelope(inconsistent, '0.3.0')).toBe(inconsistent);
  });
});
