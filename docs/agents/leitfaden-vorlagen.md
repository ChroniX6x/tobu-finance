# ToBu Finance – Agenten-Leitfaden Buchungsvorlagen

**Version 4 · 14.11.2026 · Standard: ein Initialisierungsprompt, danach `GO <ID>`**  
**Status:** Arbeitsanweisung für den Coding-Agenten; keine Freigabe zur automatischen Implementierung.  
**Ziel:** minimale Token-/Tool-Kosten ohne Verkürzung von Anforderungen, Sicherheitsregeln oder A-/Q-Gates.

> **Single Source of Truth:** Der Implementierungsplan `01_Buchungsvorlagen_Implementierungsplan.md` definiert **was** umgesetzt wird. Dieser Leitfaden definiert **wie effizient** der Agent arbeitet und wie er Arbeit über Chats hinweg übergibt. Bei fachlichem Konflikt gilt der jüngere bestätigte normative Plan, insbesondere §§53–61. Dieser Leitfaden erzeugt **keine neuen Fachentscheidungen**.

## 1. Feste Quellen und Ablageorte

Der Coding-Agent arbeitet im tatsächlichen, separat zu verifizierenden ToBu-Repository. Die folgenden externen Referenzdateien befinden sich laut Nutzer in:

```text
C:\Users\hoffm\Documents\DevProjects\tobu-finance-agent-docs
```

| Kürzel | Datei | Wofür |
|---|---|---|
| 01 | `01_Buchungsvorlagen_Implementierungsplan.md` | Schritte, Reihenfolge, A-/Q-Gates, Freigabe |
| 02 | `02_Date_Month_Implementierungsplan.md` | H00–H08, H09-Übergabe, CAL-/Date-Restpunkte |
| 03 | `03_Eventsystem_Implementierungsplan.md` | E00–E09, Activity-/Event-Restpunkte |
| 04 | `04_Buchungsvorlagen_UseCases.md` | konsolidierte MVP-Fachregeln; ältere Passagen nur Archiv |
| 05 | `05_Buchungsvorlagen_UI_Spezifikation.md` | normative UI §§0A–0F/§2, Aktions-/Feldmatrix |
| IMG-EDIT | `edit-page.png` | visuelle Referenz für Erstellen/Bearbeiten |
| IMG-LIST | `list-detail-page.png` | visuelle Referenz für Liste/Detail |

**Dieser Leitfaden heißt lokal `leitfaden-vorlagen.md`** und liegt im `docs/agents` Ordner. Keine Bezugnahme auf frühere Namen `ToBu_Buchungsvorlagen_Agent_Prompt_Leitfaden_V*.md`.

**Bestehende Implementierungsnachweise:** `docs/agents/runs` **innerhalb des ToBu-Repositories**. Dessen vorhandene Ordnerstruktur, Dateinamen, Formate, Run-Konventionen und ggf. Übersichten respektieren. **Keine** zusätzliche `recurrences-progress.md`, keine zweite Fortschrittsdatenbank und keine Kopie eines Run-Reports an anderer Stelle anlegen. Nachweise je Schritt im passenden bestehenden Run-Muster aktualisieren/anlegen, bestehende H08-/Event-/QA-Runbelege referenzieren statt duplizieren. Falls die bestehende Run-Struktur unklar ist, zuerst kurz inspizieren; nichts überschreiben oder umorganisieren.

**Quellenauflösung:** Beim Start den exakten Ordner und die acht Dateien (01–05, beide PNGs, diesen Leitfaden) direkt prüfen, ohne globale/rekursive Suche. Pfad und Änderungsstand/Hash für Wiederverwendung notieren. Der Windows-Pfad ist nur im lokalen Agenten-Umfeld gültig; bei WSL einen tatsächlich geprüften Mount verwenden. Fehlender Dateizugriff = `BLOCKED`, niemals Inhalt oder Bildbetrachtung vortäuschen.

## 2. Verbindlicher Minimal-Workflow

