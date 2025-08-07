import { State, Selector, Action, StateContext } from '@ngxs/store';
import { Injectable } from '@angular/core';
import { tap } from 'rxjs/operators';
import { TransactionModel } from '@/domain/transaction.model';
import { TransactionsDataService } from '@/domain/transactions-data.service';
import { Transaction } from 'mongodb';

export class LoadTransactions {
  static readonly type = '[Transactions] Load';
  constructor(public accountId: string) {}
}

export interface TransactionStateModel {
  transactions: TransactionModel[];
}

@State<TransactionStateModel>({
  name: 'expenses',
  defaults: { transactions: [] },
})
@Injectable()
export class TransactionsState {
  constructor(private service: TransactionsDataService) {}

  @Selector()
  static transactions(state: TransactionStateModel) {
    return state.transactions;
  }

  @Selector()
  static expenses(state: TransactionStateModel): TransactionModel[] {
    return state.transactions.filter(t => t.type === 'expense');
  }
  @Selector()
  static income(state: TransactionStateModel): TransactionModel[] {
    return state.transactions.filter(t => t.type === 'income');
  }

  @Action(LoadTransactions)
  loadExpenses(ctx: StateContext<TransactionStateModel>, { accountId }: LoadTransactions) {
    return this.service.getExpensesForAccountId(accountId).pipe(
      tap((transactions) => {
        ctx.setState({transactions});
      })
    );
  }
}
