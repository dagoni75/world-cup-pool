create or replace function public.app_admin_set_match_result(
  p_player_id uuid,
  p_token text,
  p_match_id uuid,
  p_team_a_score integer,
  p_team_b_score integer,
  p_team_a_pk_score integer default null,
  p_team_b_pk_score integer default null
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

  if p_team_a_score < 0 or p_team_a_score > 30 or p_team_b_score < 0 or p_team_b_score > 30 then
    raise exception 'Scores must be between 0 and 30.';
  end if;

  update public.matches
  set
    team_a_score = p_team_a_score,
    team_b_score = p_team_b_score,
    team_a_pk_score = p_team_a_pk_score,
    team_b_pk_score = p_team_b_pk_score
  where matches.id = p_match_id
  returning matches.id into v_match_id;

  if v_match_id is null then
    raise exception 'Match not found.';
  end if;

  return v_match_id;
end;
$$;

create or replace function public.app_admin_upsert_match(
  p_player_id uuid,
  p_token text,
  p_match_id uuid,
  p_team_a text,
  p_team_b text,
  p_starts_at timestamptz,
  p_stage text,
  p_bracket_slot text,
  p_team_a_score integer default null,
  p_team_b_score integer default null,
  p_team_a_pk_score integer default null,
  p_team_b_pk_score integer default null
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

  if p_match_id is not null then
    update public.matches
    set
      team_a = p_team_a,
      team_b = p_team_b,
      starts_at = p_starts_at,
      stage = p_stage,
      bracket_slot = p_bracket_slot,
      team_a_score = p_team_a_score,
      team_b_score = p_team_b_score,
      team_a_pk_score = p_team_a_pk_score,
      team_b_pk_score = p_team_b_pk_score
    where matches.id = p_match_id
    returning matches.id into v_match_id;

    if v_match_id is not null then
      return v_match_id;
    end if;
  end if;

  if p_bracket_slot is not null then
    update public.matches
    set
      team_a = p_team_a,
      team_b = p_team_b,
      starts_at = p_starts_at,
      team_a_score = p_team_a_score,
      team_b_score = p_team_b_score,
      team_a_pk_score = p_team_a_pk_score,
      team_b_pk_score = p_team_b_pk_score
    where matches.stage = p_stage
      and matches.bracket_slot = p_bracket_slot
    returning matches.id into v_match_id;

    if v_match_id is not null then
      return v_match_id;
    end if;
  end if;

  insert into public.matches (
    team_a,
    team_b,
    starts_at,
    stage,
    bracket_slot,
    team_a_score,
    team_b_score,
    team_a_pk_score,
    team_b_pk_score
  )
  values (
    p_team_a,
    p_team_b,
    p_starts_at,
    p_stage,
    p_bracket_slot,
    p_team_a_score,
    p_team_b_score,
    p_team_a_pk_score,
    p_team_b_pk_score
  )
  returning matches.id into v_match_id;

  return v_match_id;
end;
$$;

create or replace function public.app_admin_delete_knockout_matches(
  p_player_id uuid,
  p_token text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  perform public.app_private_require_admin(p_player_id, p_token);

  delete from public.matches
  where stage in ('Round of 32', 'Round of 16', 'Quarterfinals', 'Semifinals', 'Third Place Match', 'Final');
end;
$$;

grant execute on function public.app_admin_set_match_result(uuid, text, uuid, integer, integer, integer, integer) to anon, authenticated;
grant execute on function public.app_admin_upsert_match(uuid, text, uuid, text, text, timestamptz, text, text, integer, integer, integer, integer) to anon, authenticated;
grant execute on function public.app_admin_delete_knockout_matches(uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
