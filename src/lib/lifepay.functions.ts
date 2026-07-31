import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { LifePayPermission } from "@/lib/lifepay-perms";

/* ------------------------------------------------------------------ *
 * Helpers                                                             *
 * ------------------------------------------------------------------ */

async function requirePerm(context: any, perm: LifePayPermission) {
  const { data, error } = await context.supabase.rpc("has_lifepay_perm", {
    _user_id: context.userId,
    _perm: perm,
  });
  if (error) throw new Error("Falha ao verificar permissão.");
  if (!data) throw new Error("Acesso negado: permissão LifePay insuficiente.");
}

async function verifyPasswordFor(email: string, password: string) {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const client = createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: any, init: any) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  return !error;
}

/* ------------------------------------------------------------------ *
 * Usuário: PIN, primeiro acesso, confirmação de operações             *
 * ------------------------------------------------------------------ */

export const lifepayVerifySecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { method: "password" | "pin"; value: string }) => {
    if (d?.method !== "password" && d?.method !== "pin") throw new Error("Método inválido.");
    if (!d?.value) throw new Error("Informe a confirmação.");
    return d;
  })
  .handler(async ({ data, context }) => {
    if (data.method === "password") {
      const email = (context.claims as any)?.email as string | undefined;
      if (!email) throw new Error("Conta sem e-mail.");
      const ok = await verifyPasswordFor(email, data.value);
      if (!ok) throw new Error("Senha incorreta.");
      return { ok: true, method: "password" as const };
    }
    const { verifyPinHash } = await import("@/lib/lifepay-crypto.server");
    const { data: acc } = await context.supabase
      .from("lifepay_accounts").select("pin_hash").eq("user_id", context.userId).maybeSingle();
    if (!acc?.pin_hash) throw new Error("Nenhum PIN cadastrado.");
    if (!verifyPinHash(data.value, acc.pin_hash)) throw new Error("PIN incorreto.");
    return { ok: true, method: "pin" as const };
  });

export const lifepaySetPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pin: string; password: string }) => {
    if (!/^\d{4,8}$/.test(d?.pin ?? "")) throw new Error("O PIN deve ter de 4 a 8 dígitos.");
    if (!d?.password) throw new Error("Confirme com sua senha.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const email = (context.claims as any)?.email as string | undefined;
    if (!email || !(await verifyPasswordFor(email, data.password))) throw new Error("Senha incorreta.");
    const { hashPin } = await import("@/lib/lifepay-crypto.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("lifepay_accounts")
      .update({ pin_hash: hashPin(data.pin) }).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("lifepay_audit_logs").insert({
      actor_id: context.userId, actor_kind: "user", action: "pin_set", target_user: context.userId,
    });
    return { ok: true };
  });

export const lifepayFirstAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { currentPassword: string; newPassword: string; pin?: string; acceptTerms: boolean }) => {
    if (!d?.currentPassword) throw new Error("Informe a senha atual.");
    if (!d?.newPassword || d.newPassword.length < 8 || !/[A-Za-z]/.test(d.newPassword) || !/\d/.test(d.newPassword))
      throw new Error("A nova senha precisa de 8+ caracteres, com letra e número.");
    if (d.newPassword === d.currentPassword) throw new Error("A nova senha deve ser diferente da inicial.");
    if (d.pin && !/^\d{4,8}$/.test(d.pin)) throw new Error("O PIN deve ter de 4 a 8 dígitos.");
    if (!d.acceptTerms) throw new Error("É necessário aceitar os termos.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const email = (context.claims as any)?.email as string | undefined;
    if (!email || !(await verifyPasswordFor(email, data.currentPassword))) throw new Error("Senha atual incorreta.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(context.userId, { password: data.newPassword });
    if (pwErr) throw new Error(pwErr.message);
    const patch: Record<string, unknown> = {
      first_access_done: true, must_change_password: false, terms_accepted_at: new Date().toISOString(),
    };
    if (data.pin) {
      const { hashPin } = await import("@/lib/lifepay-crypto.server");
      patch.pin_hash = hashPin(data.pin);
    }
    const { error } = await supabaseAdmin.from("lifepay_accounts").update(patch as any).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("lifepay_audit_logs").insert({
      actor_id: context.userId, actor_kind: "user", action: "first_access_completed", target_user: context.userId,
    });
    return { ok: true };
  });

export const lifepayTouchAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("lifepay_accounts")
      .update({ last_access_at: new Date().toISOString() }).eq("user_id", context.userId);
    return { ok: true };
  });

