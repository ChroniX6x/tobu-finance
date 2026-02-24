import { Routes } from '@angular/router';
import { provideStates } from '@ngxs/store';
import { TransactionPageState } from '../state/transaction-page.state';
import { TransactionCaptureState } from '../state/transaction-capture.state';
import { createStateRouteInitializer } from '@/shared/state/route-initializer';
import { LoadTransactions } from '../state/transaction-page.actions';
import { LoadAccounts } from '@/shared/state/account.state';
import { LoadCategories } from '@/shared/state/categories.state';

export default [
  {
    path: '',
    loadComponent: () =>
      import('./transactions-page').then((m) => m.TransactionsPage),
    providers: [provideStates([TransactionPageState, TransactionCaptureState])],
    resolve: {
    //   accounts: createStateRouteInitializer((route) => new LoadAccounts(route.params['accountId'])),
    //   categories: createStateRouteInitializer((route) => new LoadCategories(route.params['accountId'])),
      transactions: createStateRouteInitializer((route) =>
        new LoadTransactions({ accountId: route.params['accountId'], page: 1 })
      ),
    },
  },
] as Routes;
