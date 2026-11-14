# Recurrence-Activity-Primitiven (E07)

Dies ist die Eventplattformgrenze, keine Recurrence-Domainimplementierung. Keine neue Produktionsroute, Domaincollection, Ensure-/Schedule-/Revision-/Skip-/FullDelete-Logik und keine Konto-Zonenroute. Die bestehende Legacy-Recurrence verwendet weiterhin ausschließlich `legacyRecurrence.*`; neue Subjects werden niemals als Legacy-Dokumente interpretiert.

## Contracts und Emitmatrix

Eine gemeinsame Quelle bleibt `packages/contracts/src/activity.ts`:44 Codes, davon12 E07-Primitiven; keine freie Eventanlage durch Clients. IDs sind Strings, `occurrenceKey` ist der kanonische MonthKey, `date` ein UTC-Instant. Konfigurationswerte, Notizen, Gründe, Einkommens-/Finanzsnapshots und Geheimnisse werden nicht in neue Payloads aufgenommen. `changedFields` enthält nur Feldnamen.

| Code                             | Subject    | Minimale Params                                                                                             | Actor/Recht                    |
| -------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------ |
| recurrence.created               | recurrence | recurrenceId, revisionId, optionaler geclippter title                                                       | User/Member oder Owner         |
| recurrence.config.updated        | recurrence | recurrenceId, revisionId, optional previousRevisionId, changedFields                                        | User/Member oder Owner         |
| recurrence.activated/deactivated | recurrence | recurrenceId, ausdrücklich keine Revisionpayloads                                                           | User/Member oder Owner         |
| recurrence.revision.discarded    | recurrence | recurrenceId, revisionId, optional restoredRevisionId                                                       | User/Owner                     |
| recurrence.deleted               | recurrence | ausschließlich recurrenceId                                                                                 | User/Owner                     |
| occurrence.generated             | occurrence | recurrenceId, revisionId, occurrenceKey, transactionId                                                      | User oder interner Systemactor |
| occurrence.skipped               | occurrence | recurrenceId, occurrenceKey                                                                                 | User/Member oder Owner         |
| occurrence.unskipped             | occurrence | recurrenceId, occurrenceKey, optional choice generate/release                                               | User/Member oder Owner         |
| occurrence.linked                | occurrence | recurrenceId, occurrenceKey, transactionId                                                                  | User/Member oder Owner         |
| occurrence.reassigned            | occurrence | recurrenceId, occurrenceKey, transactionId, previousRecurrenceId/previousOccurrenceId/previousOccurrenceKey | User/Member oder Owner         |
| occurrence.unlinked              | occurrence | recurrenceId, occurrenceKey, transactionId, optional choice generate/release                                | User/Member oder Owner         |

Subject-ID und recurrenceId müssen bei Recurrence-Subjects übereinstimmen. Occurrence-Subject und MonthKey/Parent-Beziehungen werden über den Scope-Port geprüft. User-only-Matrix ist auch in Shared Write-/Read-Schemas und im additiven Mongo-Validator enthalten. Ownerprüfung sitzt zusätzlich zentral vor jedem Writerpfad. Lebenszyklus erzeugt keinen Konfigurationsrevisionseintrag; tatsächliche Domainregeln bleiben späteren Services vorbehalten.

`release` darf nicht zusammen mit `occurrence.generated` für dasselbe Subject eingeplant werden. Unlink+Generate kann dagegen zwei unterschiedliche, atomar gemeinsam belegte Events besitzen: alter Parent gelöst, neuer Parent korrekt zugeordnet, gleiche Correlation. Kein zusätzliches Release-/Booked-/Gesamterfolgsereignis. Transaction.booked bleibt beim bestehenden Transaction-Writer.

## Enger Adapter und Scope-Port

`services/recurrence-activity.ts` bietet `commitRecurrenceActivity`, `writeRecurrenceActivityInSession` und read-only `reconcileRecurrenceActivity`. Der Caller übergibt den bestehenden verifizierten Account-/Systemkontext, einen bestehenden vertrauenswürdigen `activityCommand`, streng typisierte Intents, den Scope-Port und seinen eigenen Domaincallback. Der Adapter implementiert selbst keine Domainmutation. Der bestehende gemeinsame Writer behält Commit, Authorityfences, Event-IDs, Fehlerrollback und Retry-/Readbacklogik.

