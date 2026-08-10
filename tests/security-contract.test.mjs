import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const frontend = read("index.html");
const auth = read("backend/supabase/functions/telegram-auth/index.ts");
const common = read("backend/supabase/functions/_shared/common.ts");
const api = read("backend/supabase/functions/workspace-api/index.ts");
const webhook = read("backend/supabase/functions/telegram-webhook/index.ts");
const worker = read("backend/supabase/functions/process-notifications/index.ts");
const migration = read("backend/supabase/migrations/202608100001_rasmus_beta_v8_secure.sql");

test("frontend exchanges Telegram initData once and uses Bearer sessions", () => {
  assert.match(frontend, /DEFAULT_AUTH_ENDPOINT/);
  assert.match(frontend, /authorization:`Bearer \$\{authSession\.accessToken\}`/);
  assert.match(frontend, /sessionStorage\.setItem\(SESSION_KEY/);
  assert.doesNotMatch(frontend, /OWNER_SETUP_CODE/);
});

test("Telegram identity is cryptographically checked before provisioning", () => {
  assert.match(auth, /verifyTelegramInitData/);
  assert.match(common, /HMAC/);
  assert.match(common, /auth_date/);
  assert.match(common, /maxAgeSeconds = 3_600/);
  assert.match(auth, /BETA_INVITE_REQUIRED/);
  assert.match(auth, /p_is_platform_owner/);
  assert.match(migration, /Every other legacy record must be re-authorized/);
  assert.match(migration, /if not p_is_platform_owner then/);
  assert.match(auth, /tg\.\$\{randomToken\(18\)\}@rasmus\.invalid/);
  assert.doesNotMatch(auth, /telegram\.\$\{telegramUserId\}@rasmus\.invalid/);
});

test("generic beta start does not create or expose a teacher workspace", () => {
  assert.doesNotMatch(webhook, /start(?:@\\w\+)?\\s\+beta(?:\$|["'])/);
  assert.match(webhook, /beta_\(\[A-Za-z0-9_-\]/);
  assert.doesNotMatch(webhook, /from\("teachers"\)\.insert/);
});

test("tenant tables use Auth membership RLS", () => {
  for (const table of [
    "app_users", "workspaces", "workspace_members", "workspace_states",
    "student_links", "student_invites", "student_portal_tokens",
    "notification_events", "reschedule_requests", "beta_feedback",
    "workspace_snapshots", "calendar_oauth_states", "calendar_event_links",
  ]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security;`));
  }
  assert.match(migration, /private\.is_workspace_member/);
  assert.match(migration, /wm\.user_id = \(select auth\.uid\(\)\)/);
  assert.match(api, /const \{ user, db \} = auth/);
});

test("invites and portal access store hashes instead of reusable raw secrets", () => {
  assert.match(migration, /create table if not exists public\.beta_invites[\s\S]*?token_hash text unique not null/);
  assert.match(migration, /create table if not exists public\.student_invites[\s\S]*?token_hash text unique not null/);
  assert.match(migration, /create table if not exists public\.student_portal_tokens[\s\S]*?token_hash text unique not null/);
  assert.match(api, /sha256Hex\(rawToken\)/);
  assert.match(webhook, /sha256Hex\(studentMatch\[1\]\)/);
});

test("student portal response excludes private teacher fields", () => {
  assert.match(api, /const safeStudent = \{/);
  assert.match(api, /student: safeStudent/);
  const safeBlock = api.match(/const safeStudent = \{([\s\S]*?)\n  \};/)?.[1] ?? "";
  for (const privateField of ["notes", "goal", "mistakes", "interests", "progress"]) {
    assert.doesNotMatch(safeBlock, new RegExp(`\\b${privateField}\\b`));
  }
  assert.match(api, /url\.protocol === "https:"/);
});

test("student reminders never fall back to the teacher", () => {
  assert.match(api, /if \(!studentLinkId\) return;/);
  assert.match(worker, /if \(input\.studentId && !linkId\) return false;/);
});

test("reset is recoverable and cannot target the primary/admin workspace", () => {
  assert.match(api, /action === "reset-preview"/);
  assert.match(api, /action === "reset-beta-workspace"/);
  assert.match(api, /action === "restore-last-reset"/);
  assert.match(api, /rpc\("rasmus_reset_beta_workspace"/);
  assert.match(api, /rpc\("rasmus_restore_beta_workspace"/);
  assert.match(api, /ctx\.isAdmin \|\| ctx\.workspace\.is_primary/);
  assert.match(migration, /create or replace function public\.rasmus_reset_beta_workspace/);
  assert.match(migration, /v_expires_at timestamptz := now\(\) \+ interval '7 days'/);
  assert.match(migration, /linked_students jsonb not null/);
  assert.match(migration, /create or replace function public\.rasmus_restore_beta_workspace/);
});

test("direct grants cannot rewrite Telegram destinations or primary ownership", () => {
  assert.match(migration, /grant update \(student_name, updated_at\)[\s\S]*?on public\.student_links to authenticated/);
  assert.doesNotMatch(migration, /grant (?:select, )?insert, update, delete on public\.student_links/);
  assert.match(migration, /grant update \(name, currency, timezone, updated_at\) on public\.workspaces/);
  assert.match(migration, /u\.beta_status = 'active'/);
});

test("storage is private and scoped by the first workspace path segment", () => {
  assert.match(migration, /values \('rasmus-private','rasmus-private',false\)/);
  assert.match(migration, /storage\.foldername\(name\)\)\[1\]/);
  assert.match(migration, /rasmus_storage_member_select/);
});

test("published HTML files and health version match the release", () => {
  assert.equal(read("docs/index.html"), frontend);
  assert.equal(read("docs/404.html"), frontend);
  const health = JSON.parse(read("docs/health.json"));
  assert.equal(health.version, "8.0.1-beta.1");
});
