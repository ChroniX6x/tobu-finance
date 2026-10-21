import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Store, select } from '@ngxs/store';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { PlanningPageSelectors } from './state/planning.selectors';
import { OpenBudgetSidebar } from './state/planning.actions';

@Component({
  selector: 'tbf-budget-planning-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, TagModule, ButtonModule, TooltipModule],
  template: `
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-color">Budgets</h2>
      <p-button
        label="Budget hinzufügen"
        icon="pi pi-plus"
        size="small"
        severity="secondary"
        (onClick)="openCreate()" />
    </div>

    @if (allBudgets().length === 0) {
      <!-- Empty State -->
      <div class="flex flex-col items-center gap-3 py-12 text-center">
        <i class="pi pi-wallet text-4xl text-muted-color"></i>
        <p class="text-muted-color text-sm">Noch keine Budgets eingerichtet.</p>
        <p class="text-muted-color text-xs">Budgets bilden die Grundlage für deinen geplanten Monatsbedarf.</p>
      </div>
    } @else {
      <div class="flex flex-col gap-3">
        @for (budget of allBudgets(); track budget.budgetId) {
          <div class="rounded-xl border border-surface bg-surface-card p-4">
            <div class="flex items-start justify-between gap-4">

              <div class="flex flex-col gap-1 min-w-0">
                <span class="font-medium text-color truncate">{{ budget.categoryName }}</span>
                <span class="text-2xl font-bold text-color">
                  {{ toEur(budget.amountMinor) | currency:'EUR':'symbol':'1.0-0' }}
                </span>
                <span class="text-xs text-muted-color">
                  {{ budget.fromMonth !== 'open' ? 'ab ' + budget.fromMonth : '(offen)' }}
                  @if (budget.toMonth) { bis {{ budget.toMonth }} }
                  @else { – (offen) }
                </span>
                @if (budget.hasOverlapConflict) {
                  <span class="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1 mt-1">
                    <i class="pi pi-exclamation-triangle"></i> Zeitraum-Überschneidung
                  </span>
                }
              </div>

              <div class="flex flex-col items-end gap-2 shrink-0">
                @if (budget.isActiveInReferenceMonth) {
                  <p-tag severity="success" value="Aktiv" />
                } @else {
                  <p-tag severity="secondary" value="Inaktiv" />
                }
                <p-button
                  icon="pi pi-pencil"
                  [text]="true"
                  size="small"
                  severity="secondary"
                  pTooltip="Bearbeiten"
                  (onClick)="openEdit(budget.budgetId)" />
              </div>

            </div>
          </div>
        }
      </div>
    }
  `,
})
export class BudgetPlanningSectionComponent {
  private readonly store = inject(Store);
  protected readonly allBudgets = select(PlanningPageSelectors.allBudgets);

  protected openCreate(): void {
    this.store.dispatch(new OpenBudgetSidebar('create'));
  }

  protected openEdit(budgetId: string): void {
    this.store.dispatch(new OpenBudgetSidebar('edit', budgetId));
  }

  protected toEur(minor: number): number {
    return minor / 100;
  }
}
