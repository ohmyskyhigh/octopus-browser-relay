# Implementation Tasks

Execute tasks in order. A task is complete only when its implementation, automated tests, and listed deliverable are committed together. Commands assume PowerShell at the repository root and are intentionally non-interactive.

## Global Definition of Done

- `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.
- `pnpm verify` runs contract, integration, end-to-end, restart, concurrency, and fault suites.
- All external inputs use runtime schemas; no `any` crosses a transport boundary.
- MCP outputs pass an explicit sensitive-field leak test.
- State transitions and routing decisions have stable reason/error codes.
- Every database migration has forward-compatibility and clean-database tests.
- No non-idempotent command is retried after an ambiguous acknowledgement.

---

## Task Group 1 — Repository Foundation and Contracts

### Task 1.1 — Scaffold the TypeScript monorepo

**Files:** `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.mjs`, `vitest.workspace.ts`, `.gitignore`

**Solution:** Create workspaces for `apps/*` and `packages/*`; pin Node, pnpm, TypeScript, lint, test, MCP SDK, validation, WebSocket, SQLite, logging, and Puppeteer dependencies. Define `build`, `lint`, `typecheck`, `test`, and `verify` scripts. Configure strict TypeScript with `noUncheckedIndexedAccess` and project references.

**Dependencies:** None.

**Deliverable:** A reproducible empty workspace in which every package can build and test independently.

**Automated verification:** `pnpm install --frozen-lockfile; pnpm lint; pnpm typecheck; pnpm test`

### Task 1.2 — Define domain and I/O schemas

**Files:** `packages/protocol/src/domain-types.ts`, `packages/protocol/src/schemas.ts`, `packages/protocol/src/error-codes.ts`, `packages/protocol/src/index.ts`, `tests/contract/schema-contract.test.ts`

**Solution:** Define schemas/types for agents, selectors, sanitized targets, snapshots, request contexts, routing decisions, sessions, commands, results, and stable error codes. Use strict object schemas for security-sensitive input. Mark internal-only fields and provide allowlist serializers for MCP output.

**Dependencies:** Task 1.1.

**Deliverable:** One compiled package that both gateways and broker core use as the contract authority.

**Automated verification:** `pnpm vitest run tests/contract/schema-contract.test.ts`; include generated invalid/unknown-field payloads and verify internal `targetId`, key material, and hashes cannot appear in sanitized output.

### Task 1.3 — Define the versioned extension protocol

**Files:** `packages/protocol/src/relay-messages.ts`, `packages/protocol/src/protocol-compatibility.ts`, `tests/contract/relay-protocol.test.ts`

**Solution:** Implement version-1 envelopes and payload schemas for `HELLO`, `CHALLENGE`, `AUTH`, `READY`, `HEARTBEAT`, `COMMAND`, `ACK`, `PROGRESS`, `RESULT`, and `ERROR`. Define max payload sizes and major/minor compatibility rules.

**Dependencies:** Task 1.2.

**Deliverable:** A parser that returns typed messages or stable protocol errors without throwing unclassified exceptions.

**Automated verification:** `pnpm vitest run tests/contract/relay-protocol.test.ts`; fuzz truncated JSON, unknown message types, oversized payloads, invalid timestamps, duplicate IDs, and unsupported versions.

### Milestone Gate 1 — Contract Baseline

Run `pnpm lint; pnpm typecheck; pnpm vitest run tests/contract`. Do not start persistence until every transport-bound type is represented by a runtime schema.

**Rollback point:** Tag the repository `contracts-v1-baseline`. Protocol changes after this point require a compatibility decision and updated fixtures.

---

## Task Group 2 — Durable Broker Truth and State Derivation

### Task 2.1 — Create SQLite bootstrap and migrations

**Files:** `packages/storage/src/sqlite/database.ts`, `packages/storage/src/sqlite/migrations/001-initial.sql`, `packages/storage/src/sqlite/migrate.ts`, `tests/integration/sqlite-migrations.test.ts`

**Solution:** Create tables for targets, health inputs, agents, leases, sessions, commands, command events, results, pairing codes, and audit events. Enable foreign keys, WAL, bounded busy timeout, schema versioning, and transactional migrations. Never store live socket references.

**Dependencies:** Task 1.2.

**Deliverable:** A database factory that opens a new or existing database and migrates it exactly once.

**Automated verification:** `pnpm vitest run tests/integration/sqlite-migrations.test.ts`; test empty DB, repeated startup, interrupted migration rollback, foreign-key violations, and two concurrent readers during a write.

### Task 2.2 — Implement repositories and transaction boundary

**Files:** `packages/storage/src/repositories.ts`, `packages/storage/src/sqlite/repositories.ts`, `packages/storage/src/sqlite/transaction.ts`, `tests/integration/repositories.test.ts`

**Solution:** Define repository interfaces outside SQLite, implement prepared-statement repositories, and provide one transaction callback used by broker core. Enforce unique aliases, scoped idempotency keys, monotonic command events, and compare-and-swap status versions.

**Dependencies:** Task 2.1.

**Deliverable:** Storage-independent interfaces plus a SQLite implementation with deterministic conflict errors.

**Automated verification:** `pnpm vitest run tests/integration/repositories.test.ts`; race duplicate aliases/idempotency keys and assert exactly one winner with no partial rows.

### Task 2.3 — Implement target registry and sanitized resolution

**Files:** `packages/broker-core/src/target-registry.ts`, `packages/broker-core/src/serializers.ts`, `tests/unit/target-registry.test.ts`, `tests/contract/mcp-output-leak.test.ts`

**Solution:** Pair/revoke/rename targets, resolve alias to private target ID, and resolve opaque session handles through their owner. Generate random internal IDs; hash handles/secrets at rest. Construct all agent-facing objects by allowlist.

**Dependencies:** Tasks 1.2 and 2.2.

**Deliverable:** Registry APIs that never require an agent to know a profile ID or device identifier.

**Automated verification:** `pnpm vitest run tests/unit/target-registry.test.ts tests/contract/mcp-output-leak.test.ts`; recursively scan serialized values for internal IDs, public keys, credential hashes, and profile-path fixtures.

### Task 2.4 — Implement connection facts and status derivation

**Files:** `packages/broker-core/src/target-state-index.ts`, `packages/broker-core/src/status-derivation.ts`, `packages/broker-core/src/clock.ts`, `tests/unit/status-derivation.test.ts`, `tests/fault/heartbeat-expiry.test.ts`

**Solution:** Combine persisted facts with an injected live-connection view. Derive `offline`, `error`, `busy`, and `available` in the documented priority order. Increment `statusVersion` only for meaningful fact changes. Use an injected clock for deterministic heartbeat/error-window tests.

**Dependencies:** Tasks 2.2 and 2.3.

**Deliverable:** Immutable, versioned snapshots and an event subscription API.

**Automated verification:** `pnpm vitest run tests/unit/status-derivation.test.ts tests/fault/heartbeat-expiry.test.ts`; cover disconnect versus unresponsive, lease occupancy, repeated failures, recovery after success, clock jumps, and duplicate heartbeat events.

### Milestone Gate 2 — Source-of-Truth Core

Run `pnpm vitest run tests/unit tests/integration tests/fault/heartbeat-expiry.test.ts`. Start the broker twice against the same test DB and assert persisted targets survive while every live connection resets to `offline`.

**Rollback point:** Preserve migration `001` and repository interfaces. If the SQLite binding changes, replace only `packages/storage/src/sqlite` and rerun this gate.

---

## Task Group 3 — Broker Opinion, Leases, and Commands

### Task 3.1 — Implement pure routing policy

**Files:** `packages/broker-core/src/routing-policy.ts`, `packages/broker-core/src/policy-config.ts`, `tests/unit/routing-policy.test.ts`

**Solution:** Evaluate an immutable snapshot plus request context into `deliver`, `queue`, `wait`, or `reject`. Include authorization, capability, deadline, lease ownership, requested waiting, queue capacity, and stable reason codes. Do not mutate target state or perform I/O.

**Dependencies:** Task 2.4.

**Deliverable:** A table-driven, deterministic broker opinion with complete branch coverage.

**Automated verification:** `pnpm vitest run tests/unit/routing-policy.test.ts --coverage`; require 100% branch coverage for the decision table and property-test that expired/unauthorized requests never deliver.

### Task 3.2 — Implement leases, sessions, and fencing

**Files:** `packages/broker-core/src/lease-manager.ts`, `packages/broker-core/src/session-handles.ts`, `tests/integration/lease-concurrency.test.ts`, `tests/fault/lease-expiry.test.ts`

**Solution:** Create exclusive time-bounded leases with monotonic fencing tokens and opaque principal-bound session handles. Implement acquire, bounded wait, renew, release, expiry, and FIFO-within-priority fairness. Reject stale owners even if they retain a handle.

**Dependencies:** Tasks 2.2, 2.4, and 3.1.

**Deliverable:** Transactional lease APIs that admit at most one exclusive owner per target.

**Automated verification:** `pnpm vitest run tests/integration/lease-concurrency.test.ts tests/fault/lease-expiry.test.ts`; launch 100 concurrent contenders, advance fake time through expiry, and prove no overlapping fencing interval exists.

### Task 3.3 — Implement command journal and idempotency

**Files:** `packages/broker-core/src/command-journal.ts`, `packages/broker-core/src/command-state-machine.ts`, `packages/broker-core/src/idempotency.ts`, `tests/unit/command-state-machine.test.ts`, `tests/integration/idempotency.test.ts`

**Solution:** Enforce the command state machine, persist append-only events, scope idempotency keys by principal, and return prior receipts/results on duplicates. Classify operations as read, idempotent write, or non-idempotent.

**Dependencies:** Task 2.2.

**Deliverable:** Durable command creation and transition APIs that reject illegal or duplicate transitions deterministically.

**Automated verification:** `pnpm vitest run tests/unit/command-state-machine.test.ts tests/integration/idempotency.test.ts`; enumerate every state-pair transition and race duplicate submissions from multiple workers.

### Task 3.4 — Compose BrokerCore with stale-opinion protection

**Files:** `packages/broker-core/src/broker-core.ts`, `packages/broker-core/src/result-correlator.ts`, `tests/integration/broker-dispatch.test.ts`, `tests/fault/status-version-race.test.ts`

**Solution:** Implement public broker methods. Resolve selector, get snapshot, evaluate policy, then enter a transaction that rechecks `statusVersion`, lease/fencing, deadline, and capacity before persisting the command. On a version mismatch, reevaluate with a bounded retry; never deliver before commit. Correlate results to target, connection epoch, command, and legal state.

**Dependencies:** Tasks 3.1–3.3.

**Deliverable:** A transport-independent application service with no stale routing decisions and no pre-commit delivery.

**Automated verification:** `pnpm vitest run tests/integration/broker-dispatch.test.ts tests/fault/status-version-race.test.ts`; inject a lease/disconnect between evaluation and commit and assert the original opinion is discarded.

### Milestone Gate 3 — Broker Semantics

Run `pnpm vitest run tests/unit tests/integration tests/fault/status-version-race.test.ts`. Review the SQL event trail for one delivered, one queued, one rejected, and one unknown-outcome command; each must retain snapshot version and decision reason.

**Rollback point:** Keep `BrokerCore` interfaces stable. Policy and lease implementations can be reverted independently because they are injected components.

---

## Task Group 4 — Authenticated Extension Gateway

### Task 4.1 — Implement pairing and challenge authentication

**Files:** `packages/extension-gateway/src/challenge-auth.ts`, `packages/extension-gateway/src/pairing-service.ts`, `tests/integration/extension-auth.test.ts`, `tests/fault/auth-replay.test.ts`

**Solution:** Issue short-lived one-use pairing codes stored as hashes, bind a presented public key to a new target, and authenticate reconnects with signed nonces. Enforce expiry, revocation, one-time consumption, constant-time comparisons, and protocol compatibility.

**Dependencies:** Tasks 1.3 and 2.3.

**Deliverable:** Authentication APIs that separate human-friendly pairing from durable device identity.

**Automated verification:** `pnpm vitest run tests/integration/extension-auth.test.ts tests/fault/auth-replay.test.ts`; replay challenges/codes, swap keys, expire codes, revoke targets, and attempt version downgrade.

### Task 4.2 — Implement connection registry and epochs

**Files:** `packages/extension-gateway/src/connection-registry.ts`, `packages/extension-gateway/src/heartbeat-monitor.ts`, `tests/unit/connection-registry.test.ts`, `tests/fault/socket-fencing.test.ts`

**Solution:** Track at most one authenticated current connection per target using monotonically increasing epochs. Fence/close older sockets after a newer authentication. Expose connection facts and `send()` without exposing sockets to broker core. Detect missed heartbeats with an injected clock.

**Dependencies:** Tasks 2.4 and 4.1.

**Deliverable:** A rebuildable live connection projection with deterministic offline events.

**Automated verification:** `pnpm vitest run tests/unit/connection-registry.test.ts tests/fault/socket-fencing.test.ts`; authenticate two sockets for one target, deliver through only the newest epoch, and advance time past heartbeat expiry.

### Task 4.3 — Implement WebSocket server and backpressure

**Files:** `packages/extension-gateway/src/websocket-server.ts`, `packages/extension-gateway/src/rate-limits.ts`, `tests/integration/websocket-gateway.test.ts`, `tests/fault/websocket-abuse.test.ts`

**Solution:** Bind loopback by default; validate host/origin/config; parse protocol envelopes; apply auth timeouts, message/payload/rate limits, bounded send buffers, and graceful close codes. Translate validated connection events into `BrokerCore.recordExtensionEvent` calls.

**Dependencies:** Tasks 1.3, 4.1, and 4.2.

**Deliverable:** A southbound server that contains transport state but no routing decisions.

**Automated verification:** `pnpm vitest run tests/integration/websocket-gateway.test.ts tests/fault/websocket-abuse.test.ts`; test slow readers, fragmented/oversized frames, invalid JSON floods, unauthenticated heartbeats, and reconnect storms.

### Task 4.4 — Wire durable delivery and recovery

**Files:** `packages/extension-gateway/src/command-delivery.ts`, `packages/broker-core/src/recovery.ts`, `tests/integration/delivery-recovery.test.ts`, `tests/fault/crash-points.test.ts`

**Solution:** Subscribe to committed eligible commands, send by current connection epoch, persist delivery/ACK/result transitions, and recover unfinished work on startup. Redeliver only safe classes; turn ambiguous acknowledged non-idempotent commands into `UNKNOWN_OUTCOME`.

**Dependencies:** Tasks 3.3, 3.4, 4.2, and 4.3.

**Deliverable:** At-least-once transport delivery with effectively-once broker semantics for idempotent work and explicit ambiguity for non-idempotent work.

**Automated verification:** `pnpm vitest run tests/integration/delivery-recovery.test.ts tests/fault/crash-points.test.ts`; terminate the child broker after commit, after send, after ACK, and after result receipt, then restart and assert documented outcomes.

### Milestone Gate 4 — Broker-to-Extension Loop

Run `pnpm vitest run tests/integration/websocket-gateway.test.ts tests/integration/delivery-recovery.test.ts tests/fault`. No browser extension is required yet; a protocol simulator must complete and recover commands through the real WebSocket gateway.

**Rollback point:** Freeze relay protocol v1 fixtures. Gateway internals may change without changing broker core or stored command semantics.

---

## Task Group 5 — Manifest V3 Extension Node

### Task 5.1 — Scaffold the extension and permissions

**Files:** `apps/extension/manifest.json`, `apps/extension/src/service-worker.ts`, `apps/extension/src/config.ts`, `apps/extension/vite.config.ts`, `tests/contract/extension-manifest.test.ts`

**Solution:** Create an MV3 background service worker with minimum required permissions and an explicit local broker host permission. Exclude arbitrary page access until an allowlisted operation requires it. Build a deterministic unpacked directory.

**Dependencies:** Task 1.1.

**Deliverable:** Chrome-loadable extension bundle with reviewed permissions.

**Automated verification:** `pnpm build --filter @relay/extension; pnpm vitest run tests/contract/extension-manifest.test.ts`; reject unexpected permissions, remote code, CSP weakening, or missing service-worker entry.

### Task 5.2 — Implement device identity and pairing client

**Files:** `apps/extension/src/identity/device-identity.ts`, `apps/extension/src/identity/pairing-client.ts`, `tests/unit/extension-identity.test.ts`

**Solution:** Generate/store signing identity in extension-local storage, expose only public proof to transport code, and consume short-lived pairing codes. Provide explicit reset/re-pair behavior without displaying a durable raw target ID.

**Dependencies:** Tasks 4.1 and 5.1.

**Deliverable:** Reconnect identity that survives service-worker restarts and cannot be read by content scripts.

**Automated verification:** `pnpm vitest run tests/unit/extension-identity.test.ts`; simulate storage restart, corrupt key material, code reuse, and reset.

### Task 5.3 — Implement resilient WebSocket client

**Files:** `apps/extension/src/transport/websocket-client.ts`, `apps/extension/src/transport/heartbeat.ts`, `apps/extension/src/transport/backoff.ts`, `tests/unit/extension-websocket-client.test.ts`

**Solution:** Implement challenge authentication, approximately 20-second heartbeats, jittered exponential reconnect, connection epoch handling, bounded outgoing queue, and clean suspension/resumption behavior. Never derive broker status locally.

**Dependencies:** Tasks 1.3, 4.3, and 5.2.

**Deliverable:** A service-worker-safe connection loop that returns validated observations/results.

**Automated verification:** `pnpm vitest run tests/unit/extension-websocket-client.test.ts`; use fake timers for heartbeat, broker restarts, offline periods, thundering-herd jitter, stale epoch commands, and malformed frames.

### Task 5.4 — Implement allowlisted command executor

**Files:** `apps/extension/src/executor/browser-executor.ts`, `apps/extension/src/executor/operations/*.ts`, `apps/extension/src/executor/recent-command-cache.ts`, `tests/e2e/extension-execution.test.ts`

**Solution:** Start with a narrow operation set such as list tabs, inspect active tab metadata, open URL, activate tab, navigate, and capture a structured page snapshot. Validate per-operation input, enforce URL/payload limits, acknowledge before execution, and cache recent command IDs to suppress duplicates. Do not provide arbitrary JavaScript execution.

**Dependencies:** Tasks 5.1 and 5.3.

**Deliverable:** A profile-local executor with structured success/error results and duplicate suppression.

**Automated verification:** `pnpm vitest run tests/e2e/extension-execution.test.ts`; launch two persistent Chrome profiles with the unpacked extension, prove commands reach only the selected profile, replay a command ID, use blocked URL schemes, close tabs mid-command, and restart the service worker.

### Milestone Gate 5 — Real Multi-Profile Relay

Run `pnpm vitest run tests/e2e/extension-execution.test.ts`. The test must pair two isolated Chrome user-data directories, assign two aliases, dispatch concurrently, and prove no cross-profile tab access or result correlation.

**Rollback point:** Package the first working extension bundle and record its protocol version/permissions. Executor operations can be added independently behind the allowlist.

---

## Task Group 6 — MCP Gateway and Agent Contract

### Task 6.1 — Implement agent authentication and authorization

**Files:** `packages/mcp-gateway/src/auth.ts`, `packages/mcp-gateway/src/authorization.ts`, `tests/integration/mcp-auth.test.ts`

**Solution:** Authenticate hashed bearer credentials, map them to principals/scopes, enforce per-tool/operation authorization, and apply per-principal rate/concurrency limits. Bind loopback and enable the MCP SDK's recommended host validation/DNS-rebinding protections.

**Dependencies:** Tasks 2.2 and 3.4.

**Deliverable:** A reusable auth middleware that fails closed with stable codes.

**Automated verification:** `pnpm vitest run tests/integration/mcp-auth.test.ts`; test missing/invalid/revoked credentials, scope escalation, hostile host headers, burst limits, and cross-principal session handles.

### Task 6.2 — Implement MCP server and discovery tools

**Files:** `packages/mcp-gateway/src/server.ts`, `packages/mcp-gateway/src/tools/list-targets.ts`, `packages/mcp-gateway/src/tools/get-target.ts`, `packages/mcp-gateway/src/tools/broker-health.ts`, `tests/integration/mcp-discovery-tools.test.ts`

**Solution:** Create the Streamable HTTP server with typed schemas and structured content. Implement sanitized discovery/health tools by calling only `BrokerCore`. Keep transport sessions stateless for domain purposes.

**Dependencies:** Tasks 1.2, 3.4, and 6.1.

**Deliverable:** Agents can authenticate and inspect public broker state without seeing private identifiers.

**Automated verification:** `pnpm vitest run tests/integration/mcp-discovery-tools.test.ts`; make real HTTP MCP calls, validate schemas, scan responses for secret fixtures, and restart the MCP transport between calls.

### Task 6.3 — Implement session and dispatch tools

**Files:** `packages/mcp-gateway/src/tools/acquire-session.ts`, `packages/mcp-gateway/src/tools/release-session.ts`, `packages/mcp-gateway/src/tools/dispatch.ts`, `packages/mcp-gateway/src/tools/get-command.ts`, `tests/integration/mcp-command-tools.test.ts`

**Solution:** Expose lease/session acquisition, release, durable dispatch, optional bounded wait, and command lookup. Return opaque handles and structured decision/reason metadata. Cancellation stops waiting but does not erase already accepted work.

**Dependencies:** Tasks 3.2, 3.4, and 6.2.

**Deliverable:** Complete agent workflow through MCP with no direct extension access.

**Automated verification:** `pnpm vitest run tests/integration/mcp-command-tools.test.ts`; cover one-to-one, one-to-many, many-to-one contention, many-to-many, client disconnect during wait, deadline expiry, duplicate idempotency keys, and unauthorized command lookup.

### Task 6.4 — Implement administrative MCP tools

**Files:** `packages/mcp-gateway/src/tools/pair-target.ts`, `packages/mcp-gateway/src/tools/rename-target.ts`, `packages/mcp-gateway/src/tools/revoke-target.ts`, `tests/integration/mcp-admin-tools.test.ts`

**Solution:** Add separately scoped tools for pairing windows, alias changes, and revocation. Pairing returns only a short-lived code; revocation immediately fences sockets/sessions and rejects new work.

**Dependencies:** Tasks 4.1 and 6.2.

**Deliverable:** Minimal operator control without raw target IDs in normal output.

**Automated verification:** `pnpm vitest run tests/integration/mcp-admin-tools.test.ts`; verify non-admin denial, code expiry/use-once behavior, duplicate alias conflict, and in-flight revocation.

### Milestone Gate 6 — End-to-End Agent Path

Run `pnpm vitest run tests/integration/mcp-*.test.ts tests/e2e`. Then run `pnpm verify`. All three relationship patterns—1:1, 1:N, and N:N—must pass through real MCP and WebSocket transports.

**Rollback point:** Freeze MCP tool schemas as v1 fixtures. Future presentation changes must preserve broker APIs and sanitized fields.

---

## Task Group 7 — Process Composition, Recovery, and Operations

### Task 7.1 — Compose the broker process and validated configuration

**Files:** `apps/broker/src/config.ts`, `apps/broker/src/bootstrap.ts`, `apps/broker/src/main.ts`, `tests/integration/broker-bootstrap.test.ts`

**Solution:** Load and validate ports, bind addresses, DB path, heartbeat/error thresholds, lease/queue limits, and log level. Start in order: database/migrations, recovery, broker core, extension gateway, MCP gateway, readiness. Shut down by stopping admission, draining bounded work, closing gateways, then closing SQLite.

**Dependencies:** Tasks 4.4 and 6.4.

**Deliverable:** One long-running process with deterministic startup/shutdown and no hidden global state.

**Automated verification:** `pnpm vitest run tests/integration/broker-bootstrap.test.ts`; cover invalid config, occupied ports, corrupt DB, startup cancellation, SIGTERM during work, and repeated start/stop.

### Task 7.2 — Add structured logs, metrics, health, and audit

**Files:** `packages/broker-core/src/observability.ts`, `apps/broker/src/health-server.ts`, `packages/storage/src/sqlite/audit-repository.ts`, `tests/contract/log-redaction.test.ts`, `tests/integration/health-metrics.test.ts`

**Solution:** Emit structured transitions with request/command IDs, principal, alias, snapshot version, and decision reason. Add liveness/readiness and metric snapshots. Audit pairing, revocation, auth failures, lease conflicts, and policy changes. Redact URLs with credentials, page content, tokens, cookies, keys, and raw payloads.

**Dependencies:** Task 7.1.

**Deliverable:** Actionable diagnostics that do not leak browser or authentication data.

**Automated verification:** `pnpm vitest run tests/contract/log-redaction.test.ts tests/integration/health-metrics.test.ts`; inject secret canaries in every field and recursively assert none appear in logs/audit/metrics.

### Task 7.3 — Add full fault, load, and soak suites

**Files:** `tests/fault/network-partition.test.ts`, `tests/fault/sqlite-contention.test.ts`, `tests/fault/clock-skew.test.ts`, `tests/load/multi-agent-load.test.ts`, `tests/soak/reconnect-soak.test.ts`

**Solution:** Build deterministic network proxies/fake clocks for normal CI and an opt-in real-process soak. Exercise partitions, frame loss/duplication/reordering, SQLite busy conditions, deadline races, clock changes, queue saturation, socket churn, and process restart.

**Dependencies:** Tasks 7.1 and 7.2.

**Deliverable:** Reproducible evidence that failure semantics and resource bounds hold under stress.

**Automated verification:** `pnpm vitest run tests/fault tests/load`; run the longer suite with `pnpm test:soak -- --duration=15m`. Assert bounded memory, queue length, reconnect rate, and zero duplicate non-idempotent execution.

### Task 7.4 — Package, document, and verify local installation

**Files:** `README.md`, `docs/runbook.md`, `docs/security.md`, `docs/protocol-v1.md`, `scripts/install-local.ps1`, `scripts/smoke-test.ps1`, `tests/smoke/installed-system.test.ts`

**Solution:** Document setup, agent-token creation, pairing, aliasing, upgrades, backup, recovery, revocation, log collection, and complete uninstall. Package broker for Windows as a user-level background process and build a versioned unpacked/packed extension artifact. The install script must be idempotent and avoid system-wide changes unless explicitly selected.

**Dependencies:** Tasks 7.1–7.3.

**Deliverable:** A reproducible local release plus operator runbook and one-command smoke test.

**Automated verification:** `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-local.ps1 -TestMode; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/smoke-test.ps1`; the smoke test launches two profiles, pairs them, performs an MCP dispatch, restarts the broker, verifies recovery, revokes one target, and uninstalls the test instance.

### Milestone Gate 7 — Release Candidate

Run:

```powershell
pnpm install --frozen-lockfile
pnpm verify
pnpm test:soak -- --duration=15m
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/smoke-test.ps1
```

Release only if all success metrics in `README.md` are met and the leak/redaction tests contain zero findings.

**Rollback point:** Keep the prior broker executable, extension bundle, and SQLite backup. Database upgrades must be forward compatible with the prior binary until the release is declared stable; otherwise migration deployment is blocked.

---

## Task Group 8 — User-Assisted Real-World Qualification

This group is executed only after Milestone Gate 7 passes. User actions prepare physical Chrome/Codex surfaces; all assertions and the final result remain Codex-executable and machine-verifiable.

### Task 8.1 — Build the real-world fixture, manifest, and trace verifier

**Files:** `tests/real-world/fixture-server.ts`, `tests/real-world/run-manifest.schema.ts`, `tests/real-world/trace-verifier.ts`, `tests/real-world/trace-verifier.test.ts`

**Solution:** Add a loopback fixture server with distinct pages/markers for profiles A, B, and C. Define a strict run manifest containing build versions, aliases, principals, scenario IDs, deadlines, and expected counts. Export sanitized broker trace events for MCP accept, policy decision, command commit, WebSocket send, extension ACK/result, and later MCP observation/query. The verifier joins events by run/request/command IDs and checks legal ordering, completeness, marker-to-alias agreement, connection epoch, lease overlap, duplicate execution, deadlines, latency percentiles, and redaction. For non-idempotent duplicate detection, use a uniquely tagged `open_url` command and assert one matching tab per accepted command ID.

**Dependencies:** Milestone Gate 7 and the observability work in Task 7.2.

**Deliverable:** Deterministic test fixture and a verifier that emits `PASS`, `FAIL`, or `ENVIRONMENT_NOT_READY` plus JSON/Markdown evidence.

**Automated verification:** `pnpm vitest run tests/real-world/trace-verifier.test.ts`; feed missing, duplicated, reordered, cross-target, stale-epoch, overlapping-lease, late, redacted-secret, and legitimate `UNKNOWN_OUTCOME` trace fixtures. The verifier must fail each corrupted fixture for the intended reason and pass the canonical fixture.

### Task 8.2 — Implement preflight and explicit user handoffs

**Files:** `scripts/real-world-preflight.ps1`, `tests/real-world/user-checkpoints.ts`, `docs/real-world-test-runbook.md`, `tests/real-world/user-checkpoints.test.ts`

**Solution:** Implement U1–U5 checkpoints from the technical architecture. Preflight checks the exact broker/extension build and protocol versions, three unique connected aliases, distinct fixture markers, four distinct agent principals, clock sanity, queue/lease cleanliness, free ports, disk space, and trace export readiness. When a physical prerequisite is missing, write a sanitized `action-required.md`, exit with a dedicated environment-not-ready code, and pause the run. Never print or request secrets. A resumed run reuses the manifest and revalidates every prerequisite.

**Dependencies:** Task 8.1.

**Deliverable:** A resumable handoff protocol that tells the user exactly what to open/close and never mistakes an incomplete setup for a product defect.

**Automated verification:** `pnpm vitest run tests/real-world/user-checkpoints.test.ts; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/real-world-preflight.ps1 -Simulate missing-browsers`; assert exit code/status `ENVIRONMENT_NOT_READY`, one U1 action card, no secret canaries, and successful resume with a simulated ready topology.

At actual execution, Codex sends this shape of message and stops before proceeding:

```text
ACTION REQUIRED — U1 Browser setup
1. Open three separate Chrome profiles using the names I provide.
2. In each profile, load the unpacked extension from the exact path I provide.
3. Open the assigned local fixture URL in each window and keep it open.
4. Complete the on-screen pairing step. Do not paste codes or tokens into chat.
Reply exactly: U1 ready
```

### Task 8.3 — Implement multi-Codex-task role cards and normal-traffic scenarios

**Files:** `tests/real-world/scenario-runner.ts`, `tests/real-world/role-cards/agent-a.md`, `tests/real-world/role-cards/agent-b.md`, `tests/real-world/role-cards/agent-c.md`, `tests/real-world/role-cards/agent-d.md`, `tests/real-world/scenarios/parallel-one-to-one.ts`, `tests/real-world/scenarios/one-to-many.ts`, `tests/real-world/scenarios/many-to-one.ts`, `tests/real-world/scenarios/many-to-many.ts`

**Solution:** Generate four self-contained role cards for four independent Codex tasks. Each card names only its principal label, run ID, permitted aliases, scenario sequence, and normal MCP tools; credentials remain in protected local configuration. A shared ready/barrier file lets the coordinator release tasks together without relying on the user to click four windows at precisely the same millisecond. Scenarios run safe local fixture operations and include read-only calls, exclusive tab mutations, idempotent retry, bounded wait, and cancellation.

**Dependencies:** Tasks 8.1 and 8.2.

**Deliverable:** Repeatable 1:1, 1:N, N:1, and N:N workloads driven by real independent Codex tasks through the production MCP gateway.

**Automated verification:** After U1 and U2 are confirmed, run `pnpm tsx tests/real-world/scenario-runner.ts --manifest artifacts/real-world/$env:RELAY_RW_RUN/manifest.json --scenarios parallel-one-to-one,one-to-many,many-to-one,many-to-many`; then run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/real-world-verify.ps1 -RunId $env:RELAY_RW_RUN -Phase normal`. Assert zero marker mismatches, zero orphaned commands, zero duplicate non-idempotent actions, no overlapping exclusive leases, FIFO-within-priority order, and complete ordered traces.

Actual U2 handoff:

```text
ACTION REQUIRED — U2 Codex task setup
1. Open four independent Codex tasks in the test workspace.
2. I will give you one role-card path for each task; send the matching card to that task.
3. Wait until each task reports READY. Do not copy credentials between tasks or into chat.
4. Reply here with: U2 ready
```

### Task 8.4 — Execute bidirectional load, physical faults, and soak

**Files:** `tests/real-world/scenarios/disconnect-recovery.ts`, `tests/real-world/scenarios/agent-drop.ts`, `tests/real-world/scenarios/broker-restart.ts`, `tests/real-world/scenarios/soak.ts`, `scripts/real-world-start.ps1`

**Solution:** Continuously mix MCP requests, queued work, extension heartbeats, ACKs, progress, results, and command queries across all tasks/targets. During a controlled window, ask the user to close and reopen exactly one named Chrome profile while Codex separately drops one agent task connection and restarts the broker process. Continue with a 30-minute N:N soak. Record queue depth, memory, event-loop delay, heartbeat gaps, reconnects, lease ages, command latency, and all outcomes.

**Dependencies:** Task 8.3.

**Deliverable:** Real evidence that messages flow smoothly in both directions during concurrency and recover predictably during failures.

**Automated verification:** Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/real-world-start.ps1 -RunId $env:RELAY_RW_RUN -Phase faults`; at U4 pause and ask the user to close/reopen the named window; then run `pnpm tsx tests/real-world/scenario-runner.ts --manifest artifacts/real-world/$env:RELAY_RW_RUN/manifest.json --scenarios disconnect-recovery,agent-drop,broker-restart,soak --soak-minutes 30`; verify with `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/real-world-verify.ps1 -RunId $env:RELAY_RW_RUN -Phase faults-and-soak`.

Pass criteria:

- Closed target derives `offline` within the heartbeat window, receives no socket delivery while offline, reauthenticates, and recovers to `available` after health confirmation.
- Eligible queued/idempotent work resumes; acknowledged ambiguous non-idempotent work is never replayed and becomes `UNKNOWN_OUTCOME` when required.
- Dropping a Codex task does not erase accepted commands; results remain queryable under the same principal and forbidden to others.
- Broker restart preserves the journal, expires/fences stale leases, and requires fresh extension authentication.
- Across the soak: no target-marker mismatch, no unexplained trace gap, no sustained queue/memory growth, and at least 99% completion within declared deadlines.

Actual U4 handoff names the exact window and never asks for a broad shutdown:

```text
ACTION REQUIRED — U4 Physical disconnect
Close only the Chrome window named rw-profile-b. Leave profiles A and C open.
Reply: closed
After I confirm offline detection, reopen rw-profile-b and reply: reopened
```

### Task 8.5 — Produce the release qualification report and clean up

**Files:** `scripts/real-world-verify.ps1`, `scripts/real-world-cleanup.ps1`, `tests/real-world/report.ts`, `tests/real-world/report.test.ts`, `artifacts/real-world/.gitignore`

**Solution:** Aggregate manifest, build/protocol versions, scenario results, command counts, trace-integrity findings, latency percentiles, status transitions, reconnect data, leak scan, and resource metrics. Emit machine-readable JSON and a concise Markdown report with per-scenario PASS/FAIL and one overall result. Cleanup closes only test-created processes/tabs, revokes test principals/pairing codes, releases leases, and preserves sanitized evidence. It never deletes user Chrome profiles.

**Dependencies:** Task 8.4.

**Deliverable:** Auditable release evidence plus safe, idempotent cleanup.

**Automated verification:** `pnpm vitest run tests/real-world/report.test.ts; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/real-world-verify.ps1 -RunId $env:RELAY_RW_RUN -Final; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/real-world-cleanup.ps1 -RunId $env:RELAY_RW_RUN`; rerun cleanup and require the same successful result. Scan report/console/logs for seeded secrets and internal target IDs.

### Milestone Gate 8 — Real-World Release Qualification

Do not declare the relay production-ready until:

1. U1 and U2 preflight proves three separate Chrome profiles/extensions and four separate Codex tasks/principals.
2. RW-1 through RW-4 pass through the real MCP and WebSocket gateways.
3. U4 physical disconnect, agent drop, and broker restart produce only documented transitions/outcomes.
4. The 30-minute soak meets latency, completion, isolation, queue, lease, and memory criteria.
5. The final verifier returns `PASS`, the leak scan is empty, and cleanup succeeds twice.

**Rollback point:** A failed real-world run does not mutate release artifacts or user profiles. Keep the candidate build quarantined, preserve the sanitized report, return to the earliest failing milestone, and rerun automated suites before requesting another user-assisted setup.

---

## Adversarial “Break It” Checklist

These cases must exist as automated tests before release:

1. Two agents acquire the same exclusive target in the same millisecond.
2. Target disconnects after policy says deliver but before command commit.
3. Target becomes leased after snapshot read but before commit.
4. Old extension socket authenticates again after a new epoch is active.
5. Pairing code and reconnect challenge are replayed.
6. Agent guesses another principal's session or command handle.
7. MCP payload includes unknown fields, huge values, prototype-like keys, or an expired deadline.
8. Extension sends results for another target/command or an illegal state transition.
9. Broker crashes before commit, after commit, after send, after ACK, and after result receipt.
10. Non-idempotent action ACKs, connection drops, and no result arrives.
11. SQLite reports busy/full/corrupt conditions without losing prior committed events.
12. Heartbeats arrive late, duplicated, out of order, and after socket fencing.
13. One principal fills the queue while another submits normal work.
14. Secrets/page content appear in nested error objects and are still redacted.
15. Two real Chrome user-data directories prove strict profile isolation.
16. Four independent Codex tasks use distinct principals against the same broker without result or session leakage.
17. Three physical Chrome profile windows exchange concurrent ACK/result/heartbeat traffic without wrong-target delivery.
18. A user-assisted close/reopen of one named window affects only that target and does not stall unrelated targets.
19. The real-world verifier rejects a visually successful run when any trace stage, target marker, or terminal result is missing.

## Final Acceptance Scenario

The final acceptance test uses four independent Codex tasks, four distinct agent principals, and three separate Chrome profile windows with three paired extensions. It aliases the targets without returning raw identifiers. Parallel 1:1 and one-to-many traffic proves target-marker isolation; many-to-one traffic proves factual `busy` state and per-request queue/reject opinions; N:N traffic proves correlation, fairness, and bidirectional throughput. During active work, the user closes/reopens one named Chrome window while Codex drops an agent connection and restarts the broker at controlled phases. After reconnection, the broker recovers safe work, reports ambiguous non-idempotent work as `UNKNOWN_OUTCOME`, preserves audit history, and never executes a command in the wrong profile. A 30-minute soak and trace verifier—not visual inspection—produce the final release result.
