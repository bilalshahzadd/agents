import 'dotenv/config';
import IORedis from 'ioredis';
import { Queue, Worker } from 'bullmq';
import { closeDb, query, transaction } from '@spheric/db';
import { queueNames, type Platform } from '@spheric/shared';
import { complianceReview, generateCampaignContent, researchBrief } from '@spheric/agents';
import { connectorFor } from '@spheric/connectors';
import crypto from 'node:crypto';

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error('REDIS_URL is required');
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
const publishQueue = new Queue(queueNames.publish, { connection });
const agentScheduler = new Queue(queueNames.agent, { connection });

function decrypt<T = Record<string, unknown>>(value: string): T {
  const key = Buffer.from(process.env.DATA_ENCRYPTION_KEY ?? '', 'base64');
  if (key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must decode to 32 bytes');
  const buffer = Buffer.from(value, 'base64');
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')) as T;
}

async function enabledAgent(brandId: string, kinds: string[]) {
  const result = await query<{ instructions: string; model: string; kind: string }>(
    'SELECT instructions,model,kind FROM agent_profiles WHERE brand_id=$1 AND enabled=true AND kind=ANY($2::text[]) ORDER BY created_at LIMIT 1',
    [brandId, kinds],
  );
  return result.rows[0];
}

async function runResearch(brand: any, queryText: string) {
  const profile = await enabledAgent(brand.id, ['research', 'strategy']);
  const brief = await researchBrief({
    brandName: brand.name,
    query: queryText,
    knowledge: brand.knowledge_base,
    guidance: profile?.instructions,
    model: profile?.model,
  });
  const inserted = await query<{ id: string }>(
    'INSERT INTO research_briefs(brand_id,title,query,summary,source_payload) VALUES($1,$2,$3,$4,$5) RETURNING id',
    [brand.id, brief.title, queryText, brief.summary, JSON.stringify(brief.raw)],
  );
  return inserted.rows[0]!.id;
}

const agentWorker = new Worker(
  queueNames.agent,
  async (job) => {
    if (job.name === 'research-all-brands') {
      const brands = await query<any>('SELECT * FROM brands ORDER BY created_at');
      for (const brand of brands.rows) {
        const researchQueries = Array.isArray(brand.knowledge_base?.researchQueries)
          ? brand.knowledge_base.researchQueries
          : [`${brand.name} latest product, market, developer and community developments`];
        for (const researchQuery of researchQueries.slice(0, 3)) await runResearch(brand, String(researchQuery));
      }
      return { brands: brands.rowCount };
    }

    if (job.name === 'research-brand') {
      const { brandId, queryText } = job.data as { brandId: string; queryText?: string };
      const brandResult = await query<any>('SELECT * FROM brands WHERE id=$1', [brandId]);
      if (!brandResult.rowCount) throw new Error('brand missing');
      const brand = brandResult.rows[0];
      const researchQuery = String(queryText ?? `${brand.name} latest product, market, developer and community developments`);
      return { id: await runResearch(brand, researchQuery) };
    }

    if (job.name !== 'generate-campaign') return;
    const { campaignId, actorUserId } = job.data as { campaignId: string; actorUserId: string };
    const campaignResult = await query<any>(
      'SELECT c.*,b.name brand_name,b.voice,b.knowledge_base FROM campaigns c JOIN brands b ON b.id=c.brand_id WHERE c.id=$1',
      [campaignId],
    );
    if (!campaignResult.rowCount) throw new Error('campaign missing');
    const campaign = campaignResult.rows[0];

    const editorial = await enabledAgent(campaign.brand_id, ['strategy', 'copywriter']);
    const compliance = await enabledAgent(campaign.brand_id, ['compliance']);
    const items = await generateCampaignContent({
      brandName: campaign.brand_name,
      voice: campaign.voice,
      objective: campaign.objective,
      audience: campaign.audience,
      platforms: campaign.platforms as Platform[],
      postsPerPlatform: campaign.posts_per_platform,
      knowledge: campaign.knowledge_base,
      guidance: editorial?.instructions,
      model: editorial?.model,
    });

    const reviewed = [] as Array<{
      platform: Platform;
      body: string;
      allowed: boolean;
      risk: 'low' | 'medium' | 'high';
      accountId: string | null;
      scheduledAt: string;
    }>;
    const start = Math.max(Date.now() + 5 * 60_000, new Date(campaign.start_at).getTime());
    const end = Math.max(start, new Date(campaign.end_at).getTime());

    for (let index = 0; index < items.length; index++) {
      const item = items[index]!;
      const review = await complianceReview({
        body: item.body,
        brandName: campaign.brand_name,
        guidance: compliance?.instructions,
        model: compliance?.model,
      });
      const account = await query<{ id: string }>(
        "SELECT id FROM social_accounts WHERE brand_id=$1 AND platform=$2 AND status='connected' ORDER BY posting_enabled DESC,created_at LIMIT 1",
        [campaign.brand_id, item.platform],
      );
      reviewed.push({
        platform: item.platform,
        body: item.body,
        allowed: review.allowed,
        risk: review.risk,
        accountId: account.rows[0]?.id ?? null,
        scheduledAt: new Date(start + ((end - start) * index) / Math.max(1, items.length - 1)).toISOString(),
      });
    }

    const inserted = await transaction(async (client) => {
      const result: Array<{ id: string; status: string; accountId: string | null; scheduledAt: string }> = [];
      for (const item of reviewed) {
        const status = !item.allowed
          ? 'rejected'
          : campaign.requires_approval || item.risk !== 'low'
            ? 'pending_approval'
            : item.accountId
              ? 'scheduled'
              : 'approved';
        const row = await client.query<{ id: string }>(
          'INSERT INTO content_items(campaign_id,social_account_id,platform,body,status,scheduled_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',
          [campaignId, item.accountId, item.platform, item.body, status, item.scheduledAt, actorUserId],
        );
        result.push({ id: row.rows[0]!.id, status, accountId: item.accountId, scheduledAt: item.scheduledAt });
      }
      await client.query("UPDATE campaigns SET status='active',updated_at=now() WHERE id=$1", [campaignId]);
      return result;
    });

    for (const item of inserted) {
      if (item.status === 'scheduled' && item.accountId) {
        await publishQueue.add(
          'publish-content',
          { contentItemId: item.id },
          {
            delay: Math.max(0, new Date(item.scheduledAt).getTime() - Date.now()),
            jobId: `content-${item.id}`,
            removeOnComplete: true,
            removeOnFail: 5000,
          },
        );
      }
    }
    return { created: inserted.length };
  },
  { connection, concurrency: Number(process.env.AGENT_WORKER_CONCURRENCY ?? 3) },
);

const publishWorker = new Worker(
  queueNames.publish,
  async (job) => {
    if (job.name !== 'publish-content') return;
    const { contentItemId } = job.data as { contentItemId: string };
    const result = await query<any>(
      `SELECT ci.*,c.status::text campaign_status,sa.encrypted_credentials,sa.posting_enabled,sa.handle
       FROM content_items ci
       JOIN campaigns c ON c.id=ci.campaign_id
       LEFT JOIN social_accounts sa ON sa.id=ci.social_account_id AND sa.brand_id=c.brand_id AND sa.platform=ci.platform AND sa.status='connected'
       WHERE ci.id=$1`,
      [contentItemId],
    );
    if (!result.rowCount) throw new Error('content missing');
    const item = result.rows[0];
    if (item.campaign_status !== 'active') return { skipped: 'campaign-not-active' };
    if (!['approved', 'scheduled', 'failed'].includes(item.status)) return { skipped: `content-state-${item.status}` };
    if (!item.social_account_id || !item.encrypted_credentials) {
      await query("UPDATE content_items SET status='approved',updated_at=now() WHERE id=$1", [contentItemId]);
      return { skipped: 'no-valid-social-account' };
    }
    if (!item.posting_enabled) return { skipped: 'posting-disabled' };

    await query("UPDATE content_items SET status='publishing',failure_reason=NULL,updated_at=now() WHERE id=$1", [contentItemId]);
    try {
      const connector = connectorFor(item.platform, decrypt(item.encrypted_credentials));
      const output = await connector.publish({ body: item.body, mediaUrls: item.media_urls });
      await query(
        "UPDATE content_items SET status='published',published_at=now(),external_post_id=$2,external_url=$3,updated_at=now() WHERE id=$1",
        [contentItemId, output.id, output.url ?? null],
      );
      return output;
    } catch (error) {
      await query("UPDATE content_items SET status='failed',failure_reason=$2,updated_at=now() WHERE id=$1", [contentItemId, String(error)]);
      throw error;
    }
  },
  {
    connection,
    concurrency: Number(process.env.PUBLISH_WORKER_CONCURRENCY ?? 5),
    limiter: { max: Number(process.env.PUBLISH_RATE_MAX ?? 30), duration: Number(process.env.PUBLISH_RATE_WINDOW_MS ?? 60_000) },
  },
);

const analyticsWorker = new Worker(
  queueNames.analytics,
  async (job) => {
    if (job.name !== 'sync-account') return;
    const { socialAccountId } = job.data as { socialAccountId: string };
    await query('UPDATE social_accounts SET last_sync_at=now() WHERE id=$1', [socialAccountId]);
    return { ok: true, note: 'Add provider-specific metrics scopes/adapters after platform app approval.' };
  },
  { connection, concurrency: Number(process.env.ANALYTICS_WORKER_CONCURRENCY ?? 5) },
);

if (process.env.AUTO_RESEARCH_ENABLED === 'true') {
  await agentScheduler.upsertJobScheduler(
    'research-all-brands',
    { every: Number(process.env.RESEARCH_INTERVAL_MS ?? 21_600_000) },
    { name: 'research-all-brands', data: {}, opts: { removeOnComplete: 100, removeOnFail: 100 } },
  );
  console.log('research scheduler enabled');
}
console.log('Spheric workers online');

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`worker shutdown: ${signal}`);
  await Promise.allSettled([agentWorker.close(), publishWorker.close(), analyticsWorker.close()]);
  await Promise.allSettled([publishQueue.close(), agentScheduler.close()]);
  await connection.quit();
  await closeDb();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
