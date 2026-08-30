# Implementation tasks

Tasks are ordered by dependency and vertical value. Each task lists exact target paths, implementation work, automated checks, and its completion gate.

## Working rules

### Every task preserves user changes and the canonical authority chain

- Inspect current diffs before editing overlapping files.
- Never rewrite migrations `001` through `003`.
- Never expose caller-generated Octopus references or raw Chrome routing IDs.
- Add a failing test before or with each behavior change.
- Use temporary databases and isolated browser fixtures.
- Record any intentional canonical behavior change through a proposal and changelog first.
- Do not mark a group complete on typecheck alone.

## Group 1 — Contract baseline

### Task 1.1 materializes all fourteen MCP schema roots in runtime code

Paths:

- create `packages/protocol/src/mcp/tool-catalog.ts`;
- create `packages/protocol/src/mcp/validators.ts`;
- create `packages/protocol/src/domain/references.ts`;
- create `packages/protocol/src/domain/facts.ts`;
- update `packages/protocol/src/index.ts`;
- update `packages/protocol/src/schemas.ts`; and
- create `tests/contract/mcp-contract-v1.test.ts`.

Work:

- load or generate validators from `doc/03-User-Interface/MCP-Contract.schema.json`;
- expose exactly fourteen tool names and twenty-eight roots;
- brand broker-issued reference types without validating encoded routing data;
- remove `runId`, `idempotencyKey`, `principalId`, raw `tabId`, and old operation bodies from new public inputs; and
- assert closed schemas, request/result discriminator equality, and `PAYLOAD_TOO_LARGE`.

Gate:

```powershell
pnpm exec vitest run tests/contract/mcp-contract-v1.test.ts
pnpm typecheck
```

### Task 1.2 defines relay protocol version two and capability manifests

Paths:

- create `packages/protocol/src/relay/v2-messages.ts`;
- create `packages/protocol/src/capabilities/manifest.ts`;
- create `packages/protocol/capabilities/extension-baseline.json`;
- update `packages/protocol/src/relay-messages.ts`;
- update `packages/protocol/src/error-codes.ts`; and
- create `tests/contract/relay-v2.test.ts`.

Work:

- define inventory, tab-group, debugger, CDP, event, detach, and reconciliation messages;
- include expected private generations on every mutation and result;
- keep public and private identifiers in disjoint schema types;
- validate bounded envelopes and protocol negotiation; and
- make unknown versions select the conservative capability profile or reject explicitly.

Gate:

```powershell
pnpm exec vitest run tests/contract/relay-v2.test.ts
```

### Milestone 1 proves the target contract before state migration begins

All canonical tool schemas compile, public/private identifier adversarial tests fail correctly, and relay version two round-trips representative messages.

## Group 2 — Durable canonical truth

### Task 2.1 adds migration 004 without rewriting applied history

Paths:

- create `packages/storage/src/sqlite/migrations/004-workspaces-requests.sql`;
- update `packages/storage/src/sqlite/database.ts`; and
- create `tests/integration/sqlite-workspace-store.test.ts`.

Work:

- create canonical endpoint, connection, caller, lineage, window, workspace, tab, request, attempt, lane, control, event, capability, and audit records;
- add unique and foreign-key constraints for public references and membership;
- add indexes for owner-visible requests, lane heads, recovery scans, and event cursors;
- enable and verify WAL and foreign keys; and
- migrate an existing `003` database without deleting old rows.

Gate:

```powershell
pnpm exec vitest run tests/integration/sqlite-workspace-store.test.ts tests/integration/sqlite-store.test.ts
```

### Task 2.2 replaces broad repositories with typed transactions and recovery queries

Paths:

- update `packages/storage/src/repositories.ts`;
- create `packages/storage/src/sqlite/logical-repository.ts`;
- create `packages/storage/src/sqlite/request-repository.ts`;
- create `packages/storage/src/sqlite/event-repository.ts`;
- create `packages/storage/src/sqlite/audit-repository.ts`;
- update `packages/storage/src/sqlite/database.ts`; and
- update `packages/storage/src/index.ts`.

Work:

