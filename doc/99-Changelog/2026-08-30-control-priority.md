# Control priority

Applied on 2026-08-30.

## Canonical behavior

### Endpoint, workspace, lifecycle, ownership, and ordinary browser work now have distinct precedence

The Product and User Experience contracts now place endpoint kill above workspace stop, place termination and takeover above ordinary CDP while allowing them to proceed during a pause, and leave ordinary CDP as the lowest-priority browser work. Priority begins only after the control's accepted acknowledgement is delivered.

### Independent pause causes survive the control transitions that do not clear them

Endpoint kill and workspace stop coexist. Takeover preserves both, endpoint resume clears only the endpoint-kill cause, and successful termination ends the workspace regardless of either pause.

### Concurrent takeover and termination use the first valid workspace-state commit

Takeover and termination have no fixed priority within their shared control class. The first valid workspace-state commit changes the workspace; the other accepted request revalidates against that change. Its exact terminal payload remains unresolved.

### Already-dispatched browser effects are reconciled instead of cancelled

A committed control fences lower-priority work that has not dispatched. It does not claim that a browser effect already dispatched was cancelled; Octopus reconciles that effect.

## Downstream realization

### The proposed User Interface adds no caller-authored priority value

Tool kind and scope select the broker's control class. The proposed workspace fact now carries a unique `automation_pause_reasons` list so endpoint kill and manual workspace stop can both remain visible.

### The proposed System separates control epochs from managed-tab FIFO lanes

Endpoint control, workspace stop, ownership, and lifecycle use separate epochs. Takeover and termination share a first-valid workspace control lane, while ordinary CDP retains its per-tab ticket-acceptance order.

## Remaining decisions

### Control failure results and the takeover boundary around reconciled in-flight work remain open

The exact terminal result for a losing control race, invalidated accepted work, incomplete termination, and the timing and visibility of takeover around already-dispatched work remain User Experience and User Interface decisions.

Parent: [`99-Changelog`](./_MOC.md).
