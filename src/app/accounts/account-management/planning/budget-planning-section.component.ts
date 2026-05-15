import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'tbf-budget-planning-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="text-muted-color text-sm">
      Budgets-Sektion — wird in Baustein 4 implementiert.
    </div>
  `,
})
export class BudgetPlanningSectionComponent {}
