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
- **Bestehende Installation:** Wenn [UPDATE_SPIELZEITEN_10_MIN.sql](UPDATE_SPIELZEITEN_10_MIN.sql) bereits installiert ist, nur [UPDATE_BALANCING_V2.sql](UPDATE_BALANCING_V2.sql) im SQL Editor ausführen. Andernfalls zuerst das Spielzeiten-/Inaktivitätsupdate, danach Balancing V2 ausführen. Cron bei Bedarf unter **Integrations → Cron** aktivieren. Die älteren Zwischenupdates nicht nachträglich ausführen.
- Der Supabase-Publishable-Key darf öffentlich sein. Geheime Datenbank- oder Service-Role-Keys gehören niemals ins Repository.
- Alte Spielrunden behalten ihre sechsstelligen Codes. Für einen neuen Unterrichtsdurchlauf nach dem SQL-Update eine **neue Spielrunde** erstellen.

**Automatische Bereinigung:** Nach zehn Minuten ohne echte Bedienung der Lehrperson oder eines Teams löscht Supabase die Spielrunde und alle drei Teamdatensätze. Eingaben und Steuerungsaktionen verlängern die Frist, automatische Statusabfragen nicht. Supabase Cron prüft einmal pro Minute, daher kann die endgültige Löschung bis zu etwa einer Minute später erfolgen. Die lokale Demo ist nicht betroffen.

Weitere Unterrichtshinweise und Prüfliste: [UNTERRICHT_SETUP.md](UNTERRICHT_SETUP.md).

## Spielmechanik

Strategische Entscheidungen zu Ticketpreis, Personal, Löhnen, Marketing, Zielgruppe, Wartung, Investitionen und Lieferanten wirken auf Finanzen, Gästezahlen und sieben Anspruchsgruppen. Die Abschlussbewertung gewichtet Wirtschaft zu 40 %, Anspruchsgruppen zu 40 % und Zukunftsfähigkeit zu 20 %. Die lokale Demo im Lehrpersonenbereich ist unabhängig von Supabase.

### Balancing V2 (November 2026)
- Marktanteile: Familien 32 %, junge Erwachsene 28 %, sportliche Gäste 25 %, Premiumgäste 15 %.
- Das Kinderland bleibt eine Familieninvestition, sein Nachfragebonus ist leicht reduziert.
- Premiumgäste reagieren weniger stark auf den Preisaufschlag oberhalb von CHF 75. Eine erfolgreiche Premiumstrategie benötigt jedoch Investitionen und tragfähige Kosten.
- **Neu:** Freestyle-Park mit Halfpipe (CHF 350'000, sportliche Gäste +14 % Attraktivität, junge Erwachsene +4 %, CHF 45'000 Unterhalt je Saison).
- **Neu:** Wellness- und Premium-Lounge (CHF 350'000, Premiumgäste +40 % Attraktivität, andere +4 %; CHF 60'000 Betriebskosten je Saison). Bei Premiumpositionierung bringt sie zusätzlich CHF 10 Nebenertrag je Gast, sonst CHF 1.
- Die bisherigen Investitionen einschliesslich der Beschneiungsanlage bleiben erhalten.
- **Wichtig:** Die Online-Version akzeptiert die neuen Investitionen erst nach Ausführung von `UPDATE_BALANCING_V2.sql` in Supabase.
