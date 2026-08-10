import {
  adminClient,
  appPublicUrl,
  botUsername,
  html,
  randomToken,
  sendTelegramMessage,
  sha256Hex,
  studentFromState,
  upcomingLessons,
} from "../_shared/common.ts";

const admin = adminClient();
const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";

async function telegram(method: string, payload: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.description || method);
  return result.result;
}

function teacherKeyboard(inviteToken = "") {
  const url = new URL(appPublicUrl());
  if (inviteToken) url.searchParams.set("invite", `beta_${inviteToken}`);
  return { inline_keyboard: [[{ text: "🐾 Открыть Rasmus", web_app: { url: url.toString() } }]] };
}

async function createPortalUrl(workspaceId: string, studentLinkId: string) {
  const raw = randomToken(32);
  const tokenHash = await sha256Hex(raw);
  const inserted = await admin.from("student_portal_tokens").insert({
    workspace_id: workspaceId,
    student_link_id: studentLinkId,
    token_hash: tokenHash,
    expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
  });
  if (inserted.error) throw inserted.error;
  const url = new URL(appPublicUrl());
  url.searchParams.set("portal", raw);
  return url.toString();
}

async function studentKeyboard(records: any[]) {
  const rows: any[][] = [];
  for (const record of records.slice(0, 5)) {
    rows.push([{ text: `📅 Кабинет · ${String(record.workspace?.name || "преподаватель").slice(0, 30)}`, web_app: { url: await createPortalUrl(record.link.workspace_id, record.link.id) } }]);
  }
  rows.push([
    { text: "🗓 Ближайшие уроки", callback_data: "schedule" },
    { text: "💳 Оплата", callback_data: "payment" },
  ]);
  rows.push([{ text: "📝 Домашнее", callback_data: "homework" }]);
  return { inline_keyboard: rows };
}

async function linkedRecords(chatId: number) {
  const links = await admin
    .from("student_links")
    .select("id,workspace_id,student_id,student_name,telegram_chat_id")
    .eq("telegram_chat_id", chatId)
    .order("linked_at", { ascending: true });
  if (links.error) throw links.error;
  const records = [];
  for (const link of links.data ?? []) {
    const workspace = await admin.from("workspaces").select("name,currency,timezone").eq("id", link.workspace_id).maybeSingle();
    const document = await admin.from("workspace_states").select("state").eq("workspace_id", link.workspace_id).maybeSingle();
    const state = document.data?.state ?? {};
    const student = studentFromState(state, String(link.student_id));
    if (student) records.push({ link, workspace: workspace.data, state, student });
  }
  return records;
}

