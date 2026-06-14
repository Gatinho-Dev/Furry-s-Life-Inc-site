import { useState } from "react";
import { Send, Check } from "lucide-react";

export function Contact() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", assunto: "", mensagem: "" });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
    setTimeout(() => { setSent(false); setForm({ nome: "", email: "", assunto: "", mensagem: "" }); }, 2500);
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
              estamos prontos para responder.
            </p>
            <div className="mt-6 space-y-2 text-sm text-muted-foreground">
              <div><span className="text-foreground">Email:</span> contato@furryslife.inc</div>
              <div><span className="text-foreground">Imprensa:</span> press@furryslife.inc</div>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input required placeholder="Nome" className={field}
                value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              <input required type="email" placeholder="E-mail" className={field}
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <input required placeholder="Assunto" className={field}
              value={form.assunto} onChange={(e) => setForm({ ...form, assunto: e.target.value })} />
            <textarea required rows={5} placeholder="Mensagem" className={field}
              value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} />
            <button type="submit"
              className="glass-button inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-70"
              disabled={sent}>
              {sent ? (<><Check className="h-4 w-4" /> Mensagem enviada</>) : (<><Send className="h-4 w-4" /> Enviar mensagem</>)}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
