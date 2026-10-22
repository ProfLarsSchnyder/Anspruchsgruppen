# AlpenManager – Anspruchsgruppen

Unterrichtsplanspiel: Drei Skigebiete konkurrieren über fünf Wintersaisons um Gäste. Entscheidungen zu Ticketpreisen, Personal, Löhnen, Marketing und Zielgruppe, Wartung, Investitionen und Lieferanten beeinflussen Finanzen und sieben Anspruchsgruppen.

## Stand: V0.1 (Testsimulation)

Die Datei `index.html` enthält eine **lokale Testversion** mit drei Skigebieten in einer gemeinsamen Lehrpersonenansicht. Der Markt wird pro Saison gemeinsam berechnet. Es gibt Saisonereignisse, Ergebnisberichte, langfristige Folgen und die Schlussbewertung.

**Nicht enthalten:** Live-Multiplayer über Supabase, separate Endgeräte pro Team, Server-Timer, automatisches Sperren beim Zeitablauf, Spielcodes und abgesicherte Lehrpersonensteuerung. Die aktuelle Version ist noch keine vollständig einsatzfähige Live-Unterrichtsversion.

## Testen

`index.html` lokal öffnen oder GitHub Pages unter Settings → Pages auf Branch `main` / Root aktivieren. `Testspiel starten`, die drei Unternehmen nacheinander einstellen und `Saison berechnen`.

## Schlussbewertung

40 % Wirtschaft, 40 % Anspruchsgruppen, 20 % Zukunftsfähigkeit. Werte und Formeln sind vorläufig und müssen auf Balance geprüft werden.

## Als Nächstes

Supabase-Schema, Spielcode und Lobby, Teams, zentraler Drei-Minuten-Countdown, transaktionale Berechnung aller drei Skigebiete, Live-Lehreransicht und Tests auf mehreren Geräten.
