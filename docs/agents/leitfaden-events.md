# Event-Implementierung: einfach und tokenbewusst weiterarbeiten

Stand: 03.11.2026. Date/Month ist laut Nutzer abgeschlossen. P00 bleibt abgeschlossen. **Beginne mit E00**, danach folgt pro eigenem GO genau ein weiterer E-Schritt. Dieser Leitfaden selbst führt keinen Schritt aus.

## So benutzt du die Prompts

1. Öffne ToBu im lokalen Agenten. Die Featurepläne müssen unter `C:/Users/hoffm/Documents/DevProjects/tobu-finance-agent-docs` erreichbar sein. Cloud-Copilot braucht tatsächlich zugängliche vollständige Pflichtquellen; dein Windows-Pfad allein reicht dort nicht.
2. Kopiere zunächst **nur den E00-Codeblock** unten in den Umsetzungschat. Nicht den ganzen Leitfaden mitsenden. Der Agent beschafft Code, Quellen und Belege selbst.
3. Warte auf den Abschlussbericht. Prüfe: richtige Schritt-ID, A und Q getrennt, tatsächliche Tests und Reviewbelege, offene Punkte, Berichtdatei. A bedeutet fachliche Abnahme, Q technischer Quality-Nachweis gemäß Schrittvertrag.
4. Bei FAIL/BLOCKED erst die Ursache im aktuellen Schritt klären. Bei erforderlicher gesonderter Freigabe warten. Keine Folgephase als Ausweichlösung starten.
5. Wenn die Schrittgates und Voraussetzungen erfüllt sind, kopiere den nächsten Codeblock. Jeder Block ist ein eigenständiger Auftrag; nichts zusammensetzen oder Platzhalter ersetzen.

Der Agent hält pro Schritt eine kompakte Datei unter `docs/agents/runs/E00.md` bis `E09.md` aktuell. Dort stehen auch Quellenstand, Onboarding-Nachweis, Code-SHA, Dirty-Status und Links auf ausführliche Testbelege. SHA bezeichnet den Commit; Dirty kennzeichnet weitere uncommittete Änderungen. Quellen-Hashes dürfen nicht als Beweis für bereits gelesene Inhalte ausgegeben werden.

## Was für alle zehn Aufträge gilt

Die folgenden Regeln sind in `token-plan.md`, den Projektregeln und den referenzierten Verträgen verankert; jeder Prompt verweist darauf:

- Einmaliges vollständiges Pflicht-Onboarding bleibt bestehen. Belegten aktuellen Kontext wiederverwenden; bei fehlendem Nachweis Pflichtlektüre nachholen. Danach nur den aktuellen Schritt, geltende Nachträge und nötige Verweise vollständig lesen. Keine wiederholten Gesamtdumps unveränderter Pläne.
- Der Eventplan ist `03_Eventsystem_Implementierungsplan.md`: Kapitel 6 enthält Schritte/A/Q, Kapitel 7 Testanforderungen, §§22–24 den konsolidierten Vertrag und Einzel-GO. Vorlagenplan §61 regelt den Kontrollvertrag und bestätigte Owner-/Category-Regeln. Aktuelle Normen haben Vorrang vor historischen Diskussionen.
- Berichte, Code und echte Tests zählen als getrennte Belege. [H08-Abschluss](runs/H08-ABSCHLUSS.md) ist PASS **mit Ausnahmen**, nicht uneingeschränkt. Offene Folgepflichten aus [Ausnahmen](h08-freigegebene-ausnahmen.md), H08-Abschluss und [H09](runs/H09.md) übernehmen. Ein späteres Gate darf sie nicht durch Verweis auf H08 als erledigt behandeln.
- Kurze Chat-Ergebnisse, vollständige Logs als verlinkte Artefakte ohne Secrets. Pro Test-ID prüfbare Assertions und tatsächlichen Lauf dokumentieren. Gleiche Assertions dürfen mehrere IDs belegen, aber keine unabhängigen Fehlergrenzen ersetzen. Vorgeschriebene Prüfungen und unabhängige Reviews bleiben Pflicht.
- Keine Migration/Restore/Reset bestehender Datenbanken, kein Push/Merge/Deploy durch diese GO-Prompts. Isolierte Tests bleiben zulässig. Keine zweite Eventhistorie, kein eigener Bus oder generisches Commandframework ohne eigene Architekturfreigabe.

