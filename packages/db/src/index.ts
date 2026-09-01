import { Pool, type PoolClient, type QueryResultRow } from 'pg';

let pool: Pool | undefined;

export function db(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is required');
    pool = new Pool({
      connectionString,
      max: Number(process.env.DB_POOL_MAX ?? 20),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 10_000),
    });
    pool.on('error', (err) => console.error('postgres pool error', err));
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  return db().query<T>(text, params);
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
