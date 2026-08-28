import { describe, expect, it } from 'vitest';
import {
  DispatchInputSchema,
  BindingRefSchema,
  createRelayEnvelope,
  parseRelayEnvelope
} from '../../packages/protocol/src/index.js';

describe('protocol contracts', () => {
  it('requires exactly one safe selector', () => {
    const bindingRef = `br_${'a'.repeat(32)}`;
    expect(BindingRefSchema.parse(bindingRef)).toBe(bindingRef);
    expect(() => BindingRefSchema.parse('profile-a')).toThrow();
    expect(() => BindingRefSchema.parse('br_short')).toThrow();
  });

  it('rejects unknown dispatch fields and unreasonable boundaries', () => {
    const bindingRef = `br_${'b'.repeat(32)}`;
    expect(() => DispatchInputSchema.parse({ bindingRef, operation: 'list_tabs', surprise: true })).toThrow();
    expect(() => DispatchInputSchema.parse({ bindingRef, operation: '', deadlineMs: -1 })).toThrow();
    expect(() => DispatchInputSchema.parse({ selector: { alias: 'a' }, operation: 'list_tabs' })).toThrow();
  });

  it('validates relay message type, payload, and protocol version', () => {
    const envelope = createRelayEnvelope('HEARTBEAT', {
      targetId: crypto.randomUUID(),
      connectionEpoch: 1,
      activeCommandId: null
    });
    expect(parseRelayEnvelope(envelope).type).toBe('HEARTBEAT');
    expect(() => parseRelayEnvelope({ ...envelope, protocolVersion: 999 })).toThrow();
    expect(() => parseRelayEnvelope({ ...envelope, type: 'UNKNOWN' })).toThrow();
    expect(() => parseRelayEnvelope({ ...envelope, payload: { ...envelope.payload, rawProfileId: 'leak' } })).toThrow();
  });
});
