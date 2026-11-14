import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import {
  provideHttpClientTesting,
  HttpTestingController,
} from "@angular/common/http/testing";
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from "@angular/router";
import { BehaviorSubject } from "rxjs";
import { ActivityItemSchema } from "@tobu/contracts/activity";
import { API_BASE_URL } from "@/core/api-base-url.token";
import { AccountActivity } from "./account-activity";
import {
  groupLoadedActivity,
  formatActivityInstant,
} from "./activity-presentation";

const id = "a".repeat(24);
const event = (n: number, grouped = true) =>
  ActivityItemSchema.parse({
    id: n.toString(16).padStart(24, "0"),
    accountId: id,
    occurredAt: "2026-11-08T12:00:00.000Z",
    schemaVersion: 1,
    code: "account.settings.updated",
    actor: { kind: "user", memberId: null, displayName: null },
    trigger: { kind: "user_action" },
    subject: { kind: "account", id, deleted: false },
    params: { changedFields: ["name"] },
    ...(grouped
      ? {
          group: { key: "b".repeat(64), source: "batch", scope: "loaded_only" },
        }
      : {}),
  });

describe("E06 loaded activity and UTC instants", () => {
  it("joins trusted groups over pages, deduplicates and never groups by timestamp", () => {
    expect(
      groupLoadedActivity([event(3), event(2), event(3), event(1)])[0].events
        .length,
    ).toBe(3);
    expect(groupLoadedActivity([event(3, false), event(2, false)]).length).toBe(
      2,
    );
    expect(groupLoadedActivity([event(3)])[0].grouped).toBeTrue();
  });
  it("displays the same real instant in explicit zones including midnight", () => {
    expect(formatActivityInstant("2026-11-08T00:00:00.000Z", "UTC")).toContain(
      "08.11.2026 00:00:00",
    );
    expect(
      formatActivityInstant("2026-11-08T00:00:00.000Z", "America/Los_Angeles"),
    ).toContain("07.11.2026 16:00:00");
  });
});

describe("E06 route lifetime and validated page consumption", () => {
  let http: HttpTestingController;
  let path: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let query: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  beforeEach(() => {
    path = new BehaviorSubject(convertToParamMap({ accountId: id }));
    query = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      imports: [AccountActivity],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: "" },
        {
          provide: ActivatedRoute,
          useValue: { parent: { paramMap: path }, queryParamMap: query },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify({ ignoreCancelled: true }));
  it("cancels previous-account responses and fails closed on invalid URL even after retry", () => {
    const fixture = TestBed.createComponent(AccountActivity);
    const old = http.expectOne(`/api/accounts/${id}/activity?limit=20`);
    const other = "c".repeat(24);
    path.next(convertToParamMap({ accountId: other }));
    expect(old.cancelled).toBeTrue();
    const current = http.expectOne(`/api/accounts/${other}/activity?limit=20`);
    current.flush({ items: [], nextCursor: null });
    query.next(convertToParamMap({ limit: "101" }));
    fixture.detectChanges();
    const button = Array.from(
      fixture.nativeElement.querySelectorAll(
        "button",
      ) as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent?.includes("Erneut versuchen"))!;
    button.click();
    http.expectNone((req) => req.url.includes("/activity"));
    fixture.destroy();
  });
  it("retains loaded groups after a page fault, retries same cursor and clears on access loss", () => {
    const fixture = TestBed.createComponent(AccountActivity);
    http
      .expectOne(`/api/accounts/${id}/activity?limit=20`)
      .flush({ items: [event(2)], nextCursor: "opaque" });
    fixture.detectChanges();
    const more = () =>
      (
        fixture.nativeElement.querySelector(".load-more") as HTMLButtonElement
      ).click();
    more();
    http
      .expectOne(`/api/accounts/${id}/activity?limit=20&cursor=opaque`)
      .flush("unavailable", { status: 503, statusText: "Unavailable" });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("1 Ereignisse geladen");
    more();
    http
      .expectOne(`/api/accounts/${id}/activity?limit=20&cursor=opaque`)
      .flush({ items: [event(1)], nextCursor: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      "2 geladene Ereignisse einer Aktion",
    );
    query.next(convertToParamMap({ actorKind: "system" }));
    http
      .expectOne(`/api/accounts/${id}/activity?limit=20&actorKind=system`)
      .flush("not found", { status: 404, statusText: "Not Found" });
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelectorAll("[data-event-id]").length,
    ).toBe(0);
    fixture.destroy();
  });
});
