import { State, Selector, Action, StateContext } from '@ngxs/store';
import { Injectable, inject } from '@angular/core';
import { DashboardAccountModel } from '@/accounts/domain/dashboard-account.model';
import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { AccountsSummaryDataService } from '@/accounts/domain/accounts-summary-data.service';

// Actions
export class LoadAccountsSummary {
  static readonly type = '[AccountsSummary] Load';
  constructor(public opts?: { months?: number }) {}
}

// Model
export interface AccountsSummaryStateModel {
  accounts: DashboardAccountModel[]; // amounts in MINOR units
  loading: boolean;
  error: string | null;
}

@State<AccountsSummaryStateModel>({
  name: 'accountsSummary',
  defaults: {
    accounts: [],
    loading: false,
    error: null
  }
})
@Injectable()
export class AccountsSummaryState {
  private svc = inject(AccountsSummaryDataService);

  // Selectors
  @Selector() static accounts(s: AccountsSummaryStateModel) { return s.accounts; }
  @Selector() static loading(s: AccountsSummaryStateModel)  { return s.loading; }
  @Selector() static error(s: AccountsSummaryStateModel)    { return s.error;   }

  // Actions
  @Action(LoadAccountsSummary)
  loadAccounts(ctx: StateContext<AccountsSummaryStateModel>, { opts }: LoadAccountsSummary) {
    ctx.patchState({ loading: true, error: null });

    return this.svc.getAccountsSummary(opts).pipe(
      tap(accounts => ctx.patchState({ accounts, loading: false })),
      catchError(err => {
        ctx.patchState({ error: err?.message ?? 'Load failed', loading: false });
        return of(null);
      })
    );
  }
}
