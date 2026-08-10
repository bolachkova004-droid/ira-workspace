import {
  APP_VERSION,
  adminClient,
  json,
  jsonHeaders,
  publicClient,
  randomToken,
  sha256Hex,
  verifyTelegramInitData,
} from "../_shared/common.ts";

const admin = adminClient();

async function createAuthUser(displayName: string) {
  // The Auth address is deliberately unguessable. A deterministic address
  // based on Telegram ID could be pre-registered through a public signup flow
  // and later used to hijack the provisioned workspace.
  const email = `tg.${randomToken(18)}@rasmus.invalid`;
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name: displayName, identity_source: "telegram" },
    app_metadata: { identity_source: "telegram" },
  });
  if (!created.error && created.data.user) return { id: created.data.user.id, email };
  throw created.error ?? new Error("Не удалось создать безопасную сессию");
}

async function issueSession(authUserId: string) {
  const account = await admin.auth.admin.getUserById(authUserId);
  const email = account.data.user?.email;
  if (account.error || !email) throw account.error ?? new Error("Auth account is unavailable");
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error || !link.data.properties?.hashed_token) throw link.error ?? new Error("Не удалось подготовить сессию");

  const client = publicClient();
  const verified = await client.auth.verifyOtp({
    token_hash: link.data.properties.hashed_token,
    type: "email",
  });
  if (verified.error || !verified.data.session) throw verified.error ?? new Error("Не удалось открыть сессию");
  return verified.data.session;
}

