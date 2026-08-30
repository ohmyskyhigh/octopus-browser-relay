# User Interface MCP contract proposal

Status: accepted historical proposal. Its approved contract is incorporated into [`../03-User-Interface/MCP-Contract.md`](../03-User-Interface/MCP-Contract.md) and [`../03-User-Interface/MCP-Contract.schema.json`](../03-User-Interface/MCP-Contract.schema.json). The remaining choices recorded below were closed by the canonical User Experience operational defaults and User Interface contract.

The contract currently proposes fourteen tools: ten asynchronous submissions, three immediate reads, and one immediate terminal-ticket control. The asynchronous control catalog now includes the approved `resume_workspace_automation` action alongside workspace stop, endpoint kill, endpoint resume, termination, takeover, and human resolution. The modes of resolution, ticket close, workspace stop, endpoint kill, and endpoint resume remain proposed UI choices.

## Scope

### Codex and Hermes receive the same extension-backed managed-tab contract

Codex and Hermes use the same MCP surface. Agents request logical browser capacity, target broker-issued workspace, window, tab, request, and cursor values, submit permitted raw CDP commands, and interpret raw browser evidence themselves.

The interface never exposes a Chrome remote-debugging port, pipe, Chrome window ID, Chrome tab ID, extension connection ID, debugger attachment ID, or broker-private routing key.

### Every public CDP command targets one managed tab

Every `send_cdp_command` body contains one `workspace_ref` and one tab target:

```json
{
  "workspace_ref": "wrk_broker_issued",
  "target": {
    "kind": "tab",
    "tab_ref": "tab_broker_issued"
  },
  "method": "Runtime.evaluate",
  "params": {
    "expression": "document.title",
    "returnByValue": true
  }
}
```

The method must be available through the paired extension and provably confined to the selected managed-tab tree. There is no browser-wide or exclusive-browser target.

### Setup and broker administration remain outside the automation contract

Installation, extension pairing, nickname creation, and broker maintenance are supporting journeys. This contract begins after the agent runtime can call the MCP server and the broker knows paired endpoints.

## Caller context

### Every invocation receives caller identity outside model-authored arguments

The MCP adapter supplies caller identity from the runtime session rather than asking the model to write it:

```json
{
  "session_ref": "ses_broker_issued",
  "lineage_ref": "lin_broker_issued",
  "parent_session_ref": null
}
```

The caller object appears in responses for attribution. It is absent from every tool input. The agent cannot claim a different session or lineage by adding fields.

## Public identity

### The broker issues every Octopus reference and cursor

The agent only echoes values previously returned by Octopus. The broker issues:

- `session_ref` and `lineage_ref` through runtime integration;
- `window_ref`, `workspace_ref`, `tab_ref`, and `request_ref` through this contract; and
- pagination and CDP-event cursors through read results and tab facts.

The extension generates the human-readable endpoint nickname during pairing. Browser-generated CDP handles such as `sessionId`, `objectId`, and `nodeId` remain raw protocol data and may be echoed unchanged when a permitted later command needs them. They are not Octopus identifiers.

### One logical window reference identifies one observed window on one endpoint

`window_ref` is broker-issued and stable only under the continuity rules eventually approved for the broker. It lets the agent select an eligible existing window without seeing a Chrome window ID.

## Tool surface

### Fourteen candidate tools cover context, browser work, recovery, and operator controls

| Tool | Mode | Purpose |
| --- | --- | --- |
| `get_browser_context` | Immediate read | Read one targeted broker, endpoint, window, capability, workspace, or tab-bearing view. |
| `request_browser_workspace` | Asynchronous submission | Acquire the requested number of workspaces on distinct endpoints and selected eligible windows. |
| `create_browser_tab` | Asynchronous submission | Create one additional managed tab inside an owned workspace. |
| `send_cdp_command` | Asynchronous submission | Send one permitted raw CDP command to one managed tab. |
| `read_cdp_events` | Immediate read | Read one retained event page or receive outage-recovery facts. |
| `get_browser_request` | Immediate read | Read one request ticket visible to its applicable requester or current owner. |
| `take_over_workspace` | Asynchronous submission | Transfer a workspace and its ticket visibility to a replacement session. |
| `terminate_workspace` | Asynchronous submission | End agent control and archive the workspace tab group. |
| `resolve_browser_request` | Proposed asynchronous submission | Resolve a human-confirmation pause on one raw command. |
| `close_browser_request` | Proposed immediate control | Remove one terminal ticket from its applicable requester's or current owner's public view. |
| `stop_workspace_automation` | Proposed asynchronous submission | Pause automation for one workspace without terminating it. |
| `resume_workspace_automation` | Asynchronous submission | Reconcile one manually stopped workspace and clear only its manual-stop cause. |
| `kill_browser_endpoint` | Proposed asynchronous submission | Pause automation for every workspace on one endpoint. |
| `resume_browser_endpoint` | Proposed asynchronous submission | Reconcile every surviving workspace affected by the endpoint kill and clear only that kill cause. |

These fourteen names and execution modes form the current proposed contract. `resume_workspace_automation` is the approved asynchronous realization of manual-stop recovery. The proposal recommends the same ticket-first mode for the other browser-mutating controls and immediate mode for terminal-ticket closure, but those five modes remain approval decisions.

## Shared envelopes

### Immediate calls return their final facts or one synchronous rejection

The three read-only tools—`get_browser_context`, `read_cdp_events`, and `get_browser_request`—return observed facts without mutation. `close_browser_request` also returns immediately but mutates public ticket visibility. All four return their final MCP result in the call. Their shared envelope is:

```json
{
  "contract_version": "1",
  "disposition": "complete",
  "observed_at": "2026-08-30T12:00:00Z",
  "caller": {
    "session_ref": "ses_broker_issued",
    "lineage_ref": "lin_broker_issued",
    "parent_session_ref": null
  },
  "problem": null,
  "facts": {},
  "available_actions": []
}
```

