import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Eye, Send, Plus, Trash2, Copy, GripVertical, ChevronUp, ChevronDown, Loader2, Check, Link2, Download, History, X, GitBranch, Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { FormRenderer } from "@/components/workspace/FormRenderer";
import { FIELD_TYPES, THEMES, hasOptions, newField, themeColor, toCSV, uid, type Answers, type Field, type FieldType, type FormRow } from "@/lib/workspace/forms";

export const Route = createFileRoute("/workspace/forms/$id")({
  head: () => ({
    meta: [
      { title: "Editar formulário — Life Forms" },
      { name: "description", content: "Editor de formulários do Life Forms." },
      { property: "og:title", content: "Editar formulário — Life Forms" },
      { property: "og:description", content: "Editor de formulários do Life Forms." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Editor,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
type Tab = "questions" | "responses" | "settings";
type Resp = { id: string; created_at: string; answers: Answers; respondent_id: string | null };

function Editor() {
  const { id } = Route.useParams();
  const auth = useAuth();
  const [form, setForm] = useState<FormRow | null>(null);
  const [role, setRole] = useState<"owner" | "edit" | "view">("view");
  const [tab, setTab] = useState<Tab>("questions");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [active, setActive] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [modal, setModal] = useState<null | "share" | "versions">(null);
  const dirty = useRef(false);
  const canEdit = role !== "view";

  useEffect(() => {
    (async () => {
      const { data, error } = await db.from("forms").select("*").eq("id", id).maybeSingle();
      if (error || !data) { toast.error("Formulário não encontrado"); return; }
      setForm(data);
      if (data.owner_id === (auth.user?.id ?? "")) setRole("owner");
      else { const { data: c } = await db.from("form_collaborators").select("permission").eq("form_id", id).eq("user_id", (auth.user?.id ?? "")).maybeSingle(); setRole(c?.permission ?? "view"); }
    })();
  }, [id, auth.user]);

  // salvamento automático
  useEffect(() => {
    if (!form || !dirty.current || !canEdit) return;
    setSaving("saving");
    const t = setTimeout(async () => {
      const { error } = await db.from("forms").update({ title: form.title, description: form.description, fields: form.fields, settings: form.settings, visibility: form.visibility }).eq("id", form.id);
      dirty.current = false;
      if (error) { toast.error(error.message); setSaving("idle"); } else setSaving("saved");
    }, 700);
    return () => clearTimeout(t);
  }, [form, canEdit]);

  const patch = useCallback((p: Partial<FormRow>) => { dirty.current = true; setForm((f) => (f ? { ...f, ...p } : f)); }, []);
  const setFields = (fn: (f: Field[]) => Field[]) => form && patch({ fields: fn(form.fields) });
  const upd = (fid: string, p: Partial<Field>) => setFields((fs) => fs.map((f) => (f.id === fid ? { ...f, ...p } : f)));

  const publish = async (status: FormRow["status"]) => {
    if (!form) return;
    const { error } = await db.from("forms").update({ status, title: form.title, description: form.description, fields: form.fields, settings: form.settings }).eq("id", form.id);
    if (error) return toast.error(error.message);
    if (status === "published") await db.from("form_versions").insert({ form_id: form.id, title: form.title, description: form.description, fields: form.fields, settings: form.settings, created_by: (auth.user?.id ?? ""), label: "Publicado" });
    setForm({ ...form, status });
    toast.success(status === "published" ? "Formulário publicado" : status === "closed" ? "Respostas encerradas" : "Voltou para rascunho");
  };
  const link = form ? `${typeof location !== "undefined" ? location.origin : ""}/f/${form.id}` : "";

  if (!form) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  const accent = themeColor(form.settings.theme);

  return (
    <div className="min-h-screen" style={{ background: `color-mix(in oklab, ${accent} 7%, var(--background))` }}>
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-2.5 md:px-6">
          <Link to="/workspace/forms" className="rounded-full p-2 text-muted-foreground hover:bg-secondary" aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="min-w-0 flex-1">
            <input value={form.title} disabled={!canEdit} onChange={(e) => patch({ title: e.target.value })} className="w-full truncate bg-transparent font-display text-base font-semibold outline-none" />
            <div className="text-[11px] text-muted-foreground">
              Life Forms · {form.status === "published" ? "Publicado" : form.status === "closed" ? "Encerrado" : "Rascunho"} · {!canEdit ? "Somente leitura" : saving === "saving" ? "Salvando…" : saving === "saved" ? "Todas as alterações salvas" : "Salvamento automático"}
            </div>
          </div>
          <button onClick={() => setModal("versions")} className="hidden rounded-full p-2 text-muted-foreground hover:bg-secondary sm:block" title="Histórico de versões"><History className="h-5 w-5" /></button>
          <button onClick={() => setPreview(true)} className="rounded-full p-2 text-muted-foreground hover:bg-secondary" title="Pré-visualizar"><Eye className="h-5 w-5" /></button>
          {role === "owner" && <button onClick={() => setModal("share")} className="hidden rounded-full p-2 text-muted-foreground hover:bg-secondary sm:block" title="Colaboradores"><Users className="h-5 w-5" /></button>}
          {canEdit && (form.status === "published"
            ? <button onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado"); }} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white" style={{ background: accent }}><Link2 className="h-4 w-4" />Copiar link</button>
            : <button onClick={() => publish("published")} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white" style={{ background: accent }}><Send className="h-4 w-4" />Publicar</button>)}
        </div>
        <nav className="flex justify-center gap-1">
          {([["questions", "Perguntas"], ["responses", "Respostas"], ["settings", "Configurações"]] as [Tab, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${tab === k ? "" : "border-transparent text-muted-foreground hover:text-foreground"}`} style={tab === k ? { borderColor: accent, color: accent } : undefined}>{l}</button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {tab === "questions" && (
          <div className="space-y-3">
            <div className="rounded-3xl border border-border bg-card p-6" style={{ borderTop: `8px solid ${accent}` }}>
              <input value={form.title} disabled={!canEdit} onChange={(e) => patch({ title: e.target.value })} className="w-full bg-transparent font-display text-3xl font-bold outline-none" />
              <textarea value={form.description} disabled={!canEdit} onChange={(e) => patch({ description: e.target.value })} placeholder="Descrição do formulário" rows={2} className="mt-2 w-full resize-none bg-transparent text-sm text-muted-foreground outline-none" />
            </div>
            {form.fields.map((f, i) => (
              <FieldCard key={f.id} f={f} i={i} all={form.fields} active={active === f.id} accent={accent} canEdit={canEdit}
                onFocus={() => setActive(f.id)} onChange={(p) => upd(f.id, p)}
                onDelete={() => setFields((fs) => fs.filter((x) => x.id !== f.id))}
                onDuplicate={() => setFields((fs) => { const c = [...fs]; c.splice(i + 1, 0, { ...f, id: uid(), label: f.label + " (cópia)" }); return c; })}
                onMove={(d) => setFields((fs) => { const c = [...fs]; const j = i + d; if (j < 0 || j >= c.length) return c; [c[i], c[j]] = [c[j], c[i]]; return c; })} />
            ))}
            {canEdit && (
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <button onClick={() => { const n = newField(); setFields((fs) => [...fs, n]); setActive(n.id); }} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-secondary"><Plus className="h-4 w-4" />Adicionar pergunta</button>
                <button onClick={() => { const n = newField("section"); setFields((fs) => [...fs, n]); setActive(n.id); }} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm shadow-sm hover:bg-secondary">Adicionar seção</button>
              </div>
            )}
          </div>
        )}
        {tab === "responses" && <Responses form={form} accent={accent} canDelete={canEdit} onToggle={(v) => patch({ settings: { ...form.settings, accepting: v } })} />}
        {tab === "settings" && <SettingsTab form={form} canEdit={canEdit} patch={patch} publish={publish} link={link} />}
      </main>

      {preview && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background px-4 py-8">
          <button onClick={() => setPreview(false)} className="fixed right-5 top-5 z-10 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm shadow"><X className="h-4 w-4" />Fechar pré-visualização</button>
          <div className="mx-auto max-w-2xl"><FormRenderer title={form.title} description={form.description} fields={form.fields} settings={form.settings} onSubmit={async () => { toast.info("Pré-visualização: a resposta não foi salva"); }} /></div>
        </div>
      )}
      {modal === "share" && <ShareModal formId={form.id} onClose={() => setModal(null)} />}
      {modal === "versions" && <VersionsModal form={form} canEdit={canEdit} onClose={() => setModal(null)} onRestore={(v) => { patch(v); setModal(null); toast.success("Versão restaurada"); }} />}
    </div>
  );
}

function FieldCard({ f, i, all, active, accent, canEdit, onFocus, onChange, onDelete, onDuplicate, onMove }: {
  f: Field; i: number; all: Field[]; active: boolean; accent: string; canEdit: boolean; onFocus: () => void;
  onChange: (p: Partial<Field>) => void; onDelete: () => void; onDuplicate: () => void; onMove: (d: number) => void;
}) {
  const [logic, setLogic] = useState(!!f.showIf);
  const sources = all.slice(0, i).filter((x) => hasOptions(x.type));
  const src = sources.find((s) => s.id === f.showIf?.fieldId);
  return (
    <div onClick={onFocus} className={`relative rounded-3xl border bg-card p-6 transition-all ${active ? "shadow-lg" : "border-border"}`} style={active ? { borderColor: accent, borderLeft: `5px solid ${accent}` } : undefined}>
      <GripVertical className="absolute left-1/2 top-1.5 h-4 w-4 -translate-x-1/2 rotate-90 text-muted-foreground/40" />
      <div className="flex flex-col gap-3 sm:flex-row">
        <input value={f.label} disabled={!canEdit} onChange={(e) => onChange({ label: e.target.value })}
          className={`flex-1 rounded-xl bg-secondary/50 px-4 py-3 outline-none focus:bg-secondary ${f.type === "section" ? "font-display text-lg font-bold" : "text-[15px] font-medium"}`} />
        {active && canEdit && (
          <select value={f.type} onChange={(e) => { const t = e.target.value as FieldType; onChange({ type: t, options: hasOptions(t) ? f.options ?? ["Opção 1"] : undefined, max: t === "scale" ? f.max ?? 5 : undefined }); }}
            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm sm:w-52">
            {FIELD_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
          </select>
        )}
      </div>
      {(active || f.help) && <input value={f.help ?? ""} disabled={!canEdit} onChange={(e) => onChange({ help: e.target.value })} placeholder="Descrição (opcional)" className="mt-2 w-full bg-transparent px-1 text-xs text-muted-foreground outline-none" />}

      <div className="mt-4 text-sm text-muted-foreground">
        {hasOptions(f.type) && (
          <div className="space-y-1.5">
            {f.options?.map((o, k) => (
              <div key={k} className="flex items-center gap-3">
                <span className={`h-4 w-4 shrink-0 border border-muted-foreground/50 ${f.type === "checkbox" ? "rounded" : f.type === "choice" ? "rounded-full" : "rounded-sm text-[10px]"}`}>{f.type === "dropdown" ? k + 1 : ""}</span>
                <input value={o} disabled={!canEdit} onChange={(e) => onChange({ options: f.options!.map((x, j) => (j === k ? e.target.value : x)) })} className="flex-1 border-b border-transparent bg-transparent py-1 text-foreground outline-none hover:border-border focus:border-primary" />
                {canEdit && f.options!.length > 1 && <button onClick={() => onChange({ options: f.options!.filter((_, j) => j !== k) })} aria-label="Remover opção"><X className="h-4 w-4" /></button>}
              </div>
            ))}
            {canEdit && <button onClick={() => onChange({ options: [...(f.options ?? []), `Opção ${(f.options?.length ?? 0) + 1}`] })} className="mt-1 text-sm" style={{ color: accent }}>+ Adicionar opção</button>}
          </div>
        )}
        {f.type === "scale" && <div className="flex items-center gap-3">De 1 até <select disabled={!canEdit} value={f.max ?? 5} onChange={(e) => onChange({ max: +e.target.value })} className="rounded-lg border border-border bg-background px-2 py-1">{[3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n}>{n}</option>)}</select></div>}
        {["short", "email", "number", "date"].includes(f.type) && <div className="w-1/2 border-b border-dashed border-border pb-1.5">{FIELD_TYPES.find((t) => t.type === f.type)?.label}</div>}
        {f.type === "long" && <div className="w-3/4 border-b border-dashed border-border pb-1.5">Texto de resposta longa</div>}
      </div>

      {active && canEdit && logic && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-secondary/60 p-3 text-xs">
          <GitBranch className="h-4 w-4" /> Mostrar somente se
          <select value={f.showIf?.fieldId ?? ""} onChange={(e) => { const s = sources.find((x) => x.id === e.target.value); onChange({ showIf: s ? { fieldId: s.id, equals: s.options?.[0] ?? "" } : null }); }} className="max-w-[12rem] rounded-lg border border-border bg-background px-2 py-1">
            <option value="">— escolha uma pergunta —</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          {src && <>igual a <select value={f.showIf?.equals} onChange={(e) => onChange({ showIf: { fieldId: src.id, equals: e.target.value } })} className="rounded-lg border border-border bg-background px-2 py-1">{src.options?.map((o) => <option key={o}>{o}</option>)}</select></>}
          {!sources.length && <span className="text-muted-foreground">Adicione antes uma pergunta de escolha.</span>}
        </div>
      )}
      {!active && f.showIf && <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground"><GitBranch className="h-3 w-3" />Condicional</div>}

      {active && canEdit && (
        <div className="mt-5 flex flex-wrap items-center justify-end gap-1 border-t border-border pt-3 text-muted-foreground">
          <button onClick={() => onMove(-1)} className="rounded-lg p-2 hover:bg-secondary" title="Subir"><ChevronUp className="h-4 w-4" /></button>
          <button onClick={() => onMove(1)} className="rounded-lg p-2 hover:bg-secondary" title="Descer"><ChevronDown className="h-4 w-4" /></button>
          <button onClick={() => { setLogic(!logic); if (logic) onChange({ showIf: null }); }} className="rounded-lg p-2 hover:bg-secondary" title="Regra condicional" style={logic ? { color: accent } : undefined}><GitBranch className="h-4 w-4" /></button>
          <button onClick={onDuplicate} className="rounded-lg p-2 hover:bg-secondary" title="Duplicar"><Copy className="h-4 w-4" /></button>
          <button onClick={onDelete} className="rounded-lg p-2 hover:bg-secondary hover:text-destructive" title="Excluir"><Trash2 className="h-4 w-4" /></button>
          {f.type !== "section" && <label className="ml-2 flex items-center gap-2 border-l border-border pl-3 text-sm">Obrigatória
            <input type="checkbox" checked={!!f.required} onChange={(e) => onChange({ required: e.target.checked })} className="h-4 w-4" style={{ accentColor: accent }} /></label>}
        </div>
      )}
    </div>
  );
}

function Responses({ form, accent, canDelete, onToggle }: { form: FormRow; accent: string; canDelete: boolean; onToggle: (v: boolean) => void }) {
  const [rows, setRows] = useState<Resp[] | null>(null);
  const [view, setView] = useState<"summary" | "individual">("summary");
  const [idx, setIdx] = useState(0);
  const load = useCallback(async () => {
    const { data } = await db.from("form_responses").select("*").eq("form_id", form.id).order("created_at", { ascending: false });
    setRows(data ?? []);
  }, [form.id]);
  useEffect(() => { load(); }, [load]);
  const qs = form.fields.filter((f) => f.type !== "section");

  const stats = useMemo(() => qs.map((q) => {
    const vals = (rows ?? []).map((r) => r.answers[q.id]).filter((v) => v !== undefined && v !== "");
    const counts: Record<string, number> = {};
    vals.flat().forEach((v) => (counts[String(v)] = (counts[String(v)] ?? 0) + 1));
    return { q, vals, counts };
  }), [rows, qs]);

  const exportCSV = () => {
    const blob = new Blob([toCSV(form.fields, rows ?? [])], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${form.title || "respostas"}.csv`; a.click();
  };
  if (!rows) return <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />;
  const cur = rows[idx];
  return (
    <div className="space-y-3">
      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-2xl font-bold">{rows.length} resposta(s)</h2>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={exportCSV} disabled={!rows.length} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"><Download className="h-4 w-4" />Exportar CSV</button>
          </div>
        </div>
        {canDelete && <label className="mt-4 flex items-center justify-end gap-2 text-sm">Aceitando respostas
          <input type="checkbox" checked={form.settings.accepting !== false} onChange={(e) => onToggle(e.target.checked)} className="h-4 w-4" style={{ accentColor: accent }} /></label>}
        <div className="mt-4 flex gap-1">
          {(["summary", "individual"] as const).map((v) => <button key={v} onClick={() => setView(v)} className="rounded-full px-4 py-1.5 text-sm" style={view === v ? { background: accent, color: "white" } : undefined}>{v === "summary" ? "Resumo" : "Individual"}</button>)}
        </div>
      </div>
      {!rows.length ? <div className="rounded-3xl border border-dashed border-border bg-card py-14 text-center text-sm text-muted-foreground">Ainda não há respostas. Publique e compartilhe o link.</div>
        : view === "summary" ? stats.map(({ q, vals, counts }) => {
          const opts = hasOptions(q.type) ? q.options ?? [] : q.type === "scale" ? Array.from({ length: q.max ?? 5 }, (_, i) => String(i + 1)) : null;
          const max = Math.max(1, ...Object.values(counts));
          const avg = q.type === "scale" || q.type === "number" ? vals.reduce((s, v) => s + Number(v), 0) / (vals.length || 1) : null;
          return (
            <div key={q.id} className="rounded-3xl border border-border bg-card p-6">
              <div className="font-medium">{q.label}</div><div className="text-xs text-muted-foreground">{vals.length} resposta(s){avg !== null && vals.length ? ` · média ${avg.toFixed(1)}` : ""}</div>
              {opts ? (
                <div className="mt-4 space-y-2">{opts.map((o) => { const c = counts[o] ?? 0; return (
                  <div key={o} className="flex items-center gap-3 text-sm"><span className="w-32 shrink-0 truncate">{o}</span>
                    <div className="h-6 flex-1 overflow-hidden rounded-lg bg-secondary"><div className="h-full rounded-lg transition-all duration-700" style={{ width: `${(c / max) * 100}%`, background: accent }} /></div>
                    <span className="w-16 text-right text-xs text-muted-foreground">{c} ({Math.round((c / (rows.length || 1)) * 100)}%)</span></div>
                ); })}</div>
              ) : (
                <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto">{vals.slice(0, 50).map((v, k) => <div key={k} className="rounded-xl bg-secondary/60 px-3 py-2 text-sm">{String(v)}</div>)}</div>
              )}
            </div>
          );
        }) : cur && (
          <div className="rounded-3xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2 text-sm">
              <button disabled={idx === 0} onClick={() => setIdx(idx - 1)} className="rounded-lg p-1.5 hover:bg-secondary disabled:opacity-40"><ChevronUp className="h-4 w-4 -rotate-90" /></button>
              {idx + 1} de {rows.length}
              <button disabled={idx >= rows.length - 1} onClick={() => setIdx(idx + 1)} className="rounded-lg p-1.5 hover:bg-secondary disabled:opacity-40"><ChevronDown className="h-4 w-4 -rotate-90" /></button>
              <span className="ml-2 text-xs text-muted-foreground">{new Date(cur.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
              {canDelete && <button onClick={async () => { if (!confirm("Excluir esta resposta?")) return; await db.from("form_responses").delete().eq("id", cur.id); setIdx(0); load(); }} className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
            </div>
            <dl className="space-y-4">{qs.map((q) => { const v = cur.answers[q.id]; return (
              <div key={q.id}><dt className="text-xs text-muted-foreground">{q.label}</dt><dd className="mt-0.5 text-sm">{Array.isArray(v) ? v.join(", ") : v || "—"}</dd></div>
            ); })}</dl>
          </div>
        )}
    </div>
  );
}

function SettingsTab({ form, canEdit, patch, publish, link }: { form: FormRow; canEdit: boolean; patch: (p: Partial<FormRow>) => void; publish: (s: FormRow["status"]) => void; link: string }) {
  const s = form.settings;
  const set = (p: Partial<typeof s>) => patch({ settings: { ...s, ...p } });
  const row = "rounded-3xl border border-border bg-card p-6";
  return (
    <div className="space-y-3">
      <div className={row}>
        <div className="font-semibold">Tema</div>
        <div className="mt-3 flex flex-wrap gap-2">{THEMES.map((t) => (
          <button key={t.key} disabled={!canEdit} onClick={() => set({ theme: t.key })} title={t.label} className="flex h-10 w-10 items-center justify-center rounded-full ring-offset-2 transition hover:scale-110" style={{ background: t.color, boxShadow: s.theme === t.key || (!s.theme && t.key === "indigo") ? `0 0 0 3px var(--background), 0 0 0 5px ${t.color}` : undefined }}>
            {(s.theme ?? "indigo") === t.key && <Check className="h-4 w-4 text-white" />}
          </button>
        ))}</div>
      </div>
      <div className={row}>
        <div className="font-semibold">Acesso</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {([["public", "Link público", "Qualquer pessoa com o link pode responder"], ["private", "Privado", "Somente quem entrar com Furry ID"]] as const).map(([k, l, d]) => (
            <button key={k} disabled={!canEdit} onClick={() => patch({ visibility: k })} className={`rounded-2xl border p-4 text-left text-sm transition ${form.visibility === k ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/60"}`}>
              <div className="font-medium">{l}</div><div className="text-xs text-muted-foreground">{d}</div></button>
          ))}
        </div>
        <label className="mt-4 flex items-center justify-between text-sm">Limitar a 1 resposta por dispositivo
          <input type="checkbox" disabled={!canEdit} checked={!!s.oneResponse} onChange={(e) => set({ oneResponse: e.target.checked })} className="h-4 w-4" /></label>
      </div>
      <div className={row}>
        <div className="font-semibold">Mensagem de confirmação</div>
        <textarea disabled={!canEdit} value={s.confirmation ?? ""} onChange={(e) => set({ confirmation: e.target.value })} placeholder="Sua resposta foi registrada. Obrigado!" rows={2} className="mt-3 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none" />
      </div>
      <div className={row}>
        <div className="font-semibold">Publicação</div>
        {form.status !== "draft" && <div className="mt-3 flex gap-2"><input readOnly value={link} className="flex-1 rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm" />
          <button onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado"); }} className="rounded-xl border border-border px-3 text-sm hover:bg-secondary">Copiar</button></div>}
        {canEdit && <div className="mt-4 flex flex-wrap gap-2">
          {form.status !== "published" && <button onClick={() => publish("published")} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Publicar</button>}
          {form.status === "published" && <button onClick={() => publish("closed")} className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-secondary">Encerrar respostas</button>}
          {form.status !== "draft" && <button onClick={() => publish("draft")} className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-secondary">Voltar para rascunho</button>}
        </div>}
      </div>
      <div className={`${row} text-sm text-muted-foreground`}>
        <div className="font-semibold text-foreground">Integrações</div>
        <p className="mt-1">Exportação para Life Sheets, anexos no Life Drive e análise com Life AI chegam junto com essas ferramentas. Por enquanto, use “Exportar CSV” em Respostas.</p>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="animate-spring-in w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-lg font-bold">{title}</h2><button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary"><X className="h-4 w-4" /></button></div>
        {children}
      </div>
    </div>
  );
}

function ShareModal({ formId, onClose }: { formId: string; onClose: () => void }) {
  const [list, setList] = useState<{ id: string; email: string; permission: string }[]>([]);
  const [email, setEmail] = useState(""); const [perm, setPerm] = useState("edit");
  const load = useCallback(async () => { const { data } = await db.from("form_collaborators").select("id,email,permission").eq("form_id", formId); setList(data ?? []); }, [formId]);
  useEffect(() => { load(); }, [load]);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: u } = await db.rpc("drive_find_user", { _email: email });
    if (!u) return toast.error("Nenhuma conta Furry ID com esse e-mail");
    const { error } = await db.from("form_collaborators").insert({ form_id: formId, user_id: u, email: email.trim().toLowerCase(), permission: perm });
    if (error) return toast.error(error.message.includes("duplicate") ? "Essa pessoa já colabora" : error.message);
    setEmail(""); load(); toast.success("Colaborador adicionado");
  };
  return (
    <Modal title="Colaboradores" onClose={onClose}>
      <form onSubmit={add} className="flex gap-2">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail do Furry ID" className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none" />
        <select value={perm} onChange={(e) => setPerm(e.target.value)} className="rounded-xl border border-border bg-background px-2 text-sm"><option value="edit">Editar</option><option value="view">Ver</option></select>
        <button className="rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground">Adicionar</button>
      </form>
      <div className="mt-4 space-y-1">
        {list.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-xl px-3 py-2 text-sm hover:bg-secondary/60">
            <span className="truncate">{c.email}</span>
            <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{c.permission === "edit" ? "Editor" : "Leitor"}</span>
              <button onClick={async () => { await db.from("form_collaborators").delete().eq("id", c.id); load(); }} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button></div>
          </div>
        ))}
        {!list.length && <p className="py-3 text-center text-xs text-muted-foreground">Só você tem acesso a este formulário.</p>}
      </div>
    </Modal>
  );
}

function VersionsModal({ form, canEdit, onClose, onRestore }: { form: FormRow; canEdit: boolean; onClose: () => void; onRestore: (v: Partial<FormRow>) => void }) {
  const auth = useAuth();
  const [list, setList] = useState<{ id: string; label: string | null; created_at: string; title: string; description: string; fields: Field[]; settings: FormRow["settings"] }[] | null>(null);
  const load = useCallback(async () => { const { data } = await db.from("form_versions").select("*").eq("form_id", form.id).order("created_at", { ascending: false }); setList(data ?? []); }, [form.id]);
  useEffect(() => { load(); }, [load]);
  const snapshot = async () => {
    const { error } = await db.from("form_versions").insert({ form_id: form.id, title: form.title, description: form.description, fields: form.fields, settings: form.settings, created_by: (auth.user?.id ?? ""), label: "Salvo manualmente" });
    if (error) toast.error(error.message); else { toast.success("Versão salva"); load(); }
  };
  return (
    <Modal title="Histórico de versões" onClose={onClose}>
      {canEdit && <button onClick={snapshot} className="mb-3 w-full rounded-xl border border-border py-2.5 text-sm hover:bg-secondary">Salvar versão atual</button>}
      <div className="max-h-80 space-y-1 overflow-y-auto">
        {!list ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : !list.length ? <p className="py-4 text-center text-xs text-muted-foreground">Versões são criadas ao publicar ou salvar manualmente.</p>
          : list.map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm hover:bg-secondary/60">
              <div><div className="font-medium">{new Date(v.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}</div><div className="text-xs text-muted-foreground">{v.label} · {v.fields.length} pergunta(s)</div></div>
              {canEdit && <button onClick={() => onRestore({ title: v.title, description: v.description, fields: v.fields, settings: v.settings })} className="rounded-lg px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10">Restaurar</button>}
            </div>
          ))}
      </div>
    </Modal>
  );
}
