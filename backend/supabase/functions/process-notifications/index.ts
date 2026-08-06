import {
  adminClient,
  json,
  jsonHeaders,
  localDateTimeToUtc,
  sendTelegramMessage,
  studentFromState,
} from "../_shared/common.ts";

const db = adminClient();

type ReminderMode = "auto" | "review" | "off";

function html(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]!));
}

function modeFor(state: any, key: string, fallback: ReminderMode): ReminderMode {
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

function dateInZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function ruDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}

function teacherFirstName(teacher: any) {
  return String(teacher?.name || "Ира").trim().split(/\s+/)[0] || "Ира";
}

async function createEvent(input: {
  teacherId: string;
  studentId?: string;
  kind: string;
  dedupeKey: string;
  text: string;
  sendAt: Date;
  mode: ReminderMode;
  source?: Record<string, unknown>;
}) {
  if (input.mode === "off") return false;
  // Do not resurrect old reminders when cloud sync is enabled for the first time.
  if (input.sendAt.getTime() < Date.now() - 30 * 60_000) return false;
  const status = input.mode === "auto" ? "queued" : "review";
  const { error } = await db.from("notification_events").upsert({
    teacher_id: input.teacherId,
    student_id: input.studentId ?? null,
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

function dayLessons(state: any, date: string) {
  return (Array.isArray(state?.lessons) ? state.lessons : [])
    .filter((lesson: any) => lesson.date === date && lesson.status !== "cancelled")
    .sort((a: any, b: any) => String(a.time).localeCompare(String(b.time)));
}

function teacherDailyText(teacher: any, state: any, date: string) {
  const lessons = dayLessons(state, date);
  const rows = lessons.map((lesson: any) => {
    const student = studentFromState(state, String(lesson.studentId));
    return `• ${html(lesson.time)} — ${html(student?.name || "Ученик")}${lesson.title ? ` · ${html(lesson.title)}` : ""}`;
  });
  const students = Array.isArray(state?.students) ? state.students : [];
  const lowPackages = students.filter((student: any) => {
    if (student.paymentMode === "single") return false;
    const left = Math.max(0, Number(student.packageTotal ?? 0) - Number(student.packageUsed ?? 0));
    return left <= 2;
  });
  const debts = students.filter((student: any) => Number(student.balance ?? 0) > 0);
  const name = teacherFirstName(teacher);
  const schedule = rows.length ? `${rows.join("\n")}` : "Сегодня уроков нет.";
  const notes = [
    lowPackages.length ? `📦 Заканчиваются абонементы: ${lowPackages.length}` : "",
    debts.length ? `💳 Есть задолженность: ${debts.length}` : "",
  ].filter(Boolean).join("\n");
  return `☀️ Доброе утро, ${html(name)}!\n\n<b>План на ${html(ruDate(date))}</b>\n${schedule}${notes ? `\n\n${notes}` : ""}`;
}

async function generateForWorkspace(teacher: any, state: any) {
  let created = 0;
  const timezone = teacher.timezone || "Europe/Moscow";
  const studentLessonMode = modeFor(state, "lesson", "auto");
  const teacherLessonMode = modeFor(state, "teacherLesson", "auto");
  const teacherDailyMode = modeFor(state, "teacherDaily", "auto");
  const paymentMode = modeFor(state, "payment", "review");
  const homeworkMode = modeFor(state, "homework", "auto");

  for (const lesson of state?.lessons ?? []) {
    if (lesson.status === "cancelled" || lesson.status === "completed") continue;
    const student = studentFromState(state, String(lesson.studentId));
    if (!student?.id || !lesson.date || !lesson.time) continue;
    const startsAt = localDateTimeToUtc(String(lesson.date), String(lesson.time), timezone);
    const label = `${ruDate(String(lesson.date))} в ${lesson.time}`;
    const reminders = [
      { suffix: "24h", offset: 24 * 60 * 60_000, text: `${html(student.name)}, напоминаю: завтра в ${html(lesson.time)} у нас урок английского.` },
      { suffix: "2h", offset: 2 * 60 * 60_000, text: `${html(student.name)}, урок начнётся через 2 часа — в ${html(lesson.time)}. До встречи!` },
    ];
    for (const reminder of reminders) {
      const wasCreated = await createEvent({
        teacherId: teacher.id,
        studentId: String(student.id),
        kind: "lesson_reminder",
        dedupeKey: `lesson-reminder:${lesson.id}:${reminder.suffix}:${lesson.date}:${lesson.time}`,
        text: reminder.text,
        sendAt: new Date(startsAt.getTime() - reminder.offset),
        mode: studentLessonMode,
        source: { lessonId: lesson.id, offset: reminder.suffix, recipient: "student" },
      });
      if (wasCreated) created++;
    }

    const teacherCreated = await createEvent({
      teacherId: teacher.id,
      kind: "teacher_lesson_reminder",
      dedupeKey: `teacher-lesson:${lesson.id}:30m:${lesson.date}:${lesson.time}`,
      text: `⏰ Через 30 минут урок\n<b>${html(student.name)}</b> · ${html(label)}${lesson.title ? `\n${html(lesson.title)}` : ""}`,
      sendAt: new Date(startsAt.getTime() - 30 * 60_000),
      mode: teacherLessonMode,
      source: { lessonId: lesson.id, offset: "30m", recipient: "teacher" },
    });
    if (teacherCreated) created++;
  }

  const currentLocalDate = dateInZone(new Date(), timezone);
  const dailySendAt = localDateTimeToUtc(currentLocalDate, "08:00", timezone);
  const nowMs = Date.now();
  // Create the daily card close to delivery time so it contains the latest schedule.
  if (dailySendAt.getTime() >= nowMs - 30 * 60_000 && dailySendAt.getTime() <= nowMs + 10 * 60_000) {
    const dailyCreated = await createEvent({
      teacherId: teacher.id,
      kind: "teacher_daily",
      dedupeKey: `teacher-daily:${currentLocalDate}`,
      text: teacherDailyText(teacher, state, currentLocalDate),
      sendAt: dailySendAt,
      mode: teacherDailyMode,
      source: { date: currentLocalDate, recipient: "teacher" },
    });
    if (dailyCreated) created++;
  }

  const week = isoWeek();
  for (const student of state?.students ?? []) {
    const balance = Number(student.balance ?? 0);
    const left = Math.max(0, Number(student.packageTotal ?? 0) - Number(student.packageUsed ?? 0));
    if (balance > 0 || (student.paymentMode !== "single" && left <= 1)) {
      const paymentText = balance > 0
        ? `${html(student.name)}, напоминаю про оплату ${balance.toLocaleString("ru-RU")} ₽. Если уже оплатили — просто не обращай внимания 🙂`
        : `${html(student.name)}, в пакете осталось ${left} занятие. Можно оплатить следующий пакет, чтобы сохранить время в расписании 🙂`;
      const wasCreated = await createEvent({
        teacherId: teacher.id,
        studentId: String(student.id),
        kind: "payment",
        dedupeKey: `payment:${student.id}:${week}:${balance}:${left}`,
        text: paymentText,
        sendAt: new Date(),
        mode: paymentMode,
        source: { balance, lessonsLeft: left, recipient: "student" },
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
        text: `${html(student.name)}, напоминаю про домашнее задание: «${html(homework.title)}». Срок — ${html(ruDate(String(homework.due)))}.`,
        sendAt,
        mode: homeworkMode,
        source: { homeworkId: homework.id, recipient: "student" },
      });
      if (wasCreated) created++;
    }
  }
  return created;
}

async function destinationFor(event: any) {
  if (event.student_id) {
    const { data: link } = await db
      .from("student_links")
      .select("telegram_chat_id")
      .eq("teacher_id", event.teacher_id)
      .eq("student_id", event.student_id)
      .maybeSingle();
    if (!link?.telegram_chat_id) return { chatId: null, reason: "Student has not linked Telegram" };
    return { chatId: link.telegram_chat_id, reason: null };
  }
  const { data: teacher } = await db.from("teachers").select("telegram_id").eq("id", event.teacher_id).maybeSingle();
  if (!teacher?.telegram_id) return { chatId: null, reason: "Teacher Telegram is unavailable" };
  return { chatId: teacher.telegram_id, reason: null };
}

async function sendDue() {
  const { data: events, error } = await db
    .from("notification_events")
    .select("id,teacher_id,student_id,kind,text,status,send_at")
    .in("status", ["queued", "blocked"])
    .lte("send_at", new Date().toISOString())
    .order("send_at", { ascending: true })
    .limit(100);
  if (error) throw error;

  let sent = 0;
  let blocked = 0;
  let failed = 0;
  for (const event of events ?? []) {
    const ageMs = Date.now() - new Date(event.send_at).getTime();
    if (["lesson_reminder", "teacher_lesson_reminder", "teacher_daily", "homework"].includes(event.kind) && ageMs > 6 * 60 * 60_000) {
      await db.from("notification_events").update({ status: "dismissed", error: "Reminder expired", updated_at: new Date().toISOString() }).eq("id", event.id);
      continue;
    }
    const destination = await destinationFor(event);
    if (!destination.chatId) {
      await db.from("notification_events").update({ status: "blocked", error: destination.reason, updated_at: new Date().toISOString() }).eq("id", event.id);
      blocked++;
      continue;
    }
    try {
      const message = await sendTelegramMessage(destination.chatId, event.text);
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
    const { data: rows, error } = await db.from("workspace_states").select("teacher_id,state,teachers(id,name,timezone)");
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