`rejected` carries a structured `problem` and `facts: null`. Malformed MCP arguments remain an MCP-native validation error rather than a domain envelope.

### A valid asynchronous submission returns a queued ticket before dispatch

Each of the ten asynchronous tools uses the same acceptance envelope:

```json
{
  "contract_version": "1",
  "disposition": "accepted",
  "observed_at": "2026-08-30T12:00:00Z",
  "caller": {
    "session_ref": "ses_broker_issued",
    "lineage_ref": "lin_broker_issued",
    "parent_session_ref": null
  },
  "problem": null,
  "facts": {
    "ticket": {
      "request_ref": "req_broker_issued",
      "state": "queued",
      "phase": "durably_accepted",
      "checkpoint": {
        "name": "durable_acceptance",
        "recorded_at": "2026-08-30T12:00:00Z",
        "details": {}
      },
      "pause_condition": null,
      "request": {
        "tool": "send_cdp_command",
        "arguments": {
          "workspace_ref": "wrk_broker_issued",
          "target": { "kind": "tab", "tab_ref": "tab_broker_issued" },
          "method": "Runtime.evaluate",
          "params": { "expression": "document.title" }
        }
      },
      "submitted_at": "2026-08-30T12:00:00Z",
      "started_at": null,
      "finished_at": null,
      "updated_at": "2026-08-30T12:00:00Z",
      "result": null,
      "failure": null,
      "uncertainty": null
    }
  },
  "available_actions": [
    {
      "tool": "get_browser_request",
      "arguments": { "request_ref": "req_broker_issued" },
      "required_arguments": []
    }
  ]
}
```

The broker creates `request_ref` and the exact normalized `request` body. The agent creates neither. The acknowledgement must reach the caller before browser dispatch. If delivery fails, Octopus does not dispatch and surfaces an immediate transport defect; there is no recent-request lookup or lost-ack rediscovery journey.

### Invalid browser capacity, ownership, target, and capability requests receive no ticket

Synchronous `rejected` applies before durable acceptance. It includes invalid caller context, insufficient eligible endpoint capacity, unavailable designated endpoints or windows, ownership mismatch, unknown logical targets, unsupported extension methods, and methods or target-bearing parameters outside the managed-tab boundary.

A rejected submission contains `facts: null`, no ticket, and no `request_ref`. An accepted operation that later fails may expose known side effects in its terminal failure; those facts do not convert failure into partial success.

### Each accepted request keeps one five-state lifecycle plus a separate pause condition

```json
{
  "request_ref": "req_broker_issued",
  "state": "running",
  "phase": "waiting_for_extension",
  "checkpoint": {
    "name": "target_resolved",
    "recorded_at": "2026-08-30T12:00:01Z",
    "details": {}
  },
  "pause_condition": {
    "reason": "extension_disconnected",
    "paused_at": "2026-08-30T12:00:02Z"
  },
  "request": {},
  "submitted_at": "2026-08-30T12:00:00Z",
  "started_at": "2026-08-30T12:00:01Z",
  "finished_at": null,
  "updated_at": "2026-08-30T12:00:02Z",
  "result": null,
  "failure": null,
  "uncertainty": null
}
```

The lifecycle states remain `queued`, `running`, `succeeded`, `failed`, and `uncertain`. `queued` and `running` are nonterminal; the other three are terminal and monotonic. A terminal ticket has a null pause condition.

The confirmed pause causes are extension disconnection, required human confirmation, manual workspace stop, and endpoint kill. Only `user_confirmation_required` is already fixed as an exact upstream token. The schema proposes `extension_disconnected`, `manual_workspace_stop`, and `endpoint_killed` as the other wire tokens. A pause is a condition alongside state, not a sixth state; those three tokens and the exact object shapes for `phase` and `checkpoint` remain proposed contract details pending approval.

Because endpoint kill and workspace stop are independent, a `workspace_fact` proposes `automation_pause_reasons` as a unique list that can contain both `endpoint_killed` and `manual_workspace_stop`. A request ticket retains one nullable effective `pause_condition`; that single request-level projection does not erase the independent workspace causes. The proposal projects `endpoint_killed` while both control causes are active and reveals `manual_workspace_stop` after endpoint resume clears only the kill cause. This exact request-level projection remains a UI approval choice.

### Terminal tickets separate success, failure, and permitted uncertainty

A succeeded ticket contains `result`, a failed ticket contains `failure`, and an uncertain ticket contains `uncertainty`. Exactly one is non-null on a terminal ticket, and its `tool` must equal `ticket.request.tool`.

`create_browser_tab` never terminates `uncertain`. It records zero through three reconcile-before-retry attempts and ends either succeeded or failed. `send_cdp_command` also does not end uncertain when its effect remains ambiguous after reconciliation; it remains nonterminal with `pause_condition.reason: user_confirmation_required` until explicit resolution.

Other asynchronous tools retain the five-state vocabulary, including an `uncertain` terminal only where their approved domain mapping permits it. A request that loses a takeover, termination, or resolution state race ends `failed`, never `uncertain`; exact public problem codes and available actions for those failures remain candidate wire details. A termination that cannot finish required reconciliation and archive confirmation also ends `failed`, never `uncertain`.

### Available actions state what Octopus can accept next

Every action hint contains the exact tool name, broker-known arguments already filled, and the names of arguments the agent must still supply:

```json
{
  "tool": "resolve_browser_request",
  "arguments": { "request_ref": "req_broker_issued" },
  "required_arguments": ["decision"]
}
```

An accepted submission and every nonterminal ticket poll include an executable `get_browser_request` action for the same `request_ref`. A human-confirmation pause includes `resolve_browser_request`; a terminal ticket visible to its applicable requester or current owner can include `close_browser_request`. Available actions do not recommend CDP methods.

## Browser context

