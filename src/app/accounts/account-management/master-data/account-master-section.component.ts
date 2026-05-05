import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'tbf-account-master-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-4">
      <h2 class="text-lg font-semibold text-color">Account</h2>
      <p class="text-sm text-muted-color mt-0.5">Account-Name und accountweite Einstellungen.</p>
    </header>
    <p class="text-sm text-muted-color italic">Wird in Baustein 3 implementiert.</p>
  `,
})
export class AccountMasterSectionComponent {}
