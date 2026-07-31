import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ------------------------------------------------------------------ *
 * Diretório de trabalhadores e e-mails (painel staff geral)           *
 * ------------------------------------------------------------------ */

async function assertCeoOrAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("is_ceo_or_admin", { _user_id: ctx.userId });
  if (error) throw new Error("Falha ao verificar permissão.");
  if (!data) throw new Error("Acesso negado: somente CEO/Admin.");
}

export type WorkerRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  access: string[];
  sub_roles: { subsidiary: string; sub_role: string }[];
  job_title: string | null;
  department: string | null;
  salary_cents: number;
  salary_day: number;
  lifepay_status: string | null;
  lifepay_email: string | null;
  has_pin: boolean;
  last_access_at: string | null;
};

export const staffListWorkers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkerRow[]> => {
    await assertCeoOrAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const [profiles, roles, access, subRoles, accounts] = await Promise.all([
      db.from("profiles").select("id, full_name, email, created_at").order("created_at", { ascending: true }),
      db.from("user_roles").select("user_id, role"),
      db.from("user_subsidiary_access").select("user_id, subsidiary"),
      db.from("user_subsidiary_roles").select("user_id, subsidiary, sub_role"),
      db.from("lifepay_accounts")
        .select("user_id, email, status, job_title, department, salary_cents, salary_day, pin_hash, last_access_at"),
    ]);

    const roleOf = new Map<string, string>();
    for (const r of roles.data ?? []) if (!roleOf.has(r.user_id) || r.role !== "staff") roleOf.set(r.user_id, r.role);
    const accessOf = new Map<string, string[]>();
    for (const a of access.data ?? []) accessOf.set(a.user_id, [...(accessOf.get(a.user_id) ?? []), a.subsidiary]);
    const subRoleOf = new Map<string, { subsidiary: string; sub_role: string }[]>();
    for (const r of subRoles.data ?? [])
      subRoleOf.set(r.user_id, [...(subRoleOf.get(r.user_id) ?? []), { subsidiary: r.subsidiary, sub_role: r.sub_role }]);
    const accOf = new Map<string, any>();
    for (const a of accounts.data ?? []) accOf.set(a.user_id, a);

    return (profiles.data ?? []).map((p: any) => {
      const acc = accOf.get(p.id);
      return {
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        role: roleOf.get(p.id) ?? "staff",
        access: accessOf.get(p.id) ?? [],
        sub_roles: subRoleOf.get(p.id) ?? [],
        job_title: acc?.job_title ?? null,
        department: acc?.department ?? null,
        salary_cents: acc?.salary_cents ?? 0,
        salary_day: acc?.salary_day ?? 5,
        lifepay_status: acc?.status ?? null,
        lifepay_email: acc?.email ?? null,
        has_pin: !!acc?.pin_hash,
        last_access_at: acc?.last_access_at ?? null,
      };
    });
  });

export const staffUpdateWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    user_id: string;
    full_name?: string;
    job_title?: string;
    department?: string;
    salary_cents?: number;
    salary_day?: number;
  }) => {
    if (!d?.user_id) throw new Error("Usuário inválido.");
    if (d.salary_cents !== undefined && (!Number.isInteger(d.salary_cents) || d.salary_cents < 0))
      throw new Error("Salário inválido.");
    if (d.salary_day !== undefined && (!Number.isInteger(d.salary_day) || d.salary_day < 1 || d.salary_day > 28))
      throw new Error("O dia do pagamento deve ficar entre 1 e 28.");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertCeoOrAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    if (data.full_name !== undefined) {
      await db.from("profiles").update({ full_name: data.full_name.trim() || null }).eq("id", data.user_id);
    }
    const patch: Record<string, unknown> = {};
    if (data.full_name !== undefined) patch.full_name = data.full_name.trim() || null;
    if (data.job_title !== undefined) patch.job_title = data.job_title.trim() || null;
    if (data.department !== undefined) patch.department = data.department.trim() || null;
    if (data.salary_cents !== undefined) patch.salary_cents = data.salary_cents;
    if (data.salary_day !== undefined) patch.salary_day = data.salary_day;
    if (Object.keys(patch).length) {
      await db.from("lifepay_accounts").update(patch).eq("user_id", data.user_id);
    }

    await db.from("lifepay_audit_logs").insert({
      actor_id: context.userId, actor_kind: "user", action: "worker_updated",
      target_user: data.user_id, after_data: patch,
    });
    return { ok: true };
  });

