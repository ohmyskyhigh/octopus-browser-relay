export const ErrorCodes = {
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  InvalidInput: 'INVALID_INPUT',
  InvalidBinding: 'INVALID_BINDING',
  BindingForbidden: 'BINDING_FORBIDDEN',
  BindingRevoked: 'BINDING_REVOKED',
  BindingConflict: 'BINDING_CONFLICT',
  TargetNotFound: 'TARGET_NOT_FOUND',
  TargetOffline: 'TARGET_OFFLINE',
  TargetError: 'TARGET_ERROR',
  TargetBusy: 'TARGET_BUSY',
  CapabilityUnsupported: 'CAPABILITY_UNSUPPORTED',
  LeaseConflict: 'LEASE_CONFLICT',
  LeaseRequired: 'LEASE_REQUIRED',
  LeaseExpired: 'LEASE_EXPIRED',
  DeadlineExceeded: 'DEADLINE_EXCEEDED',
  QueueCapacityExceeded: 'QUEUE_CAPACITY_EXCEEDED',
  CommandNotFound: 'COMMAND_NOT_FOUND',
  IllegalTransition: 'ILLEGAL_TRANSITION',
  UnknownOutcome: 'UNKNOWN_OUTCOME',
  PairingCodeInvalid: 'PAIRING_CODE_INVALID',
  ProtocolMismatch: 'PROTOCOL_MISMATCH',
  ExtensionAuthenticationFailed: 'EXTENSION_AUTHENTICATION_FAILED'
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export class RelayError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = 'RelayError';
  }
}
