# System architecture

> Vault status: preserved implementation documentation under the initial vault-population proposal. This document is not canonical System truth until the required higher-level contracts, including User Interface, are confirmed and this material is approved for promotion.

Octopus Browser Relay is read top-down as a control path:

```text
Agent / MCP client
  -> MCP gateway and authentication
    -> broker policy, bindings, leases, and command journal
      -> extension gateway and connection registry
        -> profile-local extension
          -> validated browser operation
```

The agent supplies an authenticated principal and an opaque `bindingRef`. The broker is the only source of truth: it resolves the binding, evaluates policy, owns command state, and selects the current extension connection. The extension reports browser facts and executes allowlisted operations; it never chooses routing policy.

## Code map

| Layer | Location | Responsibility |
| --- | --- | --- |
| Runtime composition | `apps/broker` | Starts storage, broker core, MCP gateway, and extension gateway |
| Agent boundary | `packages/mcp-gateway` | Authenticates agents and exposes MCP tools |
| Control plane | `packages/broker-core` | Bindings, status, leases, routing, and command lifecycle |
| Durable truth | `packages/storage` | SQLite repositories and migrations |
| Browser boundary | `packages/extension-gateway` | Authenticated extension connections and reconnect fencing |
| Shared contracts | `packages/protocol` | Domain types, schemas, messages, and error codes |
| Browser node | `apps/extension` | Profile-local transport and validated browser execution |
| Native bridge | `apps/native-host` | Chrome Native Messaging transport for restricted kernels |

Use the [interactive architecture](./interactive/index.html) for the detailed message paths. Candidate contract detail is preserved in the [MCP contract](../contracts/mcp-v2.md) and [relay protocol](../contracts/relay-v1.md).
