# API-Endpunktinventar (generiert)

Quelle: packages/contracts/src/endpoints.ts. Keine weiteren API-Verbraucher sind bekannt.

| Methode | Pfad | Auth | Body | Query | Erfolg |
| --- | --- | --- | --- | --- | --- |
| GET | /api/accounts/summary | bearer | — | Zod-Schema | 200 |
| GET | /api/accounts/:id/overview | bearer | — | — | 200 |
| GET | /api/accounts/:id/month-view | bearer | — | Zod-Schema | 200 |
| GET | /api/accounts/:accountId/master-data | bearer | — | — | 200 |
| GET | /api/accounts/:accountId/planning | bearer | — | Zod-Schema | 200 |
| GET | /api/accounts | bearer | — | Zod-Schema | 200 |
| GET | /api/accounts/:id | bearer | — | — | 200 |
| GET | /api/accounts/:id/expanded | bearer | — | Zod-Schema | 200 |
| POST | /api/accounts | bearer | Zod-Schema | — | 201 |
| PATCH | /api/accounts/:id | bearer | Zod-Schema | — | 200 |
| POST | /api/accounts/:id/members | bearer | Zod-Schema | — | 200 |
| DELETE | /api/accounts/:id/members/:memberId | bearer | — | — | 200 |
| GET | /api/members | bearer | — | Zod-Schema | 200 |
| POST | /api/members | bearer | Zod-Schema | — | 201 |
| PATCH | /api/members/:id | bearer | Zod-Schema | — | 200 |
| DELETE | /api/members/:id | bearer | — | — | 204 |
| GET | /api/categories | bearer | — | Zod-Schema | 200 |
| POST | /api/categories | bearer | Zod-Schema | — | 201 |
| PATCH | /api/categories/:id | bearer | Zod-Schema | — | 200 |
| DELETE | /api/categories/:id | bearer | — | — | 204 |
| GET | /api/transactions | bearer | — | Zod-Schema | 200 |
| POST | /api/transactions | bearer | Zod-Schema | — | 201 |
| PATCH | /api/transactions/:id | bearer | Zod-Schema | — | 200 |
| DELETE | /api/transactions/:id | bearer | — | — | 204 |
| GET | /api/recurrences | bearer | — | Zod-Schema | 200 |
| POST | /api/recurrences | bearer | Zod-Schema | — | 201 |
| PATCH | /api/recurrences/:id | bearer | Zod-Schema | — | 200 |
| DELETE | /api/recurrences/:id | bearer | — | — | 204 |
| GET | /api/member-incomes | bearer | — | Zod-Schema | 200 |
| POST | /api/member-incomes | bearer | Zod-Schema | — | 201 |
| PATCH | /api/member-incomes/:id | bearer | Zod-Schema | — | 200 |
| DELETE | /api/member-incomes/:id | bearer | — | — | 204 |
| GET | /api/category-budgets | bearer | — | Zod-Schema | 200 |
| POST | /api/category-budgets | bearer | Zod-Schema | — | 201 |
| PATCH | /api/category-budgets/:id | bearer | Zod-Schema | — | 200 |
| DELETE | /api/category-budgets/:id | bearer | — | — | 204 |
| GET | /api/contribution-rules | bearer | — | Zod-Schema | 200 |
| POST | /api/contribution-rules | bearer | Zod-Schema | — | 201 |
| PATCH | /api/contribution-rules/:id | bearer | Zod-Schema | — | 200 |
| DELETE | /api/contribution-rules/:id | bearer | — | — | 204 |
| GET | /api/account-balances | bearer | — | Zod-Schema | 200 |
| PUT | /api/account-balances | bearer | Zod-Schema | — | 200 |
| DELETE | /api/account-balances/:id | bearer | — | — | 204 |
| GET | /api/carryovers | bearer | — | Zod-Schema | 200 |
| PUT | /api/carryovers | bearer | Zod-Schema | — | 200 |
| DELETE | /api/carryovers/:id | bearer | — | — | 204 |
| POST | /api/auth/register | public | Zod-Schema | — | 201 |
| POST | /api/auth/login | public | Zod-Schema | — | 200 |
| POST | /api/auth/refresh | public | — | — | 200 |
| POST | /api/auth/logout | public | — | — | 204 |

Fehler: bestehende JSON-Varianten (error oder code/message), teilweise text/plain bei 404. Bearer bedeutet Authentifizierung; die vollständige Kontoberechtigungsprüfung bleibt separat offen.
