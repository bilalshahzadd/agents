# Production deployment guide

## Topology

Deploy `spheric-web`, `spheric-api` and `spheric-worker` as separate workloads. Use managed PostgreSQL with automated backups/PITR and managed Redis with TLS/authentication/private networking. Web and API sit behind the organization's TLS edge/WAF; workers have no public ingress and need outbound HTTPS to OpenAI and approved social APIs.

Example DNS:

- `agents.spheric.media` -> web
- `agents-api.spheric.media` -> API

Set `WEB_ORIGIN=https://agents.spheric.media`, `API_INTERNAL_URL=http://spheric-api` (or private service URL), `COOKIE_SECURE=true` and mobile `EXPO_PUBLIC_API_URL=https://agents-api.spheric.media`.

## Build/release

After `package-lock.json` is committed, release CI should execute `npm ci`, typecheck/tests/build, then build immutable web/API/worker images tagged with the Git SHA. Run the DB migration container/job exactly once for the release. Roll API first, workers second and web third; mobile releases are independent and should use staged rollout.

Migrations are forward-only in operations. Make schema changes backward compatible with at least the immediately previous application version so application rollback remains possible.

## Database

Use separate runtime and migration DB roles. Runtime receives only required CRUD privileges; migration role has DDL. Keep DB private. Set pool sizes so `replica_count * DB_POOL_MAX` plus migration/admin connections remain under the managed database connection limit. Test PITR restoration on a schedule.

## Redis/BullMQ

Use a BullMQ-compatible `noeviction` memory policy, TLS/authentication and private networking. Redis is job delivery state, not the durable business system of record; schedules are reconstructable from PostgreSQL after account/campaign toggles. Alert on Redis unavailability, failed-job rate and oldest pending/delayed job age.

## Secrets/encryption

No production secret belongs in Git or image layers. Use AWS Secrets Manager/GCP Secret Manager/Azure Key Vault/Vault/1Password Secrets Automation plus your workload identity mechanism. Treat social access/refresh tokens as Tier-1 credentials. The delivered AES-256-GCM master-key envelope is appropriate for controlled bootstrap; implement KMS/HSM-wrapped versioned data keys before multi-customer scale.

## Identity

The included local password flow is for controlled bootstrap and staging. Staff production should use enterprise OIDC/SSO + MFA. Map IdP identity/groups to local organization memberships/RBAC, preserve short API sessions, and implement session/device revocation. Do not rely on UI controls for authorization.

## Observability

Ship structured stdout logs centrally. Add OpenTelemetry traces at Fastify, BullMQ processor and outbound API boundaries, plus an approved web/mobile crash tool if required. Alert on API 5xx/latency, auth failure spikes, DB saturation, Redis errors, queue age, agent-job failure, repeated provider 401/403/429, content `failed` accumulation and unusual posting volume.

Never log decrypted social tokens, Authorization headers, refresh tokens, full secret envelopes or unnecessary LLM prompt data.

## Scaling

Scale API by request latency/CPU. Scale AI workers by agent queue age while respecting model quotas. Scale publish workers only within provider-permitted throughput. If analytics becomes event-heavy, retain PostgreSQL for normalized operational snapshots and move raw high-volume event telemetry to an analytical warehouse such as ClickHouse/BigQuery/Snowflake.

## Deployment verification

After each release: verify `/health`; authenticate; read dashboard; create/read a staging campaign; queue research/generation; perform one controlled staging publish for changed connector code; verify audit entry; test a posting kill switch. Do not use customer production accounts as first-run canaries.

See `PRODUCTION_CHECKLIST.md` for the release gate and `RUNBOOK.md` for incident procedures.
