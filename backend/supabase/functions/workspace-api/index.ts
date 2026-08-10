import {
  adminClient,
  appPublicUrl,
  botUsername,
  json,
  jsonHeaders,
  localDateTimeToUtc,
  sendTelegramMessage,
  studentFromState,
  upcomingLessons,
  verifyTelegramInitData,
} from "../_shared/common.ts";

const db = adminClient();

function telegramHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
}

type Teacher = { id: string; telegram_id: number; name: string; timezone: string };

async function parseBody(req: Request) {
  if (req.method === "GET") return Object.fromEntries(new URL(req.url).searchParams.entries());
  try {
    return await req.json();
  } catch {
    return {};
  }
}

async function authenticatedTeacher(req: Request): Promise<{ teacher: Teacher; user: any } | Response> {
  const checked = await verifyTelegramInitData(req.headers.get("x-telegram-init-data") ?? "");
  if (!checked.ok) return json({ ok: false, error: "Telegram authentication failed", reason: checked.reason }, 401);
  const { data: teacher, error } = await db
    .from("teachers")
    .select("id,telegram_id,name,timezone")
    .eq("telegram_id", checked.user.id)
    .maybeSingle();
  if (error) return json({ ok: false, error: error.message }, 500);
  if (!teacher) return json({ ok: false, error: "Owner is not connected", code: "OWNER_NOT_CLAIMED" }, 403);
  return { teacher: teacher as Teacher, user: checked.user };
}

function modeFor(state: any, key: string, fallback: "auto" | "review" | "off" = "review") {
  const mode = state?.reminderSettings?.[key];
  return mode === "auto" || mode === "review" || mode === "off" ? mode : fallback;
}

async function upsertNotification(input: {
  teacherId: string;
  studentId?: string;
  kind: string;
  dedupeKey: string;
  text: string;
  sendAt?: string;
  status: "review" | "queued";
  source?: Record<string, unknown>;
}) {
  const { error } = await db.from("notification_events").upsert({
    teacher_id: input.teacherId,
    student_id: input.studentId ?? null,
    kind: input.kind,
    dedupe_key: input.dedupeKey,
    text: input.text,
    send_at: input.sendAt ?? new Date().toISOString(),
    status: input.status,
    source: input.source ?? {},
    updated_at: new Date().toISOString(),
  }, { onConflict: "teacher_id,dedupe_key", ignoreDuplicates: true });
  if (error) throw error;
}

async function createChangeNotifications(teacher: Teacher, oldState: any, newState: any) {
  const oldLessons = new Map((oldState?.lessons ?? []).map((l: any) => [String(l.id), l]));
  const mode = modeFor(newState, "lesson", "auto");
  if (mode === "off") return;
  const status = mode === "auto" ? "queued" : "review";

  for (const lesson of newState?.lessons ?? []) {
    const student = studentFromState(newState, String(lesson.studentId));
    if (!student) continue;
    const previous: any = oldLessons.get(String(lesson.id));
    const when = `${lesson.date} в ${lesson.time}`;

    if (!previous && lesson.status !== "cancelled") {
      await upsertNotification({
        teacherId: teacher.id,
        studentId: String(student.id),
        kind: "lesson_created",
        dedupeKey: `lesson-created:${lesson.id}:${lesson.date}:${lesson.time}`,
        text: `${student.name}, занятие запланировано на ${when}. ${lesson.title || "Урок английского"}.`,
        status,
        source: { lessonId: lesson.id },
      });
      continue;
    }
    if (!previous) continue;

    const moved = previous.date !== lesson.date || previous.time !== lesson.time;
    const cancelled = previous.status !== "cancelled" && lesson.status === "cancelled";
    if (moved && lesson.status !== "cancelled") {
      await upsertNotification({
        teacherId: teacher.id,
        studentId: String(student.id),
        kind: "lesson_rescheduled",
        dedupeKey: `lesson-moved:${lesson.id}:${lesson.date}:${lesson.time}`,
        text: `${student.name}, урок перенесён: теперь ${when}.`,
        status,
        source: { lessonId: lesson.id, previousDate: previous.date, previousTime: previous.time },
      });
    }
    if (cancelled) {
      await upsertNotification({
        teacherId: teacher.id,
        studentId: String(student.id),
        kind: "lesson_cancelled",
        dedupeKey: `lesson-cancelled:${lesson.id}:${lesson.date}:${lesson.time}`,
        text: `${student.name}, урок ${when} отменён.`,
        status,
        source: { lessonId: lesson.id },
      });
    }
  }
}

