import { useState } from "react";
import { Send, Check, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function Contact() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", email: "", assunto: "", mensagem: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending"); setErr(null);
    const { error } = await supabase.from("contact_inbox").insert({
      name: form.nome.trim().slice(0, 100),
      email: form.email.trim().slice(0, 200),
      subject: form.assunto.trim().slice(0, 200),
      body: form.mensagem.trim().slice(0, 4000),
    });
    if (error) { setState("error"); setErr(error.message); return; }
    setState("sent");
    setForm({ nome: "", email: "", assunto: "", mensagem: "" });
    setTimeout(() => setState("idle"), 3000);
  };

  const field = "w-full rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:bg-secondary/70";
  return (
    <section id="contato" className="mx-auto max-w-5xl scroll-mt-24 px-6 py-20">
      <div className="glass-card overflow-hidden rounded-3xl p-8 md:p-12">
        <div className="grid gap-10 md:grid-cols-[1fr_1.2fr]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-primary">Fale conosco</div>
            <h2 className="mt-3 text-balance text-3xl font-bold md:text-4xl">
              Vamos <span className="text-gradient">conversar</span>.
            </h2>
            <p className="mt-4 text-sm text-muted-foreground">
              Parcerias, imprensa, oportunidades de carreira ou dúvidas sobre nossas subsidiárias —
              respondemos diretamente pelo painel interno.
            </p>
            <div className="mt-6 space-y-2 text-sm text-muted-foreground">
              <div><span className="text-foreground">Email:</span> furryslifeinc@gmail.com</div>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input required maxLength={100} placeholder="Nome" className={field}
                value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              <input required type="email" maxLength={200} placeholder="E-mail" className={field}
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <input required maxLength={200} placeholder="Assunto" className={field}
              value={form.assunto} onChange={(e) => setForm({ ...form, assunto: e.target.value })} />
            <textarea required maxLength={4000} rows={5} placeholder="Mensagem" className={field}
              value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} />
            {err && <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"><AlertCircle className="h-4 w-4" />{err}</div>}
            <button type="submit"
              className="glass-button inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-70"
              disabled={state === "sending" || state === "sent"}>
              {state === "sent"
                ? (<><Check className="h-4 w-4" /> Mensagem recebida</>)
                : (<><Send className="h-4 w-4" /> {state === "sending" ? "Enviando..." : "Enviar mensagem"}</>)}
            </button>
            <p className="text-center text-[11px] text-muted-foreground">Sua mensagem vai direto para a inbox interna do staff.</p>
          </form>
        </div>
      </div>
    </section>
  );
}
