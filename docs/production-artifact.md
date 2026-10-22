# Gebautes Paket lokal prüfen

Im Checkout `npm run build` und anschließend `npm run package:artifact` ausführen. `dist/release` vollständig in ein eigenes Verzeichnis übertragen. Dort:

```sh
npm ci --omit=dev
npm start
```

Das Paket benötigt Node 24.13.1 / npm 11.8.0, eine kompatible initialisierte MongoDB, `MONGODB_URI` und die vier JWT-PEM-Variablen aus der API-Umgebungskonfiguration. Diese werden separat bereitgestellt; sie sind nie Bestandteil des Pakets. Eine `.env` im Paketverzeichnis wird von der API gelesen. `PORT` (API, Standard 4000) und `WEB_PORT` (Web, Standard 4200) können über Prozessvariablen gesetzt werden.

`npm start` startet die kompilierte API sowie den lokalen statischen Webserver mit Proxy für `/api`, `/health`, `/ready`, `/docs` und `/openapi.json`. Beide binden ausschließlich an Loopback. API-Ausfall beendet den gemeinsamen Startprozess; SIGINT/SIGTERM beendet beide Dienste. Ein Datenbankstart oder automatisches Seeding findet im Produktionsstart nicht statt.

Das ist eine lokale Artefakt-/Übergangsprüfung, keine neue Hosting-Lösung. Die API läuft im Produktionsmodus mit Secure-Refresh-Cookies. Für ein späteres entferntes Hosting sind HTTPS und ein geeigneter vorgeschalteter Proxy erforderlich; Sicherheitsflags werden nicht für HTTP-Tests abgeschaltet.

Baseline- und künftige Migrationslogik liegen kompiliert unter `apps/api/dist/src/database`. Der vorhandene CLI schützt Entwicklungsbefehle im Produktionsmodus. Der isolierte Artefakttest initialisiert seine leere Testdatenbank ausdrücklich mit `NODE_ENV=test`, bevor er den Produktionsprozess startet. Das ist keine Anleitung, Produktionsdaten mit Entwicklungsseeds zu verändern. Historische Migrationen werden nicht ausgeliefert oder ausgeführt.

`npm run test:artifact` im Checkout prüft das Release in einem temporären Verzeichnis mit frischer Installation und eigener Docker-Datenbank. Es verwendet keine lokal installierten TS-Runner oder vorhandenen Entwicklungsdaten. Das Ergebnis fließt in `npm run quality:full` ein.
