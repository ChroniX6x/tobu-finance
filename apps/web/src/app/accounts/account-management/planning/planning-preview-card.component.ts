import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { select } from '@ngxs/store';
import { MessageModule } from 'primeng/message';
import { PlanningPageSelectors } from './state/planning.selectors';

@Component({
  selector: 'tbf-planning-preview-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, MessageModule],
  template: `
    @if (preview(); as pv) {
      <div class="rounded-xl border border-surface bg-surface-card p-4">
        <h3 class="text-base font-semibold text-color mb-3">
          Vorschau für {{ pv.month }}
        </h3>

        <div class="flex flex-col gap-2 mb-4">
          <div class="flex justify-between items-center">
            <span class="text-sm text-muted-color">Monatsbedarf</span>
            <span class="text-lg font-bold text-color">
              {{ toEur(pv.plannedNeedMinor) | currency:'EUR':'symbol':'1.0-0' }}
            </span>
          </div>
        </div>

        <!-- Member Due -->
        <div class="flex flex-col gap-2 mb-4">
          @for (member of pv.memberDuePreview; track member.memberId) {
            <div>
              <div class="flex justify-between items-center py-1">
                <span class="text-sm font-medium text-color">{{ member.memberName }}</span>
                <span class="text-sm font-semibold text-color">
                  Soll: {{ toEur(member.dueMinor) | currency:'EUR':'symbol':'1.0-0' }}
                </span>
              </div>

              <!-- Breakdown Toggle -->
              @if (member.breakdown.length > 0) {
                <button
                  type="button"
                  class="text-xs text-primary hover:underline"
                  (click)="toggleBreakdown(member.memberId)">
                  @if (isBreakdownOpen(member.memberId)) { Detail ausblenden }
                  @else { Detail anzeigen }
                </button>
                @if (isBreakdownOpen(member.memberId)) {
                  <div class="mt-1 pl-3 border-l border-surface flex flex-col gap-1">
                    @for (b of member.breakdown; track b.blockId) {
                      <div class="flex justify-between text-xs text-muted-color">
                        <span>{{ b.title }}</span>
                        <span>{{ toEur(b.amountMinor) | currency:'EUR':'symbol':'1.0-0' }}</span>
                      </div>
                    }
                  </div>
                }
              }
            </div>
          }
        </div>

        <p-message
          severity="info"
          text="Dies ist kein Ersatz für die Monat-Ansicht. Die tatsächlichen Buchungen sind dort ersichtlich." />
      </div>
    }
  `,
})
export class PlanningPreviewCardComponent {
  protected readonly preview = select(PlanningPageSelectors.preview);
  private readonly openBreakdowns = signal<Set<string>>(new Set());

  protected toEur(minor: number): number {
    return minor / 100;
  }

  protected toggleBreakdown(memberId: string): void {
    this.openBreakdowns.update(set => {
      const next = new Set(set);
      next.has(memberId) ? next.delete(memberId) : next.add(memberId);
      return next;
    });
  }

  protected isBreakdownOpen(memberId: string): boolean {
    return this.openBreakdowns().has(memberId);
  }
}
