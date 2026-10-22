# ToBu Finance – Plan zur gemeinsamen Projektstruktur

Stand: 21.10.2026
Status: Phasen 0-5 umgesetzt; automatisiertes Gate 5 laut Nutzer erfolgreich. Phase 6 freigegeben und lokal vorbereitet. GitHub-Uebergang und manuelle Gesamtabnahme stehen aus; Gate 6 bleibt offen. Siehe phase-6-handover.md.

## 1. Ziel und Entscheidung

Frontend und API werden in einem gemeinsamen Git-Repository als npm-Workspace organisiert. Angular und Express bleiben eigenständige Anwendungen mit eigenen Abhängigkeiten, Build-Konfigurationen und deploybaren Artefakten. Gemeinsame API-Verträge werden in ein drittes Paket ausgelagert.

Die Umstellung ist erst abgeschlossen, wenn bestehende Funktionen nachweislich funktionieren, ein frischer Checkout reproduzierbar eingerichtet werden kann und die gesamte lokale Entwicklungsumgebung mit `npm run dev` startet. Ein gemeinsamer Ordner allein ist kein ausreichendes Ergebnis.

Die Transformation soll keine fachlichen Änderungen, kein neues UI und keine Datenbank-Neugestaltung enthalten. Bestehende Fehler werden separat sichtbar gemacht und gezielt behoben, sofern sie Build, Schnittstellen oder Abnahme blockieren.

## 2. Ausgangslage und bekannte Risiken

Untersuchte lokale Projekte:

| Bereich | Frontend | API |
| --- | --- | --- |
| Verzeichnis | `C:\GitRepos\tobu-finance` | `C:\GitRepos\tobu-finance-api` |
| Konfiguriertes GitHub-Remote | `ChroniX6x/tobu-finance` | `ChroniX6x/tobu-finance-api` |
| Technik | Angular 21, NGXS, PrimeNG | Express 5, MongoDB/Mongoose, Zod |
| TypeScript laut package.json | `~5.9.3` | `^5.9.3` |
| Paketverwaltung | Yarn, `yarn.lock` | npm, `package-lock.json` |
| Entwicklung | `ng serve` | `tsx watch src/server.ts` |
| Tests | Jasmine/Karma und Playwright | Kein Testskript in package.json gefunden |

Feststellungen aus der bisherigen lokalen Prüfung:

- Frontend: `tsc --noEmit -p tsconfig.app.json` erfolgreich. Das ersetzt keinen Angular-Build mit Templateprüfung.
- API: `tsc --noEmit -p tsconfig.json` fehlgeschlagen, unter anderem wegen Mongoose-Typen, möglichen `undefined`-Werten und `currentMonthIso` gegenüber `ReliableBalance.currentMonth`.
- Diese Ergebnisse beruhen auf den vorhandenen lokalen Installationen. Reproduzierbarkeit mit den Lockfiles muss vor dem Umzug geprüft werden.
- API-Verträge liegen mehrfach vor: Frontend-Interfaces, Zod-Schemas, Backend-Responses und OpenAPI.
- Beispiel: Das Frontend-`CreateTransactionDto` schließt `month` aus; das Backend benötigt bei fehlendem `bookDate` einen Monat. Die Korrektur muss UI, Request und Backend gemeinsam berücksichtigen.
- Die API-Adresse ist im Frontend auf `http://localhost:4000` festgelegt.
- Playwright startet das Frontend; der Real-API-Modus setzt eine laufende API und Testzugangsdaten voraus. Fehlende Zugangsdaten führen derzeit nicht zu einem frühen, eindeutigen Abbruch.
- `.env`, OpenAPI, Seeds und Migrationen hängen teilweise vom aktuellen Arbeitsverzeichnis ab.
- Das API-Produktionsskript verwendet Windows-Syntax. ESM-Importauflösung und ausgelieferte Migrations-/Dokumentationsdateien müssen zusätzlich zum TypeScript-Build geprüft werden.
- Im Frontend ist `mongodb` als Abhängigkeit und als Import in einem älteren Service vorhanden. Vor einer Entfernung tatsächliche Nutzung prüfen; Datenbanktreiber dürfen nicht Teil eines gemeinsamen Browser-Vertragspakets werden.

Bestätigte Rahmenbedingungen vom 21.10.2026:

- Noch kein Livebetrieb; die Entwicklungsdatenbank darf frisch aufgebaut werden. Bestehende Daten müssen nicht übernommen werden. Dies ist keine Aufforderung, jetzt Daten zu löschen.
- Entwicklung überwiegend allein unter Windows und VS Code; andere Betriebssysteme sollen möglich bleiben.
- Nach Nutzerangabe keine weiteren API-Verbraucher bekannt.
- Docker bleibt Voraussetzung für die vollständige Entwicklungs- und Testumgebung.
- Gewünscht sind ein minimaler Basisstand, aussagekräftige manuelle Beispieldaten und gesonderte Integrationstestdaten einschließlich aller tatsächlich unterstützten Rollen.
- `.vscode/tasks.json` der API startet `npm run mongod` und `npm run dev` beziehungsweise `dev:debug` parallel. Der MongoDB-Befehl verwendet `D:\mongodb\db`; eine Bereitschaftsprüfung ist in den Tasks nicht enthalten. Die lokal installierte MongoDB-Version wurde nicht ermittelt.

Noch offen: GitHub-Einstellungen, Branchschutz und vorhandene externe Integrationen. Die Remote-Adressen wurden nur aus der lokalen Git-Konfiguration gelesen. Die MongoDB-Zielversion und das tatsächlich durchgesetzte Berechtigungsmodell werden in Phase 0 geprüft. Ein produktives Deployment ist derzeit keine Voraussetzung für den Umzug; Build-Artefakte bleiben dennoch produktionsfähig zu prüfen.

## 3. Welches GitHub-Repository verwenden?

### Empfehlung: bestehendes `ChroniX6x/tobu-finance` weiterführen

