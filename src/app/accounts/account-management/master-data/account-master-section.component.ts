import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Store, select } from '@ngxs/store';
import { form, FormField, required, minLength, maxLength, min, max, validate } from '@angular/forms/signals';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { FluidModule } from 'primeng/fluid';
import { IftaLabelModule } from 'primeng/iftalabel';
import { AccountMasterVm, SaveAccountMasterDataPayload } from './account-master-data.models';
import { MasterDataPageState } from './state/master-data-page.state';
import { SaveAccountMasterData } from './state/master-data-page.actions';

interface AccountEditFormModel {
  name: string;
  historyMonths: number;
  topKCategories: number;
  /** EUR display value (Minor / 100). null = "not set" */
  lowBalanceForecastEur: number | null;
  carryoverLargeEur: number | null;
  stalenessDays: number | null;
}

@Component({
  selector: 'tbf-account-master-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    FormField,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    MessageModule,
    FluidModule,
    IftaLabelModule,
  ],
  template: `
    <header class="mb-5 flex items-start justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold text-color">Account</h2>
        <p class="text-sm text-muted-color mt-0.5">Account-Name und accountweite Einstellungen.</p>
      </div>
      @if (!editing()) {
        <p-button
          label="Bearbeiten"
          icon="pi pi-pencil"
          severity="secondary"
          [text]="true"
          size="small"
          (onClick)="startEdit()" />
      }
    </header>

    @if (!editing()) {
      <!-- ── View mode ────────────────────────────────────────── -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <!-- Card 1: Account -->
        <div class="p-4 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900">
          <p class="text-xs font-semibold uppercase tracking-wide text-muted-color mb-3">Account</p>
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between gap-2">
              <dt class="text-muted-color">Name</dt>
              <dd class="font-medium text-color text-right">{{ vm().name ?? 'Unbenannter Account' }}</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-muted-color">Währung</dt>
              <dd class="font-medium text-color">{{ vm().currency }}</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-muted-color">Mitgliederanzahl</dt>
              <dd class="font-medium text-color">{{ vm().memberCount }}</dd>
            </div>
          </dl>
        </div>

        <!-- Card 2: Settings -->
        <div class="p-4 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900">
          <p class="text-xs font-semibold uppercase tracking-wide text-muted-color mb-3">Einstellungen</p>
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between gap-2">
              <dt class="text-muted-color">Dashboard-Verlauf</dt>
              <dd class="font-medium text-color">{{ vm().settings.dashboard.historyMonths }} Monate</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-muted-color">Top-K Kategorien</dt>
              <dd class="font-medium text-color">{{ vm().settings.dashboard.topKCategories }}</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-muted-color">Warnschw. Unterdeckung</dt>
              <dd class="font-medium text-color">
                @if (vm().settings.alerts.lowBalanceForecastMinor !== null) {
                  {{ (vm().settings.alerts.lowBalanceForecastMinor! / 100) | number:'1.2-2' }} €
                } @else {
                  <span class="text-muted-color italic">Nicht gesetzt</span>
                }
              </dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-muted-color">Warnschw. gr. Übertrag</dt>
              <dd class="font-medium text-color">
                @if (vm().settings.alerts.carryoverLargeMinor !== null) {
                  {{ (vm().settings.alerts.carryoverLargeMinor! / 100) | number:'1.2-2' }} €
                } @else {
                  <span class="text-muted-color italic">Nicht gesetzt</span>
                }
              </dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-muted-color">Staleness-Tage</dt>
              <dd class="font-medium text-color">
                @if (vm().settings.alerts.stalenessDays !== null) {
                  {{ vm().settings.alerts.stalenessDays }} Tage
                } @else {
                  <span class="text-muted-color italic">Nicht gesetzt</span>
                }
              </dd>
            </div>
          </dl>
        </div>

      </div>

    } @else {
      <!-- ── Edit mode ─────────────────────────────────────────── -->
      <form (ngSubmit)="saveEdit()" class="flex flex-col gap-5">

        <!-- Error banner -->
        @if (saveError()) {
          <p-message severity="error" [text]="saveError()!" styleClass="w-full" />
        }

        <!-- Section: Account -->
        <div class="p-4 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900">
          <p class="text-xs font-semibold uppercase tracking-wide text-muted-color mb-4">Account</p>
          <p-fluid>
            <div class="flex flex-col gap-4">

              <!-- Name -->
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-color" for="acc-name">Account-Name *</label>
                <input
                  id="acc-name"
                  pInputText
                  [formField]="accountForm.name"
                  placeholder="Account-Name"
                  class="w-full" />
                @if (accountForm.name().touched() && accountForm.name().invalid()) {
                  <span class="text-xs text-red-500">{{ accountForm.name().errors()[0]?.message }}</span>
                }
              </div>

              <!-- Currency (read-only) -->
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-muted-color">Währung</label>
                <span class="text-sm text-color pl-1">EUR (nicht änderbar)</span>
              </div>

            </div>
          </p-fluid>
        </div>

        <!-- Section: Settings -->
        <div class="p-4 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900">
          <p class="text-xs font-semibold uppercase tracking-wide text-muted-color mb-4">Einstellungen</p>
          <p-fluid>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <!-- historyMonths -->
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-color" for="hist-months">Dashboard-Verlauf (Monate)</label>
                <p-inputnumber
                  inputId="hist-months"
                  [formField]="$any(accountForm.historyMonths)"
                  [min]="3" [max]="24"
                  [showButtons]="true"
                  styleClass="w-full" />
                @if (accountForm.historyMonths().touched() && accountForm.historyMonths().invalid()) {
                  <span class="text-xs text-red-500">{{ accountForm.historyMonths().errors()[0]?.message }}</span>
                }
              </div>

              <!-- topKCategories -->
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-color" for="top-k">Top-K Kategorien</label>
                <p-inputnumber
                  inputId="top-k"
                  [formField]="$any(accountForm.topKCategories)"
                  [min]="1" [max]="10"
                  [showButtons]="true"
                  styleClass="w-full" />
                @if (accountForm.topKCategories().touched() && accountForm.topKCategories().invalid()) {
                  <span class="text-xs text-red-500">{{ accountForm.topKCategories().errors()[0]?.message }}</span>
                }
              </div>

              <!-- lowBalanceForecastEur -->
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-color" for="low-bal">Warnschw. Unterdeckung (€)</label>
                <p-inputnumber
                  inputId="low-bal"
                  [formField]="$any(accountForm.lowBalanceForecastEur)"
                  [minFractionDigits]="2" [maxFractionDigits]="2"
                  [min]="0"
                  prefix="€ "
                  placeholder="Nicht gesetzt"
                  styleClass="w-full" />
                @if (accountForm.lowBalanceForecastEur().touched() && accountForm.lowBalanceForecastEur().invalid()) {
                  <span class="text-xs text-red-500">{{ accountForm.lowBalanceForecastEur().errors()[0]?.message }}</span>
                }
              </div>

              <!-- carryoverLargeEur -->
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-color" for="carryover">Warnschw. gr. Übertrag (€)</label>
                <p-inputnumber
                  inputId="carryover"
                  [formField]="$any(accountForm.carryoverLargeEur)"
                  [minFractionDigits]="2" [maxFractionDigits]="2"
                  [min]="0"
                  prefix="€ "
                  placeholder="Nicht gesetzt"
                  styleClass="w-full" />
                @if (accountForm.carryoverLargeEur().touched() && accountForm.carryoverLargeEur().invalid()) {
                  <span class="text-xs text-red-500">{{ accountForm.carryoverLargeEur().errors()[0]?.message }}</span>
                }
              </div>

              <!-- stalenessDays -->
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-color" for="staleness">Staleness-Tage</label>
                <p-inputnumber
                  inputId="staleness"
                  [formField]="$any(accountForm.stalenessDays)"
                  [min]="1"
                  [step]="1"
                  suffix=" Tage"
                  placeholder="Nicht gesetzt"
                  styleClass="w-full" />
                @if (accountForm.stalenessDays().touched() && accountForm.stalenessDays().invalid()) {
                  <span class="text-xs text-red-500">{{ accountForm.stalenessDays().errors()[0]?.message }}</span>
                }
              </div>

            </div>
          </p-fluid>
        </div>

        <!-- Actions -->
        <div class="flex gap-3">
          <p-button
            type="submit"
            label="Speichern"
            icon="pi pi-check"
            [disabled]="accountForm().invalid()"
            [loading]="saving()" />
          <p-button
            type="button"
            label="Abbrechen"
            severity="secondary"
            [text]="true"
            (onClick)="cancelEdit()" />
        </div>

      </form>
    }
  `,
})
export class AccountMasterSectionComponent {
  private readonly store = inject(Store);

