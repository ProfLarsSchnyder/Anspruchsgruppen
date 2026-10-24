# AlpenManager – Einrichtung und Unterrichtseinsatz

## Einmaliges Supabase-Setup
1. Supabase-Projekt `xvgbisxwptnfupibcbpg` öffnen und links **SQL Editor → New query** wählen.
2. **Cron aktivieren:** Unter **Integrations → Cron** die Erweiterung `pg_cron` im Supabase-Dashboard einschalten. Nicht versuchen, sie über ein eigenes `CREATE EXTENSION` in die Spiel-SQL-Datei einzubauen, da das auf manchen Projekten den Berechtigungsfehler `2BP01` auslösen kann.
3. **Neue Datenbank:** `supabase_setup.sql` vollständig im SQL Editor ausführen. **Bereits eingerichtete Datenbank:** Nur die neueste Datei `UPDATE_SPIELZEITEN_10_MIN.sql` vollständig ausführen. Frühere SQL-Updates nicht anschliessend erneut ausführen. Die bisherigen Spielstände und Tabellen bleiben erhalten.
4. Der Publishable Key und die Supabase-Adresse sind bereits in `multiplayer.js` hinterlegt. Niemals geheime API-Schlüssel ins GitHub-Repository einfügen.
5. Online-Version öffnen: https://proflarsschnyder.github.io/Anspruchsgruppen/

## Rollen und Start
- **Lehrpersonen-Dashboard:** Auf der öffentlichen Startseite «Lehrpersonen-Dashboard» wählen und das Lehrpersonen-Passwort **1234** eingeben. Erst nach dieser Anmeldung erscheint **Neue Spielrunde**.
- **Spiel erstellen:** Nur über das Lehrpersonen-Dashboard. Nach dem Erstellen öffnet sich **direkt die gemeinsame Lehrer- und Beamer-Ansicht** mit Spielcode, Teamstatus, Countdown und Spielsteuerung. Die Datenbank verlangt für die Erstellung ebenfalls das richtige Passwort. Der geheime Steuerungszugang bleibt auf dem Lehrpersonengerät gespeichert.
- **Spiel beitreten:** Drei Teams geben auf der Startseite nur den vierstelligen Spielcode und einen Namen ein. Supabase weist automatisch die freien Plätze 1, 2 und 3 zu. Dafür ist kein Passwort nötig.
- **Kombiniertes Dashboard:** Es gibt keine separate Beamer-Kachel mehr. Das Dashboard kann direkt auf dem Beamer bzw. im Vollbild gezeigt werden; die Lehrperson bedient darin die Buttons «Spiel starten», «Strategiephase starten», «Saison auswerten» und «Nächste Saison». Die bisherige eigenständige Nur-Anzeige-Ansicht bleibt technisch für bestehende Links verfügbar, wird aber im normalen Ablauf nicht benötigt.
- **Schutz:** Das vierstellige Passwort ist eine einfache Unterrichtszugangssperre, keine starke Benutzer-Authentifizierung. Das gemeinsame Lehrer-/Beamer-Dashboard besitzt Steuerungsrechte und gehört ausschliesslich auf das Lehrpersonengerät. Lernende erhalten keine Host-Tokens.

## Eine vollständige Spielrunde
1. Die Lehrperson meldet sich an und erstellt die Online-Spielrunde. **Im selben Tab** erscheint sofort das kombinierte Lehrer-/Beamer-Dashboard mit dem vierstelligen Zahlencode. Danach treten alle drei Teams bei; die Lehrperson klickt dort auf **Spiel starten**.
2. Das gemeinsame Saisonereignis erscheint auf allen Geräten und im Dashboard.
3. Die Spielleitung klickt **Strategiephase starten**. Der gemeinsame Countdown beträgt **6 Minuten in Saison 1 und je 3 Minuten in Saison 2 bis 5**.
4. Die Teams können ihre eigenen Entscheidungen speichern und bis zum Zeitablauf aktualisieren. Nach Ablauf werden weitere Änderungen vom Server abgelehnt.
5. Sobald alle Teams eingereicht haben, kann die Spielleitung schon früher **Saison auswerten** wählen. Andernfalls wird die Auswertung erst **nach Ablauf der jeweiligen Strategiezeit freigeschaltet**. In beiden Fällen klickt **ausschliesslich die Lehrperson** auf «Saison auswerten». Es gibt keinen automatischen Rundenwechsel.
6. Alle drei Teams erhalten ihren ausführlichen Saisonbericht. Im gemeinsamen Dashboard erscheinen Rangliste, kumulierter Gewinn, Gäste, Anspruchsgruppen und Diagramme.
7. Die Spielleitung startet im selben Dashboard die nächste Saison. Nach fünf Saisons erscheint die erweiterte Schlussrangliste mit Podest, Teamkennzahlen und Bestwerten.

