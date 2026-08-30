# V1 extension-backed CDP direction proposal

Status: Accepted on 2026-08-30 and incorporated into the canonical Product and User Experience contracts. Its extension-backed execution decision remains current, while its earlier seven-tool direct-result catalog was superseded later that day by the canonical asynchronous request-ticket journey.

## Accepted decision

### The paired extension is the only CDP transport in v1

- The extension attaches to managed tabs through Chrome's `chrome.debugger` API.
- The extension sends CDP commands and relays CDP results and events between the browser and the local broker.
- Octopus does not launch Chrome with a remote-debugging port, discover a DevTools socket, or expose a debugging URL to an agent.

Chrome documents [`chrome.debugger`](https://developer.chrome.com/docs/extensions/reference/api/debugger) as an alternate CDP transport with tab attachment, command, event, and detach APIs.

### V1 exposes only extension-supported CDP that remains inside a managed-tab target

- Octopus does not claim support for every Chrome DevTools Protocol domain or method.
- A CDP request outside the extension-supported surface does not fall back to another browser connection.
- A method or target-bearing parameter that cannot be proven confined to the selected managed-tab tree is unavailable even when `chrome.debugger` supports the underlying domain.
- The agent-facing contract must make unsupported capability distinguishable from a disconnected or failing extension.

Chrome's same API reference explicitly limits extensions to a restricted set of CDP domains and requires the `debugger` extension permission.

### Every v1 CDP request targets a managed workspace tab

- An agent identifies the target with broker-issued `workspace_ref` and `tab_ref` values.
- The broker resolves those logical references to the paired extension and its private Chrome tab identity.
- V1 does not expose an exclusive-browser workspace mode or a browser-wide CDP target.
- An agent requests a new managed tab through `create_browser_tab` rather than creating it through a browser-wide CDP target command.

### The asynchronous ticket contract supersedes the earlier seven-tool direction

The later canonical User Experience makes five execution tools asynchronous and adds the direct `get_browser_request` polling tool. The current proposed catalog therefore has eight tools: `get_browser_context`, `request_browser_workspace`, `create_browser_tab`, `send_cdp_command`, `read_cdp_events`, `get_browser_request`, `take_over_workspace`, and `terminate_workspace`. The exact schemas remain User Interface proposals until their upstream and contract-owned blockers close.

## Superseded scope

### This decision narrows the earlier raw-CDP direction without replacing its raw command shape

[`V1-Raw-CDP-Direction.md`](./V1-Raw-CDP-Direction.md) remains the historical source for choosing raw CDP commands, raw results, and raw events. Its private debug-port and exclusive-browser statements are superseded by this extension-backed, managed-tab-only decision, and its no-public-lookup statement is superseded by broker-issued request tickets and `get_browser_request`.

## Canonical outcomes

- [`../01-Product/Product-Definition.md`](../01-Product/Product-Definition.md) owns the resulting Product truth.
- [`../02-User-Experience/User-Experience-Definition.md`](../02-User-Experience/User-Experience-Definition.md) owns the resulting agent journey.
- The later fourteen-tool design is canonical in [`../03-User-Interface/MCP-Contract.md`](../03-User-Interface/MCP-Contract.md).
- The broker and extension realization is canonical in [`../04-System/System-Architecture.md`](../04-System/System-Architecture.md).

This accepted proposal is a decision record and does not independently override its canonical outcomes.

Parent: [`90-Proposals`](./_MOC.md).
