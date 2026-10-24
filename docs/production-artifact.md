# Gebautes Paket lokal prüfen

Im Checkout `npm run build` und anschließend `npm run package:artifact` ausführen. `dist/release` vollständig in ein eigenes Verzeichnis übertragen. Dort:

```sh
npm ci --omit=dev
npm start
```

Das Paket benötigt Node 24.13.1 / npm 11.8.0, eine kompatible initialisierte MongoDB, `MONGODB_URI` und die vier JWT-PEM-Variablen aus der API-Umgebungskonfiguration. Diese werden separat bereitgestellt; sie sind nie Bestandteil des Pakets. Eine `.env` im Paketverzeichnis wird von der API gelesen. `PORT` (API, Standard 4000) und `WEB_PORT` (Web, Standard 4200) können über Prozessvariablen gesetzt werden.

`npm start` startet die kompilierte API sowie den lokalen statischen Webserver mit Proxy für `/api`, `/health`, `/ready`, `/docs` und `/openapi.json`. Beide binden ausschließlich an Loopback. API-Ausfall beendet den gemeinsamen Startprozess; SIGINT/SIGTERM beendet beide Dienste. Ein Datenbankstart oder automatisches Seeding findet im Produktionsstart nicht statt.

Das ist eine lokale Artefakt-/Übergangsprüfung, keine neue Hosting-Lösung. Die API läuft im Produktionsmodus mit Secure-Refresh-Cookies. Für ein späteres entferntes Hosting sind HTTPS und ein geeigneter vorgeschalteter Proxy erforderlich; Sicherheitsflags werden nicht für HTTP-Tests abgeschaltet.

Baseline- und aktive Migrationslogik liegen kompiliert unter `apps/api/dist/src/database`. Die Entwicklungs-CLI sperrt Entwicklungsbefehle im Produktionsmodus. Der isolierte Artefakttest initialisiert seine leere Testdatenbank ausdrücklich mit `NODE_ENV=test`, bevor er den Produktionsprozess startet. Das ist keine Anleitung, Produktionsdaten mit Entwicklungsseeds zu verändern. Das Legacy-Migrationsarchiv wird nicht ausgeliefert oder ausgeführt; die aktive unveränderliche Historie gehört zum kompilierten Paket.

Der administrative Runner ist über `node apps/api/dist/src/database/migration-cli.js plan` erreichbar. Die weiteren Befehle, Zielbestätigung und Writer-/Recovery-Voraussetzungen stehen in der [Migrationsanleitung](database/migration-authoring.md). Er benötigt keinen TypeScript-Runner und migriert nicht beim App-Start. Strukturelle Migrationen benötigen zusätzlich die [Backup-/Betriebsvoraussetzungen](database/structural-migrations.md), produktiv native Database Tools und einen ausdrücklich konfigurierten geschützten Backup-Pfad. Docker ist keine Voraussetzung des produktiven Runners.

Der Artefakttest prüft den separaten CLI-Einstieg gegen seine isolierte Datenbank im Produktionsmodus. Bei derzeit leerem fachlichem Katalog prüft er Plan und bestätigtes No-op; das ersetzt keine Abnahme einer späteren konkreten Migration. Die gemeldete Gesamtabnahme, die separate GitHub-Prüfung und verbleibende produktive Voraussetzungen stehen im [Migrations-Handover](database/migration-handover.md).

`npm run test:artifact` im Checkout prüft das Release in einem temporären Verzeichnis mit frischer Installation und eigener Docker-Datenbank. Es verwendet keine lokal installierten TS-Runner oder vorhandenen Entwicklungsdaten. Das Ergebnis fließt in `npm run quality:full` ein.