1. **Einmal je neuem Chat/Agentenkontext initialisieren:** `leitfaden-vorlagen.md`, Repo-`AGENTS.md` und relevante Projektregeln lesen. Den **gesamten aktuellen** Plan 01 mit seiner Norm-/Verweiskette gemäß 01 §61.2 einmal lesen (nicht in die Antwort kopieren). Die übrigen Originale und belegten Vorgänger-Runs gezielt erschließen. Branch, HEAD, Dirty-Zustand, offenes PR-/CI-/Migrationsrisiko und Quellenzugriff prüfen. Nur im tatsächlich genehmigten, geschützten Arbeitskontext arbeiten; nicht automatisch checkout/reset/stash.
2. **Dann auf ausdrückliche Freigabe warten.** Standardmäßig sagt der Nutzer allein **`GO P00`**, danach `GO P01`, `GO D04`, `GO V08` usw. Die ID aktiviert den **vollständigen Originalschritt** inklusive Ergänzungen, Tests, A-/Q-Gates und seiner Abhängigkeiten; kein weiterer Langprompt ist erforderlich.
3. **Vor jedem GO-Umsetzungsschritt einmal gebündelt prüfen:** letzten relevanten Run mit offenem Vorgängerstatus; tatsächliche H08-/Date- und E00–E09-/Event-Gates, Blocker, Belege/SHA und Auswirkungen des aktuellen Diffs. Wenn nachgewiesen unverändert, kurz referenzieren; **nicht** alle Vorgängertests wiederholen. Bei betroffenen Kalender-/Event-/Auth-Schnittstellen Belege gezielt neu validieren und erforderliche Regressionstests ausführen. Fehlendes H08-/E09-PASS oder inkompatible integrierte SHAs = Blocker, kein fingiertes PASS.
4. **Nur den freigegebenen Schritt implementieren und abnehmen.** Relevante Originalabschnitte in 01 und bedarfsgerechte Abschnitte in 02–05 sowie betroffene Codedateien lesen. Keine weitere Phase, kein neuer Fachumfang, kein stilles Plattform-Fixing außerhalb des GO. Bei fachlichem STOP: dokumentieren und warten.
5. **Nach dem Schritt** echte A-/Q-Status separat bewerten, Tests/Fixtures/Exit-Codes/SHA und offene Findings in `docs/agents/runs` nach bestehendem Muster belegen; im Chat kurz berichten und **immer STOP**. Eine empfohlene Folge-ID ist niemals ein GO.

**Wichtig:** Nur die Eingabeaufforderung wird verkürzt, nicht der Arbeitsumfang des fachlichen Plans. Falls der Chat seinen Kontext verliert, nicht blind nur `GO <ID>` senden: zuerst die Neuinitialisierung aus §6 verwenden.

## 3. Tokenoptimierung mit unveränderten Qualitätsanforderungen

### 3.1 Kontext und Dokumente

- Nach der einmaligen Pflichtlektüre nicht erneut sämtliche Dokumente und Repository-Dateien laden. Für einen Schritt nur dessen Originalabschnitt in 01, `25.<ID>` (soweit vorhanden), einschlägige neuere §§53–61 und tatsächlich betroffene Passagen in 02–05 sowie Codedateien lesen.
- **P04-Ausnahme:** Es existiert **kein** `25.P04`. Verbindlich sind 01 §§57.2–57.6 sowie zugehörige TZ-/EIT-Gates und §§53–61.
- Bei neuer Agentensitzung gelten erneut die Erstlektüre-/Quellenregeln aus 01 §61.2. Keine vollständigen alten Chats in den neuen Kontext kopieren; den neuesten einschlägigen Run und belegte Abhängigkeiten verwenden.
- Referenzen auf Dokumente/Runbelege lieber als Pfade, SHA, Prüf-ID und Testnamen halten; große Rohtexte oder Testlogs nicht in Chatantworten wiederholen.

### 3.2 Checks einmal planen und sinnvoll bündeln

- **Ein Vorab-Sammelcheck:** Git-Branch/HEAD/Dirty + letzter Step-Run + H08-/Event-/Migrations-/Auth-Gates + betroffene Codebereiche. Das ersetzt mehrfaches Einzel-Nachfragen, **nicht** notwendige Inhaltsprüfungen.
- Nach `git diff` eine kurze **Wirkungsmatrix** bilden: `contracts`, `api`, `db/migration`, `web`, `calendar`, `activity`, `auth`, `ui`. Davon abhängige Tests/Bilder planen.
- Während der Implementierung nur zielgerichtete schnelle Tests; keine komplette Quality-Suite nach jeder kleinen Änderung.
- **Ein geplanter Abschluss-Testlauf** nach der letzten Änderung. Vorher `package.json`/bestehende Scripts prüfen: Werden Lint, Format, Typecheck, Contracts und Unit-Tests durch eine Pflichtsuite bereits vollständig nachweisbar ausgeführt, identische Teilsuiten nicht doppelt starten. Integration bei echten DB-/API-Schreibpfaden, isoliertes ReplicaSet und Migrations-Up/Down/Recovery bei Migrationen, Real-API-E2E bei UI-Flows sowie geforderte Milestone-/`quality:full`-Gates bleiben zwingend. `quality` ersetzt `test:integration`/`e2e:real` nur bei **nachgewiesener** vollständiger Abdeckung und sofern der Originalplan dies erlaubt. Keine riskante Parallelisierung gegen dieselbe Testdatenbank.
- Testergebnisse kurz persistieren: `Befehl | Exit-Code | getestete Fälle | Layer/Fixture | Branch/SHA/Dirty | Logpfad`. Bei Erfolg nur Zusammenfassung lesen; bei Fehlern nur betroffene Logstellen. Falls nach abschließendem Gate-Lauf Code geändert wird: betroffene Tests und erforderliche Abschlussgates erneut ausführen. Kein A-/Q-PASS ohne echte Nachweise.
- Frühere H08-/Event-Nachweise nur **SHA-/Diff- und Schnittstellen-geprüft** wiederverwenden. Ein PASS aus getrennten Branches ist kein Beleg für den gemeinsamen Integrationsstand.

