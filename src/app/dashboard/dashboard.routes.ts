//provideStates([])

import { Routes } from "@angular/router";
import { provideStates } from "@ngxs/store";
import { Dashboard } from "./dashboard";
import { AccountDashboard } from "./account-dashboard/account-dashboard";
import { DashboardState } from "./state/dashboard.state";
import { AccountDashboardState } from "./state/account-dashboard.state";


export default [
    { path: '',
      component: Dashboard,
      providers: [provideStates([DashboardState, AccountDashboardState])],
    },
    { path: ':accountId',
      data: { breadcrumb: 'Account Dashboard' },
      component: AccountDashboard
    },
    { path: '**', redirectTo: '/notfound' }
] as Routes;
