import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ------------------------------------------------------------------ *
 * Webmail interno — caixa de entrada dos e-mails do domínio           *
 * ------------------------------------------------------------------ */

export type MailFolder = "inbox" | "starred" | "sent" | "archive" | "spam" | "trash";

export type MailMessage = {
  id: string;
  folder: Exclude<MailFolder, "starred">;
  direction: "inbound" | "outbound";
  from_address: string;
  from_name: string | null;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string;
  snippet: string;
  text_body: string | null;
  html_body: string | null;
  attachments: { filename?: string; size?: number; url?: string }[];
  is_read: boolean;
  is_starred: boolean;
  received_at: string;
};

export type MailCounts = Record<MailFolder, number> & { unread: number };

const FOLDERS = ["inbox", "sent", "archive", "spam", "trash"] as const;

function myAddress(context: any): string {
  const email = (context.claims as any)?.email as string | undefined;
  if (!email) throw new Error("Sua conta não possui endereço de e-mail.");
  return email.toLowerCase();
}

export const mailList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { folder?: MailFolder; search?: string; limit?: number }) => ({
    folder: (d?.folder ?? "inbox") as MailFolder,
    search: (d?.search ?? "").toString().slice(0, 80).trim(),
    limit: Math.min(200, Math.max(10, Math.round(Number(d?.limit ?? 60)))),
  }))
  .handler(async ({ data, context }): Promise<{ address: string; messages: MailMessage[]; counts: MailCounts }> => {
    const address = myAddress(context);
    const db = context.supabase as any;

    let q = db
      .from("mail_messages")
      .select("id, folder, direction, from_address, from_name, to_addresses, cc_addresses, subject, snippet, text_body, html_body, attachments, is_read, is_starred, received_at")
      .eq("user_id", context.userId)
      .order("received_at", { ascending: false })
      .limit(data.limit);

    if (data.folder === "starred") q = q.eq("is_starred", true).neq("folder", "trash");
    else q = q.eq("folder", data.folder);

    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`subject.ilike.${s},from_address.ilike.${s},snippet.ilike.${s}`);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const { data: all } = await db
      .from("mail_messages")
      .select("folder, is_read, is_starred")
      .eq("user_id", context.userId)
      .limit(2000);

    const counts = { inbox: 0, starred: 0, sent: 0, archive: 0, spam: 0, trash: 0, unread: 0 } as MailCounts;
    for (const r of (all ?? []) as any[]) {
      if (FOLDERS.includes(r.folder)) counts[r.folder as keyof MailCounts] = (counts[r.folder as keyof MailCounts] as number) + 1;
      if (r.is_starred && r.folder !== "trash") counts.starred += 1;
      if (!r.is_read && r.folder === "inbox") counts.unread += 1;
    }

    return { address, messages: (rows ?? []) as MailMessage[], counts };
  });

export const mailUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[]; patch: { is_read?: boolean; is_starred?: boolean; folder?: Exclude<MailFolder, "starred"> } }) => {
    const ids = Array.isArray(d?.ids) ? d.ids.filter((x) => typeof x === "string").slice(0, 200) : [];
    if (!ids.length) throw new Error("Nenhuma mensagem selecionada.");
    const patch: Record<string, unknown> = {};
    if (typeof d?.patch?.is_read === "boolean") patch.is_read = d.patch.is_read;
    if (typeof d?.patch?.is_starred === "boolean") patch.is_starred = d.patch.is_starred;
    if (d?.patch?.folder) {
      if (!FOLDERS.includes(d.patch.folder as any)) throw new Error("Pasta inválida.");
      patch.folder = d.patch.folder;
    }
    if (!Object.keys(patch).length) throw new Error("Nada para atualizar.");
    return { ids, patch };
  })
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("mail_messages").update(data.patch).in("id", data.ids).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const mailDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[] }) => {
    const ids = Array.isArray(d?.ids) ? d.ids.slice(0, 200) : [];
    if (!ids.length) throw new Error("Nenhuma mensagem selecionada.");
    return { ids };
  })
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("mail_messages").delete().in("id", data.ids).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const SENDER_DOMAIN = "notify.furrys.life";
const FROM_DOMAIN = "furrys.life";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function bodyToHtml(subject: string, body: string, fromName: string, fromAddress: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.6">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<!doctype html><html><body style="background:#ffffff;margin:0;padding:24px;font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#16181c">
<div style="max-width:600px;margin:0 auto">
<h1 style="font-size:18px;margin:0 0 16px">${escapeHtml(subject)}</h1>
${paragraphs}
<hr style="border:none;border-top:1px solid #e6e8eb;margin:24px 0 12px"/>
<p style="font-size:12px;color:#8a8f98;margin:0">Enviado por ${escapeHtml(fromName || fromAddress)} · ${escapeHtml(fromAddress)}</p>
</div></body></html>`;
}

/**
 * Envia uma mensagem. Endereços internos (contas do site) são entregues direto
 * na caixa de entrada do destinatário; endereços externos (Gmail, Outlook, etc.)
 * saem de verdade pelo domínio de envio da empresa, com o e-mail do usuário
 * como Reply-To.
 */
export const mailSend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { to: string; subject: string; body: string }) => {
    const to = (d?.to ?? "").toString().trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw new Error("Destinatário inválido.");
    const subject = (d?.subject ?? "").toString().slice(0, 200).trim();
    const body = (d?.body ?? "").toString().slice(0, 20000);
    if (!body.trim()) throw new Error("Escreva a mensagem.");
    return { to, subject: subject || "(sem assunto)", body };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const address = myAddress(context);

    const { data: me } = await db.from("profiles").select("full_name").eq("id", context.userId).maybeSingle();
    const fromName: string = me?.full_name ?? address.split("@")[0];
    const snippet = data.body.replace(/\s+/g, " ").slice(0, 160);

    // cópia em "Enviados"
    await db.from("mail_messages").insert({
      mailbox_address: address,
      user_id: context.userId,
      direction: "outbound",
      folder: "sent",
      from_address: address,
      from_name: me?.full_name ?? null,
      to_addresses: [data.to],
      subject: data.subject,
      snippet,
      text_body: data.body,
    });

    // entrega interna quando o destinatário tem conta no site
    const { data: dest } = await db.from("profiles").select("id, email").ilike("email", data.to).maybeSingle();
    let delivered: "internal" | "external" | "queued" | "failed" = "external";
    if (dest?.id) {
      await db.from("mail_messages").insert({
        mailbox_address: data.to,
        user_id: dest.id,
        direction: "inbound",
        folder: "inbox",
        from_address: address,
        from_name: me?.full_name ?? null,
        to_addresses: [data.to],
        subject: data.subject,
        snippet,
        text_body: data.body,
      });
      delivered = "internal";
    }

    // envio real para fora (Gmail, Outlook, etc.)
    const external = !dest?.id;
    if (external) {
      const messageId = crypto.randomUUID();
      const { error } = await db.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          message_id: messageId,
          to: data.to,
          from: `${fromName} <${address.split("@")[0]}@${FROM_DOMAIN}>`,
          sender_domain: SENDER_DOMAIN,
          reply_to: address,
          subject: data.subject,
          html: bodyToHtml(data.subject, data.body, fromName, address),
          text: data.body,
          purpose: "transactional",
          label: "webmail",
          idempotency_key: messageId,
          queued_at: new Date().toISOString(),
        },
      });
      if (error) {
        console.error("Falha ao enfileirar e-mail externo", error);
        delivered = "failed";
      } else {
        delivered = "queued";
      }
    }

    return { ok: true, delivered };
  });

