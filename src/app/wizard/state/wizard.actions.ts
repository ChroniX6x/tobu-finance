import { WizardCategoryModel } from "../domain/wizard-category.model";
import { WizardMemberModel } from "../domain/wizard-member.model";
import { WizardModel } from "../domain/wizard.model";

export class NextStepAction {
  static readonly type = '[Wizard] Next step action';
  constructor() {}
}

export class PreviousStepAction {
  static readonly type = '[Wizard] Previous step action';
  constructor() {}
}

export class SetStepAction {
  static readonly type = '[Wizard] Set step action';
  constructor(public step: number) {}
}

export class SetBaseInformation {
  static readonly type = '[Wizard] Set base information action';
  constructor(public infos: {name: string}) {}
}

export class SetMembers {
  static readonly type = '[Wizard] Set members action';
  constructor(public members: WizardMemberModel[]) {}
}

export class SetCategories {
  static readonly type = '[Wizard] Set categories action';
  constructor(public categories: WizardCategoryModel[]) {}
}

export class InitCalculationDataAction {
  static readonly type = '[Calculation] Init data action';
  constructor() {}
}

export class SetCalculationMonthAction {
  static readonly type = '[Calculation] Set calculation month action';
  constructor(public selectedMonth: string) {}
}
