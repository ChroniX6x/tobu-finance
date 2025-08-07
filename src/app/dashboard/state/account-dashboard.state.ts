// account-dashboard.state.ts
import { State, Action, StateContext, Selector, Store } from '@ngxs/store';
import { Injectable } from '@angular/core';
import { LoadAccountDashboard } from './account-dashboard.actions';
import { cloneDeep } from 'lodash';
import { AccountState } from '@/state/account.state';
import { CategoriesState } from '@/state/categories.state';
import { TransactionsState } from '@/state/transactions.state';

export interface AccountDashboardStateModel {
    account: {
        id: string;
        name: string;
        currentBalance: number;
        balanceChange: number;
        forecast: number;
        warning?: string;
    };
    members: Array<{ id: string; name: string; avatar?: string; paid: boolean; role?: string }>;
    you: { id: string; name: string; paid: boolean; monthlyDue: number; paidAmount: number };
    quickStats: Array<{ label: string; value: number; icon: string; color: string }>;
    months: string[];
    lineChartData: any;
    doughnutData: any;
    pieChartData: any;
    tasks: Array<{ text: string; type: string; icon?: string; memberId: string }>;
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
            warning: 'Saldo unter 1000€ in 2 Monaten möglich!'
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
            datasets: [
                {
                    label: 'Kontostand',
                    data: [4200, 4700, 5150, 4975, 5672, 5500],
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34,197,94,0.2)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        doughnutData: {
            labels: ['Einnahmen', 'Ausgaben'],
            datasets: [
                {
                    data: [2470, 2250],
                    backgroundColor: ['#16a34a', '#dc2626'],
                    hoverBackgroundColor: ['#15803d', '#b91c1c']
                }
            ]
        },
        pieChartData: {
            labels: ['Miete', 'Lebensmittel', 'Freizeit'],
            datasets: [
                {
                    data: [1200, 600, 300],
                    backgroundColor: ['#3b82f6', '#facc15', '#ec4899'],
                    hoverBackgroundColor: ['#1e40af', '#ca8a04', '#be185d']
                }
            ]
        },
        tasks: [
            { text: 'Dein Beitrag für August ist noch offen!', type: 'warn', icon: 'pi pi-exclamation-triangle', memberId: 'u1' },
            { text: 'Tony hat 45€ „Einkauf“ hinzugefügt', type: 'info', icon: 'pi pi-info-circle', memberId: 'u2' },
            { text: 'Saldo nähert sich Limit', type: 'error', icon: 'pi pi-times-circle', memberId: 'u1' }
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
    @Selector() static account(state: AccountDashboardStateModel) {
        return state.account;
    }
    @Selector() static members(state: AccountDashboardStateModel) {
        return state.members;
    }
    @Selector() static you(state: AccountDashboardStateModel) {
        return state.you;
    }
    @Selector() static quickStats(state: AccountDashboardStateModel) {
        return state.quickStats;
    }
    @Selector() static months(state: AccountDashboardStateModel) {
        return state.months;
    }
    @Selector() static lineChartData(state: AccountDashboardStateModel) {
        return cloneDeep(state.lineChartData);
    }
    @Selector() static doughnutData(state: AccountDashboardStateModel) {
        return cloneDeep(state.doughnutData);
    }
    @Selector() static pieChartData(state: AccountDashboardStateModel) {
        return cloneDeep(state.pieChartData);
    }
    @Selector() static tasks(state: AccountDashboardStateModel) {
        return state.tasks;
    }
    @Selector() static activity(state: AccountDashboardStateModel) {
        return state.activity;
    }

    constructor(private store: Store) {}

    @Action(LoadAccountDashboard)
    loadAccountDashboard(ctx: StateContext<AccountDashboardStateModel>, action: LoadAccountDashboard) {
        const accountId = action.accountId;

        // 1. Daten holen (aus Data-States)
        const account = this.store.selectSnapshot(AccountState.account);
        const allMembers = account.members;
        const expenses = this.store.selectSnapshot(TransactionsState.expenses); // alle Transaktionen laden
        const incomes = this.store.selectSnapshot(TransactionsState.income); // alle Transaktionen laden
        const categories = this.store.selectSnapshot(CategoriesState.categories);

        // Aktueller Monat (z.B. "2025-08"), nimm letzten in balances als "aktuell"
        const balances = account?.balances || [];
        const months = balances.map((b) => b.month);
        const currentMonth = months.at(-1);

        // 2. Aggregation für Mitglieder: "paid" berechnen
        const members = allMembers.map((member) => {
            // Alle Transaktionen für diesen Account & Monat & Mitglied
            const memberIncomes = incomes.filter(
                (t) => t.month === currentMonth && t.paidByMemberId === member.id && t.status === 'booked' // nur gebuchte Transaktionen zählen!
            );
            // Monatsbeitrag (vereinfachtes Beispiel, ggf. komplexer ausrechnen!)
            // Du kannst auch weitere Felder aus account.monthlyPlannedContributions etc. für "monthlyDue" nehmen!
            const monthlyDue = 400; // <- berechnen!
            const paidAmount = memberIncomes.reduce((sum, t) => sum + t.amount, 0);
            const paid = paidAmount >= monthlyDue;

            return {
                ...member,
                paid,
                monthlyDue,
                paidAmount
            };
        });

        // 3. State Aggregation wie gehabt, "paid" ist jetzt im Member-Objekt!
        const latestBalance = balances.at(-1)?.value ?? 0;
        const previousBalance = balances.length > 1 ? balances.at(-2)?.value : 0;
        const balanceChange = previousBalance ? +(((latestBalance - previousBalance) / previousBalance) * 100).toFixed(1) : 0;
        const forecast = latestBalance + 100; // Dummy
        const warnungen = latestBalance < 1000 ? 1 : 0;

        // QuickStats
        const offeneBeitraege = members.filter((m) => !m.paid).length;
        const offeneTopUps = account.topUps?.length ?? 0 //?.filter((t) => !t.paid).length ?? 0;

        const quickStats = [
            { label: 'Offene Beiträge', value: offeneBeitraege, icon: 'pi pi-exclamation-circle', color: 'bg-yellow-100 text-yellow-700' },
            { label: 'Offene TopUps', value: offeneTopUps, icon: 'pi pi-arrow-up', color: 'bg-blue-100 text-blue-700' },
            { label: 'Warnungen', value: warnungen, icon: 'pi pi-exclamation-triangle', color: 'bg-red-100 text-red-700' },
            { label: 'Deine Aufgaben', value: 1, icon: 'pi pi-user', color: 'bg-green-100 text-green-700' }
        ];

        // Charts...
        const lineChartData = {
            labels: months,
            datasets: [
                {
                    label: 'Kontostand',
                    data: balances.map((b) => b.value),
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34,197,94,0.2)',
                    fill: true,
                    tension: 0.4
                }
            ]
        };
        // Einnahmen/Ausgaben berechnen
        const incomesSum = incomes.filter((t) => t.month === currentMonth && t.status === 'booked').reduce((sum, t) => sum + t.amount, 0);
        const expensesSum = expenses.filter((t) => t.month === currentMonth && t.status === 'booked').reduce((sum, t) => sum + t.amount, 0);

        const doughnutData = {
            labels: ['Einnahmen', 'Ausgaben'],
            datasets: [
                {
                    data: [incomesSum, expensesSum],
                    backgroundColor: ['#16a34a', '#dc2626'],
                    hoverBackgroundColor: ['#15803d', '#b91c1c']
                }
            ]
        };

        // PieChart Top Kategorien (Beispiel aus expenses im aktuellen Monat)
        const categorySums: Record<string, number> = {};
        expenses
            .filter((t) => t.month === currentMonth && t.status === 'booked')
            .forEach((t) => {
                const name = categories.find((c) => c.id === t.categoryId)?.name ?? 'Unbekannt';
                categorySums[name] = (categorySums[name] || 0) + t.amount;
            });
        const sortedCategories = Object.entries(categorySums)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3);
        const pieChartData = {
            labels: sortedCategories.map(([name]) => name),
            datasets: [
                {
                    data: sortedCategories.map(([, sum]) => sum),
                    backgroundColor: ['#3b82f6', '#facc15', '#ec4899'],
                    hoverBackgroundColor: ['#1e40af', '#ca8a04', '#be185d']
                }
            ]
        };

        // Aufgaben und Aktivitäten (dummy)
        const tasks = [{ text: 'Dein Beitrag für August ist noch offen!', type: 'warn', icon: 'pi pi-exclamation-triangle', memberId: 'u1' }];
        const activity = [{ date: '01.08.', text: 'Miete bezahlt', user: 'Caro' }];

        // "Du selbst"
        const userId = 'u1'; // <- ggf. dynamisch bestimmen!
        const you = members.find((m) => m.id === userId) || { id: userId, name: '', paid: false, monthlyDue: 0, paidAmount: 0 };

        ctx.setState({
            ...ctx.getState(),
            account: {
                id: account.id,
                name: account.name,
                currentBalance: latestBalance,
                balanceChange,
                forecast,
                warning: warnungen ? 'Saldo unter 1000€ in 2 Monaten möglich!' : undefined
            },
            members,
            you,
            quickStats,
            months,
            lineChartData,
            doughnutData,
            pieChartData,
            tasks,
            activity
        });
    }
}
