# Technical Architecture

> Implementation note (v0.2.0): the actual northbound contract now requires an opaque, exclusive `bindingRef` on every target-specific MCP call. Alias selectors and shared 1:N/N:1/N:N scenarios in this original design are superseded by `docs/mcp-contract-v2.md` and the current interactive architecture.

## 1. Problem

Several Chrome windows may run simultaneously, each with an independent profile and a copy of the relay extension. Several agents may also run simultaneously. A direct agent-to-extension connection makes identity, access control, occupancy, retries, and recovery inconsistent, while exposing low-level identifiers that agents should not need.

The system therefore needs one local authority that can answer two different questions:

1. **What is true about this target?** Connectivity, health, occupancy, capabilities, last observation, and errors.
2. **What should this request do now?** Deliver, queue, wait, or reject, based on the facts plus the caller, operation, deadline, lease, and policy.

Both answers belong to the broker. They remain separate models so a target can be factually `busy` while one request is queued and another is rejected.

## 2. Proposed Solution

Run one local TypeScript broker service with two transports:

- **Northbound MCP Streamable HTTP:** agents call typed tools through a thin gateway bound to loopback by default.
- **Southbound authenticated WebSocket:** each Chrome-profile extension maintains one outbound connection to the extension gateway.

The broker core is transport-independent. It owns target resolution, versioned state, request policy, leases, command journaling, delivery, result correlation, and audit events. SQLite stores durable truth. Live sockets and waiters remain in memory and are rebuilt from extension reconnections after restart.

## 3. User Value

- Agents address meaningful aliases such as `research-main` instead of raw browser/profile identifiers.
- Different agents can safely share a fleet of browser profiles under predictable lease and queue rules.
- Operators can see whether a target is available, occupied, disconnected, or unhealthy without confusing status with request policy.
- Crashes and reconnects produce explicit, inspectable command states instead of silently duplicating actions.
- MCP stays small and replaceable; the broker can later support a CLI or another protocol without moving the source of truth.

## 4. Greenfield Assumptions

No application code exists in the workspace. The implementation starts as a `pnpm` TypeScript monorepo targeting the current LTS Node.js release. Exact dependency versions are pinned when scaffolding begins.

Recommended dependencies:

- Current stable MCP TypeScript server packages, isolated inside `packages/mcp-gateway`.
- `ws` for the local extension WebSocket server.
- `zod` for runtime validation shared across both protocols.
- A maintained synchronous SQLite binding with WAL support, hidden behind repository interfaces.
- `vitest` for unit/integration tests and `puppeteer` for loading the unpacked MV3 extension in end-to-end tests.
- `pino` for structured logs and OpenTelemetry-compatible metric interfaces.

MCP's modern Streamable HTTP transport supports normal HTTP request/response and optional server streaming. The implementation uses stateless tool calls where possible and broker command IDs for longer work, avoiding transport-session state as business truth. The extension sends an application heartbeat approximately every 20 seconds so its service worker remains active within Chrome's extension lifecycle guidance.

## 5. Repository Layout

```text
.
├─ apps/
│  ├─ broker/
│  │  └─ src/
│  │     ├─ main.ts
│  │     ├─ bootstrap.ts
│  │     └─ config.ts
│  └─ extension/
│     ├─ manifest.json
│     └─ src/
│        ├─ service-worker.ts
│        ├─ identity/device-identity.ts
│        ├─ transport/websocket-client.ts
│        └─ executor/browser-executor.ts
├─ packages/
│  ├─ protocol/src/
│  │  ├─ domain-types.ts
│  │  ├─ relay-messages.ts
│  │  ├─ mcp-tools.ts
│  │  └─ schemas.ts
│  ├─ broker-core/src/
│  │  ├─ broker-core.ts
│  │  ├─ target-registry.ts
│  │  ├─ target-state-index.ts
│  │  ├─ routing-policy.ts
│  │  ├─ lease-manager.ts
│  │  ├─ command-journal.ts
│  │  └─ result-correlator.ts
│  ├─ storage/src/sqlite/
│  │  ├─ database.ts
│  │  ├─ repositories.ts
│  │  └─ migrations/001-initial.sql
│  ├─ mcp-gateway/src/
│  │  ├─ server.ts
│  │  ├─ auth.ts
│  │  └─ tools/
│  └─ extension-gateway/src/
│     ├─ websocket-server.ts
│     ├─ connection-registry.ts
│     └─ challenge-auth.ts
├─ tests/
│  ├─ contract/
│  ├─ integration/
│  ├─ e2e/
│  └─ fault/
├─ package.json
├─ pnpm-workspace.yaml
└─ tsconfig.base.json
```

