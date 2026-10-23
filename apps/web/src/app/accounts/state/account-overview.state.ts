import { State, Selector, Action, StateContext } from '@ngxs/store';
import { Injectable, inject } from '@angular/core';
import { AccountOverviewUi } from '@/accounts/domain/account-overview.ui-model';
import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { AccountOverviewDataService } from '@/accounts/domain/account-overview-data.service';
import { LoadAccountOverview } from './account-overview.actions';
import { cloneDeep } from 'lodash';

// Model
export interface AccountOverviewStateModel {
    data: AccountOverviewUi | null; // entire overview payload (minor units, ISO dates)
    loading: boolean;
    error: string | null;
    ui: {
        lineChartData: { labels: string[]; datasets: Array<{ label: string; data: number[]; fill?: boolean; tension?: number }> };
        doughnutData: { labels: string[]; datasets: Array<{ data: number[] }> };
        pieChartData: { labels: string[]; datasets: Array<{ data: number[] }> };
    };
}

@State<AccountOverviewStateModel>({
    name: 'accountOverview',
    defaults: {
        data: null,
        loading: false,
        error: null,
        ui: {
            lineChartData: { labels: [], datasets: [] },
            doughnutData: { labels: [], datasets: [] },
            pieChartData: { labels: [], datasets: [] }
        }
    }
})
@Injectable()
export class AccountOverviewState {
    private svc = inject(AccountOverviewDataService);

    // ---- Selectors (klassisch für NGXS Signal-Select) ----
    @Selector() static data(s: AccountOverviewStateModel) {
        return s.data;
    }
    @Selector() static loading(s: AccountOverviewStateModel) {
        return s.loading;
    }
    @Selector() static error(s: AccountOverviewStateModel) {
        return s.error;
    }

    // bequeme Sub-Selectoren, damit die Komponente granular subscriben kann
    @Selector() static account(s: AccountOverviewStateModel) {
        return s.data?.account ?? null;
    }
    @Selector() static members(s: AccountOverviewStateModel) {
        return s.data?.members ?? [];
    }
    @Selector() static quickStats(s: AccountOverviewStateModel) {
        return s.data?.quickStats ?? null;
    }

    @Selector() static lineChartData(s: AccountOverviewStateModel) {
        return cloneDeep(s.ui?.lineChartData);
    }
    @Selector() static doughnutData(s: AccountOverviewStateModel) {
        return cloneDeep(s.ui?.doughnutData);
    }
    @Selector() static pieChartData(s: AccountOverviewStateModel) {
        return cloneDeep(s.ui?.pieChartData);
    }

    @Selector() static insights(s: AccountOverviewStateModel) {
        return s.data?.insights ?? [];
    }
    @Selector() static timeline(s: AccountOverviewStateModel) {
        return s.data?.timeline ?? [];
    }

    // ---- Actions ----
    @Action(LoadAccountOverview)
    loadOverview(ctx: StateContext<AccountOverviewStateModel>, { accountId }: LoadAccountOverview) {
        ctx.patchState({ loading: true, error: null });

        const toMajor = (v?: number) => (v ?? 0) / 100;
        const fmtMonth = (iso?: string) => {
            if (!iso) return '—';
            const full = iso.length === 7 ? `${iso}-01` : iso;
            return new Intl.DateTimeFormat('de-DE', { month: 'short', year: '2-digit' }).format(new Date(full));
        };

        return this.svc.getAccountOverview(accountId).pipe(
            tap((apiUi) => {
                // Charts aus Minor → Major & Labels formatieren
                const lineLabels = (apiUi.lineChartDataMinor.labelsIso ?? []).map(fmtMonth);
                const lineData = (apiUi.lineChartDataMinor.datasets?.[0]?.dataMinor ?? []).map(toMajor);
                const lineChartData = {
                    labels: lineLabels,
                    datasets: [{ label: 'Kontostand', data: lineData, fill: true, tension: 0.4 }]
                };

                const doughnutLabels = apiUi.doughnutDataMinor.labels ?? ['Einnahmen', 'Ausgaben'];
                const doughnutData = (apiUi.doughnutDataMinor.datasets?.[0]?.dataMinor ?? []).map(toMajor);
                const doughnut = { labels: doughnutLabels, datasets: [{ data: doughnutData }] };

                const pieLabels = apiUi.pieChartDataMinor.labels ?? [];
                const pieValues = (apiUi.pieChartDataMinor.datasets?.[0]?.dataMinor ?? []).map(toMajor);
                const pie = { labels: pieLabels, datasets: [{ data: pieValues }] };

                ctx.patchState({
                    data: apiUi, // Rohpaket (für Members, QuickStats, Insights, Timeline, Minor-Werte)
                    ui: {
                        lineChartData: lineChartData,
                        doughnutData: doughnut,
                        pieChartData: pie,
                    },
                    loading: false
                });
            }),
            catchError((err) => {
                ctx.patchState({ error: err?.message ?? 'Load failed', loading: false });
                return of(null);
            })
        );
    }
}
