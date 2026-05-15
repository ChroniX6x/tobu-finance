import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'tbf-income-planning-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="text-muted-color text-sm">
      Einkommen-Sektion — wird in Baustein 5 implementiert.
    </div>
  `,
})
export class IncomePlanningSectionComponent {}
