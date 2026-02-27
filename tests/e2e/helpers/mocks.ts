import type { Page } from '@playwright/test';

// ─── Shared mock IDs ────────────────────────────────────────────────────────
export const ACCOUNT_ID = 'acc-e2e';
export const MEMBER_1_ID = 'm1';
export const MEMBER_2_ID = 'm2';
export const CAT_1_ID = 'cat-food';
export const CAT_2_ID = 'cat-leisure';

// ─── Shared mock data ────────────────────────────────────────────────────────
export const mockMembers = [
  { id: MEMBER_1_ID, name: 'Caro', email: 'caro@example.com' },
  { id: MEMBER_2_ID, name: 'Tobi', email: 'tobi@example.com' },
];

export const mockCategories = [
  { _id: CAT_1_ID, accountId: ACCOUNT_ID, name: 'Lebensmittel' },
  { _id: CAT_2_ID, accountId: ACCOUNT_ID, name: 'Freizeit' },
];

export const mockAccount = {
  id: ACCOUNT_ID,
  name: 'E2E Konto',
  memberIds: [MEMBER_1_ID, MEMBER_2_ID],
  balances: [{ month: '2026-02', balanceMinor: 250000 }],
  monthlyIncomes: [],
  monthlyPlannedContributions: [],
  carryOverBalances: [],
};

export const mockAccountsSummary = [
  {
    id: ACCOUNT_ID,
    name: 'E2E Konto',
    memberCount: 2,
    currentBalanceMinor: 250000,
    balanceHistoryMinor: [200000, 220000, 250000],
    currentMonth: '2026-02',
    stalenessDays: 0,
    isStale: false,
    missingMonths: [],
  },
];

export const mockAccountOverview = {
  account: {
    id: ACCOUNT_ID,
    name: 'E2E Konto',
    currentMonth: '2026-02',
    currentBalanceMinor: 250000,
    balanceChangePct: 5,
    forecastMinor: 263000,
    warning: null,
    stalenessDays: 0,
    isStale: false,
    missingMonths: [],
  },
  members: [
    { id: MEMBER_1_ID, name: 'Caro', role: 'member', avatar: null, monthlyDue: 50000, paidAmount: 50000, paid: true },
    { id: MEMBER_2_ID, name: 'Tobi', role: 'member', avatar: null, monthlyDue: 50000, paidAmount: 0, paid: false },
  ],
  quickStats: {
    openDuesCount: 1,
    pendingRecurringCount: 0,
    extraContributionsCount: 0,
    extraContributionsSumMinor: 0,
    warningsCount: 0,
  },
  charts: {
    history: { labels: ['2025-12', '2026-01', '2026-02'], data: [200000, 220000, 250000] },
    incomeVsExpenseMinor: { incomeMinor: 150000, expenseMinor: 80000 },
    topCategories: [{ name: 'Lebensmittel', sum: 50000 }],
  },
  insights: [],
  timeline: [
    { id: 'evt1', date: '2026-02-01T00:00:00.000Z', user: 'Caro', text: 'Konto erstellt' },
  ],
};

export const mockTransaction = {
  _id: 'tx-1',
  accountId: ACCOUNT_ID,
  type: 'expense',
  amountMinor: 4500,
  status: 'booked',
  bookDate: '2026-02-10T00:00:00.000Z',
  month: '2026-02-01T00:00:00.000Z',
  title: 'Aldi Einkauf',
  notes: null,
  categoryId: CAT_1_ID,
  isFromSharedAccount: true,
  paidByMemberId: MEMBER_1_ID,
  parentTransactionId: null,
  children: [],
};

// ─── Route mock helpers ──────────────────────────────────────────────────────

/** Mock the auth/refresh endpoint so the app initializer sets a token and the auth guard passes. */
export async function mockAuth(page: Page): Promise<void> {
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accessToken: 'e2e-token' }),
    }),
  );
}

/** Mock all endpoints needed by the accounts list page. */
export async function mockAccountsListRoutes(page: Page): Promise<void> {
  await mockAuth(page);
  await page.route('**/api/accounts/summary**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockAccountsSummary),
    }),
  );
}

/** Mock all endpoints needed by the account overview page. */
export async function mockAccountOverviewRoutes(page: Page): Promise<void> {
  await mockAuth(page);
  await page.route(`**/api/accounts/${ACCOUNT_ID}/overview`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockAccountOverview),
    }),
  );
  // The overview component loads the basic account shape for the AccountState too
  await page.route(`**/api/accounts/${ACCOUNT_ID}`, (route) => {
    // Don't intercept /overview sub-path
    if (route.request().url().includes('/overview')) {
      return route.fallback();
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockAccount),
    });
  });
  await page.route('**/api/members**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockMembers),
    }),
  );
}

/** Mock all endpoints needed by the transactions page. */
export async function mockTransactionsPageRoutes(page: Page): Promise<void> {
  await mockAuth(page);
  await page.route(`**/api/accounts/${ACCOUNT_ID}`, (route) => {
    if (route.request().url().includes('/overview')) return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockAccount),
    });
  });
  await page.route('**/api/members**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockMembers),
    }),
  );
  await page.route(`**/api/categories?accountId=${ACCOUNT_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockCategories),
    }),
  );
  await page.route('**/api/transactions?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [mockTransaction], total: 1, page: 1, pageSize: 50 }),
    }),
  );
  await page.route('**/api/transactions', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ ...mockTransaction, _id: `created-${Date.now()}`, title: payload['title'] ?? 'created' }),
    });
  });
}

/** Mock all endpoints needed by the wizard flow. */
export async function mockWizardRoutes(page: Page): Promise<void> {
  await mockAuth(page);
  let memberCounter = 0;
  await page.route('**/api/members', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: `wiz-member-${++memberCounter}` }),
    });
  });
  await page.route('**/api/accounts', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'wiz-acc-1' }),
    });
  });
  let catCounter = 0;
  await page.route('**/api/categories', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: `wiz-cat-${++catCounter}` }),
    });
  });
  await page.route('**/api/categories/**', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill({ status: 200, body: '{}' });
  });
  // PATCH /api/accounts/:id for monthly planned contributions
  await page.route('**/api/accounts/**', (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}
