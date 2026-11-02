-- AlpenManager V5: 3 oder 5 Skigebiete, sichere Online-Migration.
-- Zuerst UPDATE_SPIELZEITEN_10_MIN.sql und UPDATE_BALANCING_V2.sql anwenden.
-- Bestehende Partien behalten max_teams=3. Keine Datensaetze werden geloescht.
-- Kein neuer direkter Tabellenzugriff fuer Browser.
alter table am_private.rooms
 add column if not exists max_teams integer not null default 3 check (max_teams in (3,5));
alter table am_private.teams drop constraint if exists teams_slot_check;
alter table am_private.teams add constraint teams_slot_check check (slot between 1 and 5);
-- Neue sichere RPC mit 3 Parametern; alte 2-Parameter-Version bleibt fuer alte Clients.
create or replace function public.am_create_room(p_title text,p_pin text,p_max_teams integer)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_code text; v_token text; v_id uuid; v_try integer;
begin
 if md5(coalesce(p_pin,'')) <> '81dc9bdb52d04dc20036dbd8313ed055'
 then raise exception 'Lehrpersonen-Passwort ungültig'; end if;
 if p_max_teams is null or p_max_teams not in (3,5) then raise exception 'Nur 3 oder 5 Teams erlaubt'; end if;
  if length(trim(coalesce(p_title,''))) > 60 then raise exception 'Titel ist zu lang'; end if;
 v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
 for v_try in 1..80 loop
  v_code := lpad((floor(random()*10000)::integer)::text,4,'0');
  insert into am_private.rooms(code,title,host_hash,max_teams)
   values(v_code,coalesce(nullif(trim(p_title),''),'AlpenManager'),md5(v_token),p_max_teams)
   on conflict (code) do nothing returning id into v_id;
  exit when v_id is not null;
 end loop;
 if v_id is null then raise exception 'Kein freier Spielcode gefunden. Alte Spielrunden bei Bedarf löschen.'; end if;
 return jsonb_build_object('code',v_code,'token',v_token,'role','host','max_teams',p_max_teams);
