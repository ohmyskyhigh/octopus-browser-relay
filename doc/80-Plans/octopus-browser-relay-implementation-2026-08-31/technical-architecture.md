# Technical architecture

This document translates the canonical Component design into a migration architecture for the current repository. It is a plan, not delivered behavior.

## Migration baseline

### The current runtime proves connectivity but uses the wrong public domain model

Current code already has a broker process, SQLite, MCP server, paired extension gateway, Native Messaging option, MV3 extension, retry alarm, browser executor, automated tests, and real-world harness.

The current public model is target alias → agent binding → lease/session handle → custom browser operation. It allows caller-supplied tracing and idempotency values and passes raw Chrome tab IDs. The target design is endpoint → logical window → workspace → managed tab → durable request ticket → extension-backed raw CDP.

### Migration keeps working transport pieces behind new ports

The migration preserves:

- broker process and signal lifecycle;
- SQLite database and immutable migrations `001` through `003`;
- extension signing identity primitives;
- Native Messaging transport interface and reusable protocol-test seams;
- pairing challenge verification where it matches the endpoint model;
- service-worker reconnect alarm;
- build, trace, fixture, and soak infrastructure; and
- useful test helpers.

It replaces public target, binding, lease, direct-dispatch, raw-tab-ID, and custom-operation semantics.

## Target source layout

### New modules extend existing top-level components rather than adding more packages

```text
apps/
  broker/src/
    bootstrap.ts
    config.ts
    readiness.ts                    planned
    worker-runtime.ts               planned
  extension/src/
    browser/inventory.ts            planned
    browser/tab-groups.ts           planned
    debugger/attachment-manager.ts  planned
    debugger/cdp-executor.ts        planned
    debugger/event-forwarder.ts     planned
    protocol/dispatcher.ts          planned
    transport/*
  native-host/src/relay-native-host.cpp

packages/
  protocol/src/
    mcp/tool-catalog.ts             planned
    mcp/validators.ts               planned
    domain/references.ts            planned
    domain/facts.ts                 planned
    relay/v2-messages.ts            planned
    capabilities/manifest.ts        planned
  protocol/capabilities/
    extension-baseline.json         planned
  storage/src/
    repositories.ts
    sqlite/database.ts
    sqlite/migrations/004-workspaces-requests.sql  planned
  broker-core/src/
    application/commands.ts         planned
    application/queries.ts          planned
    identity/*                      planned
    registry/*                      planned
    requests/*                      planned
    scheduler/*                     planned
    capabilities/*                  planned
    reconciliation/*                planned
    controls/*                      planned
    events/*                        planned
    status/*                        planned
  extension-gateway/src/
    connection-registry.ts
    relay-session.ts                planned
    transport-server.ts             planned
  mcp-gateway/src/
    server.ts
    tool-catalog.ts                 planned
    delivery-gate.ts                planned
    runtime/codex-adapter.ts        planned
    runtime/hermes-adapter.ts       planned
    result-renderer.ts              planned
```

Names are exact plan targets. A task may combine a very small planned module with its parent only when doing so preserves the Component boundary and the plan is updated before implementation.

## Data model

### Migration 004 introduces canonical records without rewriting history

The planned migration creates or evolves tables for:

- endpoint identity, nickname reservation, pairing credential hash, and connection generations;
- caller sessions, lineages, and runtime evidence;
- logical windows and browser observation generations;
- workspaces, ownership epochs, lifecycle, parent workspace, and archive facts;
- managed tabs, group membership, opener source, private locator generation, and attachment generation;
- request tickets, normalized bodies, authority kind, state, phase, checkpoint, pause, result, and public closure;
- request attempts, acknowledgement delivery, extension correlation, and reconciliation evidence;
- per-tab lane positions and current head claims;
- endpoint and workspace control epochs and current pause causes;
- event streams, sequence positions, retained events, and cursor epochs;
- capability profile selection and reported browser/extension versions; and
- append-only audit events.

Old rows remain available for migration diagnostics. New public behavior never reads an old target ID as a workspace or endpoint reference.

### Public references use opaque typed prefixes and random broker issuance

Runtime values use branded string types such as `ep_`, `win_`, `wrk_`, `tab_`, `req_`, and `cur_` followed by cryptographically random content. Prefixes aid logs and validation but do not encode routing or ownership.

Database primary keys can be internal integers or UUIDs. Public references have unique indexes and are resolved only through repository methods that also validate current authority and generation.

## Application ports

### MCP commands and queries call a stable Broker Core facade

The planned facade exposes one method per canonical tool plus delivery confirmation:

