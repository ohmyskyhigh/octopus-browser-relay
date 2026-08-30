# Octopus Browser Relay stdio MCP adapter

## Purpose

### One adapter process gives one Codex or Hermes session private caller evidence

The adapter publishes the canonical fourteen Octopus tools over stdio and forwards every call to the loopback HTTP broker. It injects runtime and session headers outside tool arguments, so the agent never generates or sees caller identity fields.

### Runtime session evidence prefers host IDs and otherwise lasts for one process

Session lookup prefers `CODEX_THREAD_ID`, `CODEX_SESSION_ID`, `HERMES_SESSION_ID`, and `HERMES_AGENT_SESSION_ID`, in that order. `OCTOPUS_RUNTIME_SESSION` is an explicit fallback. If none exists, the adapter creates a random value once at startup and retains it for that process lifetime. Parent-session equivalents are forwarded when present.

## Configuration

### The adapter accepts a loopback broker URL and a token or token-file path

- `OCTOPUS_BROKER_URL` defaults to `http://127.0.0.1:7331/mcp`.
- `OCTOPUS_BROWSER_RELAY_TOKEN_FILE` points to the installer's local token file.
- `OCTOPUS_BROWSER_RELAY_TOKEN` or `OCTOPUS_AGENT_TOKEN` can supply the same token directly instead.
- `OCTOPUS_RUNTIME` can force the runtime label to `codex`, `hermes`, or another safe local name.

The token file wins when both forms exist, preventing an inherited stale token from overriding the installed broker credential. The token and session evidence are transport configuration. They are not MCP tool inputs.

## Delivery boundary

### Ticket acknowledgement remains ordered but cannot be atomic across both transports

The HTTP broker dispatches an accepted ticket only after its response is handed to the adapter. The adapter then writes that response to the agent runtime over stdio. MCP provides no transaction spanning both transports, so an adapter crash in the narrow interval between those two handoffs can leave dispatched work whose ticket was not received by the agent. Normal delivery keeps ticket-before-dispatch ordering at the broker boundary, and the adapter never invents or replaces a `request_ref`.

### One adapter process is the isolation boundary when a host exposes no session ID

If Codex or Hermes launches one stdio server process per agent session, the random fallback separates sessions that share one bearer token. A host that deliberately reuses one adapter process across multiple otherwise-unidentified sessions also reuses that caller identity; it must supply a supported session environment variable or launch separate processes.
