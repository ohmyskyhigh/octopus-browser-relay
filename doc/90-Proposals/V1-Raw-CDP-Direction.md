# V1 raw CDP direction proposal

Status: Accepted on 2026-08-30 and incorporated into the canonical Product and User Experience contracts. Its private debug-port and exclusive-browser scope was superseded later that day by [`V1-Extension-Backed-CDP-Direction.md`](./V1-Extension-Backed-CDP-Direction.md), and its no-public-lookup statement was superseded by the later asynchronous request-ticket journey.

## Historical accepted decision

Octopus v1 is a workspace-routed raw CDP gateway rather than a typed browser-operation catalog or a literal debug-port URL exposed to agents.

- Agents provide raw CDP methods and parameters through MCP.
- The broker keeps physical debugging ports, sockets, and private target routing outside the agent-facing interface.
- Agents receive raw CDP results, protocol errors, and events and interpret their website-task meaning.
- Tab-scoped CDP uses logical workspaces and tabs.
- Browser-scoped CDP requires exclusive control of the endpoint.
- Browser-issued CDP handles may be returned and echoed unchanged.
- V1 has no public typed `operation_ref` contract or browser-operation lookup tool.

## Canonical outcomes

- [`../01-Product/Product-Definition.md`](../01-Product/Product-Definition.md) owns the resulting Product truth.
- [`../02-User-Experience/User-Experience-Definition.md`](../02-User-Experience/User-Experience-Definition.md) owns the resulting agent journey.
- [`User-Interface-MCP-Contract.md`](./User-Interface-MCP-Contract.md) remains an unapproved proposal for the exact eight-tool asynchronous wire contract after the later broker-managed tab-creation and request-ticket decisions.

This accepted proposal is a historical decision record and does not independently override its canonical outcomes.

Parent: [`90-Proposals`](./_MOC.md).
