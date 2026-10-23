import { State, Selector, Action, StateContext } from '@ngxs/store';
import { Injectable, inject } from '@angular/core';
import { tap, catchError } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { MonthViewUi } from '@/accounts/domain/month-view.ui-model';
import { MonthViewDataService } from '@/accounts/domain/month-view-data.service';
import { LoadMonthView, SetMonthViewMonth } from './month-view.actions';

export interface MonthViewStateModel {
  data: MonthViewUi | null;
  loading: boolean;
  error: string | null;
  /** Currently selected month YYYY-MM; null = not yet determined */
  selectedMonth: string | null;
}

@State<MonthViewStateModel>({
  name: 'monthView',
  defaults: {
    data: null,
    loading: false,
    error: null,
    selectedMonth: null,
  },
})
@Injectable()
export class MonthViewState {
  private svc = inject(MonthViewDataService);

  @Selector() static data(s: MonthViewStateModel) { return s.data; }
  @Selector() static loading(s: MonthViewStateModel) { return s.loading; }
  @Selector() static error(s: MonthViewStateModel) { return s.error; }
  @Selector() static selectedMonth(s: MonthViewStateModel) { return s.selectedMonth; }
  @Selector() static kpis(s: MonthViewStateModel) { return s.data?.kpis ?? null; }
  @Selector() static members(s: MonthViewStateModel) { return s.data?.members ?? []; }
  @Selector() static categories(s: MonthViewStateModel) { return s.data?.categories ?? []; }
  @Selector() static contributionBreakdown(s: MonthViewStateModel) {
    return s.data?.contributionBreakdown ?? [];
  }
  @Selector() static memberIncomes(s: MonthViewStateModel) {
    return s.data?.memberIncomes ?? [];
  }
  @Selector() static carryovers(s: MonthViewStateModel) { return s.data?.carryovers ?? []; }
  @Selector() static categoryHistory(s: MonthViewStateModel) { return s.data?.categoryHistory ?? []; }

  @Action(SetMonthViewMonth)
  setMonth(ctx: StateContext<MonthViewStateModel>, { month }: SetMonthViewMonth) {
    ctx.patchState({ selectedMonth: month });
  }

  /**
   * cancelUncompleted: true ensures NGXS cancels in-flight requests
   * when a new LoadMonthView arrives (rapid month switching).
   */
  @Action(LoadMonthView, { cancelUncompleted: true })
  load(ctx: StateContext<MonthViewStateModel>, { accountId, month }: LoadMonthView) {
    ctx.patchState({ loading: true, error: null, selectedMonth: month });

    return this.svc.getMonthView(accountId, month).pipe(
      tap((data) => ctx.patchState({ data, loading: false })),
      catchError((err) => {
        ctx.patchState({ error: err?.message ?? 'Fehler beim Laden', loading: false });
        return EMPTY;
      }),
    );
  }
}
