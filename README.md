# AlpenManager – Anspruchsgruppen

Online-Planspiel für Wirtschaft und Recht: Drei Skigebiete konkurrieren während fünf Wintersaisons. Die Spielleitung steuert alle Phasen, die Lernenden treffen ihre Entscheidungen auf separaten Geräten.

## Online spielen

https://proflarsschnyder.github.io/Anspruchsgruppen/

1. Lehrperson meldet sich mit dem Unterrichts-Passwort **1234** an und erstellt eine Spielrunde.
2. Im kombinierten Lehrer-/Beamer-Dashboard erscheint ein **vierstelliger Zahlencode**.
3. Drei Teams geben Code und Skigebietsname ein. Die Zuteilung zu Skigebiet 1, 2 und 3 erfolgt **automatisch**.
4. Die Lehrperson startet das Spiel und gibt nach jeder Eilmeldung die **vierminütige Strategiephase** frei.
5. Teams speichern ihre Entscheidungen. Die Lehrperson kann die Saison **manuell** auswerten, sobald alle drei Entscheidungen gespeichert sind oder die vier Minuten abgelaufen sind.
6. Saisonbericht, Rangliste und die nächste Saison werden von der Lehrperson freigegeben. Die Schlussrangliste erscheint nach Saison fünf.

## Supabase einrichten oder aktualisieren

- **Neuinstallation:** Datei [supabase_setup.sql](supabase_setup.sql) vollständig im Supabase SQL Editor ausführen.
- **Bereits eingerichtete Datenbank:** Datei [UPDATE_4_STELLIG_SUPABASE.sql](UPDATE_4_STELLIG_SUPABASE.sql) im Supabase SQL Editor ausführen, damit Spielcodes, automatische Teamzuteilung und Auswertungssperre mit dem aktuellen Browsercode übereinstimmen.
- Der Supabase-Publishable-Key darf öffentlich sein. Geheime Datenbank- oder Service-Role-Keys gehören niemals ins Repository.
- Alte Spielrunden behalten ihre sechsstelligen Codes. Für einen neuen Unterrichtsdurchlauf nach dem SQL-Update eine **neue Spielrunde** erstellen.

Weitere Unterrichtshinweise und Prüfliste: [UNTERRICHT_SETUP.md](UNTERRICHT_SETUP.md).

## Spielmechanik

Strategische Entscheidungen zu Ticketpreis, Personal, Löhnen, Marketing, Zielgruppe, Wartung, Investitionen und Lieferanten wirken auf Finanzen, Gästezahlen und sieben Anspruchsgruppen. Die Abschlussbewertung gewichtet Wirtschaft zu 40 %, Anspruchsgruppen zu 40 % und Zukunftsfähigkeit zu 20 %. Die lokale Demo im Lehrpersonenbereich ist unabhängig von Supabase.
