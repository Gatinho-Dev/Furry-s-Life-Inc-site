import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { isVisible, themeColor, type Answers, type Field, type FormSettings } from "@/lib/workspace/forms";

/** Renderiza um formulário do Life Forms (usado na pré-visualização e na página pública). */
export function FormRenderer({ title, description, fields, settings, onSubmit }: {
  title: string; description: string; fields: Field[]; settings: FormSettings;
  onSubmit?: (a: Answers) => Promise<void>;
}) {
  const [a, setA] = useState<Answers>({});
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const accent = themeColor(settings.theme);
  const visible = fields.filter((f) => isVisible(f, a));
  const set = (id: string, v: string | string[]) => setA((p) => ({ ...p, [id]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    for (const f of visible) {
      const v = a[f.id];
      const empty = v === undefined || v === "" || (Array.isArray(v) && !v.length);
      if (f.required && empty) errs[f.id] = "Esta pergunta é obrigatória";
      else if (f.type === "email" && v && !/^\S+@\S+\.\S+$/.test(String(v))) errs[f.id] = "E-mail inválido";
    }
    setErr(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const clean: Answers = {}; visible.forEach((f) => { if (a[f.id] !== undefined) clean[f.id] = a[f.id]; });
      await onSubmit?.(clean); setDone(true);
    } catch (e) { setErr({ _: (e as Error).message }); }
    setBusy(false);
  };

  const card = "rounded-3xl border border-border bg-card p-6 shadow-sm";
  if (done) return (
    <div className={`${card} animate-spring-in text-center`} style={{ borderTop: `8px solid ${accent}` }}>
      <CheckCircle2 className="mx-auto h-12 w-12" style={{ color: accent }} />
      <h2 className="mt-3 font-display text-xl font-bold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{settings.confirmation || "Sua resposta foi registrada. Obrigado!"}</p>
    </div>
  );

  const input = "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-4";
  return (
    <form onSubmit={submit} className="space-y-3" style={{ ["--accent" as string]: accent }}>
      <div className={card} style={{ borderTop: `8px solid ${accent}` }}>
        <h1 className="font-display text-2xl font-bold md:text-3xl">{title || "Formulário sem título"}</h1>
        {description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{description}</p>}
        {fields.some((f) => f.required) && <p className="mt-3 text-xs text-destructive">* Indica uma pergunta obrigatória</p>}
      </div>
      {visible.map((f) => f.type === "section" ? (
        <div key={f.id} className="rounded-3xl px-6 pb-1 pt-4"><h2 className="font-display text-lg font-bold" style={{ color: accent }}>{f.label}</h2>{f.help && <p className="text-sm text-muted-foreground">{f.help}</p>}</div>
      ) : (
        <div key={f.id} className={`${card} animate-fade-up ${err[f.id] ? "border-destructive/60" : ""}`}>
          <label className="block text-[15px] font-medium">{f.label}{f.required && <span className="text-destructive"> *</span>}</label>
          {f.help && <p className="mt-1 text-xs text-muted-foreground">{f.help}</p>}
          <div className="mt-4">
            {f.type === "short" && <input className={input} value={(a[f.id] as string) ?? ""} onChange={(e) => set(f.id, e.target.value)} placeholder="Sua resposta" />}
            {f.type === "email" && <input type="email" className={input} value={(a[f.id] as string) ?? ""} onChange={(e) => set(f.id, e.target.value)} placeholder="nome@exemplo.com" />}
            {f.type === "number" && <input type="number" className={input} value={(a[f.id] as string) ?? ""} onChange={(e) => set(f.id, e.target.value)} />}
            {f.type === "date" && <input type="date" className={input} value={(a[f.id] as string) ?? ""} onChange={(e) => set(f.id, e.target.value)} />}
            {f.type === "long" && <textarea rows={4} className={input} value={(a[f.id] as string) ?? ""} onChange={(e) => set(f.id, e.target.value)} placeholder="Sua resposta" />}
            {f.type === "dropdown" && (
              <select className={input} value={(a[f.id] as string) ?? ""} onChange={(e) => set(f.id, e.target.value)}>
                <option value="">Escolher</option>{f.options?.map((o) => <option key={o}>{o}</option>)}
              </select>
            )}
            {(f.type === "choice" || f.type === "checkbox") && (
              <div className="space-y-2">{f.options?.map((o) => {
                const cur = a[f.id]; const on = f.type === "choice" ? cur === o : Array.isArray(cur) && cur.includes(o);
                return (
                  <label key={o} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-sm hover:bg-secondary/60">
                    <input type={f.type === "choice" ? "radio" : "checkbox"} name={f.id} checked={on} style={{ accentColor: accent }} className="h-4 w-4"
                      onChange={() => f.type === "choice" ? set(f.id, o) : set(f.id, on ? (cur as string[]).filter((x) => x !== o) : [...((cur as string[]) ?? []), o])} />
                    {o}
                  </label>
                );
              })}</div>
            )}
            {f.type === "scale" && (
              <div className="flex flex-wrap gap-2">{Array.from({ length: f.max ?? 5 }, (_, i) => String(i + 1)).map((n) => (
                <button type="button" key={n} onClick={() => set(f.id, n)}
                  className="h-11 w-11 rounded-full border border-border text-sm font-semibold transition"
                  style={a[f.id] === n ? { background: accent, color: "white", borderColor: accent } : undefined}>{n}</button>
              ))}</div>
            )}
          </div>
          {err[f.id] && <p className="mt-2 text-xs text-destructive">{err[f.id]}</p>}
        </div>
      ))}
      {err._ && <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{err._}</div>}
      <div className="flex justify-between pt-2">
        <button disabled={busy || !onSubmit} className="rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-60" style={{ background: accent }}>
          {busy ? "Enviando…" : "Enviar"}
        </button>
        <button type="button" onClick={() => { setA({}); setErr({}); }} className="text-sm text-muted-foreground hover:text-foreground">Limpar formulário</button>
      </div>
    </form>
  );
}
