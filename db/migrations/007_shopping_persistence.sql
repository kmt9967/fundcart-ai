-- Coordinate new turns with deletion of their owner's conversation.
create function public.guard_shopping_turn_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.user_id is null or new.result->>'parent' is null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 731));
  if not exists (
    select 1 from public.ai_sessions where id::text = new.result->>'parent'
      and user_id = new.user_id and coalesce(result->>'kind', '') <> 'removed'
  ) then raise exception 'Shopping conversation is unavailable'; end if;
  return new;
end;
$$;
create trigger shopping_turn_parent_guard before insert on public.ai_sessions
  for each row execute function public.guard_shopping_turn_insert();

create index ai_sessions_owner_parent_idx
  on public.ai_sessions (user_id, (result->>'parent'));

create function public.remove_shopping_thread(p_owner uuid, p_turn uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare affected integer; removed_ids uuid[];
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text, 731));
  with recursive ancestors(id, parent) as (
    select id, result->>'parent' from public.ai_sessions where id = p_turn and user_id = p_owner
    union
    select s.id, s.result->>'parent' from public.ai_sessions s join ancestors a on s.id::text = a.parent
      where s.user_id = p_owner
  ), conversation(id) as (
    select id from ancestors
    union
    select s.id from public.ai_sessions s join conversation c on s.result->>'parent' = c.id::text
      where s.user_id = p_owner
  )
  , removed_turns as (update public.ai_sessions s
    set prompt = '[removed from shopping history]', intent = null, model = null,
        result = jsonb_build_object('kind', 'removed', 'parent', s.result->>'parent')
    where user_id = p_owner and id in (select id from conversation)
      and coalesce(result->>'kind', '') <> 'removed'
      returning id)
  select array_agg(id), (select count(*)::integer from removed_turns) into removed_ids, affected from conversation;
  -- Drop linked shopping diagnostics that can contain query text. Separate campaign,
  -- payment and security event records remain append-only.
  delete from public.agent_events where campaign_id is null and session_id = any(removed_ids);
  return affected;
end;
$$;
revoke all on function public.remove_shopping_thread(uuid, uuid) from public, anon, authenticated;
grant execute on function public.remove_shopping_thread(uuid, uuid) to service_role;

create table public.saved_shopping_bundles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kit_id text not null check (length(kit_id) between 1 and 40),
  name text not null check (length(trim(name)) between 1 and 80),
  selections jsonb not null check (jsonb_typeof(selections) = 'array' and jsonb_array_length(selections) <= 12),
  updated_at timestamptz not null default now(),
  unique (owner_id, kit_id, name)
);
alter table public.saved_shopping_bundles enable row level security;
revoke all on public.saved_shopping_bundles from public, anon, authenticated;
grant select, insert, update, delete on public.saved_shopping_bundles to service_role;

create function public.guard_shopping_snapshot_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.result->>'kind' = 'removed' and new.result is distinct from old.result then
    raise exception 'Removed shopping data cannot be restored';
  end if;
  if old.result ? 'offers' and coalesce(new.result->>'kind', '') <> 'removed'
    and (new.result->'offers' is distinct from old.result->'offers'
      or new.result->'shownAt' is distinct from old.result->'shownAt') then
    raise exception 'Historical shopping offers are immutable';
  end if;
  return new;
end;
$$;
create trigger shopping_snapshot_guard before update on public.ai_sessions
  for each row execute function public.guard_shopping_snapshot_update();


create function public.guard_shopping_diagnostics() returns trigger
language plpgsql set search_path = '' as $$
declare session_kind text;
begin
  if TG_OP = 'INSERT' then
    if new.session_id is not null then
      select result->>'kind' into session_kind from public.ai_sessions where id = new.session_id for share;
      if session_kind = 'removed' then raise exception 'Removed shopping data cannot be restored'; end if;
    end if;
    return new;
  end if;
  if TG_OP = 'DELETE' and old.session_id is not null and old.campaign_id is null
      and exists (select 1 from public.ai_sessions where id = old.session_id and result->>'kind' = 'removed') then
    return old;
  end if;
  raise exception 'Agent events are append-only';
end;
$$;
drop trigger agent_events_immutable on public.agent_events;
create trigger agent_events_immutable before insert or update or delete on public.agent_events
  for each row execute function public.guard_shopping_diagnostics();