  readonly accountVm = input.required<AccountMasterVm>();

  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = select(MasterDataPageState.accountSaveError);

  // Expose vm as a computed for cleaner template access
  protected readonly vm = computed(() => this.accountVm());

  // ---- Signal Form ----
  private readonly formModel = signal<AccountEditFormModel>({
    name: '',
    historyMonths: 6,
    topKCategories: 5,
    lowBalanceForecastEur: null,
    carryoverLargeEur: null,
    stalenessDays: null,
  });

  protected readonly accountForm = form(this.formModel, (p) => {
    required(p.name, { message: 'Name ist erforderlich' });
    minLength(p.name, 2, { message: 'Mind. 2 Zeichen' });
    maxLength(p.name, 64, { message: 'Max. 64 Zeichen' });
    min(p.historyMonths, 3, { message: 'Min. 3 Monate' });
    max(p.historyMonths, 24, { message: 'Max. 24 Monate' });
    min(p.topKCategories, 1, { message: 'Min. 1 Kategorie' });
    max(p.topKCategories, 10, { message: 'Max. 10 Kategorien' });
    validate(p.lowBalanceForecastEur, ({ value }) => {
      const v = value();
      if (v !== null && v < 0) return { kind: 'nonNeg', message: 'Muss ≥ 0 sein' };
      return null;
    });
    validate(p.carryoverLargeEur, ({ value }) => {
      const v = value();
      if (v !== null && v < 0) return { kind: 'nonNeg', message: 'Muss ≥ 0 sein' };
      return null;
    });
    validate(p.stalenessDays, ({ value }) => {
      const v = value();
      if (v !== null && v < 1) return { kind: 'posInt', message: 'Muss > 0 sein' };
      return null;
    });
  });

