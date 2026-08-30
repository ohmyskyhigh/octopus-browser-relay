# Workspace recovery and browser-operation monitoring added

Date: 2026-08-30.

The user explicitly established replacement-session ownership transfer, manual workspace termination and restart, and monitoring limited to browser operations brokered by Octopus.

## Applied changes

- Added replacement-session workspace ownership transfer to the canonical Product contract.
- Defined the transfer identifiers as the broker-issued logical workspace reference, browser endpoint nickname, and previous owning session ID.
- Added explicit workspace termination followed by a new workspace request to the canonical Product contract.
- Limited execution monitoring to browser operations brokered by Octopus rather than the complete Codex or Hermes workflow.
- Refactored the non-canonical User Experience proposal into users, installation, default use case, supporting control use cases, visible results, control boundaries, success evidence, principles, and Product traceability.

Parent: [`99-Changelog`](./_MOC.md).