Ein fehlender Bericht am empfohlenen Pfad ist kein Anlass zum Erfinden eines PASS. Der Agent soll vorhandene gleichwertige Belege suchen und verlinken, sonst die Lücke benennen.

## E00 – Bestand und Risiken erfassen

```text
GO ausschließlich für E00 gemäß aktuellem Event-Implementierungsplan.
Lies AGENTS.md und docs/agents/token-plan.md. Quellenordner:
C:/Users/hoffm/Documents/DevProjects/tobu-finance-agent-docs.
Date/Month ist abgeschlossen, P00 nicht wiederholen. Nutze
docs/agents/runs/H08-ABSCHLUSS.md, h08-freigegebene-ausnahmen.md
unter docs/agents sowie docs/agents/runs/H09.md als Übergabe.
Prüfe Branch/SHA/Dirty, tatsächliche H08-Basis und Quellenänderungen.
Nutze belegtes Onboarding; fehlende Pflichtlektüre nachholen. Lies E00,
aktuelle §§22–24 und die nötigen §61-/Testverweise vollständig.
Erfasse Writer, Reads, Renderer, Actors, ACL, Tests, echte DB-Validatoren
und Indizes sowie Risiken und fällige H08-Nachträge. Kein Featurecode,
keine Bestandsdatenmutation. Führe die E00-Pflichtprüfungen isoliert aus.
Schreibe docs/agents/runs/E00.md mit Inventarverweisen, A/Q, echten
Belegen und offenen Voraussetzungen. Kurzer Chatbericht; danach STOP.
```

## E01 – Event-Contracts und Katalog

```text
GO ausschließlich für E01 gemäß Eventplan und §61.
Nutze docs/agents/token-plan.md und docs/agents/runs/E00.md.
Prüfe aktuellen SHA/Dirty, Voraussetzungen und Quellenänderungen.
Lies E01, geltende Nachträge §§22–24 und Pflichtverweise vollständig;
belegten Kontext wiederverwenden, keine erneuten Gesamtdumps.
Erarbeite ADR, typisierten Code-/Payloadkatalog, Actor/Trigger/Subject,
Command-/Correlation-Regeln, Legacy-Decoder, Retention und Read-/UI-Vertrag.
Contracts zentral in packages/contracts, OpenAPI/Verbraucher synchron.
Bestehendes date bleibt persistierter Instant, occurredAt die API-Projektion.
No-Event-Fälle und User/System/Legacy-Unknown eindeutig definieren.
Keine Recurrence-Engine oder neuen Fachentscheidungen vorziehen.
Führe alle E01-Gates einschließlich Contracts, Invalid/Unknown/Roundtrip,
check:contracts und typecheck tatsächlich aus. Bericht mit A/Q und
Belegen nach docs/agents/runs/E01.md; kurze Ausgabe, danach STOP.
```

## E02 – Echte Akteure und Kontozugriff

```text
GO ausschließlich für E02 gemäß Eventplan und §61.
Nutze docs/agents/token-plan.md und docs/agents/runs/E01.md;
Inventar und H08-Nachträge gezielt über Verweise nachladen.
Prüfe SHA/Dirty, Voraussetzungen und Quellenänderungen. Lies E02,
§§22–24, §61.3/61.4 und Pflichtverweise vollständig.
Implementiere servertrusted Actor-/Trigger-/Account-Kontext mit geprüfter
JWT-sub→Member.userId→Account-Mitgliedschaft. Actor von Zahler/Subject
trennen; System nur intern, Admin ohne Membership kein Bypass.
Sichere die verlangten bestehenden Read-/Write-Routen und Owner-Aktionen.
H08-Mitgliedschaftsprüfung nicht als vollständige Rollenprüfung ausgeben.
Keine Owner-Zuordnung erraten; echte AUTH-Blocker konkret melden.
Echte JWT/HTTP/Mongo-Negativtests einschließlich Forgery, Fremdkonto,
Rollen und 0 Writes/Events bei Ablehnung gemäß E02 ausführen.
Bericht A/Q und Belege: docs/agents/runs/E02.md. Danach STOP.
```

