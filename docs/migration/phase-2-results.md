# Phase 2 – Repository und npm-Workspace

Stand: 21.10.2026. **Gate 2 bestanden.** Branch `chore/monorepo-phase-2` im separaten Checkout `C:\GitRepos\tobu-finance-migration`. Der Nutzer bestätigte den vollständigen Prüflauf mit `GATE 2 VERIFICATION PASSED`. Phase 3 wurde nicht begonnen.

## Herkunft und Import

- Ziel bleibt `https://github.com/ChroniX6x/tobu-finance.git`; die bestehende Frontend-Historie ist erhalten. Ausgangsstand vor Phase 2: `ab9b87d67a1abd98258abbe234971d2513fe227f`.
- API-Quelle: `https://github.com/ChroniX6x/tobu-finance-api.git`, korrigierter Phase-1-Commit **`f4b65f6547b5620a5dc92d4711649f5cd335c78b`** aus dem lokalen Branch `chore/monorepo-phase-1`. Dieser Stand ist noch nicht gepusht.
- 110 versionierte API-Dateien wurden direkt aus diesem Commit gelesen, importiert und vor Änderungen byteweise per SHA-256 geprüft. Manifest: [api-import-manifest.json](evidence/api-import-manifest.json).
- `docs/tobu_finance.users.json` wurde ausdrücklich ausgelassen: Der Export enthält Passwort-Hashes und ist keine Laufzeit- oder Seed-Abhängigkeit. Es wurden keine lokalen `.env`, Schlüssel, Auth-States, `node_modules`, Build-Ausgaben, Git-Verzeichnisse oder Datenbankvolumes importiert.
- 320 Frontend-Assets einschließlich alter Testdaten wurden gegen den Frontend-Ausgangscommit geprüft. Manifest: [web-assets-manifest.json](evidence/web-assets-manifest.json). Der wiederholbare Workspace-Check erlaubt Git-bedingte CRLF-Zeilenenden für UTF-8-Text, prüft Binärdateien unverändert.

Die API-Historie bleibt im Quellrepository. Der Phase-2-Commit enthält Import und strukturelle Anpassungen zusammen, entsprechend einem Implementierungscommit pro Phase. Die Herkunft ist zusätzlich in seinem Committext zu vermerken. Keine GitHub-Änderung, Archivierung oder Veröffentlichung gehört zu dieser Phase.

## Struktur und Befehle

Frontend: `apps/web` / `@tobu/web`. API: `apps/api` / `@tobu/api`. Root-Workspaces: `apps/*` und `packages/*`. Ein gemeinsames Vertragspaket wird erst in Phase 4 implementiert; `packages/README.md` hält dies fest.

Node 24.13.1 und npm 11.8.0 sind in den Root-Metadaten festgehalten; `.node-version` und `.nvmrc` unterstützen die lokale Auswahl. Die gemeinsame TypeScript-Basis enthält nur `target`, `strict`, `skipLibCheck` und `isolatedModules`. Angular-spezifische Einstellungen, NodeNext und die zusätzliche API-Strenge bleiben in den Apps erhalten.

Root-Befehle delegieren über npm-Workspaces und laufen dadurch im jeweiligen App-Verzeichnis. Das erhält die Bedeutung der vorhandenen relativen `.env`-, Seed- und Migrationsgenerator-Pfade. API-Build, OpenAPI-Datei und Laufzeit-Migrationsglob sind seit Phase 1 modulrelativ. Historische Seeds und Migrationen bleiben aktiv verfügbar, wurden aber nicht ausgeführt. Die Migrationsgenerator-Vorlagen erhalten die für NodeNext erforderliche `.js`-Endung.

Playwright verwendet explizit das Web-Arbeitsverzeichnis, den lokal aufgelösten Angular-CLI-Einstieg und einen modulrelativen Auth-State-Pfad. Die Root-Tasks und Debug-Konfiguration in VS Code zeigen auf die verschobenen Apps. Die alten API-eigenen VS-Code-Dateien bleiben für das isolierte Öffnen von `apps/api` erhalten; maßgeblich für das Monorepo sind die Root-Tasks. Sie starten keine native Datenbank über einen fest verdrahteten Laufwerkspfad.

