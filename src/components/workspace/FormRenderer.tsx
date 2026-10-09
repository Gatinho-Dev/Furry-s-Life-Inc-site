import { useMemo, useState } from "react";
import { CheckCircle2, Star } from "lucide-react";
import { FONTS, RADIUS, isVisible, themeColor, type Answers, type Field, type FormSettings } from "@/lib/workspace/forms";

/** Renderiza um formulário do Life Forms (usado na pré-visualização e na página pública). */
export function FormRenderer({ title, description, fields, settings, onSubmit }: {
  title: string; description: string; fields: Field[]; settings: FormSettings;
  onSubmit?: (a: Answers) => Promise<void>;
}) {
  const [a, setA] = useState<Answers>({});
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const accent = themeColor(settings.theme, settings.accentHex);
  const radius = RADIUS[settings.radius ?? "round"];
  const font = FONTS[settings.font ?? "sans"];
  const shuffled = useMemo(() => Object.fromEntries(fields.filter((f) => f.shuffle && f.options).map((f) => [f.id, [...f.options!].sort(() => Math.random() - 0.5)])), [fields]);
  const opts = (f: Field) => shuffled[f.id] ?? f.options;
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
      else if (f.type === "url" && v && !/^https?:\/\/\S+\.\S+/.test(String(v))) errs[f.id] = "Link inválido (comece com https://)";
      else if (f.type === "phone" && v && String(v).replace(/\D/g, "").length < 8) errs[f.id] = "Telefone inválido";
      else if (typeof v === "string" && v && f.minLength && v.length < f.minLength) errs[f.id] = `Mínimo de ${f.minLength} caracteres`;
      else if (typeof v === "string" && v && f.maxLength && v.length > f.maxLength) errs[f.id] = `Máximo de ${f.maxLength} caracteres`;
    }
    setErr(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const clean: Answers = {}; visible.forEach((f) => { if (a[f.id] !== undefined) clean[f.id] = a[f.id]; });
      await onSubmit?.(clean); setDone(true);
      if (settings.redirectUrl && /^https?:\/\//.test(settings.redirectUrl)) setTimeout(() => { window.location.href = settings.redirectUrl!; }, 1500);
    } catch (e) { setErr({ _: (e as Error).message }); }
    setBusy(false);
  };

  const card = "border border-border bg-card p-6 shadow-sm";
  const cs = { borderRadius: radius } as const;
  const answered = visible.filter((f) => f.type !== "section" && a[f.id] !== undefined && a[f.id] !== "" && !(Array.isArray(a[f.id]) && !a[f.id].length)).length;
  const total = visible.filter((f) => f.type !== "section").length;
  if (done) return (
    <div className={`${card} animate-spring-in text-center`} style={{ ...cs, borderTop: `8px solid ${accent}`, fontFamily: font }}>
      <CheckCircle2 className="mx-auto h-12 w-12" style={{ color: accent }} />
      <h2 className="mt-3 font-display text-xl font-bold">{title}</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{settings.confirmation || "Sua resposta foi registrada. Obrigado!"}</p>
      {settings.allowAnother && <button onClick={() => { setA({}); setDone(false); }} className="mt-4 text-sm font-medium underline" style={{ color: accent }}>Enviar outra resposta</button>}
    </div>
  );

  const input = "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-4";
  return (
    <form onSubmit={submit} className="space-y-3" style={{ ["--accent" as string]: accent, fontFamily: font }}>
      {settings.showProgress && total > 0 && <div className="sticky top-2 z-10 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full transition-all" style={{ width: `${(answered / total) * 100}%`, background: accent }} /></div>}
      {settings.coverUrl && <img src={settings.coverUrl} alt="" className="h-44 w-full object-cover" style={cs} />}
      <div className={card} style={{ ...cs, borderTop: `8px solid ${accent}` }}>
        {settings.logoUrl && <img src={settings.logoUrl} alt="" className="mb-4 h-12 w-auto object-contain" />}
        <h1 className="font-display text-2xl font-bold md:text-3xl">{title || "Formulário sem título"}</h1>
        {description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{description}</p>}
        {fields.some((f) => f.required) && <p className="mt-3 text-xs text-destructive">* Indica uma pergunta obrigatória</p>}
      </div>
      {visible.map((f) => f.type === "section" ? (
        <div key={f.id} className="px-6 pb-1 pt-4"><h2 className="font-display text-lg font-bold" style={{ color: accent }}>{f.label}</h2>{f.help && <p className="text-sm text-muted-foreground">{f.help}</p>}</div>
      ) : (
        <div key={f.id} style={cs} className={`${card} animate-fade-up ${err[f.id] ? "border-destructive/60" : ""}`}>
          <label className="block text-[15px] font-medium">{f.label}{f.required && <span className="text-destructive"> *</span>}</label>
          {f.help && <p className="mt-1 text-xs text-muted-foreground">{f.help}</p>}
          <div className="mt-4">
            {f.type === "short" && <input className={input} value={(a[f.id] as string) ?? ""} onChange={(e) => set(f.id, e.target.value)} placeholder={f.placeholder || "Sua resposta"} maxLength={f.maxLength} />}
            {f.type === "phone" && <input type="tel" className={input} value={(a[f.id] as string) ?? ""} onChange={(e) => set(f.id, e.target.value)} placeholder={f.placeholder || "(11) 90000-0000"} />}
            {f.type === "url" && <input type="url" className={input} value={(a[f.id] as string) ?? ""} onChange={(e) => set(f.id, e.target.value)} placeholder={f.placeholder || "https://"} />}
            {f.type === "time" && <input type="time" className={input} value={(a[f.id] as string) ?? ""} onChange={(e) => set(f.id, e.target.value)} />}
            {f.type === "yesno" && <div className="flex gap-2">{["Sim", "Não"].map((o) => <button type="button" key={o} onClick={() => set(f.id, o)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium transition" style={a[f.id] === o ? { background: accent, color: "white", borderColor: accent } : undefined}>{o}</button>)}</div>}
            {f.type === "rating" && <div className="flex gap-1">{Array.from({ length: f.max ?? 5 }, (_, i) => String(i + 1)).map((n) => <button type="button" key={n} onClick={() => set(f.id, n)} aria-label={`${n} estrelas`}><Star className="h-8 w-8 transition hover:scale-110" style={{ color: accent, fill: Number(a[f.id] ?? 0) >= Number(n) ? accent : "transparent" }} /></button>)}</div>}
            {f.type === "nps" && <div><div className="grid grid-cols-11 gap-1">{Array.from({ length: 11 }, (_, i) => String(i)).map((n) => <button type="button" key={n} onClick={() => set(f.id, n)} className="h-10 rounded-lg border border-border text-sm font-semibold" style={a[f.id] === n ? { background: accent, color: "white", borderColor: accent } : undefined}>{n}</button>)}</div><div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{f.minLabel}</span><span>{f.maxLabel}</span></div></div>}
            {f.type === "email" && <input type="email" className={input} value={(a[f.id] as string) ?? ""} onChange={(e) => set(f.id, e.target.value)} placeholder="nome@exemplo.com" />}
            {f.type === "number" && <input type="number" className={input} value={(a[f.id] as string) ?? ""} onChange={(e) => set(f.id, e.target.value)} />}
            {f.type === "date" && <input type="date" className={input} value={(a[f.id] as string) ?? ""} onChange={(e) => set(f.id, e.target.value)} />}
            {f.type === "long" && <><textarea rows={4} className={input} value={(a[f.id] as string) ?? ""} onChange={(e) => set(f.id, e.target.value)} placeholder={f.placeholder || "Sua resposta"} maxLength={f.maxLength} />{f.maxLength && <div className="mt-1 text-right text-xs text-muted-foreground">{String(a[f.id] ?? "").length}/{f.maxLength}</div>}</>}
            {f.type === "dropdown" && (
              <select className={input} value={(a[f.id] as string) ?? ""} onChange={(e) => set(f.id, e.target.value)}>
                <option value="">Escolher</option>{opts(f)?.map((o) => <option key={o}>{o}</option>)}
              </select>
            )}
            {(f.type === "choice" || f.type === "checkbox") && (
              <div className="space-y-2">{opts(f)?.map((o) => {
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
              <div><div className="flex flex-wrap gap-2">{Array.from({ length: f.max ?? 5 }, (_, i) => String(i + 1)).map((n) => (
                <button type="button" key={n} onClick={() => set(f.id, n)}
                  className="h-11 w-11 rounded-full border border-border text-sm font-semibold transition"
                  style={a[f.id] === n ? { background: accent, color: "white", borderColor: accent } : undefined}>{n}</button>
              ))}</div>{(f.minLabel || f.maxLabel) && <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{f.minLabel}</span><span>{f.maxLabel}</span></div>}</div>
            )}
          </div>
          {err[f.id] && <p className="mt-2 text-xs text-destructive">{err[f.id]}</p>}
        </div>
      ))}
      {err._ && <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{err._}</div>}
      <div className="flex justify-between pt-2">
        <button disabled={busy || !onSubmit} style={{ background: accent, borderRadius: radius }} className="px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-60">
          {busy ? "Enviando…" : settings.submitLabel || "Enviar"}
        </button>
        <button type="button" onClick={() => { setA({}); setErr({}); }} className="text-sm text-muted-foreground hover:text-foreground">Limpar formulário</button>
      </div>
    </form>
  );
}