  protected startEdit(): void {
    const vm = this.accountVm();
    const alerts = vm.settings.alerts;
    this.formModel.set({
      name: vm.name ?? '',
      historyMonths: vm.settings.dashboard.historyMonths,
      topKCategories: vm.settings.dashboard.topKCategories,
      lowBalanceForecastEur:
        alerts.lowBalanceForecastMinor !== null ? alerts.lowBalanceForecastMinor / 100 : null,
      carryoverLargeEur:
        alerts.carryoverLargeMinor !== null ? alerts.carryoverLargeMinor / 100 : null,
      stalenessDays: alerts.stalenessDays,
    });
    this.editing.set(true);
  }

  protected cancelEdit(): void {
    this.editing.set(false);
  }

  protected saveEdit(): void {
    if (this.accountForm().invalid()) return;
    const v = this.formModel();
    const payload: SaveAccountMasterDataPayload = {
      name: v.name,
      settings: {
        dashboard: {
          historyMonths: v.historyMonths,
          topKCategories: v.topKCategories,
        },
        alerts: {
          lowBalanceForecastMinor:
            v.lowBalanceForecastEur !== null ? Math.round(v.lowBalanceForecastEur * 100) : null,
          carryoverLargeMinor:
            v.carryoverLargeEur !== null ? Math.round(v.carryoverLargeEur * 100) : null,
          stalenessDays: v.stalenessDays,
        },
      },
    };
    this.saving.set(true);
    this.store.dispatch(new SaveAccountMasterData(payload)).subscribe(() => {
      this.saving.set(false);
      const err = this.store.selectSnapshot(MasterDataPageState.accountSaveError);
      if (!err) this.editing.set(false);
    });
  }
}