## 6. System Boundaries and Data Flow

```text
 MCP Agent A ─┐
 MCP Agent B ─┼─ Streamable HTTP ─> MCP Gateway ─> Broker Core
 MCP Agent N ─┘                          │              │
                                        │              ├─ Target Registry
                                        │              ├─ State Index
                                        │              ├─ Routing Policy
                                        │              ├─ Lease Manager
                                        │              └─ Command Journal
                                        │                       │
                                        │                    SQLite WAL
                                        │
 Broker Core ─> Extension Gateway ─ authenticated WebSocket ─> Extension A ─> Chrome Profile A
              │                                           ├──> Extension B ─> Chrome Profile B
              └─ Connection Registry                     └──> Extension N ─> Chrome Profile N
```

Request path:

1. MCP gateway authenticates an agent principal and validates a tool payload.
2. Broker resolves an alias or session handle to a private target ID.
3. State index returns an immutable `TargetSnapshot` and `statusVersion`.
4. Routing policy evaluates the snapshot plus request context and returns a `RoutingDecision`.
5. For `deliver` or `queue`, a transaction rechecks the target version, validates/acquires a lease, and persists the command.
6. Delivery occurs only after commit. The extension acknowledges receipt before execution and returns a correlated result.
7. Broker persists transitions/results, updates health observations, and returns or exposes the command state through MCP.

## 7. Core Domain Contracts

```ts
export type TargetStatus = 'available' | 'busy' | 'offline' | 'error';
export type RoutingDisposition = 'deliver' | 'queue' | 'wait' | 'reject';

export interface AgentPrincipal {
  principalId: string;
  displayName: string;
  scopes: readonly string[];
}

export interface TargetSelector {
  alias?: string;
  sessionHandle?: string;
}

export interface TargetSnapshot {
  /** Broker-internal only; strip at the MCP boundary. */
  targetId: string;
  alias: string;
  connectivity: 'connected' | 'disconnected';
  health: 'healthy' | 'degraded' | 'unresponsive';
  occupancy: 'free' | 'leased';
  capabilities: readonly string[];
  lastSeenAt: string | null;
  consecutiveFailures: number;
  status: TargetStatus;
  statusVersion: number;
}

export interface RequestContext {
  requestId: string;
  principal: AgentPrincipal;
  selector: TargetSelector;
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
  targetId: string;
  operation: string;
  parameters: unknown;
  idempotencyClass: 'read' | 'idempotent-write' | 'non-idempotent';
  deadlineAt: string;
}

export interface BrokerResult {
  commandId: string;
  state: 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'UNKNOWN_OUTCOME';
  output?: unknown;
  errorCode?: string;
}
```

Runtime schemas in `packages/protocol/src/schemas.ts` are authoritative at I/O boundaries. TypeScript interfaces are inferred from them when practical to prevent type/schema drift.

## 8. Component Design

### 8.1 MCP Gateway

Responsibilities:

- Bind to `127.0.0.1` by default and validate the HTTP host header.
- Authenticate bearer credentials to an `AgentPrincipal`; store only credential hashes.
- Validate all tool input/output through shared schemas.
- Call one public `BrokerCore` API per tool and map domain errors to stable MCP error payloads.
- Never query SQLite, inspect sockets, derive status, or decide routing itself.

