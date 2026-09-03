import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '@spheric/db';
import {
  agentCreateSchema,
  campaignCreateSchema,
  contentCreateSchema,
  socialAccountCreateSchema,
  type Platform,
} from '@spheric/shared';
import { env } from './config.js';
import { issueRefreshToken, revokeRefreshToken, rotateRefreshToken, signAccessToken } from './auth.js';
import { authenticate, requireRole } from './rbac.js';
import { encryptJson } from './crypto.js';
import { audit } from './audit.js';
import { agentQueue, syncPublishJob } from './queues.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(256),
  organizationId: z.string().uuid().optional(),
});

async function accountMatchesBrandPlatform(accountId: string, brandId: string, platform: Platform) {
  const result = await query<{ id: string }>(
    "SELECT id FROM social_accounts WHERE id=$1 AND brand_id=$2 AND platform=$3 AND status='connected'",
    [accountId, brandId, platform],
  );
  return (result.rowCount ?? 0) > 0;
}

async function requeueCampaign(campaignId: string) {
  await query(
    "UPDATE content_items SET status='scheduled',updated_at=now() WHERE campaign_id=$1 AND status='approved' AND social_account_id IS NOT NULL AND scheduled_at IS NOT NULL",
    [campaignId],
  );
  const rows = await query<{ id: string; scheduled_at: string }>(
    "SELECT id,scheduled_at FROM content_items WHERE campaign_id=$1 AND status='scheduled' AND social_account_id IS NOT NULL AND scheduled_at IS NOT NULL",
    [campaignId],
  );
  await Promise.all(rows.rows.map((item) => syncPublishJob(item.id, item.scheduled_at)));
}

async function unscheduleCampaign(campaignId: string) {
  const rows = await query<{ id: string }>("SELECT id FROM content_items WHERE campaign_id=$1 AND status='scheduled'", [campaignId]);
  await Promise.all(rows.rows.map((item) => syncPublishJob(item.id, null)));
}

