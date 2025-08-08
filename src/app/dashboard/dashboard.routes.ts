//provideStates([])

import { Routes } from "@angular/router";
import { provideStates } from "@ngxs/store";
import { Dashboard } from "./dashboard";
import { AccountDashboard } from "./account-dashboard/account-dashboard";
import { DashboardState } from "./state/dashboard.state";
import { AccountDashboardState } from "./state/account-dashboard.state";
import { createStateRouteInitializer } from '@/state/route-initializer';
import { LoadAccounts } from '@/state/account.state';
import { LoadCategories } from '@/state/categories.state';
import { LoadTransactions } from '@/state/transactions.state';


export default [
    { 
      path: '',
      component: Dashboard,
      providers: [provideStates([DashboardState, AccountDashboardState])],
      // Keine resolve-Initialisierung hier!
    },
    { 
      path: ':accountId',
      data: { breadcrumb: 'Account Dashboard' },
      component: AccountDashboard,
      resolve: {
        accounts: createStateRouteInitializer(route => new LoadAccounts(route.params['accountId'])),
        categories: createStateRouteInitializer(route => new LoadCategories(route.params['accountId'])),
        transactions: createStateRouteInitializer(route => new LoadTransactions(route.params['accountId'])),
      }
    },
    { path: '**', redirectTo: '/notfound' }
] as Routes;
