-- AlpenManager: komplette Supabase-Einrichtung (einmal im SQL Editor ausführen).
-- Die Tabellen liegen bewusst NICHT im öffentlich erreichbaren Schema.
-- Direkter Datenbankzugriff für anonyme Browser ist nicht erlaubt.
-- Ausschliesslich geprüfte API-Funktionen sind für den Publishable Key freigegeben.
create schema if not exists am_private;

create table if not exists am_private.rooms (
 id uuid primary key default gen_random_uuid(),
 code text not null unique,
 title text not null default 'AlpenManager',
 host_hash text not null,
 season integer not null default 1 check (season between 1 and 5),
 phase text not null default 'lobby' check (phase in ('lobby','intro','decision','report','finished')),
 deadline timestamptz,
 results jsonb not null default '[]'::jsonb,
 version bigint not null default 1,
 created_at timestamptz not null default now()
);

create table if not exists am_private.teams (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references am_private.rooms(id) on delete cascade,
 slot integer not null check (slot between 1 and 3),
 name text not null,
 access_hash text not null,
 choice jsonb not null default '{}'::jsonb,
 state jsonb not null default '{}'::jsonb,
 ready boolean not null default false,
 updated_at timestamptz not null default now(),
 unique(room_id,slot)
);

create index if not exists am_teams_room_idx on am_private.teams(room_id);
alter table am_private.rooms enable row level security;
alter table am_private.teams enable row level security;
revoke all on schema am_private from public, anon, authenticated;
revoke all on all tables in schema am_private from public, anon, authenticated;
revoke all on all sequences in schema am_private from public, anon, authenticated;

-- 1. Spielrunde erstellen; die Lehrperson erhält einen geheimen Host-Token.
create or replace function public.am_create_room(p_title text default 'AlpenManager')
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_code text; v_token text; v_id uuid; v_try integer;
begin
 if length(trim(coalesce(p_title,''))) > 60 then raise exception 'Titel ist zu lang'; end if;
 v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
 for v_try in 1..12 loop
  v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into am_private.rooms(code,title,host_hash)
   values(v_code,coalesce(nullif(trim(p_title),''),'AlpenManager'),md5(v_token))
   on conflict (code) do nothing returning id into v_id;
  exit when v_id is not null;
 end loop;
 if v_id is null then raise exception 'Spielcode konnte nicht erstellt werden'; end if;
 return jsonb_build_object('code',v_code,'token',v_token,'role','host');
end; $$;

