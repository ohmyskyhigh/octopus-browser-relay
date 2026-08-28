# Real-World Browser Relay Qualification

The coordinator performs all assertions. User actions only provide physical Chrome profiles and independent Codex task surfaces.

1. Run `pnpm verify`.
2. Build the run: `pnpm tsx tests/real-world/prepare.ts --run-id=<run-id>`.
3. Start the broker and fixture server.
4. Follow the generated `artifacts/real-world/<run-id>/U1-browser-setup.md` locally; never paste its codes into chat.
   On Chrome 142 and newer, **Save and connect** may trigger a Local Network Access prompt. Allow loopback/local-network access before evaluating pairing status. The visible options page performs this permission probe because a Manifest V3 service worker cannot reliably surface the prompt by itself.
5. Run `scripts/real-world-preflight.ps1 -RunId <run-id> -Checkpoint U1`. Once all targets are paired, preflight creates the three exclusive agent-to-target bindings.
6. Open three Codex tasks and provide each generated role card. Each task authenticates, loads its own `bindingRef`, and stays open.
7. Run the U2 preflight, then `scripts/real-world-start.ps1 -RunId <run-id>`.
8. Run `scripts/real-world-verify.ps1 -RunId <run-id>` and require `PASS`.
9. Run cleanup. It preserves evidence and never removes user Chrome profiles.

`ENVIRONMENT_NOT_READY` means a physical prerequisite is missing; it is not a product failure. A product release requires zero wrong-profile markers, matching `bindingRef` values throughout each ordered trace, terminal command outcomes, and no secret-field findings.
