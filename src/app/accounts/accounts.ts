import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { select, Store } from '@ngxs/store';
import { AccountsSummaryState, LoadAccountsSummary } from './state/accounts-summary.state';
import { DashboardAccountModel } from './domain/dashboard-account.model';
import { AccountChartData, AccountChartService } from './services/account-chart.service';
import { AccountChartCard } from './components/account-chart-card/account-chart-card';

export interface AccountCardVm extends DashboardAccountModel, AccountChartData {
  /** Balance converted to major currency units (EUR). */
  currentBalance: number;
}

@Component({
  selector: 'tbf-accounts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DecimalPipe, AccountChartCard],
  templateUrl: './accounts.html',
  styleUrls: ['./accounts.scss'],
})
export class Accounts implements OnInit {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly chartService = inject(AccountChartService);

  protected readonly loading = select(AccountsSummaryState.loading);
  private readonly accounts = select(AccountsSummaryState.accounts);

  protected readonly accountCards = computed<AccountCardVm[]>(() =>
    this.accounts().map((acc: DashboardAccountModel) => ({
      ...acc,
      ...this.chartService.buildChartData(acc),
      currentBalance: acc.currentBalanceMinor / 100,
    }))
  );

  ngOnInit(): void {
    this.store.dispatch(new LoadAccountsSummary({ months: 6 }));
  }

  protected goToAccount(id: string): void {
    this.router.navigate(['/accounts', id]);
  }

  protected goToWizard(): void {
    this.router.navigate(['/wizard']);
  }
}
