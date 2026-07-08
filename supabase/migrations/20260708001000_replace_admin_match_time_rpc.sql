drop function if exists public.app_admin_set_match_time(uuid, text, uuid, timestamptz);

create or replace function public.app_admin_set_match_time(
  p_match_id uuid,
  p_player_id uuid,
  p_starts_at timestamptz,
  p_token text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_is_admin boolean;
begin
  perform public.app_private_require_player(p_player_id, p_token);

  select coalesce(is_admin, false)
  into v_is_admin
  from public.players
  where id = p_player_id;

  if coalesce(v_is_admin, false) is not true then
    raise exception 'Admin access required.';
  end if;

  if p_match_id is null then
    raise exception 'Match is required.';
  end if;

  if p_starts_at is null then
    raise exception 'Kickoff time is required.';
  end if;

  update public.matches
  set starts_at = p_starts_at
  where id = p_match_id;

  if not found then
    raise exception 'Match not found.';
  end if;
end;
$$;

grant execute on function public.app_admin_set_match_time(uuid, uuid, timestamptz, text) to anon, authenticated;

notify pgrst, 'reload schema';