Der frühere `jsondb`-Befehl wurde entfernt: Er referenzierte ein nicht deklariertes `json-server` und ist nicht der Express-API-Start. Die JSON-Beispieldaten bleiben erhalten. Der Frontend-API-Endpunkt bleibt `http://localhost:4000`; Proxy, gemeinsame Orchestrierung, Docker und neue Seeds folgen in Phase 3.

Die [Root-Anleitung](../../README.md) beschreibt Installation, getrennte Starts, Builds, Tests und Testdatenbank-Konfiguration.

## Abhängigkeiten

Die ursprünglichen Lockdateien liegen ausschließlich als Herkunftsbelege unter `legacy-lockfiles/`. Aktive Quelle ist die von npm erzeugte Root-`package-lock.json` im Format 3. Die einmalige Yarn-Konvertierungshilfe wurde nach Erzeugung entfernt.

Alle direkten bisherigen Abhängigkeiten wurden auf ihre bereits gesperrten Versionen festgelegt. Der [Baseline-Vergleich](evidence/phase-2-dependency-baseline.json) enthält ursprüngliche Ranges, Versionen und Konflikte identischer transitiver Selektoren. Es wurde kein Framework-Upgrade durchgeführt. Die Frontend-Browsertests deklarieren `@types/node` nun ausdrücklich, statt es zufällig aus einem anderen Paket zu beziehen. Die API deklariert für ihre vorhandene Express-Typerweiterung `@types/express-serve-static-core` 5.0.7 ausdrücklich; diese Version war bereits transitiv vorhanden. Dafür war kein weiterer Download erforderlich.

Der [Dependency-Diff](evidence/phase-2-dependency-diff.json) vergleicht die Menge aus Paketnamen und Versionen beider alten Lockdateien mit der neuen Lockdatei. npm führt kompatible transitive Abhängigkeiten zusammen; 44 frühere Paket-/Versionskombinationen entfallen. Die fünf zusätzlich aufgeführten Kombinationen unter dem optionalen `@tailwindcss/oxide-wasm32-wasi` sind im unveränderten Paket 4.1.11 gebündelte Versionen (`@emnapi/*`, `@napi-rs/wasm-runtime`, `tslib`). npm erfasst sie im Lockfile; es handelt sich nicht um einen Tailwind-Versionswechsel.

Die übrigen Zusammenführungen verwenden Versionen, die bereits in mindestens einer der beiden ursprünglichen Lockdateien vorkamen. Der Workspace-Check verlangt für jede bisherige direkte Abhängigkeit exakt die Ausgangsversion. Ein anschließender `npm ci` darf die Lockdatei nicht verändern.

## Prüfprotokoll

