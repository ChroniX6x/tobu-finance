import { Injectable, inject } from "@angular/core";
import { Action, Selector, State, StateContext } from "@ngxs/store";
import { InitCalculationDataAction, NextStepAction, PreviousStepAction, SetBaseInformation, SetCalculationMonthAction, SetMembers, SetStepAction } from "./wizard.actions";
import { cloneDeep } from "lodash";
import { WizardDataService } from "./wizard-data.service";
import { produce } from "immer";
import { WizardModel } from "../domain/wizard.model";
import { WizardMemberModel } from "../domain/wizard-member.model";

export class WizardStateModel {
  currentStep: number;
  data?: Partial<WizardModel>
}

@State<WizardStateModel>({
  name: 'wizardState',
  defaults: {
    currentStep: 1,
    data: {}
  }
})
@Injectable()
export class WizardState {

  private dataService = inject(WizardDataService)

  @Selector()
  public static state(state: WizardStateModel): WizardStateModel {
    return cloneDeep(state);
  }

  @Selector()
  public static currentStep(state: WizardStateModel): number {
    return state.currentStep;
  }

  @Selector()
  public static members(state: WizardStateModel): WizardMemberModel[] {
    return cloneDeep(state.data?.members) ?? [];
  }

  @Action(NextStepAction)
  public nextStep(ctx: StateContext<WizardStateModel>, action: NextStepAction) {
    ctx.setState(produce(state => {
      if(state.currentStep < 5) {
        state.currentStep++;
      }
    }));
  }

  @Action(PreviousStepAction)
  public previousStep(ctx: StateContext<WizardStateModel>, action: PreviousStepAction) {
    ctx.setState(produce(state => {
      if(state.currentStep > 0) {
        state.currentStep--;
      }
    }));
  }

  @Action(SetStepAction)
  public setStep(ctx: StateContext<WizardStateModel>, {step}: SetStepAction) {
    ctx.setState(produce(state => {
      if(step > 0 && step < 6) {
        state.currentStep = step;
      }
    }));
  }

  @Action(SetBaseInformation)
  public setBaseInfos(ctx: StateContext<WizardStateModel>, {infos}: SetBaseInformation) {
    ctx.setState(produce(state => {
      if(state.data == null) {
        state.data = {};
      }
      state.data.name = infos.name;
    }));
  }

  @Action(SetMembers)
  public setMembers(ctx: StateContext<WizardStateModel>, {members}: SetMembers) {
    ctx.setState(produce(state => {
      if(state.data == null) {
        state.data = {};
      }
      state.data.members = members;
    }));
  }

  @Action(InitCalculationDataAction)
  public addValue(ctx: StateContext<WizardStateModel>, action: InitCalculationDataAction) {
    // this.dataService.testDB();
    // return this.dataService.getTestData(ctx.getState().selectedMonth).pipe(
    //   tap(res => {
    //     ctx.setState(res);
    //   })
    // );

  }

  @Action(SetCalculationMonthAction)
  public setCalculationMonth(ctx: StateContext<WizardStateModel>, {selectedMonth}: SetCalculationMonthAction) {

    // ctx.setState(produce(state => {
    //   state.selectedMonth = selectedMonth;
    // }));

    // return this.dataService.getTestData(selectedMonth).pipe(
    //   tap(res => {
    //     ctx.setState(res);
    //   })
    // );

  }

}



