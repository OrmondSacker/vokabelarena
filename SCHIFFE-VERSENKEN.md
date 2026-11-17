# Schiffe versenken in der Vokabelarena

## Ein Gerät mit Beamer

1. Öffne die Vokabelarena und wähle die Vokabeln.
2. Wähle **Schiffe versenken** und **Lehrkraft und Beamer**. Starte die Partie.
3. Öffne **Beameransicht öffnen**. Ziehe das neue Fenster auf den Beamer und projiziere nur dieses Fenster. Wenn die Anzeige gespiegelt wird, blende den Beamer bei Aufstellung und Flottenkontrolle aus.
4. Die Teams platzieren nacheinander ihre fünf Schiffe am Lehrkraftgerät. Sie können die Flotte auch zufällig aufstellen lassen. Nach der Bestätigung verschwindet die Aufstellung.
5. Moderation und Schüsse erfolgen am Lehrkraftgerät. **Lehrkraft: Flotte ansehen** zeigt die gewählte Flotte dort. Die Beameransicht erhält dabei weiterhin nur das öffentliche Suchraster.

## Teamgeräte im Schul-WLAN

1. Lade das Repository als ZIP herunter und entpacke es auf dem Lehrkraft-PC. Der PC benötigt Node.js 18 oder neuer. Auf den Teamgeräten genügt ein Browser.
2. Doppelklicke im entpackten Ordner auf **Vokabelarena starten.cmd**. Das Fenster bleibt während der Partie offen. Alternativ kannst du den Server mit `node fleet-server.cjs` starten.
3. Der Starter öffnet die Moderation im Browser. Läuft der Server bereits, kannst du in der öffentlichen Vokabelarena unter **Schiffe versenken** auf **Laufenden Server öffnen** klicken. Schiffe versenken und der Schul-WLAN-Modus sind in der Moderation vorausgewählt. Du kannst Vokabellisten aus der öffentlichen Vokabelarena als JSON exportieren und hier importieren. Beide Adressen haben getrennte Browserspeicher.
4. Öffne den Beamerlink für die gemeinsame Anzeige. Gib den beiden Teams jeweils ihren eigenen Link. Jedes Team platziert seine Flotte auf seinem Gerät und wählt später dort sein Schussziel. Die Lehrkraft bewertet mündliche Antworten oder lässt die getippte Antwort am Moderationsgerät prüfen.
5. Wenn mehrere LAN-Adressen angezeigt werden, nutze die Adresse des Schul-WLAN-Adapters. Der PC muss für andere Geräte im WLAN auf TCP-Port 8088 erreichbar sein. Den Moderationslink privat halten. Der Server ist für das lokale Netz vorgesehen.

## Regeln

- 10 × 10 Felder und fünf Schiffe mit den Längen 5, 4, 3, 3 und 2. Schiffe liegen waagerecht oder senkrecht. Auch diagonal bleibt mindestens ein Feld Abstand.
- Eine richtige Antwort erlaubt einen Schuss. Nach einem Treffer bleibt das Team dran und erhält eine neue Frage. Bei Wasser oder einer falschen Antwort wechselt der Zug.
- Eine falsche Antwort gibt dem Gegner auf der eigenen Flotte einen Suchhinweis. Weitere Fehler verkleinern denselben Bereich von 5 × 5 auf 4 × 4, 3 × 3 und 2 × 2. Ist ein Hinweis bei 2 × 2 angekommen, kann ein weiterer Fehler einen neuen Suchbereich öffnen. Ein Rahmen verschwindet, sobald darin kein ungetroffenes Schiffssegment mehr liegt.
- Drei eigene richtige Antworten in Folge bringen eine 2 × 2-Salve. Pro Team kann eine Salve gespeichert werden. Das obere linke Feld wählen, die vier markierten Felder prüfen und dasselbe Startfeld zum Feuern erneut wählen. Bereits ausgewertete Felder werden übersprungen.
- Beim Versenken werden die Nachbarfelder als freies Wasser markiert.
- Wer die gegnerische Flotte zuerst komplett versenkt, gewinnt.
