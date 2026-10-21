# Verbindliche Rollenabgrenzung

Nutzerentscheidung nach Abschluss von Phase 2. Diese Entscheidung ersetzt die frühere pauschale Vorgabe „nur Admins erstellen/einladen Mitglieder“ und löst die im Phase-1-Protokoll offene Abgrenzung auf. Sie beschreibt das Zielverhalten, nicht bereits vollständig implementierte Rechte.

| Rolle | Rechte |
| --- | --- |
| Globaler `admin` | Benutzerverwaltung sowie Nutzer sperren und entsperren. Kein Zugriff auf fremde Finanzkonten, Buchungen oder Salden allein aufgrund der Admin-Rolle. |
| Kontoeigentümer `owner` | Eigenes Konto verwalten, Mitglieder zu diesem Konto einladen und entfernen sowie Kontoberechtigungen vergeben. |
| Kontomitglied `member` | Zugriff ausschließlich auf ausdrücklich zugeordnete Konten gemäß seinen Kontoberechtigungen. |

Ein globaler Admin kann gleichzeitig Eigentümer oder Mitglied eines Kontos sein. Finanzdatenzugriff entsteht ausschließlich aus dieser Kontozuordnung und ihren Berechtigungen. Die globale Benutzerverwaltung darf keinen Weg bieten, diese Grenze durch selbst erteilte Kontozugriffe zu umgehen.

## Sperren und Löschen

Für den Anfang sind Sperren und Entsperren vorgesehen. Ein gesperrter Nutzer verliert seinen Zugang; bestehende Buchungen, Mitgliedschaften und Referenzen bleiben erhalten. Das Ziel gilt auch für bereits bestehende Sitzungen, nicht nur für neue Logins.

Nutzerlöschung wird separat spezifiziert. Sie darf gemeinsame Konten, Buchungshistorie oder Zuordnungen nicht unbeabsichtigt beschädigen. Es wird in Phase 3 kein Löschablauf hinzugefügt.

## Phase 3: Daten vorbereiten

Baseline, Demo-Seeds und isolierte Test-Fixtures bereiten mindestens folgende Varianten vor:

- Globaler Admin ohne Kontomitgliedschaft: keine Finanzkonten zugänglich.
- Globaler Admin mit eigener Owner-Zuordnung und zusätzlicher Member-Zuordnung: Zugriff jeweils nur aufgrund dieser Zuordnung.
- Normaler Nutzer als Owner, ein anderer als Member desselben Kontos sowie ein fremdes Konto ohne Zuordnung.
- Nutzer ohne Kontozuordnung und gesperrter Nutzer mit erhaltenen Buchungen und Kontozuordnungen.

Demo-Daten erhalten ausschließlich synthetische Identitäten und dokumentierte Testzugänge. Bereits bestehende Zugriffslücken werden ausdrücklich dokumentiert; angelegte Rollen und Demo-Zuordnungen sind noch kein Nachweis wirksamer Rechte. Eine neue Einladungsfunktion wird durch den Seed nicht vorweggenommen.

## Eigener Umsetzungspunkt: Rechte vollständig durchsetzen

Die vollständige serverseitige Autorisierung und passende UI-Führung werden als eigener Umsetzungspunkt geplant und separat beauftragt. Sie sind nicht stillschweigend Teil der technischen Phase 3. Vor der Gesamtabnahme müssen offene Zugriffslücken und dieser Umsetzungspunkt ausdrücklich bewertet werden; keine pauschale Freigabe der Rechte durch erfolgreiche CRUD-Tests.

Erforderliche Zugriffstests:

1. Globaler Admin ohne Kontozuordnung erhält keine fremden Konten, Buchungen, Salden oder daraus abgeleitete Übersichten; dies gilt auch für direkte IDs, Filter und verschachtelte Endpunkte.
2. Admin mit Kontozuordnung besitzt dieselben kontobezogenen Rechte wie ein entsprechend zugeordneter normaler Nutzer, ohne globalen Finanzdatenzugriff.
3. Nur der zuständige Owner kann die Mitgliedschaft und Berechtigungen seines Kontos verwalten. Fremde Owner und normale Member können sich keine zusätzlichen Rechte erteilen.
4. Member erhalten ausschließlich die gemäß Kontoberechtigung erlaubten Lese- und Schreiboperationen. Die genaue Menge dieser Berechtigungen wird vor ihrer Implementierung festgelegt.
5. Nur globale Admins können die vorgesehene Benutzerverwaltung und Sperr-/Entsperroperationen ausführen; Konto-Owner erhalten dadurch keine globalen Verwaltungsrechte.
6. Sperren beendet den nutzbaren Zugang einschließlich bestehender Sitzungen und Refresh-Möglichkeiten. Buchungen und Zuordnungen bleiben unverändert; Entsperren ermöglicht erneute Anmeldung.

Vor dem eigenen Berechtigungsbaustein noch zu spezifizieren: konkrete Member-Berechtigungen, Einladungsablauf, Eigentumsübertragung beziehungsweise Umgang mit dem letzten Owner und spätere Löschregeln. Diese Detailfragen blockieren die technische Einrichtung und die Demo-Datenbasis in Phase 3 nicht.
