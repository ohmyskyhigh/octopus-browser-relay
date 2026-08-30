# Raw-CDP System proposal redrafted

Date: 2026-08-30.

The non-canonical System proposal was rewritten to realize the proposed seven-tool raw-CDP User Interface without carrying forward the superseded typed-operation architecture.

## Applied changes

- Defined one local broker as the authority for identity and binding truth, routing truth, status truth, capacity allocation, target resolution, routing decisions, raw-CDP correlation, event cursors, and logs.
- Split each logical browser endpoint into an extension control channel and a broker-private full-CDP data channel.
- Kept the Chrome Native Messaging companion as the extension control path for both Chrome and AdsPower while separating it from the full-CDP channel.
- Required a supported debug-enabled provider, a distinct CDP root for browser-wide control, and a cross-checked extension-tab to CDP-target proof before issuing logical tab identity.
- Separated the broker-control CDP connection from the unrestricted agent-command CDP connection and required every provider endpoint to remain local.
- Mapped all seven proposed MCP tools to explicit broker flows.
- Added broker-issued workspace and tab mapping, connection generations, ownership epochs, exclusive-browser control, raw-event streams, concurrency fences, persistence, reconciliation, and cross-boundary invariants.
- Kept public operation and command identifiers out of v1 while retaining private diagnostic correlation.
- Recorded the current implementation as evidence and listed its gaps without treating those gaps as architecture authority.
- Kept the proposal non-canonical and recorded the unresolved parent decisions currently known to block System approval.
- Routed newly exposed normal-Chrome setup, event-retention, and takeover in-flight-work decisions back to the User Experience completion proposal.
- Reflected event-retention and takeover in-flight-work blockers in the proposed User Interface approval list without changing its seven-tool schemas.

## Proposal owner

- [`../90-Proposals/System-Architecture.md`](../90-Proposals/System-Architecture.md)

Canonical System remains blocked under [`../04-System/_MOC.md`](../04-System/_MOC.md).

Parent: [`99-Changelog`](./_MOC.md).