### `get_browser_context` returns exactly one targeted and bounded view

Input:

```json
{
  "view": {
    "kind": "windows",
    "endpoint_nickname": "profile-calm-otter",
    "eligible_only": true,
    "page_size": 25,
    "cursor": null
  }
}
```

The proposed view discriminators are:

| `view.kind` | Required target and filters | Returned facts |
| --- | --- | --- |
| `broker` | none | one broker fact |
| `endpoints` | conditions, page size, nullable page cursor | a page of paired endpoint facts |
| `endpoint` | endpoint nickname | exact endpoint, extension, and browser facts |
| `windows` | endpoint nickname, eligibility filter, page size, nullable cursor | a page of logical window facts |
| `window` | `window_ref`, page size, nullable cursor | exact window plus a page of its workspaces |
| `capabilities` | endpoint, optional `window_ref`, optional method prefix, page size, nullable cursor | a page of current CDP method capability facts |
| `workspaces` | optional parent-workspace filter, page size, nullable cursor | a page of caller-visible workspaces |
| `workspace` | `workspace_ref`, page size, nullable cursor | exact workspace, tab page, and related child workspaces |
| `workspace_requests` | `workspace_ref`, lifecycle-state filters, page size, nullable cursor | a page of owner-governed workspace-operation summaries; requester-scoped and endpoint-wide tickets are excluded |

Collection views return `{returned_count, next_cursor}`. A null input cursor starts ordinary collection paging. These pagination cursors are different from required CDP-event cursors. After takeover, the replacement owner uses `workspace_requests` to discover broker-issued references for still-public owner-governed operation tickets it did not originally submit, then uses `get_browser_request` for any full ticket. Requester-scoped acquisition and takeover-control tickets and endpoint-wide kill or resume tickets are excluded. Each page is bound to the requested workspace, state filter, ordering snapshot, and current owner epoch; takeover or another owner-epoch change invalidates an older cursor rather than leaking ticket facts across owners.

An endpoint fact includes `workspace_ownership_frozen`. It is `true` while an accepted `kill_browser_endpoint` or `resume_browser_endpoint` ticket for that endpoint remains nonterminal and returns to `false` when that ticket terminates.

### Window facts expose selection inputs without exposing Chrome window identity

```json
{
  "window_ref": "win_broker_issued",
  "endpoint_nickname": "profile-calm-otter",
  "eligible_for_workspace": true,
  "eligibility_reason": null,
  "last_focused_at": "2026-08-30T11:59:00Z",
  "observed_at": "2026-08-30T12:00:00Z"
}
```

The agent can select a returned eligible `window_ref`. Octopus separately reports whether a window remains eligible when the request is admitted.

### Capability facts support discovery and precise pre-admission rejection

```json
{
  "method": "Runtime.evaluate",
  "available": true,
  "reason": null,
  "observed_at": "2026-08-30T12:00:00Z"
}
```

The proactive capability view does not guarantee that a later call will still be admissible. `send_cdp_command` repeats current capability and confinement validation and rejects unsupported or out-of-scope methods before ticket issuance.

### Every workspace and tab fact carries the public routing relationship

A workspace fact includes `workspace_ref`, endpoint nickname, `window_ref`, optional `parent_workspace_ref`, condition, the required `automation_pause_reasons` list containing zero, one, or both independent control causes, ownership and lineage facts, and tab count. A tab fact includes:

```json
{
  "workspace_ref": "wrk_broker_issued",
  "tab_ref": "tab_broker_issued",
  "window_ref": "win_broker_issued",
  "adoption_source": "workspace_initial",
  "title": "Example",
  "url": "https://example.com/",
  "active": true,
  "initial_event_cursor": "evt_broker_issued"
}
```

Same-window opener-linked children are automatically adopted into the opener's workspace and can appear with `adoption_source: same_window_child`. A child opened in a new window receives a related child workspace whose `parent_workspace_ref` points to the opener workspace; its tab is immediately usable with a new initial event cursor.

## Workspace acquisition

### `request_browser_workspace` requests a distinct endpoint for every workspace

Input:

```json
{
  "required_workspace_count": 3,
  "designated_endpoints": [
    {
      "endpoint_nickname": "profile-calm-otter",
      "window_ref": "win_broker_issued"
    },
    {
      "endpoint_nickname": "profile-blue-whale"
    }
  ]
}
```

`required_workspace_count` counts distinct endpoints. The broker normalizes repeated designated nicknames so each endpoint counts once, and the normalized designated set cannot exceed that count. Omitting `window_ref` asks Octopus to use that endpoint's most-recently-focused eligible existing window. Unnamed capacity is assigned from other eligible endpoints, also using each selected endpoint's most-recently-focused eligible window.

If Octopus cannot prove enough eligible distinct endpoints and windows at admission, it synchronously rejects with `INSUFFICIENT_ELIGIBLE_ENDPOINTS` and creates no request ticket. It does not accept a request that can only produce partial capacity.

### A succeeded workspace request returns exactly the requested capacity

The terminal success facts are:

```json
{
  "tool": "request_browser_workspace",
  "disposition": "complete",
  "facts": {
    "requested_workspace_count": 1,
    "resolved": [
      {
        "endpoint_nickname": "profile-calm-otter",
        "allocation_source": "designated",
        "window_selection": "designated",
        "workspace_result": "created",
        "ended_workspace": null,
        "workspace": {},
        "tabs": [{}],
        "tab_page": {
          "returned_count": 1,
          "next_cursor": null
        }
      }
    ]
  }
}
```

`resolved.length` equals the requested count; endpoint nicknames are distinct; every workspace and tab relationship agrees; and every resolved workspace has at least one tab with an initial event cursor.

If an accepted request later fails after creating browser work, `failure.known_facts.created_workspaces` may report those workspaces. The ticket is still `failed`, never `partial`.

## Workspace tabs

