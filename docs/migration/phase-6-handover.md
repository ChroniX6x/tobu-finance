# Phase 6: Übergabe und Betriebswechsel

Stand: 22.10.2026. Branch `chore/monorepo-phase-6`. Lokale automatische und manuelle Abnahme vom Nutzer erfolgreich bestaetigt. **Gate 6 bleibt bis zum GitHub-Uebergang offen.** Kein Merge und keine Archivierung bestaetigt.

## Ziel und vorbereitete Änderungen

Ziel bleibt `ChroniX6x/tobu-finance`, zunächst Integration nach `develop`. Ein neues Repository ist nicht erforderlich. Die Frontend-History bleibt erhalten; der API-Import ist über sein Manifest nachvollziehbar. Der lokale `origin/HEAD` verweist auf `master`; diese lokale Information muss vor dem GitHub-Wechsel aktualisiert werden. CI reagiert jetzt auf Pushes nach `master`, `main` und `develop` sowie auf Pull Requests.

Die Root-README beschreibt den gemeinsamen Start und die heutigen Quality-Befehle. Der [PR-Entwurf](phase-6-pr.md) ist vorbereitet. Die [GitHub-Einweisung](github-transition.md) führt separat durch Veröffentlichung, Prüfläufe, Branchschutz und Integration. Ein neues Hosting ist nicht Teil dieser Phase; weitere externe API-Verbraucher oder bestehende Deployments sind nach bisheriger Nutzerangabe nicht bekannt.

## Abnahmestand

Der Nutzer hat die manuellen Tests als erfolgreich bestaetigt und den vollstaendigen [Quality-Bericht](evidence/phase-6-quality.json) bereitgestellt. Geprueft wurde 3dc359a302f37181a97b51b78fe0cd4c75fcc7df mit dirty=false und full=true, von 20:16:23 bis 20:23:13 UTC. Alle 16 Checks bestanden. Der Bericht wurde aus der Nutzernachricht uebernommen; dies ist kein lokal erneut ausgefuehrter Lauf.

Nachtrag aus dem frischen Nutzer-Checkout: Der Tab-Wechsel zur Buchungsseite überschritt die bisherige URL-Assertion von fünf Sekunden; der Fehler-Snapshot zeigte bereits „Buchungen“ im Navigationspfad. Der Test synchronisiert jetzt explizit auf die Transaktionsantwort des Zielkontos und prüft danach URL, aktiven Tab und Buchungszeile. Ein zusätzlicher Fall verzögert die erste Resolver-Antwort gezielt um sechs Sekunden. Keine Produktivcode-Änderung, kein Retry und keine globale Timeout-Erhöhung. Der erneute komplette Lauf auf Commit 3dc359a war erfolgreich.

| Nachweis | Stand |
| --- | --- |
| Vollstaendiger automatisierter Lauf | Alle 16 Checks erfolgreich; sauberer Commit 3dc359a, Node v24.13.1; Nutzerbericht archiviert |
| Lokaler Übergabestand, README, GitHub-Anleitung und PR-Entwurf | Vorbereitet |
| Frischer Checkout mit Installation, Setup und Start | Vom Nutzer am 22.10.2026 als erfolgreich bestaetigt |
| Terminal-Ctrl+C, VS-Code-Debugger, persistente UI-Buchung | Manuelle Tests vom Nutzer am 22.10.2026 als erfolgreich bestaetigt |
| GitHub Linux-/Docker- und Windows-Checks | Nach Veröffentlichung auszuführen |
| PR integriert, API-Repository archiviert, einzige aktive Quelle | Noch nicht erfolgt |
| Rollen/Owner und Sicherheitsbereinigung | Separat offen; keine Livebetriebsfreigabe |

## Manueller Durchlauf auf dem Docker-Rechner

Vor dem GitHub-Übergang ist ein lokaler frischer Clone möglich. Im übergeordneten Ordner ausführen; der Zielordner darf noch nicht existieren. Den Quellpfad an den eigenen Checkout anpassen:

```powershell
git clone --no-local --branch chore/monorepo-phase-6 C:\GitRepos\tobu-finance-migration tobu-finance-acceptance
cd tobu-finance-acceptance
$env:COMPOSE_PROJECT = 'tobu-phase6-acceptance'
npm ci
npm run setup
npm run dev
```

