// src/app/state/dashboard.state.ts
import { State, Action, StateContext, Selector } from '@ngxs/store';
import { Injectable } from '@angular/core';
import { tap } from 'rxjs';
import { DashboardAccountModel } from '../domain/dashboard-account.model';
import { AccountDataService } from './account-data.service';

export class LoadDashboardAccounts {
  static readonly type = '[Dashboard] Load Accounts';
}

export interface DashboardStateModel {
  accounts: DashboardAccountModel[];
  loading: boolean;
}

@State<DashboardStateModel>({
  name: 'dashboard',
  defaults: {
    accounts: [],
    loading: false
  }
})
@Injectable()
export class DashboardState {
  constructor(private accountService: AccountDataService) {}

  @Selector()
  static accounts(state: DashboardStateModel) {
    return state.accounts;
  }

  @Selector()
  static loading(state: DashboardStateModel) {
    return state.loading;
  }

  @Action(LoadDashboardAccounts)
  loadAccounts(ctx: StateContext<DashboardStateModel>) {
    ctx.patchState({ loading: true });
    return this.accountService.getDashboardAccounts().pipe(
      tap(accounts => {
        ctx.patchState({ accounts, loading: false });
      })
    );
  }
}
