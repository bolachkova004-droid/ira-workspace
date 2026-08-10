import {
  adminClient,
  appPublicUrl,
  botUsername,
  sendTelegramMessage,
  studentFromState,
  upcomingLessons,
} from "../_shared/common.ts";

const db = adminClient();
const token = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
}

async function telegram(method: string, payload: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.description || method);
  return result.result;
}

async function linkedStudent(chatId: number) {
  const { data: link } = await db
    .from("student_links")
    .select("teacher_id,student_id,student_name,portal_token,telegram_chat_id")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();
  if (!link) return null;
  const { data: workspace } = await db.from("workspace_states").select("state").eq("teacher_id", link.teacher_id).maybeSingle();
  const state = workspace?.state ?? {};
  const student = studentFromState(state, String(link.student_id));
  if (!student) return null;
  return { link, state, student };
}

function portalUrl(portalToken: string) {
  const url = new URL(appPublicUrl());
  url.searchParams.set("portal", portalToken);
  return url.toString();
}

function studentKeyboard(portalToken: string) {
  return {
    inline_keyboard: [
      [{ text: "📅 Открыть личный кабинет", web_app: { url: portalUrl(portalToken) } }],
      [
        { text: "🗓 Ближайшие уроки", callback_data: "schedule" },
        { text: "💳 Оплата", callback_data: "payment" },
      ],
      [{ text: "📝 Домашнее", callback_data: "homework" }],
    ],
  };
}

function formatSchedule(state: any, studentId: string) {
  const lessons = upcomingLessons(state, studentId).slice(0, 6);
  if (!lessons.length) return "Ближайших уроков пока нет.";
  const rows = lessons.map((lesson: any) => {
    const date = new Date(`${lesson.date}T12:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" });
    return `• <b>${esc(date)}, ${esc(lesson.time)}</b> — ${esc(lesson.title || "Урок английского")}`;
  });
  return `<b>Ближайшие уроки</b>\n${rows.join("\n")}`;
}

function formatPayment(student: any) {
  const balance = Number(student.balance ?? 0);
  const left = Math.max(0, Number(student.packageTotal ?? 0) - Number(student.packageUsed ?? 0));
  const payment = balance > 0 ? `К оплате: <b>${balance.toLocaleString("ru-RU")} ₽</b>` : "Оплата: <b>всё оплачено</b>";
  return `<b>Оплата и пакет</b>\n${payment}\nОсталось занятий: <b>${left}</b>`;
}

function formatHomework(student: any) {
  const items = Array.isArray(student.homework) ? student.homework.filter((item: any) => item.status !== "Сделано") : [];
  if (!items.length) return "Активного домашнего задания сейчас нет.";
  return `<b>Домашнее задание</b>\n${items.slice(0, 8).map((item: any) => `• ${esc(item.title)}${item.due ? ` — до ${esc(new Date(`${item.due}T12:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }))}` : ""}`).join("\n")}`;
}

async function replyForCommand(chatId: number, command: string) {
  const data = await linkedStudent(chatId);
  if (!data) {
    await sendTelegramMessage(chatId, "Ученик пока не привязан к Rasmus. Попроси преподавателя прислать персональную ссылку подключения.");
    return;
  }
  const { link, state, student } = data;
  const text = command === "schedule"
    ? formatSchedule(state, String(link.student_id))
    : command === "payment"
    ? formatPayment(student)
    : command === "homework"
    ? formatHomework(student)
    : `Привет, ${esc(student.name)}! Здесь можно посмотреть расписание, оплату и домашнее задание.`;
  await sendTelegramMessage(chatId, text, { reply_markup: studentKeyboard(link.portal_token) });
}

Deno.serve(async (req) => {
  const expected = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  if (expected && req.headers.get("x-telegram-bot-api-secret-token") !== expected) return new Response("forbidden", { status: 403 });
  if (!token) return new Response("missing bot token", { status: 500 });

  try {
    const update = await req.json();
    const message = update.message;
    const callback = update.callback_query;

    if (callback?.id) {
      await telegram("answerCallbackQuery", { callback_query_id: callback.id });
      const chatId = callback.message?.chat?.id;
      if (chatId && ["schedule", "payment", "homework"].includes(callback.data)) await replyForCommand(chatId, callback.data);
      return new Response("ok");
    }

    if (!message?.chat?.id) return new Response("ok");
    const chatId = Number(message.chat.id);
    const text = String(message.text ?? "").trim();
    const username = message.from?.username ?? null;
    const startMatch = text.match(/^\/start(?:@\w+)?\s+student_([0-9a-f-]{36})$/i);

    if (startMatch) {
      const { data: link } = await db
        .from("student_links")
        .select("teacher_id,student_id,student_name,portal_token")
        .eq("portal_token", startMatch[1])
        .maybeSingle();
      if (!link) {
        await sendTelegramMessage(chatId, "Эта ссылка больше не действует. Попроси преподавателя прислать новую.");
        return new Response("ok");
      }
      await db.from("student_links").update({
        telegram_chat_id: chatId,
        telegram_username: username,
        linked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("teacher_id", link.teacher_id).eq("student_id", link.student_id);
      await sendTelegramMessage(
        chatId,
        `Готово, <b>${esc(link.student_name)}</b>! 🎉\nТеперь Расмус будет присылать сюда напоминания об уроках, переносах, домашнем задании и оплате.`,
        { reply_markup: studentKeyboard(link.portal_token) },
      );
      return new Response("ok");
    }

    const command = text.match(/^\/(schedule|payment|homework|help)(?:@\w+)?/i)?.[1]?.toLowerCase();
    if (command) {
      await replyForCommand(chatId, command);
      return new Response("ok");
    }

    if (/^\/start(?:@\w+)?$/i.test(text)) {
      const { data: teacher } = await db.from("teachers").select("telegram_id,name").eq("telegram_id", chatId).maybeSingle();
      if (teacher) {
        await sendTelegramMessage(chatId, "Rasmus подключён. Открой рабочее пространство кнопкой меню бота.", {
          reply_markup: { inline_keyboard: [[{ text: "Открыть Rasmus", web_app: { url: appPublicUrl() } }]] },
        });
      } else {
        await replyForCommand(chatId, "help");
      }
      return new Response("ok");
    }

    const linked = await linkedStudent(chatId);
    if (linked) {
      await sendTelegramMessage(chatId, "Выбери нужный раздел:", { reply_markup: studentKeyboard(linked.link.portal_token) });
    } else {
      await sendTelegramMessage(chatId, `Это бот Rasmus (@${botUsername()}). Для подключения ученика нужна персональная ссылка от преподавателя.`);
    }
  } catch (error) {
    console.error(error);
  }
  return new Response("ok");
});
