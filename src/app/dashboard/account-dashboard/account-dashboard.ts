import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { AvatarModule } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import { TimelineModule } from 'primeng/timeline';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'account-dashboard',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule, ChartModule, AvatarModule, TooltipModule, TimelineModule, MessageModule],
  templateUrl: './account-dashboard.html',
})
export class AccountDashboard {
  // Beispiel-Daten
  account = {
    name: 'Gemeinschaftskonto',
    currentBalance: 5672,
    balanceChange: 2.2,    // Prozent
    forecast: 5800,
    warning: 'Saldo unter 1000€ in 2 Monaten möglich!',
  };

  members = [
    { id: 'u1', name: 'Tony', avatar: 'T', paid: true, role: 'Admin' },
    { id: 'u2', name: 'Caro', avatar: 'C', paid: false, role: 'Mitglied' },
    { id: 'u3', name: 'Anna', avatar: 'A', paid: true, role: 'Mitglied' }
  ];

  you = signal({ id: 'u1', name: 'Tony', paid: true, monthlyDue: 400, paidAmount: 400 });

  // Quick-Stats & Aktionen
  quickStats = signal([
    { label: 'Offene Beiträge', value: 1, icon: 'pi pi-exclamation-circle', color: 'bg-yellow-100 text-yellow-700' },
    { label: 'Offene TopUps', value: 0, icon: 'pi pi-arrow-up', color: 'bg-blue-100 text-blue-700' },
    { label: 'Warnungen', value: 1, icon: 'pi pi-exclamation-triangle', color: 'bg-red-100 text-red-700' },
    { label: 'Deine Aufgaben', value: 1, icon: 'pi pi-user', color: 'bg-green-100 text-green-700' },
  ]);

  // Verlauf Chart
  months = ['Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep'];
  lineChartData = {
    labels: this.months,
    datasets: [{
      label: 'Kontostand',
      data: [4200, 4700, 5150, 4975, 5672, 5500],
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
      x: { display: true }
    }
  };

  // Doughnut-Chart (Einnahmen vs Ausgaben)
  doughnutData = {
    labels: ['Einnahmen','Ausgaben'],
    datasets: [{
      data: [2470,2250],
      backgroundColor: ['#16a34a','#dc2626'],
      hoverBackgroundColor: ['#15803d','#b91c1c']
    }]
  };
  doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } }
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
  pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } }
  };

  // Aufgaben
  tasks = signal([
    { text: 'Dein Beitrag für August ist noch offen!', type: 'warn', icon: 'pi pi-exclamation-triangle' },
    { text: 'Tony hat 45€ „Einkauf“ hinzugefügt', type: 'info', icon:'pi pi-info-circle' },
    { text: 'Saldo nähert sich Limit', type: 'error', icon:'pi pi-times-circle' }
  ]);

  // Letzte Aktivitäten (Timeline)
  activity = signal([
    { date: '01.08.', text: 'Miete bezahlt', user: 'Caro' },
    { date: '28.07.', text: 'Einkauf hinzugefügt', user: 'Tony' },
    { date: '27.07.', text: 'Beitrag bezahlt', user: 'Anna' }
  ]);
}
