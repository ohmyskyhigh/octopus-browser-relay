# Extension-profile identity

Date: 2026-08-30.

## Applied change

### Every browser profile now maps to one separately paired extension endpoint

- Defined one Octopus extension instance per browser profile.
- Defined one paired broker endpoint per extension instance.
- Made the extension-generated `endpoint_nickname` unique within the local broker registry.
- Required unique nickname registration before pairing can complete.
- Preserved session-time workspace allocation instead of hard-binding agents to profiles.
- Narrowed the remaining nickname question to reconnect, reinstall, re-pair, duplicate-name recovery, retirement, and reuse behavior.

## Evidence

User decision on 2026-08-30: different browser profiles install separate extension instances, and every extension has a unique name and pairs with the broker.

## Authority

This entry records the applied change. Current truth remains in [`../01-Product/Product-Definition.md`](../01-Product/Product-Definition.md), [`../02-User-Experience/User-Experience-Definition.md`](../02-User-Experience/User-Experience-Definition.md), and any later approved downstream contracts.

Parent: [`99-Changelog`](./_MOC.md).