## E03 – Persistenz, Indizes und Legacy-Verträglichkeit

```text
GO ausschließlich für E03 gemäß Eventplan und §61.
Nutze docs/agents/token-plan.md und docs/agents/runs/E02.md;
E00-DB-Inventar und E01-Contracts nur gezielt nachladen.
Prüfe SHA/Dirty, integrierten H08-Stand, Voraussetzungen und Quellenänderungen.
Lies E03, §§22–24 und die vorgeschriebenen DB-/Migrationsregeln vollständig.
Erweitere die bestehende Event-Collection gemäß Vertrag additiv;
Legacy-Events unverändert lesbar, keine historischen Actors erfinden.
Validatoren/Indizes real prüfen; Index accountId/date/_id berücksichtigen.
Migrationscode nur im freigegebenen E03-Umfang vorbereiten und isoliert
an Fresh-/Legacy-Fixtures prüfen, keine Bestandsmigration anwenden.
S1/S2 und vorgeschriebene Backup-/Recovery-/Replica-Nachweise beachten;
fehlende Voraussetzungen als Blocker führen statt Prüfschritte auszulassen.
Alle E03-A/Q-Belege nach docs/agents/runs/E03.md; danach STOP.
```

## E04 – Atomarer gemeinsamer Writer

```text
GO ausschließlich für E04 gemäß Eventplan und §61.
Nutze docs/agents/token-plan.md und docs/agents/runs/E03.md.
Prüfe SHA/Dirty, Voraussetzungen und Quellenänderungen; lies E04,
§22.5 und alle aktuellen Pflichtverweise vollständig und gezielt.
Implementiere gemeinsamen Domain-/Activity-Commit in derselben Mongo-Session,
mit validiertem trusted Actor, Code, Subject und params. Vorhandene
H02-Transaktionsarbeit wiederverwenden, keine zweite Event-Session.
Keine Events bei GET/No-op/Invalid/Rollback und keine verschluckten Fehler.
Retry und unbekannten Commit über stabile Schlüssel/Readback absichern;
keine neue generische IdempotencyCollection oder Outbox.
Reale Failpoint-, Parent/Child/Event-Readback-, Parallelrequest-,
LostReply- und Restart-Tests gemäß E04/EIT ausführen.
Bericht mit A/Q, Test-IDs und Belegen: docs/agents/runs/E04.md.
Kurzer Chatbericht; danach STOP, kein automatischer Modul-Rollout.
```

## E05 – Vorhandene Fachmodule anbinden

```text
GO ausschließlich für E05 gemäß Eventplan und §61.
Nutze docs/agents/token-plan.md und docs/agents/runs/E04.md,
dazu das E00-Routeninventar und den E01-Codekatalog über ihre Verweise.
Prüfe SHA/Dirty, Voraussetzungen und Quellenänderungen. Lies E05,
§22.4, aktuelle Normen und Pflichtverweise vollständig.
Binde alle tatsächlich vorhandenen mutierenden Routen gemäß Pflichtumfang
an den gemeinsamen Writer an: Transactions/Splits, Account/Members/Roles,
Categories, Income, Contribution/Budget, Carryover, Balance, Legacy-Recurrence.
Intern in kleinen Teilslices arbeiten; N/A nur mit konkretem Read-only- oder
Unerreichbarkeitsnachweis. Kein neues Recurrence-MVP.
Pro Route Code/Actor/Subject/Rechte/Fehler/Rollback dokumentieren und
reale CRUD-/Status-/Split-/Fault-Tests mit Eventcounts und Finanzsummen prüfen.
H08-Legacy-/ACL-Defekte nicht als erledigt behaupten oder unsicher umgehen.
Pflichtreviews und A/Q-Belege nach docs/agents/runs/E05.md; danach STOP.
```

