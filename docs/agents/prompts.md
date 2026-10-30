# Prompts für einzelne ToBu-Schritte

Platzhalter ersetzen. Diese Vorlagen erteilen selbst keine Freigabe. Quellen und Regeln siehe `token-plan.md`.

## Aktueller Einstieg: H04 nach H03-PR

P00 ist laut Nutzer abgeschlossen, H03 liegt im PR. Diesen Prompt verwenden, wenn H04 jetzt ausdrücklich beauftragt werden soll; die Dokumentanpassung selbst startet H04 nicht.

```text
GO ausschließlich für H04 gemäß aktuellem Date/Month-Implementierungsplan.
P00 ist abgeschlossen, H03 liegt bereits im PR. Wende
docs/agents/token-plan.md auf H04 an.
Nutze den vorhandenen Onboarding-Kontext und bisherige Berichte.
Prüfe Branch/SHA/Dirty und relevante Quellenänderungen. Kein Neustart
von P00 oder H00–H03, keine erneuten Gesamtdumps unveränderter Quellen.
Prüfe H03-PR-/Testbelege und ob der benötigte H03-Code im Ausgangsstand
enthalten ist. PR bedeutet weder Merge noch CI-PASS. Bei fehlender
Abhängigkeit konkret melden; keinen Merge oder Branchwechsel daraus ableiten.
Lies H04 und seine Pflichtverweise vollständig und setze nur H04 um.
Halte aktuelle Quellenstände und den vorhandenen Onboarding-Nachweis fest;
fehlende Nachweise nicht erfinden. Sichere zum Abschluss einen kompakten
Bericht in docs/agents/runs/H04.md mit A/Q, Testbelegen, Review,
SHA/Dirty und noch offenen Punkten. Vorhandene ausführliche Belege verlinken.
Danach STOP; H05 nicht beginnen.
```

## Folgeauftrag, Codex oder lokaler Copilot

```text
GO für [ID]. Setze nur diesen Schritt vollständig gemäß aktuellem
Implementierungsplan und §61 um, einschließlich eigener A-/Q-Gates.
Lies docs/agents/token-plan.md und den letzten Bericht [PFAD].
Prüfe Quellenstand und Code-SHA; nutze den belegten Onboarding-Kontext,
lies die aktuellen Schrittabschnitte und Pflichtverweise vollständig.
Erwartetes Ergebnis: [EIN KONKRETES ERGEBNIS].
Zusätzliche Scope-Grenze: [OPTIONAL].
Keine neuen Fachentscheidungen für bereits beschlossene Regeln.
Isolierte Tests und vorgeschriebene unabhängige Reviews durchführen.
Bericht mit Dateien, A/Q, Befehlen, Belegen, SHA/Dirty und Blockern.
Danach STOP bis zum nächsten ausdrücklichen GO.
```

Beispiel Ergebnis für H04: „Gemeinsame Datumspicker-/MonthPicker-Adapter und die im H04-Auftrag verlangten UI-Write-/Read-Flows samt Regressionstests; keine H05-Bestandsmigration.“ Dies ersetzt nicht das Lesen von H04 und seiner Verweiskette.

## Unabhängiges Review

```text
Prüfe unabhängig und read-only Schritt [ID] auf SHA [SHA], Dirty [STATUS].
Scope/Quellenabschnitte: [VERWEISE]. Diff-Basis: [BASE-SHA].
Implementierung und Testbelege: [PFADE].
Prüfe Anforderungsabdeckung, Sicherheits-/Fehlergrenzen und tatsächliche
Belegbarkeit der A-/Q-Aussagen. Die Autoren-Zusammenfassung ist kein Beweis.
Lies betroffene Dateien und nötige Aufrufer/Contracts gezielt nach.
Melde Findings nach Schwere mit Datei/Zeile und konkreter verletzter Regel;
keine Nacherzählung des Diffs. Fehlende Nachweise explizit benennen.
Keine Folgeimplementierung, kein Push/Merge/Deploy.
```

## Wiederaufnahme nach Sessionwechsel

```text
Setze den bereits ausdrücklich freigegebenen Schritt [ID] fort.
Letzter Bericht: [PFAD]; erwarteter SHA: [SHA], Dirty: [STATUS].
Prüfe zuerst Abweichungen und die Quellen-Hashes. Der Bericht ist Navigation,
keine Ersatzspezifikation. Fehlendes Pflicht-Onboarding nachholen.
Noch offen innerhalb dieses Schritts: [KONKRETE ARBEITEN].
Keine neue Phase starten. Nach vollständigem A-/Q-Bericht STOP.
```

## Kompakter Schrittbericht / Übergabe

Pro Schritt eine Datei, z. B. `docs/agents/runs/H01.md`; aktuelle Facts statt fortlaufender Chatkopie. Noch nicht ausgeführte Befehle ausdrücklich als geplant kennzeichnen.

```text
Schritt / ausdrücklicher GO-Bezug:
Repo / Branch / HEAD / Dirty / Diff-Basis:
Quellen: Dateinamen + SHA256 + normative Abschnitte:
Onboarding: vollständig gelesen wann / durch wen / Beleg:
Scope und tatsächlich geänderte Dateien:
A: PASS | FAIL | BLOCKED | NOT-RUN + Anforderung/Beleg:
Q: PASS | FAIL | BLOCKED | NOT-RUN + Gate/Beleg:
Tests: Befehl → Ergebnis, Test-IDs/Assertions, Logpfad, geprüfter SHA/Dirty:
Isolation: Test-DB/Runner, keine Credentials:
Unabhängiges Review: Reviewer, Stand, Findings und Auflösung:
Offen / nicht verifiziert / Benutzer- vs. CI-Nachweis:
Verbrauch: Messquelle, verfügbare Tokenwerte, Dauer, Nacharbeit:
Empfohlener nächster Schritt (kein GO):
STOP bis zum nächsten ausdrücklichen GO.
```

Keine globale PASS-Zeile aus einem einzelnen erfolgreichen Test ableiten. Test-ID-Matrix im vom Featureplan verlangten Artefakt führen; im Kurzbericht darauf verlinken. Evidence muss den tatsächlich geprüften Zustand einschließlich Dirty-Status ausweisen.
