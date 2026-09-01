CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE TYPE member_role AS ENUM ('owner','admin','editor','analyst','approver');
CREATE TYPE social_platform AS ENUM ('x','linkedin','telegram','instagram','facebook','tiktok');
CREATE TYPE campaign_status AS ENUM ('draft','active','paused','completed','archived');
CREATE TYPE content_status AS ENUM ('draft','pending_approval','approved','scheduled','publishing','published','failed','rejected');

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email citext NOT NULL UNIQUE, password_hash text NOT NULL, name text,
  disabled boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE memberships (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'analyst', created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, organization_id)
);
CREATE TABLE brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL, slug text NOT NULL, voice text NOT NULL DEFAULT '', knowledge_base jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,slug)
);
CREATE TABLE social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  platform social_platform NOT NULL, handle text NOT NULL, external_account_id text NOT NULL,
  encrypted_credentials text NOT NULL, posting_enabled boolean NOT NULL DEFAULT false, status text NOT NULL DEFAULT 'connected',
  last_sync_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(platform, external_account_id)
);
CREATE TABLE agent_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name text NOT NULL, kind text NOT NULL CHECK(kind IN ('research','strategy','copywriter','community','analytics','compliance','scheduler')),
  instructions text NOT NULL, model text NOT NULL DEFAULT 'gpt-5.6-terra', enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name text NOT NULL, objective text NOT NULL, audience text NOT NULL, start_at timestamptz NOT NULL, end_at timestamptz NOT NULL,
  platforms social_platform[] NOT NULL, posts_per_platform int NOT NULL DEFAULT 5 CHECK(posts_per_platform BETWEEN 1 AND 50),
  requires_approval boolean NOT NULL DEFAULT true, status campaign_status NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  social_account_id uuid REFERENCES social_accounts(id) ON DELETE SET NULL, platform social_platform NOT NULL,
  body text NOT NULL, media_urls jsonb NOT NULL DEFAULT '[]'::jsonb, status content_status NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz, published_at timestamptz, external_post_id text, external_url text, failure_reason text,
  generated_by_agent_id uuid REFERENCES agent_profiles(id) ON DELETE SET NULL, created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX content_due_idx ON content_items(status, scheduled_at);
CREATE TABLE approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES users(id), decided_by uuid REFERENCES users(id), decision text CHECK(decision IN ('approved','rejected')),
  note text, created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz
);
CREATE TABLE analytics_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), social_account_id uuid NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  content_item_id uuid REFERENCES content_items(id) ON DELETE CASCADE, captured_at timestamptz NOT NULL DEFAULT now(),
  impressions bigint NOT NULL DEFAULT 0, engagements bigint NOT NULL DEFAULT 0, clicks bigint NOT NULL DEFAULT 0,
  likes bigint NOT NULL DEFAULT 0, comments bigint NOT NULL DEFAULT 0, shares bigint NOT NULL DEFAULT 0,
  followers bigint, raw jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY, organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL, actor_type text NOT NULL DEFAULT 'user', action text NOT NULL,
  entity_type text, entity_id text, ip inet, user_agent text, details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_org_time_idx ON audit_logs(organization_id, created_at DESC);
CREATE TABLE webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider text NOT NULL, external_event_id text NOT NULL,
  payload jsonb NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz,
  UNIQUE(provider, external_event_id)
);
