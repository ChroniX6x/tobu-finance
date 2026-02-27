import { Injectable, inject } from "@angular/core";
import { Action, Selector, State, StateContext } from "@ngxs/store";
import { NextStepAction, PreviousStepAction, SaveWizardData, SetBaseInformation, SetCategories, SetInitials, SetMembers, SetStepAction } from "./wizard.actions";
import { cloneDeep } from "lodash";
import { WizardDataService } from "./wizard-data.service";
import { produce } from "immer";
import { WizardModel } from "../domain/wizard.model";
import { WizardMemberModel } from "../domain/wizard-member.model";
import { v4 as uuidv4 } from 'uuid';
import { WizardCategoryModel } from "../domain/wizard-category.model";
import { Router } from "@angular/router";

export class WizardStateModel {
  currentStep: number;
  data?: Partial<WizardModel>
}

@State<WizardStateModel>({
  name: 'wizardState',
  defaults: {
    currentStep: 1,
    data: {
      name: "Account",
      members: [],
    categories: []
    }
  }
})
@Injectable()
export class WizardState {

  private router = inject(Router);
  private dataService = inject(WizardDataService)
  private lastStepNumber = 5;

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

  @Selector()
  public static categories(state: WizardStateModel): WizardCategoryModel[] {
    return cloneDeep(state.data?.categories) ?? [];
  }

  @Action(NextStepAction)
  public nextStep(ctx: StateContext<WizardStateModel>, action: NextStepAction) {
    if(!this.canBeActivated(ctx.getState(), ctx.getState().currentStep + 1)) return;
    ctx.setState(produce(state => {
      if(state.currentStep < this.lastStepNumber - 1) {
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
      if(step > 0 && step < this.lastStepNumber) {
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

  @Action(SetInitials)
  public setInitials(ctx: StateContext<WizardStateModel>, {initials}: SetInitials) {
    ctx.setState(produce(state => {
      if(state.data == null) {
        state.data = {};
      }

      state.data.initialValues = initials;
    }));
  }

  @Action(SaveWizardData)
  public saveWizardData(ctx: StateContext<WizardStateModel>, {}: SaveWizardData) {
    let accountId = this.dataService.createNewAccount(ctx.getState().data as WizardModel)

  this.router.navigate(['accounts', accountId])
  }
}



