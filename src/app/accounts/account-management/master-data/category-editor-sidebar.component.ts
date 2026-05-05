import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Store, select } from '@ngxs/store';
import { form, FormField, required, minLength, maxLength } from '@angular/forms/signals';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageModule } from 'primeng/message';
import { FluidModule } from 'primeng/fluid';
import { MasterDataPageState } from './state/master-data-page.state';
import {
  CloseMasterDataSidebar,
  CreateCategory,
  UpdateCategory,
} from './state/master-data-page.actions';
import { CreateCategoryPayload, UpdateCategoryPayload } from './account-master-data.models';
import { CustomSplitEditorComponent, SplitRow } from './custom-split-editor.component';

interface CategoryFormModel {
  name: string;
}

@Component({
  selector: 'tbf-category-editor-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DrawerModule,
    ButtonModule,
    InputTextModule,
    ToggleSwitchModule,
    MessageModule,
    FluidModule,
    FormField,
    CustomSplitEditorComponent,
  ],
  template: `
    <p-drawer
      [visible]="isOpen()"
      [header]="isCreate() ? 'Kategorie hinzufügen' : 'Kategorie bearbeiten'"
      position="right"
      styleClass="!w-full md:!w-[480px]"
      (onHide)="close()">

      <form (ngSubmit)="save()" class="flex flex-col gap-5 h-full">

        @if (saveError()) {
          <p-message severity="error" [text]="saveError()!" styleClass="w-full" />
        }

        <p-fluid>
          <div class="flex flex-col gap-4">

            <!-- Name -->
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-color" for="cat-name">Name *</label>
              <input
                id="cat-name"
                pInputText
                [formField]="categoryForm.name"
                placeholder="Kategoriename"
                class="w-full" />
              @if (categoryForm.name().touched() && categoryForm.name().invalid()) {
                <span class="text-xs text-red-500">{{ categoryForm.name().errors()[0]?.message }}</span>
              }
            </div>

            <!-- Custom Split Toggle -->
            <div class="flex items-center justify-between py-2">
              <div class="flex flex-col gap-0.5">
                <label class="text-sm font-medium text-color" for="cat-split-toggle">Eigene Verteilung</label>
                <span class="text-xs text-muted-color">Abweichende Aufteilung nur für diese Kategorie</span>
              </div>
              <p-toggleswitch
                inputId="cat-split-toggle"
                [checked]="hasCustomSplit()"
                (onChange)="onToggle($event.checked)" />
            </div>

            <!-- Custom Split Editor -->
            @if (hasCustomSplit()) {
              <tbf-custom-split-editor
                [members]="members()"
                [value]="splitRows()"
                (valueChange)="onSplitRowsChange($event)" />
              @if (splitSum() !== 100) {
                <span class="text-xs text-red-500">
                  Splits müssen 100 % ergeben (aktuell {{ splitSum() }} %)
                </span>
              }
            }

            <!-- Edit-Mode: usage hints + budget status -->
            @if (!isCreate() && currentCategory()) {
              @if (currentCategory()!.usageHints.length > 0) {
                <div class="flex flex-col gap-1">
                  <span class="text-xs font-medium text-muted-color uppercase tracking-wide">Verwendung</span>
                  <ul class="text-xs text-muted-color list-disc list-inside space-y-0.5">
                    @for (hint of currentCategory()!.usageHints; track $index) {
                      <li>{{ hint }}</li>
                    }
                  </ul>
                </div>
              }
              <div class="flex items-center gap-2 text-xs text-muted-color">
                <i class="pi pi-tag text-xs"></i>
                <span>{{ currentCategory()!.hasBudget ? 'Budget vorhanden' : 'Kein Budget' }}</span>
              </div>
            }

          </div>
        </p-fluid>

        <div class="mt-auto flex gap-3 pt-4 border-t border-surface-200 dark:border-surface-700">
          <p-button
            type="submit"
            [label]="isCreate() ? 'Hinzufügen' : 'Speichern'"
            icon="pi pi-check"
            [disabled]="!canSave()"
            [loading]="saving()" />
          <p-button
            type="button"
            label="Abbrechen"
            severity="secondary"
            [text]="true"
            (onClick)="close()" />
        </div>

      </form>
    </p-drawer>
  `,
})
export class CategoryEditorSidebarComponent {
  private readonly store = inject(Store);

