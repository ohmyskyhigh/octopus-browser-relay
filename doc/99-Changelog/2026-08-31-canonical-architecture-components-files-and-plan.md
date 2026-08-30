# Canonical architecture, Components, Files, and implementation plan

## Applied change

### The approved architecture now has a complete canonical path to implementation

The remaining User Experience defaults were closed with conservative, testable behavior for debugger detach, event-cursor expiry, broker restart, endpoint continuity, status freshness, endpoint-control authority, polling guidance, oversized payloads, and wire compatibility.

The fourteen-tool MCP contract and its Draft 2020-12 schema were promoted to `03-User-Interface`. A concise canonical System architecture now replaces the proposal's obsolete blocker list and selects deterministic ranking, bounded scheduling, extension attachment, capability, restart, retention, and logging policies.

### Eight Components now own every System responsibility

The canonical Component architecture defines Broker Runtime, MCP Gateway, Broker Core, Durable Store, Extension Gateway, Browser Extension, Protocol Contract, and Setup and Qualification. It records dependencies, ports, state ownership, failure boundaries, and test responsibilities.

### The File layer distinguishes current evidence from planned changes

The canonical repository map assigns every existing application, package, script, and test path to one Component and records its migration status. It explicitly identifies the current pre-workspace API and raw Chrome ID leaks as implementation gaps rather than canonical behavior.

### One active plan names the vertical slice, exact paths, gates, and real-world tests

The active 2026-08-31 implementation plan contains a migration architecture and eleven executable task groups. It begins with contract and storage foundations, proves an early context → workspace → tab → CDP → ticket → event vertical slice, then adds recovery, controls, installation, and Codex/Hermes/Chrome/AdsPower qualification.

## Supersession

### Accepted proposals remain historical while canonical owners now govern

`Raw-CDP-UX-Completion.md`, `User-Interface-MCP-Contract.md`, and `System-Architecture.md` remain in `90-Proposals` as accepted decision history. Current authority lives in `02-User-Experience`, `03-User-Interface`, and `04-System`.

The original 2026-08-27 implementation plan remains preserved as migration evidence and no longer governs the target architecture.

Parent: [`Vault changelog`](./_MOC.md).
