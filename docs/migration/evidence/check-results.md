# Kompakter Prüfnachweis – Phase 0

Ausführung 21.10.2026 Europe/Warsaw. Keine erfolgreiche Neuinstallation; Compiler-/Buildbefunde basieren auf vorhandenen Dependencies. Vollständige lokale Rohlogs liegen unter `C:\GitRepos\tobu-phase0-evidence`, werden wegen maschinenspezifischer Pfade und redundanter Ausgaben nicht vollständig versioniert.

| Log | Ergebnis / relevanter Auszug |
| --- | --- |
| `web-typecheck.log` | Leer, Exit 0 |
| `web-test-typecheck.log` | `calculation-data.service.spec.ts(3,19): error TS2305: Module '"@angular/core/testing"' has no exported member 'async'.` |
| `web-build.log`, `web-unit.log` | `The project is configured to use 'yarn', but it is not installed or cannot be found in the PATH.` Exit jeweils 127 |
| `web-build-diagnostic.log` | Exit 0; Initial total 1.16 MB, Estimated transfer 240.60 kB. SCSS-Warnbudget, lodash-CommonJS und fehlendes preloading.css als Warnungen. |
| `web-unit-diagnostic.log` | Exit 1; TS2305 beim Angular-Testbuild, keine ausgeführten Unit-Tests |
| `api-build.log` | Exit 2; 85 Diagnosezeilen mit `error TS...`, vollständig in `api-typescript-errors.txt` |
| `api-runtime.log` | Exit 1; `ERR_MODULE_NOT_FOUND` beim Import von `src/db` durch `src/server.js` |
| `web-e2e-list.log` | `Total: 50 tests in 6 files` für Projekt chromium |
| `web-e2e.log` | `Running 50 tests using 1 worker`; erste zwei Tests nach 4 ms / 3 ms fehlgeschlagen, Max-Failures-Abbruch; hängenden Abschluss per Ctrl+C beendet |

Zusätzliche direkte Prüfungen:

- `mongod --version`: 8.2.2 (installiertes Binary, kein Nachweis eines laufenden Servers).
- Corepack/Yarn-Auflösung: Download von Registry durch `EACCES` verhindert.
- Isoliertes `npm ci --offline --ignore-scripts`: `ENOTCACHED` für fehlendes Zod-Tarball; Exit 1.
- Playwright `chromium.executablePath()` existiert nicht; `chromium.launch` bestätigt `Executable doesn't exist` für `chromium_headless_shell-1208`.
- API-Root-Dependencies und DevDependencies stimmen mit den Versionsbereichen im Root-Eintrag des Lockfiles überein.
- Keine versionierten `.github/workflows` in beiden Repositories.

Die temporäre Abweichung für diagnostischen Web-Build/Tests war ausschließlich `angular.json -> cli.packageManager: npm` im Transformationsworktree. Keine andere Build- oder Testoption wurde im Quellcode verändert. Die Datei wurde anschließend auf HEAD zurückgesetzt. Produktiv-Build, Unit-Test und E2E-Diagnose sind deshalb keine unveränderten Clean-Checkout-Nachweise.
