import { Routes } from '@angular/router';
import { provideStates } from '@ngxs/store';
import { Accounts } from './accounts';
import { AccountShell } from './account-shell/account-shell';
import { AccountOverview } from './account-overview/account-overview';
import { AccountsSummaryState } from './state/accounts-summary.state';
import { AccountOverviewState } from './state/account-overview.state';
import { MonthViewState } from './month-view/month-view.state';

export default [
  {
    path: '',
    component: Accounts,
    providers: [provideStates([AccountsSummaryState])],
  },
  {
    path: ':accountId',
    component: AccountShell,
    data: { breadcrumb: 'Account' },
    providers: [provideStates([AccountOverviewState])],
    children: [
      {
        path: '',
        component: AccountOverview,
      },
      {
        path: 'transactions',
        data: { breadcrumb: 'Buchungen' },
        loadChildren: () => import('@/transactions/transactions-page/transactions-page.routes'),
      },
      {
        path: 'month',
        data: { breadcrumb: 'Monat' },
        providers: [provideStates([MonthViewState])],
        loadComponent: () => import('./month-view/month-view').then(m => m.MonthView),
      },
    ],
  },
  { path: '**', redirectTo: '/notfound' }
] as Routes;
