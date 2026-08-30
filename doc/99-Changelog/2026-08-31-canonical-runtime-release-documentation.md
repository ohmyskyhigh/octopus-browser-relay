# Canonical runtime release documentation

Date: 2026-08-31

Status: applied.

## Source authority

### Approved Product through Component contracts defined the release documentation boundary

The user approved the Product, User Experience, User Interface, System, and Component proposals as canonical truth and authorized implementation. This change does not modify those authorities. It updates the lower File map and public operational documentation after the corresponding source, scripts, schema, and tests entered the repository.

### Executable files supplied every current installation and runtime claim

The applied documentation was checked against:

- root `package.json` scripts and version;
- `apps/broker/src` composition and configuration;
- `packages/mcp-gateway/src` HTTP tool publication, authentication, caller evidence, and acknowledgement delivery;
- `packages/mcp-stdio-adapter` Codex/Hermes stdio forwarding and process-local session evidence;
- `packages/broker-core/src/octopus` logical workspace, ticket, CDP, recovery, and control implementation;
- `packages/extension-gateway/src` relay-v2 behavior;
- `apps/extension` Manifest V3, Native Messaging, inventory, tab group, and debugger adapters;
- `packages/protocol` MCP, relay-v2, capability, and domain contracts;
- `packages/storage` migration `004` and canonical repositories;
- `scripts/install-local.ps1`, `scripts/create-pairing-code.ts`, and setup preflight; and
- the current contract, unit, integration, fault, E2E, and real-world paths under `tests`.

## Applied changes

### The public README now describes the implemented fourteen-tool runtime

`README.md` now leads with agent browser automation, the canonical local architecture, Windows Native Messaging installation, `pnpm dev`, profile-local extension loading and pairing, generated Codex and Hermes stdio handoff, the fourteen MCP tools, extension-supported CDP, local endpoints, verification, and current limits.

It no longer presents the earlier binding/lease/custom-operation MCP surface as the current public interface.

### A stdio adapter now gives each Codex or Hermes process non-model session evidence

The File map and public setup explain the delivered `packages/mcp-stdio-adapter` path. It prefers runtime-owned session environment values and otherwise generates one key for that adapter process, allowing separate processes to share one bearer token without collapsing into one broker session.

The documentation also preserves the verified delivery boundary: the HTTP broker can hand a ticket to the adapter before the adapter writes it to the agent, and MCP cannot make those two transport handoffs atomic.

### A File-level runbook now separates physical qualification from simulated evidence

`doc/06-Files/Real-World-Runbook.md` now defines reproducible checkpoints for installer readiness, Native Messaging, separately paired Chrome or AdsPower profiles, a local A/B/C fixture, Codex and Hermes registration, ticket-before-dispatch evidence, profile routing, concurrency, reconnect, stop/resume, endpoint kill/resume, termination, evidence capture, and non-destructive cleanup.

Direct WebSocket is explicitly classified as diagnostic transport and cannot satisfy the Native Messaging checkpoint.

### The repository map now points to delivered canonical source and verification paths

`doc/06-Files/Repository-Map.md` now maps the canonical Broker Runtime, MCP Gateway, Broker Core, Durable Store, Extension Gateway, Browser Extension, Native Messaging companion, Protocol Contract, setup scripts, and verification files.

It distinguishes the canonical MCP/relay-v2 runtime from retained relay-v1 migration modules and distinguishes editable source from generated local artifacts.

### Contribution guidance now follows the current request-ticket and managed-tab architecture

`CONTRIBUTING.md` now routes contract changes through the vault, names the current local gates and physical runbook, and replaces earlier binding and `UNKNOWN_OUTCOME` wording with broker-issued workspace/tab/ticket/cursor, ticket acknowledgement, same-tab full-cycle order, explicit CDP resolution, and Native Messaging rules.

## Remaining evidence

### Cross-runtime physical qualification remains a separately recorded release gate

This documentation change does not itself prove that a Codex session, Hermes session, Chrome profile, and AdsPower profile have completed every physical checkpoint. The runbook defines that evidence and requires an observed pass or explicit block for each applicable row.

Parent: [`Vault changelog`](./_MOC.md).
