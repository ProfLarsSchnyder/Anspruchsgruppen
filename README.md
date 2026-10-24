# AlpenManager – Anspruchsgruppen

Online-Planspiel für Wirtschaft und Recht: Drei Skigebiete konkurrieren während fünf Wintersaisons. Die Spielleitung steuert alle Phasen, die Lernenden treffen ihre Entscheidungen auf separaten Geräten.

## Online spielen

https://proflarsschnyder.github.io/Anspruchsgruppen/

1. Lehrperson meldet sich mit dem Unterrichts-Passwort **1234** an und erstellt eine Spielrunde.
2. Im kombinierten Lehrer-/Beamer-Dashboard erscheint ein **vierstelliger Zahlencode**.
3. Drei Teams geben Code und Skigebietsname ein. Die Zuteilung zu Skigebiet 1, 2 und 3 erfolgt **automatisch**.
4. Die Lehrperson startet das Spiel und gibt die Strategiephase frei: **6 Minuten in Saison 1, 3 Minuten in den Saisons 2 bis 5**.
5. Teams speichern ihre Entscheidungen. Die Lehrperson kann die Saison **manuell** auswerten, sobald alle drei Entscheidungen gespeichert sind oder die jeweilige Strategiezeit abgelaufen ist.
6. Saisonbericht, Rangliste und die nächste Saison werden von der Lehrperson freigegeben. Die Schlussrangliste erscheint nach Saison fünf.

## Supabase einrichten oder aktualisieren

- **Neuinstallation:** Datei [supabase_setup.sql](supabase_setup.sql) vollständig im Supabase SQL Editor ausführen.
- **Bereits eingerichtete Datenbank:** [UPDATE_SPIELZEITEN_10_MIN.sql](UPDATE_SPIELZEITEN_10_MIN.sql) vollständig im Supabase SQL Editor ausführen. Falls Cron noch nicht aktiviert ist, vorher unter **Integrations → Cron** aktivieren. Die bisherigen Migrationsdateien `UPDATE_4_STELLIG_SUPABASE.sql` und `UPDATE_5_MIN_INAKTIVITAET.sql` sind ältere Zwischenschritte und sollen danach nicht erneut ausgeführt werden.
- Der Supabase-Publishable-Key darf öffentlich sein. Geheime Datenbank- oder Service-Role-Keys gehören niemals ins Repository.
- Alte Spielrunden behalten ihre sechsstelligen Codes. Für einen neuen Unterrichtsdurchlauf nach dem SQL-Update eine **neue Spielrunde** erstellen.

**Automatische Bereinigung:** Nach zehn Minuten ohne echte Bedienung der Lehrperson oder eines Teams löscht Supabase die Spielrunde und alle drei Teamdatensätze. Eingaben und Steuerungsaktionen verlängern die Frist, automatische Statusabfragen nicht. Supabase Cron prüft einmal pro Minute, daher kann die endgültige Löschung bis zu etwa einer Minute später erfolgen. Die lokale Demo ist nicht betroffen.

Weitere Unterrichtshinweise und Prüfliste: [UNTERRICHT_SETUP.md](UNTERRICHT_SETUP.md).

## Spielmechanik

Strategische Entscheidungen zu Ticketpreis, Personal, Löhnen, Marketing, Zielgruppe, Wartung, Investitionen und Lieferanten wirken auf Finanzen, Gästezahlen und sieben Anspruchsgruppen. Die Abschlussbewertung gewichtet Wirtschaft zu 40 %, Anspruchsgruppen zu 40 % und Zukunftsfähigkeit zu 20 %. Die lokale Demo im Lehrpersonenbereich ist unabhängig von Supabase.
