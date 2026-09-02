// Standalone end-to-end smoke test against a running Spheric Agents API.
// Usage: node scripts/live-test.mjs
// Env: API_URL (default http://localhost:4000), TEST_EMAIL, TEST_PASSWORD

const API = process.env.API_URL ?? 'http://localhost:4000';
const EMAIL = process.env.TEST_EMAIL ?? 'admin@spheric.local';
const PASSWORD = process.env.TEST_PASSWORD;

if (!PASSWORD) {
  console.error('Set TEST_PASSWORD env var to the seed admin password before running this script.');
  process.exit(1);
}

const results = [];
function log(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${step}${detail ? ' :: ' + detail : ''}`);
}

async function call(path, opts = {}, token) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      ...(opts.body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const text = await r.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: r.status, json };
}

async function main() {
  console.log(`\nTesting against ${API}\n`);

  // 1. Health check
  const health = await call('/health');
  log('API /health', health.status === 200 && health.json?.ok === true, JSON.stringify(health.json));

  // 2. Login
  const login = await call('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  log('Login', login.status === 200 && !!login.json?.accessToken, login.status === 200 ? `role=${login.json.user.role}` : JSON.stringify(login.json));
  if (login.status !== 200) { printReport(); process.exit(1); }
  const token = login.json.accessToken;

  // 3. Brands
  const brands = await call('/v1/brands', {}, token);
  log('List brands', brands.status === 200 && Array.isArray(brands.json), `count=${brands.json?.length}`);
  const brandId = brands.json?.[0]?.id;
  if (!brandId) { log('Brand available', false, 'no brand found - cannot continue'); printReport(); process.exit(1); }
  log('Brand available', true, `brandId=${brandId}`);

  // 4. Agents configured for this brand
  const agents = await call('/v1/agents', {}, token);
  log('List agents', agents.status === 200 && Array.isArray(agents.json), `count=${agents.json?.length}, enabled=${agents.json?.filter(a=>a.enabled).length}`);

  // 5. Create a test campaign
  const now = new Date();
  const start = new Date(now.getTime() + 60_000).toISOString();
  const end = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const create = await call('/v1/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      brandId,
      name: `Live test ${now.toISOString()}`,
      objective: 'Validate that AI content generation works end to end after deployment fixes.',
      audience: 'Internal QA / deployment verification',
      startAt: start,
      endAt: end,
      platforms: ['x', 'linkedin'],
      postsPerPlatform: 2,
      requiresApproval: true,
    }),
  }, token);
  log('Create campaign', create.status === 200 && !!create.json?.id, JSON.stringify(create.json));
  if (create.status !== 200) { printReport(); process.exit(1); }
  const campaignId = create.json.id;

  // 6. Trigger generation
  const gen = await call(`/v1/campaigns/${campaignId}/generate`, { method: 'POST' }, token);
  log('Trigger generate', gen.status === 202 && !!gen.json?.jobId, JSON.stringify(gen.json));

  // 7. Poll content for this campaign (worker runs async)
  console.log('\nWaiting for the worker to generate content (polling for up to 90s)...\n');
  let items = [];
  for (let i = 0; i < 18; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const content = await call('/v1/content', {}, token);
    if (content.status === 200 && Array.isArray(content.json)) {
      items = content.json.filter((c) => c.campaign_id === campaignId);
      if (items.length > 0) break;
    }
    process.stdout.write(`  ...poll ${i + 1}/18, items so far: ${items.length}\n`);
  }
  log('Content generated', items.length > 0, `items=${items.length}`);
  for (const item of items) {
    console.log(`  - platform=${item.platform} status=${item.status} body="${String(item.body ?? '').slice(0, 90).replace(/\n/g, ' ')}..."`);
  }

  // 8. Dashboard summary
  const dash = await call('/v1/dashboard', {}, token);
  log('Dashboard summary', dash.status === 200, JSON.stringify(dash.json));

  printReport();
}

function printReport() {
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n==== SUMMARY: ${passed}/${results.length} checks passed ====`);
  for (const r of results) console.log(`  [${r.ok ? 'OK' : 'FAIL'}] ${r.step}`);
}

main().catch((e) => { console.error('Test script crashed:', e); process.exit(1); });
