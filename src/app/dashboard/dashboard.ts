// dashboard.component.ts
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { select, Store } from '@ngxs/store';
import { DashboardState, LoadDashboardAccounts } from './state/dashboard.state';
import { DashboardAccountModel } from './domain/dashboard-account.model';
import { CommonModule } from '@angular/common';

interface SvgPoint { x: number; y: number; label: string; value: number; }

@Component({
  selector: 'tbf-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss']
})
export class Dashboard implements OnInit {
  private store = inject(Store);
  private router = inject(Router);

  accounts = select(DashboardState.accounts);
  loading  = select(DashboardState.loading);

  hovered = signal<{ accountId: string; pt: SvgPoint; px: number; py: number } | null>(null);

  svgAccounts = computed(() =>
    this.accounts().map(acc => {
      const data = acc.balanceHistoryMinor ?? [];
      // Durchschnittliche prozentuale Änderung über die letzten bis zu 3 Intervalle
      let pctChange: number | null = null,
          forecastValue: number | null = null;
      const n = Math.min(data.length - 1, 3);
      if (n > 0) {
        const changes: number[] = [];
        for (let i = data.length - n; i < data.length; i++) {
          const prev = data[i - 1], curr = data[i];
          changes.push((curr - prev) / prev * 100);
        }
        const avg = changes.reduce((a, b) => a + b, 0) / changes.length;
        pctChange = avg;
        const last = data.at(-1)!;
        forecastValue = Math.round(last * (1 + avg / 100));
      }
      const len = data.length;
      const max = Math.max(...data);
      const min = Math.min(...data);
      const range = max - min || 1;
      const stepX = 100 / (len - 1 || 1);
      const scaleY = 30 / range;

      const points: SvgPoint[] = data.map((v, i) => ({
        x: i * stepX,
        y: 30 - (v - min) * scaleY,
        label: i === len - 1 ? 'Jetzt' : `-${len - 1 - i}M`,
        value: v
      }));

      let dLine = `M${points[0].x},${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        const p0 = points[i - 1], p1 = points[i];
        const cx = (p0.x + p1.x) / 2, cy = (p0.y + p1.y) / 2;
        dLine += ` Q${p0.x},${p0.y} ${cx},${cy}`;
      }
      dLine += ` T${points[len - 1]?.x},${points[len - 1]?.y}`;
      const dFill = dLine + ` L${points[len - 1]?.x},30 L0,30 Z`;

      return { ...acc, points, dLine, dFill, currentBalance: points[len - 1]?.value ?? 0, pctChange, forecastValue };
    })
  );

  ngOnInit() {
    this.store.dispatch(new LoadDashboardAccounts({ months: 6 }));
  }

  goToAccount(id: string) {
    this.router.navigate(['/dashboard', id]);
  }

  goToWizard() {
    this.router.navigate(['/wizard']);
  }

  onMouseMove(accId: string, evt: MouseEvent, points: SvgPoint[]) {
    const svg = (evt.target as SVGElement).closest('svg')!;
    const bbox = svg.getBoundingClientRect();
    // Prozentuale Position innerhalb des SVG
    const px = ((evt.clientX - bbox.left) / bbox.width) * 100;
    const py = ((evt.clientY - bbox.top) / bbox.height) * 100;

    // Suche den Punkt mit minimalem X-Abstand
    let best = points[0], bestDiff = Infinity;
    points.forEach(pt => {
      const diff = Math.abs(pt.x - px);
      if (diff < bestDiff) { bestDiff = diff; best = pt; }
    });
    this.hovered.set({ accountId: accId, pt: best, px, py });
  }

  onMouseLeave() {
    this.hovered.set(null);
  }
}
