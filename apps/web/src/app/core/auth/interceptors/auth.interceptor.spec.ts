import { TestBed } from "@angular/core/testing";
import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { Router } from "@angular/router";
import { firstValueFrom, throwError } from "rxjs";
import { API_INTERCEPTORS } from "./api-interceptors";
import { CREATION_COMMITTED } from "./creation.interceptor";
import { AuthService } from "../services/auth.service";
import { AuthStore } from "../services/auth.store";
import { API_BASE_URL } from "../../api-base-url.token";

describe("authenticated proof-protected writes", () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let store: AuthStore;
  let auth: AuthService;
  let navigate: jasmine.Spy;
  const proof = "a".repeat(80) + "." + "b".repeat(80);
  const path = "/api/transactions/" + "b".repeat(24);
  const stored = () =>
    Object.keys(sessionStorage).filter((k) => k.startsWith("tobu-creation:"));
  // Drain the digest and real AuthService promise/observable bridge without timers.
  const settle = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  };
  beforeEach(() => {
    stored().forEach((k) => sessionStorage.removeItem(k));
    spyOn(crypto.subtle, "digest").and.returnValue(
      Promise.resolve(new ArrayBuffer(32)),
    );
    navigate = jasmine.createSpy("navigate").and.resolveTo(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors(API_INTERCEPTORS)),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: "" },
        { provide: Router, useValue: { url: "/accounts", navigate } },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
    auth = TestBed.inject(AuthService);
    store.setUser({
      id: "a".repeat(24),
      email: "refresh@example.test",
      roles: [],
    });
    store.setAccessToken("expired-token");
  });
  afterEach(() => {
    controller.verify();
    stored().forEach((k) => sessionStorage.removeItem(k));
    sessionStorage.removeItem("user");
  });
  const refresh = () => {
    const request = controller.expectOne("/api/auth/refresh");
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.headers.has("Authorization")).toBeFalse();
    request.flush({ accessToken: "fresh-token" });
  };
  it("refreshes an expired POST, negotiates its creation proof and commits once", async () => {
    const checkpoint = jasmine.createSpy("checkpoint");
    const result = firstValueFrom(
      http.post(
        "/api/transactions",
        { amountMinor: 1234 },
        {
          context: new HttpContext().set(CREATION_COMMITTED, checkpoint),
        },
      ),
    );
    await settle();
    const expired = controller.expectOne("/api/transactions");
    expect(expired.request.headers.get("Authorization")).toBe(
      "Bearer expired-token",
    );
    expired.flush({}, { status: 401, statusText: "Unauthorized" });
    refresh();
    await settle();
    const challenge = controller.expectOne("/api/transactions");
    expect(challenge.request.headers.get("Authorization")).toBe(
      "Bearer fresh-token",
    );
    expect(challenge.request.headers.has("X-Tobu-Creation")).toBeFalse();
    challenge.flush(
      { error: "CREATION_PROOF_REQUIRED", creationProof: proof },
      { status: 428, statusText: "Precondition Required" },
    );
    const commit = controller.expectOne("/api/transactions");
    expect(commit.request.headers.get("Authorization")).toBe(
      "Bearer fresh-token",
    );
    expect(commit.request.headers.get("X-Tobu-Creation")).toBe(proof);
    expect(commit.request.withCredentials).toBeFalse();
    commit.flush({ _id: "c".repeat(24) });
    expect(await result).toEqual({ _id: "c".repeat(24) });
    expect(checkpoint).toHaveBeenCalledTimes(1);
    expect(stored()).toEqual([]);
    expect(store.getAccessToken()).toBe("fresh-token");
    expect(navigate).not.toHaveBeenCalled();
  });
  it("keeps the same mutation proof when the committing PATCH encounters an expired token", async () => {
    const result = firstValueFrom(http.patch(path, { amountMinor: 2000 }));
    await settle();
    controller
      .expectOne(path)
      .flush(
        { error: "MUTATION_PROOF_REQUIRED", mutationProof: proof },
        { status: 428, statusText: "Precondition Required" },
      );
    const expired = controller.expectOne(path);
    expect(expired.request.headers.get("X-Tobu-Mutation")).toBe(proof);
    expired.flush({}, { status: 401, statusText: "Unauthorized" });
    refresh();
    await settle();
    const commit = controller.expectOne(path);
    expect(commit.request.headers.get("X-Tobu-Mutation")).toBe(proof);
    expect(commit.request.headers.get("Authorization")).toBe(
      "Bearer fresh-token",
    );
    commit.flush({ amountMinor: 2000 });
    await result;
    expect(stored()).toEqual([]);
    expect(navigate).not.toHaveBeenCalled();
  });
  it("propagates a post-refresh domain error without logging out or renewing the write intent", async () => {
    const result = firstValueFrom(
      http.patch(path, { amountMinor: 2000 }),
    ).catch((e: HttpErrorResponse) => e.status);
    await settle();
    controller
      .expectOne(path)
      .flush({}, { status: 401, statusText: "Unauthorized" });
    refresh();
    await settle();
    controller
      .expectOne(path)
      .flush(
        { error: "MUTATION_PROOF_REQUIRED", mutationProof: proof },
        { status: 428, statusText: "Precondition Required" },
      );
    controller
      .expectOne(path)
      .flush(
        { error: "INVALID_AMOUNT" },
        { status: 422, statusText: "Unprocessable Entity" },
      );
    expect(await result).toBe(422);
    expect(store.getAccessToken()).toBe("fresh-token");
    expect(navigate).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(stored()[0]!)).toBe(JSON.stringify([proof]));
  });
  it("does not refresh twice when the retried request is still unauthorized", async () => {
    const refreshSpy = spyOn(auth, "refresh").and.callThrough();
    const result = firstValueFrom(http.get("/api/accounts")).catch(
      (e: HttpErrorResponse) => e.status,
    );
    controller
      .expectOne("/api/accounts")
      .flush({}, { status: 401, statusText: "Unauthorized" });
    refresh();
    await settle();
    controller
      .expectOne("/api/accounts")
      .flush({}, { status: 401, statusText: "Unauthorized" });
    expect(await result).toBe(401);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(store.getAccessToken()).toBeNull();
    expect(navigate).toHaveBeenCalledTimes(1);
  });
  it("clears the session on refresh failure without retrying the write", async () => {
    spyOn(auth, "refresh").and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 401 })),
    );
    const result = firstValueFrom(http.post("/api/transactions", {})).catch(
      (e: HttpErrorResponse) => e.status,
    );
    await settle();
    controller
      .expectOne("/api/transactions")
      .flush({}, { status: 401, statusText: "Unauthorized" });
    expect(await result).toBe(401);
    expect(store.getAccessToken()).toBeNull();
    expect(navigate).toHaveBeenCalledTimes(1);
  });
  it("shares one real AuthService refresh between concurrent unauthorized requests", async () => {
    const result = Promise.all([
      firstValueFrom(http.get("/api/accounts")),
      firstValueFrom(http.get("/api/accounts/summary")),
    ]);
    controller
      .expectOne("/api/accounts")
      .flush({}, { status: 401, statusText: "Unauthorized" });
    controller
      .expectOne("/api/accounts/summary")
      .flush({}, { status: 401, statusText: "Unauthorized" });
    refresh();
    await settle();
    for (const url of ["/api/accounts", "/api/accounts/summary"]) {
      const retry = controller.expectOne(url);
      expect(retry.request.headers.get("Authorization")).toBe(
        "Bearer fresh-token",
      );
      retry.flush([]);
    }
    expect(await result).toEqual([[], []]);
    expect(store.getRefreshInFlight()).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });
  it("never sends credentials or refreshes a foreign-origin request", async () => {
    const refreshSpy = spyOn(auth, "refresh").and.callThrough();
    const result = firstValueFrom(
      http.post("https://other.example.test/api/transactions", {}),
    ).catch((e: HttpErrorResponse) => e.status);
    const request = controller.expectOne(
      "https://other.example.test/api/transactions",
    );
    expect(request.request.headers.has("Authorization")).toBeFalse();
    expect(request.request.headers.has("X-Tobu-Creation")).toBeFalse();
    expect(request.request.withCredentials).toBeFalse();
    request.flush({}, { status: 401, statusText: "Unauthorized" });
    expect(await result).toBe(401);
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