Das bestehende Frontend-Repository wird zum Repository für das gesamte Produkt. Sein Name passt bereits zur Gesamtanwendung. Der aktuelle API-Code wird als dokumentierter Import-Commit unter `apps/api` aufgenommen, ohne die gesamte API-Git-Historie zu importieren. Die Historie bleibt im archivierten Quellrepository zugänglich. Alle folgenden produktübergreifenden Änderungen erfolgen anschließend im gemeinsamen Repository.

| Variante | Bewertung |
| --- | --- |
| `tobu-finance` erweitern | Empfohlen: passender Produktname, Frontend-Historie bleibt erhalten; API-Stand als Import-Commit mit Herkunftsnachweis übernehmen. |
| `tobu-finance-api` erweitern | Technisch möglich, aber API-spezifischer Name und Frontend-Umzug ergeben hier keinen erkennbaren Vorteil. |
| Neues Repository, z. B. `tobu-finance-platform` | Sinnvoll bei anderer Organisation, neuen Zugriffsrechten oder bewusst unabhängigem Produktstart. Für eine reine Strukturverbesserung zusätzlicher Aufwand für Historien, Issues, Einstellungen und Integrationen. |

Ein neues GitHub-Projekt ist nach aktuellem Kenntnisstand nicht erforderlich. Falls die Bestandsaufnahme zeigt, dass Rechte oder Eigentümerschaft nicht zusammenpassen, wird diese Entscheidung vor Umsetzung erneut getroffen.

### Vorgehen mit Historie und Übergang

1. Ausgangs-Commit beider Repositories dokumentieren und vor Änderungen Sicherungsreferenzen anlegen. Nicht eingecheckte Arbeit gesondert sichern.
2. In einem separaten Checkout des Ziel-Repositories einen Transformationsbranch anlegen, beispielsweise `chore/monorepo-migration`.
3. Frontend per nachvollziehbarer Verschiebung nach `apps/web` verlagern.
4. Versionierte API-Projektdateien aus dem festgehaltenen Commit importieren. Quellrepository und vollständige Commit-ID in Import-Commit und Migrationsdokumentation festhalten. Keine `.env`, lokalen Installationen oder Build-Ausgaben kopieren. Dateivergleich gegen den Quellstand vor den strukturellen Anpassungen protokollieren. Die frühere API-Historie bleibt im alten Repository; `git blame` im Ziel reicht für diese Dateien zunächst nur bis zum Import.
5. Keine verschachtelten `.git`-Verzeichnisse und keine Submodule als dauerhafte Zielstruktur verwenden.
6. Einen kurzen Abstimmungszeitraum für parallele Änderungen festlegen. Änderungen nach den erfassten Ausgangs-Commits vor der Abnahme nachziehen.
7. Issues, offene PRs, Dokumentationslinks, Secrets, Branchschutz, Webhooks und Deployment-Ziele inventarisieren. Diese werden durch einen Git-Import nicht automatisch übertragen.
8. Das alte API-Repository erst nach erfolgreicher Abnahme und Umstellung seiner Integrationen mit einem Verweis versehen und archivieren. Nicht löschen.

Der Transformationsbranch wird über überprüfbare Commits und einen PR in `tobu-finance` integriert. Falls Backend-Buildkorrekturen vor dem gemeinsamen Wechsel benötigt werden, separat im API-Repository beheben und anschließend den korrigierten Stand importieren. Keine dauerhaft doppelte Weiterentwicklung etablieren.

## 4. Zielstruktur

```text
tobu-finance/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   ├── public/
│   │   ├── tests/e2e/
│   │   ├── angular.json
│   │   ├── playwright.config.ts
│   │   ├── proxy.conf.json
│   │   ├── tsconfig*.json
│   │   └── package.json
│   └── api/
│       ├── src/
│       │   └── database/
│       │       ├── baseline/    # Aktueller Basisstand und Versionskennung
│       │       ├── seeds/       # Manuelle Entwicklungsszenarien
│       │       └── migrations/  # Künftige Änderungen ab Baseline
│       ├── tests/fixtures/     # Kleine, deterministische Testdatensätze
│       ├── scripts/
│       ├── docs/openapi.yaml
│       ├── .env.example
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   └── contracts/
│       ├── src/
│       ├── tests/
│       ├── tsconfig.json
│       └── package.json
├── scripts/                    # Start, Bereitschaftsprüfung, Qualitätsablauf
├── infra/compose.yaml          # Lokale MongoDB und isolierte Testdatenbank
├── docs/
│   ├── architecture/
│   ├── development.md
│   ├── testing.md
│   ├── database/
│   │   └── legacy-migrations/ # Historische Migrationen, nicht ausführbar eingebunden
│   └── migration/
├── .github/workflows/
├── package.json
├── package-lock.json
├── tsconfig.base.json
├── .gitignore
└── README.md
```

Die Struktur ist ein Zielbild, keine bereits vorhandene Implementierung. API-spezifische OpenAPI-Dokumentation bleibt zunächst bei der API, damit der erste Umzug klein bleibt. Fachkonzepte und übergreifende Anleitungen kommen nach `docs/`.

### Workspace-Regeln

- Root-Paket als privat markieren; Workspaces `apps/*` und `packages/*`.
- Ziel-Paketnamen: `@tobu/web`, `@tobu/api`, `@tobu/contracts`.
- Einheitliche, explizit festgelegte Node- und npm-Versionen für Windows und CI. Auswahl anhand der tatsächlich verwendeten Angular-/Backend-Versionen prüfen.
- Eine Root-Lockdatei; Umstellung von Yarn kontrolliert durchführen und auf unbeabsichtigte Versionssprünge prüfen. Keine gleichzeitige allgemeine Dependency-Aktualisierung.
- Jede Anwendung deklariert ihre eigenen direkten Abhängigkeiten. Zufällig im Root verfügbare Pakete dürfen keine fehlenden Deklarationen verdecken.
- Gemeinsame TypeScript-Basis nur für wirklich gemeinsame Optionen. Browser-, Node-, Test- und zusätzliche API-Strenge bleiben getrennt.
- Keine direkten Imports zwischen `apps/web/src` und `apps/api/src`.
- Git ignoriert `.env`, Schlüssel, Auth-States, Datenbankdateien, Build-Ausgaben, Caches und `node_modules`.

