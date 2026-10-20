import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { ContributionBlockVm } from './planning.models';

type Distribution = ContributionBlockVm['distribution'];

export interface DistributionMemberOption {
  memberId: string;
  memberName: string;
  incomeSharePct: number | null;
}

@Component({
  selector: 'tbf-distribution-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectButtonModule, SelectModule, InputNumberModule],
  template: `
    <div class="flex flex-col gap-4">

      <!-- Mode Selector -->
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-color">Verteilungsmodus</label>
        <p-selectbutton
          name="distMode"
          [ngModel]="mode()"
          (ngModelChange)="onModeChange($event)"
          [options]="modeOptions"
          optionLabel="label"
          optionValue="value"
          styleClass="w-full" />
      </div>

      <!-- perMember: Member-Auswahl -->
      @if (mode() === 'perMember') {
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-color">Mitglied</label>
          <p-select
            name="perMemberTarget"
            [ngModel]="perMemberId()"
            (ngModelChange)="onPerMemberChange($event)"
            [options]="members()"
            optionLabel="memberName"
            optionValue="memberId"
            placeholder="Mitglied wählen …"
            styleClass="w-full" />
        </div>
      }

      <!-- customSplit: Prozent je Mitglied -->
      @if (mode() === 'customSplit') {
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-color">Aufteilung</label>
          @for (row of splits(); track row.memberId) {
            <div class="flex items-center gap-3">
              <span class="text-sm text-color flex-1 truncate">{{ memberName(row.memberId) }}</span>
              <p-inputnumber
                [ngModel]="row.split"
                (ngModelChange)="onSplitChange(row.memberId, $event)"
                mode="decimal"
                [minFractionDigits]="0"
                [maxFractionDigits]="0"
                [min]="0"
                [max]="100"
                suffix=" %"
                styleClass="w-28" />
            </div>
          }
          <div class="flex items-center justify-between text-xs mt-1">
            <span class="text-muted-color">Summe: {{ splitSum() }} %</span>
            @if (splitSum() !== 100) {
              <span class="text-red-500 dark:text-red-400">Muss genau 100 % ergeben</span>
            } @else {
              <span class="text-green-600 dark:text-green-400">✓ 100 %</span>
            }
          </div>
        </div>
      }

      <!-- proRataIncome: Vorschau -->
      @if (mode() === 'proRataIncome') {
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-color">Einkommensanteile (Vorschau)</label>
          @if (members().length === 0) {
            <span class="text-sm text-muted-color italic">Keine Mitglieder verfügbar.</span>
          } @else {
            @for (m of members(); track m.memberId) {
              <div class="flex items-center justify-between text-sm py-0.5">
                <span class="text-color">{{ m.memberName }}</span>
                <span class="text-muted-color">
                  @if (m.incomeSharePct !== null) {
                    {{ m.incomeSharePct }} %
                  } @else {
                    <span class="text-yellow-600 dark:text-yellow-400">kein Einkommen</span>
                  }
                </span>
              </div>
            }
          }
        </div>
      }

    </div>
  `,
})
export class DistributionEditorComponent {
  readonly distribution = input.required<Distribution>();
  readonly members = input.required<DistributionMemberOption[]>();
  readonly distributionChange = output<Distribution>();

  protected readonly modeOptions = [
    { label: 'Pro Mitglied', value: 'perMember' },
    { label: 'Custom Split', value: 'customSplit' },
    { label: 'ProRata', value: 'proRataIncome' },
  ];

  protected readonly splits = signal<Array<{ memberId: string; split: number }>>([]);

  protected readonly mode = computed(() => this.distribution().mode);
  protected readonly perMemberId = computed(() =>
    this.distribution().mode === 'perMember' ? (this.distribution().memberId ?? '') : '',
  );
  protected readonly splitSum = computed(() =>
    this.splits().reduce((sum, s) => sum + (s.split ?? 0), 0),
  );

  constructor() {
    // Sync internal splits when distribution input changes
    effect(() => {
      const d = this.distribution();
      const ms = this.members();
      if (d.mode === 'customSplit' && d.customSplit) {
        this.splits.set(
          ms.map(m => ({
            memberId: m.memberId,
            split: d.customSplit!.find(s => s.memberId === m.memberId)?.split ?? 0,
          })),
        );
      } else {
        this.splits.set(ms.map(m => ({ memberId: m.memberId, split: 0 })));
      }
    });
  }

  protected memberName(memberId: string): string {
    return this.members().find(m => m.memberId === memberId)?.memberName ?? memberId;
  }

  protected onModeChange(newMode: string): void {
    const m = newMode as Distribution['mode'];
    if (m === 'perMember') {
      this.distributionChange.emit({ mode: m, memberId: this.members()[0]?.memberId ?? '' });
    } else if (m === 'customSplit') {
      const splits = this.members().map(mb => ({ memberId: mb.memberId, split: 0 }));
      this.splits.set(splits);
      this.distributionChange.emit({ mode: m, customSplit: splits });
    } else {
      this.distributionChange.emit({ mode: m });
    }
  }

  protected onPerMemberChange(memberId: string): void {
    this.distributionChange.emit({ mode: 'perMember', memberId });
  }

  protected onSplitChange(memberId: string, value: number | null): void {
    const updated = this.splits().map(r =>
      r.memberId === memberId ? { ...r, split: value ?? 0 } : r,
    );
    this.splits.set(updated);
    this.distributionChange.emit({ mode: 'customSplit', customSplit: updated });
  }

  /** Gibt zurück ob das Distribution-Objekt aktuell valide ist */
  isValid(): boolean {
    const m = this.mode();
    if (m === 'perMember') return !!this.perMemberId();
    if (m === 'customSplit') return this.splitSum() === 100;
    return true; // proRataIncome
  }
}
