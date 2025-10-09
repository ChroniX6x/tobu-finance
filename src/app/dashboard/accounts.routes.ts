import { Routes } from '@angular/router';
import { provideStates } from '@ngxs/store';
import { Accounts } from './accounts';
import { AccountOverview } from './account-overview/account-overview';
import { AccountsSummaryState } from './state/accounts-summary.state';
import { AccountOverviewState } from './state/account-overview.state';
import { createStateRouteInitializer } from '@/state/route-initializer';
import { LoadAccounts } from '@/state/account.state';
import { LoadCategories } from '@/state/categories.state';
import { LoadTransactions } from '@/state/transactions.state';

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
    resolve: {
      accounts: createStateRouteInitializer(route => new LoadAccounts(route.params['accountId'])),
      categories: createStateRouteInitializer(route => new LoadCategories(route.params['accountId'])),
      transactions: createStateRouteInitializer(route => new LoadTransactions(route.params['accountId'])),
    }
  },
  { path: '**', redirectTo: '/notfound' }
] as Routes;