### 3.3 Bildreferenzen wirklich benutzen

- Bei passenden UI-Schritten das **echte** `edit-page.png` oder `list-detail-page.png` öffnen und den gerenderten Angular-Screen visuell damit vergleichen. Beim ersten entsprechenden Screen prüfen und die Bildpfade/Hash in `docs/agents/runs` dokumentieren; später nicht jedes Mal neu suchen. Neuer/geänderter Screen benötigt aber wieder einen tatsächlichen Abgleich.
- Edit-Bild vor allem für V08/V12, Liste/Detail für V10/V11; bei V26 **beide**; bei anderen Schritten die tatsächlich betroffene Oberfläche zuordnen. Kein PNG-Öffnen erzwingen bei reinen Backend-Schritten.
- Bilder sind **visuelle Beispiele**, kein vollständiger Funktionskatalog. Normativ: 05 §§0A–0F/§2 und jüngere Beschlüsse. Create/Edit = volle verbleibende Hauptinhaltsbreite, innen zweispaltig Desktop, mobil einspaltig. **Keine** Löschen-Aktion oder Aktivstatus-Schalter im Formular, keine aus Bildern erfundenen Icon-/Farb-Datenfelder. Fehlende Bilder = offenes visuelles Gate, kein stilles UI-PASS.

## 4. Reihenfolge und harte Grenzen

**Reguläre Reihenfolge (jeweils getrenntes GO):**

```text
P00 → P01 [falls erforderlich] → P02 → P03 → P04
    → D04 → D05 → D06 [ggf. mit begründetem N/A] → D07
    → V08 → V09 → ... → V28
```

- **P00:** prüfende Baseline, keine Feature-Implementierung. Fehlen H08-A/Q oder E00–E09-A/Q auf kompatibler Integration, den abhängigen Gate als `BLOCKED` markieren; notwendige H-/E-Aufgaben nur **mit eigenem Nutzer-GO**.
- **P01:** nur unter nachgewiesenen Voraussetzungen N/A. **P04:** obligatorischer Account-IANA-Zeitzonen-Slice vor D07. **D06:** N/A ausschließlich nach Bestandsnachweis. M0–M5 sind Meilensteingates, keine Folgeschrittfreigaben.
- **Sicherheitspriorität:** Tenant-/Account-ACL, registrierter Self-Owner (DEC-0057), Kategorie-Create-Rechte (DEC-0058), getrennte User-/Member-Identität, strikte JWT-/Cross-Account-Tests; Kalender-/BankDate-Vertrag nach DEC-0056; zentraler transaktionaler ActivityWriter; atomare Parent/Occurrence/Skip/Link-/Revisionsregeln und Split-/Saldo-Regressionen.
- Keine unfreigegebene echte Datenmigration, Änderung vorhandener Benutzerdaten, Push, Merge, Deploy, Release, Reset oder gefährliche Bereinigung. Bereits vorhandene ungeschützte Routen nicht ungeprüft öffentlich freigeben. Wo Code im Feature-Branch lokal committet werden soll, gelten die bestehenden Repo- und Auftragsregeln; keine eigenmächtige Änderung fremder Arbeitsbäume.
- Stop-/Konfliktregeln aus 01 §§53–61 und den aktuellen Fachbeschlüssen gelten vor älteren Archivabschnitten. Kein Scheduler, kein stiller Backfill und keine vom Plan ausgeschlossene neue Funktion.

## 5. Persistenter Run-Nachweis und kompakter Abschluss

**Vorhandenen Run-Standard nutzen:** Agent inspiziert zu Beginn beispielhaft die letzten `docs/agents/runs`-Einträge (einschließlich H08/Event, soweit vorhanden) und führt das dortige Muster fort. Ein neuer Schritt wird im passenden Run nachvollziehbar, ohne bestehende Artefakte zu überschreiben oder einen zweiten Gesamtstatus zu pflegen.

