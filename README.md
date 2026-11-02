# AlpenManager – Anspruchsgruppen

Online-Planspiel für Wirtschaft und Recht: Wahlweise drei oder fünf Skigebiete konkurrieren während fünf Wintersaisons. Die Spielleitung steuert alle Phasen, die Lernenden treffen ihre Entscheidungen auf separaten Geräten.

## Online spielen

https://proflarsschnyder.github.io/Anspruchsgruppen/

1. Lehrperson meldet sich mit dem Unterrichts-Passwort **1234** an und wählt beim Erstellen **3 oder 5 Skigebiete**.
2. Im kombinierten Lehrer-/Beamer-Dashboard erscheint ein **vierstelliger Zahlencode**.
3. Drei bzw. fünf Teams geben Spielcode und Skigebietsname ein. Die Plätze 1 bis 3 beziehungsweise 1 bis 5 werden **automatisch** vergeben.
4. Die Lehrperson startet das Spiel und gibt die Strategiephase frei: **6 Minuten in Saison 1, 3 Minuten in den Saisons 2 bis 5**.
5. Teams speichern ihre Entscheidungen. Die Lehrperson kann die Saison **manuell** auswerten, sobald alle Entscheidungen gespeichert sind oder die jeweilige Strategiezeit abgelaufen ist.
6. Saisonbericht, Rangliste und die nächste Saison werden von der Lehrperson freigegeben. Die Schlussrangliste erscheint nach Saison fünf.

## Supabase einrichten oder aktualisieren

- **Neuinstallation:** Datei [supabase_setup.sql](supabase_setup.sql) vollständig im Supabase SQL Editor ausführen.
- **Bestehende Installation:** Zuerst sicherstellen, dass [UPDATE_SPIELZEITEN_10_MIN.sql](UPDATE_SPIELZEITEN_10_MIN.sql) und [UPDATE_BALANCING_V2.sql](UPDATE_BALANCING_V2.sql) installiert sind. Danach **[UPDATE_5_TEAM_MODE.sql](UPDATE_5_TEAM_MODE.sql)** vollständig im SQL Editor ausführen. Nur diese letzte Datei ist für die neue Teamanzahl nötig, wenn die bisherigen Updates bereits vorhanden sind. Bestehende 3er-Runden bleiben erhalten.
- Der Supabase-Publishable-Key darf öffentlich sein. Geheime Datenbank- oder Service-Role-Keys gehören niemals ins Repository.
- Alte Spielrunden behalten ihre sechsstelligen Codes. Für einen neuen Unterrichtsdurchlauf nach dem SQL-Update eine **neue Spielrunde** erstellen.

**Automatische Bereinigung:** Nach zehn Minuten ohne echte Bedienung der Lehrperson oder eines Teams löscht Supabase die Spielrunde und alle Teamdatensätze. Eingaben und Steuerungsaktionen verlängern die Frist, automatische Statusabfragen nicht. Supabase Cron prüft einmal pro Minute, daher kann die endgültige Löschung bis zu etwa einer Minute später erfolgen. Die lokale Demo ist nicht betroffen.

Weitere Unterrichtshinweise und Prüfliste: [UNTERRICHT_SETUP.md](UNTERRICHT_SETUP.md).

## Spielmodus und Balancing
- **3 Teams:** Unveränderte Originalmechanik aus V4, Marktvolumen 240'000 potenzielle Gäste. Die fünf Ereignisse, Investitionen, Preise und Schlusswertung sind unverändert.
- **5 Teams:** Separat kalibrierter Gästemarkt mit 410'000 potenziellen Gästen. Dadurch konkurrieren fünf Unternehmen um einen entsprechend grösseren Markt. Die vier Zielgruppenanteile, Preis- und Investitionsregeln sowie der Bewertungsmassstab bleiben identisch. Eine faire Konkurrenzsituation entsteht weiterhin durch Entscheidungen und Nachfrage.
- Bei fünf Teams erscheinen alle fünf Plätze, Ergebnisse und Linien im Lehrer-/Beamer-Dashboard und in der Schlussrangliste. Auch die lokale Demo und die Vorschau können mit fünf Teams getestet werden.
- Nach einer Installation von `UPDATE_5_TEAM_MODE.sql` kann die Lehrperson die Teamanzahl **vor dem Erstellen** auswählen. Für bestehende Spielrunden ist sie nicht nachträglich änderbar.
- Die SQL-Datei gibt nur zwei zusätzliche Slots und eine geprüfte 3-oder-5-Team-Auswahl frei. Die bisherigen Zeit- und Zugriffsregeln bleiben erhalten.

## Spielmechanik