Keine `node_modules`, `.env` oder Schlüssel kopieren. Bestehende Entwicklungsprozesse vorher beenden. Der separate Compose-Projektname verhindert die Wiederverwendung des bisherigen Entwicklungsvolumes. Die Variable für spätere Starts/Stopps beibehalten oder in der neu erzeugten Root-`.env` denselben Wert eintragen. Ports dürfen nicht gleichzeitig von einem anderen Stack verwendet werden. Es wird kein Volume gelöscht.

1. Als Alice anmelden und ein vorhandenes Demo-Konto öffnen. Übersicht, Stammdaten, Monat, Planung und Buchungen laden. Eine Buchung mit eindeutigem Testtitel anlegen, ändern und nach Reload prüfen. Die noch offene Wizard-Owner-Zuordnung ist kein Abnahmekriterium dieses Übergangs.
2. `Ctrl+C` im Startterminal: API und Web dürfen nicht mehr erreichbar sein. `npm run dev:down` stoppt MongoDB. Erneut `npm run dev`: dieselbe Buchung muss erhalten sein.
3. Den normalen Dev-Stack zuerst mit `Ctrl+C` beenden. VS Code im Root öffnen. Debug-Konfiguration „ToBu: API + Stack“ starten, Breakpoint in einer API-Route setzen und mit einem Webaufruf erreichen. Anschließend auch den Stack-Task mit `Ctrl+C` beenden.
4. Im neuen Checkout Chromium vorbereiten und `npm run quality:full` gemäß README ausführen. `test-results/quality.json`, Commit-ID (`git rev-parse HEAD`) und manuelle Ergebnisse aufbewahren. Keine Zugangsdaten in das Protokoll aufnehmen.

## Rückfallweg

Der Git-Stand vor dem Monorepo liegt unter `baseline/pre-monorepo-2026-10-21`, Commit `a78318bd580eaa49a969fafb61bfdf9813e4316b`. Der API-Importmanifest nennt den damaligen API-Quellstand. Die ursprünglichen Projektordner werden in dieser Phase nicht verändert.

Für die Untersuchung eines früheren Codes einen getrennten Checkout verwenden:

```powershell
git worktree add --detach ../tobu-finance-pre-monorepo a78318bd580eaa49a969fafb61bfdf9813e4316b
```

Das stellt nur den früheren Frontend-Code wieder her. Die frühere API, deren eigene Konfiguration und eine dazu passende separate Datenbank sind zusätzlich nötig. Kein automatischer Datenbank-Downgrade und kein Anschluss alter Runner an das neue Entwicklungsvolume. Ein Git-Bundle sichert Git-Objekte, nicht ignorierte Konfiguration, Schlüssel oder MongoDB-Daten.

Nach einem GitHub-Merge einen eigenen Revert-PR für den Merge-Commit vorbereiten, falls der Übergang zurückgenommen werden muss. Kein Force-Push und kein `reset --hard` auf gemeinsam genutzte Branches. Vor einem Revert Ursache, Datenstand und Kompatibilität prüfen; Quality-Prüfungen auf dem Rückfallstand erneut ausführen. Ein vollständiger Betriebsrückfall ist noch nicht praktisch abgenommen.

## Abschluss von Gate 6

Lokale Prüfung dieser Phase: Workspace-Provenienz, ESLint, Prettier und `git diff --check` erfolgreich; Workflow-YAML einschließlich der drei Push-Ziele und lokale Dokumentlinks geprüft. Ein Git-Bundle des Ausgangsstands wurde unter `C:\GitRepos\tobu-phase0-evidence\phase6-before-transition.bundle` erstellt und mit `git bundle verify` geprüft. Der frühere Frontend-Stand wurde daraus in `phase6-rollback-inspection` wiederhergestellt und auf Commit `a78318bd580eaa49a969fafb61bfdf9813e4316b` sowie einen sauberen Arbeitsbaum geprüft. Dies bestätigt die Wiederherstellung des Quellcodes, nicht den Betrieb des alten Gesamtsystems oder einen Datenbank-Rollback. Für diese Dokumentations-/Triggeränderung wurden die bereits bestätigten funktionalen Gate-5-Tests nicht vollständig wiederholt.

Erst nach manueller Abnahme, erfolgreichen CI-Jobs, Integration des Monorepos, Prüfung des Rückfallwegs und Nachführung/Archivierung des alten API-Repositories Gate 6 als abgeschlossen markieren. Ist `master` weiterhin Default, muss auch dieser Branch auf den akzeptierten Monorepo-Stand überführt werden oder `develop` bewusst als Default gewählt werden. Bis dahin keine Behauptung einer einzigen aktiven Quelle. Weitere Arbeit erfolgt nach Rückmeldung des Nutzers.
