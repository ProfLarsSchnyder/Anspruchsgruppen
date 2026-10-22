# AlpenManager – Einrichtung und Unterrichtseinsatz

## Einmaliges Supabase-Setup
1. Supabase-Projekt `xvgbisxwptnfupibcbpg` öffnen und links **SQL Editor → New query** wählen.
2. **Den vollständigen Inhalt von `supabase_setup.sql`** in den Editor kopieren und auf **Run** klicken. Wurde das Skript früher schon ausgeführt, kann das vollständige Skript erneut ausgeführt werden; die Tabellen werden beibehalten und die Funktionen aktualisiert.
3. Der Publishable Key und die Supabase-Adresse sind bereits in `multiplayer.js` hinterlegt. Niemals geheime API-Schlüssel ins GitHub-Repository einfügen.
4. Online-Version öffnen: https://proflarsschnyder.github.io/Anspruchsgruppen/

## Rollen und Start
- **Spiel erstellen:** Jede Person kann ohne Passwort eine Online-Runde erzeugen. Die Person, welche die Runde erstellt, erhält **den exklusiven Steuerungszugang** und bleibt für die Dauer des Spiels mit dieser Browser-Ansicht verbunden.
- **Spiel beitreten:** Drei echte Teams wählen je ein eigenes Skigebiet und geben den gemeinsamen sechsstelligen Spielcode ein. Pro Team am besten ein Gerät verwenden.
- **Lehrpersonen-Dashboard:** Auf der Startseite «Lehrpersonen-Dashboard» wählen, Spielcode und das vereinbarte **vierstellige Passwort** eingeben. Alternativ aus der Spielleitung die Beamer-Ansicht in einem neuen Tab öffnen. Die Ansicht ist **schreibgeschützt** und eignet sich zum Projizieren.
- Die Dashboard-Zugriffsprüfung erfolgt in der Supabase-Datenbank. Ein vierstelliger PIN ist eine einfache Unterrichtszugangssperre, keine starke Sicherheitsmassnahme. Deshalb werden darüber keinerlei privaten Zugangstokens oder Team-Entscheidungsentwürfe ausgegeben.

## Eine vollständige Spielrunde
1. Alle drei Teams treten bei; Spielleitung klickt **Spiel starten**.
2. Das gemeinsame Saisonereignis erscheint auf allen Geräten und im Dashboard.
3. Die Spielleitung klickt **Strategiephase starten**. Der serverseitig terminierte Countdown beträgt vier Minuten.
4. Die Teams können ihre eigenen Entscheidungen speichern und bis zum Zeitablauf aktualisieren. Nach Ablauf werden weitere Änderungen vom Server abgelehnt.
5. Sobald alle Teams eingereicht haben, kann die Spielleitung schon früher **Saison auswerten** wählen. Sonst wird die Saison nach Zeitablauf auf dem offenen Spielleitungsgerät berechnet.
6. Alle drei Teams erhalten ihren ausführlichen Saisonbericht. Auf dem Beamer erscheinen Rangliste, kumulierter Gewinn, Gäste, Anspruchsgruppen und Diagramme.
7. Die Spielleitung startet die nächste Saison. Nach fünf Saisons erscheint die Schlussrangliste samt Reflexionsfragen.

## Technische Hinweise
- Die Browser aktualisieren den Spielzustand etwa alle zwei Sekunden. Bei langsamem Internet können kurze Verzögerungen auftreten.
- Das **Spielleitungsgerät muss geöffnet bleiben**, damit die Saison nach Ablauf des Countdowns zentral berechnet wird. Die Beamer-Ansicht ist absichtlich nicht dazu berechtigt, Ergebnisse zu berechnen oder Spielphasen zu verändern.
- Der Steuerungszugang wird im lokalen Speicher des Spielleitungsbrowsers gespeichert; ein normales Neuladen ist möglich. Wer «Verbindung verlassen» wählt, löscht diesen Zugang auf dem Gerät. Bitte nicht vor Spielende tun.
- Das Dashboard speichert seinen PIN nur im temporären Tab-Speicher und besitzt keine Schreibrechte.
- Das Spiel ist nur für **drei echte Teams** ausgelegt. Es wurden keine Computerteams und kein neuer Solo-Testmodus eingebaut.
- **Lokale Demo** ist ein gesonderter, bereits bestehender Ein-Gerät-Testmodus; er benutzt Supabase nicht.
- Aus den Erfahrungen einer ersten echten Unterrichtsrunde können spätere kleinere Verbesserungen entstehen. Die Wirtschaftssimulation bleibt vorerst unverändert.

## Prüfliste vor dem ersten Unterricht
- SQL-Editor meldet Erfolg und die Funktion `am_projector_room` ist verfügbar.
- Startseite lässt eine Runde ohne Lehrpersonen-Passwort erstellen.
- Beamer-Dashboard öffnet sich nur mit korrektem Passwort.
- Alle drei Skigebiete sind auf unterschiedlichen Geräten beigetreten.
- Gleicher Countdown auf allen Geräten, automatische Sperre nach Zeitablauf.
- Saisonergebnisse und Schlussrangliste stimmen auf allen Geräten überein.
