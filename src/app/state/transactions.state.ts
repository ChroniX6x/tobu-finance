import { State, Selector, Action, StateContext } from '@ngxs/store';
import { Injectable } from '@angular/core';
import { tap } from 'rxjs/operators';
import { ExpenseModel } from '@/domain/expense.model';
import { ExpensesDataService } from '@/domain/expenses-data.service';

export class LoadTransactions {
  static readonly type = '[Transactions] Load';
  constructor(public accountId: string) {}
}

@State<ExpenseModel[]>({
  name: 'expenses',
  defaults: [],
})
@Injectable()
export class TransactionsState {
  constructor(private expensesService: ExpensesDataService) {}

  @Selector()
  static expenses(state: ExpenseModel[]) {
    return state;
  }

  @Action(LoadTransactions)
  loadExpenses(ctx: StateContext<ExpenseModel[]>, { accountId }: LoadTransactions) {
    return this.expensesService.getExpensesForAccountId(accountId).pipe(
      tap((expenses) => {
        ctx.setState(expenses);
      })
    );
  }
}