```ts
interface BrokerApplication {
  getBrowserContext(caller: CallerEvidence, input: GetBrowserContextInput): Promise<GetBrowserContextOutput>;
  submitWorkspaceRequest(caller: CallerEvidence, input: RequestBrowserWorkspaceInput): Promise<SubmissionOutput>;
  submitTabCreation(caller: CallerEvidence, input: CreateBrowserTabInput): Promise<SubmissionOutput>;
  submitCdpCommand(caller: CallerEvidence, input: SendCdpCommandInput): Promise<SubmissionOutput>;
  submitControl(caller: CallerEvidence, input: ControlInput): Promise<SubmissionOutput>;
  getRequest(caller: CallerEvidence, requestRef: RequestRef): Promise<GetBrowserRequestOutput>;
  readEvents(caller: CallerEvidence, input: ReadCdpEventsInput): Promise<ReadCdpEventsOutput>;
  closeRequest(caller: CallerEvidence, requestRef: RequestRef): Promise<CloseBrowserRequestOutput>;
  confirmAcceptedResponseDelivery(requestRef: RequestRef, outcome: DeliveryOutcome): Promise<void>;
}
```

Tool-specific schemas remain separate even if several controls share one internal coordinator.

### Extension messages carry private locators and fenced generations

Relay protocol version `2` includes pairing, connection-ready, browser-inventory snapshot, create/group/move/rename tab, attach, send CDP, command accepted, command result, raw CDP event, debugger detach, reconciliation request, reconciliation response, heartbeat, and protocol error messages.

Every mutating message carries endpoint, connection, workspace, tab-locator, attachment, and attempt generations relevant to the mutation. Extension results echo them. Broker Core rejects stale responses before touching durable truth.

## Scheduling model

### Durable acceptance order is assigned in the ticket transaction

`send_cdp_command` acceptance allocates a monotonically increasing position within the managed-tab lane in the same transaction as the ticket. Delivery-pending earlier positions remain barriers. Confirmed acknowledgement failure removes only that private position.

One worker can claim the head when every earlier position is terminal or removed and all current controls allow browser mutation. The claim contains a lease plus relevant epochs. Lease expiry permits another worker to reconcile and reclaim; it never permits two active extension invocations.

### Worker pools provide bounded cross-lane concurrency

The Broker Runtime starts a configurable global worker pool. Selection rotates eligible endpoints, then workspaces, then tab lanes to avoid starving one profile. Default bounds are sixteen global workers, four per endpoint, 1,024 accepted queued requests globally, and 256 per endpoint.

Control work uses endpoint or workspace control coordinators and epoch compare-and-write, not the ordinary tab FIFO. Human resolution can release a paused head without self-deadlock.

## Recovery model

### Reconciliation is a first-class phase shared by command, restart, and reconnect flows

Reconciliation requests current windows, groups, tabs, opener links, URLs, titles, debugger facts, and bounded recent private attempt outcomes. Broker Core compares observations against the durable checkpoint and classifies effect as present, absent, ambiguous, or impossible.

Only absent effects can be retried automatically where the canonical flow allows. Present effects commit success. Ambiguous raw effects pause for owner resolution. Impossible or exhausted recovery commits the tool-specific failure.

### Broker restart rebuilds barriers before processing new mutations

Startup loads open requests, delivery barriers, tab-lane positions, controls, ownership epochs, connection generations, and event epochs. Possibly dispatched work becomes reconciliation work. New mutating MCP admissions remain unavailable until this rebuild finishes.

Terminal tickets remain publicly visible to their applicable authority until close.

## Capability model

### A reviewed manifest defines the extension-supported CDP subset

The capability manifest keys support by extension relay version, browser product and protocol version, method, permitted parameter shape, result size risk, required permission, tab confinement proof, and child-session support.

The conservative baseline begins with methods required for navigation, DOM/runtime inspection, input, screenshots within payload limits, and network/page events that `chrome.debugger` exposes safely to a tab target. Exact methods are added from verified fixtures rather than assumed from the full CDP browser protocol.

### Confinement validation is separate from JSON parameter validation

Schema validation proves parameter shape. Capability policy proves the method is supported. Managed-tab confinement proves that every referenced session or target belongs to the current attachment tree. All three must pass before ticket issuance.

## Test topology

### Automated tests isolate contracts, transactions, transports, and policy

Pure tests run with fake clocks, deterministic reference factories, in-memory connection facts, and temporary SQLite databases. Integration tests use the real MCP SDK, WebSocket or native-protocol adapters, and extension mocks that can delay, disconnect, duplicate, or reorder private messages.

Browser-independent tests prove every invariant before physical profiles are required.

### Real-world tests use separately paired profiles and independent agent sessions

The physical topology uses Native Messaging for every installed profile:

```text
Codex session A ----\
Codex session B ----- MCP broker ---- Chrome profile A extension
Hermes session C ---/             \-- AdsPower profile B extension
                                      AdsPower profile C extension
```

The user assists only with actions automation cannot safely perform: loading unpacked extensions, opening/closing named profiles, closing DevTools, or confirming observed browser state. The runner prints one exact instruction, waits for broker evidence, and continues automatically.

Parent: [`Implementation plan`](./README.md).
