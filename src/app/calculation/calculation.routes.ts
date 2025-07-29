//provideStates([])

import { Routes } from "@angular/router";
import { provideStates } from "@ngxs/store";
import { CalculationState } from "./state/calculation.state";
import { Calculation } from "./calculation";

export default [
    { path: '', component: Calculation, providers: [provideStates([CalculationState])] },
    { path: '**', redirectTo: '/notfound' }
] as Routes;
