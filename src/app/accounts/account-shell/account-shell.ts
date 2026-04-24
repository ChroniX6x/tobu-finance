import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterOutlet, ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { filter, map, startWith, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TabsModule } from 'primeng/tabs';
import { Store } from '@ngxs/store';
import { LoadAccountOverview } from '../state/account-overview.actions';

@Component({
  selector: 'tbf-account-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, TabsModule],
  templateUrl: './account-shell.html',
  styleUrls: ['./account-shell.scss'],
})
export class AccountShell {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(Store);

  protected readonly accountId = signal<string>('');
  protected readonly activeTab = signal<string>('overview');

  constructor() {
    this.route.params.pipe(
      map(p => p['accountId'] as string),
      distinctUntilChanged(),
      takeUntilDestroyed()
    ).subscribe(id => {
      this.accountId.set(id ?? '');
      if (id) this.store.dispatch(new LoadAccountOverview(id));
    });

    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      startWith(null),
      takeUntilDestroyed()
    ).subscribe(() => {
      const url = this.router.url;
      if (url.includes('/transactions')) this.activeTab.set('transactions');
      else if (url.includes('/month')) this.activeTab.set('month');
      else this.activeTab.set('overview');
    });
  }

  protected navigateTab(value: string | number | undefined): void {
    if (value == null) return;
    const accId = this.accountId();
    if (value === 'transactions') this.router.navigate(['/accounts', accId, 'transactions']);
    else if (value === 'month') this.router.navigate(['/accounts', accId, 'month']);
    else this.router.navigate(['/accounts', accId]);
  }
}
