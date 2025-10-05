import { State, Selector, Action, StateContext } from '@ngxs/store';
import { Injectable, inject } from '@angular/core';
import { DashboardAccountModel } from '@/dashboard/domain/dashboard-account.model';
import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { DashboardDataService } from './account-data.service';

// Actions
export class LoadDashboardAccounts {
  static readonly type = '[Dashboard] Load Accounts';
  constructor(public opts?: { userId?: string; memberId?: string; months?: number }) {}
}

// Model
export interface DashboardStateModel {
  accounts: DashboardAccountModel[]; // amounts in MINOR units
  loading: boolean;
  error: string | null;
}

@State<DashboardStateModel>({
  name: 'dashboard',
  defaults: {
    accounts: [],
    loading: false,
    error: null
  }
})
@Injectable()
export class DashboardState {
  private svc = inject(DashboardDataService);

  // Selectors
  @Selector() static accounts(s: DashboardStateModel) { return s.accounts; }
  @Selector() static loading(s: DashboardStateModel)  { return s.loading; }
  @Selector() static error(s: DashboardStateModel)    { return s.error;   }

  // Actions
  @Action(LoadDashboardAccounts)
  loadAccounts(ctx: StateContext<DashboardStateModel>, { opts }: LoadDashboardAccounts) {
    ctx.patchState({ loading: true, error: null });

    return this.svc.getDashboardAccounts(opts).pipe(
      tap(accounts => ctx.patchState({ accounts, loading: false })),
      catchError(err => {
        ctx.patchState({ error: err?.message ?? 'Load failed', loading: false });
        return of(null);
      })
    );
  }
}
