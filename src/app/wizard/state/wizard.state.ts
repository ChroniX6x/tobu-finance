import { Injectable, inject } from "@angular/core";
import { Action, Selector, State, StateContext } from "@ngxs/store";
import { InitCalculationDataAction, NextStepAction, PreviousStepAction, SetBaseInformation, SetCalculationMonthAction, SetCategories, SetMembers, SetStepAction } from "./wizard.actions";
import { cloneDeep } from "lodash";
import { WizardDataService } from "./wizard-data.service";
import { produce } from "immer";
import { WizardModel } from "../domain/wizard.model";
import { WizardMemberModel } from "../domain/wizard-member.model";
import { v4 as uuidv4 } from 'uuid';

export class WizardStateModel {
  currentStep: number;
  data?: Partial<WizardModel>
}

@State<WizardStateModel>({
  name: 'wizardState',
  defaults: {
    currentStep: 4,
    data: {
      name: "Account",
      members: [
        {
            name: "Tony Hoffmann",
            email: "sicphyer@gmx.de",
            tempId: "db36bf0f-cc07-4061-8d3c-c9f5221380f3"
        },
        {
            name: "Carolin Neumann",
            email: "neumann__carolin@web.de",
            tempId: "53031ab5-9ecc-4023-bc64-0354640f669c"
        }
    ],
    categories: [
        {
            name: "Test",
            customSplit: [],
            tempId: "62810509-3d05-475e-b250-0cf33c20cda5"
        },
        {
            name: "Test2",
            customSplit: [
                {
                    memberId: "db36bf0f-cc07-4061-8d3c-c9f5221380f3",
                    name: "Tony Hoffmann",
                    split: 40
                },
                {
                    memberId: "53031ab5-9ecc-4023-bc64-0354640f669c",
                    name: "Carolin Neumann",
                    split: 60
                }
            ],
            tempId: "41cfaa1b-ce0e-49c5-992a-d35f6a3b34a0"
        }
    ]
    }
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
    if(!this.canBeActivated(ctx.getState(), ctx.getState().currentStep + 1)) return;
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

      let tmp = state.currentStep;
      if(step > 0 && step < 6) {
        state.currentStep = step;
      }

      if(!this.canBeActivated(ctx.getState() ,step)) {
        state.currentStep = tmp;
      };
    }));
  }

  private canBeActivated(state: WizardStateModel, step: number): boolean {

    switch (step) {
      case 2:
        if(!state.data?.name) return false;
        break;
      case 3:
        if(!state.data?.members || state.data?.members.length < 2) return false;
        break;
      case 4:
        if(!state.data?.members || state.data?.members.length < 2) return false;
        if(!state.data?.categories || state.data?.members.length < 1) return false;
        break;
      default:
        break;
    }

    return true;
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
      members.forEach(member => {
        member.tempId = uuidv4();
      });
      state.data.members = members;
    }));
  }

  @Action(SetCategories)
  public setCategories(ctx: StateContext<WizardStateModel>, {categories}: SetCategories) {
    ctx.setState(produce(state => {
      if(state.data == null) {
        state.data = {};
      }
      categories.forEach(category => {
        category.tempId = uuidv4();
      });
      state.data.categories = categories;
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