Initial tools:

| Tool | Purpose |
|---|---|
| `list_targets` | List sanitized aliases, capabilities, status, occupancy, and last-seen time. |
| `get_target` | Return one sanitized target snapshot. |
| `acquire_session` | Acquire/wait for a lease and return an opaque session handle. |
| `release_session` | Release an owned lease. |
| `dispatch` | Submit an operation against an alias or session handle. |
| `get_command` | Poll durable command state/result. |
| `pair_target` | Admin-only pairing-code exchange. |
| `rename_target` | Admin-only alias update. |
| `revoke_target` | Admin-only credential/target revocation. |
| `broker_health` | Readiness, schema version, queue depth, and gateway status. |

Long operations return a `commandHandle`. Optional bounded waiting is an input to `dispatch`, but broker command state—not the MCP connection—is the source of truth.

### 8.2 Broker Core

`BrokerCore` is the only public application service. It coordinates repositories and domain services but contains no HTTP or WebSocket code.

Public methods:

```ts
interface BrokerCore {
  listTargets(principal: AgentPrincipal): Promise<SanitizedTarget[]>;
  getTarget(principal: AgentPrincipal, selector: TargetSelector): Promise<SanitizedTarget>;
  acquireSession(input: AcquireSessionInput): Promise<SessionHandle>;
  releaseSession(input: ReleaseSessionInput): Promise<void>;
  dispatch(input: DispatchInput): Promise<DispatchReceipt>;
  getCommand(input: GetCommandInput): Promise<SanitizedCommand>;
  recordExtensionEvent(event: ExtensionEvent): Promise<void>;
}
```

All state-changing methods receive a caller principal, request ID, deadline, and optional idempotency key. Transaction boundaries live here rather than in transport adapters.

### 8.3 Target Registry and Aliases

- Each paired installation receives a random internal `targetId`.
- The extension never reads or invents an alias; operators manage aliases in the broker.
- Aliases are unique within a broker instance and are the normal agent-facing selector.
- Session handles are high-entropy, time-bounded opaque tokens mapped to a lease and principal.
- MCP serializers use allowlists, never object spreading, to prevent internal IDs/public keys from leaking.

### 8.4 Target State Index

The state index combines:

- Persisted identity, capabilities, revocation, policy, leases, and error counters.
- Ephemeral authenticated connection presence, socket epoch, last heartbeat, and in-flight activity.

Extensions report observations (`connected`, heartbeat, command acknowledgment, result, execution error). They never report the final status string. The broker derives it in this priority order:

1. `offline` when no authenticated current connection exists or heartbeat expiry has elapsed.
2. `error` when connected/recently connected but health thresholds indicate unresponsiveness or repeated failures.
3. `busy` when healthy and an active exclusive lease exists.
4. `available` when connected, healthy, and free.

Every meaningful fact change increments `statusVersion`. Subscribers receive immutable snapshots. After restart, all targets begin `offline` until they reconnect and authenticate.

### 8.5 Routing Policy: Broker Opinion

`RoutingPolicy` is a pure broker component:

```ts
interface RoutingPolicy {
  evaluate(snapshot: TargetSnapshot, request: RequestContext): RoutingDecision;
}
```

Default policy examples:

| Fact + request | Decision |
|---|---|
| Available, authorized, supported operation | `deliver` |
| Busy, caller owns compatible lease | `deliver` |
| Busy, caller permits queue and deadline allows it | `queue` |
| Offline, caller requests bounded wait | `wait` |
| Error or unsupported capability | `reject` |
| Any status, unauthorized scope or expired deadline | `reject` |

The decision is not stored as target status. It is attached to the request/command audit record with the evaluated version. Immediately before persisting a command or lease, the broker compares `evaluatedStatusVersion` with the current version. A mismatch causes reevaluation in a bounded retry loop.

### 8.6 Lease Manager

