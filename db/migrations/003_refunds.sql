-- Track partial and full refunds per contribution. Verified totals subtract refunded cents.
alter table contributions add column if not exists refunded_cents integer not null default 0;
alter table contributions drop constraint if exists contributions_refunded_cents_check;
alter table contributions add constraint contributions_refunded_cents_check check (refunded_cents >= 0 and refunded_cents <= amount_cents);

alter table campaign_updates drop constraint if exists campaign_updates_kind_check;
alter table campaign_updates add constraint campaign_updates_kind_check check (kind in ('update','thank_you','goal_reached','purchase','refund'));

create or replace view campaign_totals as
select c.id as campaign_id,
       coalesce(sum(k.amount_cents - k.refunded_cents) filter (where k.status = 'COMPLETED'), 0)::bigint as raised_cents,
       count(k.id) filter (where k.status = 'COMPLETED')::int as supporter_count
from campaigns c
left join contributions k on k.campaign_id = c.id
group by c.id;
revoke all on campaign_totals from anon, authenticated;
