import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { select } from '@ngxs/store';
import { TagModule } from 'primeng/tag';
import { PlanningPageSelectors } from './state/planning.selectors';
import { PlanningHintsComponent } from './planning-hints.component';

@Component({
  selector: 'tbf-planning-overview-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, TagModule, PlanningHintsComponent],
  template: `
    <h2 class="text-lg font-semibold text-color mb-4">Überblick</h2>

    @if (overview(); as ov) {

      <!-- KPI-Karten -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

        <div class="flex flex-col gap-1 rounded-xl p-4 bg-surface-card border border-surface">
          <span class="text-xs text-muted-color uppercase tracking-wide">Aktive Budgets</span>
          <span class="text-2xl font-bold text-color">
            {{ toEur(ov.activeBudgetSumMinor) | currency:'EUR':'symbol':'1.0-0' }}
          </span>
          <span class="text-xs text-muted-color">{{ ov.activeBudgetCount }} Budget(s)</span>
        </div>

        <div class="flex flex-col gap-1 rounded-xl p-4 bg-surface-card border border-surface">
          <span class="text-xs text-muted-color uppercase tracking-wide">Beitragsbausteine</span>
          <span class="text-2xl font-bold text-color">{{ ov.activeContributionBlockCount }}</span>
          <span class="text-xs text-muted-color">aktiv im Referenzmonat</span>
        </div>

        <div class="flex flex-col gap-1 rounded-xl p-4 bg-surface-card border border-surface">
          <span class="text-xs text-muted-color uppercase tracking-wide">ProRata-Status</span>
          <div class="mt-1">
            @switch (ov.proRataStatus) {
              @case ('complete') {
                <p-tag severity="success" value="Vollständig" />
              }
              @case ('incomplete') {
                <p-tag severity="warn" value="Unvollständig" />
              }
              @default {
                <p-tag severity="secondary" value="Nicht aktiv" />
              }
            }
          </div>
        </div>

        <div class="flex flex-col gap-1 rounded-xl p-4 bg-surface-card border border-surface">
          <span class="text-xs text-muted-color uppercase tracking-wide">Planungs-Hinweise</span>
          @if (ov.hintCount > 0) {
            <span class="text-2xl font-bold text-color">{{ ov.hintCount }}</span>
            <span class="text-xs text-muted-color">Hinweis(e) vorhanden</span>
          } @else {
            <span class="text-2xl font-bold text-color">—</span>
            <span class="text-xs text-muted-color">Keine Hinweise</span>
          }
        </div>

      </div>

      <!-- Hints -->
      <tbf-planning-hints />

    }
  `,
})
export class PlanningOverviewSectionComponent {
  protected readonly overview = select(PlanningPageSelectors.overview);

  protected toEur(minor: number): number {
    return minor / 100;
  }
}