### `create_browser_tab` creates one managed tab through a ticketed request

Input:

```json
{
  "workspace_ref": "wrk_broker_issued"
}
```

A success result contains the same `workspace_ref`, a full new tab fact, `creation_attempts` from one through three, and `reconciled_before_each_retry: true`. A conclusive failure returns the still-active workspace and current tabs with the same attempt evidence in `failure.known_facts`.

Octopus reconciles at most three times before deciding whether creation can safely be retried. This tool has no `uncertain` terminal branch.

## Raw CDP commands

### `send_cdp_command` always submits one asynchronous raw command

Required input fields are `workspace_ref`, `target`, `method`, and `params`. The optional `sessionId` is a browser-generated child-session handle echoed unchanged from prior CDP evidence.

A synchronously accepted call returns only its queued ticket. A normal terminal success contains the targeted workspace and tab, method, `completion_basis: raw_result`, raw result object, optional returned `sessionId`, and the next event cursor. A `chrome.debugger.sendCommand` rejection produces a failed ticket with a raw `debugger_error`; Octopus does not reinterpret it as website-task failure.

### Accepted commands for one managed tab retain one full request cycle in ticket-acceptance order

The exact `workspace_ref` and `target.tab_ref` identify one managed-tab execution lane. Every accepted `send_cdp_command` enters that lane in the broker's durable ticket-acceptance order. Once it is the head, the request retains that position through pre-dispatch waiting, browser action, pause, reconciliation, and terminal commit. A paused nonterminal head blocks every later same-tab ticket, so reconnect or human resolution continues the head before the next command can begin. A synchronously rejected call receives no ticket and never enters the lane; confirmed acknowledgement failure skips its private position without dispatch.

The agent does not supply an order identifier, queue position, predecessor reference, or timestamp. Direct polling reads are lane-neutral: polling neither keeps the cycle open nor releases it. The terminal write releases the head atomically. The interface creates no public ordering relationship among different managed tabs.

### An ambiguous raw effect pauses instead of replaying or terminating uncertain

After reconnect and reconciliation, an effect that cannot be proved remains `queued` or `running` with:

```json
{
  "pause_condition": {
    "reason": "user_confirmation_required",
    "paused_at": "2026-08-30T12:05:00Z"
  }
}
```

Octopus does not repeat the command and does not turn that raw-command ticket into terminal `uncertain`. The paused request retains its same-tab lane. The available actions identify `resolve_browser_request` for the same broker-issued `request_ref`; that resolution is control work rather than another ordinary command behind the blocked head.

## Raw CDP events

### `read_cdp_events` requires a returned event cursor and never long-polls

Input:

```json
{
  "workspace_ref": "wrk_broker_issued",
  "target": { "kind": "tab", "tab_ref": "tab_broker_issued" },
  "cursor": "evt_broker_issued",
  "page_size": 100,
  "method_filters": ["Network.responseReceived"]
}
```

`cursor` is required and cannot be null. The first usable cursor comes from the tab fact. A normal `complete` response returns the currently retained bounded event page immediately, including `next_cursor` and `caught_up`; it never waits for future events.

### An outage invalidates the old stream and returns a fresh baseline

When a broker or extension outage invalidates the supplied cursor, the response uses the proposed `recovery_required` disposition and returns:

```json
{
  "reason": "cursor_invalidated_by_outage",
  "workspace": {},
  "tab": {},
  "fresh_cursor": "evt_new_broker_issued",
  "current_page_baseline": {
    "title": "Current page",
    "url": "https://example.com/current",
    "observed_at": "2026-08-30T12:06:00Z"
  },
  "reloaded": false,
  "replayed_invalidated_events": false
}
```

The returned workspace and tab keep the same logical references after successful reconciliation. Recovery does not reload the page, replay the invalidated stream, or use the extension as an alternate replay buffer. The agent continues from `fresh_cursor` and the current-page baseline.

## Request status and recovery

### `get_browser_request` returns one full ticket to its applicable authority

Input:

```json
{
  "request_ref": "req_broker_issued"
}
```

The result repeats the full normalized request body, current state, phase, durable checkpoint, optional pause condition, timestamps, and the applicable result, failure, or uncertainty. A queued or running result includes a `get_browser_request` action with the same `request_ref`.

Workspace acquisition stays with its requesting prospective owner through terminal closure, and each replacement session likewise keeps its own takeover-control ticket even when it never owns the workspace. Ordinary workspace-operation tickets use current-owner authority; subagents can act under that authority but gain no independent entitlement. At the winning takeover commit, every still-public owner-governed ticket—including terminal tickets not yet closed—moves atomically to the replacement owner and is removed immediately from the prior owner. Requester-scoped acquisition and competing takeover-control tickets do not transfer. The replacement discovers previously unknown owner-governed `request_ref` values through the paginated `workspace_requests` context view. Endpoint kill and resume require complete endpoint ownership at admission. The accepting owner can poll an accepted endpoint-control ticket while its ownership freeze is nonterminal; exact read authority after terminalization followed by a later ownership change remains an approval decision.

### `resolve_browser_request` records one human decision through its own ticket

Input:

```json
{
  "request_ref": "req_ambiguous_command",
  "decision": "restart_failed"
}
```

Allowed decisions are `confirmed_succeeded` and `restart_failed`. The target request must be a current-owner-visible raw command paused for `user_confirmation_required`. Immediately before any terminal or browser mutation, the broker performs one compare-and-write over target state, pause reason, applicable authority epoch, and a private resolution claim. Only the winner can mutate, terminalize, or release the lane. A losing accepted resolver ends `failed`, never `uncertain`; its exact problem code and available actions remain candidate wire details.

`confirmed_succeeded` uses one broker transaction to finish the target command as succeeded with `completion_basis: human_confirmed` and a null raw result, finish the winning resolver ticket with its resolution facts, and release the target lane. Because this branch performs no browser mutation, it may commit while a manual workspace stop or endpoint kill is active.

