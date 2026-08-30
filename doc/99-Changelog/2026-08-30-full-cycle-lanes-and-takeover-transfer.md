# Full-cycle lanes and immediate takeover transfer

Applied on 2026-08-30.

## Canonical behavior

### A same-tab request retains its lane through its complete nonterminal cycle

Commands accepted for the same `workspace_ref` and `tab_ref` remain in broker ticket-acceptance order. The head keeps the lane through browser action, extension disconnect, reconciliation, human-confirmation pause, and terminal commit. Later accepted commands do not overtake it. Direct polling observes the ticket without holding or releasing the lane.

This supersedes the paused-head and terminal-order uncertainty recorded in [`2026-08-30-same-tab-ticket-ordering.md`](./2026-08-30-same-tab-ticket-ordering.md).

### A winning takeover transfers ownership and active-ticket authority immediately

Workspace acquisition and each takeover-control ticket remain with their requesters through terminal closure. After acknowledgement delivery, a winning first-valid takeover commit atomically changes the workspace owner, transfers every still-public owner-governed workspace-operation ticket to the replacement owner, removes former-owner access, and succeeds without waiting for already-dispatched work to reconcile. Requester-scoped tickets do not transfer.

An earlier dispatched effect is not cancelled. Its original caller remains in audit, while its ticket and reconciliation continue under the replacement owner.

This supersedes the takeover-timing uncertainty recorded in [`2026-08-30-control-priority.md`](./2026-08-30-control-priority.md).

## Downstream realization

### The proposed interface discovers transferred request references without another MCP tool

The proposed `get_browser_context` contract adds a targeted, paginated `workspace_requests` view containing still-public owner-governed operation summaries and broker-issued `request_ref` values. Requester-scoped and endpoint-wide tickets are excluded. The replacement owner can use returned references with `get_browser_request`. No agent-authored queue, priority, or ordering field is added.

### The proposed System uses a full-cycle tab claim and owner-epoch handoff

The managed-tab lane releases only at terminal commit or confirmed acknowledgement failure. Human resolution operates outside the blocked ordinary lane; one target-resolution compare-and-write winner completes both the target and resolver ticket while releasing the lane atomically. A winning takeover fences the former-owner worker claim and permits a replacement-owner worker to continue in-flight reconciliation from the durable checkpoint. Terminal-ticket closure likewise compares terminal state, public visibility, applicable requester-or-owner authority, and the current authority epoch in one mutation.

## Remaining decisions

### Cross-lane scheduling and unresolved terminal mappings remain open

Concurrency and fairness across different tabs, workspaces, and endpoints remain System decisions. The exact terminal result for a losing takeover-or-termination race, accepted work invalidated before dispatch, incomplete termination, and other still-unmapped domain outcomes remains open.

Parent: [`99-Changelog`](./_MOC.md).