## E06 – Activity lesen und anzeigen

```text
GO ausschließlich für E06 gemäß Eventplan und §61.
Nutze docs/agents/token-plan.md und docs/agents/runs/E05.md.
Prüfe SHA/Dirty, Voraussetzungen und Quellenänderungen. Lies E06,
§22.6, geltende Nachträge und UI-/Testverweise vollständig und gezielt.
Implementiere autorisierten Account-Activity-GET und Desktop-/Mobile-Ansicht
mit Filtern, stabiler Keyset-Pagination date/_id und sicherem Cursor-Kontext
(Default 20, Maximum 100). Bestehende 20er-Vorschau identisch schützen.
Legacy-Unknown, deleted Subject ohne Deadlink, minimierte sichere Labels.
Trusted Batch-Gruppierung auch über Pagegrenzen: keine falschen Gesamterfolge
bei PartialSuccess oder noch ungeladenen Events; GET bleibt ohne Writes.
Alle E06-Contracts/API/Angular/Mock+Real-Browser- und ACL/IDOR/XSS/A11y-
Nachweise inklusive gleichen Zeitstempeln und 10k-/Indexprüfung ausführen.
Bericht A/Q und Belege: docs/agents/runs/E06.md. Danach STOP.
```

## E07 – Recurrence-Primitiven, noch keine Engine

```text
GO ausschließlich für E07 gemäß Eventplan und §61.
Nutze docs/agents/token-plan.md und docs/agents/runs/E06.md;
E01/E04-Contracts und Writer gezielt nachladen.
Prüfe SHA/Dirty, Voraussetzungen und Quellenänderungen. Lies E07,
§22.7, DEC-0050 und alle aktuellen Pflichtverweise vollständig.
Ergänze die geforderten Recurrence-Codes, Subject-/Payload-Contracts,
Renderer und Writer-Adapter mit isolierten Testproben. Kein Ensure-Service,
keine neue echte Recurrence-Domainimplementierung oder Konto-Zonenroute.
Prüfe an generischen echten Mongo-Domainfixtures Eventerhalt nach Delete,
atomaren recurrence.deleted, Actor/Korrelation, No-op, Failpoint und Retry.
EIT-25–30 zweigeteilt führen: Plattformnachweis jetzt, spätere tatsächliche
Recurrence-Domain-/HTTP-Nachweise separat NOT-RUN/BLOCKED, nicht vortäuschen.
EIT-35/TZ bleiben dem Konto-Zonenfeature zugeordnet.
Bericht A/Q und Belege: docs/agents/runs/E07.md; danach STOP.
```

## E08 – Unabhängiger Negativreview

```text
GO ausschließlich für E08 gemäß Eventplan und §61.
Nutze docs/agents/token-plan.md und docs/agents/runs/E07.md sowie
die verlinkte E00–E07-Coverage/Evidence. Prüfe SHA/Dirty und Quellenänderungen.
Lies E08 und aktuelle Pflichtverweise vollständig. Veranlasse den geforderten
unabhängigen zweiten Reviewer; übergib Scope, Diff-Basis, SHA, Verträge und
Belegpfade statt der ganzen Chatgeschichte. Selbstreview ersetzt ihn nicht.
Prüfe Writer/Reads, ACL/Actor/Privacy, Legacy, Whitelist, Retention,
Rollback, Maintenance/Backup/TTL, Parallelität/Retry, DB-Readback und A11y.
Führe die vorgeschriebenen unabhängigen realen Negativtests aus;
Autorenberichte allein sind kein Beweis. Findings priorisiert mit Datei/Zeile,
verletzter Regel und Reproduktion melden. Änderungen/Test-Nachläufe müssen
auf denselben abschließend geprüften Stand zurückgeführt werden.
Fehlender Reviewer oder Pflichtnachweis = BLOCKED, kein Ersatz-PASS.
Bericht A/Q und Belege: docs/agents/runs/E08.md; danach STOP.
```

