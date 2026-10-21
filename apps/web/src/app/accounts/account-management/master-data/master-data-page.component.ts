import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Store, select } from '@ngxs/store';
import { BreakpointObserver } from '@angular/cdk/layout';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AccordionModule } from 'primeng/accordion';
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
    AccordionModule,
    ButtonModule,
    MessageModule,
  ],
  templateUrl: './master-data-page.component.html',
  styleUrls: ['./master-data-page.component.scss'],
})
export class MasterDataPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(Store);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private sectionObserver?: IntersectionObserver;

  protected readonly loading = select(MasterDataPageState.loading);
  protected readonly error = select(MasterDataPageState.error);
  protected readonly vm = select(MasterDataPageState.vm);
  protected readonly isMobile = signal(false);
  protected readonly activeSection = signal<'account' | 'members' | 'categories'>('account');
  protected readonly currentAccountId = signal<string | null>(null);

  constructor() {
    // accountId lives on the grandparent :accountId route, not on this leaf route.
    const accountId = this.route.snapshot.pathFromRoot
      .map(r => r.params['accountId'])
      .find(id => !!id);

    if (accountId) {
      this.currentAccountId.set(accountId);
      this.store.dispatch(new LoadMasterData(accountId));
    }

    // Mobile breakpoint detection
    this.breakpointObserver
      .observe('(max-width: 767px)')
      .pipe(takeUntilDestroyed())
      .subscribe(state => this.isMobile.set(state.matches));

    // Setup IntersectionObserver for active-section tracking on desktop
    effect(() => {
      const hasVm = !!this.vm();
      const mobile = this.isMobile();
      if (hasVm && !mobile) {
        setTimeout(() => this.setupSectionObserver(), 50);
      } else {
        this.sectionObserver?.disconnect();
      }
    });

    // Cleanup on destroy
    inject(DestroyRef).onDestroy(() => this.sectionObserver?.disconnect());
  }

  protected retry(): void {
    this.store.dispatch(new ReloadMasterData());
  }

  protected scrollToSection(section: 'account' | 'members' | 'categories'): void {
    this.activeSection.set(section);
    const idMap: Record<string, string> = {
      account: 'account-section',
      members: 'members-section',
      categories: 'categories-section',
    };
    document.getElementById(idMap[section])?.scrollIntoView({ behavior: 'smooth' });
  }

  private setupSectionObserver(): void {
    this.sectionObserver?.disconnect();
    this.sectionObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            if (id === 'account-section') this.activeSection.set('account');
            else if (id === 'members-section') this.activeSection.set('members');
            else if (id === 'categories-section') this.activeSection.set('categories');
          }
        });
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 },
    );
    ['account-section', 'members-section', 'categories-section'].forEach(id => {
      const el = document.getElementById(id);
      if (el) this.sectionObserver!.observe(el);
    });
  }
}