Strategische Entscheidungen zu Ticketpreis, Personal, Löhnen, Marketing, Zielgruppe, Wartung, Investitionen und Lieferanten wirken auf Finanzen, Gästezahlen und sieben Anspruchsgruppen. Die Abschlussbewertung gewichtet Wirtschaft zu 40 %, Anspruchsgruppen zu 40 % und Zukunftsfähigkeit zu 20 %. Die lokale Demo im Lehrpersonenbereich ist unabhängig von Supabase.

### Balancing V4: leichte Nachjustierung (November 2026)
- **Familien:** Der Nachfragebonus des Kinderlands beträgt jetzt höchstens 10 % statt bisher 12 %, abhängig vom Ticketpreis. Preis und Unterhaltskosten der Investition bleiben unverändert.
- **Sportliche Gäste:** Die Halfpipe steigert die Attraktivität für sportliche Gäste um 18 % statt 14 %. Der Bonus für junge Erwachsene bleibt bei 4 %. Preis und Betriebskosten bleiben unverändert.
- Alle vier Marktsegmente, Premium-V3-Regeln, die sieben Anspruchsgruppen sowie Investitionskosten und SQL-Schema bleiben gleich. Für V4 ist keine zusätzliche SQL-Migration erforderlich, sofern V2 installiert ist.
- **Regressionstest:** In 1'200 identischen Dreierpartien mit zufällig zusammengestellten, plausiblen Strategien sank die Familien-Siegquote von 52,3 % auf 49,4 %; Sport stieg von 23,1 % auf 25,2 %. Junge Gäste 32,6 % auf 33,5 %, Premium 26,0 % auf 25,8 %. Die Zielgruppen wurden unterschiedlich oft gezogen, deshalb addieren sich diese bedingten Quoten nicht zu 100 %.

### Balancing V3: Premiumpreis und Qualität (November 2026)
- **Premium-Sweetspot:** CHF 85 bis 90 statt CHF 75 bis 80, sofern Wellness-Lounge, mindestens 55 Mitarbeitende, CHF 160'000 Wartung und Infrastrukturqualität von mindestens 70 Punkten vorhanden sind.
- Passende Premiumpreise stärken die Attraktivität moderat und ermöglichen etwas höhere Wellness-/Gastronomie-Nebeneinnahmen; unter CHF 85 passt der Preis weniger gut zum Premiumangebot, über CHF 90 sinkt die Nachfrage deutlich.
- Der Bonus entfällt ohne Premiuminvestition oder bei vernachlässigter Qualität, Wartung oder Personal. Keine Änderungen an Investitionspreisen, Marktanteilen oder Datenbankschema gegenüber V2.
- **Balancing-Test:** Bei zwei Familiengebieten mit CHF 75 und einem Premiumgebiet mit passenden Investitionen ergaben fünf Saisons bei CHF 80 rund CHF 5,5 Mio., bei CHF 85 rund CHF 7,9 Mio., bei CHF 90 rund CHF 7,2 Mio. Premiumgewinn. Zwei Familiengebiete erzielen in der CHF-85-Variante je rund CHF 7,4 Mio. Die Schlusswertung berücksichtigt zusätzlich Anspruchsgruppen und Zukunftsfähigkeit.
- Für diese reine Berechnungsänderung ist **kein zusätzliches Supabase-SQL** erforderlich, sofern Balancing V2 bereits installiert wurde.

### Balancing V2 (November 2026)
- Marktanteile: Familien 32 %, junge Erwachsene 28 %, sportliche Gäste 25 %, Premiumgäste 15 %.
- Das Kinderland bleibt eine Familieninvestition, sein Nachfragebonus ist leicht reduziert.
- Premiumgäste reagieren weniger stark auf den Preisaufschlag oberhalb von CHF 75. Eine erfolgreiche Premiumstrategie benötigt jedoch Investitionen und tragfähige Kosten.
- **Neu:** Freestyle-Park mit Halfpipe (CHF 350'000, sportliche Gäste +14 % Attraktivität, junge Erwachsene +4 %, CHF 45'000 Unterhalt je Saison).
- **Neu:** Wellness- und Premium-Lounge (CHF 350'000, Premiumgäste +40 % Attraktivität, andere +4 %; CHF 60'000 Betriebskosten je Saison). Bei Premiumpositionierung bringt sie zusätzlich CHF 10 Nebenertrag je Gast, sonst CHF 1.
- Die bisherigen Investitionen einschliesslich der Beschneiungsanlage bleiben erhalten.
- **Wichtig:** Die Online-Version akzeptiert die neuen Investitionen erst nach Ausführung von `UPDATE_BALANCING_V2.sql` in Supabase.