## 5. Gemeinsame Schnittstellen

### Ziel und Grenzen

`@tobu/contracts` definiert die über HTTP ausgetauschten Requests und Responses. Es enthält keine Angular-, Express-, Mongoose- oder Datenbanktreiber-Abhängigkeiten. Interne Datenbankmodelle bleiben in der API; UI-Modelle und NGXS-State bleiben im Frontend.

Für IDs und Zeitwerte gelten explizite Transportformate: IDs als Strings, Zeitpunkte als ISO-Strings und Monatswerte je Endpunkt eindeutig dokumentiert. Bestehende Formate zunächst erhalten. Geldbeträge werden als ganzzahlige Minor Units modelliert. `null`, optionale Felder und serverseitige Defaults müssen unterscheidbar sein.

### Verbindliche Quelle

Ziel ist eine einzige gepflegte Quelle für API-Verträge: browsergeeignete Zod-Schemas im Vertragspaket mit daraus abgeleiteten TypeScript-Typen. Datenbankprüfungen und Berechtigungsregeln bleiben serverseitig. Das Frontend kann Typen ohne Laufzeitimport nutzen; Clientvalidierung ersetzt niemals die Backendvalidierung.

Bei Schemas mit Defaults, Coercion oder Transformation die HTTP-Eingabe (`z.input`) von der validierten Ausgabe (`z.output`) unterscheiden. Response-Schemas beschreiben serialisiertes JSON, keine Mongoose-Dokumente oder `Date`-Instanzen.

OpenAPI soll aus diesen Schemas und expliziten Routenmetadaten erzeugt und auf Änderungen geprüft werden. Die konkrete Werkzeugkompatibilität mit Zod 4 wird in einem kleinen Pilot geprüft. Bis die Generierung eingeführt ist, bleiben OpenAPI und Schemas durch Vergleichstests und Review abgeglichen. Eine dauerhafte zweite manuelle Wahrheit ist kein Ziel.

### Reihenfolge und Prüfungen

1. Endpunktinventar erstellen: Methode, Pfad, Auth, Request, Response, Fehler, Nutzer im Frontend und mögliche externe Verbraucher.
2. Buchungen als Pilot migrieren: Create/Patch, Listenfilter, Pagination, Sortierung, Splits sowie `bookDate`/`month`.
3. Danach Konten und Mitglieder, Stammdaten, Monatsübersicht, Kontoübersicht und Auth-Verträge schrittweise übernehmen.
4. Frontend-HTTP-Services und Backendvalidierung auf denselben Vertrag umstellen. Test-Mocks ebenfalls daran prüfen.
5. Alte Duplikate erst entfernen, wenn sämtliche Imports ersetzt und Vertrags-/Integrationstests erfolgreich sind.

Pflichtfälle: `pending` ohne Buchungsdatum mit gültigem Monat; `booked` nur mit Datum; privat bezahlte Ausgaben mit Mitglied; Split-Vererbung und Summenregeln; leere Listen; `null`-Felder; ungültige IDs; Fehlerantworten; fehlende Berechtigung. Nicht alle fachlichen Regeln gehören ins gemeinsame Schema: Datenbankabhängige Regeln werden in API-Integrationstests geprüft.

Das Vertragspaket erhält definierte Exports, Typdeklarationen und bei Laufzeitschemas ausführbares JavaScript. Build-Reihenfolge: zuerst Contracts, danach API und Web. Die API muss das gebaute Paket unter Node-ESM laden können. Ein TS-Pfadalias allein genügt nicht.

## 6. Alles mit einem Befehl starten

### Geplanter Bedienablauf

Einmalige Voraussetzungen: Git, festgelegte Node-/npm-Version und laufende Docker-Engine mit Compose. Docker ist Pflicht für den Standardweg und die vollständigen Tests. Eine native MongoDB-Installation ist nicht erforderlich. Web und API laufen weiterhin als lokale Node-Prozesse; zunächst wird nur die Datenbank containerisiert.

Nach frischem Checkout:

```powershell
npm ci
npm run setup
npm run dev
```

Nach abgeschlossener Einrichtung ist im Alltag nur noch erforderlich:

```powershell
npm run dev
```

`setup` erzeugt fehlende lokale Konfiguration und lokale Schlüssel, prüft Voraussetzungen und richtet benötigte Entwicklungs-/Testwerkzeuge ein. Es startet die gewählte Entwicklungsdatenbank, initialisiert eine leere Datenbank mit der Baseline und ergänzt dort einmalig das Standard-Demoszenario. Eine bereits initialisierte Datenbank wird geprüft, nicht neu befüllt oder zurückgesetzt. Bestehende `.env`-Werte oder Schlüssel werden nicht überschrieben. Die Installation der Playwright-Browser wird dokumentiert und für CI explizit vorgesehen.

### Entscheidung: Docker-Standard statt automatischer nativer Installation

Eine native MongoDB-Installation durch `setup` wird nicht vorgesehen. Sie würde zusätzlich zu Docker betriebssystemspezifische Installer, Rechte, Dienste, Datenpfade und Updates erfordern. Docker erfüllt bereits den Zweck, ohne vorhandene MongoDB eine lokale Entwicklungsdatenbank bereitzustellen. Das Setup prüft Docker und erklärt fehlende Voraussetzungen, installiert aber weder Docker noch Systemdienste ungefragt.

Die vorgeschlagene automatische Auswahl „lokale Datenbank gefunden, sonst Docker“ wird durch eine explizite, gespeicherte Auswahl ersetzt. Eine zufällig laufende MongoDB soll nicht bestimmen, in welcher Datenbank gearbeitet wird. Insbesondere darf ein Ausfall einer konfigurierten Instanz nicht unbemerkt auf eine andere, scheinbar leere Datenbank umschalten.

