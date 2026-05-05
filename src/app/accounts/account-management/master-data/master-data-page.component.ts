import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AccountMasterSectionComponent } from './account-master-section.component';
import { MemberMasterSectionComponent } from './member-master-section.component';
import { CategoryMasterSectionComponent } from './category-master-section.component';

@Component({
  selector: 'tbf-master-data-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AccountMasterSectionComponent,
    MemberMasterSectionComponent,
    CategoryMasterSectionComponent,
  ],
  templateUrl: './master-data-page.component.html',
  styleUrls: ['./master-data-page.component.scss'],
})
export class MasterDataPageComponent {
  protected scrollToSection(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
