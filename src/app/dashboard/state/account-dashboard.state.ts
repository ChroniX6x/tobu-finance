
// account-dashboard.state.ts
import { State, Action, StateContext, Selector } from '@ngxs/store';
import { Injectable } from '@angular/core';
import { LoadAccountDashboard } from './account-dashboard.actions';
import { cloneDeep } from 'lodash';

export interface AccountDashboardStateModel {
  account: {
    id: string;
    name: string;
    currentBalance: number;
    balanceChange: number;
    forecast: number;
    warning?: string;
  };
  members: Array<{ id: string; name: string; avatar: string; paid: boolean; role: string }>;
  you: { id: string; name: string; paid: boolean; monthlyDue: number; paidAmount: number };
  quickStats: Array<{ label: string; value: number; icon: string; color: string }>;
  months: string[];
  lineChartData: any;
  doughnutData: any;
  pieChartData: any;
  tasks: Array<{ text: string; type: string; icon?: string, memberId: string }>;
  activity: Array<{ date: string; text: string; user: string }>;
}

@State<AccountDashboardStateModel>({
  name: 'accountDashboard',
  defaults: {
    account: {
      id: 'a1',
      name: 'Gemeinschaftskonto',
      currentBalance: 5672,
      balanceChange: 2.2,
      forecast: 5800,
      warning: 'Saldo unter 1000€ in 2 Monaten möglich!',
    },
    members: [
      { id: 'u1', name: 'Tony', avatar: 'T', paid: true, role: 'Admin' },
      { id: 'u2', name: 'Caro', avatar: 'C', paid: false, role: 'Mitglied' },
      { id: 'u3', name: 'Anna', avatar: 'A', paid: true, role: 'Mitglied' }
    ],
    you: { id: 'u1', name: 'Tony', paid: true, monthlyDue: 400, paidAmount: 400 },
    quickStats: [
      { label: 'Offene Beiträge', value: 1, icon: 'pi pi-exclamation-circle', color: 'bg-yellow-100 text-yellow-700' },
      { label: 'Offene TopUps', value: 0, icon: 'pi pi-arrow-up', color: 'bg-blue-100 text-blue-700' },
      { label: 'Warnungen', value: 1, icon: 'pi pi-exclamation-triangle', color: 'bg-red-100 text-red-700' },
      { label: 'Deine Aufgaben', value: 1, icon: 'pi pi-user', color: 'bg-green-100 text-green-700' }
    ],
    months: ['Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep'],
    lineChartData: {
      labels: ['Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep'],
      datasets: [{
        label: 'Kontostand',
        data: [4200, 4700, 5150, 4975, 5672, 5500],
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34,197,94,0.2)',
        fill: true,
        tension: 0.4
      }]
    },
    doughnutData: {
      labels: ['Einnahmen','Ausgaben'],
      datasets: [{
        data: [2470,2250],
        backgroundColor: ['#16a34a','#dc2626'],
        hoverBackgroundColor: ['#15803d','#b91c1c']
      }]
    },
    pieChartData: {
      labels: ['Miete','Lebensmittel','Freizeit'],
      datasets: [{
        data: [1200,600,300],
        backgroundColor: ['#3b82f6','#facc15','#ec4899'],
        hoverBackgroundColor: ['#1e40af','#ca8a04','#be185d']
      }]
    },
    tasks: [
      { text: 'Dein Beitrag für August ist noch offen!', type: 'warn', icon: 'pi pi-exclamation-triangle', memberId: "u1" },
      { text: 'Tony hat 45€ „Einkauf“ hinzugefügt', type: 'info', icon: 'pi pi-info-circle', memberId: "u2"  },
      { text: 'Saldo nähert sich Limit', type: 'error', icon: 'pi pi-times-circle', memberId: "u1"  }
    ],
    activity: [
      { date: '01.08.', text: 'Miete bezahlt', user: 'Caro' },
      { date: '28.07.', text: 'Einkauf hinzugefügt', user: 'Tony' },
      { date: '27.07.', text: 'Beitrag bezahlt', user: 'Anna' }
    ]
  }
})
@Injectable()
export class AccountDashboardState {

  @Selector() static account(state: AccountDashboardStateModel) { return state.account; }
  @Selector() static members(state: AccountDashboardStateModel) { return state.members; }
  @Selector() static you(state: AccountDashboardStateModel) { return state.you; }
  @Selector() static quickStats(state: AccountDashboardStateModel) { return state.quickStats; }
  @Selector() static months(state: AccountDashboardStateModel) { return state.months; }
  @Selector() static lineChartData(state: AccountDashboardStateModel) { return cloneDeep(state.lineChartData); }
  @Selector() static doughnutData(state: AccountDashboardStateModel) { return cloneDeep(state.doughnutData); }
  @Selector() static pieChartData(state: AccountDashboardStateModel) { return cloneDeep(state.pieChartData); }
  @Selector() static tasks(state: AccountDashboardStateModel) { return state.tasks; }
  @Selector() static activity(state: AccountDashboardStateModel) { return state.activity; }

  @Action(LoadAccountDashboard)
  loadAccountDashboard(ctx: StateContext<AccountDashboardStateModel>, action: LoadAccountDashboard) {
    // Placeholder für API-Aufruf
    return;
  }
}
