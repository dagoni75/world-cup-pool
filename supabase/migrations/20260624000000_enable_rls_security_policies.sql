alter table public.players enable row level security;
alter table public.player_sessions enable row level security;
alter table public.predictions enable row level security;
alter table public.matches enable row level security;

drop policy if exists "Public can read matches" on public.matches;
drop policy if exists "Public can read safe player fields" on public.players;
drop policy if exists "Public can create players" on public.players;
drop policy if exists "Public can create player sessions" on public.player_sessions;
drop policy if exists "Public can read predictions" on public.predictions;
drop policy if exists "Public can create predictions" on public.predictions;

create policy "Public can read matches"
on public.matches
for select
to anon, authenticated
using (true);

create policy "Public can read safe player fields"
on public.players
for select
to anon, authenticated
using (true);

create policy "Public can create players"
on public.players
for insert
to anon, authenticated
with check (coalesce(is_admin, false) = false);

create policy "Public can create player sessions"
on public.player_sessions
for insert
to anon, authenticated
with check (true);

create policy "Public can read predictions"
on public.predictions
for select
to anon, authenticated
using (true);

create policy "Public can create predictions"
on public.predictions
for insert
to anon, authenticated
with check (true);

revoke all on table public.players from anon, authenticated;
revoke all on table public.player_sessions from anon, authenticated;
revoke all on table public.predictions from anon, authenticated;
revoke all on table public.matches from anon, authenticated;

grant select (id, name, is_admin, favorite_team, created_at) on public.players to anon, authenticated;
grant insert (name, pin, is_admin, favorite_team) on public.players to anon, authenticated;
grant insert (player_id) on public.player_sessions to anon, authenticated;
grant select, insert on public.predictions to anon, authenticated;
grant select on public.matches to anon, authenticated;

create or replace function public.app_private_require_player(
  p_player_id uuid,
  p_token text
)
returns public.players
language plpgsql
security definer
set search_path = public, pg_temp
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

create or replace function public.app_require_session(
  p_player_id uuid,
  p_token text
)
returns table (
  id uuid,
  name text,
  is_admin boolean,
  favorite_team text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_player public.players%rowtype;
begin
  v_player := public.app_private_require_player(p_player_id, p_token);

  return query
  select v_player.id, v_player.name, v_player.is_admin, v_player.favorite_team;
end;
$$;

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

  insert into public.player_sessions (player_id)
  values (v_player.id)
  returning player_sessions.token::text into v_token;

  return query
  select v_player.id, v_player.name, v_player.is_admin, v_player.favorite_team, v_token;
end;
$$;

create or replace function public.app_change_pin(
  p_player_id uuid,
  p_token text,
  p_current_pin text,
  p_new_pin text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_player public.players%rowtype;
begin
  v_player := public.app_private_require_player(p_player_id, p_token);

  if p_new_pin !~ '^[0-9]{4,8}$' then
    raise exception 'PIN must be 4 to 8 digits.';
  end if;

  if v_player.pin <> p_current_pin then
    raise exception 'Current PIN is incorrect.';
  end if;

  if exists (select 1 from public.players p where p.pin = p_new_pin and p.id <> p_player_id) then
    raise exception 'PIN already in use. Please choose a different PIN.';
  end if;

  update public.players
  set pin = p_new_pin
  where players.id = p_player_id;
end;
$$;

create or replace function public.app_save_favorite_team(
  p_player_id uuid,
  p_token text,
  p_favorite_team text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.app_private_require_player(p_player_id, p_token);

  update public.players
  set favorite_team = trim(p_favorite_team)
  where players.id = p_player_id;
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
as $$
begin
  perform public.app_private_require_admin(p_player_id, p_token);

  delete from public.matches
  where stage in ('Round of 32', 'Round of 16', 'Quarterfinals', 'Semifinals', 'Third Place Match', 'Final');
end;
$$;

revoke all on function public.app_private_require_player(uuid, text) from public;
revoke all on function public.app_private_require_admin(uuid, text) from public;

grant execute on function public.app_require_session(uuid, text) to anon, authenticated;
grant execute on function public.app_login_player(text, text) to anon, authenticated;
grant execute on function public.app_change_pin(uuid, text, text, text) to anon, authenticated;
grant execute on function public.app_save_favorite_team(uuid, text, text) to anon, authenticated;
grant execute on function public.app_save_prediction(uuid, text, uuid, integer, integer) to anon, authenticated;
grant execute on function public.app_admin_set_match_result(uuid, text, uuid, integer, integer, integer, integer) to anon, authenticated;
grant execute on function public.app_admin_upsert_match(uuid, text, uuid, text, text, timestamptz, text, text, integer, integer, integer, integer) to anon, authenticated;
grant execute on function public.app_admin_delete_knockout_matches(uuid, text) to anon, authenticated;
