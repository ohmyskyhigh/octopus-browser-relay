# Contracts

> Vault status: preserved implementation documentation under the initial vault-population proposal. The MCP document is not canonical User Interface truth, and the relay document is not canonical System truth, until their higher authority gates are confirmed and promotion is approved.

Contracts are ordered from the agent boundary toward the browser boundary:

1. [MCP contract v2](./mcp-v2.md) defines authentication, opaque bindings, sessions, tools, and public responses.
2. [Relay protocol v1](./relay-v1.md) defines broker-to-extension authentication, command delivery, acknowledgements, results, and reconnect behavior.

Changes at either boundary require matching contract tests under `tests/contract/`.
