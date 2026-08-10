import {
  APP_VERSION,
  adminClient,
  appPublicUrl,
  authenticatedUser,
  botUsername,
  decryptSecret,
  html,
  json,
  jsonHeaders,
  randomToken,
  sendTelegramMessage,
  sha256Hex,
  studentFromState,
  upcomingLessons,
} from "../_shared/common.ts";

const admin = adminClient();

type AppContext = {
  db: any;
  user: any;
  appUser: any;
  workspace: any;
  workspaceId: string;
  membershipRole: "owner" | "member";
  isAdmin: boolean;
};

async function parseBody(req: Request) {
  if (req.method === "GET") return Object.fromEntries(new URL(req.url).searchParams.entries());
  try { return await req.json(); } catch { return {}; }
}

function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function allowedCurrency(value: string) {
  return /^[A-Z]{3}$/.test(value) ? value : "RUB";
}

async function appContext(req: Request): Promise<AppContext | Response> {
  const auth = await authenticatedUser(req);
  if (!auth.ok) return auth.response;
  const { user, db } = auth;
  const profile = await db.from("app_users").select("id,telegram_user_id,telegram_username,first_name,last_name,platform_role,beta_status").eq("id", user.id).maybeSingle();
  if (profile.error || !profile.data) return json({ ok: false, code: "PROFILE_MISSING", error: "Профиль Rasmus не найден" }, 403);
  if (profile.data.beta_status !== "active") return json({ ok: false, code: "ACCESS_BLOCKED", error: "Доступ к beta приостановлен" }, 403);

  const membership = await db
    .from("workspace_members")
    .select("workspace_id,role,workspaces(id,name,currency,timezone,is_primary,created_at)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (membership.error || !membership.data) return json({ ok: false, code: "WORKSPACE_MISSING", error: "Кабинет не найден" }, 403);
  const workspace = Array.isArray(membership.data.workspaces) ? membership.data.workspaces[0] : membership.data.workspaces;
  if (!workspace) return json({ ok: false, code: "WORKSPACE_MISSING", error: "Кабинет не найден" }, 403);

  return {
    db,
    user,
    appUser: profile.data,
    workspace,
    workspaceId: membership.data.workspace_id,
    membershipRole: membership.data.role,
    isAdmin: profile.data.platform_role === "admin",
  };
}

function modeFor(state: any, key: string, fallback: "auto" | "review" | "off" = "review") {
  const mode = state?.reminderSettings?.[key];
  return mode === "auto" || mode === "review" || mode === "off" ? mode : fallback;
}

function validateState(input: any) {
  if (!input || typeof input !== "object" || !Array.isArray(input.students) || !Array.isArray(input.lessons)) {
    return "Некорректная структура кабинета";
  }
  if (input.students.length > 500 || input.lessons.length > 5_000 || (input.content?.length ?? 0) > 2_000) {
    return "Слишком много записей в одном запросе";
  }
  const studentIds = new Set<string>();
  for (const student of input.students) {
    const id = String(student?.id ?? "");
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(id) || studentIds.has(id)) return "Повторяющийся или некорректный ID ученика";
    studentIds.add(id);
  }
  const lessonIds = new Set<string>();
  for (const lesson of input.lessons) {
    const id = String(lesson?.id ?? "");
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(id) || lessonIds.has(id)) return "Повторяющийся или некорректный ID урока";
    if (!studentIds.has(String(lesson?.studentId ?? ""))) return "Урок ссылается на отсутствующего ученика";
    const date = String(lesson?.date ?? "");
    const time = String(lesson?.time ?? "");
    const duration = Number(lesson?.duration ?? 60);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(new Date(`${date}T12:00:00`).getTime())) return "Некорректная дата урока";
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return "Некорректное время урока";
    if (!Number.isFinite(duration) || duration < 1 || duration > 24 * 60) return "Некорректная длительность урока";
    if (!['planned','completed','cancelled'].includes(String(lesson?.status ?? 'planned'))) return "Некорректный статус урока";
    if (String(lesson?.title ?? "").length > 500 || String(lesson?.link ?? "").length > 2_000) return "Слишком длинные данные урока";
    lessonIds.add(id);
  }
  for (const collection of [input.content ?? [], input.reminders ?? []]) {
    if (!Array.isArray(collection)) return "Некорректная структура кабинета";
    const ids = new Set<string>();
    for (const item of collection) {
      const id = String(item?.id ?? "");
      if (!/^[A-Za-z0-9_-]{1,120}$/.test(id) || ids.has(id)) return "Некорректный ID записи";
      ids.add(id);
    }
  }
  const encoded = JSON.stringify(input);
  if (new TextEncoder().encode(encoded).length > 3_000_000) return "Кабинет превышает допустимый размер";
  return "";
}

async function studentLinks(ctx: AppContext) {
  const result = await ctx.db
    .from("student_links")
    .select("id,student_id,student_name,telegram_user_id,telegram_chat_id,telegram_username,linked_at")
    .eq("workspace_id", ctx.workspaceId)
    .order("student_name");
  if (result.error) throw result.error;
  return result.data ?? [];
}

