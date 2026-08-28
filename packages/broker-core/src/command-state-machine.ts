import type { CommandState } from '../../protocol/src/index.js';

const transitions: Readonly<Record<CommandState, readonly CommandState[]>> = {
  ACCEPTED: ['QUEUED', 'REJECTED'],
  QUEUED: ['DELIVERED', 'REJECTED', 'TIMED_OUT'],
  DELIVERED: ['QUEUED', 'ACKED', 'FAILED', 'TIMED_OUT', 'UNKNOWN_OUTCOME'],
  ACKED: ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'TIMED_OUT', 'UNKNOWN_OUTCOME'],
  RUNNING: ['QUEUED', 'SUCCEEDED', 'FAILED', 'TIMED_OUT', 'UNKNOWN_OUTCOME'],
  SUCCEEDED: [],
  FAILED: [],
  REJECTED: [],
  TIMED_OUT: [],
  UNKNOWN_OUTCOME: []
};

export function assertCommandTransition(from: CommandState, to: CommandState): void {
  if (!transitions[from].includes(to)) throw new Error(`ILLEGAL_TRANSITION:${from}->${to}`);
}

export function isTerminalCommandState(state: CommandState): boolean {
  return transitions[state].length === 0;
}
