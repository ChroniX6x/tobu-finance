import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Store, select } from '@ngxs/store';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { AccountMasterSectionComponent } from './account-master-section.component';
import { MemberMasterSectionComponent } from './member-master-section.component';
import { CategoryMasterSectionComponent } from './category-master-section.component';
import { MasterDataPageState } from './state/master-data-page.state';
import { LoadMasterData, ReloadMasterData } from './state/master-data-page.actions';

@Component({
  selector: 'tbf-master-data-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AccountMasterSectionComponent,
    MemberMasterSectionComponent,
    CategoryMasterSectionComponent,
    ButtonModule,
    MessageModule,
  ],
  templateUrl: './master-data-page.component.html',
  styleUrls: ['./master-data-page.component.scss'],
})
export class MasterDataPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(Store);

  protected readonly loading = select(MasterDataPageState.loading);
  protected readonly error = select(MasterDataPageState.error);
  protected readonly vm = select(MasterDataPageState.vm);

  constructor() {
    // accountId lives on the grandparent :accountId route, not on this leaf route.
    // pathFromRoot merges params from all ancestor routes to find it safely.
    const accountId = this.route.snapshot.pathFromRoot
      .map(r => r.params['accountId'])
      .find(id => !!id);

    if (accountId) {
      this.store.dispatch(new LoadMasterData(accountId));
    }
  }

  protected retry(): void {
    this.store.dispatch(new ReloadMasterData());
  }

  protected scrollToSection(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