`createRecurrenceActivityScope` akzeptiert ausschließlich einen serverinternen Resolver. Keine globale Registry, keine öffentlichen Collectionnamen oder `scope:true`. Er gilt nur für neue recurrence/occurrence-Subjects und interne Revisionreferenzen; bestehende Account-/Member-/Category-/Transaction-/Legacyprüfungen sind nicht überschreibbar. Die generische Testimplementation lebt ausschließlich unter `tests/fixtures` und liest eine eigene Testcollection. Eine produktive Implementation fehlt absichtlich; ohne gültigen Port wird ein neuer Schreibaufruf vor dem Domaincallback abgewiesen.

Der Resolver muss mit der übergebenen aktiven ClientSession lesen und nach Account filtern. Jede Auflösung erhält eine frische `attest`-Funktion; nur ihr eingefrorener Lookup-Witness wird angenommen. Kopien, gecachte Witnesses und Session-/Transaktionswechsel sind ungültig. Die Port-/Proof-Capabilities ersetzen keine Prüfung vertrauenswürdigen Servercodes: Resolver müssen tatsächlich dieselbe Session verwenden, Domaincallbacks alle eigenen Daten-/CAS-/Finanzregeln durchsetzen und dürfen keine externen Nebenwirkungen im retrybaren Callback haben.

Geprüft werden Account/ID/Kind, Revision→Recurrence, Occurrence→Recurrence+MonthKey und die Parent-Referenz einer Buchung. Bei Reassign Quelle und Ziel samt altem/neuem Bezug. Children erfüllen keinen Parent-Slot. Create benötigt Abwesenheit vorher und Existenz nachher; Delete Existenz vorher und Abwesenheit nachher. Ein generischer Blocker oder No-op schreibt0Events. Eine fehlende Ressource allein beweist keinen zulässigen fachlichen FullDelete.

Exakte Replay-/Unknown-Commit-Reconciliation prüft weiterhin aktuelle Autorität und vollständige Events, bevor ein inzwischen gelöschtes Subject aufgelöst werden müsste. Keine Wiederherstellung des Subjects, kein zweiter Domaincallback und kein separater Receipt-/Tombstonespeicher. `activityBatch(domainIdentity)` erzeugt eine serverinterne, stabile Capability; strukturelle Kopien werden abgewiesen. Neue Command-/Batchdaten dürfen nicht direkt aus öffentlichen Body-/Headerwerten übernommen werden.

## Readgrenze und Migration

Ohne produktive Domain-Liveauflösung gibt die bestehende Activity-API neue Codes mit sicherem Actor/Zeitpunkt und minimalem Aktionslabel aus, aber `params:null`, `subject:null`, `detailsUnavailable:true`. Keine ungeprüften Revision-/Occurrence-/Transaction-IDs oder Titel im Renderer, kein Legacy-Alias/Deadlink. Die vorhandenen Codefilter/Labels unterstützen alle44Codes. Dies ist keine Abnahme einer vollständigen zukünftigen Recurrence-Detailnavigation.

`20261108172127336-recurrence-activity-primitives` erweitert ausschließlich den eingefrorenen E05-Eventvalidator32→44. Indexe/Dokumente bleiben unverändert; keine Domaincollection oder Datenumschreibung. Alter Baseline-/E03-/E05-Code bleibt unangetastet. Down blockiert, sobald erhaltene neue versionierte Events den Vorgänger ungültig machen würden; solche Events niemals löschen, um Down zu erzwingen.

Bestandsanwendung nur separat mit gestoppten Writern, Plan/Bestätigung und verifiziertem externem Tools-Backup gemäß [Handover](../database/migration-handover.md). Partieller DDL-Fehler: Runner und Tools stoppen/drainieren, read-only Zustand prüfen und ursprünglichen Katalog/Archiv für bestätigtes Resume/Restore verwenden. Kein blindes Retry oder Down auf Teilstand, kein historisches Backup über spätere Nutzerdaten.

## Zweigeteilte Abnahme

Die echten Tests unter `tests/integration/recurrence-activity*.test.mjs` verwenden generische Record-/Relationsfixtures, echte JWT/HTTP, Mongo-ReplicaSets und tatsächliche Failpoints/Toolsarchive. Sie belegen nur EIT25–30 PLATTFORM. Echte RecurrenceRevisionen, Current-Ensure/Pendinggenerierung, Skip/Link/Unlink-Finanzregeln sowie BOOKED-/manually-linked FullDelete-Guards bleiben in V08–V28/R-EV/IT/E2E separat NOT-RUN/BLOCKED. EIT35/TZ gehören zu P04. [A/Q und konkrete Belege](../agents/runs/E07.md).
