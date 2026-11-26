-- Apply a verified provider event and record its id in the same transaction.
create or replace function public.apply_contribution_adjustment(
  p_event_id text, p_resource_id text, p_capture_id text, p_currency text,
  p_amount bigint, p_reversed boolean
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  contribution public.contributions%rowtype;
  next_refunded bigint;
  next_status text;
  inserted_id bigint;
begin
  if exists (select 1 from public.payment_events where paypal_event_id = p_event_id) then
    return 'duplicate';
  end if;
  select * into contribution from public.contributions where capture_id = p_capture_id for update;
  if not found then
    if exists (select 1 from public.payment_orders where capture_id = p_capture_id and kind <> 'contribution') then
      return 'unsupported';
    end if;
    return 'missing';
  end if;
  if contribution.currency <> p_currency or p_amount <= 0 or p_amount > contribution.amount_cents
    or (p_reversed and p_amount <> contribution.amount_cents) then
    return 'mismatch';
  end if;
  if not p_reversed and exists (
    select 1 from public.payment_events where payment_order_id = contribution.payment_order_id
      and event_type = 'PAYMENT.CAPTURE.REFUNDED' and summary->>'resourceId' = p_resource_id
  ) then
    return 'duplicate';
  end if;

  insert into public.payment_events (payment_order_id, source, event_type, paypal_event_id, summary)
    values (contribution.payment_order_id, 'webhook',
      case when p_reversed then 'PAYMENT.CAPTURE.REVERSED' else 'PAYMENT.CAPTURE.REFUNDED' end,
      p_event_id, jsonb_build_object('resourceId', p_resource_id))
    on conflict (paypal_event_id) do nothing returning id into inserted_id;
  if inserted_id is null then return 'duplicate'; end if;
  if contribution.status = 'REVERSED' then return 'unchanged'; end if;

  next_refunded := case when p_reversed then contribution.amount_cents
    else least(contribution.amount_cents, contribution.refunded_cents + p_amount) end;
  next_status := case when p_reversed then 'REVERSED'
    when next_refunded = contribution.amount_cents then 'REFUNDED' else 'COMPLETED' end;
  if next_refunded = contribution.refunded_cents and next_status = contribution.status then return 'unchanged'; end if;

  update public.contributions set refunded_cents = next_refunded, status = next_status where id = contribution.id;
  insert into public.campaign_updates (campaign_id, kind, body) values (contribution.campaign_id, 'refund',
    case when p_reversed then 'A PayPal Sandbox contribution was reversed and no longer counts toward the goal.'
      else 'PayPal Sandbox reported a refund. The verified contribution total was reduced.' end);
  update public.campaigns set status = 'active', updated_at = now()
    where id = contribution.campaign_id and status = 'goal_reached'
    and (select raised_cents from public.campaign_totals where campaign_id = contribution.campaign_id) < target_cents;
  return 'applied';
end;
$$;
revoke all on function public.apply_contribution_adjustment(text,text,text,text,bigint,boolean) from public, anon, authenticated;
grant execute on function public.apply_contribution_adjustment(text,text,text,text,bigint,boolean) to service_role;
