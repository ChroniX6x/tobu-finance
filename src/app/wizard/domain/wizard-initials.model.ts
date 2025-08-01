import { CategoryInitialValuesModel } from "./category-initial-values.model";
import { MemberInitialValuesModel } from "./member-initial-values.model";

export class WizardInitialsModel {
  accountBalance: number;
  memberInitials: MemberInitialValuesModel[];
  categoryInitials: CategoryInitialValuesModel[];
}
