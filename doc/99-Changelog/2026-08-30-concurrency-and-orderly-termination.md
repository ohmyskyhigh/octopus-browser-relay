# Concurrency failures and orderly termination

Applied on 2026-08-30.

## Canonical behavior

### Conclusive race losers finish failed rather than uncertain

An accepted takeover, termination, or human-resolution control that loses its state-changing race finishes failed. Revalidation proves that its effect did not win, so race loss alone never produces terminal uncertainty.

### Restart recovery is bounded and never retargets queued old-tab work

`restart_failed` makes one initial replacement-tab attempt and no more than two retries. Later accepted commands targeting the old tab finish failed without browser dispatch or automatic retargeting. The old tab remains available for inspection, and successful replacement returns the new tab and initial event cursor. The original-and-resolution terminal relationship after total replacement exhaustion remains open.

### Workspace resume explicitly clears only manual stop

The asynchronous `resume_workspace_automation` action reconciles one active workspace before clearing its manual workspace-stop cause. It does not clear endpoint kill, restore a terminated workspace, or replay a browser request. Broker-only `confirmed_succeeded` resolution can finish while stopped, while browser-mutating `restart_failed` waits for every applicable fence to clear.

### Endpoint-wide controls require ownership of every active workspace

Endpoint kill or resume is admitted only when the caller owns every active workspace using that endpoint. A failed ownership check rejects synchronously without a ticket and offers workspace-level stop instead. Authority for an already-accepted endpoint-wide ticket after later ownership change remains a narrower open decision.

### Termination fences first and ends only after reconciliation and archive confirmation

After acknowledgement delivery, termination immediately fences new browser work and finishes accepted work that has not started as failed. It waits for already-dispatched work to reconcile and for the `archive` suffix to be confirmed before succeeding and ending the workspace. Failed reconciliation or archive confirmation finishes termination failed and leaves the workspace active but paused for recovery.

### Requests have neither per-request cancellation nor broker terminal timeout

Agent disconnect, elapsed time, or a reported stall cannot terminalize an accepted request. Worker watchdogs may expose a stall and replace a stale worker claim, while the agent uses the approved resolution, pause, ownership, and termination controls to change execution conditions.

## Downstream realization

### The candidate MCP contract expands to fourteen tools

The approved asynchronous `resume_workspace_automation` action raises the proposed catalog to ten asynchronous submissions, three immediate reads, and one immediate terminal-ticket close. Exact problem bodies and still-proposed control modes remain User Interface decisions.

### The System separates emergency pause from orderly lifecycle completion

Workspace stop and endpoint kill install immediate pause fences. Termination installs its own fence but does not end the lifecycle until reconciliation and archive confirmation succeed. System scheduling across different managed-tab lanes remains a separate System decision.

Parent: [`99-Changelog`](./_MOC.md).
