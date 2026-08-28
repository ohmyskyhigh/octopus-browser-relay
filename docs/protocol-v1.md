# Extension Relay Protocol v1

Every WebSocket message uses a versioned JSON envelope with `protocolVersion`, `messageId`, `sentAt`, `type`, and validated `payload`.

Handshake:

1. `HELLO` with a one-use pairing code and public key, or an existing private target ID.
2. Initial pairing returns `PAIRED`; reconnect returns `CHALLENGE`.
3. Reconnect signs the nonce in `AUTH` and receives `READY`.
4. The broker binds one current socket epoch to the private target and fences older sockets.

Execution:

1. Broker persists a `QUEUED` command.
2. Broker sends `COMMAND` only through the authenticated target epoch.
3. Extension sends `ACK`, executes an allowlisted operation, then sends `RESULT`.
4. Extension heartbeats every 20 seconds with its current epoch and active command ID.
5. Broker persists every transition and exposes sanitized state through MCP.

Supported command operations are `list_tabs`, `get_active_tab`, `open_url`, `activate_tab`, `navigate`, and `snapshot`. Unknown message fields/types, unsupported protocol versions, binary frames, and oversized payloads are rejected.

`bindingRef` belongs to the northbound MCP contract and is intentionally not part of this extension protocol. The broker resolves the validated binding to a private target before choosing the authenticated extension socket; the extension receives only the command and correlation identifiers.
