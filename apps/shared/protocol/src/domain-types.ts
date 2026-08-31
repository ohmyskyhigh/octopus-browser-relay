export type TargetStatus = 'available' | 'busy' | 'offline' | 'error';
export type Connectivity = 'connected' | 'disconnected';
export type TargetHealth = 'healthy' | 'degraded' | 'unresponsive';
export type Occupancy = 'free' | 'leased';
export type RoutingDisposition = 'deliver' | 'queue' | 'wait' | 'reject';
export type IdempotencyClass = 'read' | 'idempotent-write' | 'non-idempotent';
export type CommandState =
  | 'ACCEPTED'
  | 'QUEUED'
  | 'DELIVERED'
  | 'ACKED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REJECTED'
  | 'TIMED_OUT'
  | 'UNKNOWN_OUTCOME';

export interface AgentPrincipal {
  principalId: string;
  displayName: string;
  scopes: readonly string[];
}

export interface AgentTargetBinding {
  bindingRef: string;
  targetAlias: string;
  mode: 'dedicated';
  createdAt: string;
}

export interface TargetSnapshot {
  targetId: string;
  alias: string;
  connectivity: Connectivity;
  health: TargetHealth;
  occupancy: Occupancy;
  capabilities: readonly string[];
  lastSeenAt: string | null;
  consecutiveFailures: number;
  status: TargetStatus;
  statusVersion: number;
}

export interface SanitizedTarget {
  alias: string;
  connectivity: Connectivity;
  health: TargetHealth;
  occupancy: Occupancy;
  capabilities: readonly string[];
  lastSeenAt: string | null;
  status: TargetStatus;
  statusVersion: number;
}

export interface RequestContext {
  requestId: string;
  runId?: string;
  principal: AgentPrincipal;
  bindingRef: string;
  operation: string;
  deadlineAt: string;
  idempotencyKey?: string;
  requestedWait: boolean;
}

export interface RoutingDecision {
  disposition: RoutingDisposition;
  reasonCode: string;
  evaluatedStatusVersion: number;
  retryAfterMs?: number;
}

export interface BrokerCommand {
  commandId: string;
  requestId: string;
  principalId: string;
  runId?: string;
  bindingRef: string;
  targetId: string;
  operation: string;
  parameters: unknown;
  idempotencyClass: IdempotencyClass;
  deadlineAt: string;
  leaseId?: string;
  fencingToken?: number;
}

export interface BrokerResult {
  commandId: string;
  state: Extract<CommandState, 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'UNKNOWN_OUTCOME'>;
  output?: unknown;
  errorCode?: string;
}

export interface DispatchReceipt {
  commandId: string;
  state: CommandState;
  decision: RoutingDecision;
  result?: BrokerResult;
}

export interface SessionHandle {
  sessionHandle: string;
  bindingRef: string;
  targetAlias: string;
  expiresAt: string;
  fencingToken: number;
}

export interface SanitizedCommand {
  commandId: string;
  requestId: string;
  bindingRef: string;
  targetAlias: string;
  operation: string;
  state: CommandState;
  deadlineAt: string;
  createdAt: string;
  updatedAt: string;
  result?: BrokerResult;
}
