import { createClient } from "npm:@supabase/supabase-js@2";

export const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, x-telegram-init-data, x-cron-secret",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

export function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const secretMap = Deno.env.get("SUPABASE_SECRET_KEYS");
  let key = legacy ?? "";
  if (!key && secretMap) {
    try {
      const parsed = JSON.parse(secretMap);
      key = parsed.default ?? Object.values(parsed)[0] ?? "";
    } catch {
      // handled below
    }
  }
  if (!url || !key) throw new Error("Supabase server secrets are unavailable");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function bytesToHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export async function verifyTelegramInitData(initData: string, maxAgeSeconds = 86_400) {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  if (!initData) return { ok: false as const, reason: "missing_init_data" };

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash") ?? "";
  params.delete("hash");
  // Keep the new Telegram `signature` field in the HMAC data-check-string.
  // Telegram's bot-token validation excludes only `hash`; `signature` is
  // excluded only for the separate third-party Ed25519 validation flow.
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
  const secretKey = await crypto.subtle.sign("HMAC", webAppKey, encoder.encode(botToken));
  const dataKey = await crypto.subtle.importKey(
    "raw",
    secretKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", dataKey, encoder.encode(dataCheckString));
  const calculatedHash = bytesToHex(signature);
  if (!safeEqual(calculatedHash, receivedHash)) return { ok: false as const, reason: "invalid_hash" };

  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate || Math.abs(Date.now() / 1000 - authDate) > maxAgeSeconds) {
    return { ok: false as const, reason: "expired_init_data" };
  }

  try {
    const user = JSON.parse(params.get("user") ?? "null") as TelegramUser | null;
    if (!user?.id) return { ok: false as const, reason: "missing_user" };
    return { ok: true as const, user, authDate };
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

export function localDateTimeToUtc(date: string, time: string, timeZone = "Europe/Moscow") {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
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
  const parts = Object.fromEntries(format.formatToParts(guess).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  const wanted = Date.UTC(year, month - 1, day, hour, minute, 0);
  guess = new Date(guess.getTime() + (wanted - asUtc));
  return guess;
}

export function studentFromState(state: any, studentId: string) {
  return Array.isArray(state?.students) ? state.students.find((s: any) => String(s.id) === String(studentId)) : null;
}

export function upcomingLessons(state: any, studentId: string) {
  const now = new Date();
  return (Array.isArray(state?.lessons) ? state.lessons : [])
    .filter((l: any) => String(l.studentId) === String(studentId) && l.status !== "cancelled")
    .map((l: any) => ({ ...l, startsAt: localDateTimeToUtc(l.date, l.time) }))
    .filter((l: any) => l.startsAt.getTime() >= now.getTime() - 60_000)
    .sort((a: any, b: any) => a.startsAt.getTime() - b.startsAt.getTime());
}