/* ------------------------------------------------------------------ *
 * Administração (painel staff)                                        *
 * ------------------------------------------------------------------ */

export const lifepayAdminMyPerms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_ceo_or_admin", { _user_id: context.userId });
    const { data: rows } = await context.supabase
      .from("lifepay_admin_permissions").select("permission").eq("user_id", context.userId);
    return {
      isCeoOrAdmin: !!isAdmin,
      permissions: (rows ?? []).map((r: any) => r.permission as string),
    };
  });

export const lifepayAdminListAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePerm(context, "view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("lifepay_accounts")
      .select("user_id, full_name, display_name, email, pix_key, status, account_type, balance, credit_limit, closing_day, due_day, first_access_done, must_change_password, last_access_at, admin_notes, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const lifepayAdminCreateAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    full_name: string; email: string; password: string; confirm: string; status: string;
    account_type: string; balance: number; credit_limit: number; closing_day: number; due_day: number; admin_notes?: string;
  }) => {
    if (!d?.full_name?.trim()) throw new Error("Informe o nome completo.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d?.email ?? "")) throw new Error("E-mail inválido.");
    if (!d?.password || d.password.length < 8 || !/[A-Za-z]/.test(d.password) || !/\d/.test(d.password))
      throw new Error("Senha inicial precisa de 8+ caracteres, com letra e número.");
    if (d.password !== d.confirm) throw new Error("A confirmação da senha não confere.");
    if (!["active", "blocked"].includes(d.status)) throw new Error("Status inválido.");
    if (!Number.isInteger(d.balance) || d.balance < 0) throw new Error("Saldo inicial inválido.");
    if (!Number.isInteger(d.credit_limit) || d.credit_limit < 0) throw new Error("Limite inicial inválido.");
    if (d.closing_day < 1 || d.closing_day > 28 || d.due_day < 1 || d.due_day > 28) throw new Error("Dias devem ficar entre 1 e 28.");
    return { ...d, email: d.email.trim().toLowerCase(), full_name: d.full_name.trim() };
  })
  .handler(async ({ data, context }) => {
    await requirePerm(context, "create");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("lifepay_accounts").select("user_id").eq("email", data.email).maybeSingle();
    if (existing) throw new Error("Já existe uma conta LifePay com este e-mail.");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;

    await supabaseAdmin.from("lifepay_accounts").upsert({
      user_id: uid, pix_key: data.email, display_name: data.full_name.split(" ")[0],
      full_name: data.full_name, email: data.email, status: data.status, account_type: data.account_type,
      balance: data.balance, credit_limit: data.credit_limit, closing_day: data.closing_day, due_day: data.due_day,
      first_access_done: false, must_change_password: true, admin_notes: data.admin_notes ?? null, is_admin: false,
    }, { onConflict: "user_id" });

    await supabaseAdmin.from("lifepay_keys")
      .upsert({ user_id: uid, key_type: "email", key_value: data.email }, { onConflict: "id", ignoreDuplicates: true });

    if (data.balance > 0) {
      await supabaseAdmin.from("lifepay_transactions").insert({
        to_user: uid, amount: data.balance, kind: "admin_grant", note: "Saldo inicial",
        status: "completed", to_balance_before: 0, to_balance_after: data.balance, auth_method: "admin",
      });
    }
    await supabaseAdmin.from("lifepay_audit_logs").insert({
      actor_id: context.userId, action: "account_created", target_user: uid,
      after_data: { email: data.email, balance: data.balance, credit_limit: data.credit_limit, status: data.status },
    });
    return { user_id: uid };
  });

