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
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageModule } from 'primeng/message';
import { FluidModule } from 'primeng/fluid';
import { DatePickerModule } from 'primeng/datepicker';
import { TooltipModule } from 'primeng/tooltip';
import { PlanningPageSelectors } from './state/planning.selectors';
import {
  ClosePlanningSidebar,
  CreateContributionRule,
  DeleteContributionRule,
  UpdateContributionRule,
} from './state/planning.actions';
import {
  ContributionBlockVm,
  CreateContributionRulePayload,
  UpdateContributionRulePayload,
} from './planning.models';
import {
  DistributionEditorComponent,
  DistributionMemberOption,
} from './distribution-editor.component';

type Distribution = ContributionBlockVm['distribution'];

@Component({
  selector: 'tbf-contribution-rule-editor-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    DrawerModule,
    ButtonModule,
    InputNumberModule,
    InputTextModule,
    SelectButtonModule,
    ToggleSwitchModule,
    MessageModule,
    FluidModule,
    DatePickerModule,
    TooltipModule,
    DistributionEditorComponent,
  ],
  template: `
    <p-drawer
      [visible]="isOpen()"
      [header]="isCreate() ? 'Beitragsregel hinzufügen' : 'Beitragsregel bearbeiten'"
      position="right"
      styleClass="!w-full md:!w-[540px]"
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

        @if (proRataIncomplete()) {
          <p-message
            severity="warn"
            text="Nicht alle Mitglieder haben ein aktives Einkommen. ProRata-Verteilung ist unvollständig und kann nicht gespeichert werden."
            styleClass="w-full" />
        }

        <p-fluid>
          <div class="flex flex-col gap-4">

            <!-- Typ (Create: Auswahl; Edit: read-only) -->
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-color">Typ</label>
              @if (isCreate()) {
                <p-selectbutton
                  name="ruleType"
                  [ngModel]="ruleType()"
                  (ngModelChange)="ruleType.set($event)"
                  [options]="typeOptions"
                  optionLabel="label"
                  optionValue="value"
                  styleClass="w-full" />
              } @else {
                <span class="text-sm text-color py-2 pl-1">
                  {{ ruleType() === 'additional' ? 'Zusatzbeitrag' : 'TopUp' }}
                </span>
              }
            </div>

            <!-- Bezeichnung -->
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-color" for="rule-desc">Bezeichnung *</label>
              <input
                id="rule-desc"
                pInputText
                name="description"
                [ngModel]="description()"
                (ngModelChange)="description.set($event)"
                placeholder="z.B. Strom-Anteil, Haushaltsgeld …"
                class="w-full" />
            </div>

            <!-- Betrag -->
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-color" for="rule-amt">Betrag *</label>
              <p-inputnumber
                inputId="rule-amt"
                name="amountEur"
                [ngModel]="amountEur()"
                (ngModelChange)="amountEur.set($event)"
                mode="decimal"
                [minFractionDigits]="0"
                [maxFractionDigits]="0"
                [min]="1"
                suffix=" €"
                styleClass="w-full"
                placeholder="z.B. 200" />
            </div>

            <!-- Wiederkehrend -->
            <div class="flex items-center gap-3">
              <p-toggleswitch
                name="recurring"
                [ngModel]="recurring()"
                (ngModelChange)="recurring.set($event)" />
              <span class="text-sm text-color">Wiederkehrend</span>
              @if (!recurring()) {
                <span class="text-xs text-muted-color">(gilt nur für Gültig-ab Monat)</span>
              }
            </div>

            <!-- Gültig ab -->
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-color" for="rule-from">Gültig ab *</label>
              <p-datepicker
                inputId="rule-from"
                name="fromMonth"
                [ngModel]="fromMonthDate()"
                (onSelect)="onFromMonthSelect($event)"
                view="month"
                dateFormat="M yy"
                [readonlyInput]="true"
                styleClass="w-full" />
            </div>

            <!-- Gültig bis (nur wenn wiederkehrend) -->
            @if (recurring()) {
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
            } @else {
              <div class="flex flex-col gap-1">
                <span class="text-sm font-medium text-muted-color">Gültig bis</span>
                <span class="text-sm text-color">{{ fromMonthLabel() }} (automatisch = Gültig ab)</span>
              </div>
            }

            <!-- Separator -->
            <div class="border-t border-surface pt-2">
              <tbf-distribution-editor
                [distribution]="currentDistribution()"
                [members]="memberOptions()"
                (distributionChange)="currentDistribution.set($event)" />
            </div>

          </div>
        </p-fluid>

        <!-- Delete-Bereich (nur Edit-Modus) -->
        @if (!isCreate()) {
          <div class="mt-1">
            @if (!showDeleteConfirm()) {
              <p-button
                type="button"
                label="Regel löschen"
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
                    (onClick)="deleteRule()" />
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
export class ContributionRuleEditorSidebarComponent {
  private readonly store = inject(Store);

  protected readonly editor = select(PlanningPageSelectors.editor);
  protected readonly allIncomes = select(PlanningPageSelectors.allIncomes);
  private readonly vm = select(PlanningPageSelectors.vm);

  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly showDeleteConfirm = signal(false);

  // Form fields
  protected readonly ruleType = signal<'additional' | 'topup'>('additional');
  protected readonly description = signal('');
  protected readonly amountEur = signal<number | null>(null);
  protected readonly recurring = signal(true);
  protected readonly fromMonthDate = signal<Date>(DateTime.now().startOf('month').toJSDate());
  protected readonly toMonthDate = signal<Date | null>(null);
  protected readonly currentDistribution = signal<Distribution>({ mode: 'proRataIncome' });

  protected readonly typeOptions = [
    { label: 'Zusatzbeitrag', value: 'additional' },
    { label: 'TopUp', value: 'topup' },
  ];

  protected readonly isOpen = computed(() => this.editor()?.kind === 'rule');
  protected readonly isCreate = computed(
    () => this.editor()?.kind === 'rule' && this.editor()!.mode === 'create',
  );

  protected readonly currentRule = computed(() => {
    const ed = this.editor();
    if (ed?.kind !== 'rule' || !ed.ruleId) return null;
    const v = this.vm();
    if (!v) return null;
    return (
      [...v.contributionBlocks, ...v.specialBlocks].find(b => b.ruleId === ed.ruleId) ?? null
    );
  });

  protected readonly memberOptions = computed((): DistributionMemberOption[] =>
    this.allIncomes().map(m => ({
      memberId: m.memberId,
      memberName: m.memberName ?? m.memberId,
      incomeSharePct: m.incomeSharePct,
    })),
  );

  protected readonly fromMonthLabel = computed(() =>
    DateTime.fromJSDate(this.fromMonthDate()).toFormat('yyyy-MM'),
  );
  protected readonly toMonthLabel = computed(() => {
    const d = this.toMonthDate();
    return d ? DateTime.fromJSDate(d).toFormat('yyyy-MM') : null;
  });

  protected readonly effectiveToMonth = computed(() => {
    if (!this.recurring()) return this.fromMonthLabel();
    return this.toMonthLabel();
  });

  protected readonly isRetroactive = computed(() => {
    const currentMonth = DateTime.now().startOf('month').toFormat('yyyy-MM');
    return this.fromMonthLabel() < currentMonth;
  });

  protected readonly proRataIncomplete = computed(() => {
    if (this.currentDistribution().mode !== 'proRataIncome') return false;
    return this.allIncomes().some(m => m.missingForProRata);
  });

  protected readonly isInvalid = computed(() => {
    if (!this.description().trim()) return true;
    const amt = this.amountEur();
    if (amt == null || amt < 1) return true;
    const to = this.toMonthLabel();
    if (to && to < this.fromMonthLabel()) return true;
    if (this.proRataIncomplete()) return true;
    const dist = this.currentDistribution();
    if (dist.mode === 'perMember' && !dist.memberId) return true;
    if (dist.mode === 'customSplit') {
      const sum = (dist.customSplit ?? []).reduce((s, r) => s + r.split, 0);
      if (sum !== 100) return true;
    }
    return false;
  });

  constructor() {
    effect(() => {
      const ed = this.editor();
      if (ed?.kind !== 'rule') return;

      this.saveError.set(null);
      this.showDeleteConfirm.set(false);

      if (ed.mode === 'edit') {
        const rule = this.currentRule();
        if (!rule) return;
        this.ruleType.set(rule.type as 'additional' | 'topup');
        this.description.set(rule.description ?? '');
        this.amountEur.set(rule.amountMinor / 100);
        this.recurring.set(rule.recurring);
        const fromLabel = rule.fromMonth ?? DateTime.now().toFormat('yyyy-MM');
        this.fromMonthDate.set(
          DateTime.fromFormat(fromLabel, 'yyyy-MM').startOf('month').toJSDate(),
        );
        this.toMonthDate.set(
          rule.toMonth
            ? DateTime.fromFormat(rule.toMonth, 'yyyy-MM').startOf('month').toJSDate()
            : null,
        );
        this.currentDistribution.set({ ...rule.distribution });
      } else {
        const presetType = (ed as { kind: 'rule'; mode: 'create'; ruleType?: 'additional' | 'topup' }).ruleType;
        this.ruleType.set(presetType ?? 'additional');
        this.description.set('');
        this.amountEur.set(null);
        this.recurring.set(true);
        this.fromMonthDate.set(DateTime.now().startOf('month').toJSDate());
        this.toMonthDate.set(null);
        this.currentDistribution.set({ mode: 'proRataIncome' });
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
    const toMonth = this.effectiveToMonth() ?? undefined;
    const desc = this.description().trim();
    const distribution = this.currentDistribution();

    if (this.isCreate()) {
      const payload: CreateContributionRulePayload = {
        accountId: this.vm()?.accountId ?? '',
        title: desc,
        description: desc,
        amountMinor,
        recurring: this.recurring(),
        fromMonth,
        toMonth,
        type: this.ruleType(),
        distribution,
      };
      this.store.dispatch(new CreateContributionRule(payload)).subscribe({
        error: (err: unknown) => {
          this.saving.set(false);
          const msg = (err as { error?: { message?: string } })?.error?.message;
          this.saveError.set(msg ?? 'Fehler beim Anlegen der Regel.');
        },
        complete: () => this.saving.set(false),
      });
    } else {
      const ed = this.editor();
      const ruleId = (ed as { kind: 'rule'; mode: 'edit'; ruleId?: string }).ruleId!;
      const payload: UpdateContributionRulePayload = {
        title: desc,
        description: desc,
        amountMinor,
        recurring: this.recurring(),
        fromMonth,
        toMonth,
        distribution,
      };
      this.store.dispatch(new UpdateContributionRule(ruleId, payload)).subscribe({
        error: (err: unknown) => {
          this.saving.set(false);
          const msg = (err as { error?: { message?: string } })?.error?.message;
          this.saveError.set(msg ?? 'Fehler beim Speichern der Regel.');
        },
        complete: () => this.saving.set(false),
      });
    }
  }

  protected deleteRule(): void {
    const ed = this.editor();
    const ruleId = (ed as { kind: 'rule'; mode: 'edit'; ruleId?: string }).ruleId;
    if (!ruleId) return;
    this.saving.set(true);
    this.store.dispatch(new DeleteContributionRule(ruleId)).subscribe({
      error: (err: unknown) => {
        this.saving.set(false);
        const msg = (err as { error?: { message?: string } })?.error?.message;
        this.saveError.set(msg ?? 'Fehler beim Löschen der Regel.');
        this.showDeleteConfirm.set(false);
      },
      complete: () => this.saving.set(false),
    });
  }
}