async function reviewQueue(ctx: AppContext) {
  const result = await ctx.db
    .from("notification_events")
    .select("id,student_link_id,kind,text,send_at,status,created_at,source,student_links(student_id,student_name)")
    .eq("workspace_id", ctx.workspaceId)
    .eq("status", "review")
    .order("created_at", { ascending: false })
    .limit(100);
  if (result.error) throw result.error;
  return (result.data ?? []).map((row: any) => {
    const link = Array.isArray(row.student_links) ? row.student_links[0] : row.student_links;
    return { ...row, student_id: link?.student_id ?? null, student_name: link?.student_name ?? null, student_links: undefined };
  });
}

async function syncStudentLinks(ctx: AppContext, state: any) {
  const students = Array.isArray(state?.students) ? state.students : [];
  const ids = students.map((student: any) => String(student.id));
  for (const student of students) {
    const result = await ctx.db.from("student_links").upsert({
      workspace_id: ctx.workspaceId,
      student_id: String(student.id),
      student_name: String(student.name || "Ученик").slice(0, 160),
      updated_at: new Date().toISOString(),
    }, { onConflict: "workspace_id,student_id" });
    if (result.error) throw result.error;
  }
  const existing = await ctx.db.from("student_links").select("id,student_id").eq("workspace_id", ctx.workspaceId);
  if (existing.error) throw existing.error;
  for (const row of existing.data ?? []) {
    if (!ids.includes(String(row.student_id))) {
      const removed = await ctx.db.from("student_links").delete().eq("workspace_id", ctx.workspaceId).eq("id", row.id);
      if (removed.error) throw removed.error;
    }
  }
}

async function upsertNotification(ctx: AppContext, input: {
  studentId?: string;
  kind: string;
  dedupeKey: string;
  text: string;
  status: "review" | "queued";
  source?: Record<string, unknown>;
}) {
  let studentLinkId: string | null = null;
  if (input.studentId) {
    const link = await ctx.db.from("student_links").select("id").eq("workspace_id", ctx.workspaceId).eq("student_id", input.studentId).maybeSingle();
    if (link.error) throw link.error;
    studentLinkId = link.data?.id ?? null;
    // Never fall back to the teacher when a student destination is missing.
    // The next state sync/worker pass can safely create the event after the
    // student index exists.
    if (!studentLinkId) return;
  }
  const result = await ctx.db.from("notification_events").upsert({
    workspace_id: ctx.workspaceId,
    student_link_id: studentLinkId,
    kind: input.kind,
    dedupe_key: input.dedupeKey,
    text: input.text,
    send_at: new Date().toISOString(),
    status: input.status,
    source: input.source ?? {},
    updated_at: new Date().toISOString(),
  }, { onConflict: "workspace_id,dedupe_key", ignoreDuplicates: true });
  if (result.error) throw result.error;
}

async function cancelLessonJobs(ctx: AppContext, lessonId: string) {
  const result = await ctx.db
    .from("notification_events")
    .update({ status: "dismissed", error: "Lesson changed", updated_at: new Date().toISOString() })
    .eq("workspace_id", ctx.workspaceId)
    .in("status", ["review", "queued", "blocked", "failed"])
    .contains("source", { lessonId });
  if (result.error) throw result.error;
}

async function createChangeNotifications(ctx: AppContext, oldState: any, newState: any) {
  const oldLessons = new Map((oldState?.lessons ?? []).map((lesson: any) => [String(lesson.id), lesson]));
  const mode = modeFor(newState, "lesson", "auto");
  if (mode === "off") return;
  const status = mode === "auto" ? "queued" : "review";

  for (const lesson of newState?.lessons ?? []) {
    const student = studentFromState(newState, String(lesson.studentId));
    if (!student) continue;
    const studentName = html(student.name || "Ученик");
    const lessonTitle = html(lesson.title || "Урок английского");
    const previous: any = oldLessons.get(String(lesson.id));
    const when = `${html(lesson.date)} в ${html(lesson.time)}`;
    if (!previous && lesson.status !== "cancelled") {
      await upsertNotification(ctx, {
        studentId: String(student.id), kind: "lesson_created",
        dedupeKey: `lesson-created:${lesson.id}:${lesson.date}:${lesson.time}`,
        text: `${studentName}, занятие запланировано на ${when}. ${lessonTitle}.`,
        status, source: { lessonId: lesson.id, recipient: "student" },
      });
      continue;
    }
    if (!previous) continue;
    const moved = previous.date !== lesson.date || previous.time !== lesson.time;
    const cancelled = previous.status !== "cancelled" && lesson.status === "cancelled";
    if (moved || cancelled) await cancelLessonJobs(ctx, String(lesson.id));
    if (moved && lesson.status !== "cancelled") {
      await upsertNotification(ctx, {
        studentId: String(student.id), kind: "lesson_rescheduled",
        dedupeKey: `lesson-moved:${lesson.id}:${lesson.date}:${lesson.time}`,
        text: `${studentName}, урок перенесён: теперь ${when}.`, status,
        source: { lessonId: lesson.id, recipient: "student", previousDate: previous.date, previousTime: previous.time },
      });
    }
    if (cancelled) {
      await upsertNotification(ctx, {
        studentId: String(student.id), kind: "lesson_cancelled",
        dedupeKey: `lesson-cancelled:${lesson.id}:${lesson.date}:${lesson.time}`,
        text: `${studentName}, урок ${when} отменён.`, status,
        source: { lessonId: lesson.id, recipient: "student" },
      });
    }
  }
}

