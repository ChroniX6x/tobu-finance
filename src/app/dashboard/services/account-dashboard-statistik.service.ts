import { Injectable } from '@angular/core';
import { AccountModel } from '@/domain/account.model';
import { MemberModel } from '@/domain/member.model';
import { CategoryModel } from '@/domain/category.model';
import { TransactionModel } from '@/domain/transaction.model';

// Chart types
export interface ChartDataset {
    label?: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string | string[];
    fill?: boolean;
    tension?: number;
    hoverBackgroundColor?: string | string[];
}
export interface ChartData {
    labels: string[];
    datasets: ChartDataset[];
}

@Injectable({ providedIn: 'root' })
export class AccountDashboardStatistikService {
    getMonths(account: AccountModel): string[] {
        return account?.balances?.map((b) => b.month) ?? [];
    }

    getCurrentMonth(months: string[]): string {
        return months.at(-1) ?? '';
    }

    getMembersWithPaidStatus(
        members: MemberModel[],
        incomes: TransactionModel[],
        currentMonth: string
    ): Array<MemberModel & { paid: boolean; monthlyDue: number; paidAmount: number }> {
        return members.map((member) => {
            const memberIncomes = incomes.filter(
                (t) => t.month === currentMonth && t.paidByMemberId === member.id && t.status === 'booked'
            );
            const monthlyDue = 400; // TODO: Berechnung ggf. anpassen
            const paidAmount = memberIncomes.reduce((sum, t) => sum + t.amount, 0);
            const paid = paidAmount >= monthlyDue;
            return { ...member, paid, monthlyDue, paidAmount };
        });
    }

    getLatestBalance(account: AccountModel): number {
        return account?.balances?.at(-1)?.value ?? 0;
    }

    getBalanceChange(account: AccountModel): number {
        const balances = account?.balances ?? [];
        const latest = balances.at(-1)?.value ?? 0;
        const previous = balances.length > 1 ? balances.at(-2)?.value : 0;
        return previous ? +(((latest - previous) / previous) * 100).toFixed(1) : 0;
    }

    getForecast(latest: number): number {
        return latest + 100; // Dummy
    }

    getWarnungen(latest: number): number {
        return latest < 1000 ? 1 : 0;
    }

    getOffeneBeitraege(
        members: Array<MemberModel & { paid: boolean }>
    ): number {
        return members.filter((m) => !m.paid).length;
    }

    getOffeneTopUps(account: AccountModel): number {
        return account.topUps?.length ?? 0;
    }

    getQuickStats(
        offeneBeitraege: number,
        offeneTopUps: number,
        warnungen: number
    ): Array<{ label: string; value: number; icon: string; color: string }> {
        return [
            { label: 'Offene Beiträge', value: offeneBeitraege, icon: 'pi pi-exclamation-circle', color: 'bg-yellow-100 text-yellow-700' },
            { label: 'Offene TopUps', value: offeneTopUps, icon: 'pi pi-arrow-up', color: 'bg-blue-100 text-blue-700' },
            { label: 'Warnungen', value: warnungen, icon: 'pi pi-exclamation-triangle', color: 'bg-red-100 text-red-700' },
            { label: 'Deine Aufgaben', value: 1, icon: 'pi pi-user', color: 'bg-green-100 text-green-700' }
        ];
    }

    getLineChartData(account: AccountModel, months: string[]): ChartData {
        return {
            labels: months,
            datasets: [
                {
                    label: 'Kontostand',
                    data: account?.balances?.map((b) => b.value) ?? [],
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34,197,94,0.2)',
                    fill: true,
                    tension: 0.4
                }
            ]
        };
    }

    getDoughnutData(
        incomes: TransactionModel[],
        expenses: TransactionModel[],
        currentMonth: string
    ): ChartData {
        const incomesSum = incomes.filter((t) => t.month === currentMonth && t.status === 'booked').reduce((sum, t) => sum + t.amount, 0);
        const expensesSum = expenses.filter((t) => t.month === currentMonth && t.status === 'booked').reduce((sum, t) => sum + t.amount, 0);
        if (incomesSum === 0 && expensesSum === 0) {
            return {
                labels: [],
                datasets: []
            };
        }
        return {
            labels: ['Einnahmen', 'Ausgaben'],
            datasets: [
                {
                    data: [incomesSum, expensesSum],
                    backgroundColor: ['#16a34a', '#dc2626'],
                    hoverBackgroundColor: ['#15803d', '#b91c1c']
                }
            ]
        };
    }

    getPieChartData(
        expenses: TransactionModel[],
        categories: CategoryModel[],
        currentMonth: string
    ): ChartData {
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
        return {
            labels: sortedCategories.map(([name]) => name),
            datasets: [
                {
                    data: sortedCategories.map(([, sum]) => sum),
                    backgroundColor: ['#3b82f6', '#facc15', '#ec4899'],
                    hoverBackgroundColor: ['#1e40af', '#ca8a04', '#be185d']
                }
            ]
        };
    }

    getTasks(
        members: Array<MemberModel & { paid: boolean }>,
        currentMonth: string
    ): Array<{ text: string; type: string; icon: string; memberId: string }> {
        // Dummy-Implementierung
        return [{ text: 'Dein Beitrag für August ist noch offen!', type: 'warn', icon: 'pi pi-exclamation-triangle', memberId: 'u1' }];
    }

    getActivity(): Array<{ date: string; text: string; user: string }> {
        // Dummy-Implementierung
        return [{ date: '01.08.', text: 'Miete bezahlt', user: 'Caro' }];
    }

    getCurrentUserId(): string {
        // Dummy-Implementierung
        return 'u1';
    }

    getYou(
        members: Array<MemberModel & { paid: boolean; monthlyDue: number; paidAmount: number }>,
        userId: string
    ): { id: string; name: string; paid: boolean; monthlyDue: number; paidAmount: number } {
        return members.find((m) => m.id === userId) || { id: userId, name: '', paid: false, monthlyDue: 0, paidAmount: 0 };
    }
}
