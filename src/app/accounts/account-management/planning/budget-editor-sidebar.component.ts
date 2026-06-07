import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Store, select } from '@ngxs/store';
import { DateTime } from 'luxon';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { MessageModule } from 'primeng/message';
import { FluidModule } from 'primeng/fluid';
import { DatePickerModule } from 'primeng/datepicker';
import { TooltipModule } from 'primeng/tooltip';
import { PlanningPageSelectors } from './state/planning.selectors';
import {
  ClosePlanningSidebar,
  CreateBudget,
  DeleteBudget,
  UpdateBudget,
} from './state/planning.actions';
import { CreateBudgetPayload, UpdateBudgetPayload } from './planning.models';

@Component({
  selector: 'tbf-budget-editor-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    DrawerModule,
    ButtonModule,
    InputNumberModule,
    SelectModule,
    MessageModule,
    FluidModule,
    DatePickerModule,
    TooltipModule,
  ],
  template: `
    <p-drawer
      [visible]="isOpen()"
      [header]="isCreate() ? 'Budget hinzufügen' : 'Budget bearbeiten'"
      position="right"
      styleClass="!w-full md:!w-[480px]"
      (onHide)="close()">

      <form (ngSubmit)="save()" class="flex flex-col gap-5 h-full">

        @if (saveError()) {
          <p-message severity="error" [text]="saveError()!" styleClass="w-full" />
        }

        @if (isRetroactive()) {
          <p-message
            severity="warn"
            text="Dieser Zeitraum beginnt in der Vergangenheit. Bestehende Monatsansichten können rückwirkend beeinflusst werden."
            styleClass="w-full" />
        }

        <p-fluid>
          <div class="flex flex-col gap-4">

            <!-- Kategorie -->
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-color" for="bud-cat">Kategorie *</label>
              @if (isCreate()) {
                <p-select
                  inputId="bud-cat"
                  name="categoryId"
                  [ngModel]="categoryId()"
                  (ngModelChange)="categoryId.set($event)"
                  [options]="categories()"
                  optionLabel="name"
                  optionValue="id"
                  placeholder="Kategorie wählen …"
                  [filter]="true"
                  filterPlaceholder="Suchen"
                  styleClass="w-full" />
              } @else {
                <span class="text-sm text-color py-2 pl-1">
                  {{ currentBudget()?.categoryName ?? '—' }}
                </span>
              }
            </div>

            <!-- Betrag -->
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-color" for="bud-amt">Monatliches Budget *</label>
              <p-inputnumber
                inputId="bud-amt"
                name="amountEur"
                [ngModel]="amountEur()"
                (ngModelChange)="amountEur.set($event)"
                mode="decimal"
                [minFractionDigits]="0"
                [maxFractionDigits]="0"
                [min]="1"
                suffix=" €"
                styleClass="w-full"
                placeholder="z.B. 500" />
            </div>

            <!-- Gültig ab -->
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-color" for="bud-from">Gültig ab *</label>
              <p-datepicker
                inputId="bud-from"
                name="fromMonth"
                [ngModel]="fromMonthDate()"
                (onSelect)="onFromMonthSelect($event)"
                view="month"
                dateFormat="M yy"
                [readonlyInput]="true"
                styleClass="w-full" />
            </div>

            <!-- Gültig bis -->
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-color">Gültig bis (optional)</label>
              <div class="flex gap-2 items-center">
                <p-datepicker
                  name="toMonth"
                  [ngModel]="toMonthDate()"
                  (onSelect)="onToMonthSelect($event)"
                  view="month"
                  dateFormat="M yy"
                  [readonlyInput]="true"
                  styleClass="flex-1" />
                @if (toMonthDate()) {
                  <p-button
                    type="button"
                    icon="pi pi-times"
                    [text]="true"
                    severity="secondary"
                    size="small"
                    (onClick)="clearToMonth()"
                    pTooltip="Kein Ablaufdatum" />
                }
              </div>
              @if (toMonthLabel() && toMonthLabel()! < fromMonthLabel()) {
                <span class="text-xs text-red-500">Muss nach dem Startdatum liegen.</span>
              }
            </div>

          </div>
        </p-fluid>

        <!-- Delete-Bereich (nur Edit-Modus) -->
        @if (!isCreate()) {
          <div class="mt-1">
            @if (!showDeleteConfirm()) {
              <p-button
                type="button"
                label="Budget löschen"
                icon="pi pi-trash"
                severity="danger"
                [text]="true"
                size="small"
                (onClick)="showDeleteConfirm.set(true)" />
            } @else {
              <div class="flex flex-col gap-3">
                <p-message
                  severity="warn"
                  text="Diese Änderung kann bereits berechnete Monatsansichten rückwirkend verändern. Trotzdem löschen?"
                  styleClass="w-full" />
                <div class="flex gap-2">
                  <p-button
                    type="button"
                    label="Löschen"
                    icon="pi pi-trash"
                    severity="danger"
                    size="small"
                    [loading]="saving()"
                    (onClick)="deleteBudget()" />
                  <p-button
                    type="button"
                    label="Abbrechen"
                    severity="secondary"
                    [text]="true"
                    size="small"
                    (onClick)="showDeleteConfirm.set(false)" />
                </div>
              </div>
            }
          </div>
        }

        <!-- Footer -->
        <div class="mt-auto flex gap-3 pt-4 border-t border-surface-200 dark:border-surface-700">
          <p-button
            type="submit"
            [label]="isCreate() ? 'Anlegen' : 'Speichern'"
            icon="pi pi-check"
            [disabled]="isInvalid()"
            [loading]="saving()" />
          <p-button
            type="button"
            label="Abbrechen"
            severity="secondary"
            [text]="true"
            (onClick)="close()" />
        </div>

      </form>
    </p-drawer>
  `,
})
export class BudgetEditorSidebarComponent {
  private readonly store = inject(Store);

