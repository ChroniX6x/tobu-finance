import { Routes } from '@angular/router';
import { provideStates } from '@ngxs/store';
import { Accounts } from './accounts';
import { AccountOverview } from './account-overview/account-overview';
import { AccountsSummaryState } from './state/accounts-summary.state';
import { AccountOverviewState } from './state/account-overview.state';

export default [
  {
    path: '',
    component: Accounts,
    providers: [provideStates([AccountsSummaryState, AccountOverviewState])],
  },
  {
    path: ':accountId',
    data: { breadcrumb: 'Account Overview' },
    component: AccountOverview,
    resolve: {}
  },
  { path: '**', redirectTo: '/notfound' }
] as Routes;
