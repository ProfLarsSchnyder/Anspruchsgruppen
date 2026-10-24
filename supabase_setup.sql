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

-- Zehn Minuten ohne Bedienung: Raum samt Teams automatisch löschen.
-- Bestehende Spielrunden erhalten beim Update eine neue 10-Minuten-Frist.
alter table am_private.rooms
 add column if not exists last_activity timestamptz not null default now();
create index if not exists am_rooms_last_activity_idx on am_private.rooms(last_activity);

create index if not exists am_teams_room_idx on am_private.teams(room_id);
alter table am_private.rooms enable row level security;
alter table am_private.teams enable row level security;
revoke all on schema am_private from public, anon, authenticated;
revoke all on all tables in schema am_private from public, anon, authenticated;
revoke all on all sequences in schema am_private from public, anon, authenticated;

-- 1. Lehrpersonen-Zugang: PIN-Prüfung direkt auf dem Server.
-- Vierstelliger Unterrichtscode, keine vollwertige Benutzer-Authentifizierung.
create or replace function public.am_verify_teacher(p_pin text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
 if md5(coalesce(p_pin,'')) <> '81dc9bdb52d04dc20036dbd8313ed055'
 then raise exception 'Lehrpersonen-Passwort ungültig'; end if;
 return jsonb_build_object('ok',true);
end; $$;

-- Alte ungeschützte RPC-Signatur unbedingt entfernen!
drop function if exists public.am_create_room(text);

-- 1. Spielrunde erstellen: vierstelliger Zahlencode, eigener geheimer Host-Token.
-- Die Zufallszahl wird auf aktive und ältere Spielrunden mit eindeutigen Codes geprüft.
create or replace function public.am_create_room(p_title text,p_pin text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_code text; v_token text; v_id uuid; v_try integer;
begin
 if md5(coalesce(p_pin,'')) <> '81dc9bdb52d04dc20036dbd8313ed055'
 then raise exception 'Lehrpersonen-Passwort ungültig'; end if;
 if length(trim(coalesce(p_title,''))) > 60 then raise exception 'Titel ist zu lang'; end if;
 v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
 for v_try in 1..80 loop
  v_code := lpad((floor(random()*10000)::integer)::text,4,'0');
  insert into am_private.rooms(code,title,host_hash)
   values(v_code,coalesce(nullif(trim(p_title),''),'AlpenManager'),md5(v_token))
   on conflict (code) do nothing returning id into v_id;
  exit when v_id is not null;
 end loop;
 if v_id is null then raise exception 'Kein freier Spielcode gefunden. Alte Spielrunden bei Bedarf löschen.'; end if;
 return jsonb_build_object('code',v_code,'token',v_token,'role','host');
end; $$;

-- Alte Join-Signatur entfernen, damit Teams nicht mehr manuell eine Nummer wählen können.
drop function if exists public.am_join_room(text,integer,text);

-- 2. Der Server weist unter Raumsperre atomar den ersten freien Platz zu.
-- Gleichzeitig beitretende Teams können deshalb nicht denselben Slot bekommen.
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
 from generate_series(1,3) as available(slot)
 where not exists(
   select 1 from am_private.teams t where t.room_id=v_room.id and t.slot=available.slot
 )
 order by available.slot limit 1;
 if v_slot is null then raise exception 'Alle drei Skigebiete sind bereits vergeben'; end if;
 v_token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into am_private.teams(room_id,slot,name,access_hash)
 values(v_room.id,v_slot,v_name,md5(v_token));
 update am_private.rooms set last_activity=now(),version=version+1 where id=v_room.id;
 return jsonb_build_object('code',v_room.code,'token',v_token,'role','team','slot',v_slot);
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
  'slot',v_slot,'season',v_room.season,'phase',v_room.phase,
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
 if v_room.last_activity <= now() - interval '10 minutes'
 then raise exception 'Spielrunde wegen Inaktivität beendet'; end if;
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
 update am_private.rooms set last_activity=now(),version=version+1 where id=v_room.id;
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
 if v_room.last_activity <= now() - interval '10 minutes'
 then raise exception 'Spielrunde wegen Inaktivität beendet'; end if;
 if p_action='start' and v_room.phase='lobby' then
  if (select count(*) from am_private.teams where room_id=v_room.id)<>3
  then raise exception 'Zuerst müssen alle drei Teams beitreten'; end if;
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

-- 6. Saison atomar abschliessen: nur die Lehrperson veröffentlicht alle drei Resultate.
-- Auswertung nur nach ausdrücklicher Freigabe, ab drei gespeicherten Entscheidungen oder Fristende.
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
   (select count(*) from am_private.teams where room_id=v_room.id and ready)<>3
 then raise exception 'Vor Ablauf der Entscheidungszeit müssen alle drei Teams gespeichert haben'; end if;
 if jsonb_typeof(p_states)<>'array' or jsonb_array_length(p_states)<>3
 then raise exception 'Es werden drei Teamresultate benötigt'; end if;
 if (select count(*) from am_private.teams where room_id=v_room.id)<>3
 then raise exception 'Drei Teams erforderlich'; end if;
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

-- 7. Read-only Beamer-Dashboard, geschützt durch den festgelegten Lehrpersonen-PIN.
-- Der PIN erteilt niemals Schreibrechte und verrät keine Team-Zugangstokens.
-- Hinweis: Ein vierstelliger PIN ist nur eine einfache Unterrichtszugangssperre.
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
   'season',v_room.season,'phase',v_room.phase,
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

-- Nur echte, authentifizierte Browserinteraktionen verlängern die Frist.
-- Das automatische Polling nutzt diese Funktion ausdrücklich NICHT.
create or replace function public.am_touch_room(p_code text,p_token text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_room am_private.rooms%rowtype;
begin
 select * into v_room from am_private.rooms where code=upper(trim(p_code)) for update;
 if not found or length(coalesce(p_token,''))<40
 then raise exception 'Spielcode oder Zugang ungültig'; end if;
 if md5(p_token)<>v_room.host_hash and not exists(
   select 1 from am_private.teams
   where room_id=v_room.id and access_hash=md5(p_token)
 ) then raise exception 'Spielcode oder Zugang ungültig'; end if;
 if v_room.last_activity <= now() - interval '10 minutes'
 then raise exception 'Spielrunde wegen Inaktivität beendet'; end if;
 update am_private.rooms set last_activity=now() where id=v_room.id;
 return jsonb_build_object('ok',true);
end; $$;

-- API-Rechte: niemals private Tabellen freigeben!
revoke all on function public.am_touch_room(text,text) from public,anon,authenticated;
revoke all on function public.am_verify_teacher(text) from public,anon,authenticated;
revoke all on function public.am_create_room(text,text) from public,anon,authenticated;
revoke all on function public.am_join_room(text,text) from public,anon,authenticated;
revoke all on function public.am_read_room(text,text) from public,anon,authenticated;
revoke all on function public.am_save_choice(text,text,jsonb) from public,anon,authenticated;
revoke all on function public.am_control(text,text,text) from public,anon,authenticated;
revoke all on function public.am_publish_results(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.am_touch_room(text,text) to anon,authenticated;
grant execute on function public.am_verify_teacher(text) to anon,authenticated;
grant execute on function public.am_create_room(text,text) to anon,authenticated;
grant execute on function public.am_join_room(text,text) to anon,authenticated;
grant execute on function public.am_read_room(text,text) to anon,authenticated;
grant execute on function public.am_save_choice(text,text,jsonb) to anon,authenticated;
grant execute on function public.am_control(text,text,text) to anon,authenticated;
grant execute on function public.am_publish_results(text,text,jsonb) to anon,authenticated;
revoke all on function public.am_projector_room(text,text) from public,anon,authenticated;
grant execute on function public.am_projector_room(text,text) to anon,authenticated;

-- Supabase Cron löscht auch dann, wenn alle Browser geschlossen sind.
-- Löschung erfolgt bei der nächsten minütlichen Prüfung nach 10 Minuten.
-- Teams werden durch ON DELETE CASCADE mitgelöscht.
-- pg_cron wird bewusst NICHT per SQL installiert: Auf manchen Supabase-Projekten
-- schlägt dessen Installationsskript mit "2BP01: dependent privileges exist" fehl.
-- Aktivierung im Dashboard unter Integrations > Cron.
-- Fehlt die Erweiterung noch, bleibt das Datenbank-Update gültig. Nach der
-- Aktivierung dieses Skript erneut ausführen, damit der Löschjob angelegt wird.
do $setup_alpenmanager_cron$
begin
 if exists (select 1 from pg_extension where extname='pg_cron') then
  perform cron.schedule(
   'alpenmanager-inaktive-spiele',
   '* * * * *',
   $job$delete from am_private.rooms
         where last_activity <= now() - interval '10 minutes'$job$
  );
  raise notice 'AlpenManager: automatischer Löschjob eingerichtet.';
 else
  raise notice 'AlpenManager: pg_cron ist noch nicht aktiviert. Unter Integrations > Cron aktivieren und dieses SQL-Skript erneut ausführen.';
 end if;
end;
$setup_alpenmanager_cron$;

-- Optionaler Funktionstest im SQL Editor:
-- select public.am_verify_teacher('1234');
-- select public.am_create_room('Test AlpenManager', '1234');
-- Achtung: Dies erzeugt einen neuen Test-Spielcode samt geheimem Lehrpersonen-Token.
