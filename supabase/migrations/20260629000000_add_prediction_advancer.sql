alter table public.predictions
add column if not exists predicted_advancer text
check (predicted_advancer is null or predicted_advancer in ('team_a', 'team_b'));

drop function if exists public.app_save_prediction(uuid, text, uuid, integer, integer);

create or replace function public.app_save_prediction(
  p_player_id uuid,
  p_token text,
  p_match_id uuid,
  p_team_a_score integer,
  p_team_b_score integer,
  p_predicted_advancer text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_starts_at timestamptz;
  v_stage text;
  v_predicted_advancer text;
begin
  perform public.app_private_require_player(p_player_id, p_token);

  if p_team_a_score < 0 or p_team_a_score > 30 or p_team_b_score < 0 or p_team_b_score > 30 then
    raise exception 'Scores must be between 0 and 30.';
  end if;

  select m.starts_at, m.stage
  into v_starts_at, v_stage
  from public.matches m
  where m.id = p_match_id;

  if not found then
    raise exception 'Match not found.';
  end if;

  if v_starts_at <= now() then
    raise exception 'This match has started. Predictions are locked.';
  end if;

  v_predicted_advancer := null;

  if v_stage in ('Round of 32', 'Round of 16', 'Quarterfinals', 'Semifinals', 'Third Place Match', 'Final')
     and p_team_a_score = p_team_b_score then
    if p_predicted_advancer not in ('team_a', 'team_b') then
      raise exception 'Choose who advances.';
    end if;

    v_predicted_advancer := p_predicted_advancer;
  end if;

  insert into public.predictions (
    player_id,
    match_id,
    team_a_score,
    team_b_score,
    predicted_advancer,
    updated_at
  )
  values (
    p_player_id,
    p_match_id,
    p_team_a_score,
    p_team_b_score,
    v_predicted_advancer,
    now()
  )
  on conflict (player_id, match_id)
  do update set
    team_a_score = excluded.team_a_score,
    team_b_score = excluded.team_b_score,
    predicted_advancer = excluded.predicted_advancer,
    updated_at = excluded.updated_at;
end;
$$;

grant execute on function public.app_save_prediction(uuid, text, uuid, integer, integer, text) to anon, authenticated;

notify pgrst, 'reload schema';