async function destinationFor(ctx: AppContext, event: any) {
  if (event.student_link_id) {
    const link = await ctx.db.from("student_links").select("telegram_chat_id").eq("workspace_id", ctx.workspaceId).eq("id", event.student_link_id).maybeSingle();
    if (link.error) throw link.error;
    return link.data?.telegram_chat_id ? Number(link.data.telegram_chat_id) : null;
  }
  return Number(ctx.appUser.telegram_user_id || 0) || null;
}

async function deliverNotification(ctx: AppContext, id: string) {
  const eventResult = await ctx.db
    .from("notification_events")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .select("id,student_link_id,text,status,attempts")
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", id)
    .in("status", ["review", "queued", "failed", "blocked"])
    .maybeSingle();
  if (eventResult.error || !eventResult.data) throw eventResult.error ?? new Error("Напоминание уже обрабатывается или отправлено");
  const chatId = await destinationFor(ctx, eventResult.data);
  if (!chatId) {
    const blocked = await ctx.db.from("notification_events").update({ status: "blocked", error: "Telegram is not linked", updated_at: new Date().toISOString() }).eq("workspace_id", ctx.workspaceId).eq("id", id);
    if (blocked.error) throw blocked.error;
    throw new Error("Telegram получателя ещё не подключён");
  }
  try {
    const message = await sendTelegramMessage(chatId, eventResult.data.text);
    const sent = await ctx.db.from("notification_events").update({
      status: "sent", sent_at: new Date().toISOString(), telegram_message_id: message.message_id,
      error: null, updated_at: new Date().toISOString(),
    }).eq("workspace_id", ctx.workspaceId).eq("id", id);
    if (sent.error) throw sent.error;
    return message;
  } catch (error) {
    const failed = await ctx.db.from("notification_events").update({
      status: "failed", attempts: Number(eventResult.data.attempts ?? 0) + 1,
      error: String(error).slice(0, 2_000), updated_at: new Date().toISOString(),
    }).eq("workspace_id", ctx.workspaceId).eq("id", id);
    if (failed.error) console.error("notification failure state update failed", failed.error);
    throw error;
  }
}

async function portalRecord(rawToken: string) {
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(rawToken)) return null;
  const tokenHash = await sha256Hex(rawToken);
  const token = await admin
    .from("student_portal_tokens")
    .select("id,workspace_id,student_link_id,expires_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (token.error || !token.data) return null;
  await admin.from("student_portal_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", token.data.id);
  return token.data;
}

async function portalPayload(rawToken: string) {
  const token = await portalRecord(rawToken);
  if (!token) return null;
  const link = await admin.from("student_links").select("id,student_id,student_name,telegram_chat_id").eq("workspace_id", token.workspace_id).eq("id", token.student_link_id).maybeSingle();
  if (link.error || !link.data) return null;
  const workspace = await admin.from("workspaces").select("name,currency,timezone").eq("id", token.workspace_id).maybeSingle();
  const document = await admin.from("workspace_states").select("state,updated_at").eq("workspace_id", token.workspace_id).maybeSingle();
  const state = document.data?.state ?? {};
  const student = studentFromState(state, String(link.data.student_id));
  if (!student) return null;
  // The workspace state contains private teacher notes, goals, interests and
  // learning diagnostics. Only return the fields rendered in the student's
  // own portal.
  const safeStudent = {
    name: String(student.name || link.data.student_name || "Ученик").slice(0, 160),
    paymentMode: student.paymentMode === "single" ? "single" : "package",
    lessonPrice: Math.max(0, Number(student.lessonPrice ?? 0)),
    balance: Math.max(0, Number(student.balance ?? 0)),
    packageName: String(student.packageName ?? "Абонемент").slice(0, 160),
    packageTotal: Math.max(0, Number(student.packageTotal ?? 0)),
    packageUsed: Math.max(0, Number(student.packageUsed ?? 0)),
  };
  const homework = (Array.isArray(student.homework) ? student.homework : []).slice(0, 50).map((item: any) => ({
    id: String(item.id ?? "").slice(0, 160),
    title: String(item.title ?? "Домашнее задание").slice(0, 500),
    due: String(item.due ?? "").slice(0, 20),
    status: String(item.status ?? "Ожидается").slice(0, 80),
  }));
  const safeLessonLink = (value: unknown) => {
    try {
      const url = new URL(String(value ?? ""));
      return url.protocol === "https:" ? url.toString() : "";
    } catch {
      return "";
    }
  };
  return {
    student: safeStudent,
    teacherName: workspace.data?.name ?? "Преподаватель",
    currency: workspace.data?.currency ?? state?.profile?.currency ?? "RUB",
    lessons: upcomingLessons(state, String(link.data.student_id), workspace.data?.timezone ?? "Europe/Moscow").slice(0, 12).map((lesson: any) => ({
      id: String(lesson.id ?? "").slice(0, 120),
      date: String(lesson.date ?? "").slice(0, 20),
      time: String(lesson.time ?? "").slice(0, 20),
      duration: Math.max(1, Math.min(24 * 60, Number(lesson.duration ?? 60))),
      title: String(lesson.title ?? "Урок английского").replace(/[\r\n]+/g, " ").slice(0, 500),
      link: safeLessonLink(lesson.link), paid: Boolean(lesson.paid), status: String(lesson.status ?? "planned"),
    })),
    homework,
    linkedToTelegram: Boolean(link.data.telegram_chat_id),
    botUsername: botUsername(),
    botLink: `https://t.me/${botUsername()}`,
    updatedAt: document.data?.updated_at ?? null,
  };
}

