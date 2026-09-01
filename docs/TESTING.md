# Testing and verification

## Static/unit gate

```bash
npm ci
npm run typecheck
npm test
npm run build
```

`@spheric/agents` contains local operating-policy tests. Extend test coverage with API integration tests against disposable PostgreSQL/Redis before release. At minimum add regression cases for organization isolation, brand/platform account mismatch, approval state transitions, campaign pause/resume, account kill switch, refresh-token rotation, invalid encryption keys and publish failure persistence.

## Migration gate

Create a fresh PostgreSQL database and run all migrations, seed, then rerun migrations to prove idempotent migration bookkeeping. Also restore a recent production-like backup into staging and apply only pending migrations. Validate `schema_migrations` and the content/account integrity trigger.

## Staging canaries

Use dedicated non-customer accounts. Test every connector that will be enabled in production. Verify external post ID capture and that social credentials never appear in API list responses or logs. For providers with media extensions, test each approved media type separately.

## Failure/race tests

- Schedule a post, pause the campaign immediately before due time, confirm no post occurs, resume, confirm it is reconstructed.
- Schedule a post, disable its account, confirm no post occurs, re-enable, confirm reconstruction.
- Attempt to assign an X account to LinkedIn content and an account from another brand; API/DB must reject both.
- Expire access tokens while web/mobile are active and verify refresh rotation.
- Kill API/worker processes during shutdown and verify no corrupted state.
- Force provider 401/403/429/5xx responses in a fake connector or staging proxy and verify safe statuses/runbook behavior.

## Load/performance

Load-test API reads/writes separately from social publishing. Publishing throughput is constrained by provider limits, not by how many worker replicas can be created. Track DB pool utilization, queue age and model/provider latency. Never increase concurrency to evade a provider's permitted rate.