async function syncStudentLinks(teacherId: string, state: any) {
  const students = Array.isArray(state?.students) ? state.students : [];
  const ids = students.map((s: any) => String(s.id));
  for (const student of students) {
    const { error } = await db.from("student_links").upsert({
      teacher_id: teacherId,
      student_id: String(student.id),
      student_name: String(student.name || "Ученик"),
      updated_at: new Date().toISOString(),
    }, { onConflict: "teacher_id,student_id" });
    if (error) throw error;
  }
  const { data: existing } = await db.from("student_links").select("student_id").eq("teacher_id", teacherId);
  for (const row of existing ?? []) {
    if (!ids.includes(String(row.student_id))) {
      await db.from("student_links").delete().eq("teacher_id", teacherId).eq("student_id", row.student_id);
    }
  }
}

async function reviewQueue(teacherId: string) {
  const { data, error } = await db
    .from("notification_events")
    .select("id,student_id,kind,text,send_at,status,created_at,source")
    .eq("teacher_id", teacherId)
    .eq("status", "review")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

async function studentLinks(teacherId: string) {
  const { data, error } = await db
    .from("student_links")
    .select("student_id,student_name,portal_token,telegram_chat_id,telegram_username,linked_at")
    .eq("teacher_id", teacherId);
  if (error) throw error;
  return data ?? [];
}

async function deliverNotification(teacherId: string, id: string) {
  const { data: event, error } = await db
    .from("notification_events")
    .select("id,student_id,text,status")
    .eq("teacher_id", teacherId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!event) throw new Error("Notification not found");

  let chatId: number | null = null;
  if (event.student_id) {
    const { data: link } = await db
      .from("student_links")
      .select("telegram_chat_id")
      .eq("teacher_id", teacherId)
      .eq("student_id", event.student_id)
      .maybeSingle();
    chatId = link?.telegram_chat_id ?? null;
    if (!chatId) {
      await db.from("notification_events").update({ status: "blocked", error: "Student has not linked Telegram", updated_at: new Date().toISOString() }).eq("id", id);
      throw new Error("Ученик ещё не подключил Telegram");
    }
  } else {
    const { data: teacher } = await db.from("teachers").select("telegram_id").eq("id", teacherId).maybeSingle();
    chatId = teacher?.telegram_id ?? null;
    if (!chatId) throw new Error("Telegram преподавателя не найден");
  }

  try {
    const message = await sendTelegramMessage(chatId, event.text);
    await db.from("notification_events").update({
      status: "sent",
      sent_at: new Date().toISOString(),
      telegram_message_id: message.message_id,
      error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    return message;
  } catch (error) {
    await db.from("notification_events").update({ status: "failed", error: String(error), updated_at: new Date().toISOString() }).eq("id", id);
    throw error;
  }
}

async function portalPayload(token: string) {
  const { data: link, error } = await db
    .from("student_links")
    .select("teacher_id,student_id,student_name,portal_token,telegram_chat_id")
    .eq("portal_token", token)
    .maybeSingle();
  if (error) throw error;
  if (!link) return null;
  const { data: workspace } = await db.from("workspace_states").select("state,revision,updated_at").eq("teacher_id", link.teacher_id).maybeSingle();
  const state = workspace?.state ?? {};
  const student = studentFromState(state, String(link.student_id));
  if (!student) return null;
  return {
    student,
    lessons: upcomingLessons(state, String(link.student_id)).slice(0, 12).map((l: any) => ({
      id: l.id,
      date: l.date,
      time: l.time,
      duration: l.duration,
      title: l.title,
      link: l.link,
      paid: l.paid,
      status: l.status,
    })),
    homework: student.homework ?? [],
    linkedToTelegram: Boolean(link.telegram_chat_id),
    botUsername: botUsername(),
    botLink: `https://t.me/${botUsername()}?start=student_${link.portal_token}`,
    updatedAt: workspace?.updated_at ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: jsonHeaders });
  const body: any = await parseBody(req);
  const action = String(body.action ?? "status");

  try {
    if (action === "claim-owner") {
      const checked = await verifyTelegramInitData(req.headers.get("x-telegram-init-data") ?? "");
      if (!checked.ok) return json({ ok: false, error: "Telegram authentication failed", reason: checked.reason }, 401);
      const expected = Deno.env.get("OWNER_SETUP_CODE");
      if (!expected || String(body.setupCode ?? "") !== expected) return json({ ok: false, error: "Неверный код подключения" }, 403);

      const { data: current } = await db.from("teachers").select("id,telegram_id,name,timezone").limit(1).maybeSingle();
      if (current && Number(current.telegram_id) !== Number(checked.user.id)) {
        return json({ ok: false, error: "Владелец уже подключён" }, 409);
      }
      let teacher = current;
      if (!teacher) {
        const fullName = [checked.user.first_name, checked.user.last_name].filter(Boolean).join(" ") || "Ира";
        const inserted = await db.from("teachers").insert({ telegram_id: checked.user.id, name: fullName }).select("id,telegram_id,name,timezone").single();
        if (inserted.error) throw inserted.error;
        teacher = inserted.data;
        await db.from("workspace_states").insert({ teacher_id: teacher.id, state: {}, revision: 0 });
      }
      return json({ ok: true, teacher });
    }

    if (action === "portal") {
      const payload = await portalPayload(String(body.token ?? ""));
      if (!payload) return json({ ok: false, error: "Доступ не найден" }, 404);
      return json({ ok: true, ...payload });
    }

    if (action === "request-reschedule") {
      const token = String(body.token ?? "");
      const { data: link } = await db.from("student_links").select("teacher_id,student_id,student_name").eq("portal_token", token).maybeSingle();
      if (!link) return json({ ok: false, error: "Доступ не найден" }, 404);
      const { data: request, error } = await db.from("reschedule_requests").insert({
        teacher_id: link.teacher_id,
        student_id: link.student_id,
        lesson_id: body.lessonId ? String(body.lessonId) : null,
        note: String(body.note ?? "Хочу перенести ближайший урок"),
      }).select("id").single();
      if (error) throw error;
      const { data: teacher } = await db.from("teachers").select("telegram_id").eq("id", link.teacher_id).single();
      if (teacher?.telegram_id) {
        await sendTelegramMessage(teacher.telegram_id, `🔁 <b>Запрос на перенос</b>\n${telegramHtml(link.student_name)}: ${telegramHtml(body.note ?? "Хочу перенести ближайший урок")}`);
      }
      return json({ ok: true, requestId: request.id });
    }

    const auth = await authenticatedTeacher(req);
    if (auth instanceof Response) return auth;
    const { teacher } = auth;

    if (action === "status") {
      const { data: workspace } = await db.from("workspace_states").select("revision,updated_at").eq("teacher_id", teacher.id).maybeSingle();
      const links = await studentLinks(teacher.id);
      const queue = await reviewQueue(teacher.id);
      return json({ ok: true, connected: true, teacher, revision: workspace?.revision ?? 0, updatedAt: workspace?.updated_at ?? null, linkedStudents: links.filter((x: any) => x.telegram_chat_id).length, students: links.length, pendingReview: queue.length, botUsername: botUsername() });
    }

    if (action === "pull") {
      const { data: workspace, error } = await db.from("workspace_states").select("state,revision,updated_at").eq("teacher_id", teacher.id).maybeSingle();
      if (error) throw error;
      const links = await studentLinks(teacher.id);
      const queue = await reviewQueue(teacher.id);
      const { data: requests } = await db.from("reschedule_requests").select("id,student_id,lesson_id,note,status,created_at").eq("teacher_id", teacher.id).eq("status", "pending").order("created_at", { ascending: false });
      return json({ ok: true, state: workspace?.state ?? null, revision: workspace?.revision ?? 0, updatedAt: workspace?.updated_at ?? null, studentLinks: links, notifications: queue, rescheduleRequests: requests ?? [] });
    }

    if (action === "push") {
      const nextState = body.state;
      if (!nextState || !Array.isArray(nextState.students) || !Array.isArray(nextState.lessons)) return json({ ok: false, error: "Некорректные данные" }, 400);
      const { data: current, error: currentError } = await db.from("workspace_states").select("state,revision").eq("teacher_id", teacher.id).maybeSingle();
      if (currentError) throw currentError;
      const currentRevision = Number(current?.revision ?? 0);
      const baseRevision = body.baseRevision === undefined || body.baseRevision === null ? currentRevision : Number(body.baseRevision);
      if (!body.force && baseRevision !== currentRevision) {
        return json({ ok: false, error: "В облаке есть более свежие данные", code: "REVISION_CONFLICT", revision: currentRevision, state: current?.state ?? null }, 409);
      }
      await createChangeNotifications(teacher, current?.state ?? {}, nextState);
      await syncStudentLinks(teacher.id, nextState);
      const revision = currentRevision + 1;
      const { error } = await db.from("workspace_states").upsert({ teacher_id: teacher.id, state: nextState, revision, updated_at: new Date().toISOString() }, { onConflict: "teacher_id" });
      if (error) throw error;
      return json({ ok: true, revision, studentLinks: await studentLinks(teacher.id), notifications: await reviewQueue(teacher.id) });
    }

    if (action === "invite") {
      const studentId = String(body.studentId ?? "");
      const { data: link, error } = await db.from("student_links").select("student_id,student_name,portal_token,telegram_chat_id,telegram_username").eq("teacher_id", teacher.id).eq("student_id", studentId).maybeSingle();
      if (error) throw error;
      if (!link) return json({ ok: false, error: "Сначала синхронизируй данные" }, 404);
      const portalUrl = new URL(appPublicUrl());
      portalUrl.searchParams.set("portal", link.portal_token);
      const projectUrl = Deno.env.get("SUPABASE_URL") ?? "";
      if (projectUrl) portalUrl.searchParams.set("api", `${projectUrl}/functions/v1/workspace-api`);
      return json({
        ok: true,
        portalUrl: portalUrl.toString(),
        botLink: `https://t.me/${botUsername()}?start=student_${link.portal_token}`,
        linked: Boolean(link.telegram_chat_id),
        telegramUsername: link.telegram_username,
      });
    }

    if (action === "notification-action") {
      const id = String(body.id ?? "");
      const operation = String(body.operation ?? "");
      if (operation === "dismiss") {
        await db.from("notification_events").update({ status: "dismissed", updated_at: new Date().toISOString() }).eq("teacher_id", teacher.id).eq("id", id);
        return json({ ok: true });
      }
      if (operation === "edit") {
        const text = String(body.text ?? "").trim();
        if (!text) return json({ ok: false, error: "Текст пуст" }, 400);
        await db.from("notification_events").update({ text, updated_at: new Date().toISOString() }).eq("teacher_id", teacher.id).eq("id", id);
        return json({ ok: true });
      }
      if (operation === "approve") {
        if (body.text) await db.from("notification_events").update({ text: String(body.text), status: "queued", send_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("teacher_id", teacher.id).eq("id", id);
        else await db.from("notification_events").update({ status: "queued", send_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("teacher_id", teacher.id).eq("id", id);
        const message = await deliverNotification(teacher.id, id);
        return json({ ok: true, sent: true, messageId: message.message_id });
      }
      return json({ ok: false, error: "Неизвестное действие" }, 400);
    }


    if (action === "send-student-test") {
      const studentId = String(body.studentId ?? "");
      const { data: link, error } = await db
        .from("student_links")
        .select("student_name,telegram_chat_id")
        .eq("teacher_id", teacher.id)
        .eq("student_id", studentId)
        .maybeSingle();
      if (error) throw error;
      if (!link) return json({ ok: false, error: "Ученик не найден в облаке" }, 404);
      if (!link.telegram_chat_id) return json({ ok: false, error: "Ученик ещё не подключил Telegram по персональной ссылке" }, 409);
      const message = await sendTelegramMessage(
        link.telegram_chat_id,
        `🐾 <b>Тест напоминания Rasmus</b>
${telegramHtml(link.student_name)}, всё работает — Расмус сможет напоминать об уроках, домашнем задании и оплате.`,
      );
      return json({ ok: true, messageId: message.message_id });
    }

    if (action === "configure-bot") {
      const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
      const secret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
      const projectUrl = Deno.env.get("SUPABASE_URL");
      if (!token || !secret || !projectUrl) return json({ ok: false, error: "Не заполнены секреты Telegram" }, 500);
      const api = async (method: string, payload: Record<string, unknown>) => {
        const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.description || method);
        return result.result;
      };
      const me = await api("getMe", {});
      await api("setWebhook", { url: `${projectUrl}/functions/v1/telegram-webhook`, secret_token: secret, allowed_updates: ["message", "callback_query"] });
      await api("setMyName", { name: "Rasmus" });
      await api("setMyDescription", { description: "Rasmus помогает преподавателю вести расписание, учеников, абонементы и напоминания." });
      await api("setMyShortDescription", { short_description: "Расписание, ученики и напоминания преподавателя 🐾" });
      await api("setMyCommands", { commands: [
        { command: "schedule", description: "Ближайшие уроки" },
        { command: "payment", description: "Оплата и пакет" },
        { command: "homework", description: "Домашнее задание" },
        { command: "help", description: "Что умеет бот" },
      ] });
      await api("setChatMenuButton", { chat_id: teacher.telegram_id, menu_button: { type: "web_app", text: "Открыть Rasmus", web_app: { url: appPublicUrl() } } });
      const cronSecret = Deno.env.get("CRON_SECRET");
      if (!cronSecret) return json({ ok: false, error: "CRON_SECRET is not set" }, 500);
      const cronResult = await db.rpc("install_ira_notification_cron", { p_project_url: projectUrl, p_cron_secret: cronSecret });
      if (cronResult.error) throw cronResult.error;
      return json({ ok: true, bot: me, webhookUrl: `${projectUrl}/functions/v1/telegram-webhook`, cronInstalled: true });
    }

    if (action === "send-test") {
      const message = await sendTelegramMessage(teacher.telegram_id, "✅ <b>Rasmus подключён.</b>\nТестовое сообщение пришло успешно 🐾");
      return json({ ok: true, messageId: message.message_id });
    }

    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (error) {
    console.error(error);
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
