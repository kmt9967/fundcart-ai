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
  for (const migration of ['001_init', '002_direct_purchase', '003_refunds', '004_receipts_accounts', '005_trust_policy_safety', '006_contribution_adjustments']) {
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
