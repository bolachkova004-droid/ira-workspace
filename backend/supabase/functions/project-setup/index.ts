import { adminClient, appPublicUrl, json, jsonHeaders, supabaseUrl } from "../_shared/common.ts";

const admin = adminClient();

function equalSecret(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index++) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

async function telegram(method: string, payload: Record<string, unknown>) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.description || method);
  return data.result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: jsonHeaders });
  const expected = Deno.env.get("DEPLOY_SECRET") ?? "";
  const received = req.headers.get("x-deploy-secret") ?? "";
  if (!equalSecret(expected, received)) return json({ ok: false, error: "forbidden" }, 403);

  try {
    const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
    const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
    const ownerTelegramId = Deno.env.get("OWNER_TELEGRAM_ID") ?? "";
    if (!webhookSecret || !cronSecret || !/^[1-9][0-9]{4,19}$/.test(ownerTelegramId)) {
      throw new Error("Deployment secrets are incomplete (including OWNER_TELEGRAM_ID)");
    }
    const projectUrl = supabaseUrl();
    const me = await telegram("getMe", {});
    const expectedBotUsername = (Deno.env.get("BOT_USERNAME") ?? "ira_workspace_bot").replace(/^@/, "");
    if (String(me.username ?? "").toLowerCase() !== expectedBotUsername.toLowerCase()) {
      throw new Error(`TELEGRAM_BOT_TOKEN belongs to @${me.username || "unknown"}, expected @${expectedBotUsername}`);
    }
    await telegram("setWebhook", {
      url: `${projectUrl}/functions/v1/telegram-webhook`,
      secret_token: webhookSecret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    });
    await telegram("setMyName", { name: "Rasmus" });
    await telegram("setMyDescription", { description: "Rasmus помогает преподавателю вести расписание, учеников, абонементы и напоминания." });
    await telegram("setMyShortDescription", { short_description: "Расписание, ученики и напоминания преподавателя 🐾" });
    await telegram("setMyCommands", { commands: [
      { command: "schedule", description: "Ближайшие уроки" },
      { command: "payment", description: "Оплата и пакет" },
      { command: "homework", description: "Домашнее задание" },
      { command: "help", description: "Что умеет бот" },
    ] });
    await telegram("setChatMenuButton", { menu_button: { type: "web_app", text: "Открыть Rasmus", web_app: { url: appPublicUrl() } } });
    const cron = await admin.rpc("install_rasmus_notification_cron", { p_project_url: projectUrl, p_cron_secret: cronSecret });
    if (cron.error) throw cron.error;
    return json({ ok: true, bot: { id: me.id, username: me.username }, webhook: true, cron: true });
  } catch (error) {
    console.error("project-setup", error instanceof Error ? error.message : String(error));
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
