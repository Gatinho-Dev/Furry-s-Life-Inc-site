import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ------------------------------------------------------------------ *
 * Cobranças / links de pagamento do LifePay ("Receber")               *
 * ------------------------------------------------------------------ */

export type PaymentRequest = {
  id: string;
  token: string;
  amount: number;
  note: string | null;
  status: "pending" | "paid" | "expired" | "canceled";
  expires_at: string;
  created_at: string;
  paid_at: string | null;
};

export type PaymentRequestPublic = {
  token: string;
  amount: number;
  note: string | null;
  status: PaymentRequest["status"];
  expires_at: string;
  receiver_name: string;
  receiver_key: string;
  is_own: boolean;
};

function newToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 28);
}

async function receiverKeyFor(db: any, userId: string): Promise<string> {
  const { data } = await db
    .from("lifepay_keys")
    .select("key_value, key_type")
    .eq("user_id", userId)
    .eq("status", "active")
    .is("deleted_at", null);
  const rows = (data ?? []) as { key_value: string; key_type: string }[];
  const email = rows.find((r) => r.key_type === "email");
  const chosen = email ?? rows[0];
  if (!chosen) throw new Error("Você precisa de uma chave LifePay ativa para receber.");
  return chosen.key_value;
}

export const lifepayCreatePaymentRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { amount: number; minutes: number; note?: string }) => {
    const amount = Math.round(Number(d?.amount));
    const minutes = Math.round(Number(d?.minutes));
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Informe um valor maior que zero.");
    if (amount > 100_000_000_00) throw new Error("Valor acima do limite permitido.");
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 10)
      throw new Error("A validade do link deve ficar entre 1 e 10 minutos.");
    return { amount, minutes, note: (d?.note ?? "").toString().slice(0, 120).trim() };
  })
  .handler(async ({ data, context }): Promise<PaymentRequestPublic & { id: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const key = await receiverKeyFor(db, context.userId);

    const { data: acc } = await db
      .from("lifepay_accounts").select("display_name, full_name").eq("user_id", context.userId).maybeSingle();

    const expires = new Date(Date.now() + data.minutes * 60_000).toISOString();
    const { data: row, error } = await db
      .from("lifepay_payment_requests")
      .insert({
        user_id: context.userId,
        token: newToken(),
        amount: data.amount,
        note: data.note || null,
        expires_at: expires,
      })
      .select("id, token, amount, note, status, expires_at")
      .maybeSingle();
    if (error) throw new Error(error.message);

    await db.from("lifepay_audit_logs").insert({
      actor_id: context.userId, actor_kind: "user", action: "payment_request_created",
      target_user: context.userId, target_ref: row.token,
    });

    return {
      id: row.id,
      token: row.token,
      amount: row.amount,
      note: row.note,
      status: row.status,
      expires_at: row.expires_at,
      receiver_name: acc?.display_name ?? acc?.full_name ?? "Conta LifePay",
      receiver_key: key,
      is_own: true,
    };
  });

export const lifepayListPaymentRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PaymentRequest[]> => {
    const { data } = await (context.supabase as any)
      .from("lifepay_payment_requests")
      .select("id, token, amount, note, status, expires_at, created_at, paid_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return (data ?? []) as PaymentRequest[];
  });

export const lifepayGetPaymentRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { token: string }) => {
    const token = (d?.token ?? "").toString().trim();
    if (!token || token.length > 64) throw new Error("Link de pagamento inválido.");
    return { token };
  })
  .handler(async ({ data, context }): Promise<PaymentRequestPublic> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: row } = await db
      .from("lifepay_payment_requests")
      .select("id, user_id, token, amount, note, status, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!row) throw new Error("Cobrança não encontrada. O link pode ter sido removido.");

    let status = row.status as PaymentRequest["status"];
    if (status === "pending" && new Date(row.expires_at).getTime() < Date.now()) {
      await db.from("lifepay_payment_requests").update({ status: "expired" }).eq("id", row.id);
      status = "expired";
    }

    const { data: acc } = await db
      .from("lifepay_accounts").select("display_name, full_name").eq("user_id", row.user_id).maybeSingle();

    return {
      token: row.token,
      amount: row.amount,
      note: row.note,
      status,
      expires_at: row.expires_at,
      receiver_name: acc?.display_name ?? acc?.full_name ?? "Conta LifePay",
      receiver_key: await receiverKeyFor(db, row.user_id),
      is_own: row.user_id === context.userId,
    };
  });

