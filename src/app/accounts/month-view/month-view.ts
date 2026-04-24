import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'tbf-month-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="p-8 text-center text-muted-color">Monatsansicht wird geladen …</div>`,
})
export class MonthView {}
