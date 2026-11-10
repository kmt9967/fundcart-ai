-- 005: shared rate limits, security events, campaign trust (moderation, reports, verification state,
-- country policy, gap formula), moderator roles, safety/policy audit fields.
-- Additive only: existing campaigns, payments and accounts keep working unchanged.

-- ---------- Shared rate limiting (replaces per-instance memory on Vercel) ----------
create table if not exists rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, window_start)
);
alter table rate_limits enable row level security;
revoke all on rate_limits from anon, authenticated;

-- Atomic fixed-window counter. Buckets are hashed by the app (no raw IPs or emails stored).
create or replace function rate_limit_hit(p_bucket text, p_window_seconds integer, p_limit integer)
returns table (allowed boolean, hits integer, retry_after integer)
language plpgsql security definer set search_path = public as $$
declare
  ws timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  h integer;
begin
  insert into rate_limits (bucket, window_start, hits) values (p_bucket, ws, 1)
  on conflict (bucket, window_start) do update set hits = rate_limits.hits + 1
  returning rate_limits.hits into h;
  if random() < 0.02 then delete from rate_limits where window_start < now() - interval '2 days'; end if;
  return query select h <= p_limit, h,
    greatest(1, ceil(extract(epoch from (ws + make_interval(secs => p_window_seconds) - now()))))::integer;
end $$;
revoke all on function rate_limit_hit(text, integer, integer) from public, anon, authenticated;

-- ---------- Security / abuse events (append-only, no personal data) ----------
create table if not exists security_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  severity text not null default 'info' check (severity in ('info','warn','alert')),
  subject text,              -- hashed bucket or object id, never a raw IP/email
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists security_events_kind_time on security_events (kind, created_at desc);
alter table security_events enable row level security;
revoke all on security_events from anon, authenticated;
drop trigger if exists security_events_immutable on security_events;
create trigger security_events_immutable before update or delete on security_events
  for each row execute function forbid_mutation();

-- ---------- Roles (granted only by an operator in SQL, never by chat or API) ----------
alter table profiles add column if not exists role text not null default 'user';
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('user','moderator','admin'));
-- True only when Supabase confirmed the address through its own email link (never set by the demo sign-up).
alter table profiles add column if not exists email_verified boolean not null default false;

-- ---------- Verification references (documents never stored here; no provider connected yet) ----------
create table if not exists verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  kind text not null check (kind in ('identity','need','address')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  provider text,
  provider_ref text,
  reviewed_by uuid references profiles(id),
  second_reviewer uuid references profiles(id),
  decided_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (second_reviewer is null or second_reviewer <> reviewed_by)
);
alter table verifications enable row level security;
revoke all on verifications from anon, authenticated;

-- ---------- Campaign trust fields ----------
alter table campaigns add column if not exists country text check (country is null or country ~ '^[A-Z]{2}$');
alter table campaigns add column if not exists need_category text;
alter table campaigns add column if not exists ranking_mode text not null default 'cheapest_adequate';
alter table campaigns drop constraint if exists campaigns_ranking_mode_check;
alter table campaigns add constraint campaigns_ranking_mode_check check (ranking_mode in ('cheapest_adequate','owner_pays_difference','unchecked'));
alter table campaigns add column if not exists shipping_cents bigint not null default 0 check (shipping_cents >= 0);
alter table campaigns add column if not exists tax_cents bigint not null default 0 check (tax_cents >= 0);
alter table campaigns add column if not exists buffer_cents bigint not null default 0 check (buffer_cents >= 0);
alter table campaigns add column if not exists gap_formula jsonb;
alter table campaigns add column if not exists policy_version text;
alter table campaigns add column if not exists price_rechecked_at timestamptz;
alter table campaigns add column if not exists live_price_cents bigint check (live_price_cents is null or live_price_cents >= 0);
-- Moderation is separate from the payment status so payment logic stays unchanged.
alter table campaigns add column if not exists moderation_status text not null default 'auto_approved';
alter table campaigns drop constraint if exists campaigns_moderation_status_check;
alter table campaigns add constraint campaigns_moderation_status_check check (moderation_status in ('auto_approved','pending_review','approved','rejected','hidden'));
alter table campaigns add column if not exists moderation_reasons text[] not null default '{}';
alter table campaigns add column if not exists moderated_by uuid references profiles(id);
alter table campaigns add column if not exists moderated_at timestamptz;
-- Set only by an approved verification process (none is connected), never by the creator or the AI.
alter table campaigns add column if not exists verification_status text not null default 'unverified';
alter table campaigns drop constraint if exists campaigns_verification_status_check;
alter table campaigns add constraint campaigns_verification_status_check check (verification_status in ('unverified','pending','verified','rejected'));
alter table campaigns add column if not exists verification_id uuid references verifications(id);
alter table campaigns add column if not exists content_hash text;
create index if not exists campaigns_owner_status on campaigns (owner_id, status);
create index if not exists campaigns_content_hash on campaigns (content_hash);

alter table campaign_updates drop constraint if exists campaign_updates_kind_check;
alter table campaign_updates add constraint campaign_updates_kind_check check (kind in ('update','thank_you','goal_reached','purchase','refund','price_change','moderation'));

-- ---------- Public reports ----------
create table if not exists campaign_reports (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  reporter_id uuid not null references profiles(id),
  reason text not null check (reason in ('scam','misleading','personal_info','offensive','duplicate','other')),
  details text check (details is null or length(details) <= 300),
  status text not null default 'open' check (status in ('open','dismissed','actioned')),
  created_at timestamptz not null default now(),
  unique (campaign_id, reporter_id)
);
alter table campaign_reports enable row level security;
revoke all on campaign_reports from anon, authenticated;

-- ---------- Audit fields ----------
alter table ai_sessions add column if not exists safety jsonb not null default '{}'::jsonb;
alter table ai_sessions add column if not exists policy_version text;
alter table payment_orders add column if not exists payer_country text check (payer_country is null or payer_country ~ '^[A-Z]{2}$');
alter table payment_orders add column if not exists policy_version text;
