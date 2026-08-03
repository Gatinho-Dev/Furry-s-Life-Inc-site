import { createFileRoute } from "@tanstack/react-router";

/**
 * Recebimento de e-mails (entrada) — endpoint para o roteador de e-mails do
 * domínio (ex.: Cloudflare Email Routing / provedor com webhook de inbound).
 *
 * Segurança: exige o cabeçalho `x-inbound-secret` igual ao segredo
 * MAIL_INBOUND_SECRET. Sem segredo configurado o endpoint recusa tudo.
 */

type InboundPayload = {
  to?: string | string[];
  cc?: string | string[];
  from?: string;
  from_name?: string;
  subject?: string;
  text?: string;
  html?: string;
  message_id?: string;
  received_at?: string;
  attachments?: { filename?: string; size?: number; url?: string }[];
};

const asList = (v: unknown): string[] =>
  (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [])
    .map((s) => String(s).trim().toLowerCase())
    .filter(Boolean);

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const Route = createFileRoute("/api/public/email/inbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["MAIL_INBOUND_SECRET"];
        const provided = request.headers.get("x-inbound-secret");
        if (!secret || !provided || provided !== secret) {
          return new Response("unauthorized", { status: 401 });
        }

        let payload: InboundPayload;
        try {
          payload = (await request.json()) as InboundPayload;
        } catch {
          return new Response("invalid json", { status: 400 });
        }

        const to = asList(payload.to);
        const cc = asList(payload.cc);
        const from = String(payload.from ?? "").trim().toLowerCase();
        if (!to.length || !from) return new Response("missing to/from", { status: 400 });

        const text = payload.text ?? (payload.html ? stripHtml(payload.html) : "");
        const snippet = text.replace(/\s+/g, " ").slice(0, 200);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;

        let stored = 0;
        for (const address of [...to, ...cc]) {
          const { data: profile } = await db
            .from("profiles").select("id").ilike("email", address).maybeSingle();
          const { data: acc } = profile
            ? { data: null }
            : await db.from("lifepay_accounts").select("user_id").ilike("email", address).maybeSingle();
          const userId = profile?.id ?? acc?.user_id ?? null;
          if (!userId) continue;

          const { error } = await db.from("mail_messages").insert({
            mailbox_address: address,
            user_id: userId,
            direction: "inbound",
            folder: "inbox",
            from_address: from,
            from_name: payload.from_name ?? null,
            to_addresses: to,
            cc_addresses: cc,
            subject: (payload.subject ?? "").slice(0, 300),
            snippet,
            text_body: text || null,
            html_body: payload.html ?? null,
            attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
            provider_message_id: payload.message_id
              ? `${payload.message_id}:${address}`.slice(0, 300)
              : null,
            received_at: payload.received_at ?? new Date().toISOString(),
          });
          if (!error) stored += 1;
        }

        return Response.json({ ok: true, stored });
      },
    },
  },
});
