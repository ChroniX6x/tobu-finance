import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { AccountChartData, SvgPoint } from '../../services/account-chart.service';

interface HoverState {
  pt: SvgPoint;
  px: number;
  py: number;
}

let nextId = 0;

@Component({
  selector: 'tbf-account-chart-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account-chart-card.html',
  imports: [CurrencyPipe],
})
export class AccountChartCard {
  readonly chartData = input.required<AccountChartData>();

  /** Unique gradient ID to avoid SVG id collisions across multiple chart cards. */
  protected readonly gradientId = `tbf-chart-grad-${++nextId}`;

  protected readonly hovered = signal<HoverState | null>(null);

  protected onMouseMove(evt: MouseEvent): void {
    const points = this.chartData().points;
    if (points.length === 0) return;

    const svg = (evt.target as SVGElement).closest('svg');
    if (!svg) return;

    const bbox = svg.getBoundingClientRect();
    const px = ((evt.clientX - bbox.left) / bbox.width) * 100;
    const py = ((evt.clientY - bbox.top) / bbox.height) * 100;

    let best = points[0];
    let bestDiff = Infinity;
    for (const pt of points) {
      const diff = Math.abs(pt.x - px);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = pt;
      }
    }
    this.hovered.set({ pt: best, px, py });
  }

  protected onMouseLeave(): void {
    this.hovered.set(null);
  }
}
