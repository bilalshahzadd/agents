# Developer handoff

This is the engineering entrypoint for taking Spheric Agents from source delivery to a production environment.

## 1. Establish a reproducible dependency graph

The source delivery pins direct dependencies, but it intentionally does not contain a fabricated `package-lock.json`. The assembly environment could resolve current package metadata through web research but could not reach `registry.npmjs.org` from the build container. In a normal network-connected engineering workstation/CI bootstrap environment run:

```bash
node --version           # >= 22.13
npm --version            # 10.x recommended
npm install
npm run typecheck
npm test
npm run build
```

Review the generated lockfile and `npm audit`/your SCA output, then commit `package-lock.json`. From that point forward release pipelines must use `npm ci`, not unconstrained installs. Do not approve the first release until the lockfile has passed your normal dependency/SBOM review.

## 2. Start local infrastructure

Copy `.env.example` to `.env`, replace all placeholder secrets, then start PostgreSQL/Redis:

```bash
npm run docker:up
npm run db:migrate
npm run db:seed
npm run dev
```

The seed is for a controlled development/bootstrap environment. Change `SEED_ADMIN_PASSWORD` before running it and never reuse that password in production. Seed also installs the default Research Desk, Campaign Strategist, Copy Desk, Compliance Gate, Analytics Desk and Scheduler profiles for the Spheric Agents brand.

## 3. Validate the product workflow

Verify this exact happy path in staging: login -> configure brand voice/knowledge -> connect a staging social account with posting disabled -> create campaign -> generate content -> inspect compliance state -> edit/assign/schedule -> approve -> enable posting -> publish to the staging account -> confirm provider post ID and audit log. Then test pause/resume and account disable/re-enable while delayed content exists.

The app should never publish from a mismatched brand/platform account; this is guarded at the API, DB trigger and worker layers.

## 4. External platform work that requires your organization

Code cannot grant social provider entitlements or mobile store credentials. Security/engineering must create or finalize the production developer apps, OAuth redirect domains, approved scopes/products, production page/channel/account authorizations, Apple/Google signing identities and store records. The credential JSON bootstrap endpoint can operate immediately for approved tokens, but provider-specific OAuth UX should be completed before delegating account connection to non-security staff.

TikTok publishing is intentionally not faked: enable it only after Spheric receives the relevant Content Posting product/review and implement that official flow. X/LinkedIn/Facebook included adapters are text-only; Instagram supports one image URL; media workflows can be extended after provider entitlements are known.

## 5. Authentication decision

The repository ships a secure-enough bootstrap staff password flow (bcrypt + short-lived access + rotating opaque refresh tokens), not a claim that local passwords are the ideal enterprise identity layer. Before broad staff/customer rollout, connect Spheric's enterprise OIDC/SSO and MFA and map IdP groups/claims to `memberships.role`. Keep API RBAC checks intact; UI hiding is never authorization.

## 6. Encryption decision

The current envelope is AES-256-GCM using one injected 32-byte master key. Before multi-customer production, wrap per-environment/per-tenant data keys with AWS KMS, GCP KMS, Azure Key Vault/HSM or Vault Transit, store a key version with each credential and implement online re-encryption. The current implementation is intentionally simple enough to audit but must not be rotated by replacing the key blindly.

## 7. Analytics decision

The data model and dashboards are ready, but provider insights permissions vary materially. Add metrics implementations to `SocialConnector.metrics` only for provider apps/scopes Spheric actually holds. Persist normalized snapshots in `analytics_snapshots` and keep the provider response in `raw` for debugging/audit. Do not scrape logged-in consumer pages as an analytics substitute.

## 8. Release infrastructure

Build three stateless server images: web, API and worker. Use managed PostgreSQL/PITR and managed Redis/TLS/private networking. Run migrations as a one-shot release job before application rollout. Inject secrets from a secret manager. Put web/API behind TLS/WAF; workers need outbound internet but no public ingress. Use Git-SHA image tags.

Kubernetes examples under `infra/k8s` are templates, not a substitute for your cloud's ingress, certificate, autoscaling, secret and backup standards.

## 9. Mobile release

Set final bundle/package identifiers before the first store submission. Configure EAS/Apple/Google credentials, production API URL, store metadata and privacy disclosures. Use internal/TestFlight testing before staged rollout. Mobile intentionally provides operational controls but not social-provider credential entry.

## 10. Release gate

The go-live gate is in `PRODUCTION_CHECKLIST.md`. The minimum release evidence should include: committed dependency lock/SBOM, successful typecheck/tests/builds, migration dry run and restore test, staging canary posts for every enabled connector, pause/kill-switch race tests, OIDC/MFA decision, secret/KMS decision, alert dashboards, incident contacts and mobile store compliance.
