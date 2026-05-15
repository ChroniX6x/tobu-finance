import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'tbf-planning-overview-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="text-muted-color text-sm">
      Überblick-Sektion — wird in Baustein 3 implementiert.
    </div>
  `,
})
export class PlanningOverviewSectionComponent {}