async function googleConnection(workspaceId: string) {
  const result = await admin.from("calendar_connections").select("id,workspace_id,account_email,calendar_id,refresh_token_ciphertext,revoked_at").eq("workspace_id", workspaceId).is("revoked_at", null).maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}

async function googleAccessToken(connection: any) {
  const refreshToken = await decryptSecret(connection.refresh_token_ciphertext);
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
  if (!clientId || !clientSecret) throw new Error("Google Calendar не настроен на сервере");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(data.error_description || "Google token refresh failed");
  return { token: data.access_token as string, refreshToken };
}

function calendarPayload(lesson: any, state: any, timezone: string) {
  const student = studentFromState(state, String(lesson.studentId));
  const start = `${lesson.date}T${lesson.time}:00`;
  const [hour, minute] = String(lesson.time).split(":").map(Number);
  const endDate = new Date(Date.UTC(2000, 0, 1, hour, minute + Number(lesson.duration || 60)));
  const endTime = `${String(endDate.getUTCHours()).padStart(2,"0")}:${String(endDate.getUTCMinutes()).padStart(2,"0")}`;
  let endDay = lesson.date;
  if (endDate.getUTCDate() > 1) {
    const d = new Date(`${lesson.date}T12:00:00`); d.setDate(d.getDate() + 1);
    endDay = d.toISOString().slice(0, 10);
  }
  return {
    summary: `${lesson.title || "Урок английского"} · ${student?.name || "Ученик"}`,
    description: [`Урок с ${student?.name || "учеником"}`, lesson.link || ""].filter(Boolean).join("\n"),
    start: { dateTime: start, timeZone: timezone },
    end: { dateTime: `${endDay}T${endTime}:00`, timeZone: timezone },
    extendedProperties: { private: { rasmusLessonId: String(lesson.id) } },
  };
}

