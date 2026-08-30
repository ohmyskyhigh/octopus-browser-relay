# Files MOC

Authority level: Files.

This level maps confirmed Component responsibilities to exact repository-relative source, test, migration, configuration, manifest, and documentation paths. Executable runtime evidence remains outside the documentation authority chain.

Status: the current repository map and physical runbook are canonical File-level records. Planned paths remain intentions in `80-Plans` until they exist.

## Current repository

### Every existing implementation path has one Component owner and verification role

[`Repository-Map.md`](./Repository-Map.md) maps the current Broker Runtime, MCP Gateway, Broker Core, Durable Store, Extension Gateway, Browser Extension, Protocol Contract, setup, and verification files.

It distinguishes the canonical implementation, retained relay-v1 migration bridge, generated artifacts, and automated evidence paths.

## Real-world qualification

### Physical Chrome, AdsPower, Codex, and Hermes evidence follows one reproducible runbook

[`Real-World-Runbook.md`](./Real-World-Runbook.md) maps installation, preflight, profile pairing, local fixtures, agent registration, ticketed CDP execution, concurrency, recovery, controls, evidence, and cleanup to checked-in commands and paths.

The runbook keeps Native Messaging qualification separate from direct-WebSocket diagnostics and records unresolved adapter or setup behavior as a failed or blocked checkpoint.

## Planned changes

### Undelivered paths remain in the active plan instead of appearing as runtime facts

The active plan under [`../80-Plans`](../80-Plans/_MOC.md) retains unfinished qualification and follow-up work. A path enters this File map only after it exists; a behavior becomes verified only through its stated executable evidence.

Parent: [`05-Components`](../05-Components/_MOC.md).
