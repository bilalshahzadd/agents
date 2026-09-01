# Operations runbook

## Failed or skipped publish

Inspect `content_items.status`, `failure_reason`, worker logs and the matching audit trail. A campaign that is not active or an account whose posting switch is disabled causes a safe skip rather than forcing a post. Re-enable/resume reconstructs eligible delayed jobs from PostgreSQL.

For 401/403, disable posting, rotate/renew the provider credential and confirm scopes before re-enabling. For 429, reduce concurrency and honor the provider's retry guidance; never evade limits with extra accounts or enforcement-bypass proxies. For ambiguous network failures after a POST, verify at the provider before retrying because the external request may have succeeded even if the response was lost. Prefer provider idempotency mechanisms when available.

## Pause/kill switch

For a campaign incident, set campaign status to `paused`; delayed jobs are removed while schedule metadata remains durable. For an account incident, set `posting_enabled=false`; all delayed jobs for that account are removed. Workers re-check both states at execution time to cover races.

## Suspected credential leak

Disable posting immediately, revoke the provider token, rotate implicated app secrets, review outbound posts and audit logs, and notify the platform/security owner. Rotate the Spheric encryption master key only through a versioned re-encryption procedure; deleting the old key before re-encryption destroys access to stored credentials.

## Queue backlog

Alert on oldest-job age as well as depth. Check Redis health, worker crash loops, OpenAI/provider rate limits and DB saturation. Scale workers only when downstream quotas allow it. Keep Redis private, authenticated/TLS-enabled in production, and configured with a BullMQ-compatible non-evicting policy.

## Database recovery

If integrity is uncertain, stop mutating workloads. Restore PITR into a separate instance, validate `schema_migrations`, organizations/brands/campaign/content relationships, credential ciphertext presence and audit continuity, then perform controlled cutover. Never overwrite the only surviving production copy during recovery.

## Rollback

Application images are immutable and Git-SHA tagged. Roll API/worker/web back to the prior known-good SHA. Database migrations must be backward compatible for at least one application version; use forward-fix migrations rather than destructive down migrations during an incident.
