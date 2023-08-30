import { Injectable, inject } from "@angular/core";
import { Action, Selector, State, StateContext } from "@ngxs/store";
import { DateTime } from "luxon";
import { CalculationGroup } from "../domain/calculation-group";
import { CalculationParticipant } from "../domain/calculation-participant";
import { GroupType } from "../domain/group-type";
import { InitCalculationDataAction } from "./calculation.actions";
import { CalculationDataService } from "../calculation-data.service";
import { tap } from "rxjs";
import { CalculationResult } from "../domain/calculation-result";

export class CalculationStateModel {
  selectedDate: DateTime;

  calculationGroup: CalculationGroup[];

  participants: CalculationParticipant[];

  calculationResult: CalculationResult;
}

@State<CalculationStateModel>({
  name: 'calculationState',
  defaults: {
    selectedDate: DateTime.now().startOf('month'),
    calculationGroup: [],
    participants: [],
    calculationResult: {additionalContributions: 0, calculatedParticipantPayments: new Map(), estimatedChange: 0, monthlyAccountValue: 0, monthlyChange: 0, verifiedChange: 0}
  }
})
@Injectable()
export class CalculationState {

  private dataService = inject(CalculationDataService)

  @Selector()
  public static getGroups(state: CalculationStateModel): CalculationGroup[] {
    return state.calculationGroup;
  }

  @Selector()
  public static getParticipants(state: CalculationStateModel): CalculationParticipant[] {
    return state.participants;
  }

  @Action(InitCalculationDataAction)
  public addValue(ctx: StateContext<CalculationStateModel>, action: InitCalculationDataAction) {
    return this.dataService.getTestData().pipe(
      tap(res => {
        ctx.setState((state) => ({ ...state, ...res }));
      })
    );

  }

}