- Default mode is one exclusive lease per target for browser-mutating work.
- Read-only shared access is disabled for MVP unless an operation is explicitly classified safe.
- Leases have owner principal, session ID, target ID, expiry, fencing token, and renewal time.
- Delivery includes the fencing token; stale owners cannot submit after expiry/reassignment.
- A target may be connected and healthy yet `busy` because another agent owns its lease.
- Queue fairness is FIFO within priority, with a per-principal concurrency cap to prevent starvation.

### 8.7 Command Journal and Result Correlation

Command state machine:

```text
ACCEPTED -> QUEUED -> DELIVERED -> ACKED -> RUNNING -> SUCCEEDED
    |          |          |          |          └----> FAILED
    |          |          |          └--------------> TIMED_OUT / UNKNOWN_OUTCOME
    |          |          └-------------------------> TIMED_OUT
    |          └------------------------------------> REJECTED / TIMED_OUT
    └-----------------------------------------------> REJECTED
```

- Persist the command and decision audit before first socket delivery.
- Use `commandId` for correlation and a separate idempotency key for agent retries.
- Reads and declared idempotent writes may be redelivered after reconnect if no terminal result exists.
- Non-idempotent commands that were acknowledged but lack a result become `UNKNOWN_OUTCOME`; they are never silently replayed.
- Results are accepted only from the authenticated current connection epoch for the expected target and command.
- Duplicate acknowledgments/results are harmless and return the previously stored terminal state.

### 8.8 Extension Gateway

The WebSocket protocol uses a versioned envelope:

```ts
interface RelayEnvelope<T = unknown> {
  protocolVersion: 1;
  messageId: string;
  type: 'HELLO' | 'CHALLENGE' | 'AUTH' | 'READY' | 'HEARTBEAT' |
        'COMMAND' | 'ACK' | 'PROGRESS' | 'RESULT' | 'ERROR';
  sentAt: string;
  payload: T;
}
```

Pairing and reconnect:

1. Extension generates a non-exportable private key and public key material.
2. Operator requests a short-lived, one-use pairing code from the broker.
3. Extension presents the code plus public key; broker creates the private target record and returns a credential binding.
4. On reconnect, broker sends a nonce challenge; extension signs it and includes protocol/capability metadata.
5. Broker verifies revocation, signature, protocol compatibility, and connection epoch before marking it ready.

Only the short pairing code is human-visible. It is not a permanent ID or reconnect credential.

The gateway owns socket lifecycle and backpressure, not business policy. It exposes `send(targetId, command)` and emits validated extension events to `BrokerCore`. One current connection per target is allowed; a newer authenticated epoch fences the old socket.

### 8.9 Manifest V3 Extension

- Background service worker maintains the authenticated WebSocket with jittered exponential reconnect.
- A roughly 20-second application heartbeat keeps the channel active and reports only observations/capabilities.
- Device identity is stored in extension-local storage and protected from content scripts.
- Executor uses a strict operation allowlist; arbitrary JavaScript evaluation is excluded from MVP.
- Each command is acknowledged before execution and completed with a structured result/error.
- A small bounded recent-command cache prevents duplicate local execution across reconnects.
- Tab/window targeting is explicit within the Chrome profile; commands never cross into another profile because each extension process only has access to its own profile context.

### 8.10 Persistence

SQLite tables:

| Table | Key contents |
|---|---|
| `targets` | Internal ID, alias, public key, capabilities, revoked flag, timestamps. |
| `target_health` | Failure counters, last success/error, health state inputs. |
| `agents` | Principal, credential hash, scopes, enabled flag. |
| `leases` | Target, owner, expiry, fencing token, state. |
| `sessions` | Opaque handle hash, lease, principal, expiry. |
| `commands` | Request, target, operation, payload, state, deadline, idempotency metadata. |
| `command_events` | Append-only state transitions and reason codes. |
| `results` | Terminal output/error with redaction metadata. |
| `pairing_codes` | One-use code hash, expiry, consumed time. |
| `audit_events` | Security/administrative events with sanitized context. |

