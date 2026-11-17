# Schiffe versenken in der Vokabelarena

## Ein Gerät mit Beamer

1. Öffne die Vokabelarena und wähle die Vokabeln.
2. Wähle **Schiffe versenken** und **Lehrkraft und Beamer**. Starte die Partie.
3. Öffne **Beameransicht öffnen**. Ziehe das neue Fenster auf den Beamer und projiziere nur dieses Fenster. Wenn die Anzeige gespiegelt wird, blende den Beamer bei Aufstellung und Flottenkontrolle aus.
4. Die Teams platzieren nacheinander ihre fünf Schiffe am Lehrkraftgerät. Sie können die Flotte auch zufällig aufstellen lassen. Nach der Bestätigung verschwindet die Aufstellung.
5. Moderation und Schüsse erfolgen am Lehrkraftgerät. **Lehrkraft: Flotte ansehen** zeigt die gewählte Flotte dort. Die Beameransicht erhält dabei weiterhin nur das öffentliche Suchraster.

## Teamgeräte im Schul-WLAN

1. Lade das Repository als ZIP herunter und entpacke es auf dem Lehrkraft-PC. Der PC benötigt Node.js 18 oder neuer. Auf den Teamgeräten genügt ein Browser.
2. Öffne im entpackten Ordner ein Terminal und starte den Server mit `node fleet-server.cjs`. Lass das Terminal während der Partie offen.
3. Öffne am Lehrkraft-PC die ausgegebene **Moderationsadresse** und wähle **Schiffe versenken → Teamgeräte im Schul-WLAN**. Du kannst Vokabellisten aus der öffentlichen Vokabelarena als JSON exportieren und hier importieren. Beide Adressen haben getrennte Browserspeicher.
4. Öffne den Beamerlink für die gemeinsame Anzeige. Gib den beiden Teams jeweils ihren eigenen Link. Jedes Team platziert seine Flotte auf seinem Gerät und wählt später dort sein Schussziel. Die Lehrkraft bewertet mündliche Antworten oder lässt die getippte Antwort am Moderationsgerät prüfen.
5. Wenn mehrere LAN-Adressen angezeigt werden, nutze die Adresse des Schul-WLAN-Adapters. Der PC muss für andere Geräte im WLAN auf TCP-Port 8088 erreichbar sein. Den Moderationslink privat halten. Der Server ist für das lokale Netz vorgesehen.

## Regeln

- 10 × 10 Felder und fünf Schiffe mit den Längen 5, 4, 3, 3 und 2. Schiffe liegen waagerecht oder senkrecht und dürfen aneinandergrenzen. Felder dürfen sich dabei nicht überschneiden.
- Eine richtige Antwort erlaubt einen Schuss. Danach wechselt das Team.
- Eine falsche Antwort gibt dem Gegner auf der eigenen Flotte einen Suchhinweis. Weitere Fehler verkleinern denselben Bereich von 5 × 5 auf 4 × 4, 3 × 3 und 2 × 2. Ein Treffer auf das gesuchte Segment löscht den Hinweis.
- Drei eigene richtige Antworten in Folge bringen eine 2 × 2-Salve. Pro Team kann eine Salve gespeichert werden. Bereits beschossene Felder werden bei einer Salve nicht erneut gewertet.
- Wer die gegnerische Flotte zuerst komplett versenkt, gewinnt.
