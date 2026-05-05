import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'tbf-category-master-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-4">
      <h2 class="text-lg font-semibold text-color">Kategorien</h2>
      <p class="text-sm text-muted-color mt-0.5">Buchungskategorien dieses Accounts.</p>
    </header>
    <p class="text-sm text-muted-color italic">Wird in Baustein 5 implementiert.</p>
  `,
})
export class CategoryMasterSectionComponent {}