`restart_failed` first records the decision while the target retains its lane, then creates and confirms the replacement managed tab through one initial attempt plus no more than two retries, reconciling before each retry. Its browser-mutating phase waits while either a manual workspace stop or endpoint kill applies. Every queued request targeting the old tab ends `failed` after the replacement attempts conclude; none is dispatched or retargeted, the retained old-tab reference is always returned, and the replacement-tab reference is returned when creation succeeds.

After replacement succeeds, one broker commit finishes the target command with `failure.kind: human_resolution_restart_failed` and `effect_may_have_occurred: true`, succeeds the winning resolver ticket with old and replacement tab references, reports `old_tab_remains_managed: true`, and releases the old lane atomically. Every queued old-tab follower fails through the dedicated `failure.kind: restart_failed_follower_invalidated` envelope with `problem: null`, exact active-workspace and retained-old-tab facts, `dispatched: false`, `retargeted: false`, `lane_released: true`, and a non-null replacement tab.

After all three creation attempts are exhausted, one broker commit fails the original raw command with `failure.tool: send_cdp_command`, `failure.kind: human_resolution_restart_failed`, `problem: null`, and the exact exhaustion facts including `effect_may_have_occurred: true`. It also fails the winning resolver with `failure.tool: resolve_browser_request`, the same existing failure kind, `problem: null`, and those exact exhaustion facts. Every queued old-tab follower fails through `restart_failed_follower_invalidated` with the same exact no-dispatch, no-retarget, active-workspace, retained-old-tab, and lane-release facts, but `replacement_tab: null`. The exact public problem code for invalidated followers remains open, so their dedicated branch also carries `problem: null`. Each exhaustion failure exposes `create_browser_tab` with the known `workspace_ref` as an available recovery action; the agent may use it deliberately after inspecting the failed tickets.

### `close_browser_request` removes one terminal ticket from public view

Input:

```json
{
  "request_ref": "req_terminal"
}
```

The tool synchronously rejects a nonterminal ticket with `REQUEST_NOT_TERMINAL`. An ordinary workspace ticket requires current-owner authority. An acquisition requester retains authority to close its own terminal acquisition ticket, and a takeover requester retains authority to close its own terminal takeover ticket even if it lost the control race and never became owner. Terminal state, public visibility, applicable requester-or-owner authority, and the current ticket or owner epoch are revalidated in one atomic close mutation; a takeover or other authority change that wins first makes a stale close reject. Success returns `request_ref`, `closed_at`, `removed_from_public_view: true`, and `internal_audit_retained: true`.

Tickets have no automatic public-visibility timeout. Closing is irreversible in the public interface and does not erase the broker's internal audit record.

## Ownership and control

### Control priority is broker-owned and adds no model-authored request field

After an accepted acknowledgement is delivered, endpoint kill installs the highest-priority ordinary-action fence across its endpoint, workspace stop installs the next-priority fence within its workspace, takeover and termination may proceed while paused and outrank ordinary CDP, and ordinary CDP remains lowest priority. Endpoint kill and workspace stop remain independent conditions. A control request that loses the first valid workspace-state or target-resolution commit ends `failed`, never `uncertain`.

The agent never supplies `priority`, an epoch, a queue position, or a predecessor reference. Takeover preserves endpoint-kill and workspace-stop conditions, workspace resume clears only the manual-stop condition, endpoint resume clears only the endpoint-kill condition, and successful termination ends the workspace. Concurrent takeover and termination use the first valid workspace-state commit; the losing request revalidates and ends `failed`, with its exact problem code and available actions still awaiting approval. A winning takeover immediately changes owner and active-ticket authority without waiting for an already-dispatched browser effect, which reconciles under the replacement owner rather than being cancelled. An accepted endpoint kill or resume instead freezes ownership for the existing active workspaces in its scope until that endpoint-control ticket terminates; the agent supplies no freeze token or identifier.

### `take_over_workspace` transfers workspace and ticket ownership after exact matching

Input:

```json
{
  "workspace_ref": "wrk_broker_issued",
  "endpoint_nickname": "profile-calm-otter",
  "previous_owner_session_ref": "ses_previous_broker_issued"
}
```

A mismatch is rejected synchronously without a ticket. Each replacement requester can poll and close its own accepted takeover-control ticket whether or not it wins. At the first valid winning commit, takeover succeeds immediately and returns the preserved workspace and tabs, previous and new owner references, retained pause conditions, and `ticket_access_transferred: true`. Every still-public owner-governed workspace ticket moves to the new owner at that commit, the former owner loses access, requester-scoped acquisition and competing takeover-control tickets remain with their requesters, and an already-dispatched effect continues reconciliation under the new owner without delaying takeover success. The replacement discovers transferred owner-governed request references through `get_browser_context` with `view.kind: workspace_requests`. Takeover remains eligible while paused. A concurrent takeover and termination use the first valid workspace-state commit rather than a fixed priority between them. When endpoint-control ownership freeze already applies, ownership cannot transfer until that freeze ends; whether the attempted takeover waits or rejects synchronously remains an approval decision.

### `terminate_workspace` fences new work and ends control only after orderly completion

Input:

```json
{
  "workspace_ref": "wrk_broker_issued"
}
```

After termination is acknowledged, it fences new workspace automation. Accepted browser work that has not started ends `failed`. Browser work already dispatched is allowed to reconcile, and termination cannot succeed until every such reconciliation is complete and the tab-group rename ending in `archive` is confirmed. Only then does success return the terminated workspace, archived group name, `agent_control_ended: true`, `ticket_inspection_preserved: true`, `workspace_requests_cursor_reset: true`, and `manual_close_required: true`.

