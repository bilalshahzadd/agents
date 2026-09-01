# Environment variables

## API / workers

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `development`, `test` or `production` |
| `API_PORT` | Fastify listen port; default 4000 |
| `WEB_ORIGIN` | Comma-separated allowed browser origins |
| `DATABASE_URL` | PostgreSQL connection string |
| `DB_POOL_MAX` | Per-process PostgreSQL pool cap |
| `DB_CONNECT_TIMEOUT_MS` | DB connection timeout |
| `REDIS_URL` | Redis/BullMQ connection; production should use TLS/private networking |
| `JWT_SECRET` | Access-token HMAC secret; 32+ strong random bytes |
| `DATA_ENCRYPTION_KEY` | Base64 encoding of exactly 32 random bytes |
| `ACCESS_TOKEN_TTL_SECONDS` | Access token lifetime; default 3600 |
| `REFRESH_TOKEN_TTL_DAYS` | Refresh-token lifetime; default 30 |
| `OPENAI_API_KEY` | Worker-side OpenAI credential |
| `OPENAI_MODEL` | Default model if an enabled agent profile does not override it |
| `AUTO_RESEARCH_ENABLED` | Enable recurring global brand research scheduler |
| `RESEARCH_INTERVAL_MS` | Research cadence; default 21,600,000 ms |
| `AGENT_WORKER_CONCURRENCY` | AI/research worker concurrency |
| `PUBLISH_WORKER_CONCURRENCY` | Publish worker concurrency |
| `ANALYTICS_WORKER_CONCURRENCY` | Analytics worker concurrency |
| `PUBLISH_RATE_MAX` | Global publish jobs allowed per rate window per worker |
| `PUBLISH_RATE_WINDOW_MS` | Publish limiter window |
| `LOG_LEVEL` | Structured server log level |

## Web

| Variable | Purpose |
|---|---|
| `API_INTERNAL_URL` | Server-side BFF route to Fastify; private service DNS recommended |
| `COOKIE_SECURE` | `true` in production HTTPS |
| `NEXT_PUBLIC_API_PROXY` | Reserved for same-origin client proxy configuration; default `/api/backend` |

## Mobile / build

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | Public HTTPS API URL embedded into the mobile build |
| `EAS_PROJECT_ID` | Expo project ID |
| `IOS_BUNDLE_ID` | Final iOS bundle identifier |
| `ANDROID_PACKAGE` | Final Android application ID |
| `SENTRY_DSN` | Reserved if/when Sentry is enabled; do not add telemetry without updating privacy disclosures |

## Development bootstrap only

`SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` are consumed by `npm run db:seed`. Do not keep a default seed password in a production secret set after bootstrap. Platform app client IDs/secrets in `.env.example` are placeholders for future OAuth callback implementations; current social-account credentials are per-account encrypted records, not environment variables.
