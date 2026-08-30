# Extension-backed CDP direction

Date: 2026-08-30.

## Applied change

### V1 now relays the managed-tab-confined Chrome extension CDP subset without a debugging port

- Recorded the accepted extension-backed CDP decision and marked the incompatible portions of the earlier raw-CDP proposal as superseded.
- Updated canonical Product and User Experience truth so the paired extension is the only CDP transport and every command targets a managed workspace tab.
- Removed exclusive-browser control, browser-wide CDP targets, and normal-Chrome remote-debugging setup from the v1 direction.
- Updated the proposed MCP contract and System architecture to use broker-issued workspace and tab references with extension-relayed commands and events.
- Limited raw methods and target-bearing parameters to effects the broker can prove remain inside the selected managed-tab tree.
- Represented `chrome.debugger.sendCommand` rejection as `debugger_error` because the extension API does not guarantee a structured CDP error code or data body.
- Added two-phase command-dispatch evidence, Native Messaging message-size boundaries, debugger-detach recovery, and Chrome 125 child-session gating to the System proposal.
- Kept the seven-tool MCP catalog and the existing unresolved User Experience gate.

## Evidence

- User decision on 2026-08-30: accept the extension-supported CDP subset and relay CDP through the extension rather than a Chrome debugging port.
- Chrome's official extension documentation defines `chrome.debugger` as an alternate CDP transport, requires the `debugger` permission, and documents a restricted set of available CDP domains.

## Authority

This entry records the applied change. Current truth remains in [`../01-Product/Product-Definition.md`](../01-Product/Product-Definition.md), [`../02-User-Experience/User-Experience-Definition.md`](../02-User-Experience/User-Experience-Definition.md), and any later approved downstream contracts.

Parent: [`99-Changelog`](./_MOC.md).
