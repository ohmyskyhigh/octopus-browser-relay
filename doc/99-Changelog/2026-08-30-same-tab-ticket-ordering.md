# Same-tab ticket ordering

Applied on 2026-08-30.

## Canonical behavior

### Accepted commands for one managed tab now begin extension execution serially in ticket-acceptance order

The Product and User Experience contracts now state that commands accepted for the same `workspace_ref` and `tab_ref` begin extension execution one at a time in broker ticket-acceptance order. Synchronously rejected calls receive no ticket and do not enter the managed-tab lane. Terminal completion order remains unpromised while paused-head lane release is unresolved.

## Downstream realization

### The proposed interface carries the ordering guarantee without adding an agent-authored identifier

The User Interface proposal uses the existing workspace and tab references to identify the lane. It adds no queue position, predecessor reference, timestamp key, or caller-generated ordering value, and the machine-readable body schema does not change.

### The proposed System records a private durable acceptance sequence for each managed tab

The System proposal now assigns each accepted raw command a private per-tab lane position and limits that lane to one active extension execution. Cross-tab scheduling remains a separate System decision.

## Remaining decision

### A command paused after dispatch still needs a lane-release rule

The canonical order does not yet decide whether a paused post-dispatch head command releases the lane for the next accepted command or blocks that lane until resolution.

Parent: [`99-Changelog`](./_MOC.md).
