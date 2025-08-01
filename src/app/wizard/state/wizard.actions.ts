import { WizardCategoryModel } from "../domain/wizard-category.model";
import { WizardInitialsModel } from "../domain/wizard-initials.model";
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

export class SetInitials {
  static readonly type = '[Wizard] Set initials action';
  constructor(public initials: WizardInitialsModel) {}
}

export class SaveWizardData {
  static readonly type = '[Wizard] Save wizard data action';
  constructor() {}
}