In jedem neuen/aktualisierten Schritt-Run müssen nachweisbar stehen (bestehende Struktur verwenden, kein neues Format erzwingen):

```text
step / status: A=PASS|FAIL|BLOCKED|NOT-RUN; Q=PASS|FAIL|BLOCKED|NOT-RUN
source: Branch, Start-/End-SHA, Dirty, tatsächlich geänderte Pfade
prerequisites: letzter Step-Run; H08-/Date-Run; E00–E09-/Event-Run; Blocker
checks: konkrete Commands, Exitcodes, Testfälle, isolierte Fixtures, Log-/Reportpfade
ui: benutzte Bildpfade + Screens/Abweichungen (falls relevant)
open: offene Punkte, ungültig gewordene Nachweise, nächster zulässiger Schritt
```

Im Chat **höchstens ca. 6–8 kurze Zeilen**: Schritt, SHA/Dirty, Vorgänger+H08+Event-Status, A/Q, relevante Checks, Bilder (falls UI), Blocker, vorgeschlagene nächste ID; immer `STOP: nächstes GO abwarten`. Detaillierte Evidenz in Run-Artefakten, nicht im Chat. Keine Platzhalter als echte Testergebnisse ausgeben.

## 6. Was der Nutzer wann kopiert

### A. Erster Chat / neu initialisierter Agent (einmal kopieren)

```text
Arbeite im geöffneten ToBu-Repository. Lies den lokalen Leitfaden:
C:\Users\hoffm\Documents\DevProjects\tobu-finance-agent-docs\leitfaden-vorlagen.md

Initialisiere gemäß Leitfaden §§1–3 und 01 §61.2: Repo-/AGENTS-Regeln,
aktuellen Gesamtplan 01, fünf Quelldokumente und beide Originalbilder
auffinden; vorhandene Implementierungs-Runs unter docs/agents/runs
als alleinige Fortschritts-/Übergabenachweise verwenden.

Prüfe Branch/SHA/Dirty und tatsächlichen H08-/Event-Gate-Stand.
Nutze den tokenoptimierten Workflow und die gebündelten Checks.
Nenne nur Quellenstatus, offene Blocker und die nächste zulässige ID.
Noch keine Implementierung; warte auf mein Einzel-GO.
```

### B. Im gleichen Chat: je freigegebenem Schritt **nur** die ID kopieren

```text
GO P00
```

Beim nächsten zulässigen Schritt z. B. `GO P01`, später `GO V08`. **Nicht** zusätzlich alte 30 Einzel-Langprompts senden. Wenn der Agent einen benannten Schritt nicht aus dem Plan korrekt auflösen kann, als Fallback: `GO V08. Nur 01 Originalschritt + 25.V08 + §§53–61, A/Q und STOP.` Für P04 auf §57.2–57.6 statt `25.P04` verweisen.

### C. Chat wechseln: nur bei Bedarf, nicht automatisch nach jeder ID

Vor dem Wechsel einmal kopieren:

```text
Bereite eine kurze Übergabe vor: Prüfe/ergänze den letzten passenden
Run unter docs/agents/runs nach bestehendem Muster (SHA, A/Q,
Testnachweise, Vorgänger-/H08-/Event-Restpunkte, offene Blocker,
nächste zulässige ID). Keine neue Fortschrittsdatei, keine neuen
Featureänderungen oder Wiederholungstests ohne Anlass.
Antworte mit Runpfad, Status und nächster ID; danach STOP.
```

Für den **neuen Chat** wieder Prompt A verwenden, ergänzt um:

```text
Es ist eine Fortsetzung. Lies zuerst die jüngsten relevanten Runs
unter docs/agents/runs (insbesondere den letzten Vorlagen-Run und
H08-/Event-Belege). Verwende die dortigen Nachweise statt den alten
Chatverlauf zu rekonstruieren. Prüfe ihre Gültigkeit am aktuellen SHA.
Noch kein GO.
```

Dann nach der knappen Bestandsmeldung wieder nur `GO <nächste ID>`.

**Chatstrategie:** Zusammenhängende Schritte in einem Chat bearbeiten, solange Kontext und Qualität stabil bleiben. Bei sehr langem Debugging-/Toolverlauf oder an einer sinnvollen Abschnittsgrenze wechseln. Kein starrer Chatwechsel nach jeder Aufgabe, keine unbelegte Behauptung, ein neuer Chat spare grundsätzlich Tokens.

---

**Merksatz:** **Einmal initialisieren → `GO <ID>` → Run unter `docs/agents/runs` → A/Q und STOP → nächstes GO.** Beim Chatwechsel nur vorhandene Runs als Übergabe; keine duplizierte Statusdatei.
