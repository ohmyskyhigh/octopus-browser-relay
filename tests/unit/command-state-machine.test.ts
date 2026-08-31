import { describe, expect, it } from 'vitest';
import { assertCommandTransition, isTerminalCommandState } from '../../apps/broker/src/core/index.js';

describe('command state machine', () => {
  it('allows only documented transitions', () => {
    expect(() => assertCommandTransition('QUEUED', 'DELIVERED')).not.toThrow();
    expect(() => assertCommandTransition('DELIVERED', 'ACKED')).not.toThrow();
    expect(() => assertCommandTransition('ACKED', 'RUNNING')).not.toThrow();
    expect(() => assertCommandTransition('RUNNING', 'SUCCEEDED')).not.toThrow();
    expect(() => assertCommandTransition('SUCCEEDED', 'RUNNING')).toThrow('ILLEGAL_TRANSITION');
    expect(isTerminalCommandState('UNKNOWN_OUTCOME')).toBe(true);
    expect(isTerminalCommandState('QUEUED')).toBe(false);
  });
});
