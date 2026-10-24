-- AlpenManager Update: vierstellige Spielcodes, automatische Teamzuordnung,
-- ausdrückliche Freigabe der Saisonauswertung.
-- Im Supabase SQL Editor als GANZES ausführen. Vorhandene Tabellen/Spiele bleiben erhalten.
-- Enthält bewusst keine PIN-Änderung: Lehrpersonen-PIN bleibt 1234.

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
 update am_private.rooms set version=version+1 where id=v_room.id;
 return jsonb_build_object('code',v_room.code,'token',v_token,'role','team','slot',v_slot);
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
 if v_room.phase<>'decision' then raise exception 'Die Saison wurde bereits beendet oder noch nicht gestartet'; end if;
 if now()<v_room.deadline and
   (select count(*) from am_private.teams where room_id=v_room.id and ready)=0
 then raise exception 'Es wurden noch keine Entscheidungen gespeichert'; end if;
 if now()<v_room.deadline and
   (select count(*) from am_private.teams where room_id=v_room.id and ready)<>3
 then raise exception 'Vor Ablauf der vier Minuten müssen alle drei Teams gespeichert haben'; end if;
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
  deadline=null,version=version+1 where id=v_room.id;
 return jsonb_build_object('ok',true,'season',v_room.season,'results',v_summary);
end; $$;

revoke all on function public.am_join_room(text,text) from public,anon,authenticated;
grant execute on function public.am_join_room(text,text) to anon,authenticated;
revoke all on function public.am_create_room(text,text) from public,anon,authenticated;
grant execute on function public.am_create_room(text,text) to anon,authenticated;
revoke all on function public.am_publish_results(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.am_publish_results(text,text,jsonb) to anon,authenticated;