function cleanInviteToken(value: unknown) {
  const token = String(value ?? "").trim().replace(/^beta_/, "");
  return /^[A-Za-z0-9_-]{24,48}$/.test(token) ? token : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: jsonHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    let body: any = {};
    try { body = await req.json(); } catch { /* no body */ }
    if (body.refreshToken) {
      const refreshed = await publicClient().auth.refreshSession({ refresh_token: String(body.refreshToken) });
      if (refreshed.error || !refreshed.data.session) {
        return json({ ok: false, code: "SESSION_EXPIRED", error: "Сессия истекла — открой Rasmus ещё раз" }, 401);
      }
      const profile = await admin.from("app_users").select("beta_status").eq("id", refreshed.data.session.user.id).maybeSingle();
      if (profile.error || profile.data?.beta_status !== "active") {
        return json({ ok: false, code: "ACCESS_BLOCKED", error: "Доступ к beta приостановлен" }, 403);
      }
      return json({
        ok: true,
        refreshed: true,
        accessToken: refreshed.data.session.access_token,
        refreshToken: refreshed.data.session.refresh_token,
        expiresAt: refreshed.data.session.expires_at,
        expiresIn: refreshed.data.session.expires_in,
      });
    }

    const checked = await verifyTelegramInitData(req.headers.get("x-telegram-init-data") ?? "");
    if (!checked.ok) {
      return json({ ok: false, code: "TELEGRAM_AUTH_FAILED", reason: checked.reason, error: "Не удалось подтвердить вход через Telegram" }, 401);
    }

    const telegram = checked.user;
    const displayName = [telegram.first_name, telegram.last_name].filter(Boolean).join(" ") || "Преподаватель";
    const inviteToken = cleanInviteToken(body.inviteToken || checked.startParam);
    const ownerTelegramId = Number(Deno.env.get("OWNER_TELEGRAM_ID") ?? 0);
    const isConfiguredOwner = ownerTelegramId > 0 && ownerTelegramId === Number(telegram.id);

    const existing = await admin
      .from("app_users")
      .select("id,beta_status,platform_role")
      .eq("telegram_user_id", telegram.id)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data?.beta_status === "blocked") {
      return json({ ok: false, code: "ACCESS_BLOCKED", error: "Доступ к beta приостановлен" }, 403);
    }
    if (existing.data) {
      if (isConfiguredOwner) {
        const demotedOthers = await admin.from("app_users").update({ platform_role: "user", updated_at: new Date().toISOString() }).neq("id", existing.data.id).eq("platform_role", "admin");
        if (demotedOthers.error) throw demotedOthers.error;
        if (existing.data.platform_role !== "admin") {
          const promoted = await admin.from("app_users").update({ platform_role: "admin", updated_at: new Date().toISOString() }).eq("id", existing.data.id);
          if (promoted.error) throw promoted.error;
        }
        existing.data.platform_role = "admin";
      } else if (!isConfiguredOwner && existing.data.platform_role === "admin") {
        const demoted = await admin.from("app_users").update({ platform_role: "user", updated_at: new Date().toISOString() }).eq("id", existing.data.id);
        if (demoted.error) throw demoted.error;
        existing.data.platform_role = "user";
      }
    }

    let authUserId = existing.data?.id as string | undefined;
    let created = false;
    let workspaceCreated = false;
    let createdAuthUser = false;
    if (!authUserId) {
      const legacy = await admin.from("teachers").select("id").eq("telegram_id", telegram.id).maybeSingle();
      if (legacy.error) throw legacy.error;

      let inviteHash = "";
      const mayBootstrapOwner = !legacy.data && isConfiguredOwner;

      if (!isConfiguredOwner) {
        if (!inviteToken) {
          return json({ ok: false, code: "BETA_INVITE_REQUIRED", error: "Rasmus пока доступен только по личному приглашению" }, 403);
        }
        inviteHash = await sha256Hex(inviteToken);
        const invite = await admin
          .from("beta_invites")
          .select("id")
          .eq("token_hash", inviteHash)
          .is("claimed_at", null)
          .is("revoked_at", null)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();
        if (invite.error) throw invite.error;
        if (!invite.data) return json({ ok: false, code: "BETA_INVITE_INVALID", error: "Приглашение уже использовано или больше не действует" }, 403);
      }

      const provisioned = await createAuthUser(displayName);
      authUserId = provisioned.id;
      createdAuthUser = true;

      const params = {
        p_auth_user_id: authUserId,
        p_telegram_user_id: telegram.id,
        p_telegram_username: telegram.username ?? "",
        p_first_name: telegram.first_name ?? "",
        p_last_name: telegram.last_name ?? "",
      };
      const claimed = legacy.data
        ? await admin.rpc("rasmus_claim_legacy_user", {
            ...params,
            p_is_platform_owner: isConfiguredOwner,
            p_token_hash: inviteHash,
          })
        : mayBootstrapOwner
        ? await admin.rpc("rasmus_bootstrap_owner_user", params)
        : await admin.rpc("rasmus_claim_beta_invite", { ...params, p_token_hash: inviteHash });

      if (claimed.error) {
        if (createdAuthUser) await admin.auth.admin.deleteUser(authUserId).catch(() => undefined);
        const code = String(claimed.error.message).includes("beta_invite") ? "BETA_INVITE_INVALID" : "PROVISIONING_FAILED";
        return json({ ok: false, code, error: code === "BETA_INVITE_INVALID" ? "Приглашение уже использовано или больше не действует" : "Не удалось создать кабинет" }, 409);
      }
      created = true;
      workspaceCreated = !legacy.data;
    }

    const membership = await admin
      .from("workspace_members")
      .select("workspace_id,role,workspaces(id,name,currency,timezone,is_primary)")
      .eq("user_id", authUserId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (membership.error || !membership.data) throw membership.error ?? new Error("Workspace membership is missing");

    const workspace = Array.isArray((membership.data as any).workspaces)
      ? (membership.data as any).workspaces[0]
      : (membership.data as any).workspaces;
    if (isConfiguredOwner && !workspace?.is_primary) {
      const demotedWorkspaces = await admin.from("workspaces").update({ is_primary: false, updated_at: new Date().toISOString() }).neq("id", membership.data.workspace_id);
      if (demotedWorkspaces.error) throw demotedWorkspaces.error;
      const primary = await admin.from("workspaces").update({ is_primary: true, updated_at: new Date().toISOString() }).eq("id", membership.data.workspace_id);
      if (primary.error) throw primary.error;
      workspace.is_primary = true;
    } else if (!isConfiguredOwner && workspace?.is_primary) {
      const ordinary = await admin.from("workspaces").update({ is_primary: false, updated_at: new Date().toISOString() }).eq("id", membership.data.workspace_id);
      if (ordinary.error) throw ordinary.error;
      workspace.is_primary = false;
    }
    const session = await issueSession(authUserId);

    const activity = await admin.from("app_users").update({
      telegram_username: telegram.username ?? null,
      first_name: telegram.first_name ?? null,
      last_name: telegram.last_name ?? null,
      last_active_at: new Date().toISOString(),
      app_version: String(body.appVersion ?? APP_VERSION).slice(0, 40),
      platform: String(body.platform ?? "telegram").slice(0, 80),
      updated_at: new Date().toISOString(),
    }).eq("id", authUserId);
    if (activity.error) throw activity.error;

    return json({
      ok: true,
      created,
      workspaceCreated,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at,
      expiresIn: session.expires_in,
      user: {
        id: authUserId,
        telegramUserId: telegram.id,
        platformRole: existing.data?.platform_role ?? (workspace?.is_primary ? "admin" : "user"),
      },
      membership: { workspaceId: membership.data.workspace_id, role: membership.data.role },
      workspace,
    });
  } catch (error) {
    console.error("telegram-auth", error instanceof Error ? error.message : String(error));
    return json({ ok: false, code: "AUTH_INTERNAL_ERROR", error: "Не удалось открыть Rasmus. Попробуй ещё раз" }, 500);
  }
});