## E09 – Gesamtprüfung und Übergabe

```text
GO ausschließlich für E09 gemäß Eventplan und §61.
Nutze docs/agents/token-plan.md und docs/agents/runs/E08.md samt
verlinkten E00–E07-Belegen und docs/agents/runs/H08-ABSCHLUSS.md.
Prüfe Voraussetzungen, aktuellen SHA/Dirty und Quellenänderungen;
lies E09, §§22–24 und aktuelle Gate-/Handover-Verweise vollständig.
E00–E08 jeweils A/Q und H08-Basis samt freigegebenen Ausnahmen nachweisen.
Vor E09 fällige H08-Findings (insbesondere F-3 laut Abschluss) wirklich klären;
H08-Ausnahme nicht als Event-Freigabe übernehmen. Offenes konkret blockieren.
Auf passendem clean Integrations-SHA die vorgeschriebenen E09-Gates mit
frischem npm ci, Contracts/Typecheck, API/Integration/Web/e2e:real/Replica
und quality:full tatsächlich ausführen. Keine fehlenden Voraussetzungen skippen.
EIT-25–30 Plattform vs. spätere Domain sowie EIT-35/TZ sauber trennen.
Evidence/Handover, offene Folgepflichten und A/Q nach docs/agents/runs/E09.md.
Danach STOP: kein Recurrence-Coding, Push/Merge/Deploy oder Bestandsmigration.
```

## Wenn ein Schritt scheitert oder der Chat zu lang wird

Bei einer Korrektur im selben Schritt genügt: „Behebe die offenen Findings innerhalb des bereits freigegebenen Schritts, prüfe die betroffenen Nachweise erneut und aktualisiere seinen Bericht. Keine Folgephase starten.“ Eigenständig freigabepflichtige Maßnahmen bleiben davon ausgenommen.

Bleibe innerhalb eines Schritts möglichst im selben Chat. Beim Wechsel zuerst den tatsächlichen Zwischenstand im Schrittbericht sichern lassen, einschließlich GO, Codezustand, Quellen-/Onboarding-Nachweis, erledigten und offenen Aufgaben. Im neuen Chat dann z. B. für E04:

```text
Setze den bereits ausdrücklich freigegebenen E04-Schritt fort.
Lies AGENTS.md, docs/agents/token-plan.md und docs/agents/runs/E04.md.
Prüfe Abweichungen, SHA/Dirty und Quellenstand. Nutze belegtes Onboarding;
fehlende Pflichtlektüre nachholen. Keine erledigten Schritte neu implementieren.
Schließe nur offene E04-Arbeiten und Pflichtnachweise ab, aktualisiere
den Bericht mit A/Q und Belegen; danach STOP.
```

Beim Wechsel zwischen Schritten direkt den nächsten einzelnen GO-Block oben verwenden. Ein neuer Chat spart nicht automatisch Tokens, weil fehlender Kontext erneut gelesen werden muss. Ein unabhängiger Reviewer braucht die relevante vollständige Prüfbasis, nicht die gesamte Unterhaltung.

## So kontrollierst du die Einsparung

Keine ganzen Pläne in Prompts kopieren, nur Schritt-ID und gezielte Verweise. Bereits entschiedene Produktregeln nicht erneut diskutieren lassen. Keine pauschalen Testwiederholungen auf unverändertem Code; vorgeschriebene Schritt-/Release-Gates trotzdem ausführen. Der Chat zeigt kurze Ergebnisse und relevante Fehler; die ausführlichen Belege bleiben verlinkt erhalten.

Verbrauchswerte nur erfassen, wenn dein Tool sie tatsächlich ausweist; sonst `unbekannt`. Nacharbeit und Review zum Schritt mitzählen. Kleine Chatantworten allein belegen keine Tokenersparnis. Der Agent darf Aufwand reduzieren, aber keine Coverage oder Sicherheit absenken.
