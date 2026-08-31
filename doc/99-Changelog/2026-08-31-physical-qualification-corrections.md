# Physical qualification corrections

## Applied changes

### Physical evidence now constrains pagination and preserves truthful window selection

The canonical MCP schema now advertises the broker's tested `page_size` range of 1 through 100 for every paginated context view and event read. Contract tests reject values above that limit before a tool call reaches broker execution.

The broker now persists the latest focus observation for each logical window. A later unfocused observation does not erase that history. When a multi-window endpoint has no focus history, Octopus reports `WINDOW_UNAVAILABLE` and lets the agent retry with one of the broker-issued window references instead of claiming that list order is the most-recently-focused choice.

SQLite migration `005-window-focus-history.sql`, repository tests, broker integration tests, the canonical User Experience, MCP contract, System, Components, and File map record the applied correction.

Parent: [`_MOC.md`](./_MOC.md).