Enable foreign keys, WAL mode, bounded busy timeout, and explicit migrations. SQLite is durable truth; the in-memory index is a rebuildable projection. Payload sizes are capped, and sensitive browser content is excluded from logs by default.

### 8.11 Configuration and Process Model

One process hosts both gateways and the broker core for MVP:

```text
apps/broker/main.ts
  -> load and validate config
  -> open/migrate SQLite
  -> recover leases and commands
  -> build BrokerCore
  -> start ExtensionGateway
  -> start McpGateway
  -> mark readiness true
```

Defaults:

- MCP: `127.0.0.1:7331/mcp`
- Extension WebSocket: `127.0.0.1:7332/relay`
- Database: OS application-data directory, never the extension directory.
- Pairing disabled unless explicitly opened for a short window.
- No LAN binding without TLS, host allowlist, and explicit operator configuration.

### 8.12 Observability

- Structured logs include request ID, command ID, sanitized target alias, principal ID, decision reason, and state transition.
- Metrics include connected targets, status counts, active leases, queue depth/age, command latency, retry counts, unknown outcomes, auth failures, and dropped connections.
- Health endpoint distinguishes liveness (process/event loop) from readiness (database migrated and both gateways initialized).
- Audit records cover pairing, revocation, alias changes, auth failures, lease conflicts, and administrative policy changes.

## 9. Security and Privacy

- Bind northbound and southbound listeners to loopback by default.
- Validate host/origin where applicable to reduce local DNS rebinding exposure.
- Use independent credentials for agents and extensions; never use target alias as authentication.
- Hash bearer/session/pairing secrets at rest; use constant-time comparison.
- Apply per-principal rate, queue, payload, and concurrency limits.
- Authorize each operation against principal scopes and target policy.
- Validate every message and reject unknown fields in security-sensitive schemas.
- Redact page content, cookies, tokens, URLs with secrets, and raw command payloads from logs.
- Expose internal target IDs only in protected operator storage and debugging modes, never normal MCP tool results.
- Sign distributable extension bundles and document exact extension ID/origin allowlists before enabling LAN mode.

## 10. Failure Semantics

| Failure | Broker behavior |
|---|---|
| Extension disconnects before delivery | Keep eligible command queued until deadline; target becomes offline. |
| Disconnect after ACK for non-idempotent command | Mark `UNKNOWN_OUTCOME` after recovery timeout; require operator/agent reconciliation. |
| Repeated extension errors | Update health facts; derive `error`; reject new work unless policy explicitly allows probes. |
| Agent disconnects | Command continues according to submitted deadline; result remains queryable. |
| Broker crashes | SQLite recovery replays command events, expires stale leases, and waits for extension reauthentication. |
| Duplicate MCP retry | Return existing command receipt/result for the same principal and idempotency key. |
| Duplicate/late extension result | Idempotently accept exact duplicate or reject stale epoch/invalid transition. |
| Status changes during routing | Version guard fails and policy reevaluates before command commit. |
| Queue overload | Reject with stable `QUEUE_CAPACITY_EXCEEDED` and suggested retry delay. |

## 11. Compatibility and Evolution

- Version MCP tool schemas and WebSocket envelopes independently.
- Maintain a compatibility matrix in `packages/protocol` and reject unsupported major versions during handshake.
- Additive optional fields are allowed within a major version; semantic changes require a new major version.
- Keep transport adapters dependent on broker interfaces, never the reverse.
- A future CLI calls `BrokerCore` through a local client or shares the same MCP tools; it does not bypass broker truth.
- A future multi-host deployment can replace SQLite repositories and the connection gateway without changing agent-facing selectors or routing contracts.

## 12. Key Architecture Decisions