If dispatched work cannot be reconciled or the archive rename cannot be confirmed, the termination ticket ends `failed`, never `uncertain`; the workspace remains active and paused for recovery rather than ending control. Exact failure problem codes, pause-recovery facts, and available actions remain candidate wire details. Successful termination preserves ticket-only inspection and closure for the terminating owner until every still-public owner-governed operation ticket has a terminal result and is closed. Pre-termination `workspace_requests` cursors are invalid; a fresh ended-workspace query returns the remaining visible tickets. The group remains for the human to close.

### Workspace stop pauses one workspace without ending ownership

`stop_workspace_automation` accepts `{ "workspace_ref": "..." }`. Success returns the preserved workspace with `condition: paused` and `pause_reason: manual_workspace_stop`. Its workspace fence is independent from endpoint kill. New ordinary automation is blocked there while current facts remain inspectable; takeover and termination remain eligible. Termination is still a separate action.

### Workspace resume reconciles one workspace and clears only its manual stop

`resume_workspace_automation` accepts `{ "workspace_ref": "..." }` as an asynchronous submission. It reconciles the owned workspace before resuming browser mutation, then clears only `manual_workspace_stop`. If `endpoint_killed` also applies, the workspace remains paused under that independent cause. The action does not replay a browser request, change ownership, remove an endpoint kill, restore a terminated workspace, cancel tickets, or impose a request deadline.

### Endpoint kill pauses every workspace only under complete endpoint ownership

`kill_browser_endpoint` accepts `{ "endpoint_nickname": "..." }` only when the caller owns every active workspace using that endpoint. If any active workspace has another owner, Octopus rejects synchronously before ticket creation and offers `stop_workspace_automation` for the caller-owned workspaces it can identify. Acceptance freezes ownership of the existing active workspaces on that endpoint until the kill ticket terminates, and the accepting owner can poll it while that freeze is nonterminal. An accepted kill returns the killed endpoint plus every workspace paused with `endpoint_killed`; after acknowledgement delivery, it installs the highest-priority ordinary-action fence across the endpoint without clearing any independent workspace stop.

`resume_browser_endpoint` applies the same complete-ownership admission rule and otherwise rejects synchronously before ticket creation with workspace-stop actions for the caller-owned subset. Acceptance freezes ownership of the existing active workspaces on that endpoint until the resume ticket terminates, and the accepting owner can poll it while that freeze is nonterminal. An accepted resume reconciles every surviving workspace paused by that endpoint kill and returns the endpoint plus the reconciled workspace facts. It clears only `endpoint_killed`, does not resume a workspace independently stopped for `manual_workspace_stop`, preserves ownership, and does not restore a terminated workspace. No new public tool, reference, or model-authored field represents the freeze. Exact read and close authority for a terminal endpoint-control ticket after a later ownership change remains an approval decision.

## Problems and errors

### Structured problems distinguish admission, recovery, and control failures

Every structured problem has:

```json
{
  "code": "WORKSPACE_NOT_OWNED",
  "message": "The caller does not own this workspace.",
  "retryable": false,
  "affected_target": {
    "workspace_ref": "wrk_broker_issued"
  }
}
```

The schema enumerates caller, cursor, request, endpoint, window, workspace, tab, CDP, takeover, termination, and internal problem codes. In particular:

- `INSUFFICIENT_ELIGIBLE_ENDPOINTS` rejects impossible capacity before ticket issuance;
- `CDP_METHOD_UNSUPPORTED_BY_EXTENSION` and `CDP_METHOD_OUTSIDE_MANAGED_TAB_SCOPE` reject before dispatch;
- `CURSOR_INVALIDATED_BY_OUTAGE` distinguishes stream loss from an ordinary malformed cursor;
- `REQUEST_NOT_PAUSED` and `REQUEST_RESOLUTION_NOT_ALLOWED` reject invalid resolution; and
- `REQUEST_NOT_TERMINAL` rejects premature ticket closure.

The exact public problem-code mapping for every Product condition remains part of UI approval.

## Machine-readable schemas

### The companion Draft 2020-12 bundle defines every input and output root

The canonical [`MCP-Contract.schema.json`](../03-User-Interface/MCP-Contract.schema.json) defines these twenty-eight public tool roots:

- fourteen tool `*_input` definitions, excluding helper definitions such as `context_view_input`; and
- fourteen matching `*_output` definitions.

It also defines the fourteen-branch `available_action` union, the ten-branch accepted request-body union, five ticket states, four pause reasons, exact tool/result discriminator matching, required non-null event cursors, window and capability views, and terminal close facts.

For an MCP server, each tool's `inputSchema` or structured output schema materializes the bundle's `$defs` and points its root `$ref` at the matching definition. Semantic invariants that JSON Schema cannot compare across fields remain broker conformance requirements.

### Broker conformance enforces cross-field equality and cardinality

The broker must additionally prove:

