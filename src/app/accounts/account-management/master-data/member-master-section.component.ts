import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'tbf-member-master-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-4">
      <h2 class="text-lg font-semibold text-color">Mitglieder</h2>
      <p class="text-sm text-muted-color mt-0.5">Personen, die diesem Account zugeordnet sind.</p>
    </header>
    <p class="text-sm text-muted-color italic">Wird in Baustein 4 implementiert.</p>
  `,
})
export class MemberMasterSectionComponent {}