- API-Herkunft, direkte Versionsbindungen, Workspace-Verweise und Frontend-Assets: `npm run check:workspace` erfolgreich.
- Root-Lockdatei: vom Nutzer mit `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` erzeugt; erfolgreich bestätigt. Agenten-Netzwerkzugriff auf die Registry ist mit `EACCES` gesperrt, Offline-Auflösung scheiterte zuvor an fehlenden Cache-Einträgen.
- Nutzer bestätigt `npm ci --no-audit --no-fund` im neuen Workspace erfolgreich. Es wurde ein eigenes `node_modules` angelegt; der frühere Verweis auf den ursprünglichen Frontend-Checkout ist entfernt.
- Root-Typecheck erfolgreich: API sowie Web-Anwendung, Jasmine-Tests und sämtliche Playwright-Dateien.
- `npm run build` erfolgreich für API und Angular; nur die bekannten Phase-1-Warnungen (Month-View-CSS, lodash/CommonJS, fehlendes Preloading-Stylesheet).
- `npm run test:api`: 5 Tests bestanden. `npm run test:integration`: 8 Teiltests plus übergeordneter Test bestanden, mit eigenem temporärem MongoDB 8.2.2 und gebauter API aus dem Workspace.
- `npm ls --depth=0` erfolgreich. Playwright-Konfiguration findet 52 Tests einschließlich echtem Login-Setup und Session-Test.
- Der reguläre Karma-Chrome-Launcher scheitert im Agentenkontext weiterhin am GPU-Prozess. Deshalb werden die Browserprüfungen im normalen Benutzerterminal ausgeführt und nicht durch diesen Agentenlauf als bestanden gewertet.
- Ein sauberer Export ausschließlich der Git-Index-Dateien wurde aus Tree `9ec0278774037cfe516355ff694593aee09168ef` unter `C:\GitRepos\tobu-finance-phase2-verification` bereitgestellt. Er enthielt vor dem Lauf keine lokalen Installationen, Konfiguration oder Build-Ausgaben; die Frontend-Historie bleibt im eigentlichen Transformationscheckout. Der vollständige Prüflauf auf diesem Quellstand wurde erfolgreich abgeschlossen. Nach Erstellung des Exports wurde ausschließlich dieses Ergebnisprotokoll ergänzt; der Anwendungscode und die Paketkonfiguration entsprechen dem geprüften Stand.
- Root-Lockfile-SHA-256 im Git-Tree: `781a1d98426f7cb8816e2cb998d4e76a0b644f372dee8f2454483dabfeccb401`. Im Windows-ZIP-Export: `60a9473daa1bfb75f4f86d95150cc8c5b8db0c48693b2111034480808be7afb1`. Der Unterschied besteht ausschließlich in CRLF/LF-Zeilenenden. Der Hash der Lockdatei nach `npm ci` stimmt exakt mit dem ursprünglichen ZIP-Eintrag überein; die Installation hat sie nicht geändert.
- Importprüfung auf lokale Artefakte und private Schlüsselblöcke: kein Treffer im vorgesehenen Commit-Inhalt. Beide ursprünglichen `develop`-Checkouts bleiben sauber.
- `git diff --check` ist für die eigenen Umzugsänderungen erfolgreich. Der unveränderte API-Import enthält bereits im Quellcommit vorhandene Leerzeichen am Zeilenende; diese wurden zugunsten der nachvollziehbaren Quellübernahme nicht pauschal umformatiert. Der Hashvergleich sichert unveränderte Importdateien ab.

## Gate-2-Abnahme

Das einmalige externe Prüfskript `C:\GitRepos\tobu-phase0-evidence\phase2-verify.ps1` führte im sauberen Export nacheinander folgende Befehle aus und brach bei jedem Fehler ab:

1. `npm ci --no-audit --no-fund`, einschließlich Vorher-/Nachher-Hashvergleich der Lockdatei.
2. `npm run check:workspace`, `npm run typecheck`, `npm run build`.
3. `npm run test:api` (5 Tests) und `npm run test:integration` (8 Teiltests plus übergeordneter Test).
4. `npm run test:web` (4 Tests) und `npm run e2e` (50 Mock-Oberflächentests).
5. Echter Browser-Test (2 Tests: Login-Setup und Session-Wiederherstellung) gegen eine eigens gestartete gebaute API mit temporärer MongoDB, zufälliger Datenbankkennung, eigenen RSA-Schlüsseln und synthetischem Testnutzer. Beide Dienste wurden anschließend beendet und das temporäre Datenverzeichnis entfernt.

Der Nutzer meldete abschließend `GATE 2 VERIFICATION PASSED`. Das lokale Transkript liegt unter `C:\GitRepos\tobu-phase0-evidence\phase2-clean-verification.log`; PowerShell hat darin nicht alle Ausgaben der nativen Unterprozesse erfasst. Die Abschlussbestätigung des vollständigen Ablaufs beruht deshalb zusätzlich auf der ausdrücklichen Nutzerrückmeldung. Lockfile-Unverändertheit und geprüfter Quellstand wurden unabhängig nachgeprüft. Bestehende Build- und npm-Deprecation-Warnungen gelten nicht als behoben; ein allgemeines Dependency-Update war nicht Teil dieser Phase.

Gate 2 ist damit für den dokumentierten Windows-/Node-Stand abgenommen. Ein sauberer Git-Quellcode-Export diente als Installationsnachweis; ein zusätzliches Remote-Klonen oder Linux-/macOS-Lauf wurde nicht behauptet. Die Linux-CI folgt gemäß Plan in Phase 5.

Nach Phase 2 wird auf weitere Nutzeranweisungen gewartet. Es erfolgt kein automatischer Übergang zu Phase 3.
