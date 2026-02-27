import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { select, Store } from '@ngxs/store';
import { ButtonModule } from 'primeng/button';
import { FluidModule } from 'primeng/fluid';
import { RippleModule } from 'primeng/ripple';
import { NextStepAction, SaveWizardData, SetInitials } from '../state/wizard.actions';
import { InputNumberModule } from 'primeng/inputnumber';
import { FieldsetModule } from 'primeng/fieldset';
import { WizardState } from '../state/wizard.state';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { applyEach, form, FormField, FormRoot, required } from '@angular/forms/signals';

interface MemberInitialEntry {
  member: string;
  memberId: string;
  initialIncome: number;
}

interface CategoryInitialEntry {
  category: string;
  categoryId: string;
  initialExpenseEst: number;
}

interface InitialsFormModel {
  accountBalance: number;
  memberInitials: MemberInitialEntry[];
  categoryInitials: CategoryInitialEntry[];
}

@Component({
  selector: 'tbf-initial-values',
  templateUrl: './initial-values.html',
  styleUrls: ['./initial-values.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    InputNumberModule,
    FluidModule,
    ButtonModule,
    RippleModule,
    FieldsetModule,
    InputGroupModule,
    InputGroupAddonModule,
    FormField,
    FormRoot,
  ],
})
export class InitialValues {
  private readonly store = inject(Store);

  private readonly stateMembers = select(WizardState.members);
  private readonly stateCategories = select(WizardState.categories);

  protected readonly initialsModel = signal<InitialsFormModel>({
    accountBalance: 0,
    memberInitials: [],
    categoryInitials: [],
  });

  constructor() {
    // Sync arrays from wizard state into the form model whenever state changes
    effect(() => {
      const members = this.stateMembers();
      const categories = this.stateCategories();
      this.initialsModel.update(m => ({
        ...m,
        memberInitials: members.map(mb => ({
          member: mb.name,
          memberId: mb.tempId,
          initialIncome: 0,
        })),
        categoryInitials: categories.map(cat => ({
          category: cat.name,
          categoryId: cat.tempId,
          initialExpenseEst: 0,
        })),
      }));
    });
  }

  protected readonly initialsForm = form(
    this.initialsModel,
    (p) => {
      required(p.accountBalance, { message: 'Kontostand ist erforderlich' });
      applyEach(p.memberInitials, (item) => {
        required(item.initialIncome, { message: 'Einkommen ist erforderlich' });
      });
      applyEach(p.categoryInitials, (item) => {
        required(item.initialExpenseEst, { message: 'Schätzung ist erforderlich' });
      });
    },
    {
      submission: {
        action: async () => this.nextStep(),
      },
    },
  );

  protected nextStep(): void {
    const m = this.initialsModel();
    this.store.dispatch(new SetInitials({
      accountBalance: m.accountBalance,
      memberInitials: m.memberInitials,
      categoryInitials: m.categoryInitials,
    }));
    this.store.dispatch(new SaveWizardData());
  }
}