- implement acceptance, delivery, claim, checkpoint, terminal, takeover, resolution, termination, closure, and cursor transactions;
- implement current-owner and requester-scoped visibility;
- implement restart scans and query-bound pagination; and
- prove stale owner, generation, and claim compare-and-write failures.

Gate:

```powershell
pnpm exec vitest run tests/integration/sqlite-workspace-store.test.ts tests/fault/recovery.test.ts
```

### Milestone 2 reconstructs logical truth from a restarted SQLite process

A temporary database can be closed and reopened with open tickets, tab lanes, pause causes, owner epochs, event cursors, and public terminal visibility intact.

## Group 3 — Broker identity and browser graph

### Task 3.1 implements broker-issued references and caller authority

Paths:

- create `packages/broker-core/src/identity/reference-factory.ts`;
- create `packages/broker-core/src/identity/caller-context.ts`;
- create `packages/broker-core/src/identity/authority-policy.ts`; and
- create `tests/unit/authority-policy.test.ts`.

Work:

- issue opaque references for every public logical entity;
- resolve Codex/Hermes evidence to session and lineage records;
- model owner, authorized lineage, requester-scoped, ended-workspace, and endpoint-control authority; and
- reject forged, stale, cross-workspace, or raw Chrome identifiers.

### Task 3.2 implements endpoint, window, workspace, and tab registries

Paths:

- create `packages/broker-core/src/registry/endpoint-registry.ts`;
- create `packages/broker-core/src/registry/browser-graph.ts`;
- create `packages/broker-core/src/registry/workspace-registry.ts`;
- replace `packages/broker-core/src/target-state-index.ts`;
- create `tests/unit/browser-graph.test.ts`; and
- create `tests/unit/workspace-allocation.test.ts`.

Work:

- reconcile endpoint inventory and private generations;
- register logical windows and focus observations;
- allocate exact distinct endpoints with deterministic ranking;
- create, replace, and relate workspaces;
- manage tab membership and opener adoption; and
- issue an initial event cursor with every tab publication.

Gate:

```powershell
pnpm exec vitest run tests/unit/authority-policy.test.ts tests/unit/browser-graph.test.ts tests/unit/workspace-allocation.test.ts
```

### Milestone 3 answers targeted context queries without exposing private IDs

Broker query fixtures return paginated endpoints, windows, capabilities, workspaces, tabs, and owner-visible request summaries containing only public references and raw CDP data explicitly allowed by the contract.

## Group 4 — Tickets, lanes, and workers

### Task 4.1 implements the canonical request state machine and acknowledgement gate

Paths:

- create `packages/broker-core/src/requests/request-state-machine.ts`;
- create `packages/broker-core/src/requests/request-service.ts`;
- create `packages/broker-core/src/requests/acknowledgement-gate.ts`;
- replace `packages/broker-core/src/command-state-machine.ts`;
- create `tests/unit/request-state-machine.test.ts`; and
- create `tests/integration/acknowledgement-gate.test.ts`.

Work:

- persist exact normalized bodies and five lifecycle states;
- keep pause, phase, checkpoint, and stall orthogonal;
- create no public ticket for synchronous rejection;
- prevent dispatch before confirmed accepted-response handoff; and
- prove failed handoff has no browser effect or durable lane barrier.

### Task 4.2 implements full-cycle per-tab FIFO and bounded cross-lane workers

Paths:

- create `packages/broker-core/src/scheduler/tab-lane-scheduler.ts`;
- create `packages/broker-core/src/scheduler/worker-coordinator.ts`;
- create `packages/broker-core/src/scheduler/control-coordinator.ts`;
- create `apps/broker/src/worker-runtime.ts`;
- create `tests/fault/tab-lane-serialization.test.ts`; and
- create `tests/fault/worker-fencing.test.ts`.

Work:

- allocate durable lane positions at acceptance;
- preserve acknowledgement-pending barriers;
- retain the head through pause, reconciliation, and terminal commit;
- rotate eligible cross-tab lanes within configured limits;
- reclaim expired worker claims through reconciliation; and
- reject new admission at advertised queue bounds.

Gate:

