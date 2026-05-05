import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Store, select } from '@ngxs/store';
import { form, FormField, required, minLength, maxLength, validate } from '@angular/forms/signals';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MessageModule } from 'primeng/message';
import { FluidModule } from 'primeng/fluid';
import { MasterDataPageState } from './state/master-data-page.state';
import {
  CloseMasterDataSidebar,
  CreateMemberForAccount,
  UpdateMemberForAccount,
} from './state/master-data-page.actions';
import { CreateMemberPayload, UpdateMemberPayload } from './account-master-data.models';

interface MemberFormModel {
  name: string;
  email: string;
  role: 'owner' | 'member';
}

@Component({
  selector: 'tbf-member-editor-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DrawerModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    MessageModule,
    FluidModule,
    FormField,
  ],
  template: `
    <p-drawer
      [visible]="isOpen()"
      [header]="isCreate() ? 'Mitglied hinzufügen' : 'Mitglied bearbeiten'"
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
              <label class="text-sm font-medium text-color" for="mem-name">Name *</label>
              <input
                id="mem-name"
                pInputText
                [formField]="memberForm.name"
                placeholder="Vollständiger Name"
                class="w-full" />
              @if (memberForm.name().touched() && memberForm.name().invalid()) {
                <span class="text-xs text-red-500">{{ memberForm.name().errors()[0]?.message }}</span>
              }
            </div>

            <!-- Email -->
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-color" for="mem-email">E-Mail (optional)</label>
              <input
                id="mem-email"
                pInputText
                type="email"
                [formField]="memberForm.email"
                placeholder="name@beispiel.de"
                class="w-full" />
              @if (memberForm.email().touched() && memberForm.email().invalid()) {
                <span class="text-xs text-red-500">{{ memberForm.email().errors()[0]?.message }}</span>
              }
            </div>

            <!-- Role -->
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-color" for="mem-role">Rolle *</label>
              @if (canChangeRole()) {
                <p-select
                  inputId="mem-role"
                  [formField]="$any(memberForm.role)"
                  [options]="roleOptions"
                  optionLabel="label"
                  optionValue="value"
                  styleClass="w-full" />
              } @else {
                <div class="text-sm text-color pl-1 py-2">
                  {{ currentMember()?.role === 'owner' ? 'Owner' : 'Member' }}
                  <span class="text-xs text-muted-color ml-2">(Letzter Owner kann nicht herabgestuft werden)</span>
                </div>
              }
            </div>

            <!-- App-Zugang (read-only, edit mode only) -->
            @if (!isCreate() && currentMember()) {
              <div class="flex flex-col gap-1">
                <span class="text-sm font-medium text-muted-color">App-Zugang</span>
                <span class="text-sm text-color">
                  {{ currentMember()!.hasUserAccount ? 'Mit App-Zugang' : 'Ohne App-Zugang' }}
                </span>
              </div>
            }

          </div>
        </p-fluid>

        <div class="mt-auto flex gap-3 pt-4 border-t border-surface-200 dark:border-surface-700">
          <p-button
            type="submit"
            [label]="isCreate() ? 'Hinzufügen' : 'Speichern'"
            icon="pi pi-check"
            [disabled]="memberForm().invalid()"
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
export class MemberEditorSidebarComponent {
  private readonly store = inject(Store);

  protected readonly editor = select(MasterDataPageState.editor);
  protected readonly members = select(MasterDataPageState.members);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly isOpen = computed(() => this.editor()?.kind === 'member');
  protected readonly isCreate = computed(() => this.editor()?.kind === 'member' && this.editor()!.mode === 'create');
  protected readonly currentMember = computed(() => {
    const ed = this.editor();
    if (ed?.kind !== 'member' || !ed.memberId) return null;
    return this.members().find(m => m.memberId === ed.memberId) ?? null;
  });
  protected readonly canChangeRole = computed(() => {
    const m = this.currentMember();
    if (this.isCreate()) return true;
    return m?.canChangeRole ?? true;
  });

  protected readonly roleOptions = [
    { label: 'Member', value: 'member' },
    { label: 'Owner', value: 'owner' },
  ];

  private readonly formModel = signal<MemberFormModel>({
    name: '',
    email: '',
    role: 'member',
  });

  protected readonly memberForm = form(this.formModel, (p) => {
    required(p.name, { message: 'Name ist erforderlich' });
    minLength(p.name, 2, { message: 'Mind. 2 Zeichen' });
    maxLength(p.name, 64, { message: 'Max. 64 Zeichen' });
    validate(p.email, ({ value }) => {
      const v = value().trim();
      if (!v) return null;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
        ? null
        : { kind: 'email', message: 'Ungültige E-Mail-Adresse' };
    });
  });

  constructor() {
    // Pre-fill form when editor opens in edit mode
    effect(() => {
      const member = this.currentMember();
      if (member) {
        this.formModel.set({
          name: member.name ?? '',
          email: member.email ?? '',
          role: member.role,
        });
        this.saveError.set(null);
      } else if (this.isCreate()) {
        this.formModel.set({ name: '', email: '', role: 'member' });
        this.saveError.set(null);
      }
    });
  }

  protected close(): void {
    this.store.dispatch(new CloseMasterDataSidebar());
  }

  protected save(): void {
    if (this.memberForm().invalid()) return;
    this.saving.set(true);
    this.saveError.set(null);
    const v = this.formModel();
    const emailVal = v.email.trim() || null;

    if (this.isCreate()) {
      const payload: CreateMemberPayload = { name: v.name, email: emailVal, role: v.role };
      this.store.dispatch(new CreateMemberForAccount(payload)).subscribe({
        error: (err: unknown) => {
          this.saving.set(false);
          const msg = (err as { error?: { message?: string } })?.error?.message;
          this.saveError.set(msg ?? 'Fehler beim Hinzufügen des Mitglieds');
        },
        complete: () => this.saving.set(false),
      });
    } else {
      const memberId = (this.editor() as { kind: 'member'; mode: 'create' | 'edit'; memberId?: string }).memberId!;
      const payload: UpdateMemberPayload = { name: v.name, email: emailVal, role: v.role };
      this.store.dispatch(new UpdateMemberForAccount(memberId, payload)).subscribe({
        error: (err: unknown) => {
          this.saving.set(false);
          const msg = (err as { error?: { message?: string } })?.error?.message;
          this.saveError.set(msg ?? 'Fehler beim Speichern des Mitglieds');
        },
        complete: () => this.saving.set(false),
      });
    }
  }
}

