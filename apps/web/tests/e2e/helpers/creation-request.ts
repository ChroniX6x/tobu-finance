import type { APIRequestContext, Page } from "@playwright/test";
import {
  CreationProofRequiredSchema,
  MutationProofRequiredSchema,
} from "@tobu/contracts/creation-proof";

/** The real client protocol, not a route mock. One write-free challenge, then a proof-bound POST. */
export async function creationPost(
  page: Page,
  path: string,
  options: Parameters<APIRequestContext["post"]>[1] = {},
) {
  const response = await page.request.post(path, options);
  if (response.status() !== 428) return response;
  const challenge = CreationProofRequiredSchema.parse(await response.json());
  return page.request.post(path, {
    ...options,
    headers: { ...options.headers, "X-Tobu-Creation": challenge.creationProof },
  });
}

export async function mutationPut(
  page: Page,
  path: string,
  options: Parameters<APIRequestContext["put"]>[1] = {},
) {
  const response = await page.request.put(path, options);
  if (response.status() !== 428) return response;
  const challenge = MutationProofRequiredSchema.parse(await response.json());
  return page.request.put(path, {
    ...options,
    headers: { ...options.headers, "X-Tobu-Mutation": challenge.mutationProof },
  });
}
