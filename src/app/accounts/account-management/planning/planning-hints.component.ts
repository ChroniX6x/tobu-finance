import { ChangeDetectionStrategy, Component } from '@angular/core';
import { select } from '@ngxs/store';
import { PlanningPageSelectors } from './state/planning.selectors';

@Component({
  selector: 'tbf-planning-hints',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hints().length > 0) {
      <div class="flex flex-col gap-2">
        @for (hint of hints(); track hint.code) {
          <div class="flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
               [class]="hintClass(hint.severity)">
            <i [class]="hintIcon(hint.severity) + ' mt-0.5 shrink-0'"></i>
            <span>{{ hint.message }}</span>
          </div>
        }
      </div>
    }
  `,
})
export class PlanningHintsComponent {
  protected readonly hints = select(PlanningPageSelectors.hints);

  protected hintIcon(severity: 'info' | 'warn' | 'error'): string {
    switch (severity) {
      case 'error': return 'pi pi-times-circle text-red-500';
      case 'warn':  return 'pi pi-exclamation-triangle text-yellow-500';
      default:      return 'pi pi-info-circle text-blue-400';
    }
  }

  protected hintClass(severity: 'info' | 'warn' | 'error'): string {
    switch (severity) {
      case 'error': return 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-color';
      case 'warn':  return 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-color';
      default:      return 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-color';
    }
  }
}
