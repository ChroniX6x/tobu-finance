import { Component, computed, effect, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { CardModule } from "primeng/card";
import { ButtonModule } from "primeng/button";
import { ChartModule } from "primeng/chart";
import { AvatarModule } from "primeng/avatar";
import { TooltipModule } from "primeng/tooltip";
import { TimelineModule } from "primeng/timeline";
import { MessageModule } from "primeng/message";
import { select, Store } from "@ngxs/store";
import { AccountOverviewState } from "../state/account-overview.state";
import { AccountMemberUi } from "@/accounts/domain/account-overview.ui-model";
import { formatMonthValue } from "@/shared/utils/calendar-picker";

@Component({
  selector: "tbf-account-overview",
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    ChartModule,
    AvatarModule,
    TooltipModule,
    TimelineModule,
    MessageModule,
  ],
  templateUrl: "./account-overview.html",
  styleUrls: ["./account-overview.scss"],
})
export class AccountOverview {
  protected timelinePt = {
    eventOpposite: { class: "!p-0 !flex-none" },
    eventSeparator: { class: "items-center" },
    eventMarker: { class: "!m-0" },
    eventConnector: { class: "h-[2px] mx-1.5 bg-surface-border" },
    eventContent: { class: "pt-3.5" },
  };

  private store = inject(Store);

  currentMember = computed<AccountMemberUi | undefined>(() =>
    this.members().find(
      (m: AccountMemberUi) => m.id === "m1" || m.id === "4a7b",
    ),
  ); // TODO aktueller User (über AuthService)
  account = select(AccountOverviewState.account);
  members = select(AccountOverviewState.members);
  quickStats = select(AccountOverviewState.quickStats);
  lineChartData = select(AccountOverviewState.lineChartData);
  doughnutData = select(AccountOverviewState.doughnutData);
  pieChartData = select(AccountOverviewState.pieChartData);
  insights = select(AccountOverviewState.insights);
  timeline = select(AccountOverviewState.timeline);
  loading = select(AccountOverviewState.loading);

  // ---- Helper: Monatswert (YYYY-MM, Monatsanker oder ISO-Tag) → z.B. "Aug. 2025", UTC-basiert ----
  private monthLabel = (iso: string | undefined) => formatMonthValue(iso);

  // ---- Header-Anzeigen (berechnet) ----
  currentMonthLabel = computed(() =>
    this.monthLabel(this.account()?.currentMonthIso),
  );
  currentBalanceMajor = computed(
    () => (this.account()?.currentBalanceMinor ?? 0) / 100,
  );
  forecastMajor = computed(() => (this.account()?.forecastMinor ?? 0) / 100);
  balanceChangePct = computed(() => this.account()?.balanceChangePct ?? 0);
  accountWarning = computed(() => this.account()?.warning);

  // Verlauf Chart
  lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { ticks: { callback: (v: number) => v + " €" } },
      x: { display: true },
    },
  };

  // Doughnut-Chart (Einnahmen vs Ausgaben)
  doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 4,
        right: 8,
        bottom: 4,
        left: 8,
      },
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          boxHeight: 8,
          padding: 12,
        },
      },
    },
    cutout: "58%",
  };

  // Pie-Chart (Top Kategorien)
  pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "bottom" } },
  };

  ngOnInit() {}
}