function formatSchedule(record: any) {
  const lessons = upcomingLessons(record.state, String(record.link.student_id), record.workspace?.timezone || "Europe/Moscow").slice(0, 6);
  if (!lessons.length) return `<b>${html(record.workspace?.name || "Преподаватель")}</b>\nБлижайших уроков пока нет.`;
  const rows = lessons.map((lesson: any) => {
    const date = new Date(`${lesson.date}T12:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" });
    return `• <b>${html(date)}, ${html(lesson.time)}</b> — ${html(lesson.title || "Урок английского")}`;
  });
  return `<b>${html(record.workspace?.name || "Преподаватель")}</b>\n${rows.join("\n")}`;
}

function formatPayment(record: any) {
  const student = record.student;
  const balance = Number(student.balance ?? 0);
  const code = String(record.workspace?.currency ?? record.state?.profile?.currency ?? "RUB");
  const symbol = code === "EUR" ? "€" : code === "USD" ? "$" : code === "GBP" ? "£" : code === "KZT" ? "₸" : "₽";
  const left = Math.max(0, Number(student.packageTotal ?? 0) - Number(student.packageUsed ?? 0));
  const payment = balance > 0 ? `К оплате: <b>${balance.toLocaleString("ru-RU")} ${symbol}</b>` : "Оплата: <b>всё оплачено</b>";
  return `<b>${html(record.workspace?.name || "Преподаватель")}</b>\n${payment}\nОсталось занятий: <b>${left}</b>`;
}

function formatHomework(record: any) {
  const items = Array.isArray(record.student.homework) ? record.student.homework.filter((item: any) => item.status !== "Сделано") : [];
  if (!items.length) return `<b>${html(record.workspace?.name || "Преподаватель")}</b>\nАктивного домашнего задания сейчас нет.`;
  return `<b>${html(record.workspace?.name || "Преподаватель")}</b>\n${items.slice(0, 8).map((item: any) => `• ${html(item.title)}${item.due ? ` — до ${html(new Date(`${item.due}T12:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }))}` : ""}`).join("\n")}`;
}

async function replyForCommand(chatId: number, command: string) {
  const records = await linkedRecords(chatId);
  if (!records.length) {
    await sendTelegramMessage(chatId, "Ученик пока не привязан к Rasmus. Попроси преподавателя прислать персональную ссылку подключения.");
    return;
  }
  const sections = records.map((record) => command === "schedule" ? formatSchedule(record) : command === "payment" ? formatPayment(record) : command === "homework" ? formatHomework(record) : `<b>${html(record.workspace?.name || "Преподаватель")}</b> — расписание, оплата и домашнее.`);
  await sendTelegramMessage(chatId, sections.join("\n\n────────\n\n"), { reply_markup: await studentKeyboard(records) });
}

async function hasTeacherAccess(telegramUserId: number) {
  const appUser = await admin.from("app_users").select("id,beta_status").eq("telegram_user_id", telegramUserId).maybeSingle();
  if (appUser.data) return appUser.data.beta_status === "active";
  const ownerTelegramId = Number(Deno.env.get("OWNER_TELEGRAM_ID") ?? 0);
  return ownerTelegramId > 0 && ownerTelegramId === telegramUserId;
}

Deno.serve(async (req) => {
  const expected = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
  if (!expected || req.headers.get("x-telegram-bot-api-secret-token") !== expected) return new Response("forbidden", { status: 403 });
  if (!botToken) return new Response("missing bot token", { status: 500 });

  try {
    const update = await req.json();
    const message = update.message;
    const callback = update.callback_query;
    if (callback?.id) {
      await telegram("answerCallbackQuery", { callback_query_id: callback.id });
      const chatId = Number(callback.message?.chat?.id ?? 0);
      if (chatId && callback.message?.chat?.type === "private" && ["schedule", "payment", "homework"].includes(callback.data)) await replyForCommand(chatId, callback.data);
      return new Response("ok");
    }
    if (!message?.chat?.id) return new Response("ok");
    const chatId = Number(message.chat.id);
    if (message.chat.type !== "private") {
      await sendTelegramMessage(chatId, `Для защиты данных Rasmus работает только в личном чате с @${botUsername()}.`);
      return new Response("ok");
    }
    const telegramUserId = Number(message.from?.id ?? chatId);
    const text = String(message.text ?? "").trim();
    const username = String(message.from?.username ?? "");

    const betaMatch = text.match(/^\/start(?:@\w+)?\s+beta_([A-Za-z0-9_-]{24,48})$/);
    if (betaMatch) {
      const tokenHash = await sha256Hex(betaMatch[1]);
      const invite = await admin.from("beta_invites").select("id,expires_at").eq("token_hash", tokenHash).is("claimed_at", null).is("revoked_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
      if (!invite.data) {
        await sendTelegramMessage(chatId, "Это приглашение уже использовано или больше не действует. Попроси автора Rasmus прислать новое.");
        return new Response("ok");
      }
      await sendTelegramMessage(chatId, "🐾 <b>Добро пожаловать в Rasmus Beta!</b>\n\nПриглашение закрепится за твоим Telegram только после открытия приложения. Нажми кнопку ниже и пройди короткую настройку.", { reply_markup: teacherKeyboard(betaMatch[1]) });
      return new Response("ok");
    }

    const studentMatch = text.match(/^\/start(?:@\w+)?\s+student_([A-Za-z0-9_-]{24,48})$/);
    if (studentMatch) {
      const tokenHash = await sha256Hex(studentMatch[1]);
      const claimed = await admin.rpc("rasmus_claim_student_invite", {
        p_token_hash: tokenHash,
        p_telegram_user_id: telegramUserId,
        p_telegram_chat_id: chatId,
        p_telegram_username: username,
      });
      if (claimed.error || !claimed.data?.length) {
        await sendTelegramMessage(chatId, "Эта ссылка уже использована или больше не действует. Попроси преподавателя прислать новую.");
        return new Response("ok");
      }
      const records = await linkedRecords(chatId);
      const current = records.find((record) => record.link.id === claimed.data[0].student_link_id) ?? records[0];
      await sendTelegramMessage(chatId, `Готово, <b>${html(claimed.data[0].student_name)}</b>! 🎉\nТеперь Rasmus сможет присылать сюда напоминания от преподавателя${current?.workspace?.name ? ` ${html(current.workspace.name)}` : ""}.`, { reply_markup: await studentKeyboard(records) });
      return new Response("ok");
    }

    const command = text.match(/^\/(schedule|payment|homework|help)(?:@\w+)?/i)?.[1]?.toLowerCase();
    if (command) {
      await replyForCommand(chatId, command);
      return new Response("ok");
    }

    if (/^\/start(?:@\w+)?$/i.test(text)) {
      if (await hasTeacherAccess(telegramUserId)) {
        await sendTelegramMessage(chatId, "Rasmus подключён. Открой свой кабинет кнопкой ниже.", { reply_markup: teacherKeyboard() });
      } else {
        const records = await linkedRecords(chatId);
        if (records.length) await sendTelegramMessage(chatId, "Выбери нужный раздел:", { reply_markup: await studentKeyboard(records) });
        else await sendTelegramMessage(chatId, "🐾 Rasmus сейчас работает в закрытой beta. Для кабинета преподавателя нужно личное приглашение, а для ученика — ссылка от преподавателя.");
      }
      return new Response("ok");
    }

    const records = await linkedRecords(chatId);
    if (records.length) await sendTelegramMessage(chatId, "Выбери нужный раздел:", { reply_markup: await studentKeyboard(records) });
    else await sendTelegramMessage(chatId, `Это бот Rasmus (@${botUsername()}). Для подключения нужна персональная ссылка.`);
  } catch (error) {
    console.error("telegram-webhook", error instanceof Error ? error.message : String(error));
  }
  return new Response("ok");
});