  protected readonly editor = select(MasterDataPageState.editor);
  protected readonly categories = select(MasterDataPageState.categories);
  protected readonly members = select(MasterDataPageState.members);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly isOpen = computed(() => this.editor()?.kind === 'category');
  protected readonly isCreate = computed(
    () => this.editor()?.kind === 'category' && this.editor()!.mode === 'create',
  );
  protected readonly currentCategory = computed(() => {
    const ed = this.editor();
    if (ed?.kind !== 'category' || !ed.categoryId) return null;
    return (
      this.categories().find(
        c =>
          c.categoryId ===
          (ed as { kind: 'category'; mode: 'create' | 'edit'; categoryId?: string }).categoryId,
      ) ?? null
    );
  });

  protected readonly hasCustomSplit = signal(false);
  protected readonly splitRows = signal<SplitRow[]>([]);
  protected readonly splitSum = computed(() =>
    this.splitRows().reduce((acc, r) => acc + r.split, 0),
  );

  private readonly formModel = signal<CategoryFormModel>({ name: '' });
  protected readonly categoryForm = form(this.formModel, p => {
    required(p.name, { message: 'Name ist erforderlich' });
    minLength(p.name, 2, { message: 'Mind. 2 Zeichen' });
    maxLength(p.name, 64, { message: 'Max. 64 Zeichen' });
  });

  protected readonly canSave = computed(() => {
    const formInvalid = this.categoryForm().invalid();
    const splitValid = !this.hasCustomSplit() || this.splitSum() === 100;
    return !formInvalid && splitValid;
  });

  constructor() {
    effect(
      () => {
        const cat = this.currentCategory();
        if (cat) {
          this.formModel.set({ name: cat.name ?? '' });
          this.hasCustomSplit.set(cat.hasCustomSplit);
          if (cat.hasCustomSplit) {
            const members = this.members();
            this.splitRows.set(
              cat.customSplit.map(s => ({
                memberId: s.memberId,
                name: members.find(m => m.memberId === s.memberId)?.name ?? 'Unbenanntes Mitglied',
                split: s.split,
              })),
            );
          } else {
            this.splitRows.set([]);
          }
          this.saveError.set(null);
        } else if (this.isCreate() && this.isOpen()) {
          this.formModel.set({ name: '' });
          this.hasCustomSplit.set(false);
          this.splitRows.set([]);
          this.saveError.set(null);
        }
      },
      { allowSignalWrites: true },
    );
  }

  protected onToggle(enabled: boolean): void {
    this.hasCustomSplit.set(enabled);
    if (enabled) {
      const members = this.members();
      this.splitRows.set(
        members.map(m => ({
          memberId: m.memberId,
          name: m.name ?? 'Unbenanntes Mitglied',
          split: this.splitRows().find(r => r.memberId === m.memberId)?.split ?? 0,
        })),
      );
    } else {
      this.splitRows.set([]);
    }
  }

  protected onSplitRowsChange(rows: SplitRow[]): void {
    this.splitRows.set(rows);
  }

  protected close(): void {
    this.store.dispatch(new CloseMasterDataSidebar());
  }

  protected save(): void {
    if (!this.canSave()) return;
    this.saving.set(true);
    this.saveError.set(null);

    const name = this.formModel().name;
    const customSplit = this.hasCustomSplit()
      ? this.splitRows().map(({ memberId, split }) => ({ memberId, split }))
      : [];

    if (this.isCreate()) {
      const payload: CreateCategoryPayload = { name, customSplit };
      this.store.dispatch(new CreateCategory(payload)).subscribe({
        error: (err: unknown) => {
          this.saving.set(false);
          const msg = (err as { error?: { message?: string } })?.error?.message;
          this.saveError.set(msg ?? 'Fehler beim Erstellen der Kategorie');
        },
        complete: () => this.saving.set(false),
      });
    } else {
      const ed = this.editor() as {
        kind: 'category';
        mode: 'create' | 'edit';
        categoryId?: string;
      };
      const categoryId = ed.categoryId!;
      const payload: UpdateCategoryPayload = { name, customSplit };
      this.store.dispatch(new UpdateCategory(categoryId, payload)).subscribe({
        error: (err: unknown) => {
          this.saving.set(false);
          const msg = (err as { error?: { message?: string } })?.error?.message;
          this.saveError.set(msg ?? 'Fehler beim Speichern der Kategorie');
        },
        complete: () => this.saving.set(false),
      });
    }
  }
}

