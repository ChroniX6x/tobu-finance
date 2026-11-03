import { expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

/**
 * Real-stack fixtures (H08-NACHTRAG-TESTS). Every test registers its own user: registration signs the browser
 * context in (httpOnly refresh cookie) and, unlike login, is not rate limited, so the isolated fixtures never
 * compete with the shared test user's login budget.
 */
export interface RealUser {
  headers: { authorization: string };
  userId: string;
}

export async function registerRealUser(
  page: Page,
  label: string,
): Promise<RealUser> {
  const response = await page.request.post("/api/auth/register", {
    data: {
      email: `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${randomUUID()}@example.test`,
      password: "Real-stack-test-password-1",
      name: label,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const body = await response.json();
  return {
    headers: { authorization: `Bearer ${body.accessToken}` },
    userId: body.user.id,
  };
}

export async function postJson<T = Record<string, unknown>>(
  page: Page,
  user: RealUser,
  path: string,
  data: unknown,
  expectedStatus = 201,
): Promise<T> {
  const response = await page.request.post(path, {
    headers: user.headers,
    data,
  });
  expect(response.status(), `${path}: ${await response.text()}`).toBe(
    expectedStatus,
  );
  return (await response.json()) as T;
}

export async function getJson<T = unknown>(
  page: Page,
  user: RealUser,
  path: string,
): Promise<T> {
  const response = await page.request.get(path, { headers: user.headers });
  expect(response.status(), `${path}: ${await response.text()}`).toBe(200);
  return (await response.json()) as T;
}

/** Account owned by the registered user, plus any further members. */
export async function createRealAccount(
  page: Page,
  user: RealUser,
  name: string,
  otherMembers: string[] = [],
) {
  const owner = await postJson<{ _id: string }>(page, user, "/api/members", {
    name: `${name} owner`,
    userId: user.userId,
  });
  const others: { _id: string }[] = [];
  for (const memberName of otherMembers) {
    others.push(
      await postJson<{ _id: string }>(page, user, "/api/members", {
        name: memberName,
      }),
    );
  }
  const account = await postJson<{ _id: string }>(page, user, "/api/accounts", {
    name,
    members: [
      { memberId: owner._id, role: "owner" },
      ...others.map((m) => ({ memberId: m._id, role: "member" })),
    ],
  });
  return { account, owner, others };
}
