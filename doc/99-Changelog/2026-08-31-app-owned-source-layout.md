# App-owned source layout

Date: 2026-08-31

Status: applied.

## Applied change

### Broker source now lives beneath the broker application that owns it

Broker Runtime, Broker Core, MCP Gateway, Durable Store, and Extension Gateway source moved beneath `apps/broker/src`. The internal module boundaries remain explicit while the physical path now identifies the owning deployable without a separate top-level package lookup.

### Independently executed programs remain visible as sibling applications

Browser Extension, Native Host, and MCP stdio adapter live under `apps/browser-extension`, `apps/native-host`, and `apps/mcp-stdio-adapter`. The shared MCP and relay contract lives under `apps/shared/protocol` because multiple applications consume it.

### Generated artifacts and operational tooling have one top-level home each

Build outputs now live under root `dist/`, including the unpacked browser extension. Build, pairing, installation, preflight, smoke, and cleanup utilities moved from `scripts/` to `tools/`. Tests remain under `tests/`.

## Verification

### Clean generation proves the new paths do not depend on stale output

The previous generated `dist/` tree was removed after the broker stopped, and the project rebuilt broker, stdio adapter, shared protocol, browser extension, copied migrations, and Native Host into the new generated hierarchy. Typecheck, lint, contract, unit, integration, and end-to-end tests exercise imports through the new source paths.

Parent: [`Vault changelog`](./_MOC.md).
