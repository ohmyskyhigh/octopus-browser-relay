# Browser recovery and control contract integrated

Date: 2026-08-30.

The user answered the first System-approval question set and instructed the vault to integrate those decisions before continuing to concurrency.

## Applied changes

- Defined workspace capacity as a count of distinct connected eligible browser-profile endpoints, with synchronous no-ticket rejection when admission cannot satisfy the count.
- Added broker-issued existing-window selection with a most-recently-focused eligible default and new tab-group creation in the selected window.
- Defined ended-and-replaced recovery for persisted workspaces whose browser group and tabs no longer exist.
- Defined bounded reconcile-before-retry tab creation, automatic same-window child adoption, and related child workspaces for opener-linked new windows.
- Added proactive paginated CDP capability discovery alongside exact unsupported-method rejection.
- Made ticket acknowledgement precede every asynchronous CDP dispatch and preserved the command-level ticket-and-poll cycle for short and long commands.
- Added nonterminal pause conditions, reconnect reconciliation, human resolution for effects that remain unprovable, replacement-tab recovery, workspace task-stop, sticky endpoint kill and explicit resume, and owner-controlled terminal-ticket closure.
- Required an initial broker-issued event cursor with every managed tab and defined outage recovery as a fresh current-page baseline without extension buffering, reload, or replay.
- Expanded the proposed User Interface to thirteen candidate tools and revised the proposed System around the confirmed recovery, control, ownership, and checkpoint behavior.

## Remaining gates

Same-tab concurrency and ordering remain deliberately unresolved and are the next material architecture question. The exact modes and schemas of the added controls, debugger-detach recovery, broker-restart request continuity, event retention, polling and deadlines, large-payload representation, endpoint identity continuity, supporting status freshness, incomplete termination, still-unmapped terminal outcomes, Codex and Hermes evidence, and System-owned scheduling and retention policies also remain open.

Parent: [`99-Changelog`](./_MOC.md).
