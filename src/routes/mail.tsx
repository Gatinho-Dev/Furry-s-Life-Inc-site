import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Inbox, Star, Send as SendIcon, Archive, ShieldAlert, Trash2, Search, RefreshCw, Pencil,
  X, Loader2, ArrowLeft, MailOpen, Mail as MailIcon, CornerUpLeft, Paperclip, Menu,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { mailList, mailUpdate, mailDelete, mailSend, type MailFolder, type MailMessage, type MailCounts } from "@/lib/mail.functions";
import { sfx } from "@/lib/sfx";

export const Route = createFileRoute("/mail")({
  head: () => ({
    meta: [
      { title: "Caixa de entrada — Furry's Life Mail" },
      { name: "description", content: "Webmail interno da Furry's Life Inc.: leia e responda os e-mails do seu endereço do domínio." },
      { property: "og:title", content: "Furry's Life Mail" },
      { property: "og:description", content: "Caixa de entrada dos endereços do domínio da Furry's Life Inc." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  ssr: false,
  component: MailPage,
});

const FOLDERS: { key: MailFolder; label: string; icon: typeof Inbox }[] = [
  { key: "inbox", label: "Entrada", icon: Inbox },
  { key: "starred", label: "Com estrela", icon: Star },
  { key: "sent", label: "Enviados", icon: SendIcon },
  { key: "archive", label: "Arquivados", icon: Archive },
  { key: "spam", label: "Spam", icon: ShieldAlert },
  { key: "trash", label: "Lixeira", icon: Trash2 },
];

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
};

const initials = (s: string) => s.replace(/[^A-Za-zÀ-ÿ]/g, " ").trim().slice(0, 1).toUpperCase() || "?";

function MailPage() {
  const nav = useNavigate();
  const list = useServerFn(mailList);
  const update = useServerFn(mailUpdate);
  const remove = useServerFn(mailDelete);

  const [ready, setReady] = useState(false);
  const [address, setAddress] = useState("");
  const [folder, setFolder] = useState<MailFolder>("inbox");
  const [search, setSearch] = useState("");
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [counts, setCounts] = useState<MailCounts | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [composeTo, setComposeTo] = useState<string | null>(null);
  const [sidebar, setSidebar] = useState(false);

  const load = useCallback(async (f: MailFolder, q: string) => {
    setBusy(true); setErr(null);
    try {
      const res = await list({ data: { folder: f, search: q } });
      setAddress(res.address);
      setMessages(res.messages);
      setCounts(res.counts);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Não foi possível carregar as mensagens.");
    } finally {
      setBusy(false);
    }
  }, [list]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { nav({ to: "/auth", search: { redirect: "/mail" } }); return; }
      setReady(true);
      await load("inbox", "");
    })();
  }, [nav, load]);


  useEffect(() => { if (ready) void load(folder, search); }, [folder, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = useMemo(() => messages.find((m) => m.id === openId) ?? null, [messages, openId]);

  const openMessage = async (m: MailMessage) => {
    setOpenId(m.id);
    sfx("open");
    if (!m.is_read) {
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, is_read: true } : x)));
      try { await update({ data: { ids: [m.id], patch: { is_read: true } } }); } catch { /* ignora */ }
      setCounts((c) => (c ? { ...c, unread: Math.max(0, c.unread - 1) } : c));
    }
  };

  const act = async (fn: () => Promise<unknown>, sound: "toggle" | "close" = "toggle") => {
    sfx(sound);
    try { await fn(); await load(folder, search); }
    catch (e) { setErr(e instanceof Error ? e.message : "Falha na operação."); sfx("error"); }
  };

  const star = (m: MailMessage) => {
    setMessages((p) => p.map((x) => (x.id === m.id ? { ...x, is_starred: !x.is_starred } : x)));
    void update({ data: { ids: [m.id], patch: { is_starred: !m.is_starred } } }).catch(() => {});
    sfx("tap");
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Abrindo sua caixa de entrada...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Barra superior */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/60 bg-card/70 px-4 py-3 backdrop-blur-xl">
        <button onClick={() => setSidebar((s) => !s)} className="rounded-full p-2 hover:bg-muted md:hidden" aria-label="Menu">
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <MailIcon className="h-5 w-5 text-primary" /> <span className="hidden sm:inline">Furry&apos;s Life</span> Mail
        </div>
        <div className="relative ml-auto w-full max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void load(folder, search); }}
            placeholder="Pesquisar e-mails"
            className="w-full rounded-full border border-border/70 bg-muted/40 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-primary/60 focus:bg-background"
          />
        </div>
        <button onClick={() => void load(folder, search)} className="rounded-full p-2 hover:bg-muted" aria-label="Atualizar">
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
        </button>
        <span className="hidden truncate text-xs text-muted-foreground lg:block">{address}</span>
      </header>

      <div className="flex">
        {/* Menu lateral */}
        <aside className={`${sidebar ? "block" : "hidden"} fixed inset-y-14 left-0 z-20 w-64 shrink-0 border-r border-border/60 bg-card/95 p-3 backdrop-blur-xl md:sticky md:top-14 md:block md:h-[calc(100vh-3.5rem)] md:bg-transparent`}>
          <button
            onClick={() => { setComposeTo(""); sfx("open"); }}
            className="mb-4 flex items-center gap-3 rounded-2xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition hover:brightness-110 active:scale-[.98]"
          >
            <Pencil className="h-4 w-4" /> Escrever
          </button>
          <nav className="space-y-1">
            {FOLDERS.map((f) => {
              const n = counts ? (f.key === "inbox" ? counts.unread : (counts[f.key] as number)) : 0;
              const active = folder === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => { setFolder(f.key); setOpenId(null); setSidebar(false); sfx("tap"); }}
                  className={`flex w-full items-center gap-3 rounded-r-full px-4 py-2.5 text-sm transition ${
                    active ? "bg-primary/15 font-semibold text-foreground" : "text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  <f.icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
                  <span className="flex-1 text-left">{f.label}</span>
                  {n > 0 && <span className="text-xs font-semibold">{n}</span>}
                </button>
              );
            })}
          </nav>
          <p className="mt-6 px-4 text-[11px] leading-relaxed text-muted-foreground">
            Endereço: <span className="font-medium text-foreground">{address}</span><br />
            Mensagens recebidas neste endereço aparecem aqui automaticamente.
          </p>
        </aside>

        {/* Lista / leitura */}
        <main className="min-h-[calc(100vh-3.5rem)] flex-1">
          {err && (
            <div className="m-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{err}</div>
          )}

          {open ? (
            <article className="mx-auto max-w-3xl animate-fade-in p-4 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <button onClick={() => { setOpenId(null); sfx("close"); }} className="rounded-full p-2 hover:bg-muted" aria-label="Voltar">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button onClick={() => act(() => update({ data: { ids: [open.id], patch: { folder: "archive" } } }))} className="rounded-full p-2 hover:bg-muted" aria-label="Arquivar">
                  <Archive className="h-4 w-4" />
                </button>
                <button onClick={() => act(() => update({ data: { ids: [open.id], patch: { folder: "spam" } } }))} className="rounded-full p-2 hover:bg-muted" aria-label="Spam">
                  <ShieldAlert className="h-4 w-4" />
                </button>
                <button
                  onClick={() => act(() => (open.folder === "trash" ? remove({ data: { ids: [open.id] } }) : update({ data: { ids: [open.id], patch: { folder: "trash" } } })), "close")}
                  className="rounded-full p-2 hover:bg-muted" aria-label="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button onClick={() => act(() => update({ data: { ids: [open.id], patch: { is_read: false } } }))} className="ml-auto rounded-full p-2 hover:bg-muted" aria-label="Marcar como não lida">
                  <MailOpen className="h-4 w-4" />
                </button>
              </div>

              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{open.subject || "(sem assunto)"}</h1>
              <div className="mt-4 flex items-start gap-3 border-b border-border/60 pb-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                  {initials(open.from_name || open.from_address)}
                </span>
                <div className="min-w-0 text-sm">
                  <div className="font-medium">{open.from_name || open.from_address}</div>
                  <div className="truncate text-xs text-muted-foreground">{open.from_address} → {open.to_addresses.join(", ")}</div>
                </div>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{new Date(open.received_at).toLocaleString("pt-BR")}</span>
              </div>

              {open.html_body ? (
                <div className="mail-html mt-5 overflow-x-auto text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitize(open.html_body) }} />
              ) : (
                <pre className="mt-5 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">{open.text_body}</pre>
              )}

              {open.attachments?.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2">
                  {open.attachments.map((a, i) => (
                    <span key={i} className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-xs">
                      <Paperclip className="h-3.5 w-3.5" /> {a.filename ?? "anexo"}
                    </span>
                  ))}
                </div>
              )}

              <button onClick={() => { setComposeTo(open.from_address); sfx("open"); }} className="mt-8 flex items-center gap-2 rounded-full border border-border/70 px-5 py-2.5 text-sm font-medium transition hover:bg-muted">
                <CornerUpLeft className="h-4 w-4" /> Responder
              </button>
            </article>
          ) : (
            <ul className="divide-y divide-border/50">
              {messages.length === 0 && !busy && (
                <li className="px-6 py-20 text-center text-sm text-muted-foreground">Nenhuma mensagem nesta pasta.</li>
              )}
              {messages.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => void openMessage(m)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/50 ${m.is_read ? "" : "bg-primary/[0.04]"}`}
                  >
                    <span onClick={(e) => { e.stopPropagation(); star(m); }} className="shrink-0 rounded-full p-1 hover:bg-muted" role="button" aria-label="Estrela">
                      <Star className={`h-4 w-4 ${m.is_starred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                    </span>
                    <span className={`w-40 shrink-0 truncate text-sm ${m.is_read ? "text-muted-foreground" : "font-semibold"}`}>
                      {m.direction === "outbound" ? `Para: ${m.to_addresses[0] ?? ""}` : m.from_name || m.from_address}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      <span className={m.is_read ? "" : "font-semibold"}>{m.subject || "(sem assunto)"}</span>
                      <span className="text-muted-foreground"> — {m.snippet}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{fmtWhen(m.received_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>

      {composeTo !== null && (
        <Compose to={composeTo} onClose={() => { setComposeTo(null); sfx("close"); }} onSent={() => { void load(folder, search); }} />
      )}
    </div>
  );
}

/** Remove scripts/eventos do HTML do e-mail antes de exibir. */
function sanitize(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

function Compose({ to, onClose, onSent }: { to: string; onClose: () => void; onSent: () => void }) {
  const send = useServerFn(mailSend);
  const [dest, setDest] = useState(to);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await send({ data: { to: dest, subject, body } });
      sfx("mail");
      if (res.delivered === "internal") { onSent(); onClose(); }
      else if (res.delivered === "failed") {
        setErr("Não foi possível colocar a mensagem na fila de envio externo. Ela ficou salva em Enviados.");
        onSent();
      } else {
        setInfo("Mensagem enviada. A entrega para caixas externas (Gmail, Outlook…) acontece em alguns segundos.");
        onSent();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Não foi possível enviar."); sfx("error");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-0 sm:p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg animate-scale-in overflow-hidden rounded-t-2xl border border-border/70 bg-card shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <span className="text-sm font-semibold">Nova mensagem</span>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted" aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-2 p-4">
          <input value={dest} onChange={(e) => setDest(e.target.value)} placeholder="Para"
            className="w-full border-b border-border/60 bg-transparent px-1 py-2 text-sm outline-none focus:border-primary" />
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto"
            className="w-full border-b border-border/60 bg-transparent px-1 py-2 text-sm outline-none focus:border-primary" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} placeholder="Escreva sua mensagem..."
            className="w-full resize-none bg-transparent px-1 py-2 text-sm outline-none" />
          {err && <p className="text-xs text-destructive">{err}</p>}
          {info && <p className="text-xs text-muted-foreground">{info}</p>}
        </div>
        <div className="flex items-center gap-3 border-t border-border/60 px-4 py-3">
          <button onClick={() => void submit()} disabled={busy}
            className="flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendIcon className="h-4 w-4" />} Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
