export type PublicProblemCode =
  | 'INVALID_ARGUMENT'
  | 'CALLER_CONTEXT_UNAVAILABLE'
  | 'CURSOR_INVALID'
  | 'CURSOR_INVALIDATED_BY_OUTAGE'
  | 'REQUEST_NOT_FOUND'
  | 'REQUEST_NOT_TERMINAL'
  | 'REQUEST_NOT_PAUSED'
  | 'REQUEST_RESOLUTION_NOT_ALLOWED'
  | 'ENDPOINT_NOT_FOUND'
  | 'ENDPOINT_UNAVAILABLE'
  | 'ENDPOINT_KILLED'
  | 'ENDPOINT_NOT_KILLED'
  | 'INSUFFICIENT_ELIGIBLE_ENDPOINTS'
  | 'WINDOW_NOT_FOUND'
  | 'WINDOW_ENDPOINT_MISMATCH'
  | 'WINDOW_UNAVAILABLE'
  | 'WORKSPACE_NOT_FOUND'
  | 'WORKSPACE_NOT_OWNED'
  | 'WORKSPACE_UNAVAILABLE'
  | 'WORKSPACE_TERMINATED'
  | 'TAB_NOT_FOUND'
  | 'TAB_WORKSPACE_MISMATCH'
  | 'TAB_CLOSED'
  | 'TAB_CREATION_FAILED'
  | 'CDP_SESSION_NOT_FOUND'
  | 'CDP_SESSION_OUT_OF_SCOPE'
  | 'CDP_METHOD_UNSUPPORTED_BY_EXTENSION'
  | 'CDP_METHOD_OUTSIDE_MANAGED_TAB_SCOPE'
  | 'CDP_TRANSPORT_UNAVAILABLE'
  | 'CDP_RECONCILIATION_REQUIRES_CONFIRMATION'
  | 'DEBUGGER_DETACHED'
  | 'TAKEOVER_BINDING_MISMATCH'
  | 'ENDPOINT_OWNERSHIP_FROZEN'
  | 'CONTROL_RACE_LOST'
  | 'REQUEST_RESOLUTION_RACE_LOST'
  | 'REQUEST_INVALIDATED_BY_CONTROL'
  | 'TERMINATION_FAILED'
  | 'BROKER_NOT_READY'
  | 'BROKER_BUSY'
  | 'CURSOR_EXPIRED'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL_ERROR';

export interface PublicProblem {
  code: PublicProblemCode;
  message: string;
  retryable: boolean;
  affected_target: null | Record<string, string>;
}

export class OctopusBrokerError extends Error {
  constructor(readonly problem: PublicProblem) {
    super(problem.message);
    this.name = 'OctopusBrokerError';
  }
}

export const problem = (
  code: PublicProblemCode,
  message: string,
  retryable = false,
  affectedTarget: null | Record<string, string> = null
): PublicProblem => ({ code, message, retryable, affected_target: affectedTarget });