  protected readonly editor = select(PlanningPageSelectors.editor);
  protected readonly allBudgets = select(PlanningPageSelectors.allBudgets);
  protected readonly categories = select(PlanningPageSelectors.categories);
  private readonly vm = select(PlanningPageSelectors.vm);

  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly showDeleteConfirm = signal(false);

  // Form fields
  protected readonly categoryId = signal<string>('');
  protected readonly amountEur = signal<number | null>(null);
  protected readonly fromMonthDate = signal<Date>(
    DateTime.now().startOf('month').toJSDate(),
  );
  protected readonly toMonthDate = signal<Date | null>(null);

  protected readonly isOpen = computed(() => this.editor()?.kind === 'budget');
  protected readonly isCreate = computed(
    () => this.editor()?.kind === 'budget' && this.editor()!.mode === 'create',
  );
  protected readonly currentBudget = computed(() => {
    const ed = this.editor();
    if (ed?.kind !== 'budget' || !ed.budgetId) return null;
    return this.allBudgets().find(b => b.budgetId === ed.budgetId) ?? null;
  });

  protected readonly fromMonthLabel = computed(() =>
    DateTime.fromJSDate(this.fromMonthDate()).toFormat('yyyy-MM'),
  );
  protected readonly toMonthLabel = computed(() => {
    const d = this.toMonthDate();
    return d ? DateTime.fromJSDate(d).toFormat('yyyy-MM') : null;
  });

  protected readonly isRetroactive = computed(() => {
    const currentMonth = DateTime.now().startOf('month').toFormat('yyyy-MM');
    return this.fromMonthLabel() < currentMonth;
  });

  protected readonly isInvalid = computed(() => {
    if (!this.categoryId()) return true;
    const amt = this.amountEur();
    if (amt == null || amt < 1) return true;
    const to = this.toMonthLabel();
    if (to && to < this.fromMonthLabel()) return true;
    return false;
  });

