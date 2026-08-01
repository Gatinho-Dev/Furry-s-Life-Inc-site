import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertCeoOrAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("is_ceo_or_admin", { _user_id: ctx.userId });
  if (error) throw new Error("Falha ao verificar permissão.");
  if (!data) throw new Error("Acesso negado: somente CEO/Admin.");
}

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; password: string; full_name?: string; is_worker?: boolean }) => {
    if (!d?.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) throw new Error("Email inválido.");
    if (!d?.password || d.password.length < 8) throw new Error("Senha precisa ter ≥ 8 caracteres.");
    return {
      email: d.email.trim().toLowerCase(),
      password: d.password,
      full_name: d.full_name?.trim() || null,
      is_worker: d.is_worker === true,
    };
  })
  .handler(async ({ data, context }) => {
    await assertCeoOrAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw new Error(error.message);
    // Só marca como trabalhador(a) quando pedido — contas comuns ficam de fora
    // da aba Trabalhadores.
    if (created.user?.id) {
      await (supabaseAdmin as any).from("lifepay_accounts")
        .update({ is_worker: data.is_worker }).eq("user_id", created.user.id);
    }
    return { id: created.user?.id, email: created.user?.email };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => {
    if (!d?.user_id) throw new Error("user_id obrigatório.");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertCeoOrAdmin(context);
    if (data.user_id === context.userId) throw new Error("Você não pode excluir a si mesmo.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; new_password: string }) => {
    if (!d?.user_id) throw new Error("user_id obrigatório.");
    if (!d?.new_password || d.new_password.length < 8) throw new Error("Senha precisa ter ≥ 8 caracteres.");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertCeoOrAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.new_password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
