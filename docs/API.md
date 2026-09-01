# HTTP API

Base path: `/v1`. Direct clients send `Authorization: Bearer <accessToken>`; the web UI uses the same-origin Next.js BFF. Zod schemas in `@spheric/shared` are the canonical public request contracts.

| Method | Path | Purpose | Minimum role |
|---|---|---|---|
| POST | `/auth/login` | Password login | Public |
| POST | `/auth/refresh` | Rotate opaque refresh token | Public |
| POST | `/auth/logout` | Revoke refresh token | Public |
| GET | `/me` | Current organization session | Analyst |
| GET | `/dashboard` | Command-center rollup | Analyst |
| GET | `/brands` | List tenant brands | Analyst |
| POST | `/brands` | Create brand | Admin |
| PATCH | `/brands/:id` | Update voice/knowledge | Admin |
| GET | `/research-briefs` | Research history | Analyst |
| POST | `/brands/:id/research` | Queue brand research | Editor |
| GET | `/campaigns` | List campaigns | Analyst |
| POST | `/campaigns` | Create campaign | Editor |
| POST | `/campaigns/:id/generate` | Queue AI content generation | Editor |
| PATCH | `/campaigns/:id/status` | Draft/activate/pause/complete/archive | Editor |
| GET | `/content` | List content | Analyst |
| POST | `/content` | Create content | Editor |
| PATCH | `/content/:id` | Edit/assign/schedule content | Editor |
| POST | `/content/:id/approve` | Approve/reject | Approver |
| POST | `/content/:id/publish` | Explicit immediate publish request | Editor |
| GET | `/agents` | List agent profiles | Analyst |
| POST | `/agents` | Create agent profile | Admin |
| PATCH | `/agents/:id/enabled` | Enable/disable agent profile | Admin |
| GET | `/social-accounts` | List sanitized account records | Analyst |
| POST | `/social-accounts` | Add encrypted authorized account credentials | Admin |
| PATCH | `/social-accounts/:id/credentials` | Rotate credential envelope | Admin |
| PATCH | `/social-accounts/:id/posting` | Account posting kill switch | Admin |
| GET | `/analytics/summary` | 30-day account rollup | Analyst |
| GET | `/audit-logs` | Operator/security log | Admin |

## Important semantics

A `scheduled` content item must have both `social_account_id` and `scheduled_at`. The account must match the campaign brand and content platform. Campaign pause/archive/complete/draft states remove delayed publish jobs. Only an active campaign is publishable. Newly connected social accounts default to `posting_enabled=false`.

Before exposing the API to third-party customers, generate/version an OpenAPI spec, introduce API keys or OIDC client credentials distinct from staff sessions, enforce tenant quotas and add explicit compatibility/version policy.
