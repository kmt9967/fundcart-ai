import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterAll, beforeAll, expect, it } from 'vitest';

const database = new PGlite({ extensions: { pgcrypto } });
const profile = '10000000-0000-4000-8000-000000000001';
const campaign = '10000000-0000-4000-8000-000000000002';
const order = '10000000-0000-4000-8000-000000000003';

beforeAll(async () => {
  await database.exec('create role anon; create role authenticated; create role service_role;');
  for (const migration of ['001_init', '002_direct_purchase', '003_refunds', '004_receipts_accounts', '005_trust_policy_safety', '006_contribution_adjustments', '007_shopping_persistence']) {
    await database.exec(readFileSync(`db/migrations/${migration}.sql`, 'utf8'));
  }
  await database.query('insert into profiles (id) values ($1)', [profile]);
  await database.query("insert into campaigns (id, slug, owner_id, creator_name, title, story, item_price_cents, target_cents, status) values ($1,'fixture',$2,'Alias','Fixture','Fixture',1000,1000,'goal_reached')", [campaign, profile]);
  await database.query("insert into payment_orders (id, kind, campaign_id, user_id, paypal_order_id, amount_cents, capture_id) values ($1,'contribution',$2,$3,'ORDER',1000,'CAPTURE')", [order, campaign, profile]);
  await database.query("insert into contributions (campaign_id, payment_order_id, capture_id, amount_cents) values ($1,$2,'CAPTURE',1000)", [campaign, order]);
}, 25000);
afterAll(() => database.close());

async function adjust(event: string, resource: string, cents: number, reversed = false, currency = 'USD', capture = 'CAPTURE') {
  const result = await database.query<{ outcome: string }>('select apply_contribution_adjustment($1,$2,$3,$4,$5,$6) as outcome', [event, resource, capture, currency, cents, reversed]);
  return result.rows[0].outcome;
}

it('WC-125 to WC-129 records adjustments atomically, deduplicates, and preserves reversal state', async () => {
  expect(await adjust('too-soon', 'refund', 100, false, 'USD', 'MISSING')).toBe('missing');
  expect(await adjust('incorrect-currency', 'refund', 100, false, 'EUR')).toBe('mismatch');
  await database.exec("create function reject_update() returns trigger language plpgsql as $$ begin raise exception 'fixture write failure'; end $$; create trigger reject_update before insert on campaign_updates for each row execute function reject_update();");
  await expect(adjust('first', 'refund-one', 125)).rejects.toThrow('fixture write failure');
  const rolledBack = await database.query("select paypal_event_id from payment_events where paypal_event_id = 'first'");
  expect(rolledBack.rows).toHaveLength(0);
  await database.exec('drop trigger reject_update on campaign_updates; drop function reject_update();');

  expect(await adjust('first', 'refund-one', 125)).toBe('applied');
  expect(await adjust('first', 'refund-one', 125)).toBe('duplicate');
  expect(await adjust('redelivery', 'refund-one', 125)).toBe('duplicate');
  expect(await adjust('second', 'refund-two', 75)).toBe('applied');
  expect((await database.query('select status, refunded_cents from contributions')).rows).toEqual([{ status: 'COMPLETED', refunded_cents: 200 }]);
  expect((await database.query('select status from campaigns')).rows).toEqual([{ status: 'active' }]);
  expect(await adjust('full', 'refund-three', 800)).toBe('applied');
  expect((await database.query('select status from contributions')).rows).toEqual([{ status: 'REFUNDED' }]);
  expect(await adjust('reverse', 'CAPTURE', 1000, true)).toBe('applied');
  expect(await adjust('late', 'refund-four', 50)).toBe('unchanged');
  expect((await database.query('select status, refunded_cents from contributions')).rows).toEqual([{ status: 'REVERSED', refunded_cents: 1000 }]);
});

it('WC-103 applies least privilege and service execution and denies public adjustment writes', async () => {
  const name = 'public.apply_contribution_adjustment(text,text,text,text,bigint,boolean)';
  const result = await database.query('select has_function_privilege($1,$3,$4) as anon, has_function_privilege($2,$3,$4) as service', ['anon', 'service_role', name, 'EXECUTE']);
  expect(result.rows).toEqual([{ anon: false, service: true }]);
  await database.exec('set role service_role');
  try {
    expect(await adjust('service-check', 'refund', 100, false, 'USD', 'MISSING')).toBe('missing');
  } finally {
    await database.exec('reset role');
  }
});


it('removes all connected owned turns and protects historical offer snapshots', async () => {
  const root = '40000000-0000-4000-8000-000000000001';
  const child = '40000000-0000-4000-8000-000000000002';
  const sibling = '40000000-0000-4000-8000-000000000003';
  const separate = '40000000-0000-4000-8000-000000000004';
  const insert = (id: string, parent: string | null) => database.query(
    "insert into ai_sessions (id,user_id,prompt,result) values ($1,$2,'private prompt',$3::jsonb)", [id, profile, JSON.stringify({ kind: 'results', parent, offers: [{ priceCents: 995 }] })]);
  await insert(root, null);
  await insert(child, root);
  await insert(sibling, root);
  await insert(separate, null);
  await database.query("insert into agent_events(session_id,agent,step) values ($1,'Shopping','private query')", [root]);
  await database.query("insert into agent_events(session_id,campaign_id,agent,step) values ($1,$2,'Campaign','campaign audit')", [root, campaign]);
  await expect(database.query('delete from agent_events where session_id = $1', [root])).rejects.toThrow('append-only');
  await expect(database.query("update ai_sessions set result = jsonb_set(result,'{offers}','[]') where id = $1", [root])).rejects.toThrow('immutable');
  const denied = await database.query('select remove_shopping_thread($1,$2) as removed', [campaign, child]);
  expect(denied.rows).toEqual([{ removed: 0 }]);
  expect((await database.query('select remove_shopping_thread($1,$2) as removed', [profile, child])).rows).toEqual([{ removed: 3 }]);
  expect((await database.query("select count(*)::int as count from ai_sessions where prompt = 'private prompt'")).rows).toEqual([{ count: 1 }]);
  expect((await database.query('select step from agent_events where session_id = $1', [root])).rows).toEqual([{ step: 'campaign audit' }]);
  await expect(database.query("insert into agent_events(session_id,agent,step) values ($1,'Shopping','late query')", [root])).rejects.toThrow('cannot be restored');
  await expect(insert('40000000-0000-4000-8000-000000000005', child)).rejects.toThrow('unavailable');
});

it('keeps bundle names account-scoped and denies public data access', async () => {
  const another = '10000000-0000-4000-8000-000000000009';
  await database.query('insert into profiles(id) values ($1)', [another]);
  const insert = (owner: string) => database.query(
    "insert into saved_shopping_bundles (owner_id,kit_id,name,selections) values ($1,'home_office','My setup','[]')", [owner]);
  await insert(profile);
  await insert(another);
  await expect(insert(profile)).rejects.toMatchObject({ code: '23505' });
  const rights = await database.query("select has_table_privilege('authenticated','public.saved_shopping_bundles','SELECT') as public_read, has_table_privilege('service_role','public.saved_shopping_bundles','SELECT') as server_read");
  expect(rights.rows).toEqual([{ public_read: false, server_read: true }]);
});
