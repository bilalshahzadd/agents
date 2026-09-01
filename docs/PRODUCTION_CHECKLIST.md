# Production go-live checklist

## Source and supply chain

- [ ] `package-lock.json` generated in a network-connected trusted environment, reviewed and committed.
- [ ] `npm ci`, typecheck, unit/integration tests and production builds green on the release commit.
- [ ] SCA/SBOM, secret scan and container vulnerability scan reviewed.
- [ ] Images are immutable and tagged by Git SHA; rollback SHA is known.

## Identity and secrets

- [ ] Production OIDC/SSO + MFA enabled, or an explicitly approved limited bootstrap-user exception exists.
- [ ] JWT, DB, Redis, OpenAI and provider secrets are injected from an approved secret manager.
- [ ] Social credential encryption/key-rotation design approved; KMS/HSM envelope encryption enabled for multi-customer rollout.
- [ ] No development seed password remains active.

## Data / queues

- [ ] PostgreSQL private networking, encryption, backups and PITR enabled and restore-tested.
- [ ] Migration job tested on a production-like restore.
- [ ] Redis private/TLS/authenticated, persistence configured as required and `noeviction` policy confirmed for BullMQ.
- [ ] Queue-age/failed-job alerts tested.

## Social providers

- [ ] Ownership/authorization documented for each connected account.
- [ ] Production developer apps and scopes approved.
- [ ] One canary post completed through each enabled connector.
- [ ] Provider API/version headers verified against current official documentation.
- [ ] New accounts remain posting-disabled until verified.
- [ ] TikTok remains disabled unless official Content Posting approval and implementation are complete.

## Application/security

- [ ] TLS/WAF/DNS configured for web and API.
- [ ] Organization-isolation and account brand/platform regression tests pass.
- [ ] Campaign pause and account kill-switch race tests pass.
- [ ] Audit retention/access policy approved.
- [ ] Central logs/traces/error alerts and incident contacts configured.
- [ ] External security review/penetration test completed for the intended exposure level.

## Mobile

- [ ] Final immutable bundle/package IDs configured.
- [ ] Apple/Google signing and store records controlled by the organization.
- [ ] TestFlight/Internal Testing validation complete on physical devices.
- [ ] Privacy nutrition labels/Data Safety match the actual SDKs and telemetry.
- [ ] Staged/phased rollout plan and rollback criteria approved.