export async function routes(app: FastifyInstance) {
  app.get('/health', async () => ({ ok: true, service: 'spheric-api' }));

  app.post('/v1/auth/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const user = await query<{ id: string; password_hash: string; disabled: boolean }>(
      'SELECT id,password_hash,disabled FROM users WHERE email=$1',
      [body.email],
    );
    if (!user.rowCount || user.rows[0]!.disabled || !(await bcrypt.compare(body.password, user.rows[0]!.password_hash))) {
      return reply.code(401).send({ error: 'invalid_credentials', message: 'Invalid email or password' });
    }
    const membership = await query<{ organization_id: string; role: string }>(
      `SELECT organization_id,role FROM memberships WHERE user_id=$1 ${body.organizationId ? 'AND organization_id=$2 ' : ''}ORDER BY created_at LIMIT 1`,
      body.organizationId ? [user.rows[0]!.id, body.organizationId] : [user.rows[0]!.id],
    );
    if (!membership.rowCount) return reply.code(403).send({ error: 'no_membership', message: 'No organization membership' });

    const accessToken = await signAccessToken(user.rows[0]!.id, membership.rows[0]!.organization_id, membership.rows[0]!.role);
    const refreshToken = await issueRefreshToken(user.rows[0]!.id);
    return {
      accessToken,
      refreshToken,
      expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
      user: {
        id: user.rows[0]!.id,
        role: membership.rows[0]!.role,
        organizationId: membership.rows[0]!.organization_id,
      },
    };
  });

  app.post('/v1/auth/refresh', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = z.object({ refreshToken: z.string().min(20), organizationId: z.string().uuid().optional() }).parse(req.body);
    const rotated = await rotateRefreshToken(body.refreshToken);
    if (!rotated) return reply.code(401).send({ error: 'invalid_refresh', message: 'Refresh token invalid' });
    const membership = await query<{ organization_id: string; role: string }>(
      `SELECT organization_id,role FROM memberships WHERE user_id=$1 ${body.organizationId ? 'AND organization_id=$2 ' : ''}ORDER BY created_at LIMIT 1`,
      body.organizationId ? [rotated.userId, body.organizationId] : [rotated.userId],
    );
    if (!membership.rowCount) return reply.code(403).send({ error: 'no_membership', message: 'No organization membership' });
    return {
      accessToken: await signAccessToken(rotated.userId, membership.rows[0]!.organization_id, membership.rows[0]!.role),
      refreshToken: rotated.refreshToken,
      expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    };
  });

  app.post('/v1/auth/logout', async (req) => {
    const body = z.object({ refreshToken: z.string().min(20) }).parse(req.body);
    await revokeRefreshToken(body.refreshToken);
    return { ok: true };
  });

  app.get('/v1/me', { preHandler: authenticate }, async (req) => {
    const result = await query(
      'SELECT u.id,u.email,u.name,m.role,o.id organization_id,o.name organization_name FROM users u JOIN memberships m ON m.user_id=u.id JOIN organizations o ON o.id=m.organization_id WHERE u.id=$1 AND o.id=$2',
      [req.actor!.userId, req.actor!.orgId],
    );
    return result.rows[0];
  });

  app.get('/v1/dashboard', { preHandler: authenticate }, async (req) => {
    const orgId = req.actor!.orgId;
    const [campaigns, content, accounts, agents, analytics] = await Promise.all([
      query<{ count: string }>("SELECT count(*) FROM campaigns c JOIN brands b ON b.id=c.brand_id WHERE b.organization_id=$1 AND c.status='active'", [orgId]),
      query<{ status: string; count: string }>('SELECT ci.status,count(*) FROM content_items ci JOIN campaigns c ON c.id=ci.campaign_id JOIN brands b ON b.id=c.brand_id WHERE b.organization_id=$1 GROUP BY ci.status', [orgId]),
      query<{ count: string }>('SELECT count(*) FROM social_accounts sa JOIN brands b ON b.id=sa.brand_id WHERE b.organization_id=$1', [orgId]),
      query<{ count: string }>('SELECT count(*) FROM agent_profiles ap JOIN brands b ON b.id=ap.brand_id WHERE b.organization_id=$1 AND ap.enabled=true', [orgId]),
      query<{ impressions: string; engagements: string; clicks: string }>("SELECT COALESCE(sum(a.impressions),0) impressions,COALESCE(sum(a.engagements),0) engagements,COALESCE(sum(a.clicks),0) clicks FROM analytics_snapshots a JOIN social_accounts sa ON sa.id=a.social_account_id JOIN brands b ON b.id=sa.brand_id WHERE b.organization_id=$1 AND a.captured_at>now()-interval '30 days'", [orgId]),
    ]);
    return {
      activeCampaigns: Number(campaigns.rows[0]!.count),
      connectedAccounts: Number(accounts.rows[0]!.count),
      enabledAgents: Number(agents.rows[0]!.count),
      content: Object.fromEntries(content.rows.map((item) => [item.status, Number(item.count)])),
      analytics: analytics.rows[0],
    };
  });

  app.get('/v1/brands', { preHandler: authenticate }, async (req) =>
    (await query('SELECT * FROM brands WHERE organization_id=$1 ORDER BY name', [req.actor!.orgId])).rows,
  );

  app.post('/v1/brands', { preHandler: requireRole('admin') }, async (req) => {
    const body = z.object({
      name: z.string().min(2).max(120),
      slug: z.string().regex(/^[a-z0-9-]+$/),
      voice: z.string().max(6000).default(''),
      knowledgeBase: z.record(z.string(), z.unknown()).default({}),
    }).parse(req.body);
    const result = await query<{ id: string }>(
      'INSERT INTO brands(organization_id,name,slug,voice,knowledge_base) VALUES($1,$2,$3,$4,$5) RETURNING id',
      [req.actor!.orgId, body.name, body.slug, body.voice, JSON.stringify(body.knowledgeBase)],
    );
    await audit(req, 'brand.create', 'brand', result.rows[0]!.id, { name: body.name, slug: body.slug });
    return { id: result.rows[0]!.id };
  });

  app.patch('/v1/brands/:id', { preHandler: requireRole('admin') }, async (req, reply) => {
    const id = z.string().uuid().parse((req.params as { id: string }).id);
    const body = z.object({
      name: z.string().min(2).max(120).optional(),
      voice: z.string().max(6000).optional(),
      knowledgeBase: z.record(z.string(), z.unknown()).optional(),
    }).parse(req.body);
    const result = await query(
      'UPDATE brands SET name=COALESCE($3,name),voice=COALESCE($4,voice),knowledge_base=COALESCE($5::jsonb,knowledge_base),updated_at=now() WHERE id=$1 AND organization_id=$2 RETURNING id',
      [id, req.actor!.orgId, body.name ?? null, body.voice ?? null, body.knowledgeBase ? JSON.stringify(body.knowledgeBase) : null],
    );
    if (!result.rowCount) return reply.code(404).send({ error: 'not_found', message: 'Brand not found' });
    await audit(req, 'brand.update', 'brand', id, { fields: Object.keys(body) });
    return { id };
  });

  app.get('/v1/research-briefs', { preHandler: authenticate }, async (req) => {
    const params = req.query as { brandId?: string };
    const brandId = params.brandId ? z.string().uuid().parse(params.brandId) : null;
    return (await query(
      'SELECT rb.* FROM research_briefs rb JOIN brands b ON b.id=rb.brand_id WHERE b.organization_id=$1 AND ($2::uuid IS NULL OR rb.brand_id=$2) ORDER BY rb.created_at DESC LIMIT 100',
      [req.actor!.orgId, brandId],
    )).rows;
  });

  app.post('/v1/brands/:id/research', { preHandler: requireRole('editor') }, async (req, reply) => {
    const id = z.string().uuid().parse((req.params as { id: string }).id);
    const body = z.object({ query: z.string().min(3).max(500).optional() }).parse(req.body ?? {});
    const brand = await query('SELECT id FROM brands WHERE id=$1 AND organization_id=$2', [id, req.actor!.orgId]);
    if (!brand.rowCount) return reply.code(404).send({ error: 'not_found', message: 'Brand not found' });
    const job = await agentQueue.add('research-brand', { brandId: id, queryText: body.query }, { removeOnComplete: 500, removeOnFail: 500 });
    await audit(req, 'brand.research', 'brand', id, { jobId: job.id });
    return reply.code(202).send({ jobId: job.id });
  });

  app.get('/v1/campaigns', { preHandler: authenticate }, async (req) =>
    (await query('SELECT c.*,c.platforms::text[] AS platforms FROM campaigns c JOIN brands b ON b.id=c.brand_id WHERE b.organization_id=$1 ORDER BY c.created_at DESC LIMIT 200', [req.actor!.orgId])).rows,
  );

  app.post('/v1/campaigns', { preHandler: requireRole('editor') }, async (req, reply) => {
    const body = campaignCreateSchema.parse(req.body);
    const owned = await query('SELECT 1 FROM brands WHERE id=$1 AND organization_id=$2', [body.brandId, req.actor!.orgId]);
    if (!owned.rowCount) return reply.code(403).send({ error: 'forbidden', message: 'Brand not owned by organization' });
    const result = await query<{ id: string }>(
      'INSERT INTO campaigns(brand_id,name,objective,audience,start_at,end_at,platforms,posts_per_platform,requires_approval,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',
      [body.brandId, body.name, body.objective, body.audience, body.startAt, body.endAt, body.platforms, body.postsPerPlatform, body.requiresApproval, req.actor!.userId],
    );
    await audit(req, 'campaign.create', 'campaign', result.rows[0]!.id);
    return { id: result.rows[0]!.id };
  });

  app.post('/v1/campaigns/:id/generate', { preHandler: requireRole('editor') }, async (req, reply) => {
    const id = z.string().uuid().parse((req.params as { id: string }).id);
    const campaign = await query('SELECT c.id FROM campaigns c JOIN brands b ON b.id=c.brand_id WHERE c.id=$1 AND b.organization_id=$2', [id, req.actor!.orgId]);
    if (!campaign.rowCount) return reply.code(404).send({ error: 'not_found', message: 'Campaign not found' });
    const job = await agentQueue.add('generate-campaign', { campaignId: id, actorUserId: req.actor!.userId }, { removeOnComplete: 1000, removeOnFail: 1000 });
    await audit(req, 'campaign.generate', 'campaign', id, { jobId: job.id });
    return reply.code(202).send({ jobId: job.id });
  });

  app.patch('/v1/campaigns/:id/status', { preHandler: requireRole('editor') }, async (req, reply) => {
    const id = z.string().uuid().parse((req.params as { id: string }).id);
    const body = z.object({ status: z.enum(['draft', 'active', 'paused', 'completed', 'archived']) }).parse(req.body);
    const result = await query(
      'UPDATE campaigns c SET status=$3,updated_at=now() FROM brands br WHERE c.brand_id=br.id AND c.id=$1 AND br.organization_id=$2 RETURNING c.id',
      [id, req.actor!.orgId, body.status],
    );
    if (!result.rowCount) return reply.code(404).send({ error: 'not_found', message: 'Campaign not found' });
    if (body.status === 'active') await requeueCampaign(id);
    else await unscheduleCampaign(id);
    await audit(req, 'campaign.status', 'campaign', id, body);
    return { id, status: body.status };
  });

  app.get('/v1/content', { preHandler: authenticate }, async (req) => {
    const params = req.query as { status?: string };
    const status = params.status ? String(params.status) : null;
    const result = await query(
      'SELECT ci.*,c.name campaign_name FROM content_items ci JOIN campaigns c ON c.id=ci.campaign_id JOIN brands b ON b.id=c.brand_id WHERE b.organization_id=$1 AND ($2::text IS NULL OR ci.status::text=$2) ORDER BY COALESCE(ci.scheduled_at,ci.created_at) DESC LIMIT 500',
      [req.actor!.orgId, status],
    );
    return result.rows;
  });

  app.post('/v1/content', { preHandler: requireRole('editor') }, async (req, reply) => {
    const body = contentCreateSchema.parse(req.body);
    const campaign = await query<{ brand_id: string; requires_approval: boolean; status: string }>(
      'SELECT c.brand_id,c.requires_approval,c.status::text FROM campaigns c JOIN brands br ON br.id=c.brand_id WHERE c.id=$1 AND br.organization_id=$2',
      [body.campaignId, req.actor!.orgId],
    );
    if (!campaign.rowCount) return reply.code(404).send({ error: 'not_found', message: 'Campaign not found' });
    if (body.socialAccountId && !(await accountMatchesBrandPlatform(body.socialAccountId, campaign.rows[0]!.brand_id, body.platform))) {
      return reply.code(400).send({ error: 'account_mismatch', message: 'Social account must belong to the campaign brand and match the content platform' });
    }
    const status = campaign.rows[0]!.requires_approval
      ? 'pending_approval'
      : body.scheduledAt && body.socialAccountId && campaign.rows[0]!.status === 'active'
        ? 'scheduled'
        : 'approved';
    const result = await query<{ id: string }>(
      'INSERT INTO content_items(campaign_id,social_account_id,platform,body,media_urls,status,scheduled_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
      [body.campaignId, body.socialAccountId ?? null, body.platform, body.body, JSON.stringify(body.mediaUrls), status, body.scheduledAt ?? null, req.actor!.userId],
    );
    if (status === 'scheduled') await syncPublishJob(result.rows[0]!.id, body.scheduledAt!);
    await audit(req, 'content.create', 'content', result.rows[0]!.id, { platform: body.platform, status });
    return { id: result.rows[0]!.id, status };
  });

  app.patch('/v1/content/:id', { preHandler: requireRole('editor') }, async (req, reply) => {
    const id = z.string().uuid().parse((req.params as { id: string }).id);
    const body = z.object({
      body: z.string().min(1).max(10000).optional(),
      mediaUrls: z.array(z.string().url()).optional(),
      socialAccountId: z.string().uuid().nullable().optional(),
      scheduledAt: z.string().datetime().nullable().optional(),
    }).parse(req.body);
    const existing = await query<{
      brand_id: string;
      platform: Platform;
      status: string;
      social_account_id: string | null;
      scheduled_at: string | null;
      campaign_status: string;
    }>(
      'SELECT br.id brand_id,ci.platform,ci.status::text,ci.social_account_id,ci.scheduled_at,c.status::text campaign_status FROM content_items ci JOIN campaigns c ON c.id=ci.campaign_id JOIN brands br ON br.id=c.brand_id WHERE ci.id=$1 AND br.organization_id=$2',
      [id, req.actor!.orgId],
    );
    if (!existing.rowCount) return reply.code(404).send({ error: 'not_found', message: 'Content not found' });
    if (['publishing', 'published'].includes(existing.rows[0]!.status)) {
      return reply.code(409).send({ error: 'immutable_state', message: 'Publishing or published content cannot be edited' });
    }
    if (body.socialAccountId && !(await accountMatchesBrandPlatform(body.socialAccountId, existing.rows[0]!.brand_id, existing.rows[0]!.platform))) {
      return reply.code(400).send({ error: 'account_mismatch', message: 'Social account must belong to the campaign brand and match the content platform' });
    }
    await query(
      'UPDATE content_items SET body=COALESCE($2,body),media_urls=CASE WHEN $3::boolean THEN $4::jsonb ELSE media_urls END,social_account_id=CASE WHEN $5::boolean THEN $6::uuid ELSE social_account_id END,scheduled_at=CASE WHEN $7::boolean THEN $8::timestamptz ELSE scheduled_at END,updated_at=now() WHERE id=$1',
      [
        id,
        body.body ?? null,
        Object.prototype.hasOwnProperty.call(body, 'mediaUrls'),
        body.mediaUrls ? JSON.stringify(body.mediaUrls) : null,
        Object.prototype.hasOwnProperty.call(body, 'socialAccountId'),
        body.socialAccountId ?? null,
        Object.prototype.hasOwnProperty.call(body, 'scheduledAt'),
        body.scheduledAt ?? null,
      ],
    );
    const effectiveAccount = Object.prototype.hasOwnProperty.call(body, 'socialAccountId') ? body.socialAccountId ?? null : existing.rows[0]!.social_account_id;
    const effectiveSchedule = Object.prototype.hasOwnProperty.call(body, 'scheduledAt') ? body.scheduledAt ?? null : existing.rows[0]!.scheduled_at;
    let nextStatus = existing.rows[0]!.status;
    if (['approved', 'scheduled', 'failed'].includes(nextStatus)) {
      nextStatus = effectiveAccount && effectiveSchedule && existing.rows[0]!.campaign_status === 'active' ? 'scheduled' : 'approved';
      await query('UPDATE content_items SET status=$2,updated_at=now() WHERE id=$1', [id, nextStatus]);
    }
    if (nextStatus === 'scheduled') await syncPublishJob(id, effectiveSchedule);
    else await syncPublishJob(id, null);
    await audit(req, 'content.update', 'content', id, { fields: Object.keys(body), status: nextStatus });
    return { id, status: nextStatus };
  });

  app.post('/v1/content/:id/approve', { preHandler: requireRole('approver') }, async (req, reply) => {
    const id = z.string().uuid().parse((req.params as { id: string }).id);
    const body = z.object({
      decision: z.enum(['approved', 'rejected']),
      note: z.string().max(2000).optional(),
      scheduledAt: z.string().datetime().optional(),
    }).parse(req.body);
    const item = await query<{ social_account_id: string | null; scheduled_at: string | null; campaign_status: string }>(
      'SELECT ci.social_account_id,ci.scheduled_at,c.status::text campaign_status FROM content_items ci JOIN campaigns c ON c.id=ci.campaign_id JOIN brands br ON br.id=c.brand_id WHERE ci.id=$1 AND br.organization_id=$2',
      [id, req.actor!.orgId],
    );
    if (!item.rowCount) return reply.code(404).send({ error: 'not_found', message: 'Content not found' });
    const effectiveSchedule = body.scheduledAt ?? item.rows[0]!.scheduled_at;
    const newStatus = body.decision === 'rejected'
      ? 'rejected'
      : effectiveSchedule && item.rows[0]!.social_account_id && item.rows[0]!.campaign_status === 'active'
        ? 'scheduled'
        : 'approved';
    await query('UPDATE content_items SET status=$2,scheduled_at=COALESCE($3,scheduled_at),updated_at=now() WHERE id=$1', [id, newStatus, body.scheduledAt ?? null]);
    await query('INSERT INTO approvals(content_item_id,decided_by,decision,note,decided_at) VALUES($1,$2,$3,$4,now())', [id, req.actor!.userId, body.decision, body.note ?? null]);
    if (newStatus === 'scheduled') await syncPublishJob(id, effectiveSchedule);
    else await syncPublishJob(id, null);
    await audit(req, 'content.approval', 'content', id, body);
    return { id, status: newStatus };
  });

  app.post('/v1/content/:id/publish', { preHandler: requireRole('editor') }, async (req, reply) => {
    const id = z.string().uuid().parse((req.params as { id: string }).id);
    const item = await query<{ id: string; social_account_id: string; posting_enabled: boolean }>(
      "SELECT ci.id,ci.social_account_id,sa.posting_enabled FROM content_items ci JOIN campaigns c ON c.id=ci.campaign_id JOIN brands br ON br.id=c.brand_id JOIN social_accounts sa ON sa.id=ci.social_account_id AND sa.brand_id=c.brand_id AND sa.platform=ci.platform WHERE ci.id=$1 AND br.organization_id=$2 AND c.status='active' AND ci.status IN ('approved','scheduled','failed')",
      [id, req.actor!.orgId],
    );
    if (!item.rowCount) return reply.code(409).send({ error: 'invalid_state', message: 'Content is not publishable, has no valid account, or its campaign is not active' });
    if (!item.rows[0]!.posting_enabled) return reply.code(409).send({ error: 'posting_disabled', message: 'Posting is disabled for this social account' });
    const job = await syncPublishJob(id, new Date());
    await audit(req, 'content.publish_requested', 'content', id, { jobId: job?.id });
    return reply.code(202).send({ jobId: job?.id });
  });

  app.get('/v1/agents', { preHandler: authenticate }, async (req) =>
    (await query('SELECT ap.* FROM agent_profiles ap JOIN brands b ON b.id=ap.brand_id WHERE b.organization_id=$1 ORDER BY ap.created_at DESC', [req.actor!.orgId])).rows,
  );

  app.post('/v1/agents', { preHandler: requireRole('admin') }, async (req, reply) => {
    const body = agentCreateSchema.parse(req.body);
    const owned = await query('SELECT 1 FROM brands WHERE id=$1 AND organization_id=$2', [body.brandId, req.actor!.orgId]);
    if (!owned.rowCount) return reply.code(404).send({ error: 'not_found', message: 'Brand not found' });
    const result = await query<{ id: string }>(
      'INSERT INTO agent_profiles(brand_id,name,kind,instructions,model,enabled) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
      [body.brandId, body.name, body.kind, body.instructions, body.model, body.enabled],
    );
    await audit(req, 'agent.create', 'agent', result.rows[0]!.id);
    return { id: result.rows[0]!.id };
  });

  app.patch('/v1/agents/:id/enabled', { preHandler: requireRole('admin') }, async (req, reply) => {
    const id = z.string().uuid().parse((req.params as { id: string }).id);
    const body = z.object({ enabled: z.boolean() }).parse(req.body);
    const result = await query(
      'UPDATE agent_profiles ap SET enabled=$3,updated_at=now() FROM brands br WHERE ap.brand_id=br.id AND ap.id=$1 AND br.organization_id=$2 RETURNING ap.id',
      [id, req.actor!.orgId, body.enabled],
    );
    if (!result.rowCount) return reply.code(404).send({ error: 'not_found', message: 'Agent not found' });
    await audit(req, 'agent.enabled', 'agent', id, body);
    return { id, enabled: body.enabled };
  });

  app.get('/v1/social-accounts', { preHandler: authenticate }, async (req) =>
    (await query('SELECT sa.id,sa.brand_id,sa.platform,sa.handle,sa.external_account_id,sa.posting_enabled,sa.status,sa.last_sync_at,sa.created_at FROM social_accounts sa JOIN brands b ON b.id=sa.brand_id WHERE b.organization_id=$1 ORDER BY sa.created_at DESC', [req.actor!.orgId])).rows,
  );

  app.post('/v1/social-accounts', { preHandler: requireRole('admin') }, async (req, reply) => {
    const body = socialAccountCreateSchema.parse(req.body);
    const owned = await query('SELECT 1 FROM brands WHERE id=$1 AND organization_id=$2', [body.brandId, req.actor!.orgId]);
    if (!owned.rowCount) return reply.code(404).send({ error: 'not_found', message: 'Brand not found' });
    const result = await query<{ id: string }>(
      'INSERT INTO social_accounts(brand_id,platform,handle,external_account_id,encrypted_credentials,posting_enabled) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
      [body.brandId, body.platform, body.handle, body.externalAccountId, encryptJson(body.credentials), body.postingEnabled],
    );
    await audit(req, 'social_account.create', 'social_account', result.rows[0]!.id, { platform: body.platform, handle: body.handle });
    return { id: result.rows[0]!.id };
  });

  app.patch('/v1/social-accounts/:id/credentials', { preHandler: requireRole('admin') }, async (req, reply) => {
    const id = z.string().uuid().parse((req.params as { id: string }).id);
    const body = z.object({ credentials: z.record(z.string(), z.unknown()) }).parse(req.body);
    const result = await query(
      'UPDATE social_accounts sa SET encrypted_credentials=$3,updated_at=now() FROM brands br WHERE sa.brand_id=br.id AND sa.id=$1 AND br.organization_id=$2 RETURNING sa.id',
      [id, req.actor!.orgId, encryptJson(body.credentials)],
    );
    if (!result.rowCount) return reply.code(404).send({ error: 'not_found', message: 'Account not found' });
    await audit(req, 'social_account.credentials_rotated', 'social_account', id);
    return { id };
  });

  app.patch('/v1/social-accounts/:id/posting', { preHandler: requireRole('admin') }, async (req, reply) => {
    const id = z.string().uuid().parse((req.params as { id: string }).id);
    const body = z.object({ enabled: z.boolean() }).parse(req.body);
    const result = await query(
      'UPDATE social_accounts sa SET posting_enabled=$3,updated_at=now() FROM brands br WHERE sa.brand_id=br.id AND sa.id=$1 AND br.organization_id=$2 RETURNING sa.id',
      [id, req.actor!.orgId, body.enabled],
    );
    if (!result.rowCount) return reply.code(404).send({ error: 'not_found', message: 'Account not found' });
    const scheduled = await query<{ id: string; scheduled_at: string }>(
      "SELECT ci.id,ci.scheduled_at FROM content_items ci JOIN campaigns c ON c.id=ci.campaign_id WHERE ci.social_account_id=$1 AND ci.status='scheduled' AND ci.scheduled_at IS NOT NULL AND c.status='active'",
      [id],
    );
    await Promise.all(scheduled.rows.map((item) => syncPublishJob(item.id, body.enabled ? item.scheduled_at : null)));
    await audit(req, 'social_account.posting_toggle', 'social_account', id, body);
    return { id, postingEnabled: body.enabled };
  });

  app.get('/v1/analytics/summary', { preHandler: authenticate }, async (req) => {
    const result = await query(
      "SELECT sa.platform,sa.handle,COALESCE(sum(a.impressions),0) impressions,COALESCE(sum(a.engagements),0) engagements,COALESCE(sum(a.clicks),0) clicks,COALESCE(sum(a.likes),0) likes,COALESCE(sum(a.comments),0) comments,COALESCE(sum(a.shares),0) shares FROM social_accounts sa JOIN brands b ON b.id=sa.brand_id LEFT JOIN analytics_snapshots a ON a.social_account_id=sa.id AND a.captured_at>now()-interval '30 days' WHERE b.organization_id=$1 GROUP BY sa.id,sa.platform,sa.handle ORDER BY impressions DESC",
      [req.actor!.orgId],
    );
    return result.rows;
  });

  app.get('/v1/audit-logs', { preHandler: requireRole('admin') }, async (req) =>
    (await query('SELECT * FROM audit_logs WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 500', [req.actor!.orgId])).rows,
  );
}
