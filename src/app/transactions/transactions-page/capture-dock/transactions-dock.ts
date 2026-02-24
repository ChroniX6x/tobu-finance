import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { select, Store } from '@ngxs/store';
import { inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { TransactionCaptureState } from '../../state/transaction-capture.state';
import { ToggleDock } from '../../state/transaction-capture.actions';

@Component({
  selector: 'tbf-transactions-dock',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, BadgeModule],
  template: `
    @if (!dockOpen()) {
      <div class="capture-dock-tab">
        <p-button
          styleClass="dock-toggle-btn"
          [label]="'Capture' + (draftCount() > 0 ? ' (' + draftCount() + ')' : '')"
          icon="pi pi-chevron-up"
          severity="secondary"
          (onClick)="toggleDock()"
        />
      </div>
    } @else {
      <div class="capture-dock-panel">
        <div class="dock-header flex items-center justify-between p-3 border-b border-surface-200">
          <span class="font-semibold text-sm">
            Capture
            @if (draftCount() > 0) {
              <p-badge [value]="draftCount().toString()" severity="info" class="ml-2" />
            }
          </span>
          <p-button
            icon="pi pi-chevron-down"
            severity="secondary"
            size="small"
            [text]="true"
            (onClick)="toggleDock()"
          />
        </div>
        <div class="dock-body p-3 text-surface-400 text-sm text-center py-8">
          <i class="pi pi-wrench text-3xl mb-2 block"></i>
          <p>Capture Dock – Phase 3</p>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .capture-dock-tab {
      display: flex;
      justify-content: center;
      padding: 0.5rem;
      border-top: 1px solid var(--surface-200);
      background: var(--surface-0);
    }
    .capture-dock-panel {
      border-top: 2px solid var(--primary-color);
      background: var(--surface-0);
      max-height: 340px;
      overflow: auto;
    }
  `],
})
export class TransactionsDock {
  readonly accountId = input.required<string>();

  private store = inject(Store);
  protected dockOpen = select(TransactionCaptureState.dockOpen);
  protected draftCount = select(TransactionCaptureState.draftCount);

  protected toggleDock(): void {
    this.store.dispatch(new ToggleDock());
  }
}