-- 2. Lernende wählen eines der drei freien Skigebiete.
create or replace function public.am_join_room(p_code text,p_slot integer,p_name text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_room am_private.rooms%rowtype; v_token text; v_name text;
begin
 v_name:=trim(coalesce(p_name,''));
 if p_slot not between 1 and 3 or length(v_name) not between 2 and 36
 then raise exception 'Bitte Skigebiet und einen Namen (2–36 Zeichen) angeben'; end if;
 select * into v_room from am_private.rooms where code=upper(trim(p_code)) for update;
 if not found then raise exception 'Spielcode nicht gefunden'; end if;
 if v_room.phase<>'lobby' then raise exception 'Beitritt nur vor Spielbeginn möglich'; end if;
 if exists(select 1 from am_private.teams where room_id=v_room.id and slot=p_slot)
 then raise exception 'Dieses Skigebiet ist bereits besetzt'; end if;
 v_token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into am_private.teams(room_id,slot,name,access_hash)
 values(v_room.id,p_slot,v_name,md5(v_token));
 update am_private.rooms set version=version+1 where id=v_room.id;
 return jsonb_build_object('code',v_room.code,'token',v_token,'role','team','slot',p_slot);
end; $$;

-- 3. Sichere Statusabfrage: Lehrperson sieht alles, Teams nur ihre eigenen Daten.
create or replace function public.am_read_room(p_code text,p_token text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_room am_private.rooms%rowtype; v_host boolean; v_slot integer;
begin
 select * into v_room from am_private.rooms where code=upper(trim(p_code));
 if not found or p_token is null or length(p_token)<40
 then raise exception 'Spielcode oder Zugang ungültig'; end if;
 v_host:=(md5(p_token)=v_room.host_hash);
 if not v_host then
  select slot into v_slot from am_private.teams
  where room_id=v_room.id and access_hash=md5(p_token);
  if not found then raise exception 'Spielcode oder Zugang ungültig'; end if;
 end if;
 return jsonb_build_object(
  'code',v_room.code,'title',v_room.title,'role',case when v_host then 'host' else 'team' end,
  'slot',v_slot,'season',v_room.season,'phase',v_room.phase,
  'deadline',v_room.deadline,'version',v_room.version,'results',v_room.results,
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

-- 4. Entscheidung speichern; Server prüft Rollen, Frist, Werte und Einmal-Käufe.
create or replace function public.am_save_choice(p_code text,p_token text,p_choice jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_room am_private.rooms%rowtype; v_team am_private.teams%rowtype;
 v_price numeric; v_staff numeric; v_wage numeric;
 v_marketing numeric; v_maintenance numeric; v_invest text;
begin
 select * into v_room from am_private.rooms where code=upper(trim(p_code)) for update;
 if not found then raise exception 'Spiel nicht gefunden'; end if;
 if v_room.phase<>'decision' or v_room.deadline is null or now()>=v_room.deadline
 then raise exception 'Die Entscheidungsphase ist beendet'; end if;
 select * into v_team from am_private.teams where room_id=v_room.id and access_hash=md5(coalesce(p_token,'')) for update;
 if not found then raise exception 'Nur das eigene Team darf Entscheidungen speichern'; end if;
 if jsonb_typeof(p_choice)<>'object' then raise exception 'Ungültige Entscheidungen'; end if;
 if jsonb_typeof(p_choice->'price')<>'number'
 or jsonb_typeof(p_choice->'staff')<>'number'
 or jsonb_typeof(p_choice->'wage')<>'number'
 or jsonb_typeof(p_choice->'marketing')<>'number'
 or jsonb_typeof(p_choice->'maintenance')<>'number'
 then raise exception 'Ungültige Zahlenwerte'; end if;
 v_price:=(p_choice->>'price')::numeric;
 v_staff:=(p_choice->>'staff')::numeric;
 v_wage:=(p_choice->>'wage')::numeric;
 v_marketing:=(p_choice->>'marketing')::numeric;
 v_maintenance:=(p_choice->>'maintenance')::numeric;
 v_invest:=p_choice->>'investment';
 if v_price not between 40 and 100 or v_staff not between 35 and 100
 or v_staff<>trunc(v_staff) or v_wage not between -20 and 20
 or v_marketing not between 0 and 300000 or v_maintenance not between 50000 and 350000
 or p_choice->>'segment' not in ('Familien','Junge Erwachsene','Sportliche Gäste','Premiumgäste')
 or p_choice->>'supplier' not in ('günstig','zuverlässig','nachhaltig')
 or v_invest not in ('none','lift','snow','eco','service','family','staffHome','shuttle','digital')
 then raise exception 'Entscheidungen ausserhalb der erlaubten Grenzen'; end if;
 if v_invest<>'none' and coalesce((v_team.state->'assets'->>v_invest)::integer,0)>0
 then raise exception 'Diese Investition wurde bereits gekauft'; end if;
 update am_private.teams set choice=p_choice,ready=true,updated_at=now() where id=v_team.id;
 update am_private.rooms set version=version+1 where id=v_room.id;
 return jsonb_build_object('ok',true,'slot',v_team.slot);
end; $$;

-- 5. Lehrpersonensteuerung: Ereignis / Strategiephase / nächste Saison.
create or replace function public.am_control(p_code text,p_token text,p_action text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_room am_private.rooms%rowtype;
begin
 select * into v_room from am_private.rooms where code=upper(trim(p_code)) for update;
 if not found or md5(coalesce(p_token,''))<>v_room.host_hash
 then raise exception 'Nur die Spielleitung darf das Spiel steuern'; end if;
 if p_action='start' and v_room.phase='lobby' then
  if (select count(*) from am_private.teams where room_id=v_room.id)<>3
  then raise exception 'Zuerst müssen alle drei Teams beitreten'; end if;
  update am_private.rooms set phase='intro',season=1,deadline=null,
    version=version+1 where id=v_room.id;
 elsif p_action='open' and v_room.phase='intro' then
  update am_private.teams set ready=false,choice='{}'::jsonb where room_id=v_room.id;
  update am_private.rooms set phase='decision',deadline=now()+interval '4 minutes',
    version=version+1 where id=v_room.id;
 elsif p_action='next' and v_room.phase='report' then
  if v_room.season=5 then
   update am_private.rooms set phase='finished',deadline=null,version=version+1 where id=v_room.id;
  else
   update am_private.rooms set phase='intro',season=season+1,deadline=null,
     results='[]'::jsonb,version=version+1 where id=v_room.id;
  end if;
 else
  raise exception 'Aktion in dieser Spielphase nicht erlaubt';
 end if;
 return jsonb_build_object('ok',true);
end; $$;

-- 6. Saison atomar abschliessen: nur die Lehrperson veröffentlicht alle drei Resultate.
-- Die Berechnung erfolgt unverändert im AlpenManager-JavaScript der Lehrperson.
create or replace function public.am_publish_results(p_code text,p_token text,p_states jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_room am_private.rooms%rowtype; v_team am_private.teams%rowtype;
 v_entry jsonb; v_summary jsonb:='[]'::jsonb;
begin
 select * into v_room from am_private.rooms where code=upper(trim(p_code)) for update;
 if not found or md5(coalesce(p_token,''))<>v_room.host_hash
 then raise exception 'Nur die Spielleitung darf Resultate veröffentlichen'; end if;
 if v_room.phase<>'decision' then raise exception 'Die Saison wurde bereits beendet oder noch nicht gestartet'; end if;
 if jsonb_typeof(p_states)<>'array' or jsonb_array_length(p_states)<>3
 then raise exception 'Es werden drei Teamresultate benötigt'; end if;
 if (select count(*) from am_private.teams where room_id=v_room.id)<>3
 then raise exception 'Drei Teams erforderlich'; end if;
 for v_team in select * from am_private.teams where room_id=v_room.id order by slot for update loop
  select item into v_entry from jsonb_array_elements(p_states) item
   where item->>'slot'=v_team.slot::text limit 1;
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
  deadline=null,version=version+1 where id=v_room.id;
 return jsonb_build_object('ok',true,'season',v_room.season,'results',v_summary);
end; $$;

-- API-Rechte: niemals private Tabellen freigeben!
revoke all on function public.am_create_room(text) from public,anon,authenticated;
revoke all on function public.am_join_room(text,integer,text) from public,anon,authenticated;
revoke all on function public.am_read_room(text,text) from public,anon,authenticated;
revoke all on function public.am_save_choice(text,text,jsonb) from public,anon,authenticated;
revoke all on function public.am_control(text,text,text) from public,anon,authenticated;
revoke all on function public.am_publish_results(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.am_create_room(text) to anon,authenticated;
grant execute on function public.am_join_room(text,integer,text) to anon,authenticated;
grant execute on function public.am_read_room(text,text) to anon,authenticated;
grant execute on function public.am_save_choice(text,text,jsonb) to anon,authenticated;
grant execute on function public.am_control(text,text,text) to anon,authenticated;
grant execute on function public.am_publish_results(text,text,jsonb) to anon,authenticated;

-- Optionaler Funktionstest im SQL Editor:
-- select public.am_create_room('Test AlpenManager');
-- Achtung: Dies erzeugt einen neuen Test-Spielcode samt geheimem Lehrpersonen-Token.
