import { ChangeDetectionStrategy, Component, inject, signal, effect } from '@angular/core';
import { select, Store } from '@ngxs/store';
import { ActivatedRoute, Router } from '@angular/router';
import { SplitterModule } from 'primeng/splitter';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { TransactionPageState } from '../state/transaction-page.state';
import { TransactionCaptureState } from '../state/transaction-capture.state';
import { LoadTransactions, SelectTransaction } from '../state/transaction-page.actions';
import { ToggleDock } from '../state/transaction-capture.actions';
import { TransactionToolbar } from './toolbar/transaction-toolbar';
import { TransactionList } from './transaction-list/transaction-list';
import { TransactionDetailEditor } from './detail-editor/transaction-detail-editor';
import { TransactionsDock } from './capture-dock/transactions-dock';

@Component({
  selector: 'tbf-transactions-page',
  templateUrl: './transactions-page.html',
  styleUrl: './transactions-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, TabsModule, SplitterModule, TransactionToolbar, TransactionList, TransactionDetailEditor, TransactionsDock],
})
export class TransactionsPage {
  private store = inject(Store);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected accountId = signal<string>('');

  protected loading = select(TransactionPageState.loading);
  protected selectedId = select(TransactionPageState.selectedId);
  protected dockOpen = select(TransactionCaptureState.dockOpen);
  protected draftCount = select(TransactionCaptureState.draftCount);

  constructor() {
    effect(() => {
      const id = this.route.snapshot.params['accountId'];
      if (id) {
        this.accountId.set(id);
      }
    });
  }

  protected navigateTab(value: string | number): void {
    if (value === 'overview') {
      this.router.navigate(['/accounts', this.accountId]);
    }
  }

  protected onTransactionSelected(id: string | null): void {
    this.store.dispatch(new SelectTransaction(id));
  }

  protected toggleDock(): void {
    this.store.dispatch(new ToggleDock());
  }
}
