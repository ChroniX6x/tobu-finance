import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'tbf-special-blocks-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="text-muted-color text-sm">
      Sonderbausteine-Sektion — wird in Baustein 6 implementiert.
    </div>
  `,
})
export class SpecialBlocksSectionComponent {}
