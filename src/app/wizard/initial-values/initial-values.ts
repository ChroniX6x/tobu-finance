import { ChangeDetectionStrategy, Component, inject, linkedSignal } from '@angular/core';
import { select, Store } from '@ngxs/store';
import { ButtonModule } from 'primeng/button';
import { FluidModule } from 'primeng/fluid';
import { RippleModule } from 'primeng/ripple';
import { SaveWizardData, SetInitials } from '../state/wizard.actions';
import { InputNumberModule } from 'primeng/inputnumber';
import { FieldsetModule } from 'primeng/fieldset';
import { WizardState } from '../state/wizard.state';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { applyEach, form, FormField, FormRoot, min, required } from '@angular/forms/signals';

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

  // linkedSignal reacts to state changes (members/categories added or removed).
  // The computation preserves user-entered values via `previous` when the source changes.
  protected readonly initialsModel = linkedSignal<
    { members: ReturnType<typeof WizardState.members>; categories: ReturnType<typeof WizardState.categories> },
    InitialsFormModel
  >({
    source: () => ({
      members: this.stateMembers(),
      categories: this.stateCategories(),
    }),
    computation: ({ members, categories }, previous) => ({
      accountBalance: previous?.value?.accountBalance ?? 0,
      memberInitials: members.map(mb => ({
        member: mb.name,
        memberId: mb.tempId,
        initialIncome:
          previous?.value?.memberInitials?.find(m => m.memberId === mb.tempId)?.initialIncome ?? 0,
      })),
      categoryInitials: categories.map(cat => ({
        category: cat.name,
        categoryId: cat.tempId,
        initialExpenseEst:
          previous?.value?.categoryInitials?.find(c => c.categoryId === cat.tempId)?.initialExpenseEst ?? 0,
      })),
    }),
  });

  protected readonly initialsForm = form(
    this.initialsModel,
    (p) => {
      required(p.accountBalance, { message: 'Kontostand ist erforderlich' });
      applyEach(p.memberInitials, (item) => {
        min(item.initialIncome, 0, { message: 'Income must be 0 or more' });
      });
      applyEach(p.categoryInitials, (item) => {
        min(item.initialExpenseEst, 0, { message: 'Expense must be 0 or more' });
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
