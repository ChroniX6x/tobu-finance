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
  CreateIncome,
  DeleteIncome,
  UpdateIncome,
} from './state/planning.actions';
import { CreateIncomePayload, UpdateIncomePayload } from './planning.models';

@Component({
  selector: 'tbf-income-editor-sidebar',
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
      [header]="isCreate() ? 'Einkommen hinzufügen' : 'Einkommen bearbeiten'"
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

            <!-- Mitglied -->
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-color" for="inc-member">Mitglied *</label>
              @if (isCreate()) {
                <p-select
                  inputId="inc-member"
                  name="memberId"
                  [ngModel]="memberId()"
                  (ngModelChange)="memberId.set($event)"
                  [options]="memberOptions()"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Mitglied wählen …"
                  styleClass="w-full" />
              } @else {
                <span class="text-sm text-color py-2 pl-1">
                  {{ currentIncome()?.memberName ?? '—' }}
                </span>
              }
            </div>

            <!-- Betrag -->
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-color" for="inc-amt">Monatliches Einkommen *</label>
              <p-inputnumber
                inputId="inc-amt"
                name="amountEur"
                [ngModel]="amountEur()"
                (ngModelChange)="amountEur.set($event)"
                mode="decimal"
                [minFractionDigits]="0"
                [maxFractionDigits]="0"
                [min]="1"
                suffix=" €"
                styleClass="w-full"
                placeholder="z.B. 2000" />
            </div>

            <!-- Gültig ab -->
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-color" for="inc-from">Gültig ab *</label>
              <p-datepicker
                inputId="inc-from"
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
                <span class="text-xs text-red-500 dark:text-red-400">Muss nach dem Startdatum liegen.</span>
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
                label="Einkommen löschen"
                icon="pi pi-trash"
                severity="danger"
                [text]="true"
                size="small"
                (onClick)="showDeleteConfirm.set(true)" />
            } @else {
              <div class="flex flex-col gap-3">
                <p-message
                  severity="warn"
                  text="Wenn dadurch eine ProRata-Verteilung nicht mehr berechenbar ist, erscheint ein Planungs-Hinweis."
                  styleClass="w-full" />
                <div class="flex gap-2">
                  <p-button
                    type="button"
                    label="Löschen"
                    icon="pi pi-trash"
                    severity="danger"
                    size="small"
                    [loading]="saving()"
                    (onClick)="deleteIncome()" />
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
export class IncomeEditorSidebarComponent {
  private readonly store = inject(Store);

  protected readonly editor = select(PlanningPageSelectors.editor);
  protected readonly allIncomes = select(PlanningPageSelectors.allIncomes);
  private readonly vm = select(PlanningPageSelectors.vm);

  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly showDeleteConfirm = signal(false);

  // Form fields
  protected readonly memberId = signal<string>('');
  protected readonly amountEur = signal<number | null>(null);
  protected readonly fromMonthDate = signal<Date>(
    DateTime.now().startOf('month').toJSDate(),
  );
  protected readonly toMonthDate = signal<Date | null>(null);

  protected readonly isOpen = computed(() => this.editor()?.kind === 'income');
  protected readonly isCreate = computed(
    () => this.editor()?.kind === 'income' && this.editor()!.mode === 'create',
  );

  /** Sucht das Income-Objekt anhand der incomeId in activeIncome + history aller Members */
  protected readonly currentIncome = computed(() => {
    const ed = this.editor();
    if (ed?.kind !== 'income' || !ed.incomeId) return null;
    for (const m of this.allIncomes()) {
      if (m.activeIncome?.incomeId === ed.incomeId) {
        return { ...m.activeIncome, memberId: m.memberId, memberName: m.memberName };
      }
      const hist = m.history.find(h => h.incomeId === ed.incomeId);
      if (hist) return { ...hist, memberId: m.memberId, memberName: m.memberName };
    }
    return null;
  });

  protected readonly memberOptions = computed(() =>
    this.allIncomes().map(m => ({ label: m.memberName ?? m.memberId, value: m.memberId })),
  );

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
    if (!this.memberId()) return true;
    const amt = this.amountEur();
    if (amt == null || amt < 1) return true;
    const to = this.toMonthLabel();
    if (to && to < this.fromMonthLabel()) return true;
    return false;
  });

  constructor() {
    effect(() => {
      const ed = this.editor();
      if (ed?.kind !== 'income') return;

      this.saveError.set(null);
      this.showDeleteConfirm.set(false);

      if (ed.mode === 'edit') {
        const income = this.currentIncome();
        if (!income) return;
        this.memberId.set(income.memberId);
        this.amountEur.set(income.amountMinor / 100);
        const fromLabel = income.fromMonth === 'open'
          ? DateTime.now().toFormat('yyyy-MM')
          : income.fromMonth;
        this.fromMonthDate.set(
          DateTime.fromFormat(fromLabel, 'yyyy-MM').startOf('month').toJSDate(),
        );
        this.toMonthDate.set(
          income.toMonth
            ? DateTime.fromFormat(income.toMonth, 'yyyy-MM').startOf('month').toJSDate()
            : null,
        );
      } else {
        // Create: ggf. memberId vorbelegen wenn über "Einkommen ergänzen" geöffnet
        this.memberId.set(ed.memberId ?? '');
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
      const payload: CreateIncomePayload = {
        accountId: this.vm()?.accountId ?? '',
        memberId: this.memberId(),
        amountMinor,
        fromMonth,
        toMonth,
      };
      this.store.dispatch(new CreateIncome(payload)).subscribe({
        error: (err: unknown) => {
          this.saving.set(false);
          const body = (err as { error?: { code?: string; message?: string } })?.error;
          if (body?.code === 'INCOME_OVERLAP') {
            this.saveError.set(
              'Für dieses Mitglied existiert bereits ein Einkommen mit überschneidendem Zeitraum.',
            );
          } else {
            this.saveError.set(body?.message ?? 'Fehler beim Anlegen des Einkommens.');
          }
        },
        complete: () => this.saving.set(false),
      });
    } else {
      const ed = this.editor();
      const incomeId = (ed as { kind: 'income'; mode: 'edit'; incomeId?: string }).incomeId!;
      const payload: UpdateIncomePayload = { amountMinor, fromMonth, toMonth };
      this.store.dispatch(new UpdateIncome(incomeId, payload)).subscribe({
        error: (err: unknown) => {
          this.saving.set(false);
          const body = (err as { error?: { code?: string; message?: string } })?.error;
          if (body?.code === 'INCOME_OVERLAP') {
            this.saveError.set(
              'Für dieses Mitglied existiert bereits ein Einkommen mit überschneidendem Zeitraum.',
            );
          } else {
            this.saveError.set(body?.message ?? 'Fehler beim Speichern des Einkommens.');
          }
        },
        complete: () => this.saving.set(false),
      });
    }
  }

  protected deleteIncome(): void {
    const ed = this.editor();
    const incomeId = (ed as { kind: 'income'; mode: 'edit'; incomeId?: string }).incomeId;
    if (!incomeId) return;
    this.saving.set(true);
    this.store.dispatch(new DeleteIncome(incomeId)).subscribe({
      error: (err: unknown) => {
        this.saving.set(false);
        const msg = (err as { error?: { message?: string } })?.error?.message;
        this.saveError.set(msg ?? 'Fehler beim Löschen des Einkommens.');
        this.showDeleteConfirm.set(false);
      },
      complete: () => this.saving.set(false),
    });
  }
}