- each accepted acknowledgement's polling action carries the same `request_ref` as its ticket;
- every nonterminal poll action carries the same `request_ref` as the returned ticket;
- terminal `result.tool`, `failure.tool`, or `uncertainty.tool` equals `ticket.request.tool`;
- the normalized accepted designated endpoint list contains distinct nicknames and does not exceed `required_workspace_count`;
- workspace success returns exactly the requested count on distinct endpoints;
- every returned workspace, window, endpoint, and tab reference agrees with its enclosing facts;
- an outage-recovery tab's `initial_event_cursor` equals `fresh_cursor`, while its workspace and tab references equal the pre-outage logical target;
- acquisition and takeover-control tickets remain scoped to their requesters through terminal closure, while a winning commit transfers every still-public owner-governed workspace-operation ticket;
- a `workspace_requests` context page contains only summaries whose `workspace_ref` and state match its query under the current workspace-owner epoch, and its cursor cannot cross a query or owner-epoch change;
- successful termination returns `workspace.condition: terminated`, invalidates pre-termination request-discovery cursors, and preserves fresh ticket-only discovery under the terminating owner's ended-workspace authority;
- concurrent resolution permits only one target-state and authority-epoch compare-and-write winner, and a stale close cannot commit after an authority change;
- a losing takeover, termination, or resolver ticket ends `failed`, never `uncertain`;
- `confirmed_succeeded` and `restart_failed` apply only to an eligible human-confirmation pause;
- `confirmed_succeeded` may commit while manual-stop or endpoint-kill fences apply because it performs no browser mutation;
- the browser-mutating phase of `restart_failed` waits for manual-stop and endpoint-kill fences to clear, uses one initial replacement attempt plus no more than two reconcile-before-retry attempts, and preserves the old tab;
- after the replacement attempts conclude, every queued old-tab follower uses the dedicated `restart_failed_follower_invalidated` failure kind with exact no-dispatch, no-retarget, active-workspace, retained-old-tab, and lane-release facts; its replacement tab is required and non-null after successful replacement and required as null after total exhaustion;
- successful replacement fails the original raw command, succeeds the winning resolver, fails queued old-tab followers, and releases the lane in one commit;
- total replacement exhaustion gives both the original `send_cdp_command` and winning `resolve_browser_request` tickets exact failed envelopes using `human_resolution_restart_failed`, a null public problem, and the shared exhaustion facts; it fails every queued old-tab follower, returns the active workspace and retained old tab with a null replacement, and releases the lane in one commit;
- every exhaustion failure exposes a `create_browser_tab` available action whose `workspace_ref` equals the returned active workspace;
- ticket delivery precedes dispatch, and failed delivery prevents dispatch;
- accepted commands sharing one `workspace_ref` and `tab_ref` retain the full request lane one at a time through pause, reconciliation, and terminal commit in durable ticket-acceptance order;
- direct polls do not release a managed-tab lane, while terminal human resolution releases the blocked head atomically;
- control precedence is derived from tool kind and scope without a model-authored priority field;
- endpoint kill and workspace stop remain independent, takeover preserves both, workspace resume clears only manual stop, and endpoint resume clears only kill;
- endpoint kill and endpoint resume synchronously reject without a ticket unless the caller owns every active workspace on that endpoint, and a rejection offers workspace-stop actions for the caller-owned subset;
- accepted endpoint kill and resume tickets set `workspace_ownership_frozen: true` until terminal state so existing active workspace ownership cannot change, and the accepting owner can poll while the freeze is nonterminal;
- termination fences new work, fails accepted browser work that has not started, waits for dispatched-work reconciliation and confirmed archive rename, and succeeds only after both finish;
- a termination that cannot finish reconciliation and archive confirmation ends `failed` while leaving the workspace active and paused;
- concurrent takeover and termination permit only the first valid workspace-state commit, and the loser ends failed; and
- no public tool cancels one ticket, no input supplies a deadline, and the broker applies no elapsed-time terminal timeout.

## Compatibility

### Codex and Hermes must pass the same fourteen-tool candidate conformance journey

Both runtimes must receive caller identity outside model-authored inputs, discover the same tool schemas, preserve broker-issued references, obtain an accepted ticket before dispatch, poll the same ticket states and pause conditions, use required event cursors, observe the same raw CDP and control results, demonstrate that a nonterminal same-tab head blocks every later accepted command without polling affecting release, discover transferred active request references after takeover, resume only the intended pause cause, and produce equivalent prioritized-control behavior without an agent-supplied priority value.

No current implementation evidence proves this expanded candidate contract. Approval establishes the interface target; runtime implementation and real-browser evidence remain later System and test work.

## Traceability

### Product behavior maps to one explicit interface surface

| Confirmed Product or User Experience behavior | Proposed UI realization |
| --- | --- |
| Browser capacity uses distinct endpoints and eligible existing windows. | `request_browser_workspace` uses a count plus optional endpoint/window selections; insufficient capacity rejects before ticket issuance. |
| Agents can inspect endpoint, window, workspace, supported CDP, and owner-governed request facts without loading everything. | Targeted paginated `get_browser_context` views include `windows`, `window`, `capabilities`, and `workspace_requests`. |
| Every managed tab begins with an event cursor. | Every `tab_fact` requires `initial_event_cursor`; `read_cdp_events.cursor` is required and non-null. |
| Outage recovery preserves logical targets but starts a fresh event stream. | `read_cdp_events` can return same workspace/tab facts, fresh cursor, and a current-page baseline without reload or replay. |
| Accepted work is durable and acknowledged before dispatch. | Ten asynchronous submission bodies return a broker-issued queued ticket before execution. |
| A same-tab request cycle remains acceptance ordered through pause, reconciliation, and terminal commit. | `send_cdp_command` uses the existing `workspace_ref` and `tab_ref` as a full-cycle lane; polling is lane-neutral and no agent-authored ordering field is added. |
| Pause is separate from lifecycle. | `request_ticket.pause_condition` is nullable alongside the unchanged five-state lifecycle and durable phase/checkpoint. |
| Ambiguous raw effects wait for a human. | The command remains nonterminal with `user_confirmation_required`; proposed `resolve_browser_request` applies one of two decisions. |
| Failed restart gets a clean target without discarding evidence. | `restart_failed` uses an initial attempt plus two reconcile-before-retry attempts, exposes possible prior effect, always returns the active workspace and retained old reference, returns a replacement reference when available, and fails rather than retargets queued old-tab work. Exhaustion fails both the original and resolver tickets, releases the lane, and offers `create_browser_tab`. |
| Child tabs stay within logical work ownership. | Same-window children are adopted into the workspace; new-window children receive related child-workspace facts. |
| Workspace stop/resume, endpoint kill/resume, and termination are distinct. | Four asynchronous pause controls coexist with `terminate_workspace`; each resume clears only its matching cause. |
| Controls have different priority while pause causes remain independent. | Tool kind and scope select broker precedence; no request schema includes a caller-authored priority, and takeover and termination use the first valid workspace-state commit. |
| Endpoint-wide controls require complete ownership. | Kill and endpoint resume reject synchronously without tickets unless the caller owns every active workspace on the endpoint, then freeze existing active workspace ownership through terminal state; rejected admission offers workspace-stop actions for the caller-owned subset. |
| Termination is orderly final cleanup rather than an emergency stop. | It fences new work, fails accepted-not-started work, reconciles dispatched work, confirms the archive rename, and otherwise fails with the workspace active and paused. |
| Requester scope and current ownership govern different ticket classes. | `get_browser_request` and close preserve acquisition and takeover-control requester authority; paginated `workspace_requests` discovery exposes still-public owner-governed operation tickets, which a winning takeover transfers immediately. |
| Terminal tickets persist until deliberately closed. | Proposed immediate `close_browser_request` has no timeout and removes only the public view. |
| Agents choose how long to monitor accepted work. | The contract exposes no cancel tool or agent deadline, and the broker applies no elapsed-time terminal timeout. |

