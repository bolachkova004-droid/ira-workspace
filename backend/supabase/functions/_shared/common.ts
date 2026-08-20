import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

export const APP_VERSION = "8.3.1-beta.1";

export const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-telegram-init-data, x-cron-secret, x-deploy-secret",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

function firstJsonSecret(name: string) {
  const value = Deno.env.get(name);
  if (!value) return "";
  try {
    const parsed = JSON.parse(value);
    return String(parsed.default ?? Object.values(parsed)[0] ?? "");
  } catch {
    return value;
  }
}

export function supabaseUrl() {
  const value = Deno.env.get("SUPABASE_URL") ?? "";
  if (!value) throw new Error("SUPABASE_URL is unavailable");
  return value.replace(/\/+$/, "");
}

export function secretKey() {
  const value = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || firstJsonSecret("SUPABASE_SECRET_KEYS") || Deno.env.get("SUPABASE_SECRET_KEY") || "";
  if (!value) throw new Error("Supabase server key is unavailable");
  return value;
}

export function publishableKey() {
  const value = Deno.env.get("SUPABASE_ANON_KEY") || firstJsonSecret("SUPABASE_PUBLISHABLE_KEYS") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  if (!value) throw new Error("Supabase publishable key is unavailable");
  return value;
}

export function adminClient() {
  return createClient(supabaseUrl(), secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function publicClient() {
  return createClient(supabaseUrl(), publishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function userClient(req: Request) {
  const authorization = req.headers.get("authorization") ?? "";
  return createClient(supabaseUrl(), publishableKey(), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function syncStudentIndex(db: SupabaseClient, workspaceId: string, state: any) {
  const desired = new Map<string, string>();
  for (const student of Array.isArray(state?.students) ? state.students : []) {
    const studentId = String(student?.id ?? "");
    if (!studentId) continue;
    desired.set(studentId, String(student?.name || "Ученик").slice(0, 160));
  }

  const existingResult = await db
    .from("student_links")
    .select("id,student_id,student_name")
    .eq("workspace_id", workspaceId);
  if (existingResult.error) throw existingResult.error;

  const existing = new Map<string, any>();
  for (const row of existingResult.data ?? []) existing.set(String(row.student_id), row);

  let created = 0;
  let updated = 0;
  let removed = 0;
  const updatedAt = new Date().toISOString();

  for (const [studentId, studentName] of desired) {
    const row = existing.get(studentId);
    if (!row) {
      const inserted = await db.from("student_links").insert({
        workspace_id: workspaceId,
        student_id: studentId,
        student_name: studentName,
        updated_at: updatedAt,
      }).select("id").single();
      if (inserted.error) throw inserted.error;
      created++;
      continue;
    }
    if (String(row.student_name) !== studentName) {
      // Only mutable display fields are updated. Telegram destinations and
      // tenant identity columns remain untouched.
      const renamed = await db.from("student_links").update({
        student_name: studentName,
        updated_at: updatedAt,
      }).eq("workspace_id", workspaceId).eq("id", row.id).select("id").maybeSingle();
      if (renamed.error) throw renamed.error;
      if (!renamed.data) throw new Error("Student index row could not be updated");
      updated++;
    }
  }

  for (const row of existing.values()) {
    if (desired.has(String(row.student_id))) continue;
    const deleted = await db.from("student_links")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("id", row.id)
      .select("id")
      .maybeSingle();
    if (deleted.error) throw deleted.error;
    if (deleted.data) removed++;
  }

  return { total: desired.size, created, updated, removed };
}

export async function authenticatedUser(req: Request): Promise<
  { ok: true; user: User; db: SupabaseClient } | { ok: false; response: Response }
> {
  const authorization = req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+/i.test(authorization)) {
    return { ok: false, response: json({ ok: false, code: "SESSION_REQUIRED", error: "Нужно снова подтвердить вход через Telegram" }, 401) };
  }
  const db = userClient(req);
  const token = authorization.replace(/^Bearer\s+/i, "");
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, response: json({ ok: false, code: "SESSION_EXPIRED", error: "Сессия истекла — открой Rasmus ещё раз" }, 401) };
  }
  return { ok: true, user: data.user, db };
}

function bytesToHex(bytes: ArrayBuffer | Uint8Array) {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return [...array].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function randomToken(byteLength = 24) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(digest);
}

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export async function verifyTelegramInitData(initData: string, maxAgeSeconds = 3_600) {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  if (!initData) return { ok: false as const, reason: "missing_init_data" };

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash") ?? "";
  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const encoder = new TextEncoder();
  const webAppKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const secret = await crypto.subtle.sign("HMAC", webAppKey, encoder.encode(botToken));
  const dataKey = await crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", dataKey, encoder.encode(dataCheckString));
  if (!safeEqual(bytesToHex(signature), receivedHash)) return { ok: false as const, reason: "invalid_hash" };

  const authDate = Number(params.get("auth_date") ?? 0);
  const now = Math.floor(Date.now() / 1000);
  if (!authDate || authDate > now + 60 || now - authDate > maxAgeSeconds) {
    return { ok: false as const, reason: "expired_init_data" };
  }

  try {
    const user = JSON.parse(params.get("user") ?? "null") as TelegramUser | null;
    if (!user?.id || !Number.isSafeInteger(Number(user.id))) return { ok: false as const, reason: "missing_user" };
    return { ok: true as const, user, authDate, startParam: params.get("start_param") ?? "" };
  } catch {
    return { ok: false as const, reason: "invalid_user" };
  }
}

export async function sendTelegramMessage(chatId: number | string, text: string, extra: Record<string, unknown> = {}) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra }),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.description || `Telegram HTTP ${response.status}`);
  return result.result;
}

