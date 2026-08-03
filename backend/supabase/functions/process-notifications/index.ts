import {
  adminClient,
  json,
  jsonHeaders,
  localDateTimeToUtc,
  sendTelegramMessage,
  studentFromState,
} from "../_shared/common.ts";

const db = adminClient();

function modeFor(state: any, key: string, fallback: "auto" | "review" | "off") {
  const mode = state?.reminderSettings?.[key];
  return mode === "auto" || mode === "review" || mode === "off" ? mode : fallback;
}

function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-${String(week).padStart(2, "0")}`;
}

async function createEvent(input: {
  teacherId: string;
  studentId: string;
  kind: string;
  dedupeKey: string;
  text: string;
  sendAt: Date;
  mode: "auto" | "review" | "off";
  source?: Record<string, unknown>;
}) {
  if (input.mode === "off") return false;
  // Do not resurrect old reminders when cloud sync is enabled for the first time.
  if (input.sendAt.getTime() < Date.now() - 30 * 60_000) return false;
  const status = input.mode === "auto" ? "queued" : "review";
  const { error } = await db.from("notification_events").upsert({
    teacher_id: input.teacherId,
    student_id: input.studentId,
    kind: input.kind,
    dedupe_key: input.dedupeKey,
    text: input.text,
    send_at: input.sendAt.toISOString(),
    status,
    source: input.source ?? {},
    updated_at: new Date().toISOString(),
  }, { onConflict: "teacher_id,dedupe_key", ignoreDuplicates: true });
  if (error) throw error;
  return true;
}

async function generateForWorkspace(teacher: any, state: any) {
  let created = 0;
  const timezone = teacher.timezone || "Europe/Moscow";
  const lessonMode = modeFor(state, "lesson", "auto");
  const paymentMode = modeFor(state, "payment", "review");
  const homeworkMode = modeFor(state, "homework", "auto");

  for (const lesson of state?.lessons ?? []) {
    if (lesson.status === "cancelled" || lesson.status === "completed") continue;
    const student = studentFromState(state, String(lesson.studentId));
    if (!student?.id || !lesson.date || !lesson.time) continue;
    const startsAt = localDateTimeToUtc(String(lesson.date), String(lesson.time), timezone);
    const label = `${new Date(`${lesson.date}T12:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} в ${lesson.time}`;
    const reminders = [
      { suffix: "24h", offset: 24 * 60 * 60_000, text: `${student.name}, напоминаю: завтра ${label} у нас урок английского.` },
      { suffix: "1h", offset: 60 * 60_000, text: `${student.name}, урок начнётся через час — в ${lesson.time}. До встречи!` },
    ];
    for (const reminder of reminders) {
      const wasCreated = await createEvent({
        teacherId: teacher.id,
        studentId: String(student.id),
        kind: "lesson_reminder",
        dedupeKey: `lesson-reminder:${lesson.id}:${reminder.suffix}:${lesson.date}:${lesson.time}`,
        text: reminder.text,
        sendAt: new Date(startsAt.getTime() - reminder.offset),
        mode: lessonMode,
        source: { lessonId: lesson.id, offset: reminder.suffix },
      });
      if (wasCreated) created++;
    }
  }

  const week = isoWeek();
  for (const student of state?.students ?? []) {
    const balance = Number(student.balance ?? 0);
    const left = Math.max(0, Number(student.packageTotal ?? 0) - Number(student.packageUsed ?? 0));
    if (balance > 0 || left <= 1) {
      const paymentText = balance > 0
        ? `${student.name}, напоминаю про оплату ${balance.toLocaleString("ru-RU")} ₽. Если уже оплатили — просто не обращай внимания 🙂`
        : `${student.name}, в пакете осталось ${left} занятие. Можно оплатить следующий пакет, чтобы сохранить время в расписании 🙂`;
      const wasCreated = await createEvent({
        teacherId: teacher.id,
        studentId: String(student.id),
        kind: "payment",
        dedupeKey: `payment:${student.id}:${week}:${balance}:${left}`,
        text: paymentText,
        sendAt: new Date(),
        mode: paymentMode,
        source: { balance, lessonsLeft: left },
      });
      if (wasCreated) created++;
    }

    for (const homework of student.homework ?? []) {
      if (homework.status === "Сделано" || !homework.due) continue;
      const dueAt = localDateTimeToUtc(String(homework.due), "18:00", timezone);
      const sendAt = new Date(dueAt.getTime() - 24 * 60 * 60_000);
      const wasCreated = await createEvent({
        teacherId: teacher.id,
        studentId: String(student.id),
        kind: "homework",
        dedupeKey: `homework:${student.id}:${homework.id}:${homework.due}`,
        text: `${student.name}, напоминаю про домашнее задание: «${homework.title}». Срок — ${new Date(`${homework.due}T12:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}.`,
        sendAt,
        mode: homeworkMode,
        source: { homeworkId: homework.id },
      });
      if (wasCreated) created++;
    }
  }
  return created;
}

async function sendDue() {
  const { data: events, error } = await db
    .from("notification_events")
    .select("id,teacher_id,student_id,text,status,send_at")
    .in("status", ["queued", "blocked"])
    .lte("send_at", new Date().toISOString())
    .order("send_at", { ascending: true })
    .limit(100);
  if (error) throw error;

  let sent = 0;
  let blocked = 0;
  let failed = 0;
  for (const event of events ?? []) {
    const { data: link } = await db
      .from("student_links")
      .select("telegram_chat_id")
      .eq("teacher_id", event.teacher_id)
      .eq("student_id", event.student_id)
      .maybeSingle();
    if (!link?.telegram_chat_id) {
      await db.from("notification_events").update({ status: "blocked", error: "Student has not linked Telegram", updated_at: new Date().toISOString() }).eq("id", event.id);
      blocked++;
      continue;
    }
    try {
      const message = await sendTelegramMessage(link.telegram_chat_id, event.text, { parse_mode: undefined });
      await db.from("notification_events").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        telegram_message_id: message.message_id,
        error: null,
        updated_at: new Date().toISOString(),
      }).eq("id", event.id);
      sent++;
    } catch (error) {
      await db.from("notification_events").update({ status: "failed", error: String(error), updated_at: new Date().toISOString() }).eq("id", event.id);
      failed++;
    }
  }
  return { checked: events?.length ?? 0, sent, blocked, failed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: jsonHeaders });
  const expected = Deno.env.get("CRON_SECRET");
  if (expected && req.headers.get("x-cron-secret") !== expected) return json({ ok: false, error: "forbidden" }, 403);

  try {
    const { data: rows, error } = await db.from("workspace_states").select("teacher_id,state,teachers(id,timezone)");
    if (error) throw error;
    let created = 0;
    for (const row of rows ?? []) {
      const teacher = Array.isArray((row as any).teachers) ? (row as any).teachers[0] : (row as any).teachers;
      if (teacher) created += await generateForWorkspace(teacher, row.state);
    }
    const delivery = await sendDue();
    return json({ ok: true, workspaces: rows?.length ?? 0, created, ...delivery });
  } catch (error) {
    console.error(error);
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
