# Phase 1: Build und isolierte Tests

Stand: 21.10.2026. Branch: `chore/monorepo-phase-1`. Ausgangspunkt: `de86928927d50559ace525796aff64ae0012815e`.

## Befehle

```powershell
npm ci
npm run typecheck
npm test
$env:MONGOD_BIN = 'C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe'
npm run test:integration
```

Alternativ zu `MONGOD_BIN` kann `TEST_MONGODB_URI` auf einen ausdrücklich vorgesehenen lokalen Testserver zeigen (beispielsweise MongoDB in Docker). `MONGOD_BIN` muss dafür entfernt sein. Der Test verwendet immer eine zufällig benannte Datenbank `tobu_test_*` und entfernt nur diese. Die normale `.env` und `MONGODB_URI` werden nicht als Datenquelle verwendet. Der native Modus startet einen eigenen Prozess mit temporärem Datenverzeichnis und freiem Port. Er ist eine Testoption; der geplante Docker-Standard für die Entwicklung bleibt bestehen.

`npm run build` erzeugt ein frisches `dist`, prüft TypeScript unter NodeNext und kopiert OpenAPI. `npm start` startet das gebaute JavaScript mit standardmäßig `NODE_ENV=production`; dafür müssen reguläre Datenbank- und JWT-Umgebungsvariablen vorliegen. Der Integrationstest startet das kompilierte Servermodul mit `NODE_ENV=test`, eigenen RSA-Schlüsseln und anderem Arbeitsverzeichnis. Er prüft dabei ESM-Importe, OpenAPI und die Erkennung kompilierter Migrationen. Historische Migrationen und Seeds werden nicht ausgeführt.

## Ergebnis

- Typecheck und Build erfolgreich; strikte Compileroptionen bleiben aktiv.
- Fünf Unit-Tests für Verteilung/Rundung, Prognose, Salden und Buchungsvalidierung erfolgreich.
- Acht Integrationsteiltests plus übergeordneter Test erfolgreich: Auth, Registrierung, Login, Refresh, Logout, inaktive Nutzer, Member/Konten, Buchungs-CRUD, Leseendpunkte und Produktionsartefakt.
- Getestet mit Node 24.13.1 und isoliertem nativem MongoDB 8.2.2. Kein Docker-Testnachweis.
- Verwendet wurden die bereits installierten Abhängigkeiten. Ein frisches `npm ci` ist wegen der Downloadbeschränkung der Agentenumgebung noch nicht nachgewiesen.

## Umfang und offene Punkte

ESM-Pfade, Mongoose-Modelltypen und Zugriffe auf möglicherweise fehlende Werte wurden korrigiert. `ReliableBalance` liefert das bereits deklarierte Feld `currentMonth`. Die bisher nicht validierte Access-Token-Laufzeit akzeptiert jetzt Zahlen mit optionaler Einheit `ms`, `s`, `m`, `h`, `d`, `w`, `y` (Standard `15m`). Ein doppelter Planning-Pfad in OpenAPI wurde entfernt; zuvor scheiterte der YAML-Parser daran.

Die Tests sichern das bestehende Verhalten. Sie implementieren noch keine neue Rollenpolitik. `scripts/link-users-to-members.ts` enthält bereits `user`/`admin`; zusätzlich existieren kontobezogene `owner`/`member`. Die gewünschte Regel „nur Admins erstellen/laden Mitglieder ein“ ist vor ihrer Umsetzung diesen Rollen eindeutig zuzuordnen. Der aktuelle CRUD-Test verwendet den bisherigen Benutzerzugang und ist kein Nachweis dieser künftigen Berechtigungsregel.

Seed-Ersetzung, Migrationen archivieren, Docker-Orchestrierung und Workspace-Umzug gehören zu späteren Phasen.
