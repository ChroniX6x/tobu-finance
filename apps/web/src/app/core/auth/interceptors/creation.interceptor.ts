import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpResponse,
  HttpContextToken,
} from "@angular/common/http";
import { inject } from "@angular/core";
import { catchError, finalize, from, switchMap, tap, throwError } from "rxjs";
import { AuthService } from "../services/auth.service";
import {
  usesCreationProof,
  CreationProofRequiredSchema,
  MutationProofRequiredSchema,
  usesMutationProof,
} from "@tobu/contracts/creation-proof";

const activeProofs = new Set<string>();
// The durable consumer checkpoint must be written before the proof is released.
export const CREATION_COMMITTED = new HttpContextToken<
  ((body: unknown) => void) | null
>(() => null);
const stable = (value: unknown) =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
        )
      : item,
  );

/** Retain only signed domain proofs, never access tokens or financial request bodies.
 * Concurrent intentional creates keep distinct proofs. More than one unresolved identical action fails closed.
 */
export const creationInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  let userId = auth.getUser()?.id;
  if (!userId) {
    // Storage namespace only. The server independently authenticates and checks the signed proof's user.
    try {
      userId = JSON.parse(
        atob(
          auth
            .getAccessToken()!
            .split(".")[1]!
            .replace(/-/g, "+")
            .replace(/_/g, "/"),
        ),
      ).sub;
    } catch {
      /* no restored identity */
    }
  }
  const target = new URL(req.url, location.origin);
  const mutation = usesMutationProof(req.method, target.pathname);
  const header = mutation ? "X-Tobu-Mutation" : "X-Tobu-Creation";
  if (
    !userId ||
    target.origin !== location.origin ||
    !(usesCreationProof(req.method, target.pathname) || mutation)
  )
    return next(req);
  return from(
    crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        stable([userId, req.url, req.body, ...(mutation ? [req.method] : [])]),
      ),
    ),
  ).pipe(
    switchMap((digest) => {
      const key =
        "tobu-creation:" +
        Array.from(new Uint8Array(digest), (n) =>
          n.toString(16).padStart(2, "0"),
        ).join("");
      // Storage failure is fail-closed BEFORE the committing request.
      const read = (): string[] =>
        JSON.parse(sessionStorage.getItem(key) ?? "[]");
      const pending = read().filter((proof) => !activeProofs.has(proof));
      if (pending.length > 1)
        return throwError(
          () =>
            new HttpErrorResponse({
              status: 503,
              error: { error: "MULTIPLE_PENDING_CREATIONS" },
            }),
        );
      const retained = pending[0] ?? null;
      let current = retained;
      if (current) activeProofs.add(current);
      const send = (proof: string | null) =>
        next(proof ? req.clone({ setHeaders: { [header]: proof } }) : req).pipe(
          tap((event) => {
            if (event instanceof HttpResponse && proof) {
              req.context.get(CREATION_COMMITTED)?.(event.body);
              const rest = read().filter((item) => item !== proof);
              if (rest.length)
                sessionStorage.setItem(key, JSON.stringify(rest));
              else sessionStorage.removeItem(key);
            }
          }),
        );
      return send(retained).pipe(
        catchError((error: HttpErrorResponse) => {
          if (
            retained &&
            (error.status === 410 ||
              [
                "MEMBER_CREATION_PROOF_STALE",
                "MUTATION_REVISION_STALE",
              ].includes(error.error?.error))
          ) {
            if (
              window.confirm(
                "Diese Aktion kann nicht sicher wiederholt werden. Bitte prüfe zuerst den aktuellen Stand. Soll die gespeicherte Wiederholung verworfen werden? Ein erneuter Klick startet danach bewusst eine neue Aktion.",
              )
            ) {
              const rest = read().filter((proof) => proof !== retained);
              if (rest.length)
                sessionStorage.setItem(key, JSON.stringify(rest));
              else sessionStorage.removeItem(key);
            }
          }
          const challenge = (
            mutation ? MutationProofRequiredSchema : CreationProofRequiredSchema
          ).safeParse(error.error);
          if (retained || error.status !== 428 || !challenge.success)
            return throwError(() => error);
          current =
            "creationProof" in challenge.data
              ? challenge.data.creationProof
              : challenge.data.mutationProof;
          sessionStorage.setItem(key, JSON.stringify([...read(), current]));
          activeProofs.add(current);
          return send(current);
        }),
        finalize(() => {
          if (current) activeProofs.delete(current);
        }),
      );
    }),
  );
};
