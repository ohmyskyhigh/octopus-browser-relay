# GitHub Release update flow

## Applied change

### Versioned GitHub Release packages now update one stable unpacked-extension installation

The approved maintenance journey now uses GitHub Releases for a portable Windows runtime archive, archive checksum, and standalone updater. Local installation verifies both the archive and its per-file manifest, installs versioned broker, adapter, and native-host entries, preserves durable broker data, keeps one stable unpacked-extension path, refreshes Native Messaging and MCP launchers, and health-checks the selected version.

Relay readiness now carries broker and required extension versions. A mismatched extension is withheld from browser work, reloads once through `chrome.runtime.reload()`, preserves profile pairing, and fails closed after a repeated mismatch.

Release staging, packaging, update, installed launch, installed stop, version-parity tests, a Windows tag workflow, canonical architecture ownership, file mapping, and operator instructions were added together.

Parent: [`Vault changelog`](./_MOC.md).