## Technische Hinweise
- Die Browser aktualisieren den Spielzustand etwa alle zwei Sekunden. Bei langsamem Internet können kurze Verzögerungen auftreten.
- **Automatische Löschung:** Nach zehn Minuten ohne Bedienung auf sämtlichen Geräten wird der gesamte Raum mit allen Teams, Entscheidungen und Ergebnissen gelöscht. Das gilt in allen Phasen, auch bei Eilmeldung, Strategiephase und Zwischenfazit. Deshalb aktiv bleiben, wenn die Spielrunde weitergeführt werden soll.
- Tastatur, Maus, Touch-/Pointereingaben sowie Scrollen im Spiel verlängern die Frist, höchstens etwa alle 20 Sekunden mit einer authentifizierten Servermeldung. Reine Hintergrundabfragen und ein offen stehender Beamer verhindern die Löschung nicht.
- **Supabase Cron:** Der Job `alpenmanager-inaktive-spiele` prüft minütlich auf abgelaufene Partien. Die eigentliche Löschung kann daher bis rund eine Minute nach den zehn Minuten erfolgen. Browser mit gelöschter Runde gelangen beim nächsten Statusabruf zurück zur Startseite.
- Das kombinierte **Lehrpersonen-Dashboard** ist gleichzeitig Beameransicht und Spielsteuerung. Es bleibt auch bei der Eilmeldung bedienbar. Nach einem Neuladen kann die Lehrperson die Spielrunde fortsetzen und die Auswertung selbst freigeben.
- Der Steuerungszugang wird im lokalen Speicher des Spielleitungsbrowsers gespeichert; ein normales Neuladen ist möglich. Wer «Verbindung verlassen» wählt, löscht diesen Zugang auf dem Gerät. Bitte nicht vor Spielende tun.
- Die Anmeldung im Lehrpersonen-Dashboard wird serverseitig geprüft. Das Passwort für die Erstellung wird nur vorübergehend im Arbeitsspeicher gehalten; die laufende Partie wird über den geheimen Host-Token gesteuert.
- Das Spiel ist nur für **drei echte Teams** ausgelegt. Es wurden keine Computerteams und kein neuer Solo-Testmodus eingebaut.
- **Lokale Demo** ist nur im angemeldeten Lehrpersonen-Dashboard erreichbar, verwendet keine Online-Datenbank und bleibt von den Spielrunden getrennt.
- Aus den Erfahrungen einer ersten echten Unterrichtsrunde können spätere kleinere Verbesserungen entstehen. Die Wirtschaftssimulation bleibt vorerst unverändert.

## Prüfliste vor dem ersten Unterricht
- SQL-Editor meldet Erfolg und die Funktion `am_projector_room` ist verfügbar.
- Auf der Startseite können Lernende nur beitreten. Eine neue Spielrunde lässt sich erst nach Eingabe des Lehrpersonen-Passworts erstellen.
- Die Datenbank enthält keine ungeschützte alte Funktion `am_create_room(text)` mehr.
- Nach der Passwortanmeldung und dem Erstellen öffnet sich automatisch die kombinierte Lehrer-/Beamer-Ansicht mit Spielcode und Steuerbuttons.
- Alle drei Skigebiete sind auf unterschiedlichen Geräten beigetreten.
- Gleicher Countdown auf allen Geräten, automatische Sperre nach Zeitablauf, aber **keine automatische Auswertung**. Der Lehrerbutton ist erst nach drei gespeicherten Entscheidungen oder nach Ablauf der jeweiligen Strategiezeit aktiv.
- Saisonergebnisse und Schlussrangliste stimmen auf allen Geräten überein.
- In Supabase unter Integrations → Cron prüfen, ob `alpenmanager-inaktive-spiele` aktiv ist. Falls Cron erst nach dem SQL-Update aktiviert wurde, die SQL-Datei nochmals ausführen, um den Job anzulegen. Solange der Job fehlt, funktioniert die Bereinigung bei geschlossenen Browsern noch nicht.
- Für einen kurzen Funktionstest kann in einem **separaten Testspiel** ein Raum zehn Minuten unbedient bleiben. Anschliessend höchstens eine weitere Minute für den Cron-Lauf einplanen. Nicht mit einer echten Unterrichtspartie testen.
