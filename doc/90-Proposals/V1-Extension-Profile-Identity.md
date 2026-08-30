# V1 extension-profile identity proposal

Status: Accepted on 2026-08-30 and incorporated into the canonical Product and User Experience contracts.

## Accepted decision

### Every browser profile installs its own Octopus extension instance

One Octopus extension instance represents one browser profile to the local broker. Different browser profiles do not share one extension connection or one endpoint identity.

### Every extension instance pairs as one uniquely named broker endpoint

The extension generates the human-readable `endpoint_nickname` used by agents. The broker enforces nickname uniqueness within its own local endpoint registry, and pairing does not complete while another registered endpoint has the same nickname.

The broker also issues private logical references for the extension and browser. The human-readable nickname does not replace those broker-owned identities.

### One broker can pair many profile-specific extensions

Each successfully paired extension becomes one discoverable browser endpoint. Agents select or receive these endpoints during session-time workspace allocation; the decision does not permanently bind an agent to one extension or profile.

## Unresolved lifecycle

### Reconnect, reinstall, and duplicate-name recovery remain undecided

This decision establishes cardinality and broker-local uniqueness. It does not decide whether a nickname persists across reconnect or browser restart, whether reinstall or re-pair creates a new endpoint identity, how a duplicate extension obtains a different name, or when a retired nickname can be reused.

## Canonical outcomes

- [`../01-Product/Product-Definition.md`](../01-Product/Product-Definition.md) owns the resulting Product truth.
- [`../02-User-Experience/User-Experience-Definition.md`](../02-User-Experience/User-Experience-Definition.md) owns the resulting installation, pairing, and discovery journey.
- Agent-visible facts are canonical in [`../03-User-Interface/MCP-Contract.md`](../03-User-Interface/MCP-Contract.md).
- Pairing and registry realization are canonical in [`../04-System/System-Architecture.md`](../04-System/System-Architecture.md).

This accepted proposal is a decision record and does not independently override its canonical outcomes.

Parent: [`90-Proposals`](./_MOC.md).