1. **Broker owns facts and opinions.** Facts live in versioned snapshots; opinions live in request decisions.
2. **MCP is an adapter, not the broker.** No durable or routing state resides in MCP sessions.
3. **Extensions are execution nodes, not authorities.** They report observations and execute allowlisted commands.
4. **Persist before deliver.** Accepted work survives process failure and can be reconciled.
5. **Aliases and session handles are public; target IDs are private.** Identity and authentication remain separate.
6. **Leases use fencing tokens.** Expired owners cannot continue writing after reassignment.
7. **Unknown outcome is explicit.** Non-idempotent work is never automatically replayed after ambiguous failure.

## 13. Real-World Qualification Architecture

### 13.1 Physical Test Topology

```text
Codex Task A / Principal A ─┐                         ┌─ Extension A ─ Chrome Profile A ─ fixture marker A
Codex Task B / Principal B ─┼─ MCP Streamable HTTP ─ Broker ─ Extension B ─ Chrome Profile B ─ fixture marker B
Codex Task C / Principal C ─┤                         └─ Extension C ─ Chrome Profile C ─ fixture marker C
Codex Task D / Principal D ─┘
                                      │
                                      ├─ SQLite command/event journal
                                      ├─ structured trace export
                                      └─ real-world verifier and report
```

Use separate Chrome user-data/profile directories, not three windows from one profile. Each extension is independently paired and assigned a safe alias such as `rw-profile-a`. A local fixture server gives every profile a distinct marker page. Tests read that marker through the normal extension executor so wrong-profile routing is detected from machine-verifiable output rather than visual inspection.

Each Codex task connects to the same MCP endpoint with a distinct agent principal and uses normal production tools. The root test coordinator creates one `runId` and role-specific instruction card per task. The broker includes `runId`, request ID, command ID, target alias, connection epoch, and sanitized principal ID in trace events.

### 13.2 Evidence Model

```ts
export interface RealWorldRunManifest {
  runId: string;
  brokerBuild: string;
  extensionBuild: string;
  protocolVersion: number;
  targetAliases: readonly string[];
  principalLabels: readonly string[];
  scenarios: readonly RealWorldScenario[];
  startedAt: string;
}

export interface RealWorldScenario {
  scenarioId: string;
  relationship: '1:1' | '1:N' | 'N:1' | 'N:N' | 'fault' | 'soak';
  expectedCommands: number;
  deadlineMs: number;
  allowedOutcomeCodes: readonly string[];
}

export interface RelayTraceEvent {
  runId: string;
  requestId: string;
  commandId?: string;
  targetAlias?: string;
  principalLabel: string;
  stage: 'MCP_ACCEPT' | 'POLICY_DECISION' | 'COMMAND_COMMIT' | 'WS_SEND' |
         'EXT_ACK' | 'EXT_RESULT' | 'MCP_OBSERVED';
  connectionEpoch?: number;
  observedAt: string;
  outcomeCode?: string;
}
```

The verifier joins events by `runId`, request ID, and command ID, then checks ordering, completeness, target-marker agreement, lease overlap, duplicate execution, terminal outcomes, and latency. Raw tokens, private target IDs, public keys, cookies, and page contents are excluded from the report.

### 13.3 Acceptance Scenarios

| Stage | Real setup | What Codex verifies |
|---|---|---|
| RW-0 Preflight | 3 profiles, 3 extensions, 4 Codex tasks | Unique aliases, `available` status, protocol/build match, fixture markers, distinct principals. |
| RW-1 Parallel 1:1 | Tasks A/B/C each use profile A/B/C | Correct marker and result for every command; no cross-profile routing. |
| RW-2 One-to-many | Task A addresses all three aliases | Independent command IDs/results and no head-of-line blocking across targets. |
| RW-3 Many-to-one | Tasks A/B/C contend for profile A | One exclusive lease at a time, FIFO-within-priority behavior, correct busy facts and per-request decisions. |
| RW-4 Many-to-many | Four tasks send mixed work to three profiles | Smooth bidirectional traffic, bounded queues, correct correlation, isolation, and fairness. |
| RW-5 Faults | Close/reopen one window; drop one Codex task; restart broker | Offline/reconnect derivation, safe recovery, no silent non-idempotent replay, queryable results. |
| RW-6 Soak | All profiles/tasks active for 30 minutes | No lost messages, memory/queue growth, credential leakage, stale leases, or reconnect storm. |

