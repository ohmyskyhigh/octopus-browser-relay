# Documentation vault rules

These rules apply to every file under `doc/`.

The repository-wide documentation rules in [`../AGENTS.md`](../AGENTS.md) also apply throughout this vault.

## Authority

The canonical authority order is:

```text
01-Product
  -> 02-User-Experience
    -> 03-User-Interface
      -> 04-System
        -> 05-Components
          -> 06-Files
            -> executable runtime outside doc/
```

A lower level may add detail within a confirmed parent contract. It must not redefine, broaden, narrow, or override a higher level.

User Experience owns the agent journey and visible interaction requirements. User Interface owns the agent-facing MCP contract, including exact MCP tool names and agent-visible wire schemas. System owns the internal behavior and cross-component rules that realize the confirmed User Interface contract.

## Evidence

A statement may enter a canonical level only when its scope is supported by an explicit user decision, an established canonical parent, an approved decision record, or executable evidence for the runtime fact that evidence proves. Implementation behavior does not establish Product, User Experience, or User Interface intent.

When evidence is missing, conflicting, or ambiguous, stop at the owning level and ask for the smallest missing decision. Do not use a placeholder or an inference as canonical truth.

## Change workflow

1. Read `TOP-DOWN-MOC.md` and follow the authority spine from the top.
2. Write intended development work under `80-Plans/`.
3. Propose vault changes under `90-Proposals/` without changing canonical truth.
4. After explicit approval, update the canonical owner and all required downward traceability.
5. Record the applied vault change under `99-Changelog/`.

Plans, proposals, and changelog entries are supporting governance records. They do not override `01-Product/` through `06-Files/`.