```powershell
pnpm exec vitest run tests/unit/request-state-machine.test.ts tests/integration/acknowledgement-gate.test.ts tests/fault/tab-lane-serialization.test.ts tests/fault/worker-fencing.test.ts
```

### Milestone 4 proves tickets exist before effects and same-tab work never overtakes

Fault injection around every acceptance, response, claim, dispatch, pause, reconciliation, and terminal boundary produces one durable outcome without overlapping same-tab extension execution.

## Group 5 — Extension inventory and transport

### Task 5.1 upgrades profile identity and pairing to endpoint continuity

Paths:

- update `apps/extension/src/identity/device-identity.ts`;
- update `apps/extension/src/options.ts`;
- update `apps/extension/options.html`;
- update `packages/extension-gateway/src/connection-registry.ts`;
- create `packages/extension-gateway/src/relay-session.ts`;
- create `tests/integration/endpoint-pairing.test.ts`; and
- update `tests/contract/extension-manifest.test.ts`.

Work:

- preserve identity across ordinary restarts;
- create new identity on reset or re-pair;
- negotiate unique final nickname with deterministic collision suffixes;
- fence replaced connection generations; and
- expose pairing and readiness without leaking endpoint secrets.

### Task 5.2 upgrades Native Messaging and compatibility transport to relay version two

Paths:

- update `apps/native-host/src/relay-native-host.cpp`;
- update `apps/extension/src/transport/relay-transport.ts`;
- update `apps/extension/src/transport/websocket-client.ts`;
- create `apps/extension/src/protocol/dispatcher.ts`;
- create `packages/extension-gateway/src/transport-server.ts`;
- update `packages/extension-gateway/src/websocket-server.ts`; and
- create `tests/integration/relay-v2-gateway.test.ts`.

Work:

- use one authenticated relay session above Native Messaging and the native companion's broker transport;
- enforce Native Messaging and broker frame limits;
- negotiate protocol/capability versions;
- keep direct extension WebSocket available only to automated tests or explicit developer diagnostics;
- deliver inventory, operations, CDP, events, detach, and reconciliation messages; and
- prove duplicate, delayed, stale-generation, and oversized frames cannot mutate truth.

### Task 5.3 implements browser inventory and tab-group operations

Paths:

- create `apps/extension/src/browser/inventory.ts`;
- create `apps/extension/src/browser/tab-groups.ts`;
- update `apps/extension/src/service-worker.ts`;
- replace `apps/extension/src/executor/browser-executor.ts`; and
- create `tests/contract/extension-browser-adapter.test.ts`.

Work:

- report windows, focus, groups, tabs, opener links, URLs, and titles privately;
- create, group, move, and archive-rename tabs using private locators;
- reject stale locators; and
- remove raw Chrome IDs from any agent-visible result.

Gate:

```powershell
pnpm exec vitest run tests/integration/endpoint-pairing.test.ts tests/integration/relay-v2-gateway.test.ts tests/contract/extension-browser-adapter.test.ts
pnpm build:extension
```

### Milestone 5 pairs multiple profiles and reconciles their live browser graphs

One normal Chrome profile and at least two AdsPower profiles can connect through the same relay protocol with distinct endpoint identities and broker-visible logical windows.

## Group 6 — Extension-backed CDP

### Task 6.1 implements debugger attachment, raw commands, events, and detach facts

Paths:

- create `apps/extension/src/debugger/attachment-manager.ts`;
- create `apps/extension/src/debugger/cdp-executor.ts`;
- create `apps/extension/src/debugger/event-forwarder.ts`;
- update `apps/extension/manifest.json`;
- create `tests/contract/cdp-adapter.test.ts`; and
- create `tests/integration/cdp-relay.test.ts`.

Work:

- attach only to broker-resolved managed tabs;
- validate attachment and child-session generations;
- send raw methods and return raw results or debugger errors;
- forward ordered events and detach reasons;
- keep bounded private attempt outcomes for reconciliation; and
- reject unsupported or oversized work explicitly.

### Task 6.2 implements capability admission and event journals

Paths:

