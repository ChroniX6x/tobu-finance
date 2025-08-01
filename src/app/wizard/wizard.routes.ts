//provideStates([])

import { Routes } from "@angular/router";
import { provideStates } from "@ngxs/store";
import { WizardState } from "./state/wizard.state";
import { Categories } from "./categories/categories";
import { BaseInformation } from "./base-information/base-information";
import { InitialValues } from "./initial-values/initial-values";
import { MemberInformation } from "./member-information/member-information";
import { Wizard } from "./wizard";


export default [
    { path: '',
      component: Wizard,
      providers: [provideStates([WizardState])],
      children: [
        { path: '1',
          data: { breadcrumb: 'Base Information' },
          component: BaseInformation
        },
        {
          path: '2',
          data: { breadcrumb: 'Participants' },
          component: MemberInformation
        },
        {
          path: '3',
          data: { breadcrumb: 'Categories' },
          component: Categories
        },
        {
          path: '4',
          data: { breadcrumb: 'Initial Values' },
          component: InitialValues
        }
      ]
    },
    { path: '**', redirectTo: '/notfound' }
] as Routes;
