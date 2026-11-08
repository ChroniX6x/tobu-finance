import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  ViewChild,
} from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { NgTemplateOutlet } from "@angular/common";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { combineLatest, Subscription } from "rxjs";
import { DateTime } from "luxon";
import {
  ACTIVITY_CODES,
  ActivitySubjectKinds,
  ActivityQuerySchema,
  activityCodeNames,
  ACTIVITY_TRIGGER_LABELS_DE,
  renderActivityActor,
  renderActivityText,
  type ActivityItem,
} from "@tobu/contracts/activity";
import { ActivityDataService } from "./activity-data.service";
import {
  activityDisplayZone,
  formatActivityInstant,
  groupLoadedActivity,
} from "./activity-presentation";

@Component({
  selector: "tbf-account-activity",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, NgTemplateOutlet],
  templateUrl: "./account-activity.html",
  styleUrl: "./account-activity.scss",
})
export class AccountActivity {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly data = inject(ActivityDataService);
  private readonly destroy = inject(DestroyRef);
  private request?: Subscription;
  private generation = 0;
  private filters: Record<string, string> = {};
  private validFilters = false;
  @ViewChild("resultsStatus") private status?: ElementRef<HTMLElement>;
  protected readonly accountId = signal("");
  protected readonly items = signal<ActivityItem[]>([]);
  protected readonly groups = computed(() => groupLoadedActivity(this.items()));
  protected readonly loading = signal(false);
  protected readonly error = signal("");
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly codes = ACTIVITY_CODES;
  protected readonly kinds = ActivitySubjectKinds;
  protected readonly codeNames = activityCodeNames;
  protected readonly zone = activityDisplayZone();
  protected form = {
    code: "",
    actorKind: "",
    subjectKind: "",
    subjectId: "",
    from: "",
    to: "",
    limit: "20",
  };
  protected readonly kindLabels: Record<string, string> = {
    account: "Konto",
    member: "Mitglied",
    transaction: "Buchung",
    category: "Kategorie",
    memberIncome: "Einkommen",
    contributionRule: "Beitragsregel",
    categoryBudget: "Budget",
    carryOver: "Übertrag",
    accountBalance: "Kontostand",
    legacyRecurrence: "Wiederkehrende Buchung",
    recurrence: "Buchungsvorlage",
    occurrence: "Vorlagenvorkommen",
  };
  protected readonly actorText = renderActivityActor;
  protected readonly eventText = renderActivityText;
  protected readonly dateText = (date: string) =>
    formatActivityInstant(date, this.zone);
  protected readonly triggerText = (item: ActivityItem) =>
    ACTIVITY_TRIGGER_LABELS_DE[item.trigger.kind];

  constructor() {
    combineLatest([this.route.parent!.paramMap, this.route.queryParamMap])
      .pipe(takeUntilDestroyed())
      .subscribe(([path, query]) => {
        this.generation++;
        this.validFilters = false;
        this.filters = {};
        this.request?.unsubscribe();
        this.accountId.set(path.get("accountId") ?? "");
        this.items.set([]);
        this.nextCursor.set(null);
        this.error.set("");
        this.loading.set(false);
        const raw: Record<string, string> = {};
        for (const key of query.keys)
          if (query.get(key)) raw[key] = query.get(key)!;
        const parsed = ActivityQuerySchema.safeParse(raw);
        if (!parsed.success || raw["cursor"]) {
          this.error.set(
            "Die Aktivitätsfilter sind ungültig. Bitte zurücksetzen.",
          );
          return;
        }
        this.filters = raw;
        this.validFilters = true;
        this.form = {
          code: raw["code"] ?? "",
          actorKind: raw["actorKind"] ?? "",
          subjectKind: raw["subjectKind"] ?? "",
          subjectId: raw["subjectId"] ?? "",
          from: this.localInput(raw["from"]),
          to: this.localInput(raw["to"]),
          limit: raw["limit"] ?? "20",
        };
        this.load(false);
      });
    this.destroy.onDestroy(() => this.request?.unsubscribe());
  }
  private localInput(value?: string) {
    return value
      ? DateTime.fromISO(value, { zone: "utc" })
          .setZone(this.zone)
          .toFormat("yyyy-LL-dd'T'HH:mm:ss.SSS")
      : "";
  }
  protected applyFilters() {
    const query: Record<string, string> = {};
    for (const [key, value] of Object.entries(this.form))
      if (value.trim()) {
        if (key === "from" || key === "to") {
          const date = DateTime.fromISO(value, { zone: this.zone });
          if (!date.isValid) {
            this.error.set("Bitte einen gültigen Zeitpunkt eingeben.");
            return;
          }
          query[key] = date.toUTC().toISO()!;
        } else query[key] = value.trim();
      }
    if (!ActivityQuerySchema.safeParse(query).success) {
      this.error.set(
        "Bitte gültige Filter und einen Zeitraum mit Von vor Bis eingeben.",
      );
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: query,
    });
  }
  protected resetFilters() {
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }
  protected loadMore() {
    if (this.nextCursor() && !this.loading()) this.load(true);
  }
  protected retry() {
    if (!this.loading())
      this.load(this.items().length > 0 || this.nextCursor() !== null);
  }
  private load(append: boolean) {
    if (!this.validFilters) return;
    const generation = this.generation;
    this.loading.set(true);
    this.error.set("");
    this.request = this.data
      .get(
        this.accountId(),
        this.filters,
        append ? (this.nextCursor() ?? undefined) : undefined,
      )
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (page) => {
          if (generation !== this.generation) return;
          const seen = new Set(
            (append ? this.items() : []).map((item) => item.id),
          );
          const incoming = page.items.filter((item) => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          });
          this.items.set([...(append ? this.items() : []), ...incoming]);
          this.nextCursor.set(page.nextCursor);
          this.loading.set(false);
          if (append)
            queueMicrotask(() =>
              this.status?.nativeElement.focus({ preventScroll: true }),
            );
        },
        error: (error: { status?: number }) => {
          if (generation !== this.generation) return;
          this.loading.set(false);
          if (
            error.status === 401 ||
            error.status === 403 ||
            error.status === 404
          ) {
            this.items.set([]);
            this.nextCursor.set(null);
          }
          this.error.set(
            error.status === 404
              ? "Diese Kontoaktivitäten sind nicht verfügbar."
              : error.status === 422
                ? "Der Seitenbeleg oder die Filter sind nicht mehr gültig. Bitte zurücksetzen."
                : "Aktivitäten konnten nicht geladen werden. Bitte erneut versuchen.",
          );
        },
      });
  }
}
