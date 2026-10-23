import { ChangeDetectionStrategy, Component, inject, linkedSignal } from '@angular/core';
import { select, Store } from '@ngxs/store';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { RippleModule } from 'primeng/ripple';
import { NextStepAction, SetCategories } from '../state/wizard.actions';
import { DataViewModule } from 'primeng/dataview';
import { WizardState } from '../state/wizard.state';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputNumberModule } from 'primeng/inputnumber';
import { WizardCategoryModel } from '../domain/wizard-category.model';
import { CustomSplitModel } from '../domain/custom-split.model';
import { applyEach, form, FormField, FormRoot, required, validate } from '@angular/forms/signals';

interface SplitEntry {
  memberId: string;
  name: string;
  split: number;
}

interface CategoryInputModel {
  name: string;
  hasCustomSplit: boolean;
  customSplit: SplitEntry[];
}

@Component({
  selector: 'tbf-categories',
  templateUrl: './categories.html',
  styleUrls: ['./categories.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataViewModule,
    InputTextModule,
    ButtonModule,
    RippleModule,
    ToggleSwitchModule,
    InputGroupModule,
    InputGroupAddonModule,
    InputNumberModule,
    FormField,
    FormRoot,
  ],
})
export class Categories {
  private readonly store = inject(Store);
  private readonly stateMembers = select(WizardState.members);

  // linkedSignal reacts when members change (e.g. user goes back and edits members).
  // Preserves user-entered name and split values via `previous`.
  protected readonly categoryInput = linkedSignal<{ tempId: string; name: string }[], CategoryInputModel>({
    source: this.stateMembers,
    computation: (members, previous) => {
      const prev = previous?.value;
      const hasCustomSplit = prev?.hasCustomSplit ?? false;
      return {
        name: prev?.name ?? '',
        hasCustomSplit,
        customSplit: hasCustomSplit
          ? members.map(mb => ({
              memberId: mb.tempId,
              name: mb.name,
              split: prev?.customSplit?.find(s => s.memberId === mb.tempId)?.split ?? 0,
            }))
          : [],
      };
    },
  });

  protected readonly categories = linkedSignal<WizardCategoryModel[], WizardCategoryModel[]>({
    source: (): WizardCategoryModel[] => [],
    computation: (_source, previous) => previous?.value ?? [],
  });

  protected readonly categoryForm = form(
    this.categoryInput,
    (p) => {
      required(p.name, { message: 'Name ist erforderlich' });
      applyEach(p.customSplit, (item) => {
        required(item.split, { message: 'Pflichtfeld' });
      });
      validate(p.customSplit, ({ value, valueOf }) => {
        if (!valueOf(p.hasCustomSplit)) return null;
        const total = value().reduce((sum, r) => sum + (r.split ?? 0), 0);
        return total !== 100
          ? { kind: 'splitSum', message: 'Splits müssen 100% ergeben' }
          : null;
      });
    },
    {
      submission: {
        action: async () => this.addCategory(),
      },
    },
  );

  // Called via (onChange) on the toggleswitch alongside [formField].
  // [formField] writes hasCustomSplit into the model; this rebuilds the customSplit rows.
  protected onToggle(enabled: boolean): void {
    const members = this.stateMembers();
    this.categoryInput.update(m => ({
      ...m,
      customSplit: enabled
        ? members.map(mb => ({
            memberId: mb.tempId,
            name: mb.name,
            split: m.customSplit?.find(s => s.memberId === mb.tempId)?.split ?? 0,
          }))
        : [],
    }));
  }

  protected addCategory(): void {
    const m = this.categoryInput();
    this.categories.update(cats => [
      ...cats,
      {
        tempId: crypto.randomUUID(),
        name: m.name,
        customSplit: m.hasCustomSplit
          ? m.customSplit.map(r => ({ memberId: r.memberId, name: r.name, split: r.split }) as CustomSplitModel)
          : undefined,
      },
    ]);
    this.categoryInput.update(m => ({ ...m, name: '', hasCustomSplit: false, customSplit: [] }));
  }

  protected removeCategory(index: number): void {
    this.categories.update(cats => cats.filter((_, i) => i !== index));
  }

  protected nextStep(): void {
    if (this.categories().length < 2) return;
    this.store.dispatch(new SetCategories(this.categories()));
    this.store.dispatch(new NextStepAction());
  }
}
