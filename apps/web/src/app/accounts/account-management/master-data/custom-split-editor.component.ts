import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { MemberMasterItemVm } from './account-master-data.models';

export interface SplitRow {
  memberId: string;
  name: string;
  split: number;
}

@Component({
  selector: 'tbf-custom-split-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, InputNumberModule, InputGroupModule, InputGroupAddonModule],
  template: `
    <div class="flex flex-col gap-3">
      <p class="text-xs text-muted-color">
        Diese Verteilung kann für kategoriespezifische Monatsberechnungen verwendet werden.
        Ohne eigene Verteilung nutzt die Kategorie die Standardlogik aus der Planung.
      </p>

      @for (row of rows(); track row.memberId) {
        <div class="flex items-center gap-3">
          <span class="flex-1 text-sm text-color truncate">{{ row.name }}</span>
          <div class="w-32">
            <p-inputgroup>
              <p-inputnumber
                [ngModel]="row.split"
                (ngModelChange)="updateRow(row.memberId, $event ?? 0)"
                [min]="0"
                [max]="100"
                [maxFractionDigits]="0"
                [showButtons]="false"
                fluid />
              <p-inputgroup-addon>%</p-inputgroup-addon>
            </p-inputgroup>
          </div>
        </div>
      }

      <!-- Sum display -->
      <div class="flex items-center justify-between pt-2 border-t border-surface-200 dark:border-surface-700">
        <span class="text-sm font-medium text-muted-color">Summe</span>
        <span
          class="text-sm font-semibold"
          [class.text-green-600]="sum() === 100"
          [class.text-red-500]="sum() !== 100">
          {{ sum() }} %
        </span>
      </div>
    </div>
  `,
})
export class CustomSplitEditorComponent {
  readonly members = input.required<MemberMasterItemVm[]>();
  readonly value = input.required<SplitRow[]>();
  readonly valueChange = output<SplitRow[]>();

  protected readonly rows = computed(() => {
    const valueMap = new Map(this.value().map(r => [r.memberId, r.split]));
    return this.members().map(m => ({
      memberId: m.memberId,
      name: m.name ?? 'Unbenanntes Mitglied',
      split: valueMap.get(m.memberId) ?? 0,
    }));
  });

  protected readonly sum = computed(() =>
    this.rows().reduce((acc, r) => acc + r.split, 0),
  );

  protected updateRow(memberId: string, split: number): void {
    const updated = this.rows().map(r => ({
      ...r,
      split: r.memberId === memberId ? split : r.split,
    }));
    this.valueChange.emit(updated);
  }
}