/** Troca o e-mail de acesso em todos os lugares (login, perfil e LifePay). */
export const staffChangeEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; email: string }) => {
    if (!d?.user_id) throw new Error("Usuário inválido.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d?.email ?? "")) throw new Error("E-mail inválido.");
    return { user_id: d.user_id, email: d.email.trim().toLowerCase() };
  })
  .handler(async ({ data, context }) => {
    await assertCeoOrAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      email: data.email, email_confirm: true,
    });
    if (error) throw new Error(error.message);
    await db.from("profiles").update({ email: data.email }).eq("id", data.user_id);
    await db.from("lifepay_accounts").update({ email: data.email }).eq("user_id", data.user_id);
    await db.from("lifepay_audit_logs").insert({
      actor_id: context.userId, actor_kind: "user", action: "email_changed",
      target_user: data.user_id, after_data: { email: data.email },
    });
    return { ok: true };
  });

/**
 * Unifica as credenciais: a mesma senha vale para o site, o painel staff e o
 * LifePay, e o PIN antigo do LifePay é apagado (a pessoa cadastra outro).
 */
export const staffUnifyPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; password: string; force_change?: boolean }) => {
    if (!d?.user_id) throw new Error("Usuário inválido.");
    if (!d?.password || d.password.length < 8 || !/[A-Za-z]/.test(d.password) || !/\d/.test(d.password))
      throw new Error("A senha precisa de 8+ caracteres, com letra e número.");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertCeoOrAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.password });
    if (error) throw new Error(error.message);
    await db.from("lifepay_accounts").update({
      pin_hash: null,
      must_change_password: data.force_change === true,
    }).eq("user_id", data.user_id);
    await db.from("lifepay_audit_logs").insert({
      actor_id: context.userId, actor_kind: "user", action: "password_unified", target_user: data.user_id,
    });
    return { ok: true };
  });

/** Define/reseta apenas o PIN do LifePay dessa pessoa. */
export const staffSetLifepayPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; pin: string | null }) => {
    if (!d?.user_id) throw new Error("Usuário inválido.");
    if (d.pin && !/^\d{4,8}$/.test(d.pin)) throw new Error("O PIN deve ter de 4 a 8 dígitos.");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertCeoOrAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    let hash: string | null = null;
    if (data.pin) {
      const { hashPin } = await import("@/lib/lifepay-crypto.server");
      hash = hashPin(data.pin);
    }
    await db.from("lifepay_accounts").update({ pin_hash: hash }).eq("user_id", data.user_id);
    await db.from("lifepay_audit_logs").insert({
      actor_id: context.userId, actor_kind: "user",
      action: data.pin ? "lifepay_pin_set_by_admin" : "lifepay_pin_cleared",
      target_user: data.user_id,
    });
    return { ok: true };
  });

/** Paga o salário configurado (crédito no saldo LifePay). */
export const staffPaySalary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; reference?: string }) => {
    if (!d?.user_id) throw new Error("Usuário inválido.");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertCeoOrAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: acc } = await db.from("lifepay_accounts")
      .select("balance, salary_cents").eq("user_id", data.user_id).maybeSingle();
    if (!acc) throw new Error("Conta LifePay não encontrada.");
    if (!acc.salary_cents) throw new Error("Esta pessoa não tem salário configurado.");

    const next = acc.balance + acc.salary_cents;
    const { error } = await db.from("lifepay_accounts").update({ balance: next }).eq("user_id", data.user_id);
    if (error) throw new Error(error.message);

    const ref = (data.reference ?? new Date().toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" }));
    await db.from("lifepay_transactions").insert({
      from_user: context.userId, to_user: data.user_id, amount: acc.salary_cents,
      kind: "salary", note: `Salário ${ref}`, status: "completed", auth_method: "admin",
      to_balance_before: acc.balance, to_balance_after: next,
    });
    await db.from("lifepay_audit_logs").insert({
      actor_id: context.userId, actor_kind: "user", action: "salary_paid",
      target_user: data.user_id, after_data: { amount: acc.salary_cents, reference: ref },
    });
    return { balance: next };
  });
