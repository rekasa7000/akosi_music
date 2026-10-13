// Thin client for apps/api's admin-auth routes
// (docs/12-admin-authentication.md). The API runs on its own origin —
// every call needs credentials: "include" so the session cookie
// actually gets sent/stored cross-origin.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type Step =
  | "SET_EMAIL"
  | "EMAIL_VERIFICATION"
  | "PASSWORD_SETUP"
  | "TOTP_ENROLLMENT"
  | "SELECT_MFA_METHOD"
  | "ENTER_CODE"
  | "DONE";

export type ChallengeResponse = {
  step: Step;
  challengeToken?: string;
  qrCodeDataUrl?: string;
  manualEntryKey?: string;
  availableMethods?: string[];
};

export class AdminApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    // Only set Content-Type when there's actually a body — Fastify's
    // JSON body parser rejects "Content-Type: application/json" paired
    // with an empty body (400), which bodyless POSTs like /admin/logout
    // would otherwise hit every time.
    headers: init?.body ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new AdminApiError(body?.error ?? "Something went wrong.");
  }
  return body as T;
}

export function login(email: string, password: string) {
  return request<ChallengeResponse>("/admin/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function setupEmail(challengeToken: string, email: string) {
  return request<ChallengeResponse>("/admin/setup/email", {
    method: "POST",
    body: JSON.stringify({ challengeToken, email }),
  });
}

export function verifyEmail(challengeToken: string, code: string) {
  return request<ChallengeResponse>("/admin/verify-email", {
    method: "POST",
    body: JSON.stringify({ challengeToken, code }),
  });
}

export function setupPassword(challengeToken: string, password: string) {
  return request<ChallengeResponse>("/admin/setup/password", {
    method: "POST",
    body: JSON.stringify({ challengeToken, password }),
  });
}

export function confirmTotp(challengeToken: string, code: string) {
  return request<ChallengeResponse>("/admin/totp/confirm", {
    method: "POST",
    body: JSON.stringify({ challengeToken, code }),
  });
}

export function selectLoginMethod(challengeToken: string, method: "EMAIL" | "TOTP") {
  return request<ChallengeResponse>("/admin/login/method", {
    method: "POST",
    body: JSON.stringify({ challengeToken, method }),
  });
}

export function verifyLogin(challengeToken: string, code: string) {
  return request<ChallengeResponse>("/admin/login/verify", {
    method: "POST",
    body: JSON.stringify({ challengeToken, code }),
  });
}

export function logout() {
  return request<ChallengeResponse>("/admin/logout", { method: "POST" });
}

export function me() {
  return request<{ email: string; role: string }>("/admin/me");
}
