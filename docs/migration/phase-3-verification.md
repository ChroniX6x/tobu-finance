# Phase 3 – Prüfung und Übergabe

Branch: `chore/monorepo-phase-3`. Ausgangspunkt: `86c14cb` nach Gate 2 und Rollenentscheidung. Kein Push/Merge nach develop. Phase 4 beginnt erst nach neuer Anweisung.

## Status

**Neueste Einordnung:** Der Nutzer hat klargestellt, dass dieser Rechner ein Shadow-Cloud-PC ist. Fehlende freigegebene Nested Virtualization ist damit die naheliegende Ursache des unten dokumentierten VM-Startfehlers; HypervisorPresent=True beweist diese Freigabe nicht. [Shadow-Einschränkungen](https://support.shadow.tech/hc/en-us/articles/32731830348305-Rules-and-Restrictions-on-Shadow). Keine weiteren Windows-Reparaturen empfohlen. Entscheidung angefragt: native Entwicklung auf Shadow mit separatem Docker-Testhost oder vollständiger Docker-Betrieb auf anderem Rechner. Die bisherige Docker-Pflicht wurde noch nicht eigenmächtig geändert.

**Gate 3 ist noch offen.** MongoDB 9.0.4 wurde konfiguriert; Docker Desktop meldet beim Nutzer aktuell ein Hypervisor-/Engine-Startproblem. WSL 2 ist eingerichtet, VirtualMachinePlatform aktiviert, HypervisorPresent=True und hypervisorlaunchtype=Auto. Docker-Neustart mit WSL-2-Backend wird geprüft. Diese Voraussetzungen und die ausstehenden Docker-/Browsernachweise dürfen nicht als bestanden gelten.

Präzisierter Blocker: Docker-Backend-Log vom 21.10.2026 19:26 UTC zeigt beim `wsl --import-in-place docker-desktop` den Fehler `Wsl/Service/RegisterDistro/CreateVm/HCS/HCS_E_HYPERV_NOT_INSTALLED`. WSL meldet keine Distributionen; Kontext ist `desktop-linux`. `vmcompute` und `WslService` laufen. Windows-Build 26300.9711, WSL 3.0.3.0, Docker Desktop 4.96.0. Ein [vergleichbarer Microsoft-Fehlerbericht](https://github.com/microsoft/WSL/issues/41920) betrifft dieselben Windows-/WSL-Versionen und wurde Hyper-V zugeordnet; keine gesicherte Gleichheit der Ursache behauptet. Ausstehende Windows-Updates und vollständiger Neustart wurden empfohlen. Keine Docker-Daten gelöscht, keine Windows-Einstellungen durch den Agenten verändert.

Agent-seitig erfolgreich: Typecheck API/Web/Tests, API-/Web-Build, fünf API-Unit-Tests, Workspace-/Herkunftsprüfung und drei Werkzeugtests. Isolierte native Diagnose mit MongoDB 8.2.2: 15 bestandene API-/Baseline-/Seed-Prüfungen sowie erfolgreicher Replay der fünf archivierten Migrationen mit der versionierten Beispieldatei. Die native Diagnose verwendet einen eigenen temporären Prozess und eigene Datenbanken, keine vorhandene native Entwicklungsdatenbank. Sie ist **kein Ersatz für Gate 3 mit Docker/MongoDB 9.0.4**. Weitere Ergebnisse werden nach Ausführung ergänzt.

Web-Build mit bestehenden Warnungen zu SCSS-Budget, lodash/CommonJS und fehlender `/layout/styles/preloading.css`; Build-Exitcode 0. Diese Phase verändert deren Ursachen nicht.

Mock-E2E in der Agent-Umgebung versucht: alle 50 Fälle scheiterten vor der Browserausführung, weil `chromium_headless_shell-1208` im dort sichtbaren Playwright-Cache fehlt. Kein fachliches E2E-Ergebnis. Der von diesem Lauf gestartete Angular-Prozess wurde anschließend gezielt beendet. Web-Unit-Tests: Test-Build erfolgreich, ChromeHeadless scheitert beim Start mit Zugriff-/Verschlüsselungs-/GPU-Fehlern, keine Testausführung. Playwright-Installation und Browserläufe bleiben für das normale Nutzerterminal offen.

## Automatisierte Abnahme im normalen Terminal

Im Root `C:\GitRepos\tobu-finance-migration`, laufende Dev-Server vorher beenden:

```powershell
docker info
docker pull mongo:9.0.4
npm exec --workspace=@tobu/web -- playwright install chromium
npm run verify:phase3
```

Voraussetzung: installiertes Chrome für Karma, vorhandene Root-Abhängigkeiten (`npm ci` nach frischem Checkout). Der Prüfbefehl führt Workspace-Check, Typecheck, Builds, Werkzeug-/API-/Web-Unit-Tests, Mock-E2E, Setup/Start/Stop-Prüfungen sowie API-Integration und echte Browser-Authentifizierung aus.

Er erzeugt ausschließlich einen zufällig benannten `tobu-gate3-<UUID>`-Compose-Stack auf freien Ports. Dessen Volume wird am Ende entfernt; das reguläre `tobu-finance-dev`-Volume wird nicht verwendet oder gelöscht. Fehlende lokale Konfigurationsdateien/Schlüssel können beim Setup angelegt werden; vorhandene bleiben erhalten. Im Abbruchfall einen verbliebenen Gate-Container zunächst anhand des exakten Projektnamens identifizieren, nicht pauschal alle Docker-Volumes bereinigen.

Geprüft werden wiederholtes Setup ohne Daten-/Schlüsselüberschreibung, Login durch Proxy, zweiter Start auf belegten Ports, Persistenz nach DB-Stopp/Neustart, Abbruch bei fehlendem Docker bzw. unerreichbarer externer DB, kein Stoppen einer externen DB, Reset-Sperre und unveränderte Entwicklungsdaten nach isolierten Testläufen. Der automatisierte Windows-Prozessstop verwendet eine IPC-Anforderung an dieselbe Shutdown-Funktion; echter Terminal-Ctrl+C bleibt deshalb ein manueller Check.

Erfolgsmarker: `GATE 3 AUTOMATED VERIFICATION PASSED`. Einzelbefehle zur Fehlereingrenzung:

```powershell
npm run check:workspace
npm run test:tooling
npm run test:integration
npm run e2e:real
```

`test:integration` und `e2e:real` erzeugen eigene Docker-Container und zufällige DBs. Sie ignorieren MONGOD_BIN und verwenden keine Entwickler-URI als Fallback. `e2e:real` erzeugt selbst Schlüssel/Testnutzer und prüft Login, Reload/Refresh und Logout über den Web-Proxy.

## Manuelle Abnahme

1. `npm run setup`, anschließend `npm run dev`. Web öffnen, mit `alice@demo.tobu.test` / `Tobu-Demo-2026!` anmelden. Daten gemäß [Szenariokatalog](../development.md) prüfen.
2. Eine eigene Buchung anlegen und deren Konto/Monat/Betrag notieren. `Ctrl+C` muss API und Web beenden und beide Ports freigeben. Danach `npm run dev:down`.
3. Windows/Docker neu starten oder mindestens Container erneut starten: `npm run dev`. Die eigene Buchung muss unverändert vorhanden sein. Erneutes `npm run setup` darf sie ebenfalls nicht entfernen.
4. Während `dev` läuft eine harmlose lokale Änderung an Web und API prüfen; beide Watcher müssen neu laden. Änderung anschließend zurücknehmen. Kein zusätzlicher API-/Web-Prozess darf zurückbleiben.
5. VS Code am Root: „ToBu: API + Stack“ starten, Breakpoint in einer API-Route erreichen, Debugger trennen, Task per `Ctrl+C` beenden. DB bleibt bis `dev:down` erhalten.
6. Falls native MongoDB auf 27017 vorhanden ist: parallel laufen lassen. Der Standard-Stack muss weiterhin Docker auf 27018 verwenden; alte Daten bleiben unverändert.

Gate 3 ist erst nach automatisierter Abnahme **und** diesen manuellen Rückmeldungen bestanden. Noch kein Commit mit behauptetem bestandenem Gate und kein Beginn von Phase 4.

## Gezielte Begleitkorrekturen

Der Same-Origin-Auth-Test ben?tigt den Refresh-Cookie auch am Logout-Pfad; sein Pfad wurde deshalb von `/api/auth/refresh` auf `/api/auth` erweitert, alte Cookies werden entfernt. Die neuen Demo-Read-Model-Pr?fungen fanden au?erdem eine bestehende inklusive Endgrenze: Regeln ab dem ersten Tag des Folgemonats wurden in Monatsansicht und Planung zu fr?h gez?hlt. Diese Abfragen verwenden jetzt die exklusive Monatsgrenze. Regression: April 30000 Grundbeitrag, Mai 42500 einschlie?lich Zusatzbeitrag. Andere fachliche Berechtigungen wurden nicht implementiert.

Review des eigenen Diffs auf Phasenumfang, Archivtrennung, Konfigurationsschutz, persistente Daten und isolierte Testressourcen durchgef?hrt; kein unabh?ngiges Sub-Agent-Review. Noch ausstehende Laufzeitpr?fungen sind oben ausdr?cklich aufgef?hrt.
