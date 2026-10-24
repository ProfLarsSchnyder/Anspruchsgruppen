-- AlpenManager: Lehrpersonen-PIN von 4208 auf 1234 umstellen.
-- Nur ausführen, wenn die Supabase-Datenbank bereits eingerichtet ist.
-- Vorhandene Spielrunden, Teams und Ergebnisse bleiben unverändert.
-- Falls noch keine Einrichtung erfolgt ist: Stattdessen die aktuelle
-- supabase_setup.sql vollständig ausführen.
DO $change_teacher_pin$
DECLARE
  signature text;
  ddl text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.am_verify_teacher(text)',
    'public.am_create_room(text,text)',
    'public.am_projector_room(text,text)'
  ]
  LOOP
    IF to_regprocedure(signature) IS NULL THEN
      RAISE EXCEPTION 'Funktion % fehlt: zuerst supabase_setup.sql ausführen.', signature;
    END IF;
    ddl := pg_get_functiondef(to_regprocedure(signature));
    IF position('81dc9bdb52d04dc20036dbd8313ed055' IN ddl) > 0 THEN
      CONTINUE; -- bereits auf 1234 aktualisiert
    END IF;
    IF position('4a71e49f6bda0c9b7642f39f1aa1f567' IN ddl) = 0 THEN
      RAISE EXCEPTION 'Unerwarteter PIN-Check in Funktion %, keine Änderung.', signature;
    END IF;
    EXECUTE replace(
      ddl,
      '4a71e49f6bda0c9b7642f39f1aa1f567',
      '81dc9bdb52d04dc20036dbd8313ed055'
    );
  END LOOP;
END;
$change_teacher_pin$;

-- Optional zum Prüfen:
-- select public.am_verify_teacher('1234');
