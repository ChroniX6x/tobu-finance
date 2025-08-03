import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { select, Store } from '@ngxs/store';
import { ChartModule } from 'primeng/chart';
import { DashboardState, LoadDashboardAccounts } from './state/dashboard-state';
import { DashboardAccountModel } from './domain/dashboard-account.model';

@Component({
  selector: 'tbf-dashboard',
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
  imports: [ ChartModule, CommonModule]
})
export class Dashboard {
  private store = inject(Store);

  // NGXS Signal-Selects statt Observable
  accounts = select(DashboardState.accounts);
  loading = select(DashboardState.loading);

  constructor(private router: Router) {}

  ngOnInit() {
    this.store.dispatch(new LoadDashboardAccounts());
  }

  goToWizard() {
    this.router.navigate(['/wizard']);
  }
}