| Modus | Verhalten |
| --- | --- |
| `DB_MODE=docker` (Standard) | Setup und Entwicklung starten die projektbezogene MongoDB über Compose, falls sie nicht läuft. Persistentes benanntes Entwicklungsvolume. |
| `DB_MODE=external` (bewusste Alternative) | Bereits vorhandene lokale/externe MongoDB über konfigurierte URI nutzen und prüfen. Nicht installieren, nicht starten/stoppen und bei Ausfall nicht auf Docker wechseln. Docker bleibt für die Tests erforderlich. |
| Integration/E2E/CI | Immer eigene kurzlebige Docker-Testinstanz mit isolierten Datenbanken und kontrollierten Fixtures; unabhängig vom Entwicklungsmodus. |

MongoDB-Image auf eine geprüfte konkrete Version festlegen, kein bewegliches `latest`. Treiber- und Schema-Kompatibilität in Phase 0 prüfen. Entwicklungsport beispielsweise `127.0.0.1:27018` verwenden, damit eine bestehende native Instanz auf `27017` nicht kollidiert; tatsächlichen Port zentral konfigurieren. Tests erhalten eigene freie Ports und Projekt-/Datenbanknamen je Lauf. Vorhandene native Datenverzeichnisse werden nicht als Container-Volume wiederverwendet.

