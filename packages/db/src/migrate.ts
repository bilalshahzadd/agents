import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { db, closeDb } from './index.js';
const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', 'migrations');
await db().query('CREATE TABLE IF NOT EXISTS schema_migrations (name text primary key, applied_at timestamptz not null default now())');
const done = new Set((await db().query<{name:string}>('SELECT name FROM schema_migrations')).rows.map(r=>r.name));
for (const name of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort()) {
  if (done.has(name)) continue;
  const client = await db().connect();
  try {
    await client.query('BEGIN');
    await client.query(await readFile(join(dir,name),'utf8'));
    await client.query('INSERT INTO schema_migrations(name) VALUES($1)',[name]);
    await client.query('COMMIT');
    console.log('applied', name);
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}
await closeDb();