- create `packages/broker-core/src/capabilities/capability-policy.ts`;
- create `packages/broker-core/src/events/event-journal.ts`;
- create `packages/broker-core/src/reconciliation/reconciliation-service.ts`;
- create `tests/unit/capability-policy.test.ts`;
- create `tests/integration/event-journal.test.ts`; and
- create `tests/fault/cdp-reconciliation.test.ts`.

Work:

- select conservative versioned profiles;
- validate shape, support, and managed-tab confinement before ticket creation;
- sequence and retain per-tab events with opaque cursors;
- return fresh baselines after outage or expiry; and
- classify missing command outcomes without automatic ambiguous replay.

Gate:

```powershell
pnpm exec vitest run tests/contract/cdp-adapter.test.ts tests/integration/cdp-relay.test.ts tests/unit/capability-policy.test.ts tests/integration/event-journal.test.ts tests/fault/cdp-reconciliation.test.ts
```

### Milestone 6 completes one real raw-CDP round trip and event read

Against a physical paired profile, `Runtime.evaluate` returns raw JSON through a ticket, `Page` or `Runtime` events are readable from the initial cursor, and no raw Chrome routing ID reaches MCP output.

## Group 7 — MCP vertical slice

### Task 7.1 implements tool publication, caller adapters, and exact structured outputs

Paths:

- create `packages/mcp-gateway/src/tool-catalog.ts`;
- create `packages/mcp-gateway/src/delivery-gate.ts`;
- create `packages/mcp-gateway/src/runtime/codex-adapter.ts`;
- create `packages/mcp-gateway/src/runtime/hermes-adapter.ts`;
- create `packages/mcp-gateway/src/result-renderer.ts`;
- update `packages/mcp-gateway/src/server.ts`;
- update `packages/mcp-gateway/src/auth.ts`; and
- rewrite `tests/integration/mcp-gateway.test.ts`.

Work:

- register exactly fourteen tools from the protocol catalog;
- implement targeted context, workspace, tab, CDP, request, and event vertical-slice calls;
- inject runtime caller evidence outside tool arguments;
- return structured content plus concise text fallback; and
- report accepted-response delivery outcome to Broker Core.

### Task 7.2 composes readiness and the vertical slice in Broker Runtime

Paths:

- create `apps/broker/src/readiness.ts`;
- update `apps/broker/src/bootstrap.ts`;
- update `apps/broker/src/config.ts`;
- update `apps/broker/src/main.ts`;
- update `scripts/smoke-test.ts`; and
- rewrite `tests/e2e/multi-agent-multi-extension.test.ts` for the vertical slice.

Gate:

```powershell
pnpm exec vitest run tests/integration/mcp-gateway.test.ts tests/e2e/multi-agent-multi-extension.test.ts
pnpm smoke
```

### Milestone 7 makes the new MCP path usable before advanced controls

Codex or an MCP test client completes context → workspace → tab → CDP → ticket poll → event read through the real application composition.

## Group 8 — Recovery and controls

### Task 8.1 implements human resolution and bounded replacement

Paths:

- create `packages/broker-core/src/reconciliation/human-resolution-service.ts`;
- create `packages/broker-core/src/requests/tab-creation-service.ts`;
- create `tests/fault/human-resolution.test.ts`; and
- create `tests/fault/tab-replacement.test.ts`.

Work:

- implement `confirmed_succeeded` and `restart_failed`;
- implement initial plus two reconcile-before-retry replacement attempts;
- preserve old tab and never retarget queued followers;
- atomically commit success or total exhaustion relationships; and
- release the lane exactly once.

### Task 8.2 implements workspace and endpoint pause controls

Paths:

- create `packages/broker-core/src/controls/workspace-control-service.ts`;
- create `packages/broker-core/src/controls/endpoint-control-service.ts`;
- create `tests/integration/pause-controls.test.ts`; and
- create `tests/fault/endpoint-ownership-freeze.test.ts`.

Work:

- stack manual stop and endpoint kill independently;
- reconcile before clearing only the matching cause;
- enforce complete endpoint ownership before ticket creation;
- freeze ownership during nonterminal endpoint control;
- reject takeover synchronously during that freeze; and
- preserve requester-scoped endpoint ticket authority through closure.

