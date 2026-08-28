# Octopus Browser Relay

> Implementation note (v0.2.0): the delivered system now uses an exclusive broker-owned `bindingRef` on every target-specific MCP call. Alias-based multi-cardinality sections below describe the original v0.1.0 plan and are superseded by `docs/mcp-contract-v2.md` and the current interactive architecture.

Status: Draft
Date: 2026-08-27
Owner: Browser Relay team

## Scope

Build a local broker that lets one or more MCP agents safely control one or more Chrome-profile extensions without exposing raw browser-profile identifiers. The broker owns target identity, live state, leases, routing policy, command durability, and result correlation. The MCP layer is a thin northbound adapter; each Manifest V3 extension is a southbound execution node connected through an authenticated WebSocket.

This plan covers the first production-capable local release. It does not cover a hosted multi-machine control plane, browser-fingerprint management, or AdsPower profile lifecycle APIs.

## Capabilities

- One agent to one extension, one agent to many extensions, and many agents to many extensions.
- Stable agent-facing aliases and opaque session handles instead of raw Chrome profile IDs or device IDs.
- Broker-owned factual state: `available`, `busy`, `offline`, or `error`.
- Broker-owned routing opinion: `deliver`, `queue`, `wait`, or `reject`, evaluated per request.
- Exclusive leases for state-changing browser work and configurable shared access for read-only operations.
- Durable commands, idempotency keys, deadlines, cancellation, restart recovery, and explicit unknown-outcome handling.
- Authenticated MCP clients and authenticated extension pairing/reconnection.
- Versioned contracts, structured error codes, audit events, metrics, and fault-injection tests.
- A user-assisted real-world qualification run with at least three Chrome profiles and four independent Codex tasks; Codex performs the measurements and pass/fail analysis.

## Terms

| Term | Meaning |
|---|---|
| Agent | An MCP client that asks the broker to inspect or control a browser target. |
| MCP gateway | Thin adapter that authenticates agents, validates tool input, calls broker APIs, and returns structured results. |
| Broker | The sole authority for identities, aliases, policies, status, leases, commands, and results. |
| Target | A paired extension installation associated with one Chrome profile. |
| Extension gateway | Authenticated WebSocket server that maintains live extension connections and delivers commands. |
| Target snapshot | Versioned broker fact model containing connectivity, health, occupancy, and derived status. |
| Routing decision | The broker's request-specific opinion: deliver, queue, wait, or reject. |
| Lease | Time-bounded permission for an agent/session to perform exclusive work on a target. |
| Session handle | Agent-facing opaque handle that refers to a broker-side lease and target without revealing internal IDs. |

## Plan Documents

| Document | Purpose |
|---|---|
| [Technical architecture](./technical-architecture.md) | Boundaries, data model, protocols, security, persistence, and failure semantics. |
| [Implementation tasks](./implementation-tasks.md) | Sequential, file-specific work items, executable tests, milestone gates, and rollback points. |

## Quick Summary

Use a TypeScript monorepo with a single long-running Node.js broker process. The broker exposes MCP Streamable HTTP on loopback and a separate authenticated WebSocket endpoint for Chrome extensions. SQLite in WAL mode stores stable truth and command history; an in-memory connection registry stores socket references while the broker derives versioned target snapshots from persisted identity plus live observations.

The critical separation is internal, not organizational: `TargetSnapshot` contains facts, while `RoutingPolicy.evaluate(snapshot, request)` produces the broker's opinion. Before a command is committed, the broker rechecks the snapshot version inside the command/lease transaction. A changed version forces reevaluation instead of delivering against stale state.

## Success Metrics

- 100% of agent requests resolve targets through aliases or session handles; no MCP response exposes internal target IDs, extension public keys, or Chrome profile paths.
- A command accepted by the broker is persisted before first delivery, and every command reaches a terminal state or an explicit `UNKNOWN_OUTCOME` state after recovery.
- Repeated retries with the same idempotency key never execute a non-idempotent browser action twice.
- Broker restart restores targets, policies, leases, and commands; targets remain `offline` until they reauthenticate.
- A missed heartbeat moves a target to `offline` within the configured detection window; repeated command failures move it to `error` without conflating that with occupancy.
- Competing agents cannot hold conflicting exclusive leases on the same target.
- Contract, integration, restart, concurrency, and fault-injection suites pass in one command: `pnpm verify`.
- In the real-world run, every command has one continuous trace through broker commit, extension ACK/result, and a later MCP observation; there are zero wrong-profile deliveries, missing terminal results, or duplicate non-idempotent executions.

## Real-World Qualification

The final release gate uses one broker process, at least three separate Chrome profile windows, one paired extension per profile, and at least four independent Codex tasks with distinct agent principals. The tasks exercise 1:1, 1:N, N:1 contention, and N:N traffic, followed by disconnect/reconnect and soak scenarios.

Codex owns the test procedure, commands, trace collection, and pass/fail report. The user is asked only for actions Codex cannot safely perform through automation: opening the required Chrome profiles, loading the unpacked extension, opening the Codex tasks, and closing/reopening a named browser window during a planned fault step. The user never needs to paste pairing secrets or bearer tokens into chat.

## Delivery Milestones

1. Contracts and repository foundation.
2. Durable broker truth and state derivation.
3. Routing policy, leases, and command lifecycle.
4. Authenticated extension gateway and MV3 relay.
5. MCP tools and agent authentication.
6. Recovery, observability, hardening, and packaging.
7. Human-assisted multi-browser and multi-Codex-task qualification.

## References

- [MCP TypeScript server guide](https://ts.sdk.modelcontextprotocol.io/server)
- [Chrome extension service-worker WebSockets](https://developer.chrome.com/docs/extensions/how-to/web-platform/websockets)
- [SQLite write-ahead logging](https://sqlite.org/wal.html)
