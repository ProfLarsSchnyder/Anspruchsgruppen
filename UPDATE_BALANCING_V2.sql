-- AlpenManager Balancing V2: Freestyle-Park und Wellness-Lounge in der Online-Spielrunde freigeben.
-- Für bestehende Installationen nach UPDATE_SPIELZEITEN_10_MIN.sql ausführen.
-- Keine Daten werden gelöscht; bestehende Spielrunden und Spielstände bleiben erhalten.
-- Eine neu installierte Datenbank mit dem aktuellen supabase_setup.sql benötigt diese Migration nicht.

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
 or v_invest not in ('none','lift','snow','eco','service','family','staffHome','shuttle','digital','freestyle','wellness')
 then raise exception 'Entscheidungen ausserhalb der erlaubten Grenzen'; end if;
 if v_invest<>'none' and coalesce((v_team.state->'assets'->>v_invest)::integer,0)>0
 then raise exception 'Diese Investition wurde bereits gekauft'; end if;
 update am_private.teams set choice=p_choice,ready=true,updated_at=now() where id=v_team.id;
 update am_private.rooms set last_activity=now(),version=version+1 where id=v_room.id;
 return jsonb_build_object('ok',true,'slot',v_team.slot);
end; $$;