### Task 8.3 implements takeover and orderly termination

Paths:

- create `packages/broker-core/src/controls/takeover-service.ts`;
- create `packages/broker-core/src/controls/termination-service.ts`;
- create `tests/fault/takeover-races.test.ts`; and
- create `tests/fault/termination.test.ts`.

Work:

- use first-valid workspace-state compare-and-write;
- transfer every owner-governed public operation ticket on winning takeover;
- keep requester-scoped tickets separate;
- fail accepted-not-started work after termination fence;
- wait for dispatched reconciliation and confirmed archive rename; and
- leave failed termination active and paused.

Gate:

```powershell
pnpm exec vitest run tests/fault/human-resolution.test.ts tests/fault/tab-replacement.test.ts tests/integration/pause-controls.test.ts tests/fault/endpoint-ownership-freeze.test.ts tests/fault/takeover-races.test.ts tests/fault/termination.test.ts
```

### Milestone 8 proves every control preserves inspectable state and authority

All control races, pause combinations, resolution outcomes, takeover transfer, and termination boundaries pass deterministic fault tests.

## Group 9 — Restart, status, logs, and limits

### Task 9.1 implements broker restart and debugger-detach recovery

Paths:

- create `packages/broker-core/src/reconciliation/startup-recovery.ts`;
- create `packages/broker-core/src/reconciliation/debugger-recovery.ts`;
- update `apps/broker/src/readiness.ts`;
- create `tests/fault/broker-restart-v1.test.ts`; and
- create `tests/fault/debugger-detach.test.ts`.

### Task 9.2 implements status projections, retention, and structured audit

Paths:

- create `packages/broker-core/src/status/status-projector.ts`;
- create `packages/broker-core/src/status/available-actions.ts`;
- create `packages/broker-core/src/events/retention-policy.ts`;
- create `packages/broker-core/src/audit/audit-service.ts`;
- update `apps/broker/src/config.ts`;
- create `tests/unit/status-projector-v1.test.ts`; and
- create `tests/integration/retention-and-audit.test.ts`.

Work:

- expose provenance and `current|stale|unknown` freshness;
- keep condition separate from available actions;
- publish queue, payload, page, event, and retention limits;
- enforce `PAYLOAD_TOO_LARGE` without truncation;
- rotate operational logs and retain durable audit separately; and
- prove terminal public closure retains audit evidence.

Gate:

```powershell
pnpm exec vitest run tests/fault/broker-restart-v1.test.ts tests/fault/debugger-detach.test.ts tests/unit/status-projector-v1.test.ts tests/integration/retention-and-audit.test.ts
```

### Milestone 9 survives broker, extension, and debugger failure without duplicate effects

Restart and detach tests prove durable tickets, fresh event baselines, fenced generations, explicit ambiguity, status freshness, and no hidden replay.

## Group 10 — Installation and runtime registration

### Task 10.1 makes local installation idempotent and runtime-specific

Paths:

- update `scripts/install-local.ps1`;
- update `scripts/build-native-host.ps1`;
- update `scripts/copy-assets.ts`;
- create `config/codex-mcp.template.json`;
- create `config/hermes-mcp.template.json`;
- create `config/native-messaging-host.template.json`;
- update `README.md`; and
- update `CONTRIBUTING.md`.

Work:

- detect Node, pnpm, Windows C++ build tools, Chrome, and AdsPower prerequisites;
- build and register broker, native host, and MCP adapters;
- print the unpacked extension path and per-profile pairing steps;
- preserve existing pairing and database by default; and
- verify the same health and tool catalog from Codex and Hermes configurations.

### Task 10.2 removes the obsolete public target API after migration evidence passes

Paths:

- remove obsolete exports from `packages/protocol/src/schemas.ts` and `domain-types.ts`;
- remove obsolete code from `packages/broker-core/src/broker-core.ts`, `routing-policy.ts`, `lease-manager.ts`, and `target-state-index.ts`;
- remove obsolete handlers from `packages/mcp-gateway/src/server.ts`;
- retire obsolete SQL access without deleting migrations `001` through `003`; and
- update old tests to history or canonical equivalents.

