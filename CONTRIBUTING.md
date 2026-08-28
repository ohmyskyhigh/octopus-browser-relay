# Contributing to Octopus Browser Relay

Thanks for helping improve profile-safe browser routing for MCP agents.

## Before opening a change

- Search existing issues and pull requests before starting overlapping work.
- Open an issue first for changes to identity, pairing, authorization, binding cardinality, replay behavior, or listener scope.
- Never include bearer tokens, pairing codes, browser-profile paths, private target identifiers, SQLite databases, or real-world test credentials.

## Development workflow

Requirements and setup are documented in [README.md](./README.md).

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm verify
pnpm smoke
```

Keep pull requests focused. Add or update tests for observable behavior, and document changes to the MCP or extension protocol in `docs/`.

## Architectural invariants

- MCP authenticates the agent and carries only opaque public routing references.
- The broker remains the sole source of target truth and routing decisions.
- Browser extensions report facts and execute validated commands; they do not select agents or targets.
- Private target, socket, profile, key, hash, and connection identifiers never cross the MCP boundary.
- Ambiguous non-idempotent work is recorded as `UNKNOWN_OUTCOME` and is never silently replayed.

By contributing, you agree that your contribution is licensed under the repository's MIT License.
