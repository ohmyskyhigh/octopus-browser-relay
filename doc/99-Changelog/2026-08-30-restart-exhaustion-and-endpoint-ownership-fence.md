# Restart exhaustion and endpoint ownership fence

Date: 2026-08-30.

## Applied change

The System proposal now defines total `restart_failed` replacement exhaustion as one atomic failure transition. The original command and winning resolver finish failed, `effect_may_have_occurred` remains on the original command, every queued old-tab follower fails without dispatch or retargeting, the old lane releases, the old tab and active workspace remain inspectable, and no replacement reference is published. A later ordinary `create_browser_tab` request continues to use its existing bounded recovery journey.

Endpoint kill and resume durable acceptance now installs a broker-private ownership fence. Workspace takeover cannot change ownership on that endpoint until the endpoint-control request terminalizes, when the fence releases atomically. The fence does not extend to workspace termination or endpoint allocation. Whether a takeover attempted while the fence is active waits behind it or is rejected synchronously remains open.

## Authority effect

This entry records an applied update to the non-canonical System proposal and its routing MOCs. It does not approve the System proposal, choose the attempted-takeover interface behavior, or override Product, User Experience, or User Interface authority.

Parent: [`99-Changelog`](./_MOC.md).
