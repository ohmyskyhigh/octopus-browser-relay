# Raw CDP User Experience completion proposal

Status: closed historical proposal. The remaining decisions it recorded were incorporated into the canonical [`Operational defaults`](../02-User-Experience/Operational-Defaults.md) on 2026-08-31.

Authority requested: User Experience.

Product source: [`../01-Product/Product-Definition.md`](../01-Product/Product-Definition.md).

Current User Experience owner: [`../02-User-Experience/User-Experience-Definition.md`](../02-User-Experience/User-Experience-Definition.md).

## Debugger contention

### User-triggered debugger detach still needs one visible recovery journey

Chrome can cancel the extension's debugger attachment when the human opens DevTools for the same tab. The missing decision is whether Octopus asks the agent or human to resolve the contention, waits for an explicit retry after DevTools closes, or may reattach automatically when the conflicting debugger is gone.

## Event retention

### The duration of broker-retained event history still needs a visible expectation

Every current tab fact now supplies an initial broker-issued cursor, and a broker or extension outage invalidates the old stream and starts a fresh one after live-page reconciliation. The remaining decision is how long events in a valid current stream remain readable before their cursor expires.

The confirmed outage journey does not promise replay: it preserves `workspace_ref` and `tab_ref`, reconciles the current live page, supplies a fresh initial cursor, and neither reloads nor replays the invalidated stream. The extension is not an alternate event-replay buffer.

## Request monitoring

### Request continuity across a broker restart still needs one visible expectation

Accepted requests are durably ticketed before dispatch, extension disconnect exposes a pause condition without changing lifecycle state, and terminal tickets have no visibility timeout until their applicable requester or current owner closes them. Those decisions do not yet state what the agent sees when the broker process itself restarts while a request is queued, running, or terminal.

### Exact polling cadence and stalled-request visibility still need one expectation

The confirmed journey polls an accepted ticket through immediate direct reads. Octopus exposes no per-request cancellation and applies no broker terminal timeout, so elapsed time or a reported stall cannot terminalize the request. The remaining decisions are the exact polling cadence, which stalled facts are visible, and which currently available action the agent sees while a valid request remains queued, running, or paused longer than expected.

### Large request and result payloads still need one visible representation

Raw CDP parameters, results, errors, and retained event pages can exceed a practical MCP response size. The remaining decision is whether large values stay inline, use broker-issued paginated or blob references, or follow another agent-visible retrieval journey.

## Endpoint identity and status

### Reconnect, reinstall, and duplicate-name recovery still need endpoint-continuity behavior

Each participating browser profile has its own extension instance, and the extension-generated endpoint nickname must be unique within the local broker before pairing completes. The remaining decision covers whether that nickname and endpoint identity persist across reconnect or browser restart, whether reinstall or re-pair creates a new identity, how an extension recovers from a duplicate generated name, when a retired nickname can be reused, and how reused text relates to endpoint continuity.

### Supporting status facts and freshness still need one visible model

The endpoint labels `usable`, `busy`, `offline`, `unresponsive`, and `failing` are confirmed. The missing decision is which broker, extension-connection, browser-observation, workspace, pause, stalled-request, and extension-CDP-usability facts the agent also sees, the vocabulary for those supporting facts, and how retained observations are distinguished from current status.

## Endpoint-wide authority

### A takeover attempted during nonterminal endpoint control still needs a wait-or-reject journey

The confirmed journey admits endpoint kill or resume only when the caller owns every active workspace on that endpoint; otherwise Octopus rejects synchronously without a ticket and offers workspace task-stop. After either endpoint control is accepted, workspace ownership on that endpoint cannot change until the control ticket becomes terminal.

The remaining decision is whether a takeover attempted during that interval is rejected before ticket creation or accepted and waits for the ownership freeze to end. This question is limited to takeover behavior and does not reopen workspace lifecycle, allocation, or unrelated endpoint behavior.

### A terminal endpoint-control ticket still needs a later-owner read-and-close authority rule

The ownership freeze ends when the endpoint kill or resume ticket becomes terminal. If a later takeover then changes workspace ownership on that endpoint, the confirmed journey does not yet decide who may read or close the already-terminal endpoint-control ticket.

This question concerns only public read-and-close authority for that already-terminal ticket. It does not reopen endpoint-control admission, the nonterminal ownership freeze, or takeover wait-versus-reject behavior during the freeze.

## Downstream gate

### Downstream contracts must not decide the remaining user-visible behavior implicitly

The downstream [`User Interface`](../03-User-Interface/_MOC.md) and [`System proposal`](./System-Architecture.md) may realize the confirmed canonical journeys. They must keep the decisions above open rather than choosing user-visible behavior through schemas, state machines, retry policies, or implementation defaults.

Parent: [`90-Proposals`](./_MOC.md).
