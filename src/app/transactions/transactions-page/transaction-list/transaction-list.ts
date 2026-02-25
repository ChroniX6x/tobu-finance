import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Store, select } from '@ngxs/store';
import * as _ from 'lodash';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ProgressBarModule } from 'primeng/progressbar';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TransactionPageState } from '../../state/transaction-page.state';
import { TransactionCaptureState } from '../../state/transaction-capture.state';
import {
  DeleteTransactionConfirmed,
  DeleteTransactionOptimistic,
  SetPage,
  ToggleParentExpanded,
  UndoDeleteTransaction,
} from '../../state/transaction-page.actions';
import {
  AddDraft,
  SetCaptureMode,
  ToggleDock,
} from '../../state/transaction-capture.actions';
import { TransactionModel } from '../../domain/transaction.model';
import { SplitMeta } from '../../domain/transaction.model';
import { TransactionsApiService } from '../../domain/transactions-api.service';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'tbf-transaction-list',
  templateUrl: './transaction-list.html',
  styleUrl: './transaction-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ConfirmationService, MessageService],
  imports: [
    TableModule,
    ButtonModule,
    BadgeModule,
    TagModule,
    TooltipModule,
    ConfirmDialogModule,
    ProgressBarModule,
    ToastModule,
  ],
})
export class TransactionList {
  readonly accountId = input.required<string>();
  readonly selectedId = input<string | null>(null);
  readonly transactionSelected = output<string | null>();

  private store = inject(Store);
  private api = inject(TransactionsApiService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  protected parents = select(TransactionPageState.parents);
  protected entities = select(TransactionPageState.entities);
  protected loading = select(TransactionPageState.loading);
  protected error = select(TransactionPageState.error);
  protected expandedParents = select(TransactionPageState.expandedParents);
  protected splitMetaMap = select(TransactionPageState.splitMetaMap);
  protected childrenByParentId = select(TransactionPageState.childrenByParentId);
  protected total = select(TransactionPageState.total);
  protected filters = select(TransactionPageState.filters);

  protected expandedRows = signal<Record<string, boolean>>({});

  protected isExpanded(parentId: string): boolean {
    return this.expandedParents().includes(parentId);
  }

  protected getSplitMeta(parentId: string): SplitMeta | null {
    return this.splitMetaMap()[parentId] ?? null;
  }

  protected getChildren(parentId: string): TransactionModel[] {
    return this.childrenByParentId()[parentId] ?? [];
  }

  protected isContainerOnly(parentId: string): boolean {
    const meta = this.getSplitMeta(parentId);
    return !!meta && meta.restMinor === 0;
  }

  protected formatAmount(minor: number): string {
    return (minor / 100).toFixed(2);
  }

  protected toggleExpand(parentId: string): void {
    this.store.dispatch(new ToggleParentExpanded(parentId));
    // Sync to p-table
    this.expandedRows.update((rows) => ({
      ...rows,
      [parentId]: !rows[parentId],
    }));
  }

  protected selectRow(tx: TransactionModel): void {
    this.transactionSelected.emit(tx._id);
  }

  protected deleteTransaction(tx: TransactionModel, event: Event): void {
    event.stopPropagation();

    const children = this.getChildren(tx._id);
    const hasChildren = children.length > 0;

    if (hasChildren) {
      this.confirmationService.confirm({
        target: event.target as EventTarget,
        message: `Parent + ${children.length} Teiltransaktion${children.length > 1 ? 'en' : ''} löschen?`,
        header: 'Buchung löschen',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Löschen',
        rejectLabel: 'Abbrechen',
        acceptButtonStyleClass: 'p-button-danger',
        accept: () => this.deleteParentWithChildren(tx),
      });
    } else {
      // Optimistic delete + undo toast
      this.store.dispatch(new DeleteTransactionOptimistic(tx._id));
      this.messageService.add({
        severity: 'info',
        summary: 'Gelöscht',
        detail: `„${tx.title}" wurde gelöscht.`,
        life: 5000,
        sticky: false,
        data: { undoId: tx._id },
      });
    }
  }

  private deleteParentWithChildren(tx: TransactionModel): void {
    this.api.deleteTransaction(tx._id).pipe(
      catchError((err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Fehler',
          detail: err?.message ?? 'Löschen fehlgeschlagen',
        });
        return of(null);
      })
    ).subscribe((result) => {
      if (result !== null || result === undefined) {
        this.store.dispatch(new DeleteTransactionConfirmed(tx._id));
        this.messageService.add({
          severity: 'success',
          summary: 'Gelöscht',
          detail: `„${tx.title}" + ${this.getChildren(tx._id).length} Teile gelöscht.`,
        });
      }
    });
  }

  protected undoDelete(): void {
    this.store.dispatch(new UndoDeleteTransaction());
  }

  protected addSplit(parent: TransactionModel, event: Event): void {
    event.stopPropagation();
    this.store.dispatch([
      new SetCaptureMode('split'),
      new AddDraft({
        accountId: this.accountId(),
        parentTransactionId: parent._id,
        type: parent.type,
        isFromSharedAccount: parent.isFromSharedAccount,
        paidByMemberId: parent.paidByMemberId,
        bookDate: parent.bookDate,
      }),
      new ToggleDock(true),
    ]);
  }

  protected onPageChange(event: { first: number; rows: number }): void {
    const page = Math.floor(event.first / event.rows) + 1;
    this.store.dispatch(new SetPage(page));
  }
}
