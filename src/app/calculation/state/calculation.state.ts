import { Injectable, inject } from "@angular/core";
import { Action, Selector, State, StateContext } from "@ngxs/store";
import { DateTime } from "luxon";
import { InitCalculationDataAction, SetCalculationMonthAction } from "./calculation.actions";
import { CalculationDataService } from "../calculation-data.service";
import { tap } from "rxjs";
import { cloneDeep } from "lodash";
import { produce } from "immer";
import { CalculationGroup } from "../domain/calculation-group";
import { CalculationParticipant } from "../domain/calculation-participant";
import { CalculationResult } from "../domain/calculation-result";

export class CalculationStateModel {
  selectedMonth: string;

  calculationGroup: CalculationGroup[];

  participants: CalculationParticipant[];

  calculationResult: CalculationResult;
}

@State<CalculationStateModel>({
  name: 'calculationState',
  defaults: {
    selectedMonth: DateTime.now().toFormat('yyyy-MM'),
    calculationGroup: [],
    participants: [],
    calculationResult: {additionalContributions: 0, calculatedParticipantPayments: new Map(), estimatedChange: 0, monthlyAccountValue: 0, monthlyChange: 0, verifiedChange: 0}
  }
})
@Injectable()
export class CalculationState {

  private dataService = inject(CalculationDataService)

  @Selector()
  public static state(state: CalculationStateModel): CalculationStateModel {
    return cloneDeep(state);
  }

  @Selector()
  public static getGroups(state: CalculationStateModel): CalculationGroup[] {
    return cloneDeep(state.calculationGroup);
  }

  @Selector()
  public static getParticipants(state: CalculationStateModel): CalculationParticipant[] {
    return cloneDeep(state.participants);
  }

  @Selector()
  public static getCalculationResult(state: CalculationStateModel): CalculationResult {
    return state.calculationResult;
  }

  @Selector()
  public static getSelectedMonth(state: CalculationStateModel): string {
    return state.selectedMonth;
  }

  @Action(InitCalculationDataAction)
  public addValue(ctx: StateContext<CalculationStateModel>, action: InitCalculationDataAction) {
    // this.dataService.testDB();
    return this.dataService.getTestData(ctx.getState().selectedMonth).pipe(
      tap(res => {
        ctx.setState(res);
      })
    );

  }

  @Action(SetCalculationMonthAction)
  public setCalculationMonth(ctx: StateContext<CalculationStateModel>, {selectedMonth}: SetCalculationMonthAction) {

    ctx.setState(produce(state => {
      state.selectedMonth = selectedMonth;
    }));

    return this.dataService.getTestData(selectedMonth).pipe(
      tap(res => {
        ctx.setState(res);
      })
    );

  }

}



