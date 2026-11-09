-- 004: private supporter receipts, optional creator accounts.
-- Additive only: no existing rows are changed, no columns dropped.

-- Supporter email for a verified-payment receipt. Server-only (RLS on, no policies): never exposed
-- through public queries, campaign pages or the creator dashboard.
create table if not exists supporter_receipts (
  id uuid primary key default gen_random_uuid(),
  payment_order_id uuid not null unique references payment_orders(id),
  email text not null check (char_length(email) between 3 and 254),
  locale text not null default 'en' check (locale in ('en','ur','es','fr')),
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','disabled')),
  attempts integer not null default 0,
  provider text,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table supporter_receipts enable row level security;
revoke all on supporter_receipts from anon, authenticated;

-- Optional creator accounts (Supabase Auth). A guest profile becomes an account profile when its
-- owner signs in from the browser that holds the signed guest cookie (proof of possession).
alter table profiles add column if not exists auth_user_id uuid unique;
alter table profiles add column if not exists email text;
