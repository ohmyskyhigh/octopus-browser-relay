# V1 raw CDP direction applied

Date: 2026-08-30.

The user explicitly approved workspace-routed raw CDP as the v1 browser-automation direction.

## Applied changes

- Reframed the Product problem around physical debug transport, private routing, workspace ownership, status, and multi-agent coordination rather than raw CDP itself.
- Made raw CDP methods, results, protocol errors, and events the ordinary v1 Product interface.
- Kept physical debugging ports and broker-private routing outside the agent-facing contract.
- Defined tab-scoped work as the ordinary shared mode and browser-scoped CDP as requiring exclusive endpoint control.
- Replaced the typed observe-and-operate User Experience with a target, command, inspect, and decide loop.
- Removed public typed operation identity and operation lookup from the proposed v1 MCP surface.
- Replaced the previous typed-operation User Interface proposal with a six-tool raw-CDP proposal.
- Returned the active formulation gate to User Experience for the user-visible decisions exposed by the raw-CDP change.
- Left System blocked and marked its existing typed-operation proposal for full revision after User Interface approval.

## Canonical owners

- [`../01-Product/Product-Definition.md`](../01-Product/Product-Definition.md)
- [`../02-User-Experience/User-Experience-Definition.md`](../02-User-Experience/User-Experience-Definition.md)

The exact wire contract remains proposed under [`../90-Proposals/User-Interface-MCP-Contract.md`](../90-Proposals/User-Interface-MCP-Contract.md).

Parent: [`99-Changelog`](./_MOC.md).
