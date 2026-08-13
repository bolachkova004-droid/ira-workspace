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

type DatabaseError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function logDatabaseError(stage: string, error: unknown, context: Record<string, unknown> = {}) {
  const databaseError = (error ?? {}) as DatabaseError;
  const diagnosticId = crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
  console.error("telegram-auth", JSON.stringify({
    diagnosticId,
    stage,
    code: databaseError.code ?? "unknown",
    message: databaseError.message ?? String(error),
    details: databaseError.details ?? "",
    hint: databaseError.hint ?? "",
    ...context,
  }));
  return diagnosticId;
}

async function recoverConfiguredOwner(
  authUserId: string,
  telegram: { id: number; username?: string; first_name?: string; last_name?: string },
) {
  return await admin.rpc("rasmus_recover_owner_user", {
    p_auth_user_id: authUserId,
    p_telegram_user_id: telegram.id,
    p_telegram_username: telegram.username ?? "",
    p_first_name: telegram.first_name ?? "",
    p_last_name: telegram.last_name ?? "",
  });
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
    if (existing.data?.beta_status === "blocked" && !isConfiguredOwner) {
      return json({ ok: false, code: "ACCESS_BLOCKED", error: "Доступ к beta приостановлен" }, 403);
    }
    if (existing.data) {
      if (!isConfiguredOwner && existing.data.platform_role === "admin") {
        const demoted = await admin.from("app_users").update({ platform_role: "user", updated_at: new Date().toISOString() }).eq("id", existing.data.id);
        if (demoted.error) throw demoted.error;
        existing.data.platform_role = "user";
      }
    }

    let authUserId = existing.data?.id as string | undefined;
    let created = false;
    let workspaceCreated = false;
    let createdAuthUser = false;
    let preferredWorkspaceId = "";
    if (!authUserId) {
      const legacy = await admin.from("teachers").select("id").eq("telegram_id", telegram.id).maybeSingle();
      if (legacy.error) throw legacy.error;

      let inviteHash = "";

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
      const claimed = isConfiguredOwner
        ? await recoverConfiguredOwner(authUserId, telegram)
        : legacy.data
        ? await admin.rpc("rasmus_claim_legacy_user", {
            ...params,
            p_is_platform_owner: false,
            p_token_hash: inviteHash,
          })
        : await admin.rpc("rasmus_claim_beta_invite", { ...params, p_token_hash: inviteHash });

      if (claimed.error) {
        if (createdAuthUser) await admin.auth.admin.deleteUser(authUserId).catch(() => undefined);
        const code = String(claimed.error.message).includes("beta_invite") ? "BETA_INVITE_INVALID" : "PROVISIONING_FAILED";
        const diagnosticId = logDatabaseError(isConfiguredOwner ? "recover-owner" : "claim-invite", claimed.error, {
          telegramUserId: telegram.id,
          hasLegacyWorkspace: Boolean(legacy.data),
        });
        return json({
          ok: false,
          code,
          diagnosticId,
          error: code === "BETA_INVITE_INVALID"
            ? "Приглашение уже использовано или больше не действует"
            : `Не удалось восстановить кабинет. Код: ${diagnosticId}`,
        }, 409);
      }
      if (isConfiguredOwner) preferredWorkspaceId = String(claimed.data ?? "");
      created = true;
      workspaceCreated = !legacy.data && !isConfiguredOwner;
    }

    // OWNER_TELEGRAM_ID is the server-side source of truth. Running recovery
    // on every owner login makes provisioning idempotent and repairs the two
    // common interrupted-upgrade states: an admin without membership and a
    // primary workspace still attached to an older Auth account.
    if (isConfiguredOwner && !createdAuthUser) {
      const recovered = await recoverConfiguredOwner(authUserId, telegram);
      if (recovered.error) {
        const diagnosticId = logDatabaseError("repair-existing-owner", recovered.error, {
          telegramUserId: telegram.id,
        });
        return json({
          ok: false,
          code: "OWNER_RECOVERY_FAILED",
          diagnosticId,
          error: `Не удалось восстановить доступ к кабинету. Код: ${diagnosticId}`,
        }, 409);
      }
      preferredWorkspaceId = String(recovered.data ?? "");
      existing.data!.platform_role = "admin";
    }

    let membershipRequest = admin
      .from("workspace_members")
      .select("workspace_id,role,workspaces(id,name,currency,timezone,is_primary)")
      .eq("user_id", authUserId)
      .order("created_at", { ascending: true });
    if (preferredWorkspaceId) membershipRequest = membershipRequest.eq("workspace_id", preferredWorkspaceId);
    const membership = await membershipRequest
      .limit(1)
      .maybeSingle();
    if (membership.error || !membership.data) {
      const diagnosticId = logDatabaseError("load-membership", membership.error ?? new Error("Workspace membership is missing"), {
        telegramUserId: telegram.id,
        configuredOwner: isConfiguredOwner,
      });
      return json({
        ok: false,
        code: "MEMBERSHIP_MISSING",
        diagnosticId,
        error: `Не удалось найти кабинет. Код: ${diagnosticId}`,
      }, 409);
    }

    const workspace = Array.isArray((membership.data as any).workspaces)
      ? (membership.data as any).workspaces[0]
      : (membership.data as any).workspaces;
    if (!isConfiguredOwner && workspace?.is_primary) {
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
