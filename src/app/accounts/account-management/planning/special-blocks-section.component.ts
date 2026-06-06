import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CurrencyPipe, PercentPipe } from '@angular/common';
import { select } from '@ngxs/store';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { PlanningPageSelectors } from './state/planning.selectors';
import { ContributionBlockVm } from './planning.models';

@Component({
  selector: 'tbf-special-blocks-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, PercentPipe, TagModule, ButtonModule, TooltipModule],
  template: `
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-color">Sonderbausteine</h2>
      <div class="flex gap-2">
        <p-button
          label="+ TopUp"
          size="small"
          severity="secondary"
          [disabled]="true"
          pTooltip="Verfügbar in Baustein 6" />
        <p-button
          label="+ Zusatzbeitrag"
          size="small"
          severity="secondary"
          [disabled]="true"
          pTooltip="Verfügbar in Baustein 6" />
      </div>
    </div>

    @if (specialBlocks().length === 0) {
      <div class="flex flex-col items-center gap-3 py-12 text-center">
        <i class="pi pi-star text-4xl text-muted-color"></i>
        <p class="text-muted-color text-sm">Noch keine TopUps oder Sonderbeiträge eingerichtet.</p>
      </div>
    } @else {
      <div class="flex flex-col gap-3">
        @for (block of specialBlocks(); track block.id) {
          <div class="rounded-xl border border-surface bg-surface-card p-4">
            <div class="flex items-start justify-between gap-4">

              <div class="flex flex-col gap-1 min-w-0">
                <span class="font-medium text-color truncate">{{ block.title }}</span>
                <span class="text-2xl font-bold text-color">
                  {{ toEur(block.amountMinor) | currency:'EUR':'symbol':'1.0-0' }}
                </span>
                <span class="text-xs text-muted-color">{{ distributionLabel(block) }}</span>
                @if (block.description) {
                  <span class="text-xs text-muted-color mt-1">{{ block.description }}</span>
                }
                @if (block.fromMonth || block.toMonth) {
                  <span class="text-xs text-muted-color">
                    @if (block.fromMonth) { ab {{ block.fromMonth }} }
                    @if (block.toMonth) { bis {{ block.toMonth }} }
                  </span>
                }

                <!-- effectByMember Toggle -->
                @if (block.effectByMember.length > 0) {
                  <button
                    type="button"
                    class="text-xs text-primary mt-2 text-left hover:underline"
                    (click)="toggleDetail(block.id)">
                    @if (isDetailOpen(block.id)) { Aufschlüsselung ausblenden }
                    @else { Aufschlüsselung anzeigen }
                  </button>
                  @if (isDetailOpen(block.id)) {
                    <div class="mt-2 flex flex-col gap-1 pl-3 border-l border-surface">
                      @for (e of block.effectByMember; track e.memberId) {
                        <span class="text-xs text-muted-color">
                          {{ e.memberId }} ·
                          {{ toEur(e.amountMinor) | currency:'EUR':'symbol':'1.0-0' }}
                          ({{ e.sharePct / 100 | percent:'1.0-0' }})
                        </span>
                      }
                    </div>
                  }
                }
              </div>

              <div class="flex flex-col items-end gap-2 shrink-0">
                @if (block.isActiveInReferenceMonth) {
                  <p-tag severity="success" value="Aktiv" />
                } @else {
                  <p-tag severity="secondary" value="Inaktiv" />
                }
                <p-button
                  icon="pi pi-pencil"
                  [text]="true"
                  size="small"
                  severity="secondary"
                  [disabled]="true"
                  pTooltip="Bearbeiten – verfügbar in Baustein 6" />
              </div>

            </div>
          </div>
        }
      </div>
    }
  `,
})
export class SpecialBlocksSectionComponent {
  protected readonly specialBlocks = select(PlanningPageSelectors.specialBlocks);
  private readonly openDetails = signal<Set<string>>(new Set());

  protected toEur(minor: number): number {
    return minor / 100;
  }

  protected distributionLabel(block: ContributionBlockVm): string {
    switch (block.distribution.mode) {
      case 'proRataIncome': return 'ProRata (einkommensbasiert)';
      case 'customSplit':   return 'Benutzerdefinierte Aufteilung';
      case 'perMember':     return 'Pro Mitglied';
      default:              return block.distribution.mode;
    }
  }

  protected toggleDetail(id: string): void {
    this.openDetails.update(set => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  protected isDetailOpen(id: string): boolean {
    return this.openDetails().has(id);
  }
}
