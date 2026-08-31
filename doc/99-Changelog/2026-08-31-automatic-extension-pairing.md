# Automatic extension pairing

Date: 2026-08-31

Status: applied.

## Applied change

### Each extension now generates the readable pairing label for its own profile

The profile-local extension randomly selects and persists a `WORD-WORD` pairing code and combines those words into a compact lowercase endpoint nickname without a numeric suffix, such as `MINT-WAVE` and `mintwave`. The options page displays that code and nickname for human correlation and no longer accepts a broker-generated pairing code.

### First connection registers automatically while reconnect remains authenticated

An unpaired relay-v2 extension presents its generated code, proposed nickname, and public profile identity to the loopback broker. The broker registers a unique endpoint automatically, then uses challenge authentication based on the persisted profile key for the resulting and later connections. A nickname collision returns a retryable error, and the extension chooses another two-word label without changing its key or requiring human input. The readable code is not an authorization secret.

### Installation and qualification no longer require copying a code

The public README, installer handoff, physical runbook, canonical Product-to-File documentation, and readiness checks now direct the human to load the extension and wait for `Status: connected`. Broker-issued short-lived codes remain available only for retained relay-v1 migration tests through `pnpm pair:legacy`.

## Verification

### Contract and real-transport tests cover automatic registration

Relay-v2 validation requires a readable extension-generated code for an unpaired hello, the extension identity test proves stable code derivation, the options-page test rejects a code input field, and WebSocket plus multi-extension end-to-end tests pair without creating broker codes.

Parent: [`Vault changelog`](./_MOC.md).
