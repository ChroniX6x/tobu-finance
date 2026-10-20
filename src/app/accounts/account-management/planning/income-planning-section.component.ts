import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CurrencyPipe, PercentPipe } from '@angular/common';
import { Store, select } from '@ngxs/store';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { PlanningPageSelectors } from './state/planning.selectors';
import { OpenIncomeSidebar } from './state/planning.actions';

@Component({
  selector: 'tbf-income-planning-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, PercentPipe, TagModule, ButtonModule, TooltipModule],
  template: `
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-color">Einkommen</h2>
      <p-button
        label="Einkommen hinzufügen"
        icon="pi pi-plus"
        size="small"
        severity="secondary"
        (onClick)="openCreate()" />
    </div>

    @if (overview()?.proRataStatus === 'notUsed') {
      <div class="mb-4 rounded-lg px-3 py-2 text-sm bg-surface-card border border-surface text-muted-color">
        <i class="pi pi-info-circle mr-2"></i>
        Im ausgewählten Referenzmonat wird keine einkommensbasierte Verteilung verwendet.
      </div>
    }

    @if (allIncomes().length === 0) {
      <div class="flex flex-col items-center gap-3 py-12 text-center">
        <i class="pi pi-users text-4xl text-muted-color"></i>
        <p class="text-muted-color text-sm">Keine Mitglieder gefunden.</p>
      </div>
    } @else {
      <div class="flex flex-col gap-3">
        @for (member of allIncomes(); track member.memberId) {
          <div class="rounded-xl border border-surface bg-surface-card p-4">
            <div class="flex items-start justify-between gap-4">

              <div class="flex flex-col gap-1 min-w-0">
                <span class="font-medium text-color">{{ member.memberName }}</span>

                @if (member.activeIncome; as income) {
                  <span class="text-2xl font-bold text-color">
                    {{ toEur(income.amountMinor) | currency:'EUR':'symbol':'1.0-0' }}
                  </span>
                  <span class="text-xs text-muted-color">
                    {{ income.fromMonth !== 'open' ? 'ab ' + income.fromMonth : '(offen)' }}
                    @if (income.toMonth) { bis {{ income.toMonth }} }
                    @else { – (offen) }
                  </span>
                  @if (member.incomeSharePct !== null) {
                    <span class="text-xs text-muted-color mt-1">
                      Anteil: {{ member.incomeSharePct / 100 | percent:'1.0-0' }}
                    </span>
                  }
                } @else {
                  <span class="text-sm text-muted-color italic">Kein aktives Einkommen</span>
                }

                @if (member.missingForProRata) {
                  <div class="flex items-center gap-2 mt-1">
                    <span class="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                      <i class="pi pi-exclamation-triangle"></i> Einkommen fehlt für ProRata-Verteilung
                    </span>
                    <p-button
                      label="Einkommen ergänzen"
                      icon="pi pi-plus"
                      size="small"
                      severity="warn"
                      [text]="true"
                      (onClick)="openCreateForMember(member.memberId)" />
                  </div>
                }

                <!-- History Toggle -->
                @if (member.history.length > 0) {
                  <button
                    type="button"
                    class="text-xs text-primary mt-2 text-left hover:underline"
                    (click)="toggleHistory(member.memberId)">
                    @if (isHistoryOpen(member.memberId)) { History ausblenden }
                    @else { {{ member.history.length }} früheres Einkommen anzeigen }
                  </button>

                  @if (isHistoryOpen(member.memberId)) {
                    <div class="mt-2 flex flex-col gap-1 pl-3 border-l border-surface">
                      @for (h of member.history; track h.incomeId) {
                        <div class="flex items-center justify-between gap-2">
                          <span class="text-xs text-muted-color">
                            {{ toEur(h.amountMinor) | currency:'EUR':'symbol':'1.0-0' }}
                            · {{ h.fromMonth }}–{{ h.toMonth ?? 'offen' }}
                          </span>
                          <p-button
                            icon="pi pi-pencil"
                            [text]="true"
                            size="small"
                            severity="secondary"
                            pTooltip="Bearbeiten"
                            (onClick)="openEdit(h.incomeId)" />
                        </div>
                      }
                    </div>
                  }
                }
              </div>

              <div class="flex flex-col items-end gap-2 shrink-0">
                @if (member.activeIncome) {
                  <p-tag severity="success" value="Aktiv" />
                  <p-button
                    icon="pi pi-pencil"
                    [text]="true"
                    size="small"
                    severity="secondary"
                    pTooltip="Bearbeiten"
                    (onClick)="openEdit(member.activeIncome.incomeId)" />
                } @else {
                  <p-tag severity="secondary" value="Kein Einkommen" />
                }
              </div>

            </div>
          </div>
        }
      </div>
    }
  `,
})
export class IncomePlanningSectionComponent {
  private readonly store = inject(Store);
  protected readonly allIncomes = select(PlanningPageSelectors.allIncomes);
  protected readonly overview = select(PlanningPageSelectors.overview);

  protected openCreate(): void {
    this.store.dispatch(new OpenIncomeSidebar('create'));
  }

  protected openCreateForMember(memberId: string): void {
    this.store.dispatch(new OpenIncomeSidebar('create', undefined, memberId));
  }

  protected openEdit(incomeId: string): void {
    this.store.dispatch(new OpenIncomeSidebar('edit', incomeId));
  }
  private readonly openHistories = signal<Set<string>>(new Set());

  protected toEur(minor: number): number {
    return minor / 100;
  }

  protected toggleHistory(memberId: string): void {
    this.openHistories.update(set => {
      const next = new Set(set);
      next.has(memberId) ? next.delete(memberId) : next.add(memberId);
      return next;
    });
  }

  protected isHistoryOpen(memberId: string): boolean {
    return this.openHistories().has(memberId);
  }
}
