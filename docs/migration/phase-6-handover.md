# Phase 6: Übergabe und Betriebswechsel

Stand: 22.10.2026. Branch `chore/monorepo-phase-6`, Ausgangspunkt `a0ed30e`. Phase 6 ist freigegeben; der lokale Übergabestand ist vorbereitet. **Gate 6 ist noch offen.** Es wurde in dieser Phase nichts gepusht, gemergt oder archiviert.

## Ziel und vorbereitete Änderungen

Ziel bleibt `ChroniX6x/tobu-finance`, zunächst Integration nach `develop`. Ein neues Repository ist nicht erforderlich. Die Frontend-History bleibt erhalten; der API-Import ist über sein Manifest nachvollziehbar. Der lokale `origin/HEAD` verweist auf `master`; diese lokale Information muss vor dem GitHub-Wechsel aktualisiert werden. CI reagiert jetzt auf Pushes nach `master`, `main` und `develop` sowie auf Pull Requests.

Die Root-README beschreibt den gemeinsamen Start und die heutigen Quality-Befehle. Der [PR-Entwurf](phase-6-pr.md) ist vorbereitet. Die [GitHub-Einweisung](github-transition.md) führt separat durch Veröffentlichung, Prüfläufe, Branchschutz und Integration. Ein neues Hosting ist nicht Teil dieser Phase; weitere externe API-Verbraucher oder bestehende Deployments sind nach bisheriger Nutzerangabe nicht bekannt.

## Abnahmestand

| Nachweis | Stand |
| --- | --- |
| Automatisiertes Gate 5 inklusive Real-API, Docker-Lifecycle und Artefaktinstallation | Vom Nutzer erfolgreich bestätigt; Bericht vom Testrechner nicht lokal eingelesen |
| Lokaler Übergabestand, README, GitHub-Anleitung und PR-Entwurf | Vorbereitet |
| Frischer Checkout mit Installation, Setup und Start | Noch manuell zu bestätigen |
| Terminal-Ctrl+C, VS-Code-Debugger, persistente UI-Buchung | Noch manuell zu bestätigen |
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
