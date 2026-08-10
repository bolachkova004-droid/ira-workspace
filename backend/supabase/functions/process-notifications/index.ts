import {
  adminClient,
  appPublicUrl,
  html,
  json,
  jsonHeaders,
  localDateTimeToUtc,
  sendTelegramMessage,
  studentFromState,
} from "../_shared/common.ts";

const admin = adminClient();
type ReminderMode = "auto" | "review" | "off";

function currencySymbol(state: any) {
  const code = String(state?.profile?.currency ?? "RUB");
  return code === "EUR" ? "€" : code === "USD" ? "$" : code === "GBP" ? "£" : code === "KZT" ? "₸" : "₽";
}

function modeFor(state: any, key: string, fallback: ReminderMode): ReminderMode {
  const mode = state?.reminderSettings?.[key];
  return mode === "auto" || mode === "review" || mode === "off" ? mode : fallback;
}

function isoWeek(date = new Date()) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((value.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${value.getUTCFullYear()}-${String(week).padStart(2, "0")}`;
}

function dateInZone(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function ruDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

async function studentLinkId(workspaceId: string, studentId: string) {
  const link = await admin.from("student_links").select("id").eq("workspace_id", workspaceId).eq("student_id", studentId).maybeSingle();
  if (link.error) throw link.error;
  return link.data?.id ?? null;
}

async function createEvent(input: {
  workspaceId: string;
  studentId?: string;
  kind: string;
  dedupeKey: string;
  text: string;
  sendAt: Date;
  mode: ReminderMode;
  source?: Record<string, unknown>;
}) {
  if (input.mode === "off" || !Number.isFinite(input.sendAt.getTime())) return false;
  if (input.sendAt.getTime() < Date.now() - 30 * 60_000) return false;
  const status = input.mode === "auto" ? "queued" : "review";
  const linkId = input.studentId ? await studentLinkId(input.workspaceId, input.studentId) : null;
  // A missing student link must never turn a student reminder into a teacher
  // reminder. It will be retried after the workspace index is synchronized.
  if (input.studentId && !linkId) return false;
  const result = await admin.from("notification_events").upsert({
    workspace_id: input.workspaceId,
    student_link_id: linkId,
    kind: input.kind,
    dedupe_key: input.dedupeKey,
    text: input.text,
    send_at: input.sendAt.toISOString(),
    status,
    source: input.source ?? {},
    updated_at: new Date().toISOString(),
  }, { onConflict: "workspace_id,dedupe_key", ignoreDuplicates: true });
  if (result.error) throw result.error;
  return true;
}

function dayLessons(state: any, date: string) {
  return (Array.isArray(state?.lessons) ? state.lessons : [])
    .filter((lesson: any) => lesson.date === date && lesson.status !== "cancelled")
    .sort((a: any, b: any) => String(a.time).localeCompare(String(b.time)));
}

function dailyText(workspace: any, state: any, date: string) {
  const lessons = dayLessons(state, date);
  const rows = lessons.map((lesson: any) => {
    const student = studentFromState(state, String(lesson.studentId));
    return `• ${html(lesson.time)} — ${html(student?.name || "Ученик")}${lesson.title ? ` · ${html(lesson.title)}` : ""}`;
  });
  const students = Array.isArray(state?.students) ? state.students : [];
  const lowPackages = students.filter((student: any) => student.paymentMode !== "single" && Math.max(0, Number(student.packageTotal ?? 0) - Number(student.packageUsed ?? 0)) <= 2);
  const debts = students.filter((student: any) => Number(student.balance ?? 0) > 0);
  const firstName = String(workspace.name || "Преподаватель").trim().split(/\s+/)[0] || "Преподаватель";
  const notes = [
    lowPackages.length ? `📦 Заканчиваются абонементы: ${lowPackages.length}` : "",
    debts.length ? `💳 Есть задолженность: ${debts.length}` : "",
  ].filter(Boolean).join("\n");
  return `☀️ Доброе утро, ${html(firstName)}!\n\n<b>План на ${html(ruDate(date))}</b>\n${rows.length ? rows.join("\n") : "Сегодня уроков нет."}${notes ? `\n\n${notes}` : ""}`;
}

async function generateForWorkspace(workspace: any, state: any) {
  let created = 0;
  const timezone = workspace.timezone || "Europe/Moscow";
  const studentLessonMode = modeFor(state, "lesson", "auto");
  const teacherLessonMode = modeFor(state, "teacherLesson", "auto");
  const teacherDailyMode = modeFor(state, "teacherDaily", "auto");
  const teacherReportMode = modeFor(state, "teacherReport", "auto");
  const paymentMode = modeFor(state, "payment", "review");
  const homeworkMode = modeFor(state, "homework", "auto");

  for (const lesson of state?.lessons ?? []) {
    if (lesson.status === "cancelled" || lesson.status === "completed") continue;
    const student = studentFromState(state, String(lesson.studentId));
    if (!student?.id || !lesson.date || !lesson.time) continue;
    const startsAt = localDateTimeToUtc(String(lesson.date), String(lesson.time), timezone);
    const label = `${ruDate(String(lesson.date))} в ${lesson.time}`;
    for (const reminder of [
      { suffix: "24h", offset: 24 * 60 * 60_000, text: `${html(student.name)}, напоминаю: завтра в ${html(lesson.time)} у нас урок английского.` },
      { suffix: "2h", offset: 2 * 60 * 60_000, text: `${html(student.name)}, урок начнётся через 2 часа — в ${html(lesson.time)}. До встречи!` },
    ]) {
      if (await createEvent({
        workspaceId: workspace.id, studentId: String(student.id), kind: "lesson_reminder",
        dedupeKey: `lesson-reminder:${lesson.id}:${reminder.suffix}:${lesson.date}:${lesson.time}`,
        text: reminder.text, sendAt: new Date(startsAt.getTime() - reminder.offset), mode: studentLessonMode,
        source: { lessonId: lesson.id, offset: reminder.suffix, recipient: "student" },
      })) created++;
    }
    if (await createEvent({
      workspaceId: workspace.id, kind: "teacher_lesson_reminder",
      dedupeKey: `teacher-lesson:${lesson.id}:30m:${lesson.date}:${lesson.time}`,
      text: `⏰ Через 30 минут урок\n<b>${html(student.name)}</b> · ${html(label)}${lesson.title ? `\n${html(lesson.title)}` : ""}`,
      sendAt: new Date(startsAt.getTime() - 30 * 60_000), mode: teacherLessonMode,
      source: { lessonId: lesson.id, offset: "30m", recipient: "teacher" },
    })) created++;
    if (await createEvent({
      workspaceId: workspace.id, kind: "lesson_report_prompt",
      dedupeKey: `lesson-report:${lesson.id}:${lesson.date}:${lesson.time}`,
      text: `📋 Урок с <b>${html(student.name)}</b> закончился. Заполни короткий отчёт — только после этого занятие спишется из абонемента.`,
      sendAt: new Date(startsAt.getTime() + Number(lesson.duration ?? 60) * 60_000 + 5 * 60_000), mode: teacherReportMode,
      source: { lessonId: lesson.id, recipient: "teacher", action: "report" },
    })) created++;
  }

  const localDate = dateInZone(new Date(), timezone);
  const dailySendAt = localDateTimeToUtc(localDate, "08:00", timezone);
  if (dailySendAt.getTime() >= Date.now() - 30 * 60_000 && dailySendAt.getTime() <= Date.now() + 10 * 60_000) {
    if (await createEvent({ workspaceId: workspace.id, kind: "teacher_daily", dedupeKey: `teacher-daily:${localDate}`, text: dailyText(workspace, state, localDate), sendAt: dailySendAt, mode: teacherDailyMode, source: { date: localDate, recipient: "teacher" } })) created++;
  }

  const week = isoWeek();
  for (const student of state?.students ?? []) {
    const balance = Number(student.balance ?? 0);
    const left = Math.max(0, Number(student.packageTotal ?? 0) - Number(student.packageUsed ?? 0));
    if (balance > 0 || (student.paymentMode !== "single" && left <= 1)) {
      const text = balance > 0
        ? `${html(student.name)}, напоминаю про оплату ${balance.toLocaleString("ru-RU")} ${currencySymbol(state)}. Если уже оплатили — просто не обращай внимания 🙂`
        : `${html(student.name)}, в пакете осталось ${left} занятие. Можно оплатить следующий пакет, чтобы сохранить время в расписании 🙂`;
      if (await createEvent({ workspaceId: workspace.id, studentId: String(student.id), kind: "payment", dedupeKey: `payment:${student.id}:${week}:${balance}:${left}`, text, sendAt: new Date(), mode: paymentMode, source: { balance, lessonsLeft: left, recipient: "student" } })) created++;
    }
    for (const homework of student.homework ?? []) {
      if (homework.status === "Сделано" || !homework.due) continue;
      const dueAt = localDateTimeToUtc(String(homework.due), "18:00", timezone);
      if (await createEvent({
        workspaceId: workspace.id, studentId: String(student.id), kind: "homework",
        dedupeKey: `homework:${student.id}:${homework.id}:${homework.due}`,
        text: `${html(student.name)}, напоминаю про домашнее задание: «${html(homework.title)}». Срок — ${html(ruDate(String(homework.due)))}.`,
        sendAt: new Date(dueAt.getTime() - 24 * 60 * 60_000), mode: homeworkMode,
        source: { homeworkId: homework.id, recipient: "student" },
      })) created++;
    }
  }
  return created;
}

async function destinationFor(event: any) {
  if (event.student_link_id) {
    const link = await admin.from("student_links").select("telegram_chat_id").eq("workspace_id", event.workspace_id).eq("id", event.student_link_id).maybeSingle();
    if (link.error) throw link.error;
    if (!link.data?.telegram_chat_id) return { chatId: null, reason: "Student has not linked Telegram" };
    return { chatId: Number(link.data.telegram_chat_id), reason: null };
  }
  const owner = await admin.from("workspace_members").select("app_users(telegram_user_id,beta_status)").eq("workspace_id", event.workspace_id).eq("role", "owner").limit(1).maybeSingle();
  if (owner.error) throw owner.error;
  const user = Array.isArray((owner.data as any)?.app_users) ? (owner.data as any).app_users[0] : (owner.data as any)?.app_users;
  if (!user?.telegram_user_id || user.beta_status !== "active") return { chatId: null, reason: "Workspace owner Telegram is unavailable" };
  return { chatId: Number(user.telegram_user_id), reason: null };
}

function retryAt(attempts: number) {
  const delayMinutes = Math.min(360, Math.max(5, 5 * 2 ** Math.min(attempts, 6)));
  return new Date(Date.now() + delayMinutes * 60_000).toISOString();
}

async function sendDue() {
  const now = new Date();
  const result = await admin.from("notification_events")
    .select("id,workspace_id,student_link_id,kind,text,status,send_at,next_attempt_at,attempts,source")
    .in("status", ["queued", "blocked", "failed"])
    .lte("send_at", now.toISOString())
    .order("send_at", { ascending: true })
    .limit(200);
  if (result.error) throw result.error;
  const due = (result.data ?? []).filter((event: any) => !event.next_attempt_at || new Date(event.next_attempt_at) <= now).slice(0, 100);
  let sent = 0, blocked = 0, failed = 0, expired = 0;

  for (const event of due) {
    const claimed = await admin.from("notification_events").update({ status: "processing", updated_at: now.toISOString() }).eq("id", event.id).eq("workspace_id", event.workspace_id).in("status", ["queued","blocked","failed"]).select("id").maybeSingle();
    if (claimed.error) throw claimed.error;
    if (!claimed.data) continue;
    const ageMs = Date.now() - new Date(event.send_at).getTime();
    if (["lesson_reminder","teacher_lesson_reminder","teacher_daily","homework","lesson_report_prompt"].includes(event.kind) && ageMs > 6 * 60 * 60_000) {
      const dismissed = await admin.from("notification_events").update({ status: "dismissed", error: "Reminder expired", updated_at: new Date().toISOString() }).eq("id", event.id);
      if (dismissed.error) throw dismissed.error;
      expired++;
      continue;
    }
    const destination = await destinationFor(event);
    if (!destination.chatId) {
      const blockedUpdate = await admin.from("notification_events").update({ status: "blocked", attempts: Number(event.attempts || 0) + 1, next_attempt_at: new Date(Date.now() + 60 * 60_000).toISOString(), error: destination.reason, updated_at: new Date().toISOString() }).eq("id", event.id);
      if (blockedUpdate.error) throw blockedUpdate.error;
      blocked++;
      continue;
    }
    try {
      const extra = event.kind === "lesson_report_prompt" && event.source?.lessonId
        ? { reply_markup: { inline_keyboard: [[{ text: "📋 Заполнить отчёт", web_app: { url: `${appPublicUrl()}?report=${encodeURIComponent(String(event.source.lessonId))}` } }]] } }
        : {};
      const message = await sendTelegramMessage(destination.chatId, event.text, extra);
      const sentUpdate = await admin.from("notification_events").update({ status: "sent", sent_at: new Date().toISOString(), telegram_message_id: message.message_id, error: null, next_attempt_at: null, updated_at: new Date().toISOString() }).eq("id", event.id);
      if (sentUpdate.error) throw sentUpdate.error;
      sent++;
    } catch (error) {
      const attempts = Number(event.attempts || 0) + 1;
      const permanent = /blocked|chat not found|deactivated/i.test(String(error));
      const failedUpdate = await admin.from("notification_events").update({ status: permanent ? "blocked" : "failed", attempts, next_attempt_at: permanent ? new Date(Date.now() + 24 * 60 * 60_000).toISOString() : retryAt(attempts), error: String(error).slice(0, 2_000), updated_at: new Date().toISOString() }).eq("id", event.id);
      if (failedUpdate.error) console.error("notification failure state update failed", failedUpdate.error);
      failed++;
    }
  }
  return { checked: due.length, sent, blocked, failed, expired };
}

async function cleanupExpired() {
  const now = new Date().toISOString();
  const historyBefore = new Date(Date.now() - 90 * 86400_000).toISOString();
  const processingBefore = new Date(Date.now() - 10 * 60_000).toISOString();
  const recovered = await admin.from("notification_events").update({
    status: "failed", next_attempt_at: now, error: "Recovered stale processing lock", updated_at: now,
  }).eq("status", "processing").lt("updated_at", processingBefore).select("id");
  if (recovered.error) throw recovered.error;
  const operations = await Promise.all([
    admin.from("workspace_snapshots").delete().lt("expires_at", now).select("id"),
    admin.from("student_portal_tokens").delete().lt("expires_at", now).select("id"),
    admin.from("student_invites").delete().lt("expires_at", now).select("id"),
    admin.from("calendar_oauth_states").delete().lt("expires_at", now).select("id"),
    admin.from("notification_events").delete().in("status", ["sent", "dismissed"]).lt("updated_at", historyBefore).select("id"),
  ]);
  const error = operations.find((operation) => operation.error)?.error;
  if (error) throw error;
  return {
    deleted: operations.reduce((sum, operation) => sum + (operation.data?.length ?? 0), 0),
    recovered: recovered.data?.length ?? 0,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: jsonHeaders });
  const expected = Deno.env.get("CRON_SECRET") ?? "";
  if (!expected || req.headers.get("x-cron-secret") !== expected) return json({ ok: false, error: "forbidden" }, 403);
  try {
    const maintenance = await cleanupExpired();
    const documents = await admin.from("workspace_states").select("workspace_id,state");
    if (documents.error) throw documents.error;
    let created = 0;
    for (const document of documents.data ?? []) {
      const workspace = await admin.from("workspaces").select("id,name,timezone").eq("id", document.workspace_id).maybeSingle();
      if (workspace.error) throw workspace.error;
      if (workspace.data) created += await generateForWorkspace(workspace.data, document.state);
    }
    const delivery = await sendDue();
    return json({ ok: true, workspaces: documents.data?.length ?? 0, created, maintenance, ...delivery });
  } catch (error) {
    console.error("process-notifications", error instanceof Error ? error.message : String(error));
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