export const lifepayPayPaymentRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    token: string; authMethod: string; idempotencyKey: string;
    source?: "balance" | "credit"; cardId?: string | null; installments?: number;
  }) => {
    const token = (d?.token ?? "").toString().trim();
    if (!token) throw new Error("Link de pagamento inválido.");
    if (!d?.idempotencyKey || d.idempotencyKey.length < 8) throw new Error("Requisição inválida.");
    const source = d.source === "credit" ? "credit" : "balance";
    return {
      token,
      authMethod: (d.authMethod ?? "pin").toString().slice(0, 20),
      idempotencyKey: d.idempotencyKey.toString().slice(0, 64),
      source,
      cardId: d.cardId ?? null,
      installments: Math.min(24, Math.max(1, Math.round(Number(d.installments ?? 1)))),
    };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: row } = await db
      .from("lifepay_payment_requests")
      .select("id, user_id, amount, note, status, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!row) throw new Error("Cobrança não encontrada.");
    if (row.user_id === context.userId) throw new Error("Não é possível pagar a própria cobrança.");
    if (row.status === "paid") throw new Error("Esta cobrança já foi paga.");
    if (row.status !== "pending") throw new Error("Esta cobrança não está mais disponível.");
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await db.from("lifepay_payment_requests").update({ status: "expired" }).eq("id", row.id);
      throw new Error("O link de pagamento expirou. Peça um novo ao recebedor.");
    }

    const key = await receiverKeyFor(db, row.user_id);

    // A transferência roda como o próprio usuário (RLS + regras do banco).
    const { data: tx, error } = await (context.supabase as any).rpc("lifepay_transfer_v3", {
      _key: key,
      _amount: row.amount,
      _note: row.note ? `Cobrança: ${row.note}` : "Pagamento de cobrança LifePay",
      _auth_method: data.authMethod,
      _idem: data.idempotencyKey,
      _source: data.source,
      _card_id: data.cardId,
      _installments: data.installments,
    });
    if (error) throw new Error(error.message);
    const txRow = Array.isArray(tx) ? tx[0] : tx;

    const { data: payer } = await db
      .from("lifepay_accounts").select("display_name, full_name").eq("user_id", context.userId).maybeSingle();

    await db.from("lifepay_payment_requests").update({
      status: "paid",
      paid_by: context.userId,
      paid_at: new Date().toISOString(),
      transaction_id: txRow?.id ?? null,
    }).eq("id", row.id);

    const value = (row.amount / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    await db.from("lifepay_notifications").insert({
      user_id: row.user_id,
      kind: "payment_received",
      title: `Cobrança paga — ${value}`,
      body: `${payer?.display_name ?? payer?.full_name ?? "Alguém"} pagou sua cobrança${row.note ? ` (${row.note})` : ""}.`,
    });

    return { ok: true, receipt: txRow?.receipt_code ?? null, amount: row.amount };
  });

export const lifepayCancelPaymentRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!d?.id) throw new Error("Cobrança inválida.");
    return { id: d.id };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { error } = await db
      .from("lifepay_payment_requests")
      .update({ status: "canceled" })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ *
 * Avisos internos                                                     *
 * ------------------------------------------------------------------ */

export type LpNotification = {
  id: string; kind: string; title: string; body: string | null;
  read_at: string | null; created_at: string;
};

export const lifepayNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LpNotification[]> => {
    const { data } = await (context.supabase as any)
      .from("lifepay_notifications")
      .select("id, kind, title, body, read_at, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(30);
    return (data ?? []) as LpNotification[];
  });

export const lifepayMarkNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await (context.supabase as any)
      .from("lifepay_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("read_at", null);
    return { ok: true };
  });