  constructor() {
    effect(() => {
      const ed = this.editor();
      if (ed?.kind !== 'budget') return;

      this.saveError.set(null);
      this.showDeleteConfirm.set(false);

      if (ed.mode === 'edit') {
        const budget = this.currentBudget();
        if (!budget) return;
        this.categoryId.set(budget.categoryId);
        this.amountEur.set(budget.amountMinor / 100);
        const fromLabel = budget.fromMonth === 'open'
          ? DateTime.now().toFormat('yyyy-MM')
          : budget.fromMonth;
        this.fromMonthDate.set(
          DateTime.fromFormat(fromLabel, 'yyyy-MM').startOf('month').toJSDate(),
        );
        this.toMonthDate.set(
          budget.toMonth
            ? DateTime.fromFormat(budget.toMonth, 'yyyy-MM').startOf('month').toJSDate()
            : null,
        );
      } else {
        this.categoryId.set(ed.categoryId ?? '');
        this.amountEur.set(null);
        this.fromMonthDate.set(DateTime.now().startOf('month').toJSDate());
        this.toMonthDate.set(null);
      }
    });
  }

  protected onFromMonthSelect(date: Date): void {
    this.fromMonthDate.set(date);
  }

  protected onToMonthSelect(date: Date): void {
    this.toMonthDate.set(date);
  }

  protected clearToMonth(): void {
    this.toMonthDate.set(null);
  }

  protected close(): void {
    this.store.dispatch(new ClosePlanningSidebar());
  }

  protected save(): void {
    if (this.isInvalid()) return;
    this.saving.set(true);
    this.saveError.set(null);

    const amountMinor = Math.round((this.amountEur() ?? 0) * 100);
    const fromMonth = this.fromMonthLabel();
    const toMonth = this.toMonthLabel() ?? undefined;

    if (this.isCreate()) {
      const payload: CreateBudgetPayload = {
        accountId: this.vm()?.accountId ?? '',
        categoryId: this.categoryId(),
        amountMinor,
        fromMonth,
        toMonth,
      };
      this.store.dispatch(new CreateBudget(payload)).subscribe({
        error: (err: unknown) => {
          this.saving.set(false);
          const body = (err as { error?: { code?: string; message?: string } })?.error;
          if (body?.code === 'BUDGET_OVERLAP') {
            this.saveError.set(
              'Für diese Kategorie existiert bereits ein Budget mit überschneidendem Zeitraum.',
            );
          } else {
            this.saveError.set(body?.message ?? 'Fehler beim Anlegen des Budgets.');
          }
        },
        complete: () => this.saving.set(false),
      });
    } else {
      const budgetId = (this.editor() as { kind: 'budget'; mode: 'edit'; budgetId?: string }).budgetId!;
      const payload: UpdateBudgetPayload = { amountMinor, fromMonth, toMonth };
      this.store.dispatch(new UpdateBudget(budgetId, payload)).subscribe({
        error: (err: unknown) => {
          this.saving.set(false);
          const body = (err as { error?: { code?: string; message?: string } })?.error;
          if (body?.code === 'BUDGET_OVERLAP') {
            this.saveError.set(
              'Für diese Kategorie existiert bereits ein Budget mit überschneidendem Zeitraum.',
            );
          } else {
            this.saveError.set(body?.message ?? 'Fehler beim Speichern des Budgets.');
          }
        },
        complete: () => this.saving.set(false),
      });
    }
  }

  protected deleteBudget(): void {
    const budgetId = (this.editor() as { kind: 'budget'; mode: 'edit'; budgetId?: string }).budgetId;
    if (!budgetId) return;
    this.saving.set(true);
    this.store.dispatch(new DeleteBudget(budgetId)).subscribe({
      error: (err: unknown) => {
        this.saving.set(false);
        const msg = (err as { error?: { message?: string } })?.error?.message;
        this.saveError.set(msg ?? 'Fehler beim Löschen des Budgets.');
        this.showDeleteConfirm.set(false);
      },
      complete: () => this.saving.set(false),
    });
  }
}
