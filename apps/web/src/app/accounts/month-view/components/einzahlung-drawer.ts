import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DateTime } from 'luxon';
import { DecimalPipe } from '@angular/common';

import { form, FormField, required, min } from '@angular/forms/signals';

import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';

import { MonthViewMemberUi } from '@/accounts/domain/month-view.ui-model';
import { API_BASE_URL } from '@/core/api-base-url.token';

// ---- Form model (UI representation, not domain payload) ----
interface EinzahlungFormModel {
  /** Amount in EUR (major unit) – converted to Minor on submit */
  amountEur: number;
  title: string;
  bookDate: Date;
  notes: string;
}

@Component({
  selector: 'tbf-einzahlung-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    FormField,
    ButtonModule,
    DrawerModule,
    InputNumberModule,
    InputTextModule,
    TextareaModule,
    DatePickerModule,
    SkeletonModule,
    TagModule,
    AvatarModule,
  ],
  template: `
    <p-drawer
      [(visible)]="visibleModel"
      position="right"
      styleClass="w-full sm:!w-[420px]"
      [header]="drawerHeader()"
      (onHide)="onHide()">

      @if (member(); as m) {
        <!-- Member context chip -->
        <div class="flex items-center gap-3 mb-5 p-3 rounded-xl bg-surface-100 dark:bg-surface-800">
          <p-avatar
            [label]="m.avatar ? '' : (m.name.charAt(0))"
            [image]="m.avatar ?? undefined"
            shape="circle"
            size="normal" />
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-color text-sm">{{ m.name }}</div>
            <div class="text-xs text-muted-color">
              Offen:
              <strong class="text-yellow-500">
                {{ (m.openAmountMinor / 100) | number:'1.2-2' }} €
              </strong>
            </div>
          </div>
          @if (m.paid) {
            <p-tag value="Bereits bezahlt" severity="success" icon="pi pi-check" />
          }
        </div>

        <!-- Form -->
        <form (ngSubmit)="submit()" class="flex flex-col gap-4">

          <!-- Amount -->
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-color">Betrag (€)</label>
            <p-inputnumber
              [formField]="$any(paymentForm.amountEur)"
              [minFractionDigits]="2"
              [maxFractionDigits]="2"
              prefix="€ "
              placeholder="0,00"
              styleClass="w-full"
              [min]="0.01" />
            @if (paymentForm.amountEur().touched() && paymentForm.amountEur().invalid()) {
              <span class="text-xs text-red-500">
                {{ paymentForm.amountEur().errors()[0]?.message }}
              </span>
            }
          </div>

          <!-- Title -->
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-color">Titel</label>
            <input pInputText [formField]="paymentForm.title" placeholder="Einzahlung" class="w-full" />
            @if (paymentForm.title().touched() && paymentForm.title().invalid()) {
              <span class="text-xs text-red-500">
                {{ paymentForm.title().errors()[0]?.message }}
              </span>
            }
          </div>

          <!-- Date -->
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-color">Datum</label>
            <p-datepicker
              [formField]="$any(paymentForm.bookDate)"
              dateFormat="dd.mm.yy"
              [showButtonBar]="true"
              [readonlyInput]="false"
              styleClass="w-full" />
          </div>

          <!-- Notes -->
          <!-- NOTE: [formField] intentionally NOT used on pTextarea.
               PrimeNG pTextarea injects NgControl with {self:true} and calls
               valueChanges.subscribe() — Signal Forms' InteropNgControl does
               not implement valueChanges → TypeError on first render.
               Binding manually instead (same pattern as transaction-detail-editor). -->
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-color">Notiz (optional)</label>
            <textarea
              pTextarea
              [value]="paymentForm.notes().value() || ''"
              (input)="paymentForm.notes().value.set($any($event.target).value || null)"
              rows="2"
              placeholder="Optionale Anmerkung…"
              class="w-full resize-none"></textarea>
          </div>

          <!-- Error -->
          @if (saveError()) {
            <div class="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
              {{ saveError() }}
            </div>
          }

          <!-- Actions -->
          <div class="flex gap-3 mt-2">
            <p-button
              type="submit"
              label="Einzahlung buchen"
              icon="pi pi-check"
              severity="success"
              styleClass="flex-1"
              [loading]="saving()"
              [disabled]="paymentForm().invalid()" />
            <p-button
              type="button"
              label="Abbrechen"
              severity="secondary"
              [text]="true"
              (onClick)="close()" />
          </div>

        </form>
      }
    </p-drawer>
  `,
})
export class EinzahlungDrawer {
  // ---- Inputs / Outputs ----
  readonly member = input<MonthViewMemberUi | null>(null);
  readonly accountId = input.required<string>();
  /** YYYY-MM of the currently displayed month */
  readonly monthIso = input.required<string>();
  /** Two-way binding for drawer visibility */
  readonly visible = input(false);
  readonly visibleChange = output<boolean>();
  /** Emitted after a transaction was successfully saved */
  readonly saved = output<void>();

  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  // ---- Internal state ----
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  /** Syncs visible input → writable signal for p-drawer [(visible)] two-way binding */
  protected visibleModel = false;

  protected readonly drawerHeader = computed(() => {
    const m = this.member();
    return m ? `Einzahlung buchen — ${m.name}` : 'Einzahlung buchen';
  });

  // ---- Signal Form ----
  private readonly formModel = signal<EinzahlungFormModel>({
    amountEur: 0,
    title: 'Einzahlung',
    bookDate: new Date(),
    notes: '',
  });

  protected readonly paymentForm = form(this.formModel, ({ amountEur, title }) => {
    required(amountEur, { message: 'Betrag ist erforderlich' });
    min(amountEur, 0.01, { message: 'Betrag muss größer als 0 sein' });
    required(title, { message: 'Titel ist erforderlich' });
  });

  constructor() {
    // Sync visible input → internal model
    effect(() => {
      this.visibleModel = this.visible();
    });

    // Pre-fill form whenever the target member changes
    effect(() => {
      const m = this.member();
      if (m) {
        this.formModel.set({
          amountEur: parseFloat((m.openAmountMinor / 100).toFixed(2)),
          title: 'Einzahlung',
          bookDate: new Date(),
          notes: '',
        });
        this.saveError.set(null);
      }
    });
  }

  protected onHide(): void {
    this.visibleChange.emit(false);
  }

  protected close(): void {
    this.visibleChange.emit(false);
  }

  protected submit(): void {
    if (this.paymentForm().invalid()) return;

    const v = this.formModel();
    const member = this.member();
    if (!member) return;

    const amountMinor = Math.round(v.amountEur * 100);
    const bookDateIso = DateTime.fromJSDate(v.bookDate).toUTC().toISO()!;
    // month anchor: YYYY-MM-01T00:00:00.000Z derived from YYYY-MM input
    const monthAnchor = DateTime.fromISO(`${this.monthIso()}-01`, { zone: 'utc' }).toISO()!;

    const payload = {
      accountId: this.accountId(),
      type: 'income',
      status: 'booked',
      title: v.title.trim(),
      notes: v.notes.trim() || null,
      amountMinor,
      bookDate: bookDateIso,
      month: monthAnchor,
      isFromSharedAccount: false,
      paidByMemberId: member.id,
    };

    this.saving.set(true);
    this.saveError.set(null);

    this.http.post(`${this.baseUrl}/api/transactions`, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.visibleChange.emit(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const msg =
          (err as { error?: { error?: string } })?.error?.error ??
          (err as { message?: string })?.message ??
          'Fehler beim Speichern';
        this.saveError.set(msg);
      },
    });
  }
}
