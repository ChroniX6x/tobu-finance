# Separate GitHub-Einweisung

Diese Schritte sind vorbereitet, noch nicht ausgeführt. Sie werden nach der lokalen Abnahme gemeinsam durchgegangen. Ziel: **ChroniX6x/tobu-finance**, Quellbranch **chore/monorepo-phase-6**, PR-Ziel **develop**. Der Phase-6-Branch enthält auch die vorherigen Phasen; nicht jeden Phasenbranch einzeln mergen.

## 1. Stand prüfen und sichern

Im Checkout mit dem vollständigen Phase-6-Stand:

```powershell
git status --short
git branch --show-current
git remote -v
git fetch origin
git remote show origin
git log --oneline origin/develop..HEAD
git diff --stat origin/develop...HEAD
git bundle create ../tobu-before-github-transition.bundle --all
git bundle verify ../tobu-before-github-transition.bundle
```

Bei uncommitteten Änderungen oder einem anderen Remote nicht blind fortfahren. `git fetch` aktualisiert nur Remote-Verweise; es integriert keine Änderungen. Falls `origin/develop` inzwischen neue Arbeit enthält, diese zuerst prüfen und im Migrationsbranch integrieren; Konflikte bewusst lösen und das Gate erneut ausführen. Kein Force-Push. Ein Git-Bundle enthält auch historische Git-Inhalte und sollte privat aufbewahrt werden; es enthält keine ignorierten Datenbankdateien.

## 2. Branch veröffentlichen und PR erstellen

Erst nach Prüfung ausführen:

```powershell
git push -u origin chore/monorepo-phase-6
```

Dann auf GitHub das Repository öffnen: **Pull requests → New pull request**. Als **base `develop`**, als **compare `chore/monorepo-phase-6`** wählen. Titel und Beschreibung aus [phase-6-pr.md](phase-6-pr.md) übernehmen. Zunächst als Draft anlegen, solange manuelle Nachweise fehlen. In „Files changed“ die gemeinsame Root-Struktur, API-Provenienz, Lockfile und `.github/workflows/quality.yml` prüfen. `.env`, private Schlüssel, Datenbankdateien und Browser-Sessiondateien dürfen nicht neu enthalten sein. [GitHub-Anleitung zum Erstellen eines PR](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-a-pull-request).

## 3. Actions prüfen und Pflichtchecks einrichten

Der PR startet den Workflow **Quality**. Erwartet werden zwei erfolgreiche Jobs:

- **Full quality (Linux, Docker)**: vollständiges Gate inklusive isoliertem Produktionsartefakt.
- **Windows checks**: Quality-Lauf ohne Docker.

Auf beide Ergebnisse warten. Bei Fehlern Job öffnen, ersten fehlgeschlagenen Schritt und dessen Log prüfen. Keine fehlgeschlagenen oder übersprungenen Jobs als Abnahme akzeptieren. Im Linux-Lauf stehen `quality-results` und nach Erfolg `tobu-release` als Artefakte bereit; Bericht auf den tatsächlich geprüften Commit beziehen. Lokales Gate 5 ersetzt diese CI-Läufe nicht.

Nach dem ersten erfolgreichen Lauf unter Repository **Settings → Branches** eine Schutzregel für `develop` einrichten (alternativ das vorhandene Ruleset bearbeiten): PR erforderlich, die beiden tatsächlich angezeigten Quality-Checks erforderlich, Branch vor Merge aktuell halten, Force-Push und Löschung nicht erlauben. Die Oberfläche kann die Workflow-Bezeichnung vor den Jobnamen anzeigen; die Einträge aus dem realen Lauf auswählen. Als alleiniger Entwickler keine zwingende Fremdfreigabe konfigurieren, die du selbst nicht erteilen kannst. Merge nur nach eigener Durchsicht und grünen Checks. Private Repository-Branchregeln hängen vom GitHub-Tarif ab; falls die Einstellung nicht verfügbar ist, ist dieser Schutz noch nicht eingerichtet. [GitHub-Dokumentation zu Branchschutz](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

## 4. Integration und Default-Branch

Nach manueller Abnahme und grünen Checks Draft auf „Ready for review“ setzen. **Create a merge commit** bevorzugen, damit die einzelnen Phasencommits erhalten bleiben. Eine erzwungene lineare History passt nicht zu dieser Merge-Strategie. Keine automatische Merge-Funktion aktivieren, solange Abnahmen offen sind.

Nach dem Merge den neuen `develop` in einem frischen Verzeichnis auschecken und den [manuellen Durchlauf](phase-6-handover.md) sowie `quality:full` auf dem integrierten Stand ausführen. Merge-Commit und Ergebnisbericht festhalten. Den vorhandenen lokalen `develop` nicht ungeprüft wechseln oder überschreiben: Er kann in einem anderen Worktree geöffnet sein.

Lokal zeigte `origin/HEAD` vor dem Übergang auf `master`. Den aktuellen GitHub-Default in Schritt 1 prüfen. Wenn `master` weiterhin der Default bleiben soll, einen zweiten geprüften PR **develop → master** erstellen; danach CI und den integrierten Stand prüfen. Alternativ `develop` bewusst zum Default machen. Eine Umbenennung nach `main` ist für die Migration nicht notwendig. Der vorbereitete Workflow berücksichtigt alle drei Branchnamen.

## 5. API-Repository erst danach stilllegen

Erst wenn das gemeinsame Repository und sein Default-Branch akzeptiert sind:

1. Offene Issues und PRs in `ChroniX6x/tobu-finance-api` durchsehen; relevante Arbeit im gemeinsamen Repo mit Link zum Ursprung nachführen. Nichts pauschal schließen.
2. README und Repository-Beschreibung des API-Repos mit einem Hinweis auf `https://github.com/ChroniX6x/tobu-finance` aktualisieren. Der API-Pfad ist dort `apps/api`; gemeinsame Entwicklung und Installationen erfolgen im Root.
3. Vorhandene Actions, Webhooks, Deploy-Keys, externe Builds und Links inventarisieren. Nur tatsächlich vorhandene Integrationen auf Root-Installation/Workspace-Pfade umstellen und prüfen. Aktuell wurde kein produktives Deployment angegeben.
4. Erst dann **Settings → General → Danger Zone → Archive this repository**. Archivierung macht auch Issues und PRs schreibgeschützt, bleibt aber rückgängig zu machen. [GitHub-Anleitung zur Archivierung](https://docs.github.com/en/repositories/archiving-a-github-repository/archiving-repositories).

Die bisherigen lokalen Ordner können als Rückfallkopien erhalten bleiben; dort keine parallele Weiterentwicklung mehr betreiben. Kein lokales Verzeichnis und kein MongoDB-Volume wird für die Archivierung gelöscht.

## 6. Abschluss melden

Für Gate 6 festhalten: PR-URL, Merge-Commit, Default-Branch, beide CI-Ergebnisse, manueller Abnahmestand, Ergebnis des geprüften Rückfallwegs und Archivierungsstatus des API-Repos. Erst damit ist der Übergang abgeschlossen. Rollen-/Owner-Arbeit und Sicherheitsbefunde bleiben als eigene Folgeaufgaben bestehen.