## Approval decisions

### Five recovery and pause-control modes remain proposed

The contract still needs approval for asynchronous `resolve_browser_request`, immediate `close_browser_request`, and asynchronous `stop_workspace_automation`, `kill_browser_endpoint`, and `resume_browser_endpoint`. The asynchronous mode of `resume_workspace_automation` is already approved.

### Phase and checkpoint wire shapes need explicit UI approval

The schema currently proposes nonempty free-form `phase`, plus a durable checkpoint object with `name`, `recorded_at`, and open `details`. The contract needs a decision on whether these are open strings, controlled vocabularies, or tool-specific discriminated values.

### Window, capability, and recovery-baseline fact fields need explicit UI approval

The targeted view names and body fields, window eligibility fields, method capability fields, `recovery_required` disposition, and `{title, url, observed_at}` current-page baseline are proposed exact schemas for confirmed behavior.

### Conflicting repeated window selections need a normalization rule

Repeated designated endpoint nicknames count once. The contract still needs to decide whether repeated entries that name different `window_ref` values are synchronously rejected or normalized by another explicit rule.

### Takeover during endpoint-control ownership freeze needs a wait-or-reject rule

Endpoint kill and resume are admitted only when the requester owns every active workspace on the endpoint, then freeze existing active workspace ownership until the accepted ticket terminates. The accepting owner can poll while that freeze is nonterminal. A takeover cannot commit during the freeze. The contract still needs to decide whether an attempted takeover waits for the freeze to end or rejects synchronously; this decision adds no tool, identifier, or model-authored field.

### Terminal endpoint-control tickets need a read-and-close authority rule after later ownership change

The confirmed endpoint-control authority ends at a narrower boundary: the accepting owner can poll while the accepted kill or resume ticket is nonterminal and ownership is frozen. After the ticket terminalizes and the freeze ends, a later takeover may change workspace ownership. The contract still needs to decide who can read and close that already-terminal endpoint-control ticket after such a later ownership change.

### Remaining ticket retention after process restart needs an explicit persistence rule

Terminal tickets have no visibility timeout and closing removes them publicly. The contract still needs to state whether open tickets visible to their applicable requester or current owner survive broker restart and, if they do, the durability boundary.

### Cancellation and elapsed-time termination are deliberately absent

The contract exposes no individual-ticket cancellation tool, agent-authored deadline, or broker elapsed-time terminal timeout. The agent decides how long to monitor a ticket and may use the separately scoped stop, kill, takeover, resolution, or termination controls. `close_browser_request` remains terminal-only and cannot cancel queued or running work.

### Poll timing and backoff guidance remain undecided

The contract requires explicit polling but does not choose a minimum interval, recommended backoff, server hint, notification path, or maximum wait.

### Large payload representation and page limits remain undecided

The contract does not yet choose inline size limits, resources or blobs for oversized CDP data, default page sizes, maximum page sizes, or truncation behavior.

### Losing control races need exact failure payloads

Concurrent takeover and termination use the first valid workspace-state commit, and a competing resolver uses the first valid target-resolution commit. Every losing accepted control ticket ends `failed`, never `uncertain`; its exact problem code, known facts, and available actions remain undecided. A winning takeover succeeds at its commit and transfers active-ticket authority while any already-dispatched effect continues reconciliation under the new owner.

### Invalidated-follower and losing-resolver problem codes remain candidate details

`confirmed_succeeded` can finish under either stop fence, while the browser phase of `restart_failed` waits for both fences to clear. Successful replacement and total exhaustion now have exact original, resolver, follower, lane-release, workspace, old-tab, replacement-tab, and recovery-action behavior. Invalidated followers use the public non-problem-code discriminator `failure.kind: restart_failed_follower_invalidated`, while their `problem` remains null until an exact public problem code is approved. The broader problem-code catalog still needs that code and an exact public code for resolvers that lose the single-winner resolution race.

### Remaining uncertain mappings need tool-by-tool confirmation

`create_browser_tab`, `send_cdp_command`, and `terminate_workspace` deliberately exclude terminal uncertainty under their confirmed recovery journeys. Losing control races and requests invalidated by a winning control commit also end failed. Terminal `uncertain` eligibility for other non-race domain effects in workspace acquisition, takeover, resolution, stop, kill, and either resume still needs explicit confirmation.

### Nickname and logical-reference continuity remain upstream decisions

Reconnect, extension reinstall, duplicate-collision recovery, retired nickname reuse, and broker restart continuity remain unresolved. The UI must not promise stability beyond the authority later approved for those identities.

### Wire compatibility and runtime evidence remain release gates

Schema negotiation, additive-versus-breaking change rules, Codex and Hermes schema loading, caller-context injection, and real Chrome multi-profile behavior require explicit conformance evidence before this proposal becomes canonical.

Parent: [`03-User-Interface`](../03-User-Interface/_MOC.md).
