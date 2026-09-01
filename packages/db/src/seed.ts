import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { query, closeDb } from './index.js';

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(here, '..', '..', '..', '.env') });

const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
if (!email || !password) throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD required');

const passwordHash = await bcrypt.hash(password, 12);
const user = await query<{ id: string }>(
  'INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash RETURNING id',
  [email, passwordHash, 'Spheric Admin'],
);
const org = await query<{ id: string }>(
  'INSERT INTO organizations(name,slug) VALUES($1,$2) ON CONFLICT(slug) DO UPDATE SET name=excluded.name RETURNING id',
  ['SPHERIC MEDIA', 'spheric-media'],
);
await query(
  "INSERT INTO memberships(user_id,organization_id,role) VALUES($1,$2,'owner') ON CONFLICT(user_id,organization_id) DO UPDATE SET role='owner'",
  [user.rows[0]!.id, org.rows[0]!.id],
);
const brand = await query<{ id: string }>(
  'INSERT INTO brands(organization_id,name,slug,voice,knowledge_base) VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id,slug) DO UPDATE SET voice=excluded.voice RETURNING id',
  [
    org.rows[0]!.id,
    'Spheric Agents',
    'spheric-agents',
    'Authoritative, concise, factual, useful. Prefer primary sources and avoid hype.',
    JSON.stringify({ researchQueries: ['agentic media infrastructure', 'social platform API and policy changes'] }),
  ],
);

const defaults = [
  ['Research Desk', 'research', 'Prioritize primary sources. Separate confirmed facts, claims, and interpretation. Surface source conflicts.', 'gpt-5.6-terra'],
  ['Campaign Strategist', 'strategy', 'Translate campaign goals into platform-native editorial angles. Optimize for useful audience value rather than vanity engagement.', 'gpt-5.6-terra'],
  ['Copy Desk', 'copywriter', 'Write concise platform-native copy in the approved brand voice. Never invent facts or partnerships.', 'gpt-5.6-terra'],
  ['Compliance Gate', 'compliance', 'Escalate financial, security, partnership, legal, political, or unusually strong factual claims for human approval.', 'gpt-5.6-terra'],
  ['Analytics Desk', 'analytics', 'Evaluate performance using business outcomes, quality engagement, clicks, conversions and retention; do not recommend artificial engagement.', 'gpt-5.6-terra'],
  ['Scheduler', 'scheduler', 'Distribute approved content across campaign windows without burst spam and respect account-level posting controls.', 'gpt-5.6-terra'],
] as const;
for (const [name, kind, instructions, model] of defaults) {
  await query(
    'INSERT INTO agent_profiles(brand_id,name,kind,instructions,model,enabled) VALUES($1,$2,$3,$4,$5,true) ON CONFLICT(brand_id,name) DO UPDATE SET kind=excluded.kind,instructions=excluded.instructions,model=excluded.model',
    [brand.rows[0]!.id, name, kind, instructions, model],
  );
}

console.log(JSON.stringify({ userId: user.rows[0]!.id, organizationId: org.rows[0]!.id, brandId: brand.rows[0]!.id }, null, 2));
await closeDb();
