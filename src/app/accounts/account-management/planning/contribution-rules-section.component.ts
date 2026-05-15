import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'tbf-contribution-rules-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="text-muted-color text-sm">
      Beitragsregeln-Sektion — wird in Baustein 6 implementiert.
    </div>
  `,
})
export class ContributionRulesSectionComponent {}
