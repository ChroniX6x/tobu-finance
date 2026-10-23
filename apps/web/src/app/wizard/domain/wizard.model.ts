import { WizardCategoryModel } from "./wizard-category.model"
import { WizardInitialsModel } from "./wizard-initials.model"
import { WizardMemberModel } from "./wizard-member.model"

export interface WizardModel {
  name: string,
  members: WizardMemberModel[],
  categories: WizardCategoryModel[]
  initialValues: WizardInitialsModel
}
