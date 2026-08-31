# GitHub Release update implementation

This plan implements the approved supporting-maintenance journey. It does not change the fourteen-tool MCP contract or browser-automation behavior.

## Status

### Implementation and isolated release rehearsal are complete

The source gate, Windows release packaging, archive and per-file verification, isolated installation, bundled broker health, fourteen-tool stdio discovery, and fenced installed-broker stop all passed on 2026-08-31. Physical activation uses the one-time migration order documented in the real-world runbook: reload the extension from the stable directory while the compatibility bridge can still talk to the previous broker, then switch the broker.

## Outcome

### One verified GitHub Release updates the local runtime and the already-loaded unpacked extension

The release pipeline produces a Windows ZIP and SHA-256 checksum. The local updater verifies both the archive checksum and its internal file manifest, installs the runtime under a versioned directory, preserves broker data, refreshes Native Messaging and MCP launch paths, replaces the contents of one stable unpacked-extension directory, starts the updated broker, and confirms health.

The human loads that stable extension directory once through Chrome developer mode. On later updates, the updated broker compares its required extension version with the connected extension version. A mismatched extension reloads once through `chrome.runtime.reload()` and reconnects with its profile identity intact. Repeated mismatch does not create a reload loop; it becomes an explicit extension error.

## Work

### Release construction produces portable versioned runtime artifacts

- Bundle the broker and stdio adapter with production dependencies.
- Copy SQLite migrations, the unpacked extension, the versioned native host, launchers, updater, stop command, license, and operator README.
- Generate an internal manifest with a SHA-256 hash for every release file.
- Compress the staged release and publish a sibling archive checksum.

### Local update commits the new version only after verification

- Resolve a GitHub Release tag or accept an explicit local package for rehearsal.
- Verify the downloaded archive before extraction and verify every extracted file before installation.
- Stop only the installer-owned broker process.
- Install into a versioned release directory and update the stable extension directory.
- Refresh Native Messaging and stable MCP launchers without deleting pairing, request, workspace, or audit data.
- Start the new broker, require matching health/version evidence, and retain the previous release for rollback evidence.

### Extension reload is fenced from browser work

- Extend relay `READY` facts with broker version, required extension version, and reload requirement.
- Do not mark a mismatched extension ready for browser dispatch.
- Reload at most once for one required version and reconnect before publishing inventory.
- Keep the profile-local cryptographic identity, nickname, and browser state unchanged.

## Verification

### Automated and staged evidence must pass before release publication

- Relay contract tests prove the version and reload facts.
- Gateway tests prove a mismatched extension is not admitted for work.
- Extension tests prove the one-reload decision and loop guard.
- Packaging checks prove version agreement and every staged hash.
- A local-package updater rehearsal installs into a temporary root, starts the bundled broker on isolated ports, reaches matching health, and stops cleanly.
- `pnpm verify` remains green.

Parent: [`Development plans`](../_MOC.md).