### 13.4 Measured Pass Criteria

- Zero target-marker mismatches across the entire run.
- Zero accepted commands without a terminal state, except deliberately induced and correctly labeled `UNKNOWN_OUTCOME` cases.
- Zero duplicate executions of a non-idempotent operation.
- Zero overlapping exclusive lease fencing intervals for one target.
- 100% of successful commands contain the ordered trace: accept → decision → commit → send → ACK → result → return/query.
- Under unloaded loopback conditions, broker acceptance p95 ≤ 500 ms and extension ACK p95 ≤ 1 second. Operation-result latency is measured separately by operation class.
- During mixed N:N load, at least 99% of commands finish within their declared deadline; every miss has an explicit timeout/rejection reason.
- A deliberately closed target becomes `offline` within the configured heartbeat window and returns to `available` after authenticated reconnect and health recovery.
- After the 30-minute soak, queue depth returns to zero, leases are released/expired, connected-target count is correct, and process memory shows no sustained monotonic growth above the configured tolerance.

### 13.5 User-Assisted Checkpoints

User assistance is a controlled prerequisite, never the source of pass/fail evidence.

1. **U1 — Browser setup:** Codex provides the exact extension build path, three fixture URLs, and three short-lived pairing steps. The user opens three separate Chrome profiles, loads the unpacked extension, visits the assigned fixture in each, and replies `U1 ready`. No secret is pasted into chat.
2. **U2 — Codex task setup:** Codex provides four role cards. The user opens four independent Codex tasks in the test workspace, applies one role card to each, and replies `U2 ready`. Agent credentials are provisioned into local protected files/configuration by Codex, not copied through chat.
3. **U3 — Coordinated start:** After automated preflight passes, Codex gives one short `Start RW-4 now` instruction. The user sends it to the prepared tasks only if cross-task programmatic coordination is unavailable.
4. **U4 — Physical fault:** Codex names exactly one Chrome window and announces the observation window. The user closes and later reopens only that window, then replies `closed` and `reopened` when asked.
5. **U5 — Completion:** Codex collects traces, executes the verifier, restores the normal test state, and presents the report. The user is not asked to judge UI behavior manually.

At each checkpoint, testing pauses before the action and resumes only after the user's confirmation. Failure to complete a checkpoint is reported as `ENVIRONMENT_NOT_READY`, not as a product test failure.

### 13.6 Real-World Test Artifacts

The implementation creates:

```text
tests/real-world/
├─ scenario-runner.ts
├─ run-manifest.schema.ts
├─ trace-verifier.ts
├─ fixture-server.ts
├─ scenarios/
│  ├─ parallel-one-to-one.ts
│  ├─ one-to-many.ts
│  ├─ many-to-one.ts
│  ├─ many-to-many.ts
│  ├─ disconnect-recovery.ts
│  └─ soak.ts
└─ reports/.gitignore
scripts/
├─ real-world-preflight.ps1
├─ real-world-start.ps1
├─ real-world-verify.ps1
└─ real-world-cleanup.ps1
docs/
└─ real-world-test-runbook.md
```

Reports contain build versions, topology, scenario counts, latency percentiles, trace-integrity findings, recovery observations, and final PASS/FAIL/ENVIRONMENT_NOT_READY status.

## 14. External References

- The official [MCP TypeScript server guide](https://ts.sdk.modelcontextprotocol.io/server) documents Streamable HTTP, typed tool schemas, sessions/resumability, and loopback/DNS-rebinding protections.
- Chrome's [extension WebSocket guidance](https://developer.chrome.com/docs/extensions/how-to/web-platform/websockets) describes service-worker WebSocket support and periodic keepalive messaging.
- SQLite's [WAL documentation](https://sqlite.org/wal.html) describes write-ahead logging and its concurrency characteristics.
