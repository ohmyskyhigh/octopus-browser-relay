# User Interface authority layer added

Date: 2026-08-30.

The user explicitly directed the vault to add a User Interface layer between User Experience and System so the agent-facing MCP contract has a canonical owner.

## Applied changes

- Added `03-User-Interface/` as the authority owner for exact MCP tool names and agent-visible wire schemas.
- Renumbered System, Components, and Files to `04-System/`, `05-Components/`, and `06-Files/`.
- Made User Interface the active formulation gate and blocked System until the User Interface contract is explicitly approved.
- Reassigned the existing User Experience statement about MCP tool names and wire schemas from System to User Interface while leaving internal endpoint selection and transfer implementation under System.
- Classified the preserved MCP contract as candidate User Interface evidence without promoting its behavior into canonical truth.

Parent: [`99-Changelog`](./_MOC.md).