end; $$;
-- Teilnehmerzuordnung, Status, Spielsteuerung, Ergebnisprüfung und Beamer.
create or replace function public.am_join_room(p_code text,p_name text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_room am_private.rooms%rowtype; v_token text; v_name text; v_slot integer;
begin
 v_name:=trim(coalesce(p_name,''));
 if length(v_name) not between 2 and 36
 then raise exception 'Bitte einen Namen mit 2 bis 36 Zeichen eingeben'; end if;
 if coalesce(trim(p_code),'') !~ '^[0-9]{4}$'
 then raise exception 'Bitte einen vierstelligen Spielcode eingeben'; end if;
 select * into v_room from am_private.rooms where code=trim(p_code) for update;
 if not found then raise exception 'Spielcode nicht gefunden'; end if;
 if v_room.last_activity <= now() - interval '10 minutes'
 then raise exception 'Spielrunde wegen Inaktivität beendet'; end if;
 if v_room.phase<>'lobby' then raise exception 'Beitritt nur vor Spielbeginn möglich'; end if;
 select available.slot into v_slot
 from generate_series(1,v_room.max_teams) as available(slot)
 where not exists(
   select 1 from am_private.teams t where t.room_id=v_room.id and t.slot=available.slot
 )
 order by available.slot limit 1;
 if v_slot is null then raise exception 'Alle Plätze dieser Spielrunde sind bereits vergeben'; end if;
 v_token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into am_private.teams(room_id,slot,name,access_hash)
 values(v_room.id,v_slot,v_name,md5(v_token));
 update am_private.rooms set last_activity=now(),version=version+1 where id=v_room.id;
 return jsonb_build_object('code',v_room.code,'token',v_token,'role','team','slot',v_slot);
end; $$;

create or replace function public.am_read_room(p_code text,p_token text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_room am_private.rooms%rowtype; v_host boolean; v_slot integer;
begin
 select * into v_room from am_private.rooms where code=upper(trim(p_code));
 if not found or p_token is null or length(p_token)<40
 then raise exception 'Spielcode oder Zugang ungültig'; end if;
 if v_room.last_activity <= now() - interval '10 minutes'
 then raise exception 'Spielrunde wegen Inaktivität beendet'; end if;
 v_host:=(md5(p_token)=v_room.host_hash);
 if not v_host then
  select slot into v_slot from am_private.teams
  where room_id=v_room.id and access_hash=md5(p_token);
  if not found then raise exception 'Spielcode oder Zugang ungültig'; end if;
 end if;
 return jsonb_build_object(
  'code',v_room.code,'title',v_room.title,'role',case when v_host then 'host' else 'team' end,
  'slot',v_slot,'season',v_room.season,'phase',v_room.phase,'max_teams',v_room.max_teams,
  'deadline',v_room.deadline,'version',v_room.version,'last_activity',v_room.last_activity,'results',v_room.results,
  'teams',coalesce((
   select jsonb_agg(
    jsonb_build_object('slot',t.slot,'name',t.name,'ready',t.ready,
      'choice',case when v_host or t.slot=v_slot then t.choice else null end,
      'state',case when v_host or t.slot=v_slot then t.state else null end)
    order by t.slot)
   from am_private.teams t where t.room_id=v_room.id
  ),'[]'::jsonb)
 );
end; $$;

create or replace function public.am_control(p_code text,p_token text,p_action text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_room am_private.rooms%rowtype;
begin
 select * into v_room from am_private.rooms where code=upper(trim(p_code)) for update;
 if not found or md5(coalesce(p_token,''))<>v_room.host_hash
 then raise exception 'Nur die Spielleitung darf das Spiel steuern'; end if;
 if v_room.last_activity <= now() - interval '10 minutes'
 then raise exception 'Spielrunde wegen Inaktivität beendet'; end if;
 if p_action='start' and v_room.phase='lobby' then
  if (select count(*) from am_private.teams where room_id=v_room.id)<>v_room.max_teams
  then raise exception 'Zuerst müssen alle '||v_room.max_teams||' Teams beitreten'; end if;
  update am_private.rooms set phase='intro',season=1,deadline=null,
    last_activity=now(),version=version+1 where id=v_room.id;
 elsif p_action='open' and v_room.phase='intro' then
  update am_private.teams set ready=false,choice='{}'::jsonb where room_id=v_room.id;
  update am_private.rooms set phase='decision',deadline=now()+case when v_room.season=1 then interval '6 minutes' else interval '3 minutes' end,
    last_activity=now(),version=version+1 where id=v_room.id;
 elsif p_action='next' and v_room.phase='report' then
  if v_room.season=5 then
   update am_private.rooms set phase='finished',deadline=null,last_activity=now(),version=version+1 where id=v_room.id;
  else
   update am_private.rooms set phase='intro',season=season+1,deadline=null,
     results='[]'::jsonb,last_activity=now(),version=version+1 where id=v_room.id;
  end if;
 else
  raise exception 'Aktion in dieser Spielphase nicht erlaubt';
 end if;
 return jsonb_build_object('ok',true);
end; $$;

create or replace function public.am_publish_results(p_code text,p_token text,p_states jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_room am_private.rooms%rowtype; v_team am_private.teams%rowtype;
 v_entry jsonb; v_summary jsonb:='[]'::jsonb;
begin
 select * into v_room from am_private.rooms where code=upper(trim(p_code)) for update;
 if not found or md5(coalesce(p_token,''))<>v_room.host_hash
 then raise exception 'Nur die Spielleitung darf Resultate veröffentlichen'; end if;
 if v_room.last_activity <= now() - interval '10 minutes'
 then raise exception 'Spielrunde wegen Inaktivität beendet'; end if;
 if v_room.phase<>'decision' then raise exception 'Die Saison wurde bereits beendet oder noch nicht gestartet'; end if;
 if now()<v_room.deadline and
   (select count(*) from am_private.teams where room_id=v_room.id and ready)=0
 then raise exception 'Es wurden noch keine Entscheidungen gespeichert'; end if;
 if now()<v_room.deadline and
   (select count(*) from am_private.teams where room_id=v_room.id and ready)<>v_room.max_teams
 then raise exception 'Vor Ablauf der Entscheidungszeit müssen alle Teams gespeichert haben'; end if;
 if jsonb_typeof(p_states)<>'array' or jsonb_array_length(p_states)<>v_room.max_teams
 then raise exception 'Die Anzahl der Teamresultate stimmt nicht mit der Spielrunde überein'; end if;
 if (select count(*) from am_private.teams where room_id=v_room.id)<>v_room.max_teams
 then raise exception 'Unvollständige Spielrunde'; end if;
 for v_team in select * from am_private.teams where room_id=v_room.id order by slot for update loop
  select x.entry into v_entry from jsonb_array_elements(p_states) as x(entry)
   where x.entry->>'slot'=v_team.slot::text limit 1;
  if v_entry is null or jsonb_typeof(v_entry->'state')<>'object'
  then raise exception 'Teamresultat fehlt oder ist ungültig'; end if;
  update am_private.teams set state=v_entry->'state',ready=false,choice='{}'::jsonb,updated_at=now()
   where id=v_team.id;
  v_summary:=v_summary||jsonb_build_array(jsonb_build_object(
    'slot',v_team.slot,'name',v_team.name,
    'guests',coalesce((v_entry->'state'->>'guests')::numeric,0),
    'profit',coalesce((v_entry->'state'->'last'->>'profit')::numeric,0),
    'cash',coalesce((v_entry->'state'->>'cash')::numeric,0),
    'score',coalesce((v_entry->>'score')::integer,0),
    'solvent',coalesce((v_entry->>'solvent')::boolean,true)
  ));
 end loop;
 update am_private.rooms set phase='report',results=v_summary,
  deadline=null,last_activity=now(),version=version+1 where id=v_room.id;
 return jsonb_build_object('ok',true,'season',v_room.season,'results',v_summary);
end; $$;

create or replace function public.am_projector_room(p_code text,p_pin text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_room am_private.rooms%rowtype;
begin
 if md5(coalesce(p_pin,'')) <> '81dc9bdb52d04dc20036dbd8313ed055'
 then raise exception 'Dashboard-Passwort ungültig'; end if;
 select * into v_room from am_private.rooms where code=upper(trim(p_code));
 if not found then raise exception 'Spielcode nicht gefunden'; end if;
 if v_room.last_activity <= now() - interval '10 minutes'
 then raise exception 'Spielrunde wegen Inaktivität beendet'; end if;
 return jsonb_build_object(
   'code',v_room.code,'title',v_room.title,'role','projector',
   'season',v_room.season,'phase',v_room.phase,'max_teams',v_room.max_teams,
   'deadline',v_room.deadline,'version',v_room.version,'last_activity',v_room.last_activity,'results',v_room.results,
   'teams',coalesce((
    select jsonb_agg(jsonb_build_object(
      'slot',t.slot,'name',t.name,'ready',t.ready,
      'stats',case when t.state <> '{}'::jsonb then jsonb_build_object(
        'cash',t.state->'cash','debt',t.state->'debt',
        'guests',t.state->'guests','totalProfit',t.state->'totalProfit',
        'stake',t.state->'stake','quality',t.state->'quality',
        'assets',t.state->'assets','history',t.state->'history',
        'bankrupt',t.state->'bankrupt'
      ) else null end
    ) order by t.slot)
    from am_private.teams t where t.room_id=v_room.id
   ),'[]'::jsonb)
 );
end; $$;
revoke all on function public.am_create_room(text,text,integer) from public,anon,authenticated;
grant execute on function public.am_create_room(text,text,integer) to anon,authenticated;
