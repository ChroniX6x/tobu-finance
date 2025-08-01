//provideStates([])

import { Routes } from "@angular/router";
import { provideStates } from "@ngxs/store";
import { Dashboard } from "./dashboard";
import { AccountDashboard } from "./account-dashboard/account-dashboard";


export default [
    { path: '',
      component: Dashboard,
      // providers: [provideStates([WizardState])],
      children: [
        { path: ':accountId',
          data: { breadcrumb: 'Account Dashboard' },
          component: AccountDashboard
        }
      ]
    },
    { path: '**', redirectTo: '/notfound' }
] as Routes;