export const lifepayAdminUpdateAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; patch: Record<string, unknown>; reason?: string }) => {
    if (!d?.user_id) throw new Error("Conta inválida.");
    if (!d?.patch || typeof d.patch !== "object") throw new Error("Nada a alterar.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const allowed = ["full_name", "email", "status", "account_type", "credit_limit", "closing_day", "due_day",
      "admin_notes", "must_change_password", "salary_cents", "salary_day", "job_title", "department"] as const;
    const patch: Record<string, unknown> = {};
    for (const k of allowed) if (k in data.patch) patch[k] = (data.patch as any)[k];
    if (!Object.keys(patch).length) throw new Error("Nada a alterar.");

    if ("salary_cents" in patch) {
      const v = Number(patch.salary_cents);
      if (!Number.isInteger(v) || v < 0) throw new Error("Salário inválido.");
    }
    if ("salary_day" in patch) {
      const v = Number(patch.salary_day);
      if (!Number.isInteger(v) || v < 1 || v > 28) throw new Error("O dia do pagamento deve ficar entre 1 e 28.");
    }

    if ("status" in patch) await requirePerm(context, "block");
    if ("credit_limit" in patch) await requirePerm(context, "limit");
    if (Object.keys(patch).some((k) => !["status", "credit_limit"].includes(k))) await requirePerm(context, "edit");


    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin.from("lifepay_accounts")
      .select("*").eq("user_id", data.user_id).maybeSingle();
    if (!before) throw new Error("Conta não encontrada.");

    if (typeof patch.email === "string") {
      const email = (patch.email as string).trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("E-mail inválido.");
      const { data: dup } = await supabaseAdmin.from("lifepay_accounts")
        .select("user_id").eq("email", email).neq("user_id", data.user_id).maybeSingle();
      if (dup) throw new Error("Já existe uma conta LifePay com este e-mail.");
      patch.email = email;
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { email });
      if (authErr) throw new Error(authErr.message);
    }

    const { error } = await supabaseAdmin.from("lifepay_accounts").update(patch as any).eq("user_id", data.user_id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("lifepay_audit_logs").insert({
      actor_id: context.userId, action: "account_updated", target_user: data.user_id,
      before_data: Object.fromEntries(Object.keys(patch).map((k) => [k, (before as any)[k]])),
      after_data: patch as any, reason: data.reason ?? null,
    });
    return { ok: true };
  });

export const lifepayAdminAdjustBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; amount: number; reason: string }) => {
    if (!d?.user_id) throw new Error("Conta inválida.");
    if (!Number.isInteger(d?.amount) || d.amount === 0) throw new Error("Informe um valor diferente de zero.");
    if (!d?.reason?.trim()) throw new Error("Informe o motivo do ajuste.");
    return d;
  })
  .handler(async ({ data, context }) => {
    await requirePerm(context, "balance");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: acc } = await supabaseAdmin.from("lifepay_accounts")
      .select("balance").eq("user_id", data.user_id).maybeSingle();
    if (!acc) throw new Error("Conta não encontrada.");
    const next = acc.balance + data.amount;
    if (next < 0) throw new Error("O ajuste deixaria a conta com saldo negativo.");

    const { error } = await supabaseAdmin.from("lifepay_accounts").update({ balance: next }).eq("user_id", data.user_id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("lifepay_transactions").insert({
      from_user: data.amount < 0 ? data.user_id : context.userId,
      to_user: data.amount > 0 ? data.user_id : context.userId,
      amount: Math.abs(data.amount), kind: data.amount > 0 ? "admin_grant" : "admin_debit",
      note: data.reason.trim(), status: "completed", auth_method: "admin",
      ...(data.amount > 0
        ? { to_balance_before: acc.balance, to_balance_after: next }
        : { from_balance_before: acc.balance, from_balance_after: next }),
    });
    await supabaseAdmin.from("lifepay_audit_logs").insert({
      actor_id: context.userId, action: "balance_adjusted", target_user: data.user_id,
      before_data: { balance: acc.balance }, after_data: { balance: next }, reason: data.reason.trim(),
    });
    return { balance: next };
  });

export const lifepayAdminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; new_password: string; force_change?: boolean }) => {
    if (!d?.user_id) throw new Error("Conta inválida.");
    if (!d?.new_password || d.new_password.length < 8) throw new Error("Senha precisa ter ao menos 8 caracteres.");
    return d;
  })
  .handler(async ({ data, context }) => {
    await requirePerm(context, "edit");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.new_password });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("lifepay_accounts")
      .update({ must_change_password: data.force_change !== false, first_access_done: false })
      .eq("user_id", data.user_id);
    await supabaseAdmin.from("lifepay_audit_logs").insert({
      actor_id: context.userId, action: "password_reset", target_user: data.user_id,
    });
    return { ok: true };
  });