async function syncGoogleCalendar(ctx: AppContext, oldState: any, newState: any) {
  const connection = await googleConnection(ctx.workspaceId);
  if (!connection) return { connected: false, changed: 0 };
  const { token } = await googleAccessToken(connection);
  const oldLessons = new Map((oldState?.lessons ?? []).map((lesson: any) => [String(lesson.id), lesson]));
  const newLessons = new Map((newState?.lessons ?? []).map((lesson: any) => [String(lesson.id), lesson]));
  const ids = new Set([...oldLessons.keys(), ...newLessons.keys()]);
  let changed = 0;

  for (const lessonId of ids) {
    const previous: any = oldLessons.get(lessonId);
    const lesson: any = newLessons.get(lessonId);
    const comparable = (value: any) => value ? JSON.stringify([value.studentId,value.date,value.time,value.duration,value.title,value.link,value.status]) : "";
    if (comparable(previous) === comparable(lesson)) continue;
    const existing = await admin.from("calendar_event_links").select("provider_event_id,last_payload_hash").eq("workspace_id", ctx.workspaceId).eq("lesson_id", lessonId).maybeSingle();
    if (existing.error) throw existing.error;

    if (!lesson || lesson.status === "cancelled") {
      if (existing.data?.provider_event_id) {
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id || "primary")}/events/${encodeURIComponent(existing.data.provider_event_id)}`, {
          method: "DELETE", headers: { Authorization: `Bearer ${token}` },
        });
        await admin.from("calendar_event_links").delete().eq("workspace_id", ctx.workspaceId).eq("lesson_id", lessonId);
        changed++;
      }
      continue;
    }

    const payload = calendarPayload(lesson, newState, ctx.workspace.timezone || "Europe/Moscow");
    const payloadHash = await sha256Hex(JSON.stringify(payload));
    if (existing.data?.last_payload_hash === payloadHash) continue;
    const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id || "primary")}/events`;
    const response = await fetch(existing.data?.provider_event_id ? `${base}/${encodeURIComponent(existing.data.provider_event_id)}` : base, {
      method: existing.data?.provider_event_id ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok || !data.id) throw new Error(data.error?.message || "Google Calendar sync failed");
    await admin.from("calendar_event_links").upsert({
      workspace_id: ctx.workspaceId, lesson_id: lessonId, provider_event_id: data.id,
      last_payload_hash: payloadHash, synced_at: new Date().toISOString(),
    }, { onConflict: "workspace_id,lesson_id" });
    changed++;
  }
  return { connected: true, changed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: jsonHeaders });
  const body: any = await parseBody(req);
  const action = String(body.action ?? "status");

  try {
    if (action === "portal") {
      const payload = await portalPayload(String(body.token ?? ""));
      return payload ? json({ ok: true, ...payload }) : json({ ok: false, error: "Доступ не найден или срок ссылки истёк" }, 404);
    }

    if (action === "request-reschedule") {
      const token = await portalRecord(String(body.token ?? ""));
      if (!token) return json({ ok: false, error: "Доступ не найден или срок ссылки истёк" }, 404);
      const link = await admin.from("student_links").select("student_name").eq("workspace_id", token.workspace_id).eq("id", token.student_link_id).maybeSingle();
      if (!link.data) return json({ ok: false, error: "Ученик не найден" }, 404);
      const recent = await admin.from("reschedule_requests").select("id").eq("workspace_id", token.workspace_id).eq("student_link_id", token.student_link_id).gte("created_at", new Date(Date.now() - 5 * 60_000).toISOString()).limit(1);
      if ((recent.data ?? []).length) return json({ ok: false, error: "Запрос уже отправлен. Подожди несколько минут" }, 429);
      const note = String(body.note ?? "Хочу перенести ближайший урок").trim().slice(0, 800);
      const inserted = await admin.from("reschedule_requests").insert({
        workspace_id: token.workspace_id, student_link_id: token.student_link_id,
        lesson_id: body.lessonId ? String(body.lessonId).slice(0, 120) : null, note,
      }).select("id").single();
      if (inserted.error) throw inserted.error;
      const owner = await admin.from("workspace_members").select("app_users(telegram_user_id)").eq("workspace_id", token.workspace_id).eq("role", "owner").limit(1).maybeSingle();
      const ownerUser = Array.isArray((owner.data as any)?.app_users) ? (owner.data as any).app_users[0] : (owner.data as any)?.app_users;
      if (ownerUser?.telegram_user_id) {
        try {
          await sendTelegramMessage(ownerUser.telegram_user_id, `🔁 <b>Запрос на перенос</b>\n${html(link.data.student_name)}: ${html(note)}`);
        } catch (notificationError) {
          console.error("reschedule notification failed", notificationError);
        }
      }
      return json({ ok: true, requestId: inserted.data.id });
    }

    const context = await appContext(req);
    if (context instanceof Response) return context;
    const ctx = context;

    if (action === "status") {
      const document = await ctx.db.from("workspace_states").select("revision,updated_at,state").eq("workspace_id", ctx.workspaceId).maybeSingle();
      if (document.error) throw document.error;
      const links = await studentLinks(ctx);
      const queue = await reviewQueue(ctx);
      const snapshot = await ctx.db.from("workspace_snapshots").select("id,expires_at").eq("workspace_id", ctx.workspaceId).is("restored_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (snapshot.error) throw snapshot.error;
      const calendar = await googleConnection(ctx.workspaceId);
      return json({
        ok: true, connected: true, workspace: ctx.workspace, membershipRole: ctx.membershipRole,
        isOwner: Boolean(ctx.workspace.is_primary), isAdmin: ctx.isAdmin,
        onboardingComplete: Boolean(document.data?.state?.profile?.onboardingComplete),
        revision: document.data?.revision ?? 0, updatedAt: document.data?.updated_at ?? null,
        linkedStudents: links.filter((link: any) => link.telegram_chat_id).length,
        students: links.length, pendingReview: queue.length, botUsername: botUsername(),
        restorableSnapshot: snapshot.data ?? null,
        googleCalendar: { connected: Boolean(calendar), accountEmail: calendar?.account_email ?? null },
      });
    }

    if (action === "pull") {
      const document = await ctx.db.from("workspace_states").select("state,revision,updated_at").eq("workspace_id", ctx.workspaceId).maybeSingle();
      if (document.error) throw document.error;
      const links = await studentLinks(ctx);
      const queue = await reviewQueue(ctx);
      const requests = await ctx.db.from("reschedule_requests").select("id,student_link_id,lesson_id,note,status,created_at,student_links(student_id,student_name)").eq("workspace_id", ctx.workspaceId).eq("status", "pending").order("created_at", { ascending: false });
      if (requests.error) throw requests.error;
      const normalizedRequests = (requests.data ?? []).map((row: any) => {
        const link = Array.isArray(row.student_links) ? row.student_links[0] : row.student_links;
        return { id: row.id, student_id: link?.student_id, student_name: link?.student_name, lesson_id: row.lesson_id, note: row.note, status: row.status, created_at: row.created_at };
      });
      return json({ ok: true, state: document.data?.state ?? null, revision: document.data?.revision ?? 0, updatedAt: document.data?.updated_at ?? null, studentLinks: links, notifications: queue, rescheduleRequests: normalizedRequests });
    }

    if (action === "push") {
      const nextState = { ...body.state, version: APP_VERSION };
      const validationError = validateState(nextState);
      if (validationError) return json({ ok: false, error: validationError }, 400);
      const current = await ctx.db.from("workspace_states").select("state,revision").eq("workspace_id", ctx.workspaceId).maybeSingle();
      if (current.error) throw current.error;
      const currentRevision = Number(current.data?.revision ?? 0);
      const baseRevision = body.baseRevision === undefined || body.baseRevision === null ? currentRevision : Number(body.baseRevision);
      if (!body.force && baseRevision !== currentRevision) {
        return json({ ok: false, error: "В облаке есть более свежие данные", code: "REVISION_CONFLICT", revision: currentRevision, state: current.data?.state ?? null }, 409);
      }
      const update = ctx.db.from("workspace_states").update({ state: nextState, revision: currentRevision + 1, updated_at: new Date().toISOString() }).eq("workspace_id", ctx.workspaceId);
      const saved = body.force ? await update.select("revision").maybeSingle() : await update.eq("revision", currentRevision).select("revision").maybeSingle();
      if (saved.error) throw saved.error;
      if (!saved.data) return json({ ok: false, error: "Данные изменились на другом устройстве", code: "REVISION_CONFLICT" }, 409);

      const warnings: string[] = [];
      try { await syncStudentLinks(ctx, nextState); } catch (error) { warnings.push(`student_index:${String(error)}`); }
      try { await createChangeNotifications(ctx, current.data?.state ?? {}, nextState); } catch (error) { warnings.push(`notifications:${String(error)}`); }
      let calendarSync: any = { connected: false, changed: 0 };
      try { calendarSync = await syncGoogleCalendar(ctx, current.data?.state ?? {}, nextState); } catch (error) { warnings.push("Google Calendar синхронизируется позже"); }
      return json({ ok: true, revision: saved.data.revision, studentLinks: await studentLinks(ctx), notifications: await reviewQueue(ctx), calendarSync, warnings });
    }

    if (action === "invite") {
      const studentId = String(body.studentId ?? "");
      const link = await ctx.db.from("student_links").select("id,student_id,student_name,telegram_chat_id,telegram_username").eq("workspace_id", ctx.workspaceId).eq("student_id", studentId).maybeSingle();
      if (link.error) throw link.error;
      if (!link.data) return json({ ok: false, error: "Сначала синхронизируй данные" }, 404);
      const studentToken = randomToken();
      const portalToken = randomToken(32);
      const [studentHash, portalHash] = await Promise.all([sha256Hex(studentToken), sha256Hex(portalToken)]);
      const revokedStudentInvites = await ctx.db.from("student_invites").update({ revoked_at: new Date().toISOString() }).eq("workspace_id", ctx.workspaceId).eq("student_link_id", link.data.id).is("claimed_at", null).is("revoked_at", null);
      if (revokedStudentInvites.error) throw revokedStudentInvites.error;
      const revokedPortalTokens = await ctx.db.from("student_portal_tokens").update({ revoked_at: new Date().toISOString() }).eq("workspace_id", ctx.workspaceId).eq("student_link_id", link.data.id).is("revoked_at", null);
      if (revokedPortalTokens.error) throw revokedPortalTokens.error;
      const studentInvite = await ctx.db.from("student_invites").insert({
        workspace_id: ctx.workspaceId, student_link_id: link.data.id, token_hash: studentHash,
        expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(), created_by: ctx.user.id,
      });
      if (studentInvite.error) throw studentInvite.error;
      const portalInvite = await ctx.db.from("student_portal_tokens").insert({
        workspace_id: ctx.workspaceId, student_link_id: link.data.id, token_hash: portalHash,
        expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(), created_by: ctx.user.id,
      });
      if (portalInvite.error) throw portalInvite.error;
      const portalUrl = new URL(appPublicUrl());
      portalUrl.searchParams.set("portal", portalToken);
      return json({
        ok: true, portalUrl: portalUrl.toString(),
        botLink: `https://t.me/${botUsername()}?start=student_${studentToken}`,
        linked: Boolean(link.data.telegram_chat_id), telegramUsername: link.data.telegram_username,
        studentInviteExpiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
        portalExpiresAt: new Date(Date.now() + 30 * 86400_000).toISOString(),
      });
    }

    if (action === "update-profile") {
      if (ctx.membershipRole !== "owner") return json({ ok: false, error: "Недостаточно прав" }, 403);
      const name = String(body.name ?? ctx.workspace.name ?? "Преподаватель").trim().slice(0, 80) || "Преподаватель";
      const timezone = String(body.timezone ?? ctx.workspace.timezone ?? "Europe/Moscow").trim().slice(0, 80);
      if (!validTimezone(timezone)) return json({ ok: false, error: "Неизвестный часовой пояс" }, 400);
      const currency = allowedCurrency(String(body.currency ?? ctx.workspace.currency ?? "RUB"));
      const update = await ctx.db.from("workspaces").update({ name, timezone, currency, updated_at: new Date().toISOString() }).eq("id", ctx.workspaceId).select("id,name,timezone,currency,is_primary").single();
      if (update.error) throw update.error;
      return json({ ok: true, workspace: update.data });
    }

    if (action === "feedback") {
      const kind = String(body.kind ?? "feedback") === "bug" ? "bug" : "feedback";
      const message = String(body.text ?? "").trim().slice(0, 4_000);
      if (!message) return json({ ok: false, error: "Напиши пару слов" }, 400);
      const recent = await admin.from("beta_feedback").select("id").eq("user_id", ctx.user.id).gte("created_at", new Date(Date.now() - 30_000).toISOString()).limit(1);
      if (recent.error) throw recent.error;
      if ((recent.data ?? []).length) return json({ ok: false, error: "Отзыв уже отправлен. Подожди полминуты" }, 429);
      const technicalId = randomToken(8);
      const inserted = await ctx.db.from("beta_feedback").insert({
        user_id: ctx.user.id, workspace_id: ctx.workspaceId, kind, message,
        screen: String(body.screen ?? "").slice(0, 80), app_version: String(body.version ?? APP_VERSION).slice(0, 40),
        platform: String(body.platform ?? "").slice(0, 120), technical_id: technicalId,
      }).select("id").single();
      if (inserted.error) throw inserted.error;
      const owner = await admin.from("app_users").select("telegram_user_id").eq("platform_role", "admin").eq("beta_status", "active").order("created_at").limit(1).maybeSingle();
      if (owner.data?.telegram_user_id) {
        const label = kind === "bug" ? "🐛 Ошибка" : "💬 Отзыв";
        try {
          await sendTelegramMessage(owner.data.telegram_user_id, `${label} <b>Rasmus Beta</b>\nОт: <b>${html(ctx.workspace.name)}</b>\nЭкран: ${html(body.screen || "не указан")}\nВерсия: ${html(body.version || APP_VERSION)}\nID: <code>${technicalId}</code>\n\n${html(message)}`);
        } catch (notificationError) {
          console.error("feedback notification failed", notificationError);
        }
      }
      return json({ ok: true, feedbackId: inserted.data.id, technicalId });
    }

    if (action === "reset-preview") {
      if (ctx.isAdmin || ctx.workspace.is_primary) return json({ ok: false, error: "Основной кабинет нельзя очистить этой кнопкой" }, 403);
      const document = await ctx.db.from("workspace_states").select("state").eq("workspace_id", ctx.workspaceId).single();
      if (document.error) throw document.error;
      const pending = await ctx.db.from("notification_events").select("id", { count: "exact", head: true }).eq("workspace_id", ctx.workspaceId).in("status", ["review","queued","blocked","failed"]);
      if (pending.error) throw pending.error;
      return json({ ok: true, counts: {
        students: document.data?.state?.students?.length ?? 0,
        lessons: document.data?.state?.lessons?.length ?? 0,
        content: document.data?.state?.content?.length ?? 0,
        pendingNotifications: pending.count ?? 0,
      } });
    }

    if (action === "reset-beta-workspace") {
      if (ctx.isAdmin || ctx.workspace.is_primary) return json({ ok: false, error: "Основной кабинет нельзя очистить этой кнопкой" }, 403);
      if (String(body.confirmation ?? "") !== "ОЧИСТИТЬ") return json({ ok: false, error: "Нужно подтвердить очистку" }, 400);
      const reset = await ctx.db.rpc("rasmus_reset_beta_workspace", {
        p_workspace_id: ctx.workspaceId,
        p_confirmation: String(body.confirmation),
      });
      if (reset.error) throw reset.error;
      return json({ ok: true, ...(reset.data ?? {}) });
    }

    if (action === "restore-last-reset") {
      if (ctx.isAdmin || ctx.workspace.is_primary) return json({ ok: false, error: "Для основного кабинета восстановление beta-сброса не используется" }, 403);
      const restored = await ctx.db.rpc("rasmus_restore_beta_workspace", { p_workspace_id: ctx.workspaceId });
      if (restored.error) {
        if (String(restored.error.message).includes("reset_snapshot_not_found")) return json({ ok: false, error: "Копия для восстановления не найдена" }, 404);
        throw restored.error;
      }
      return json({ ok: true, ...(restored.data ?? {}) });
    }

    if (action === "beta-access") {
      if (!ctx.isAdmin) return json({ ok: false, error: "Только администратор beta может создавать приглашения" }, 403);
      const rawToken = randomToken();
      const tokenHash = await sha256Hex(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 86400_000).toISOString();
      const invite = await ctx.db.from("beta_invites").insert({
        token_hash: tokenHash, label: String(body.label ?? "Участник фокус-группы").slice(0, 120),
        expires_at: expiresAt, created_by: ctx.user.id,
      }).select("id").single();
      if (invite.error) throw invite.error;
      return json({ ok: true, inviteId: invite.data.id, expiresAt, botLink: `https://t.me/${botUsername()}?start=beta_${rawToken}`, guideUrl: `${appPublicUrl()}beta-guide.html` });
    }

    if (action === "beta-admin-summary") {
      if (!ctx.isAdmin) return json({ ok: false, error: "Недостаточно прав" }, 403);
      const users = await admin.from("app_users").select("id,telegram_username,first_name,last_name,beta_status,last_active_at,app_version,platform,created_at").neq("platform_role", "admin").order("created_at", { ascending: false }).limit(100);
      if (users.error) throw users.error;
      const participants = [];
      for (const user of users.data ?? []) {
        const membership = await admin.from("workspace_members").select("workspace_id,workspaces(name)").eq("user_id", user.id).limit(1).maybeSingle();
        const workspaceName = Array.isArray((membership.data as any)?.workspaces) ? (membership.data as any).workspaces[0]?.name : (membership.data as any)?.workspaces?.name;
        const document = membership.data?.workspace_id
          ? await admin.from("workspace_states").select("updated_at,onboarding_complete:state->profile->>onboardingComplete").eq("workspace_id", membership.data.workspace_id).maybeSingle()
          : null;
        participants.push({
          id: user.id, name: [user.first_name,user.last_name].filter(Boolean).join(" ") || workspaceName || "Участник",
          telegramUsername: user.telegram_username, status: user.beta_status,
          onboardingComplete: String(document?.data?.onboarding_complete ?? "false") === "true",
          lastActiveAt: user.last_active_at, workspaceUpdatedAt: document?.data?.updated_at ?? null,
          appVersion: user.app_version, platform: user.platform,
        });
      }
      const feedback = await admin.from("beta_feedback").select("id", { count: "exact", head: true }).eq("status", "new");
      const activeInvites = await admin.from("beta_invites").select("id", { count: "exact", head: true }).is("claimed_at", null).is("revoked_at", null).gt("expires_at", new Date().toISOString());
      return json({ ok: true, participants, newFeedback: feedback.count ?? 0, activeInvites: activeInvites.count ?? 0 });
    }

    if (action === "notification-action") {
      const id = String(body.id ?? "");
      const operation = String(body.operation ?? "");
      if (operation === "dismiss") {
        const dismissed = await ctx.db.from("notification_events").update({ status: "dismissed", updated_at: new Date().toISOString() }).eq("workspace_id", ctx.workspaceId).eq("id", id).select("id").maybeSingle();
        if (dismissed.error) throw dismissed.error;
        if (!dismissed.data) return json({ ok: false, error: "Напоминание не найдено" }, 404);
        return json({ ok: true });
      }
      if (operation === "edit") {
        const text = String(body.text ?? "").trim().slice(0, 4_000);
        if (!text) return json({ ok: false, error: "Текст пуст" }, 400);
        const edited = await ctx.db.from("notification_events").update({ text, updated_at: new Date().toISOString() }).eq("workspace_id", ctx.workspaceId).eq("id", id).select("id").maybeSingle();
        if (edited.error) throw edited.error;
        if (!edited.data) return json({ ok: false, error: "Напоминание не найдено" }, 404);
        return json({ ok: true });
      }
      if (operation === "approve") {
        const update: any = { status: "queued", send_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        if (body.text) update.text = String(body.text).slice(0, 4_000);
        const approved = await ctx.db.from("notification_events").update(update).eq("workspace_id", ctx.workspaceId).eq("id", id).in("status", ["review", "failed", "blocked"]).select("id").maybeSingle();
        if (approved.error) throw approved.error;
        if (!approved.data) return json({ ok: false, error: "Напоминание уже обработано или не найдено" }, 409);
        const message = await deliverNotification(ctx, id);
        return json({ ok: true, sent: true, messageId: message.message_id });
      }
      return json({ ok: false, error: "Неизвестное действие" }, 400);
    }

    if (action === "send-student-test") {
      const studentId = String(body.studentId ?? "");
      const link = await ctx.db.from("student_links").select("student_name,telegram_chat_id").eq("workspace_id", ctx.workspaceId).eq("student_id", studentId).maybeSingle();
      if (link.error || !link.data) return json({ ok: false, error: "Ученик не найден в облаке" }, 404);
      if (!link.data.telegram_chat_id) return json({ ok: false, error: "Ученик ещё не подключил Telegram по персональной ссылке" }, 409);
      const message = await sendTelegramMessage(link.data.telegram_chat_id, `🐾 <b>Тест напоминания Rasmus</b>\n${html(link.data.student_name)}, всё работает — Rasmus сможет напоминать об уроках, домашнем задании и оплате.`);
      return json({ ok: true, messageId: message.message_id });
    }

    if (action === "send-test") {
      const message = await sendTelegramMessage(ctx.appUser.telegram_user_id, "✅ <b>Rasmus подключён.</b>\nТестовое сообщение пришло успешно 🐾");
      return json({ ok: true, messageId: message.message_id });
    }

    if (action === "google-oauth-start") {
      if (ctx.membershipRole !== "owner") return json({ ok: false, error: "Подключить календарь может владелец кабинета" }, 403);
      const clientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
      if (!clientId) return json({ ok: false, error: "Google Calendar ещё не настроен в Rasmus" }, 503);
      const rawState = randomToken(32);
      const stateHash = await sha256Hex(rawState);
      const inserted = await ctx.db.from("calendar_oauth_states").insert({
        workspace_id: ctx.workspaceId, user_id: ctx.user.id, state_hash: stateHash,
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
      if (inserted.error) throw inserted.error;
      const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-oauth-callback`;
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        client_id: clientId, redirect_uri: redirectUri, response_type: "code",
        scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email",
        access_type: "offline", prompt: "consent", include_granted_scopes: "true", state: rawState,
      }).toString();
      return json({ ok: true, url: url.toString() });
    }

    if (action === "google-calendar-status") {
      const connection = await googleConnection(ctx.workspaceId);
      return json({ ok: true, connected: Boolean(connection), accountEmail: connection?.account_email ?? null });
    }

    if (action === "google-calendar-disconnect") {
      if (ctx.membershipRole !== "owner") return json({ ok: false, error: "Недостаточно прав" }, 403);
      const connection = await googleConnection(ctx.workspaceId);
      if (connection) {
        try {
          const refreshToken = await decryptSecret(connection.refresh_token_ciphertext);
          await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: refreshToken }) });
        } catch { /* local disconnect must still succeed */ }
        const disconnected = await admin.from("calendar_connections").update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("workspace_id", ctx.workspaceId).eq("id", connection.id);
        if (disconnected.error) throw disconnected.error;
      }
      return json({ ok: true });
    }

    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (error) {
    console.error("workspace-api", action, error instanceof Error ? error.message : String(error));
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
