grant usage on schema public to anon, authenticated;

create or replace function public.app_login_player(
  p_name text,
  p_pin text
)
returns table (
  id uuid,
  name text,
  is_admin boolean,
  favorite_team text,
  token text
)
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_name text := trim(p_name);
  v_player public.players%rowtype;
  v_token text;
begin
  if length(v_name) < 2 or length(p_pin) < 4 then
    raise exception 'Enter your name and a PIN with at least 4 digits.';
  end if;

  select p.*
  into v_player
  from public.players p
  where lower(p.name) = lower(v_name)
  order by p.created_at
  limit 1;

  if found and v_player.pin <> p_pin then
    raise exception 'Player name already in use. Please choose a different name.';
  end if;

  if not found then
    begin
      insert into public.players (name, pin, is_admin)
      values (v_name, p_pin, false)
      returning * into v_player;
    exception
      when unique_violation then
        raise exception 'Player name already in use. Please choose a different name.';
    end;
  end if;

  with created_session as (
    insert into public.player_sessions as ps (player_id)
    values (v_player.id)
    returning ps.token
  )
  select created_session.token::text
  into v_token
  from created_session;

  return query
  select v_player.id, v_player.name, v_player.is_admin, v_player.favorite_team, v_token;
end;
$$;

create or replace function public.app_private_require_player(
  p_player_id uuid,
  p_token text
)
returns public.players
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_player public.players%rowtype;
begin
  select p.*
  into v_player
  from public.players p
  where p.id = p_player_id
    and exists (
      select 1
      from public.player_sessions s
      where s.player_id = p.id
        and s.token::text = p_token
        and s.expires_at > now()
    );

  if not found then
    raise exception 'Session expired. Please sign in again.';
  end if;

  return v_player;
end;
$$;

create or replace function public.app_private_require_admin(
  p_player_id uuid,
  p_token text
)
returns public.players
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_player public.players%rowtype;
begin
  v_player := public.app_private_require_player(p_player_id, p_token);

  if not coalesce(v_player.is_admin, false) then
    raise exception 'Admin access required.';
  end if;

  return v_player;
end;
$$;

create or replace function public.app_save_prediction(
  p_player_id uuid,
  p_token text,
  p_match_id uuid,
  p_team_a_score integer,
  p_team_b_score integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_starts_at timestamptz;
begin
  perform public.app_private_require_player(p_player_id, p_token);

  if p_team_a_score < 0 or p_team_a_score > 30 or p_team_b_score < 0 or p_team_b_score > 30 then
    raise exception 'Scores must be between 0 and 30.';
  end if;

  select m.starts_at
  into v_starts_at
  from public.matches m
  where m.id = p_match_id;

  if not found then
    raise exception 'Match not found.';
  end if;

  if v_starts_at <= now() then
    raise exception 'This match has started. Predictions are locked.';
  end if;

  insert into public.predictions (player_id, match_id, team_a_score, team_b_score, updated_at)
  values (p_player_id, p_match_id, p_team_a_score, p_team_b_score, now())
  on conflict (player_id, match_id)
  do update set
    team_a_score = excluded.team_a_score,
    team_b_score = excluded.team_b_score,
    updated_at = excluded.updated_at;
end;
$$;

grant execute on function public.app_login_player(text, text) to anon, authenticated;
grant execute on function public.app_require_session(uuid, text) to anon, authenticated;
grant execute on function public.app_save_prediction(uuid, text, uuid, integer, integer) to anon, authenticated;

notify pgrst, 'reload schema';