export const lifepayAdminAccountDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => {
    if (!d?.user_id) throw new Error("Conta inválida.");
    return d;
  })
  .handler(async ({ data, context }) => {
    await requirePerm(context, "view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: account }, { data: keys }, { data: tx }] = await Promise.all([
      supabaseAdmin.from("lifepay_accounts").select("*").eq("user_id", data.user_id).maybeSingle(),
      supabaseAdmin.from("lifepay_keys").select("*").eq("user_id", data.user_id).is("deleted_at", null),
      supabaseAdmin.from("lifepay_transactions")
        .select("*").or(`from_user.eq.${data.user_id},to_user.eq.${data.user_id}`)
        .order("created_at", { ascending: false }).limit(50),
    ]);
    if (account) delete (account as any).pin_hash;
    return { account, keys: keys ?? [], transactions: tx ?? [] };
  });

export const lifepayAdminSetPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; permissions: string[] }) => {
    if (!d?.user_id) throw new Error("Usuário inválido.");
    if (!Array.isArray(d?.permissions)) throw new Error("Permissões inválidas.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_ceo_or_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Somente CEO/Admin pode alterar permissões LifePay.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("lifepay_admin_permissions").delete().eq("user_id", data.user_id);
    if (data.permissions.length) {
      const { error } = await supabaseAdmin.from("lifepay_admin_permissions").insert(
        data.permissions.map((p) => ({ user_id: data.user_id, permission: p, granted_by: context.userId })),
      );
      if (error) throw new Error(error.message);
    }
    await supabaseAdmin.from("lifepay_audit_logs").insert({
      actor_id: context.userId, action: "permissions_updated", target_user: data.user_id,
      after_data: { permissions: data.permissions },
    });
    return { ok: true };
  });

export const lifepayAdminAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePerm(context, "audit");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("lifepay_audit_logs")
      .select("*").order("created_at", { ascending: false }).limit(200);
    return data ?? [];
  });

/* ------------------------------------------------------------------ *
 * Cartão: dados completos só após confirmação de identidade           *
 * ------------------------------------------------------------------ */

export const lifepayRevealCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { card_id: string; method: "password" | "pin"; value: string }) => {
    if (!d?.card_id) throw new Error("Cartão inválido.");
    if (d?.method !== "password" && d?.method !== "pin") throw new Error("Método inválido.");
    if (!d?.value) throw new Error("Informe a confirmação.");
    return d;
  })
  .handler(async ({ data, context }) => {
    if (data.method === "password") {
      const email = (context.claims as any)?.email as string | undefined;
      if (!email || !(await verifyPasswordFor(email, data.value))) throw new Error("Senha incorreta.");
    } else {
      const { verifyPinHash } = await import("@/lib/lifepay-crypto.server");
      const { data: acc } = await context.supabase
        .from("lifepay_accounts").select("pin_hash").eq("user_id", context.userId).maybeSingle();
      if (!acc?.pin_hash) throw new Error("Nenhum PIN cadastrado.");
      if (!verifyPinHash(data.value, acc.pin_hash)) throw new Error("PIN incorreto.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: card, error } = await supabaseAdmin
      .from("lifepay_cards")
      .select("id, pan, cvv, exp_month, exp_year, holder_name, user_id, deleted_at")
      .eq("id", data.card_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!card || (card as any).user_id !== context.userId || (card as any).deleted_at) {
      throw new Error("Cartão não encontrado.");
    }

    await supabaseAdmin.from("lifepay_audit_logs").insert({
      actor_id: context.userId, actor_kind: "user", action: "card_revealed",
      target_user: context.userId, target_ref: data.card_id, auth_method: data.method,
    });

    const c = card as any;
    return {
      pan: String(c.pan).replace(/(\d{4})(?=\d)/g, "$1 "),
      cvv: c.cvv as string,
      expiry: `${String(c.exp_month).padStart(2, "0")}/${String(c.exp_year).slice(-2)}`,
      holder: c.holder_name as string,
    };
  });