Compose stellt einen MongoDB-Healthcheck bereit. Da API und Web außerhalb von Compose laufen, muss der Root-Orchestrator selbst auf diesen Status beziehungsweise einen erfolgreichen Datenbank-Ping warten; Compose-Abhängigkeiten allein steuern keine lokalen Node-Prozesse. Siehe [Docker: Startup order](https://docs.docker.com/compose/how-tos/startup-order/).

VS Code erhält Root-Tasks für `npm run dev` und einen Debug-Start mit derselben Orchestrierung. Die bisherigen parallelen Tasks werden dadurch ersetzt; es gibt keine zweite unabhängige Startlogik. Windows wird praktisch abgenommen, Linux in CI geprüft und ein manueller macOS-Smoke-Test dokumentiert, sofern eine entsprechende Umgebung verfügbar ist. Node-Skripte vermeiden laufwerksgebundene Pfade und betriebssystemspezifische Shellsyntax.

### Vertrag für `npm run dev`

1. Voraussetzungen, Konfiguration und belegte Ports prüfen; Fehler verständlich ausgeben.
2. Lokale MongoDB über Compose starten oder die ausdrücklich konfigurierte externe Datenbank prüfen. Persistentes Entwicklungsvolume verwenden.
3. Auf echte Datenbankbereitschaft mit begrenztem Timeout warten.
4. Contracts initial bauen und anschließend überwachen.
5. Baseline und künftigen Migrationsstand prüfen. Bei leerer/uninitialisierter DB auf `npm run setup` beziehungsweise `npm run db:init` verweisen; bei ausstehenden neuen Migrationen auf `npm run db:migrate`. Keine stillen Resets oder Schemaänderungen an vorhandenen Daten durchführen.
6. API im Watch-Modus starten, auf Readiness warten und danach Angular starten.
7. Web-Adresse, API-Adresse und klar zugeordnete Logs ausgeben.
8. Änderungen an gemeinsamen Schemas müssen beide Verbraucher erreichen; bei Bedarf API neu starten und Frontend neu kompilieren.

Ein plattformübergreifender Node-Orchestrator oder dafür geeignete Prozesswerkzeuge übernehmen Reihenfolge, Timeouts und Prozessverwaltung. Ein bloßes sequenzielles `npm run ... --workspaces` startet keine dauerlaufenden Dienste parallel.

`Ctrl+C` beendet die gestarteten Node-Prozesse einschließlich Watcher auf Windows und Linux. Der lokale Datenbankcontainer darf für schnellere Neustarts bestehen bleiben; `npm run dev:down` stoppt ihn ausdrücklich und erhält das Volume. Bei Dienstausfall beendet der Orchestrator die abhängigen Prozesse mit Fehlerstatus. Keine unbemerkten Hintergrundprozesse und kein automatisches Löschen von Daten.

### Datenbank und Routing

- `npm run db:migrate`: explizite Migration für die konfigurierte Entwicklungsdatenbank.
- `npm run db:seed`: explizite Einrichtung von Entwicklungsdaten; kein automatischer Reset beim Start.
- Testdatenbank mit eigenem Namen und eigener Konfiguration; Test-Reset verweigert Entwicklungs- und Produktionsziele.
- API-Readiness muss eine erreichbare Datenbank und Betriebsbereitschaft abbilden. Das vorhandene `/health` allein reicht als umfassende Prüfung nicht aus.
- Frontend verwendet relative `/api`-Pfade. Angular-Proxy leitet lokal zur API weiter; bestehende Services dürfen dadurch kein doppeltes `/api/api` erzeugen.
- Produktiv leitet ein Reverse Proxy `/api` zur API. Getrennte Origins bleiben möglich, müssen aber ausdrücklich konfiguriert werden.
- Login, Refresh-Cookie, Cookie-Pfad, SameSite, Secure und Logout über den neuen Zugriffsweg testen. Playwright-Login und Browser müssen denselben vorgesehenen Host verwenden; `localhost` und `127.0.0.1` nicht versehentlich mischen.

### Geplante Root-Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run setup` | Einmalige, wiederholbar sichere lokale Einrichtung |
| `npm run dev` | Datenbank, Contracts-Watcher, API und Web koordiniert starten |
| `npm run dev:down` | Lokale Infrastruktur stoppen, Daten erhalten |
| `npm run build` | Contracts, API und Web in korrekter Reihenfolge bauen |
| `npm run quality` | Formatcheck, Lint, Typechecks, Unit-/Vertragstests und Produktionsbuilds |
| `npm run quality:full` | Zusätzlich isolierte API-Integration, Mock-/Real-API-E2E und Artefakt-Smoke-Test |
| `npm run db:migrate` | Ausstehende Entwicklungsmigrationen explizit anwenden |
| `npm run db:init` | Leere Entwicklungsdatenbank mit Baseline initialisieren; vorhandene Baseline prüfen |
| `npm run db:seed` | Dokumentierte Demo-Szenarien wiederholbar ergänzen, manuelle Änderungen erhalten |
| `npm run db:reset` | Ausschließlich ausgewählte Entwicklungsdatenbank bewusst löschen, Baseline und Demo neu aufbauen |

Diese Befehle sind Anforderungen an die spätere Umsetzung und existieren heute noch nicht. Der Ein-Befehl-Start bezieht sich auf Entwicklung; produktive Migration und Deployment bleiben kontrollierte eigene Abläufe.

## 6a. Baseline, historische Migrationen und Beispieldaten

### Historischen Weg erhalten, neuen Ausgangspunkt schaffen

Die bisherigen Migrationen werden als Quelltexte unter `docs/database/legacy-migrations/` archiviert, einschließlich benötigter Hilfsdateien und einer README mit Reihenfolge, Zweck, damaligen Voraussetzungen und Quell-Commit. Eine kurze Schema-Chronik erklärt den Weg zum aktuellen Stand. Archivdateien bleiben außerhalb von TypeScript-Build, Migration-Globs und Produktionsartefakten; sie werden beim Setup und Start niemals ausgeführt. Verweise auf nicht übernommene historische Daten werden dokumentiert.

Die neue Baseline definiert den aktuellen Datenbankstand, relevante Indizes, gegebenenfalls Collection-Validatoren sowie ausschließlich fachlich benötigte Pflichtdaten. Sie ersetzt keine serverseitigen Mongoose-/Zod-Schemas; ihre Übereinstimmung wird geprüft. Demo-Nutzer und Beispielkonten gehören in den Entwicklungsseed, nicht in die allgemeine Baseline. Ein eigener Versionsmarker wird erst nach vollständiger erfolgreicher Initialisierung gesetzt. Abgebrochene Initialisierung muss wiederholbar fortgesetzt oder eindeutig als unvollständig erkannt werden.

Bestehende Entwicklungsdaten müssen nicht migriert werden. Beim Übergang wird eine neue projektbezogene Datenbank aufgebaut; die alte native Installation und ihr Datenverzeichnis bleiben unberührt. Ein späteres Aufräumen ist ein eigener Schritt. Nichtleere Datenbanken ohne bekannte Baseline werden nicht automatisch umdeklariert.

Ab dieser Baseline bleiben künftige Migrationen vorgesehen. Bereits angelegte Entwicklungsdaten sollen bei weiteren Schemaänderungen erhalten bleiben können. Aktuellen Baseline-Aufbau und neue Migrationen gemeinsam pflegen: eine frisch aufgebaute DB muss denselben aktuellen Schema-/Indexstand erreichen wie ein unterstützter früherer Baseline-Stand plus Migrationen. Eine Versionskennung darf nie nur vorgetäuscht werden.

### Drei getrennte Datenebenen

| Ebene | Inhalt | Zweck |
| --- | --- | --- |
| Baseline | Indizes, Strukturkonfiguration, Versionskennung, notwendige Pflichtdaten | Minimal lauffähiger aktueller Ausgangszustand |
| Entwicklungsseed | Zusammenhängende, gültige Beispielszenarien, lokale Testnutzer, verständliche Namen | Manuelle Erkundung und Regression in der UI |
| Test-Fixtures | Kleine, deterministische Datensätze pro Testfall mit bekannten erwarteten Ergebnissen | Isolierte API- und E2E-Tests ohne Abhängigkeit vom Demo-Datenbestand |

Gemeinsame Fixture-Fabriken dürfen IDs, gültige Dokumente und Referenzen erzeugen. Erwartungswerte für Berechnungen werden unabhängig vorgegeben, nicht aus derselben Produktionsfunktion berechnet, die geprüft werden soll. Ungültige Requests werden gezielt im jeweiligen Test erzeugt; die manuelle Demo-Datenbank bleibt konsistent.

### Mindestumfang der manuellen Szenarien

- Neues Konto ohne Buchungen, mit minimalen Stammdaten, zur Prüfung von Leerzuständen und Ersteinrichtung.
- Einfacher Haushalt mit einem Mitglied sowie Mehrpersonen-Haushalt mit unterschiedlichen Einkommen und den tatsächlich unterstützten Beitrags-/Verteilungsmodellen.
- Mehrmonatiger Verlauf mit Einnahmen und Ausgaben, vergangenen Monaten, aktuellem Monat und künftigen geplanten Buchungen.
- Gebuchte und vorgemerkte Buchungen, vorgemerkte Buchung ohne Buchungsdatum, nicht kategorisierte Buchungen und private Vorleistungen.
- Vollständig und teilweise zugeordnete Splits; fachlich zulässige Grenzfälle bei Beträgen und Rundung.
- Kategorien unter, genau am und über Budget sowie Kategorie ohne Budget.
- Mitglieder mit offenen, teilweise erfüllten und erfüllten Beiträgen; Überträge soweit fachlich unterstützt.
- Konten mit vollständigen sowie lückenhaften/veralteten Saldenständen für Warnungen und Übersichten.
- Wiederkehrende Buchungen nur entsprechend dem tatsächlich implementierten Funktionsumfang; keine neuen Funktionen durch Seeds voraussetzen.
- Genügend Datensätze für Pagination, Suche, Sortierung und Filterkombinationen.

Jedes Szenario erhält eine Kennung, Beschreibung, zugehörigen Testnutzer und eine kurze Liste erwarteter Anzeigen beziehungsweise Summen. Datumsabhängige Demos basieren auf einem beim Seed erfassten Referenzmonat; dessen Wert wird gespeichert und lässt sich explizit vorgeben. Wiederholtes Seeden verschiebt bestehende Daten nicht automatisch. Automatisierte Tests verwenden feste Referenzzeiten, damit Ergebnisse nicht vom Kalendertag abhängen.

### Nutzer und Rollen

Im geprüften Auth-Modell ist `roles: string[]` mit Standard `user` definiert; die Registrierung vergibt ebenfalls `user`. Im Konto-Modell existieren separat die Mitgliedschaftsrollen `owner` und `member`. Eine allgemeine Rollen-Middleware existiert, aber daraus folgt noch keine überall wirksame Rollenabgrenzung.

Die Bestandsaufnahme wurde in Phase 1 korrigiert: Das alte Nutzer-Verknüpfungsskript enthält bereits die globale Rolle `admin`. Verbindlich ist nun die [Rollenentscheidung nach Phase 2](roles-and-access.md): Globale Admins verwalten Nutzer und sperren/entsperren sie, erhalten aber allein dadurch keinen Finanzdatenzugriff. Konto-Owner verwalten ihr eigenes Konto, laden Mitglieder ein, entfernen sie und vergeben Kontoberechtigungen. Member greifen nur auf ausdrücklich zugeordnete Konten gemäß ihren Berechtigungen zu. Ein Admin kann zugleich Owner oder Member sein; der Finanzdatenzugriff folgt ausschließlich dieser Zuordnung.

Phase 3 bereitet entsprechende Demo-Nutzer und isolierte Fixtures vor, einschließlich Admin ohne Kontozuordnung, Admin mit Kontozuordnung, normalem Owner/Member, fremdem Nutzer und gesperrtem Nutzer mit erhaltenen Buchungen und Zuordnungen. Sperren/Entsperren ist das vorgesehene Verwaltungsmodell; Nutzerlöschung und ihre Folgen werden separat festgelegt. Die vollständige Durchsetzung der Rechte wird als eigener Umsetzungspunkt mit Zugriffstests geführt. Seeds dürfen vorhandene Zugriffslücken nicht als bereits behoben darstellen. Details, Testfälle und noch offene Feinregeln stehen in der Rollenentscheidung.

Lokale Demo-Zugangsdaten werden in der Entwicklungsanleitung klar als Testzugänge dokumentiert, Passwörter mit derselben Hashfunktion wie bei normaler Registrierung gespeichert und Nutzer-/Mitgliedsreferenzen korrekt verknüpft. CI verwendet eigene kurzlebige Zugänge. Keine echten personenbezogenen Daten oder produktiven Geheimnisse verwenden.

### Wiederholbarkeit und Schutz manueller Arbeit

- Stabile Szenario-IDs/Seed-Kennungen; normale Seeds ergänzen fehlende Datensätze, überschreiben keine manuellen Änderungen und erzeugen keine Duplikate.
- `db:reset` ist der explizite Weg zu einem exakt reproduzierten Demo-Ausgangszustand. Ziel-DB vor Ausführung klar anzeigen und auf die ausgewiesene Entwicklungsdatenbank begrenzen; keine Löschung durch `dev` oder `setup`.
- Test-Reset arbeitet nur auf vom Testlauf angelegten Datenbanken. Laufkennung und isolierte Konfiguration prüfen; die Entwicklungs-URI wird niemals als Fallback verwendet.
- Fixtures, Rollenabdeckung, Referenzintegrität, erwartete Summen, Indexaufbau und Seed-Wiederholung erhalten automatisierte Checks.
- Den Zielstand der Baseline anhand der aktuellen Modelle, Indizes und historischen Änderungen prüfen. Historische Migrationen, soweit mit vorhandenen Voraussetzungen reproduzierbar, einmalig auf isolierten Daten ausführen und fachlich vergleichen. Nicht reproduzierbare Schritte konkret dokumentieren; sie blockieren nicht allein den Neuaufbau ohne Alt-Datenübernahme.

## 7. Transformationsphasen mit Quality Gates

### Phase 0 – Ausgangszustand und Abnahmeumfang sichern

- Branches, Commits, lokale Änderungen, Node-/Paketversionen und bestehende Startwege erfassen.
- Lockfile-basierte Installation in isolierten Checkouts durchführen; vorhandene lokale Installation nicht überschreiben.
- Bestehende Typechecks, Builds und Tests ausführen und Ergebnisse protokollieren.
- Funktionsinventar erstellen: Auth, Konten, Stammdaten, Wizard, Buchungen/Splits, Monatsansicht, Übersichten und tatsächlich verwendete Berechnungsfunktionen.
- Bestätigten Umfang ohne weitere API-Verbraucher dokumentieren; vorhandene GitHub-/Deployment-Integrationen prüfen.
- Rollen-/Berechtigungsmatrix, MongoDB-Zielversion und Szenariokatalog festlegen. Historische Migrationen inventarisieren; keine Übernahme bestehender Entwicklungsdaten erforderlich.

**Gate 0:** Ausgangs-Commits und Fehlerliste sind dokumentiert; kritische Nutzerabläufe und Datenbasis für Vergleichstests sind festgelegt.

### Phase 1 – Technisch belastbaren Ausgangszustand herstellen

- Bestehende API-TypeScript-Fehler gezielt beheben, ohne Typprüfung pauschal abzuschalten.
- API-Produktionsbuild und direkten Start des gebauten JavaScripts prüfen, einschließlich ESM-Auflösung.
- Minimale aussagekräftige Tests für Auth und Kern-CRUD ergänzen, soweit bislang nicht vorhanden.
- Vorhandene Frontendtests auf reale Nutzbarkeit prüfen und Angular-Produktionsbuild ausführen.

**Gate 1:** Beide Anwendungen bauen; kritische bestehende Abläufe funktionieren in isolierter Umgebung. Blockierende Altfehler sind behoben, andere Altfehler separat dokumentiert und nicht als erfolgreiche Prüfung gewertet.

### Phase 2 – Repository und Workspace umziehen

- Transformation im separaten Checkout durchführen, API-Snapshot mit Herkunftsnachweis importieren und Zielstruktur anlegen.
- npm vereinheitlichen, Root-Lockfile erzeugen und Dependency-Differenz prüfen.
- Pfade, Editor-Konfiguration, Testkonfiguration, Assets, OpenAPI, Umzug-Migrationsglobs und Seed-Dateien anpassen.
- Root-Skripte definieren; app-spezifische Skripte im jeweiligen Paketkontext ausführen.

**Gate 2:** Frischer Checkout mit `npm ci` funktioniert. Beide Anwendungen laufen noch separat und liefern vergleichbare Ergebnisse wie vor dem Umzug. Frontend-Historie, API-Herkunftsnachweis und Assets sind vorhanden; keine Geheimnisse oder Datenbankvolumes wurden importiert.

### Phase 3 – Gemeinsamen Start und Umgebungen herstellen

Aktueller Umsetzungsstand und Gate-Nachweise: [Phase-3-Prüfung](phase-3-verification.md). Auf Nutzerwunsch wird die neueste veröffentlichte MongoDB-Version verwendet: am 21.10.2026 `mongo:9.0.4`, konkret für Entwicklung und Tests gepinnt. Die Kombination mit dem vorhandenen Treiber wird in Gate 3 geprüft; die ältere native Diagnoseversion ersetzt diesen Nachweis nicht.

- Compose, Setup, Orchestrierung, Readiness, Proxy und Shutdown implementieren.
- Bestehende lokale Datenbank als Alternative dokumentieren und Portkonflikte behandeln.
- Entwicklungs-, Test- und Produktionskonfiguration voneinander trennen.
- Historische Migrationen archivieren und aus Build/Runner entfernen; Baseline, Entwicklungsseeds und isolierte Test-Fixtures gemäß Abschnitt 6a einführen.
- Root-VS-Code-Tasks und Debug-Konfiguration auf dieselbe Startlogik umstellen.

**Gate 3:** Nach Setup startet `npm run dev` den vollständigen Stack auf Windows ohne native MongoDB. Wiederholter Start, belegter Port, fehlende Docker-Engine, unerreichbare DB und `Ctrl+C` verhalten sich nachvollziehbar. Neustart erhält Entwicklungsdaten. Baseline und Seed sind wiederholbar; kein Archivskript läuft. Ein vorhandenes natives MongoDB beeinflusst den Docker-Standardweg nicht. Testläufe verändern keine Demo-Daten; ein explizit konfigurierter externer Modus wechselt bei Fehlern nicht die Datenbank.

### Phase 4 – API-Verträge konsolidieren

Umsetzung und Nachweise: [Phase-4-Ergebnis](phase-4-results.md). Bekannte Proxyfehler und weitere ausstehende Prüfungen: [Offene Punkte](open-issues.md).

- Vertragspaket und Buchungspilot einführen, dann weitere Endpunktgruppen umstellen.
- Eingabe-/Ausgabetypen, JSON-Serialisierung und Defaults prüfen.
- OpenAPI-Abgleich beziehungsweise Generierung integrieren.

**Gate 4:** Frontend, Backend und Mocks verwenden gemeinsame Verträge. Positive und negative Vertragsfälle bestehen. Eine absichtliche inkompatible Vertragsänderung wird durch Checks erkannt. Datenbank- und Servermodule gelangen nicht ins Browserpaket.

### Phase 5 – Gesamtabnahme und CI

Umsetzung, Prüfgrenzen und verbleibende Schritte: [Phase-5-Ergebnis](phase-5-results.md). Phase 6 ist freigegeben; siehe [Uebergabe](phase-6-handover.md).

- Root-Qualitätsbefehle und GitHub-Actions-Checks verbindlich einrichten.
- Produktionsartefakte in sauberer Umgebung ohne TS-Dev-Runner starten; OpenAPI und benötigte Migrationsdateien mitliefern.
- Regressionstests auf frisch initialisierter Testdatenbank und Szenario-Fixtures durchführen; Baseline-/Indexstand und künftige Migrationswege getrennt prüfen.
- Entwicklungsanleitung von einem frischen Checkout aus vollständig nachvollziehen.

**Gate 5:** Alle verpflichtenden Checks grün; keine übersprungenen Real-API-Tests; Kernfunktionen und Start-/Stopverhalten abgenommen. Abnahmeprotokoll mit Commit, Befehlen und Ergebnissen liegt vor.

### Phase 6 – GitHub- und Betriebsübergang

- PR reviewen und integrieren; vorhandene Integrationen auf neue Paketpfade und Artefakte umstellen. Ein neues produktives Hosting ist nicht Teil des Auftrags.
- Bereitschafts-, Login- und fachliche Smoke-Tests in der lokalen Zielumgebung und CI ausführen; bei tatsächlich vorhandenen Deployments zusätzlich dort.
- Erst danach API-Repository archivieren und Links/Issues nachführen.

**Gate 6:** Gemeinsames Repository ist einzige aktive Quelle. Artefaktstart, gegebenenfalls vorhandenes Deployment und Rückfallweg sind geprüft; Dokumentation ist aktuell.

## 8. Verbindliche Qualitätsmatrix

| Prüfung | Erwartung | Zeitpunkt |
| --- | --- | --- |
| Saubere Installation | `npm ci` ohne Lockfileänderung, keine undeclared dependencies | Phase 2, jeder PR |
| Format und Lint | Bestehende Regeln vereinheitlichen, keine neuen Verstöße; keine pauschale Ausblendung | Jeder PR |
| Typechecks | Web, API, Contracts und Tests geprüft | Jeder PR |
| Produktionsbuilds | Angular inklusive Templates/Budgets; API und Contracts inklusive Deklarationen | Jeder PR |
| Unit-/Vertragstests | Geld-, Monats-, Null-/Default- und Schemafälle; aussagekräftige Fehlerszenarien | Jeder PR |
| API-Integration | Echte isolierte MongoDB, Auth, Rechte, CRUD, Splits, Pagination, Fehlercodes | Jeder PR |
| Mock-E2E | Vorhandene UI-/Tastaturabläufe bleiben funktionsfähig; Mocks vertragskonform | Jeder PR |
| Real-API-E2E | Login/Refresh/Logout, Konten, Stammdaten, Buchung erstellen/ändern/löschen, Monats-/Kontoansicht | Jeder PR, zwingend vor Merge |
| Baseline und Seeds | Leere DB, wiederholte Initialisierung, keine Duplikate/Überschreibung, Referenzen/Indizes/Summen korrekt, Archiv nicht ausgeführt | Jeder PR mit Änderungen an DB/Seeds, vor Übergang |
| Künftige Migrationen | Unterstützten Vorgängerstand auf aktuellen Stand bringen; Gleichwertigkeit zum frischen Baseline-Aufbau und Wiederholung prüfen | Bei Migrationen |
| Rollen und Szenarien | Tatsächliche Auth-/Kontorollen, dokumentierte manuelle Fälle, feste Testzeit, Test-/Dev-Isolation | Integrationstests und finale Abnahme |
| Artefakt-Smoke-Test | Gebaute API ohne tsx, Web über geplanten Proxy, Health/Readiness/OpenAPI verfügbar | CI, vor Übergang |
| Windows-Entwicklung | Setup, Ein-Befehl-Start, Hot Reload und Prozessende funktionieren | Phase 3 und finale Abnahme |
| Linux-Kompatibilität | CI-Build und API-Laufzeit ohne Windows-spezifische Shellbefehle | CI |

CI erzeugt eigene kurzlebige Testschlüssel und Testnutzer. Fehlende Testkonfiguration muss Real-API-Tests früh mit Fehlerstatus beenden. Kein Erfolg durch stilles Überspringen, `--if-present` bei Pflichtchecks oder Wiederverwendung zufällig laufender Dienste. Playwright verwendet in CI einen kontrolliert gestarteten Stack; parallele Tests erhalten isolierte Datensätze oder werden bei gemeinsamem Zustand gezielt serialisiert.

Zu Beginn vollständige Checks für das kleine Monorepo ausführen. Pfadabhängige Optimierungen erst später einführen; Änderungen an Contracts und Root-Konfiguration müssen immer beide Anwendungen prüfen. Neue Dependency-Risiken und versehentlich eingecheckte Geheimnisse werden beim Import geprüft; bestehende Befunde getrennt dokumentiert.

## 9. Rückfall und Datenintegrität

- Bis zur Abnahme bleiben ursprüngliche Repositories und dokumentierte Ausgangsstände verfügbar.
- Bei Fehlschlag vor Merge kann der Transformationscheckout verworfen werden, ohne die bisherigen Arbeitsverzeichnisse zu verändern.
- Nach Merge erfolgt ein nachvollziehbarer Revert oder ein Deployment des letzten funktionierenden Artefakts; keine pauschale Umschreibung der gemeinsamen Git-Historie.
- Code-Rollback und Datenbank-Rollback getrennt behandeln. Ein Git-Revert macht Datenmigrationen nicht rückgängig.
- Für notwendige Datenmigrationen Backup, Wiederherstellung und Versionskompatibilität prüfen. Automatische Down-Migrationen nicht als pauschale Rückfallstrategie verwenden.
- Der Übergang verwendet eine neue, frisch initialisierte Entwicklungsdatenbank. Die bisherige native Datenbank wird nicht gelöscht oder konvertiert. Baseline und Seeds ersetzen für Neuinstallationen den alten Migrationsweg; es ist keine Alt-Datenübernahme erforderlich.

## 10. Definition of Done

- [ ] `ChroniX6x/tobu-finance` enthält Web, API und Contracts; API-Quellrepository und Import-Commit sind dokumentiert, alte Historie bleibt separat zugänglich.
- [ ] Docker-MongoDB funktioniert ohne native Installation; Testinstanzen sind vom Entwicklungsbestand isoliert.
- [ ] Historische Migrationen sind dokumentiert archiviert und vollständig vom aktiven Runner/Build getrennt.
- [ ] Baseline, manuelle Beispielszenarien und deterministische Test-Fixtures bestehen ihre Qualitätschecks.
- [ ] Demo-Nutzer decken die tatsächlich unterstützten Auth- und Kontorollen ab.
- [ ] Nach dokumentiertem Setup startet `npm run dev` die gesamte lokale Umgebung.
- [ ] Hot Reload funktioniert für Web, API und gemeinsame Laufzeitschemas.
- [ ] Startfehler, Timeouts und Shutdown funktionieren unter Windows; Daten bleiben erhalten.
- [ ] `npm run quality` und `npm run quality:full` liefern einen verlässlichen Gesamtstatus.
- [ ] Alle kritischen bisherigen Nutzerabläufe bestehen mit echter API.
- [ ] Gemeinsame Verträge bilden Requests und serialisierte Responses korrekt ab.
- [ ] Produktionsartefakte laufen unabhängig von lokalen Quellpfaden und Dev-Runnern.
- [ ] GitHub-Checks, gegebenenfalls vorhandene Deployments, Dokumentation und Rückfallweg sind angepasst und geprüft.
- [ ] Das alte API-Repository wird erst nach erfolgreichem Übergang archiviert.

## 11. Aufwand und Priorisierung

Der reine Ordner-/Workspace-Umzug ist nur ein Teil des Aufwands. Die aktuell fehlschlagende API-Typprüfung, fehlende API-Testautomatisierung und der Schnittstellenabgleich bestimmen den größeren Unsicherheitsanteil. Eine belastbare Terminplanung folgt nach Gate 1.

Priorität: erst reproduzierbarer Ausgangszustand, dann struktureller Umzug, danach Ein-Befehl-Start mit Docker und Baseline/Seeds sowie gemeinsame Verträge, abschließend vollständige Abnahme und GitHub-Übergang. Die Phasen werden in getrennten überprüfbaren Änderungen umgesetzt; kein gleichzeitiger Frameworkwechsel oder umfangreiches fachliches Refactoring. Kein Aufwand für native MongoDB-Installer, vollständigen API-Historienimport oder Übernahme alter Entwicklungsdaten einplanen.

## 12. Referenzen

- Lokale Quellen: beide `package.json`, TypeScript-Konfigurationen, Angular-/Playwright-Konfiguration, API-Server, Auth-Konfiguration, Migrations-/Setupskripte sowie Buchungsmodelle und Validierung.
- GitHub-Ziele laut lokaler Remote-Konfiguration: <https://github.com/ChroniX6x/tobu-finance> und <https://github.com/ChroniX6x/tobu-finance-api>.
- npm-Workspace-Dokumentation: <https://docs.npmjs.com/cli/using-npm/workspaces/>. Workspace-Befehle können im jeweiligen Paketkontext ausgeführt werden; konkrete Skripte und Werkzeugversionen werden bei Umsetzung verifiziert.

Dieses Dokument beschreibt die geplante Transformation; die tatsächlich beauftragten und umgesetzten Phasen sowie ihre Prüfgrenzen sind in den verlinkten Phasenprotokollen dokumentiert.
