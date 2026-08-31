# Bilingual public documentation and first GitHub release publication

This plan implements the user's approved request to publish the complete current codebase and provide detailed English and Simplified Chinese setup documentation.

## Outcome

### A new user can install, pair, register an agent, verify the runtime, and update it from public documentation

The root English and Chinese READMEs distinguish the verified GitHub Release path from source development. A Chinese documentation index, installation guide, and architecture/MCP guide translate the public operator material while linking every authoritative design claim back to the canonical English vault.

## Work

### Public installation documentation follows the actual generated artifacts and handoffs

- Add a short end-to-end checklist to the English README.
- Document exact GitHub Release, extension, pairing, Codex, Hermes, health, update, stop, and troubleshooting steps.
- Generate both Codex and Hermes handoff files from the installed-release updater.
- Add a complete Simplified Chinese README and focused Chinese operator documents.

### Repository publication includes the entire verified working tree

- Validate documentation links, schema JSON, PowerShell syntax, source checks, tests, E2E, builds, release packaging, and an isolated installed-release smoke.
- Commit every intended tracked and untracked source/documentation change while leaving ignored local state and release output uncommitted.
- Push the commit to `origin/main`.
- Create and push tag `v0.3.0` so the GitHub Actions release workflow publishes the verified assets.

## Verification

### Publication stops if local verification or remote publication fails

The final evidence must include the commit hash, pushed branch, pushed tag, GitHub Actions or GitHub Release state, local release artifact hashes, and clean tracked worktree status.

Parent: [`Development plans`](../_MOC.md).
