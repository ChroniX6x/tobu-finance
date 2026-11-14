import { TestBed } from "@angular/core/testing";
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
  HttpContext,
} from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { firstValueFrom } from "rxjs";
import {
  creationInterceptor,
  CREATION_COMMITTED,
} from "./creation.interceptor";
import { AuthService } from "../services/auth.service";

describe("domain creation proof recovery", () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  const userId = "a".repeat(24);
  let profile: { id: string } | null;
  const proofA = "a".repeat(80) + "." + "b".repeat(80);
  const proofB = "c".repeat(80) + "." + "d".repeat(80);
  let inputs: string[];
  const stored = () =>
    Object.keys(sessionStorage).filter((key) =>
      key.startsWith("tobu-creation:"),
    );
  beforeEach(() => {
    for (const key of stored()) sessionStorage.removeItem(key);
    profile = { id: userId };
    inputs = [];
    spyOn(crypto.subtle, "digest").and.callFake((_algorithm, data) => {
      inputs.push(new TextDecoder().decode(data as Uint8Array<ArrayBuffer>));
      return Promise.resolve(new ArrayBuffer(32));
    });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([creationInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            getUser: () => profile,
            getAccessToken: () =>
              "header." + btoa(JSON.stringify({ sub: userId })) + ".signature",
          },
        },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    controller.verify();
    for (const key of stored()) sessionStorage.removeItem(key);
  });
  it("retains the proof before commit, recovers with restored-token identity and stores no body or access token", async () => {
    const body = {
      accountId: "b".repeat(24),
      notes: "private note",
      amountMinor: 1234,
    };
    const failed = firstValueFrom(http.post("/api/transactions", body)).then(
      () => false,
      () => true,
    );
    await Promise.resolve();
    controller
      .expectOne("/api/transactions")
      .flush(
        { error: "CREATION_PROOF_REQUIRED", creationProof: proofA },
        { status: 428, statusText: "Precondition Required" },
      );
    const committing = controller.expectOne("/api/transactions");
    expect(committing.request.headers.get("X-Tobu-Creation")).toBe(proofA);
    expect(sessionStorage.getItem(stored()[0]!)).toBe(JSON.stringify([proofA]));
    committing.error(new ProgressEvent("error"));
    expect(await failed).toBeTrue();
    profile = null; // Refresh restores the access token before the profile, as in the real app.
    const retry = firstValueFrom(
      http.post("/api/transactions", {
        amountMinor: 1234,
        notes: "private note",
        accountId: "b".repeat(24),
      }),
    );
    await Promise.resolve();
    const recovered = controller.expectOne("/api/transactions");
    expect(inputs[1]).toBe(inputs[0]);
    expect(recovered.request.headers.get("X-Tobu-Creation")).toBe(proofA);
    recovered.flush({ _id: "c".repeat(24) });
    await retry;
    expect(stored()).toEqual([]);
  });
  it("keeps concurrent intentional creations distinct and does not erase another lost reply proof", async () => {
    const body = { title: "same intended payload" };
    const first = firstValueFrom(http.post("/api/categories", body));
    const second = firstValueFrom(http.post("/api/categories", body)).then(
      () => false,
      () => true,
    );
    await Promise.resolve();
    const challenges = controller.match("/api/categories");
    expect(challenges.length).toBe(2);
    challenges[0]!.flush(
      { error: "CREATION_PROOF_REQUIRED", creationProof: proofA },
      { status: 428, statusText: "Precondition Required" },
    );
    challenges[1]!.flush(
      { error: "CREATION_PROOF_REQUIRED", creationProof: proofB },
      { status: 428, statusText: "Precondition Required" },
    );
    const writes = controller.match("/api/categories");
    expect(writes.map((r) => r.request.headers.get("X-Tobu-Creation"))).toEqual(
      [proofA, proofB],
    );
    writes[0]!.flush({ _id: "a".repeat(24) });
    await first;
    writes[1]!.error(new ProgressEvent("error"));
    expect(await second).toBeTrue();
    expect(sessionStorage.getItem(stored()[0]!)).toBe(JSON.stringify([proofB]));
    const retry = firstValueFrom(http.post("/api/categories", body));
    await Promise.resolve();
    const recovered = controller.expectOne("/api/categories");
    expect(recovered.request.headers.get("X-Tobu-Creation")).toBe(proofB);
    recovered.flush({ _id: "b".repeat(24) });
    await retry;
    expect(stored()).toEqual([]);
  });
  it("refuses to guess among multiple unresolved identical creates after reload", async () => {
    const body = { title: "two unresolved actions" };
    const one = firstValueFrom(http.post("/api/categories", body)).then(
      () => false,
      () => true,
    );
    const two = firstValueFrom(http.post("/api/categories", body)).then(
      () => false,
      () => true,
    );
    await Promise.resolve();
    const requests = controller.match("/api/categories");
    requests[0]!.flush(
      { error: "CREATION_PROOF_REQUIRED", creationProof: proofA },
      { status: 428, statusText: "Precondition Required" },
    );
    requests[1]!.flush(
      { error: "CREATION_PROOF_REQUIRED", creationProof: proofB },
      { status: 428, statusText: "Precondition Required" },
    );
    for (const request of controller.match("/api/categories"))
      request.error(new ProgressEvent("error"));
    expect(await one).toBeTrue();
    expect(await two).toBeTrue();
    profile = null;
    const retry = firstValueFrom(http.post("/api/categories", body)).then(
      () => 0,
      (error: { status: number }) => error.status,
    );
    expect(await retry).toBe(503);
    controller.expectNone("/api/categories");
    expect(sessionStorage.getItem(stored()[0]!)).toBe(
      JSON.stringify([proofA, proofB]),
    );
  });
  it("sends no creation proof or negotiation to another origin with a matching API path", async () => {
    const response = firstValueFrom(
      http.post("https://foreign.example.test/api/categories", {
        name: "Foreign",
      }),
    );
    const request = controller.expectOne(
      "https://foreign.example.test/api/categories",
    );
    expect(request.request.headers.has("X-Tobu-Creation")).toBeFalse();
    expect(inputs).toEqual([]);
    request.flush({ ok: true });
    await response;
    expect(stored()).toEqual([]);
  });
  it("keeps the proof when durable consumer handoff fails after server success and reuses it after reload", async () => {
    const body = { name: "wizard account" };
    const interrupted = firstValueFrom(
      http.post("/api/accounts", body, {
        context: new HttpContext().set(CREATION_COMMITTED, () => {
          throw new Error("interrupted checkpoint");
        }),
      }),
    ).then(
      () => false,
      () => true,
    );
    await Promise.resolve();
    controller
      .expectOne("/api/accounts")
      .flush(
        { error: "CREATION_PROOF_REQUIRED", creationProof: proofA },
        { status: 428, statusText: "Precondition Required" },
      );
    controller.expectOne("/api/accounts").flush({ _id: "a".repeat(24) });
    expect(await interrupted).toBeTrue();
    expect(sessionStorage.getItem(stored()[0]!)).toBe(JSON.stringify([proofA]));
    profile = null;
    let checkpoint = "";
    const resumed = firstValueFrom(
      http.post("/api/accounts", body, {
        context: new HttpContext().set(CREATION_COMMITTED, (value) => {
          checkpoint = (value as { _id: string })._id;
        }),
      }),
    );
    await Promise.resolve();
    const request = controller.expectOne("/api/accounts");
    expect(request.request.headers.get("X-Tobu-Creation")).toBe(proofA);
    request.flush({ _id: "a".repeat(24) });
    await resumed;
    expect(checkpoint).toBe("a".repeat(24));
    expect(stored()).toEqual([]);
  });
  it("retains a mutation permit after reply loss and requires explicit discard of a stale revision", async () => {
    const path = "/api/transactions/" + "b".repeat(24);
    const body = { amountMinor: 1000 };
    const failed = firstValueFrom(http.patch(path, body)).then(
      () => false,
      () => true,
    );
    await Promise.resolve();
    controller
      .expectOne(path)
      .flush(
        { error: "MUTATION_PROOF_REQUIRED", mutationProof: proofA },
        { status: 428, statusText: "Precondition Required" },
      );
    const write = controller.expectOne(path);
    expect(write.request.headers.get("X-Tobu-Mutation")).toBe(proofA);
    write.error(new ProgressEvent("error"));
    expect(await failed).toBeTrue();
    spyOn(window, "confirm").and.returnValue(true);
    const retried = firstValueFrom(http.patch(path, body)).then(
      () => 0,
      (error: { status: number }) => error.status,
    );
    await Promise.resolve();
    const retry = controller.expectOne(path);
    expect(retry.request.headers.get("X-Tobu-Mutation")).toBe(proofA);
    retry.flush(
      { error: "MUTATION_REVISION_STALE" },
      { status: 409, statusText: "Conflict" },
    );
    expect(await retried).toBe(409);
    expect(window.confirm).toHaveBeenCalled();
    expect(stored()).toEqual([]);
    controller.expectNone(path);
  });
});
