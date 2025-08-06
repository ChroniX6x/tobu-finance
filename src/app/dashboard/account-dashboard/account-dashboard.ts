// account-dashboard.ts
import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';

@Component({
  selector: 'account-dashboard',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule, ChartModule],
  templateUrl: './account-dashboard.html',
})
export class AccountDashboard {
  // Beispiel-Daten
  private rawStats = {
    balance: 5672,
    changePct: 2.2,        // jetzt Prozent
    forecast: 5800,
    contributions: 250,
    topUps: 500,
  };

  statKeys = computed(() => [
    { label: 'Kontostand',      value: this.rawStats.balance,      suffix: ' €' },
    { label: 'Veränderung',     value: this.rawStats.changePct,    suffix: ' %' },
    { label: 'Prognose',        value: this.rawStats.forecast,     suffix: ' €' },
    { label: 'Beiträge',        value: this.rawStats.contributions, suffix: ' €' },
    { label: 'TopUps',          value: this.rawStats.topUps,        suffix: ' €' },
  ]);

  // Line-Chart (Verlauf)
  lineChartData = {
    labels: ['Mai','Jun','Jul','Aug'],
    datasets: [{
      label: 'Kontostand',
      data: [1000, 1100, 1275, this.rawStats.balance],
      borderColor: '#22c55e',
      backgroundColor: 'rgba(34,197,94,0.2)',
      fill: true,
      tension: 0.4
    }]
  };
lineChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    y: { ticks: { callback: (v: number) => v + ' €' } },
    x: { display: false }
  }
};

  // Doughnut-Chart (Einnahmen vs Ausgaben)
  doughnutData = {
    labels: ['Einnahmen','Ausgaben'],
    datasets: [{
      data: [2450,2375],
      backgroundColor: ['#16a34a','#dc2626'],
      hoverBackgroundColor: ['#15803d','#b91c1c']
    }]
  };
// Doughnut-Chart (Einnahmen vs Ausgaben)
doughnutOptions = {
  responsive: true,
  maintainAspectRatio: true,
};

  // Pie-Chart (Top Kategorien)
  pieChartData = {
    labels: ['Miete','Lebensmittel','Freizeit'],
    datasets: [{
      data: [1200,600,300],
      backgroundColor: ['#3b82f6','#facc15','#ec4899'],
      hoverBackgroundColor: ['#1e40af','#ca8a04','#be185d']
    }]
  };


// Pie-Chart (Top Kategorien)
pieChartOptions = {
  responsive: true,
  maintainAspectRatio: true,
};

}
