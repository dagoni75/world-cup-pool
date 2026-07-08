create or replace function public.app_admin_set_match_time(
  p_player_id uuid,
  p_token text,
  p_match_id uuid,
  p_starts_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_match_id uuid;
begin
  perform public.app_private_require_admin(p_player_id, p_token);

  if p_starts_at is null then
    raise exception 'Kickoff date and time required.';
  end if;

  update public.matches
  set starts_at = p_starts_at
  where matches.id = p_match_id
  returning matches.id into v_match_id;

  if v_match_id is null then
    raise exception 'Match not found.';
  end if;

  return v_match_id;
end;
$$;

grant execute on function public.app_admin_set_match_time(uuid, text, uuid, timestamptz) to anon, authenticated;

notify pgrst, 'reload schema';
