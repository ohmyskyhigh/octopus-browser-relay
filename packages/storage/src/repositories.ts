import type {
  AgentPrincipal,
  BrokerCommand,
  BrokerResult,
  CommandState,
  RoutingDecision
} from '../../protocol/src/index.js';

export interface StoredTarget {
  targetId: string;
  alias: string;
  publicKeyJwk: JsonWebKey;
  capabilities: string[];
  revoked: boolean;
  consecutiveFailures: number;
  lastSeenAt: string | null;
  lastErrorAt: string | null;
  statusVersion: number;
}

export interface StoredBinding {
  bindingId: string;
  bindingRef: string;
  principalId: string;
  targetId: string;
  targetAlias: string;
  mode: 'dedicated';
  createdAt: string;
  revokedAt: string | null;
}

export interface StoredLease {
  leaseId: string;
  targetId: string;
  principalId: string;
  fencingToken: number;
  expiresAt: string;
  releasedAt: string | null;
}

export interface ResolvedSession extends StoredLease {
  alias: string;
  sessionExpiresAt: string;
}

export interface StoredCommand extends BrokerCommand {
  state: CommandState;
  decision: RoutingDecision;
  idempotencyKey: string | null;
  deliveredEpoch: number | null;
  createdAt: string;
  updatedAt: string;
  targetAlias: string;
  result?: BrokerResult;
}

export interface StoredTraceEvent {
  runId: string;
  requestId: string;
  commandId: string | null;
  targetAlias: string | null;
  bindingRef: string | null;
  principalId: string;
  stage: 'MCP_ACCEPT' | 'BINDING_VALIDATED' | 'POLICY_DECISION' | 'COMMAND_COMMIT' | 'WS_SEND' | 'EXT_ACK' | 'EXT_RESULT' | 'MCP_OBSERVED';
  connectionEpoch: number | null;
  outcomeCode: string | null;
  observedAt: string;
}

export interface LeaseGrant {
  lease: StoredLease;
  sessionHandle: string;
}

export interface CreateCommandInput {
  command: BrokerCommand;
  decision: RoutingDecision;
  idempotencyKey?: string;
  initialState: Extract<CommandState, 'QUEUED' | 'REJECTED'>;
}

export interface RelayRepositories {
  close(): void;
  createAgent(displayName: string, scopes: string[], token?: string): { principal: AgentPrincipal; token: string };
  authenticateAgent(token: string): AgentPrincipal | null;
  getAgentById(principalId: string): AgentPrincipal | null;
  createPairingCode(alias: string, expiresAt: string): string;
  consumePairingCode(code: string, publicKeyJwk: JsonWebKey, capabilities: string[]): StoredTarget;
  listTargets(): StoredTarget[];
  getTargetByAlias(alias: string): StoredTarget | null;
  getTargetById(targetId: string): StoredTarget | null;
  renameTarget(alias: string, newAlias: string): void;
  revokeTarget(alias: string): void;
  createBinding(principalId: string, targetId: string): StoredBinding;
  getBindingByRef(bindingRef: string): StoredBinding | null;
  getActiveBindingForPrincipal(principalId: string): StoredBinding | null;
  listBindings(): StoredBinding[];
  revokeBindingForPrincipal(principalId: string): boolean;
  revokeBindingsForTarget(targetId: string): number;
  updateTargetObservation(targetId: string, observation: 'heartbeat' | 'success' | 'failure', capabilities?: string[]): StoredTarget;
  bumpStatusVersion(targetId: string): number;
  getActiveLease(targetId: string, at: string): StoredLease | null;
  acquireLease(targetId: string, principalId: string, expiresAt: string): LeaseGrant | null;
  resolveSession(handle: string, principalId: string, at: string): ResolvedSession | null;
  releaseSession(handle: string, principalId: string): boolean;
  expireLeases(at: string): number;
  createCommand(input: CreateCommandInput): StoredCommand;
  findCommandByIdempotency(principalId: string, idempotencyKey: string): StoredCommand | null;
  getCommand(commandId: string): StoredCommand | null;
  transitionCommand(commandId: string, state: CommandState, reasonCode?: string, connectionEpoch?: number, result?: BrokerResult): StoredCommand;
  listRecoverableCommands(at: string): StoredCommand[];
  countQueuedForTarget(targetId: string): number;
  hasInFlightForTarget(targetId: string, excludingCommandId?: string): boolean;
  trace(event: Omit<StoredTraceEvent, 'observedAt'> & { observedAt?: string }): void;
  listTrace(runId: string): StoredTraceEvent[];
  listCommandsByRunId(runId: string): StoredCommand[];
  audit(eventType: string, context: { principalId?: string; targetAlias?: string; [key: string]: unknown }): void;
}
