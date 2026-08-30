# Asynchronous request tickets integrated

Date: 2026-08-30.

The user approved asynchronous submission for the five browser-affecting MCP tools, direct reads for context, retained events, and request status, broker-issued request tickets, and synchronous no-ticket rejection before admission.

## Applied changes

- Updated the canonical User Experience so `request_browser_workspace`, `create_browser_tab`, `send_cdp_command`, `take_over_workspace`, and `terminate_workspace` return after durable acceptance with a broker-issued `request_ref`.
- Defined `accepted` as a submission disposition and `queued`, `running`, `succeeded`, `failed`, and `uncertain` as the visible request states.
- Kept `get_browser_context`, `read_cdp_events`, and `get_browser_request` as direct reads, with event reads returning retained events without long polling.
- Rebuilt the proposed User Interface as an eight-tool MCP contract with exact normalized request bodies, submission acknowledgements, full request tickets, polling, terminal payloads, and companion JSON Schemas.
- Rewrote the proposed System around durable request truth, private execution attempts, asynchronous scheduling, worker fencing, ownership-epoch revalidation, polling, logging, conditional restart-recovery rules, and no automatic replay after uncertain dispatch.
- Updated the authority MOCs and the open User Experience completion proposal to reflect the confirmed request-ticket journey and its remaining decisions.

## Remaining gates

The User Interface and System remain proposed. Request retention and expiry, lost-acknowledgement rediscovery, takeover visibility, terminal-state mapping for existing domain outcomes, polling cadence, cancellation and deadlines, large payload representation, and the previously recorded User Experience and System decisions remain unresolved.

Parent: [`99-Changelog`](./_MOC.md).
