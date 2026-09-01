# Security model

## Controls implemented in this repository

- bcrypt password hashes with work factor 12 for the bootstrap password-auth path.
- Short-lived signed access tokens plus rotating 48-byte opaque refresh tokens; only SHA-256 refresh-token hashes persist.
- AES-256-GCM encryption for social credential envelopes with a dedicated 32-byte master key.
- Social credentials are never returned to web/mobile after insertion and are decrypted only inside the worker.
- Fastify Helmet, CORS allow-list, global rate limiting and tighter login/refresh route limits.
- Server-side RBAC and organization scoping.
- API + PostgreSQL trigger enforcement that social account, campaign brand and content platform match.
- New account posting disabled by default; account and campaign kill switches reconstruct/remove delayed jobs from durable DB state.
- Human approval state and audit log for sensitive operator/configuration actions.
- Model requests use `store:false`; the operating policy forbids fake identity, artificial engagement, spam and fabricated claims.
- Mobile session material uses Expo SecureStore; web session material stays in HttpOnly cookies behind the BFF.
- Graceful SIGTERM/SIGINT shutdown for API, queues, workers and DB pools.

## Required production hardening

For a staff-only first production deployment, replace or supplement bootstrap password auth with your enterprise OIDC/SSO + MFA provider. Move the social credential master key to KMS/HSM-backed envelope encryption with key versioning before multiple external customers are onboarded. Add device/session management, provider OAuth refresh/revocation flows, webhook signature verification, SIEM/OpenTelemetry integration, per-tenant quotas, dependency/SBOM/container scanning, data-retention/deletion workflows and external penetration testing.

## Secrets

Never commit `.env`, platform tokens, signing keys, DB passwords or OAuth client secrets. Production values must come from a secret manager or external-secret controller. `DATA_ENCRYPTION_KEY` must decode to exactly 32 bytes. Rotation requires a versioned envelope strategy; do not simply overwrite the key while old ciphertext exists.

## Abuse boundary

Do not extend this code with automatic account creation, fake-persona generation, CAPTCHA bypass, enforcement-evasion proxies, mass unsolicited messaging or coordinated artificial engagement. These are outside the platform contract and intentionally absent from connector/agent interfaces.
