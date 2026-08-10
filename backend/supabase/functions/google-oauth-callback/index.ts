import {
  adminClient,
  appPublicUrl,
  encryptSecret,
  sha256Hex,
  supabaseUrl,
} from "../_shared/common.ts";

const admin = adminClient();

function page(title: string, message: string, ok: boolean, status = 200) {
  const safe = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]!));
  return new Response(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${safe(title)}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#17151c;color:#f4efe3;font:16px/1.5 system-ui,sans-serif}.card{max-width:430px;padding:28px;border:1px solid rgba(244,239,227,.13);border-radius:24px;background:#211e28;text-align:center;box-shadow:0 25px 80px rgba(0,0,0,.4)}.mark{font-size:44px}h1{font-size:24px;margin:12px 0 8px}p{color:#b9b1bf}a{display:inline-flex;margin-top:12px;padding:12px 18px;border-radius:13px;background:#e8a33d;color:#1c1a20;font-weight:800;text-decoration:none}</style></head><body><main class="card"><div class="mark">${ok ? "✓" : "!"}</div><h1>${safe(title)}</h1><p>${safe(message)}</p><a href="${safe(appPublicUrl())}">Вернуться в Rasmus</a></main></body></html>`, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "GET") return page("Неверный запрос", "Открой подключение календаря из настроек Rasmus.", false, 405);
  const url = new URL(req.url);
  const rawState = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const oauthError = url.searchParams.get("error") ?? "";
  if (oauthError) return page("Подключение отменено", "Google Calendar не был подключён. Можно попробовать ещё раз из настроек.", false, 400);
  if (!rawState || !code) return page("Ссылка неполная", "Начни подключение заново из настроек Rasmus.", false, 400);

  try {
    const stateHash = await sha256Hex(rawState);
    const state = await admin
      .from("calendar_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("state_hash", stateHash)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("id,workspace_id,user_id")
      .maybeSingle();
    if (state.error || !state.data) return page("Ссылка больше не действует", "В целях безопасности подключение нужно начать заново из Rasmus.", false, 400);
    const membership = await admin
      .from("workspace_members")
      .select("role,app_users(beta_status)")
      .eq("workspace_id", state.data.workspace_id)
      .eq("user_id", state.data.user_id)
      .maybeSingle();
    const memberUser = Array.isArray((membership.data as any)?.app_users)
      ? (membership.data as any).app_users[0]
      : (membership.data as any)?.app_users;
    if (membership.error || membership.data?.role !== "owner" || memberUser?.beta_status !== "active") {
      return page("Доступ изменился", "Подключение календаря больше не разрешено для этого кабинета.", false, 403);
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
    if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured");
    const redirectUri = `${supabaseUrl()}/functions/v1/google-oauth-callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) throw new Error(tokenData.error_description || "Google token exchange failed");

    const existing = await admin.from("calendar_connections").select("id,refresh_token_ciphertext").eq("workspace_id", state.data.workspace_id).maybeSingle();
    const refreshCiphertext = tokenData.refresh_token
      ? await encryptSecret(String(tokenData.refresh_token))
      : existing.data?.refresh_token_ciphertext;
    if (!refreshCiphertext) throw new Error("Google did not return a refresh token");

    let email: string | null = null;
    try {
      const userInfo = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
      if (userInfo.ok) email = String((await userInfo.json()).email ?? "") || null;
    } catch { /* email is informational */ }

    const connection = await admin.from("calendar_connections").upsert({
      workspace_id: state.data.workspace_id,
      provider: "google",
      account_email: email,
      calendar_id: "primary",
      refresh_token_ciphertext: refreshCiphertext,
      scopes: String(tokenData.scope ?? "https://www.googleapis.com/auth/calendar.events").split(/\s+/).filter(Boolean),
      connected_by: state.data.user_id,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revoked_at: null,
    }, { onConflict: "workspace_id" });
    if (connection.error) throw connection.error;

    return page("Google Calendar подключён", email ? `Аккаунт ${email} связан с твоим кабинетом. Можно закрыть эту страницу.` : "Календарь связан с твоим кабинетом. Можно закрыть эту страницу.", true);
  } catch (error) {
    console.error("google-oauth-callback", error instanceof Error ? error.message : String(error));
    return page("Не удалось подключить календарь", "Попробуй ещё раз из настроек Rasmus. Если ошибка повторится, отправь сообщение через «Сообщить о проблеме».", false, 500);
  }
});
