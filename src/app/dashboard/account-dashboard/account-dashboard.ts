// src/app/dashboard/account-dashboard.component.ts
import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPipe } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TabsModule, TabPanel } from 'primeng/tabs';
import { DividerModule } from 'primeng/divider';

interface DashboardAccountModel {
  id: string;
  name: string;
  balanceHistory: number[];
  currentBalance: number;
  sumAdditionalContributions: number;
  sumTopUps: number;
  pctChange: number;
}

@Component({
  selector: 'tbf-account-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    TabsModule,
    DividerModule,
    TableModule // optional
  ],
  templateUrl: './account-dashboard.html',
  styleUrls: ['./account-dashboard.scss']
})
export class AccountDashboard {
  // Beispiel-Daten
  private raw = [
    {
      id: 'a1',
      name: 'Gemeinschaftskonto',
      balanceHistory: [6742, 3976, 4521, 5672],
      sumAdditionalContributions: 250 + 200,
      sumTopUps: 500 + 300
    }
  ];

  // Signal mit gemappten Feldern
  account = signal<DashboardAccountModel>({
    ...this.raw[0],
    currentBalance: this.raw[0].balanceHistory.at(-1)!,
    pctChange: (() => {
      const h = this.raw[0].balanceHistory;
      const n = Math.min(h.length - 1, 3);
      const changes: number[] = [];
      for (let i = h.length - n; i < h.length; i++) {
        changes.push((h[i] - h[i - 1]) / h[i - 1] * 100);
      }
      const avg = changes.reduce((a, b) => a + b, 0) / changes.length;
      return avg;
    })()
  });

  // Chart-Data für SVG
  points = computed(() => {
    const data = this.account().balanceHistory;
    const len = data.length;
    const max = Math.max(...data),
          min = Math.min(...data),
          range = max - min || 1;
    const stepX = 100 / (len - 1 || 1);
    const scaleY = 30 / range;
    return data.map((v,i) => ({
      x: i * stepX,
      y: 30 - (v - min) * scaleY
    }));
  });

  pathLine = computed(() => {
    const pts = this.points();
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i-1], p1 = pts[i];
      const cx = (p0.x + p1.x)/2, cy = (p0.y + p1.y)/2;
      d += ` Q${p0.x},${p0.y} ${cx},${cy}`;
    }
    d += ` T${pts.at(-1)!.x},${pts.at(-1)!.y}`;
    return d;
  });

  pathFill = computed(() => this.pathLine() + ` L${this.points().at(-1)!.x},30 L0,30 Z`);
}
