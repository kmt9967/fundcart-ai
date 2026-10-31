// Apply db/migrations/*.sql in order via the Supabase session pooler (IPv4). Usage: node scripts/migrate.mjs
import fs from 'node:fs'; import path from 'node:path'; import pg from 'pg';
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const ref = new URL(env.SUPABASE_URL).hostname.split('.')[0];
const hosts = (process.env.PG_HOSTS || 'aws-0-us-west-2.pooler.supabase.com,aws-1-us-west-2.pooler.supabase.com').split(',');
let client;
for (const host of hosts) {
  const c = new pg.Client({ host, port: 5432, user: `postgres.${ref}`, password: env.SUPABASE_DB_PASSWORD, database: 'postgres', ssl: { rejectUnauthorized: false } });
  try { await c.connect(); client = c; console.log('connected via', host); break; } catch (e) { console.log('fail', host, e.message); }
}
if (!client) process.exit(1);
await client.query(`create table if not exists _migrations (name text primary key, applied_at timestamptz default now())`);
for (const f of fs.readdirSync('db/migrations').filter(f => f.endsWith('.sql')).sort()) {
  const done = await client.query('select 1 from _migrations where name=$1', [f]);
  if (done.rowCount) { console.log('skip', f); continue; }
  await client.query('begin'); try { await client.query(fs.readFileSync(path.join('db/migrations', f), 'utf8')); await client.query('insert into _migrations(name) values($1)', [f]); await client.query('commit'); console.log('applied', f); } catch (e) { await client.query('rollback'); console.error('FAILED', f, e.message); process.exit(1); }
}
await client.query('alter table _migrations enable row level security');
await client.end();
