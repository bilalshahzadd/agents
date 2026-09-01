# Spheric Agents

Spheric Agents is a production-oriented agentic social-media operations platform for **authorized, brand-owned accounts**. This monorepo contains the web control plane, API, background agent/publishing workers, PostgreSQL/Redis data layer, official-API connector package, and an Expo application that builds for both iOS and Android.

## What is included

- **Web:** Next.js command center for brands, campaigns, content approval/editing, agents, account kill-switches, research, analytics summaries and audit logs.
- **iOS + Android:** Expo Router operator app for dashboards, campaigns, approvals, agents and emergency posting controls; sessions are kept in Expo SecureStore.
- **API:** Fastify service with organization tenancy, RBAC, rate limiting, access/refresh auth, credential encryption and immutable operator audit events.
- **Workers:** BullMQ research, campaign generation, compliance and publishing workloads with controlled concurrency and delayed jobs.
- **Data:** PostgreSQL migrations for organizations, memberships, brands, agent profiles, campaigns, content, approvals, encrypted social accounts, analytics, research, sessions and audit events.
- **AI:** OpenAI Responses API integration; brand-specific enabled agent instructions/model assignments drive research, editorial generation and compliance review.
- **Connectors:** Official HTTP API adapters for X text posts, Telegram messages, LinkedIn text posts, Facebook Page text posts and Instagram single-image posts. TikTok remains gated until the deploying organization's Content Posting app/product is approved.
- **Ops:** Dockerfiles, local Compose dependencies, Kubernetes examples, CI, release/runbook/security/API/mobile documentation.

## Operating boundary

This repository intentionally does **not** implement fake-persona creation, automated account farming, CAPTCHA evasion, proxy rotation to bypass enforcement, artificial likes/follows/reposts, mass unsolicited DMs, deceptive coordinated amplification, or fabricated endorsements. Account credentials must represent accounts Spheric is authorized to operate. Posting defaults to disabled for newly connected accounts.

## Repository map

```text
apps/
  api/       Fastify API + auth/RBAC/queue commands
  web/       Next.js web control plane and same-origin BFF
  worker/    BullMQ agent/research/publish/analytics workers
  mobile/    Expo iOS + Android operator app
packages/
  agents/    LLM workflows + operating/compliance policy
  connectors Official social publishing adapters
  db/        PostgreSQL client, migrations and bootstrap seed
  shared/    Zod contracts, shared types and queue names
docs/        Engineering/production/API/security/runbooks
infra/k8s/   Kubernetes examples
scripts/     Smoke/bootstrap helpers
```

## Local bootstrap

Prerequisites: Node.js **22.13+**, npm 10+, PostgreSQL 17+ and Redis 8+ (or Docker for the provided local dependencies).

```bash
cp .env.example .env
openssl rand -base64 48   # use output for JWT_SECRET
openssl rand -base64 32   # use output for DATA_ENCRYPTION_KEY
npm install
npm run docker:up
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`; API health is `http://localhost:4000/health`. For a physical phone, set `EXPO_PUBLIC_API_URL` to an HTTPS or LAN-reachable API endpoint and run `npm run dev:mobile`.

The first `npm install` in a network-connected engineering environment should create `package-lock.json`. **Commit that lockfile before the first production release and use `npm ci` in release pipelines.** The delivery environment used to assemble this repository did not have working npm-registry DNS, so a verified lockfile could not be generated here.

## Production handoff

Start with [`docs/DEVELOPER_HANDOFF.md`](docs/DEVELOPER_HANDOFF.md), then follow [`docs/PRODUCTION.md`](docs/PRODUCTION.md) and [`docs/PRODUCTION_CHECKLIST.md`](docs/PRODUCTION_CHECKLIST.md). Platform credential shapes and provider limitations are in [`docs/SOCIAL_CONNECTORS.md`](docs/SOCIAL_CONNECTORS.md).
