-- FundCart AI — initial schema.
-- All tables are accessed only from server-side code with the Supabase secret key.
-- RLS is enabled on every table with NO policies, so the public/anon role can read nothing directly.

create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key,
  display_name text not null default 'Guest',
  created_at timestamptz not null default now()
);

-- Snapshot of a product exactly as Channel3 returned it at a point in time.
create table if not exists product_snapshots (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'channel3',
  external_id text not null,
  title text not null,
  brand text,
  category text,
  price_cents bigint check (price_cents is null or price_cents >= 0),
  currency text not null default 'USD',
  availability text,
  merchant_domain text,
  offer_url text,
  image_url text,
  key_features jsonb not null default '[]'::jsonb,
  rating numeric,
  rating_count integer,
  raw jsonb,
  fetched_at timestamptz not null default now()
);
create index if not exists product_snapshots_external_idx on product_snapshots (source, external_id, fetched_at desc);

-- Cached search responses (to conserve API credits).
create table if not exists search_cache (
  cache_key text primary key,
  response jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists ai_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  prompt text not null,
  intent jsonb,
  result jsonb,
  model text,
  created_at timestamptz not null default now()
);

-- Append-only agent activity log (human-readable timeline).
create table if not exists agent_events (
  id bigint generated always as identity primary key,
  session_id uuid references ai_sessions(id) on delete cascade,
  campaign_id uuid,
  agent text not null,
  step text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists agent_events_session_idx on agent_events (session_id, id);

create table if not exists wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  product_snapshot_id uuid not null references product_snapshots(id),
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, product_snapshot_id)
);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  owner_id uuid not null references profiles(id),
  creator_name text not null,
  title text not null,
  story text not null,
  category text,
  product_snapshot_id uuid references product_snapshots(id),
  item_price_cents bigint not null check (item_price_cents > 0),
  own_funds_cents bigint not null default 0 check (own_funds_cents >= 0),
  target_cents bigint not null check (target_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  suggested_amounts_cents bigint[] not null default '{}',
  image_url text,
  visibility text not null default 'public' check (visibility in ('public','unlisted')),
  status text not null default 'active' check (status in ('active','goal_reached','purchased','cancelled')),
  allow_overfunding boolean not null default false,
  deadline date,
  is_demo_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists campaign_updates (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  kind text not null default 'update' check (kind in ('update','thank_you','goal_reached','purchase')),
  body text not null,
  ai_generated boolean not null default false,
  created_at timestamptz not null default now()
);

-- One row per PayPal order we create. Status only advances from PayPal-verified responses.
create table if not exists payment_orders (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('contribution','purchase')),
  campaign_id uuid references campaigns(id),
  user_id uuid references profiles(id),
  paypal_order_id text not null unique,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'USD',
  payee_email text,
  status text not null default 'CREATED',
  capture_id text unique,
  capture_status text,
  supporter_name text,
  supporter_message text,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_orders_campaign_idx on payment_orders (campaign_id, kind);

-- Verified contributions only. Inserted exactly once per PayPal capture.
create table if not exists contributions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id),
  payment_order_id uuid not null unique references payment_orders(id),
  capture_id text not null unique,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'USD',
  supporter_name text,
  supporter_message text,
  is_anonymous boolean not null default false,
  status text not null default 'COMPLETED' check (status in ('COMPLETED','REFUNDED','REVERSED')),
  created_at timestamptz not null default now()
);
create index if not exists contributions_campaign_idx on contributions (campaign_id);

-- Append-only log of everything PayPal told us (API responses and webhooks).
create table if not exists payment_events (
  id bigint generated always as identity primary key,
  payment_order_id uuid references payment_orders(id),
  paypal_order_id text,
  source text not null check (source in ('api','webhook','system')),
  event_type text not null,
  paypal_event_id text unique,
  status text,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists payment_events_order_idx on payment_events (paypal_order_id, id);

create table if not exists purchase_approvals (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id),
  user_id uuid not null references profiles(id),
  product_snapshot_id uuid references product_snapshots(id),
  amount_cents bigint not null check (amount_cents > 0),
  approved_text text not null,
  payment_order_id uuid references payment_orders(id),
  created_at timestamptz not null default now()
);

-- Immutability for payment history.
create or replace function forbid_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'append-only table: % on % is not allowed', tg_op, tg_table_name;
end $$;

drop trigger if exists payment_events_immutable on payment_events;
create trigger payment_events_immutable before update or delete on payment_events
  for each row execute function forbid_mutation();
drop trigger if exists agent_events_immutable on agent_events;
create trigger agent_events_immutable before update or delete on agent_events
  for each row execute function forbid_mutation();

-- Verified totals view (only COMPLETED contributions count).
create or replace view campaign_totals as
select c.id as campaign_id,
       coalesce(sum(k.amount_cents) filter (where k.status = 'COMPLETED'), 0)::bigint as raised_cents,
       count(k.id) filter (where k.status = 'COMPLETED')::int as supporter_count
from campaigns c
left join contributions k on k.campaign_id = c.id
group by c.id;

alter table profiles enable row level security;
alter table product_snapshots enable row level security;
alter table search_cache enable row level security;
alter table ai_sessions enable row level security;
alter table agent_events enable row level security;
alter table wishlist_items enable row level security;
alter table campaigns enable row level security;
alter table campaign_updates enable row level security;
alter table payment_orders enable row level security;
alter table contributions enable row level security;
alter table payment_events enable row level security;
alter table purchase_approvals enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on campaign_totals from anon, authenticated;