Gate:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

### Milestone 10 installs one coherent product without dual public APIs

A clean install and an in-place upgrade both expose only the canonical tool surface while preserving valid profile pairings where their credential model is compatible.

## Group 11 — Real-world qualification

### Task 11.1 upgrades the runner and evidence manifest

Paths:

- update `tests/real-world/run-manifest.schema.ts`;
- update `tests/real-world/preflight.ts`;
- update `tests/real-world/prepare.ts`;
- update `tests/real-world/scenario-runner.ts`;
- update `tests/real-world/agent-role.ts`;
- update `tests/real-world/trace-verifier.ts`;
- update `tests/real-world/soak-runner.ts`;
- update `scripts/real-world-preflight.ps1`;
- update `scripts/real-world-start.ps1`;
- update `scripts/real-world-verify.ps1`; and
- create `tests/real-world/qualification-report.ts`.

Work:

- record broker, extension, browser, AdsPower kernel, Codex, Hermes, protocol, and schema versions;
- capture only broker-issued refs and redacted private correlation evidence;
- prompt the user with one exact physical action when required; and
- produce machine-verifiable pass/fail plus a readable report.

### Task 11.2 runs the normal multi-agent and multi-profile matrix

Scenarios:

- Codex controls Chrome profile A while Hermes controls AdsPower profile B;
- two independent Codex sessions use distinct groups on one endpoint;
- one session acquires three distinct endpoints;
- related subagents continue one workspace;
- same-tab commands serialize while different tabs make progress;
- raw commands and events flow bidirectionally for at least twenty minutes; and
- all agents rediscover their work from context after reconnect.

### Task 11.3 runs physical and injected fault scenarios

Scenarios:

- close and reopen one AdsPower profile;
- restart extension service worker;
- stop and restart broker between queued, dispatched, and terminal phases;
- open and close DevTools on an attached tab;
- lose transport after extension acceptance and after browser result;
- execute manual stop, endpoint kill, resume, takeover, and orderly termination;
- force replacement success and total exhaustion;
- expire event cursors and exceed payload, page, queue, and frame bounds; and
- run a multi-hour soak with periodic reconnects.

### Task 11.4 converts unexpected real behavior into the correct kind of change

When a scenario fails:

1. classify implementation defect, environmental prerequisite, adapter incompatibility, numeric tuning need, or canonical design conflict;
2. fix and retest implementation defects directly;
3. improve setup diagnostics for prerequisites;
4. isolate runtime quirks in Codex, Hermes, Chrome, or AdsPower adapters;
5. propose evidence-backed numeric tuning at System or Component level; and
6. stop and request approval only if evidence requires a public semantic change.

Gate:

```powershell
pnpm test:real-world
pnpm exec tsx tests/real-world/verify-run.ts
```

### Milestone 11 produces the release qualification report

The report includes environment inventory, scenario matrix, ticket and event traces, invariant checks, tuning changes, failures, user-assisted steps, and cleanup result. A failed or skipped required scenario prevents release qualification.

## Adversarial checklist

### The final suite tries to break identity, authority, ordering, and recovery

- Forge or alter every public reference and cursor.
- Reuse one workspace ref from an independent session.
- Return a stale extension result after reconnect.
- Deliver a later same-tab acknowledgement before an earlier one.
- Pause the lane head before and after extension dispatch.
- Poll rapidly and confirm polling never changes order.
- Submit takeover against endpoint ownership freeze.
- Race takeover against termination and two resolvers against one target.
- Stack manual stop and endpoint kill, then clear each independently.
- Restart broker during every durable transition.
- Close a ticket across an owner-epoch change.
- Emit duplicate, missing, reordered, oversized, and stale-generation extension messages.
- Open same-window and new-window child tabs.
- Remove the group or every tab from a persisted workspace.
- Exhaust tab replacement and confirm old-tab followers fail without retargeting.
- Fail archive rename and confirm workspace remains active and paused.
- Exhaust event retention and confirm fresh-baseline recovery without replay.
- Exceed queue and payload limits and confirm explicit no-ticket or failed outcomes.

Parent: [`Implementation plan`](./README.md).
