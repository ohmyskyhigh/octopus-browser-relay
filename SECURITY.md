# Security Policy

## Supported versions

Octopus Browser Relay is currently an early pre-release. Security fixes are applied to the latest revision of the `main` branch.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub's **Report a vulnerability** link in the repository's **Security** tab so the report and any reproduction details remain private.

Please include the affected component, impact, reproduction steps, and the smallest useful diagnostic trace. Remove all bearer tokens, pairing codes, browser-profile paths, private target identifiers, public-key material, SQLite databases, and real-world test credentials before submitting.

## Security boundary

The supported deployment binds both gateways to loopback. LAN or internet exposure is outside the current threat model and requires TLS, explicit host and origin allowlists, stronger secret storage, and a separate security review.

The full design is documented in [docs/security.md](./docs/security.md).
