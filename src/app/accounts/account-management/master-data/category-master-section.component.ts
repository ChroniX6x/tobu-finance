import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Store, select } from '@ngxs/store';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { MessageModule } from 'primeng/message';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { CategoryMasterItemVm, MasterDataMetaVm } from './account-master-data.models';
import { MasterDataPageState } from './state/master-data-page.state';
import { OpenCategorySidebar, DeleteCategory } from './state/master-data-page.actions';
import { CategoryEditorSidebarComponent } from './category-editor-sidebar.component';

@Component({
  selector: 'tbf-category-master-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ConfirmationService],
  imports: [
    ButtonModule,
    TooltipModule,
    MessageModule,
    ConfirmDialogModule,
    CategoryEditorSidebarComponent,
  ],
  template: `
    <p-confirmdialog />

    <header class="mb-5 flex items-start justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold text-color">Kategorien</h2>
        <p class="text-sm text-muted-color mt-0.5">Buchungskategorien dieses Accounts.</p>
      </div>
      <p-button
        label="Kategorie hinzufügen"
        icon="pi pi-plus"
        severity="secondary"
        [text]="true"
        size="small"
        (onClick)="openCreate()" />
    </header>

    <!-- Uncategorized transactions hint -->
    @if (meta().uncategorizedTransactionCount > 0) {
      <p-message
        severity="warn"
        styleClass="mb-4 w-full"
        [text]="'Nicht kategorisierte Buchungen: ' + meta().uncategorizedTransactionCount" />
    }

    <!-- Category list -->
    <div class="flex flex-col gap-2">
      @for (cat of categories(); track cat.categoryId) {
        <div class="p-4 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900">
          <div class="flex items-start justify-between gap-3">

            <!-- Left: info -->
            <div class="flex flex-col gap-1 min-w-0">
              <span class="font-medium text-color">
                {{ cat.name ?? 'Unbenannte Kategorie' }}
              </span>
              <span class="text-xs text-muted-color">
                {{ cat.customSplitLabel ?? 'Standard-Verteilung' }}
              </span>
              <div class="flex flex-wrap gap-3 text-xs text-muted-color mt-1">
                <span>{{ cat.transactionCount }} Buchung{{ cat.transactionCount === 1 ? '' : 'en' }}</span>
                @if (cat.hasBudget) {
                  <span class="text-green-600 dark:text-green-400">Budget vorhanden</span>
                } @else {
                  <span>Kein Budget</span>
                }
              </div>
              <!-- Usage hints when delete is blocked -->
              @if (!cat.canDelete && cat.usageHints.length > 0) {
                <ul class="mt-1 text-xs text-orange-600 dark:text-orange-400 list-disc list-inside space-y-0.5">
                  @for (hint of cat.usageHints; track $index) {
                    <li>{{ hint }}</li>
                  }
                </ul>
              }
            </div>

            <!-- Right: actions -->
            <div class="flex items-center gap-2 shrink-0">
              <p-button
                icon="pi pi-pencil"
                severity="secondary"
                [text]="true"
                size="small"
                pTooltip="Bearbeiten"
                aria-label="Kategorie bearbeiten"
                (onClick)="openEdit(cat.categoryId)" />
              <p-button
                icon="pi pi-trash"
                severity="danger"
                [text]="true"
                size="small"
                [disabled]="!cat.canDelete"
                [pTooltip]="cat.canDelete ? 'Kategorie löschen' : (cat.usageHints[0] || 'Löschen nicht möglich')"
                aria-label="Kategorie löschen"
                (onClick)="confirmDelete(cat)" />
            </div>

          </div>
        </div>
      }

      @if (categories().length === 0) {
        <p class="text-sm text-muted-color italic">
          Noch keine Kategorien vorhanden. Klicke auf „Kategorie hinzufügen", um loszulegen.
        </p>
      }
    </div>

    <!-- Category editor sidebar -->
    <tbf-category-editor-sidebar />
  `,
})
export class CategoryMasterSectionComponent {
  private readonly store = inject(Store);
  private readonly confirmationService = inject(ConfirmationService);

  readonly meta = input.required<MasterDataMetaVm>();

  protected readonly categories = select(MasterDataPageState.categories);

  protected openCreate(): void {
    this.store.dispatch(new OpenCategorySidebar('create'));
  }

  protected openEdit(categoryId: string): void {
    this.store.dispatch(new OpenCategorySidebar('edit', categoryId));
  }

  protected confirmDelete(cat: CategoryMasterItemVm): void {
    this.confirmationService.confirm({
      header: 'Kategorie löschen',
      message: `„${cat.name ?? 'Unbenannte Kategorie'}" wirklich löschen?`,
      accept: () => this.store.dispatch(new DeleteCategory(cat.categoryId)),
      acceptLabel: 'Löschen',
      rejectLabel: 'Abbrechen',
      acceptButtonProps: { severity: 'danger' },
    });
  }
}

