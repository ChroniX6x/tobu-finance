import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CurrencyPipe, NgTemplateOutlet, PercentPipe } from '@angular/common';
import { select } from '@ngxs/store';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { PlanningPageSelectors } from './state/planning.selectors';
import { ContributionBlockVm } from './planning.models';

@Component({
  selector: 'tbf-contribution-rules-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, NgTemplateOutlet, PercentPipe, TagModule, ButtonModule, TooltipModule],
  template: `
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-color">Beitragsregeln</h2>
      <p-button
        label="Regel hinzufügen"
        icon="pi pi-plus"
        size="small"
        severity="secondary"
        [disabled]="true"
        pTooltip="Verfügbar in Baustein 6" />
    </div>

    @if (baseBlocks().length === 0 && additionalBlocks().length === 0) {
      <div class="flex flex-col items-center gap-3 py-12 text-center">
        <i class="pi pi-sliders-h text-4xl text-muted-color"></i>
        <p class="text-muted-color text-sm">Noch keine Beitragsregeln eingerichtet.</p>
      </div>
    } @else {

      <!-- Base-Blöcke -->
      @if (baseBlocks().length > 0) {
        <p class="text-xs text-muted-color uppercase tracking-wide mb-2">Abgeleitet aus Budgets</p>
        <div class="flex flex-col gap-3 mb-6">
          @for (block of baseBlocks(); track block.id) {
            <ng-container *ngTemplateOutlet="blockCard; context: { $implicit: block }" />
          }
        </div>
      }

      <!-- Additional-Blöcke -->
      @if (additionalBlocks().length > 0) {
        <p class="text-xs text-muted-color uppercase tracking-wide mb-2">Zusätzliche Regeln</p>
        <div class="flex flex-col gap-3">
          @for (block of additionalBlocks(); track block.id) {
            <ng-container *ngTemplateOutlet="blockCard; context: { $implicit: block }" />
          }
        </div>
      }
    }

    <!-- Block-Karte Template -->
    <ng-template #blockCard let-block>
      <div class="rounded-xl border border-surface bg-surface-card p-4">
        <div class="flex items-start justify-between gap-4">

          <div class="flex flex-col gap-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-medium text-color truncate">{{ block.title }}</span>
              @if (!block.isEditable) {
                <span class="text-xs text-muted-color italic">(auto)</span>
              }
            </div>
            <span class="text-2xl font-bold text-color">
              {{ toEur(block.amountMinor) | currency:'EUR':'symbol':'1.0-0' }}
            </span>
            <span class="text-xs text-muted-color">{{ distributionLabel(block) }}</span>
            @if (block.description) {
              <span class="text-xs text-muted-color mt-1">{{ block.description }}</span>
            }
            @if (!block.isEditable) {
              <a
                href="#planning-budgets-section"
                class="text-xs text-primary mt-1 hover:underline"
                (click)="$event.preventDefault(); scrollToBudgets()">
                Budgets anzeigen →
              </a>
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
            @if (block.isEditable) {
              <p-button
                icon="pi pi-pencil"
                [text]="true"
                size="small"
                severity="secondary"
                [disabled]="true"
                pTooltip="Bearbeiten – verfügbar in Baustein 6" />
            }
          </div>

        </div>
      </div>
    </ng-template>
  `,
})
export class ContributionRulesSectionComponent {
  protected readonly baseBlocks = select(PlanningPageSelectors.baseBlocks);
  protected readonly additionalBlocks = select(PlanningPageSelectors.additionalBlocks);
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

  protected scrollToBudgets(): void {
    document.getElementById('planning-budgets-section')?.scrollIntoView({ behavior: 'smooth' });
  }
}
