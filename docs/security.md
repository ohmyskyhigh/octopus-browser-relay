# Security Model

- Both listeners bind to loopback by default and reject non-local host headers.
- Agent bearer tokens are SHA-256 hashed at rest. Session handles and pairing codes are also stored only as hashes.
- A broker-issued opaque `bindingRef` is a routing reference, not an authentication secret. Every use is checked against the authenticated principal, and active bindings are unique on both principal and target.
- The administrator credential is generated locally when not provided and stored in the gitignored relay data directory.
- Each extension generates an ECDSA P-256 key pair. Initial pairing uses a short-lived one-use code; reconnects sign a fresh challenge.
- A newer authenticated extension connection epoch fences the prior socket.
- MCP serializers use explicit allowlists and never return target IDs, socket IDs, public keys, hashes, or profile paths.
- Aliases are administrative labels. Target-specific agent calls use `bindingRef`, and the broker alone translates it to the private target and live socket.
- Extension operations are allowlisted. URLs are limited to HTTP(S), and DOM snapshots are limited to loopback fixture pages in the MVP.
- Logs redact authorization headers, tokens, pairing codes, and public-key material.
- Non-idempotent commands are never silently replayed after an ambiguous broker restart.

LAN or internet binding is intentionally out of scope for this release. It requires TLS, explicit host/origin allowlists, stronger secret storage, and a separate threat review.
