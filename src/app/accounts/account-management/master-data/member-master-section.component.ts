import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Store } from '@ngxs/store';
import { select } from '@ngxs/store';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { MessageModule } from 'primeng/message';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { MemberMasterItemVm, AccountMasterVm } from './account-master-data.models';
import { MasterDataPageState } from './state/master-data-page.state';
import { OpenMemberSidebar, RemoveMemberFromAccount } from './state/master-data-page.actions';
import { MemberEditorSidebarComponent } from './member-editor-sidebar.component';

@Component({
  selector: 'tbf-member-master-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ConfirmationService],
  imports: [
    ButtonModule,
    TagModule,
    TooltipModule,
    MessageModule,
    ConfirmDialogModule,
    MemberEditorSidebarComponent,
  ],
  template: `
    <p-confirmdialog />

    <header class="mb-5 flex items-start justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold text-color">Mitglieder</h2>
        <p class="text-sm text-muted-color mt-0.5">Personen, die diesem Account zugeordnet sind.</p>
      </div>
      <p-button
        label="Mitglied hinzufügen"
        icon="pi pi-user-plus"
        severity="secondary"
        [text]="true"
        size="small"
        (onClick)="openCreate()" />
    </header>

    <!-- Single-member hint -->
    @if (accountVm().memberCount === 1) {
      <p-message
        severity="info"
        styleClass="mb-4 w-full"
        text="Dieser Account hat aktuell nur ein Mitglied. Für ein Gemeinschaftskonto sind normalerweise mindestens zwei Mitglieder sinnvoll." />
    }

    <!-- Member cards -->
    <div class="flex flex-col gap-3">
      @for (member of members(); track member.memberId) {
        <div class="p-4 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900">
          <div class="flex items-start justify-between gap-3">

            <!-- Left: info -->
            <div class="flex flex-col gap-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-medium text-color truncate">
                  {{ member.name ?? 'Unbenanntes Mitglied' }}
                </span>
                <p-tag
                  [value]="member.role === 'owner' ? 'Owner' : 'Member'"
                  [severity]="member.role === 'owner' ? 'warn' : 'secondary'" />
              </div>
              @if (member.email) {
                <span class="text-xs text-muted-color">{{ member.email }}</span>
              }
              <span class="text-xs text-muted-color">
                {{ member.hasUserAccount ? 'Mit App-Zugang' : 'Ohne App-Zugang' }}
              </span>
              <!-- Usage hints when blocked -->
              @if (!member.canRemoveFromAccount && member.usageHints.length > 0) {
                <ul class="mt-1 text-xs text-orange-600 dark:text-orange-400 list-disc list-inside space-y-0.5">
                  @for (hint of member.usageHints; track $index) {
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
                aria-label="Mitglied bearbeiten"
                (onClick)="openEdit(member.memberId)" />
              <p-button
                icon="pi pi-user-minus"
                severity="danger"
                [text]="true"
                size="small"
                [disabled]="!member.canRemoveFromAccount"
                [pTooltip]="member.canRemoveFromAccount ? 'Aus Account entfernen' : (member.usageHints[0] || 'Entfernen nicht möglich')"
                aria-label="Mitglied aus Account entfernen"
                (onClick)="confirmRemove(member)" />
            </div>
          </div>
        </div>
      }
    </div>

    <!-- Member editor sidebar -->
    <tbf-member-editor-sidebar />
  `,
})
export class MemberMasterSectionComponent {
  private readonly store = inject(Store);
  private readonly confirmationService = inject(ConfirmationService);

  readonly accountVm = input.required<AccountMasterVm>();

  protected readonly members = select(MasterDataPageState.members);

  protected openCreate(): void {
    this.store.dispatch(new OpenMemberSidebar('create'));
  }

  protected openEdit(memberId: string): void {
    this.store.dispatch(new OpenMemberSidebar('edit', memberId));
  }

  protected confirmRemove(member: MemberMasterItemVm): void {
    this.confirmationService.confirm({
      header: 'Mitglied entfernen',
      message: `„${member.name ?? 'Unbenanntes Mitglied'}" wirklich aus dem Account entfernen?`,
      accept: () => this.store.dispatch(new RemoveMemberFromAccount(member.memberId)),
      acceptLabel: 'Entfernen',
      rejectLabel: 'Abbrechen',
      acceptButtonProps: { severity: 'danger' },
    });
  }
}