export function botUsername() {
  return (Deno.env.get("BOT_USERNAME") ?? "ira_workspace_bot").replace(/^@/, "");
}

export function appPublicUrl() {
  return (Deno.env.get("APP_PUBLIC_URL") ?? "https://bolachkova004-droid.github.io/ira-workspace/").replace(/\/+$/, "/");
}

export function emptyWorkspaceState(name = "Преподаватель", currency = "RUB", timezone = "Europe/Moscow", onboardingComplete = false) {
  return {
    version: APP_VERSION,
    profile: { name, currency, timezone, onboardingComplete },
    students: [],
    lessons: [],
    content: [],
    reminders: [],
    reminderSettings: {
      payment: "review",
      homework: "auto",
      lesson: "auto",
      teacherLesson: "auto",
      teacherDaily: "auto",
      teacherReport: "auto",
      lead: "review",
    },
    analytics: { period: "30", sources: [] },
  };
}

export function localDateTimeToUtc(date: string, time: string, timeZone = "Europe/Moscow") {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return new Date(Number.NaN);
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let i = 0; i < 2; i++) {
    const parts = Object.fromEntries(format.formatToParts(guess).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
    const rendered = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    const wanted = Date.UTC(year, month - 1, day, hour, minute, 0);
    guess = new Date(guess.getTime() + (wanted - rendered));
  }
  return guess;
}

export function studentFromState(state: any, studentId: string) {
  return Array.isArray(state?.students) ? state.students.find((student: any) => String(student.id) === String(studentId)) : null;
}

export function upcomingLessons(state: any, studentId: string, timezone = "Europe/Moscow") {
  const now = new Date();
  return (Array.isArray(state?.lessons) ? state.lessons : [])
    .filter((lesson: any) => String(lesson.studentId) === String(studentId) && lesson.status !== "cancelled")
    .map((lesson: any) => ({ ...lesson, startsAt: localDateTimeToUtc(lesson.date, lesson.time, timezone) }))
    .filter((lesson: any) => Number.isFinite(lesson.startsAt.getTime()) && lesson.startsAt.getTime() >= now.getTime() - 60_000)
    .sort((a: any, b: any) => a.startsAt.getTime() - b.startsAt.getTime());
}

function encryptionKeyBytes() {
  const raw = Deno.env.get("TOKEN_ENCRYPTION_KEY") ?? "";
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    return Uint8Array.from(raw.match(/.{2}/g)!, (pair) => Number.parseInt(pair, 16));
  }
  const bytes = fromBase64Url(raw);
  if (bytes.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must contain 32 bytes");
  return bytes;
}

export async function encryptSecret(value: string) {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key = await crypto.subtle.importKey("raw", encryptionKeyBytes(), "AES-GCM", false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  return `v1.${base64Url(iv)}.${base64Url(new Uint8Array(encrypted))}`;
}

export async function decryptSecret(value: string) {
  const [version, ivText, cipherText] = value.split(".");
  if (version !== "v1" || !ivText || !cipherText) throw new Error("Unsupported encrypted secret");
  const key = await crypto.subtle.importKey("raw", encryptionKeyBytes(), "AES-GCM", false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64Url(ivText) }, key, fromBase64Url(cipherText));
  return new TextDecoder().decode(decrypted);
}

export function html(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]!));
}
