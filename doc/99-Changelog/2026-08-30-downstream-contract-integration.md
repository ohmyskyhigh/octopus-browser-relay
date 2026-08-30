# Downstream contracts integrated with the Product definition

Date: 2026-08-30.

## Applied change

### User Experience, User Interface, and System now treat Product constraints as ordinary contract rules

- Removed Product-release framing from the canonical User Experience and aligned endpoint discovery, participating-profile scope, raw-result terminology, experience principles, and Product traceability.
- Preserved the required User Experience category headings and every unresolved User Experience decision.
- Removed the standalone User Interface boundaries section by moving interface scope exclusions into `Scope` and ordinary-context exclusions into `Browser context`.
- Rephrased managed-tab, extension-backed CDP, no-fallback, and raw-protocol rules as contract-wide behavior rather than release exceptions.
- Distinguished MCP wire-contract version 1 from Product, browser, extension, relay, and agent-runtime versions in the proposal and schema metadata.
- Rephrased the System architecture as the realization of the integrated Product model, removed release framing from its execution rules and invariants, and clarified its unresolved parent, runtime-evidence, and System-policy gates.
- Promoted no User Interface or System proposal and resolved none of their open decisions.

## Evidence

User direction on 2026-08-30: update User Experience, User Interface, and System architecture to follow the integrated Product definition rather than a standalone V1-boundary model.

## Authority

Current canonical User Experience truth remains in [`../02-User-Experience/User-Experience-Definition.md`](../02-User-Experience/User-Experience-Definition.md). User Interface and System remain non-canonical proposals in [`../90-Proposals/User-Interface-MCP-Contract.md`](../90-Proposals/User-Interface-MCP-Contract.md) and [`../90-Proposals/System-Architecture.md`](../90-Proposals/System-Architecture.md).

Parent: [`99-Changelog`](./_MOC.md).
