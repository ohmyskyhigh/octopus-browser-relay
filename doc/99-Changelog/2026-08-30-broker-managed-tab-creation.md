# Broker-managed workspace tab creation applied

Date: 2026-08-30.

The user explicitly decided that every resolved workspace must return a broker-issued tab reference and that agents create additional workspace tabs through a separate MCP surface rather than relying on raw CDP tab creation.

## Applied changes

- Required each resolved workspace to expose at least one complete tab fact containing its `workspace_ref` and broker-issued `tab_ref`.
- Added broker-managed creation of another tab inside an existing workspace to the Product and User Experience contracts.
- Added the proposed `create_browser_tab` tool to the User Interface proposal and companion JSON Schema bundle.
- Kept navigation, observation, interaction, and page interpretation on the raw-CDP surface.
- Kept empty-workspace recovery, tab-creation failure recovery, page-created popup membership, and raw browser-wide target-creation membership open for later User Experience decisions.
- Updated the vault entry point and User Experience and User Interface MOCs to reflect the seven-tool proposal.

## Canonical owners

- [`../01-Product/Product-Definition.md`](../01-Product/Product-Definition.md)
- [`../02-User-Experience/User-Experience-Definition.md`](../02-User-Experience/User-Experience-Definition.md)

The exact wire contract remains proposed under [`../90-Proposals/User-Interface-MCP-Contract.md`](../90-Proposals/User-Interface-MCP-Contract.md).

Parent: [`99-Changelog`](./_MOC.md).
