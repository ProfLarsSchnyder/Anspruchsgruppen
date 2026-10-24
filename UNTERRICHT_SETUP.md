# AlpenManager – Einrichtung und Unterrichtseinsatz

## Einmaliges Supabase-Setup
1. Supabase-Projekt `xvgbisxwptnfupibcbpg` öffnen und links **SQL Editor → New query** wählen.
2. **Den vollständigen Inhalt von `supabase_setup.sql`** in den Editor kopieren und auf **Run** klicken. Wurde das Skript früher schon ausgeführt, kann das vollständige Skript erneut ausgeführt werden; die Tabellen werden beibehalten und die Funktionen aktualisiert.
3. Der Publishable Key und die Supabase-Adresse sind bereits in `multiplayer.js` hinterlegt. Niemals geheime API-Schlüssel ins GitHub-Repository einfügen.
4. Online-Version öffnen: https://proflarsschnyder.github.io/Anspruchsgruppen/

## Rollen und Start
- **Lehrpersonen-Dashboard:** Auf der öffentlichen Startseite «Lehrpersonen-Dashboard» wählen und das Lehrpersonen-Passwort **1234** eingeben. Erst nach dieser Anmeldung erscheint **Neue Spielrunde**.
- **Spiel erstellen:** Nur über das Lehrpersonen-Dashboard. Nach dem Erstellen öffnet sich **direkt die gemeinsame Lehrer- und Beamer-Ansicht** mit Spielcode, Teamstatus, Countdown und Spielsteuerung. Die Datenbank verlangt für die Erstellung ebenfalls das richtige Passwort. Der geheime Steuerungszugang bleibt auf dem Lehrpersonengerät gespeichert.
- **Spiel beitreten:** Drei echte Teams wählen auf der öffentlichen Startseite ein Skigebiet und geben den Spielcode ein. Dafür ist kein Passwort nötig.
- **Kombiniertes Dashboard:** Es gibt keine separate Beamer-Kachel mehr. Das Dashboard kann direkt auf dem Beamer bzw. im Vollbild gezeigt werden; die Lehrperson bedient darin die Buttons «Spiel starten», «Strategiephase starten», «Saison auswerten» und «Nächste Saison». Die bisherige eigenständige Nur-Anzeige-Ansicht bleibt technisch für bestehende Links verfügbar, wird aber im normalen Ablauf nicht benötigt.
- **Schutz:** Das vierstellige Passwort ist eine einfache Unterrichtszugangssperre, keine starke Benutzer-Authentifizierung. Das gemeinsame Lehrer-/Beamer-Dashboard besitzt Steuerungsrechte und gehört ausschliesslich auf das Lehrpersonengerät. Lernende erhalten keine Host-Tokens.

## Eine vollständige Spielrunde
1. Die Lehrperson meldet sich an und erstellt die Online-Spielrunde. **Im selben Tab** erscheint sofort das kombinierte Lehrer-/Beamer-Dashboard mit dem sechsstelligen Spielcode. Danach treten alle drei Teams bei; die Lehrperson klickt dort auf **Spiel starten**.
2. Das gemeinsame Saisonereignis erscheint auf allen Geräten und im Dashboard.
3. Die Spielleitung klickt **Strategiephase starten**. Der serverseitig terminierte Countdown beträgt vier Minuten.
4. Die Teams können ihre eigenen Entscheidungen speichern und bis zum Zeitablauf aktualisieren. Nach Ablauf werden weitere Änderungen vom Server abgelehnt.
5. Sobald alle Teams eingereicht haben, kann die Spielleitung schon früher **Saison auswerten** wählen. Sonst wird die Saison nach Zeitablauf auf dem offenen Spielleitungsgerät berechnet.
6. Alle drei Teams erhalten ihren ausführlichen Saisonbericht. Im gemeinsamen Dashboard erscheinen Rangliste, kumulierter Gewinn, Gäste, Anspruchsgruppen und Diagramme.
7. Die Spielleitung startet im selben Dashboard die nächste Saison. Nach fünf Saisons erscheint die erweiterte Schlussrangliste mit Podest, Teamkennzahlen und Bestwerten.

## Technische Hinweise
- Die Browser aktualisieren den Spielzustand etwa alle zwei Sekunden. Bei langsamem Internet können kurze Verzögerungen auftreten.
- Das **Lehrpersonen-Dashboard muss geöffnet bleiben**, damit die Saison nach Ablauf des Countdowns zentral berechnet wird. Es umfasst sowohl Beameranzeige als auch Steuerung. Ein älterer separater Nur-Anzeige-Tab kann die Saison weiterhin nicht steuern.
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
- Gleicher Countdown auf allen Geräten, automatische Sperre nach Zeitablauf.
- Saisonergebnisse und Schlussrangliste stimmen auf allen Geräten überein.
