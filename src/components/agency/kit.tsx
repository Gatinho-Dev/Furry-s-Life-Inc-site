import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle, ArrowUpRight, Check, ChevronDown, Clipboard, Loader2, Plus, SearchX, ShieldAlert,
} from "lucide-react";
import { logActivity } from "@/lib/agency/activity";
import {
  addEntity, addEvidence, getPrefs, listInvestigations, type EntityKind,
} from "@/lib/agency/store";
import { formatDate } from "@/lib/agency/format";
import { detectInput, type InputKind } from "@/lib/agency/catalog";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/* Layout primitives                                                          */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  eyebrow, title, subtitle, actions,
}: { eyebrow?: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--ag-border)] pb-5">
      <div className="min-w-0">
        {eyebrow && <div className="ag-label mb-1.5">{eyebrow}</div>}
        <h1 className="text-[26px] font-bold leading-tight tracking-tight md:text-[30px]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-[var(--ag-muted)]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  title, description, actions, children, className, icon,
}: { title?: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <section className={cx("ag-card p-4 md:p-5", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 className="flex items-center gap-2 text-[14px] font-semibold tracking-tight">
                {icon && <span className="text-[var(--ag-cyan)]">{icon}</span>}
                {title}
              </h2>
            )}
            {description && <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-[var(--ag-muted)]">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Grid({ children, cols = 2, className }: { children: ReactNode; cols?: 2 | 3 | 4; className?: string }) {
  const map = { 2: "md:grid-cols-2", 3: "sm:grid-cols-2 xl:grid-cols-3", 4: "sm:grid-cols-2 xl:grid-cols-4" };
  return <div className={cx("grid gap-3", map[cols], className)}>{children}</div>;
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="ag-label mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[var(--ag-faint)]">{hint}</span>}
    </label>
  );
}

export function Form({ children, onSubmit, className }: { children: ReactNode; onSubmit: (e: React.FormEvent) => void; className?: string }) {
  return (
    <form onSubmit={onSubmit} className={cx("flex flex-wrap items-end gap-2", className)}>
      {children}
    </form>
  );
}

export function Button({
  children, onClick, variant = "default", size = "md", disabled, type = "button", title, className,
}: {
  children: ReactNode; onClick?: () => void; variant?: "default" | "primary" | "ghost" | "danger";
  size?: "sm" | "md"; disabled?: boolean; type?: "button" | "submit"; title?: string; className?: string;
}) {
  const variants = {
    default: "ag-btn",
    primary: "ag-btn ag-btn-primary",
    ghost: "ag-btn ag-btn-ghost",
    danger: "ag-btn border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20",
  };
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cx(variants[variant], size === "sm" && "!px-2.5 !py-1.5 !text-[11.5px]", className)}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "blue" | "cyan" | "green" | "amber" | "rose" | "violet" }) {
  const tones: Record<string, string> = {
    neutral: "border-[var(--ag-border-strong)] bg-white/[0.03] text-[var(--ag-muted)]",
    blue: "border-blue-500/35 bg-blue-500/10 text-blue-300",
    cyan: "border-cyan-400/35 bg-cyan-400/10 text-cyan-300",
    green: "border-emerald-500/35 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-500/35 bg-amber-500/10 text-amber-300",
    rose: "border-rose-500/35 bg-rose-500/10 text-rose-300",
    violet: "border-violet-500/35 bg-violet-500/10 text-violet-300",
  };
  return <span className={cx("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", tones[tone])}>{children}</span>;
}

export function Severity({ value }: { value?: string }) {
  const v = (value ?? "").toLowerCase();
  const tone = v === "critical" ? "rose" : v === "high" ? "amber" : v === "medium" ? "amber" : v === "low" ? "cyan" : "neutral";
  if (!v) return <span className="text-[var(--ag-faint)]">—</span>;
  return <Badge tone={tone as "rose"}>{v}</Badge>;
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "cyan" | "green" | "rose" | "amber" }) {
  const color = tone === "cyan" ? "text-cyan-300" : tone === "green" ? "text-emerald-300" : tone === "rose" ? "text-rose-300" : tone === "amber" ? "text-amber-300" : "";
  return (
    <div className="ag-kpi">
      <div className="ag-label">{label}</div>
      <div className={cx("mt-1.5 font-display text-[24px] font-bold leading-none tabular-nums", color)}>{value}</div>
      {hint && <div className="mt-1.5 text-[11px] leading-snug text-[var(--ag-faint)]">{hint}</div>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-[12px] text-[var(--ag-muted)]">
      <Loader2 className="h-4 w-4 animate-spin text-[var(--ag-cyan)]" />
      {label ?? "Consultando fontes públicas…"}
    </div>
  );
}

export function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/[0.07] p-3 text-[12px] text-rose-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="font-medium">Consulta não concluída</div>
        <div className="mt-0.5 break-words text-rose-200/80">{message}</div>
      </div>
      {retry && <Button size="sm" variant="ghost" onClick={retry}>Tentar de novo</Button>}
    </div>
  );
}

export function Notice({ children, tone = "info", title }: { children: ReactNode; tone?: "info" | "warn" | "ok"; title?: string }) {
  const styles = {
    info: "border-blue-500/30 bg-blue-500/[0.06] text-blue-100/90",
    warn: "border-amber-500/30 bg-amber-500/[0.06] text-amber-100/90",
    ok: "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-100/90",
  }[tone];
  return (
    <div className={cx("rounded-xl border p-3 text-[12px] leading-relaxed", styles)}>
      {title && <div className="mb-0.5 font-semibold">{title}</div>}
      {children}
    </div>
  );
}

export function Empty({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--ag-border-strong)] px-6 py-10 text-center">
      <div className="mb-2 text-[var(--ag-faint)]">{icon ?? <SearchX className="h-6 w-6" />}</div>
      <div className="text-[12.5px] font-medium text-[var(--ag-muted)]">{title}</div>
      {hint && <div className="mt-1 max-w-md text-[11.5px] text-[var(--ag-faint)]">{hint}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: Array<{ key: T; label: string; count?: number }>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-[var(--ag-border)] bg-black/30 p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cx(
            "rounded-lg px-3 py-1.5 text-[11.5px] font-medium transition-colors",
            value === t.key ? "bg-[var(--ag-surface-3)] text-white shadow-sm" : "text-[var(--ag-muted)] hover:text-white",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 text-[10px] text-[var(--ag-faint)]">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function CopyButton({ value, label = "Copiar" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch { /* clipboard denied */ }
      }}
      className="inline-flex items-center gap-1 rounded-md border border-[var(--ag-border)] px-1.5 py-0.5 text-[10px] text-[var(--ag-muted)] hover:text-white"
      title="Copiar"
    >
      {done ? <Check className="h-3 w-3 text-emerald-400" /> : <Clipboard className="h-3 w-3" />}
      {done ? "Copiado" : label}
    </button>
  );
}

export function KV({ items, cols = 2 }: { items: Array<{ label: string; value: ReactNode }>; cols?: number }) {
  return (
    <dl className={cx("grid gap-x-6 gap-y-3", cols === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2")}>
      {items.filter((i) => i.value !== undefined && i.value !== null && i.value !== "").map((i, idx) => (
        <div key={`${i.label}-${idx}`} className="min-w-0">
          <dt className="ag-label">{i.label}</dt>
          <dd className="mt-1 break-words text-[12.5px] text-[#dbe6f2]">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* -------------------------------------------------------------------------- */
/* Recursive result renderer                                                  */
/* -------------------------------------------------------------------------- */

function isUrl(v: string): boolean {
  return /^https?:\/\//i.test(v);
}

function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(cellText).join(", ");
  return JSON.stringify(v);
}

export function ValueView({ value, depth = 0 }: { value: unknown; depth?: number }): ReactNode {
  if (value === null || value === undefined || value === "") return <span className="text-[var(--ag-faint)]">—</span>;
  if (typeof value === "boolean") return <Badge tone={value ? "green" : "neutral"}>{value ? "sim" : "não"}</Badge>;
  if (typeof value === "number") return <span className="ag-mono text-[12px] tabular-nums">{value.toLocaleString("pt-BR")}</span>;
  if (typeof value === "string") {
    if (isUrl(value)) {
      return (
        <a href={value} target="_blank" rel="noopener noreferrer" className="ag-link inline-flex items-center gap-1 break-all text-[12px]">
          {value.length > 90 ? `${value.slice(0, 90)}…` : value}
          <ArrowUpRight className="h-3 w-3 shrink-0" />
        </a>
      );
    }
    if (value.length > 160 || value.includes("\n")) {
      return <pre className="ag-mono max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--ag-border)] bg-black/40 p-2 text-[11.5px] leading-relaxed text-[#c8d6e5]">{value}</pre>;
    }
    return <span className="break-words text-[12.5px] text-[#dbe6f2]">{value}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-[12px] text-[var(--ag-faint)]">Nenhum registro</span>;
    if (value.every((v) => typeof v === "string" || typeof v === "number")) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v, i) => (
            <span key={i} className="ag-mono rounded-md border border-[var(--ag-border)] bg-black/30 px-1.5 py-0.5 text-[11px] text-[#cfdbe8]">
              {String(v)}
            </span>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {value.map((v, i) => (
          <div key={i} className="rounded-lg border border-[var(--ag-border)] bg-black/20 p-2.5">
            {depth >= 4 ? <pre className="ag-mono overflow-auto text-[10.5px]">{JSON.stringify(v, null, 2)}</pre> : <ValueView value={v} depth={depth + 1} />}
          </div>
        ))}
      </div>
    );
  }
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (depth >= 4) {
    return <pre className="ag-mono max-h-64 overflow-auto rounded-lg border border-[var(--ag-border)] bg-black/40 p-2 text-[10.5px]">{JSON.stringify(value, null, 2)}</pre>;
  }
  return (
    <div className="space-y-2">
      {entries.map(([k, v]) => (
        <div key={k} className={cx("grid gap-2 sm:grid-cols-[150px_1fr]", Array.isArray(v) && v.some((x) => typeof x === "object") && "sm:grid-cols-1")}>
          <div className="ag-label pt-0.5">{humanizeKey(k)}</div>
          <div className="min-w-0">{Array.isArray(v) && v.some((x) => typeof x === "object") ? <DataTable rows={v as Record<string, unknown>[]} /> : <ValueView value={v} depth={depth + 1} />}</div>
        </div>
      ))}
    </div>
  );
}

export function DataTable({ rows, maxRows = 60, columns }: { rows: Record<string, unknown>[]; maxRows?: number; columns?: string[] }) {
  const cols = useMemo(() => columns ?? [...new Set(rows.flatMap((r) => Object.keys(r)))].slice(0, 8), [rows, columns]);
  if (!rows.length) return <Empty title="Nenhum registro retornado" />;
  const shown = rows.slice(0, maxRows);
  return (
    <div className="max-h-[520px] overflow-auto rounded-lg border border-[var(--ag-border)]">
      <table className="ag-table">
        <thead className="sticky top-0 z-10">
          <tr>{cols.map((c) => <th key={c}>{humanizeKey(c)}</th>)}</tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c} className="max-w-[360px] align-top">
                  <ValueView value={r[c]} depth={2} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > maxRows && (
        <div className="border-t border-[var(--ag-border)] px-3 py-2 text-[11px] text-[var(--ag-faint)]">
          Exibindo {maxRows} de {rows.length} registros.
        </div>
      )}
    </div>
  );
}

export function stripMeta(data: unknown): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const clone: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  delete clone.sources;
  delete clone.queriedAt;
  delete clone.source;
  return clone;
}

/* -------------------------------------------------------------------------- */
/* Provenance                                                                 */
/* -------------------------------------------------------------------------- */

export function Provenance({
  sources, queriedAt, note,
}: { sources?: Array<{ name: string; ok: boolean; detail?: string; url?: string }> | { name: string; ok: boolean; detail?: string; url?: string }; queriedAt?: string; note?: string }) {
  const list = Array.isArray(sources) ? sources : sources ? [sources] : [];
  if (!list.length && !queriedAt && !note) return null;
  return (
    <div className="mt-4 rounded-xl border border-[var(--ag-border)] bg-black/25 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="ag-label">Fonte e proveniência</span>
        {queriedAt && <span className="ag-mono text-[10.5px] text-[var(--ag-faint)]">consulta: {formatDate(queriedAt)}</span>}
      </div>
      <ul className="mt-2 space-y-1.5">
        {list.map((s, i) => (
          <li key={`${s.name}-${i}`} className="flex flex-wrap items-start gap-2 text-[11.5px]">
            <span className={cx("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", s.ok ? "bg-emerald-400" : "bg-rose-400")} />
            {s.url ? (
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="ag-link font-medium">{s.name}</a>
            ) : (
              <span className="font-medium text-[#cfdae7]">{s.name}</span>
            )}
            {s.detail && <span className="text-[var(--ag-faint)]">— {s.detail}</span>}
          </li>
        ))}
      </ul>
      {note && <p className="mt-2 text-[11px] text-[var(--ag-faint)]">{note}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* API state hook                                                             */
/* -------------------------------------------------------------------------- */

export type ApiState<T> = {
  loading: boolean;
  data: T | null;
  error: string | null;
  at: string | null;
  input: string;
};

export function errorMessage(e: unknown): string {
  if (e instanceof Error) {
    const msg = e.message || "Erro desconhecido";
    // TanStack Start may wrap server errors in JSON or prefixes
    const jsonMatch = msg.match(/\{.*"message"\s*:\s*"([^"]+)"/);
    if (jsonMatch) return jsonMatch[1];
    return msg.replace(/^Error:\s*/, "");
  }
  return String(e);
}

export function useApi<T>(tool: { id: string; name: string; source: string }) {
  const [state, setState] = useState<ApiState<T>>({ loading: false, data: null, error: null, at: null, input: "" });

  const run = useCallback(
    async (input: string, call: () => Promise<T>, source?: string): Promise<T | null> => {
      setState({ loading: true, data: null, error: null, at: null, input });
      const started = performance.now();
      try {
        const data = await call();
        const at = new Date().toISOString();
        setState({ loading: false, data, error: null, at, input });
        logActivity({
          tool: tool.name,
          toolId: tool.id,
          input: input.slice(0, 160),
          status: "success",
          source: source ?? tool.source,
          durationMs: Math.round(performance.now() - started),
        });
        return data;
      } catch (e) {
        const msg = errorMessage(e);
        setState({ loading: false, data: null, error: msg, at: new Date().toISOString(), input });
        logActivity({
          tool: tool.name,
          toolId: tool.id,
          input: input.slice(0, 160),
          status: "error",
          source: source ?? tool.source,
          detail: msg.slice(0, 240),
          durationMs: Math.round(performance.now() - started),
        });
        return null;
      }
    },
    [tool.id, tool.name, tool.source],
  );

  return { ...state, run, reset: () => setState({ loading: false, data: null, error: null, at: null, input: "" }) };
}

export function ApiOutput<T>({
  api, render, onAttach, attachKind, hideProvenance,
}: {
  api: ApiState<T>;
  render?: (data: T) => ReactNode;
  onAttach?: () => void;
  attachKind?: EntityKind;
  hideProvenance?: boolean;
}) {
  if (api.loading) return <Spinner />;
  if (api.error) return <ErrorBox message={api.error} />;
  if (!api.data) return null;
  const data = api.data as Record<string, unknown>;
  return (
    <div className="ag-fade-in space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="ag-mono text-[11px] text-[var(--ag-faint)]">{api.input && `consulta: ${api.input}`}</div>
        {onAttach && (
          <Button size="sm" onClick={onAttach}>
            <Plus className="h-3.5 w-3.5" /> Registrar evidência
          </Button>
        )}
      </div>
      {render ? render(api.data) : <ValueView value={stripMeta(api.data)} />}
      {!hideProvenance && (
        <Provenance
          sources={data.sources as Parameters<typeof Provenance>[0]["sources"]}
          queriedAt={(data.queriedAt as string) ?? api.at ?? undefined}
          note={typeof data.disclaimer === "string" ? data.disclaimer : undefined}
        />
      )}
      {attachKind && <span className="hidden">{attachKind}</span>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Evidence attachment                                                        */
/* -------------------------------------------------------------------------- */

export function AttachEvidence({
  open, onClose, toolName, toolId, input, source, data, defaultKind,
}: {
  open: boolean; onClose: () => void; toolName: string; toolId: string;
  input: string; source: string; data: unknown; defaultKind?: EntityKind;
}) {
  const [selected, setSelected] = useState("");
  const [asEntity, setAsEntity] = useState(true);
  const [done, setDone] = useState<string | null>(null);
  const investigations = useMemo(() => (open ? listInvestigations() : []), [open]);
  const kind = useMemo<EntityKind>(() => {
    const k = detectInput(input) as InputKind;
    const map: Record<string, EntityKind> = {
      domain: "domain", ip: "ip", url: "url", email: "email", username: "username",
      hash: "hash", cve: "cve", asn: "asn", company: "organization", text: "note",
    };
    return defaultKind ?? map[k] ?? "note";
  }, [input, defaultKind]);

  if (!open) return null;

  const attach = () => {
    if (!selected) return;
    if (asEntity && input) {
      addEntity(selected, { kind, value: input, source, confidence: "confirmed" });
    }
    addEvidence(selected, {
      toolId, tool: toolName, input, source,
      summary: `${toolName}${input ? ` · ${input}` : ""} — resultado armazenado como evidência pública.`,
      data,
    });
    setDone(selected);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="ag-panel w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[14px] font-semibold">Registrar evidência</h3>
        <p className="mt-1 text-[12px] text-[var(--ag-muted)]">Salve o resultado em uma investigação local. Nada é enviado para servidores externos.</p>
        {investigations.length === 0 ? (
          <div className="mt-4">
            <Notice tone="warn">Nenhuma investigação criada ainda.</Notice>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>Fechar</Button>
              <Link to="/agency/workspace" search={{ case: undefined }} className="ag-btn ag-btn-primary">Criar investigação</Link>
            </div>
          </div>
        ) : done ? (
          <div className="mt-4 space-y-3">
            <Notice tone="ok" title="Evidência registrada">A investigação foi atualizada com a evidência e, se aplicável, a entidade.</Notice>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>Fechar</Button>
              <Link to="/agency/workspace" search={{ case: undefined }} className="ag-btn ag-btn-primary">Abrir investigação</Link>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <Field label="Investigação">
              <select className="ag-select" value={selected} onChange={(e) => setSelected(e.target.value)}>
                <option value="">Selecione…</option>
                {investigations.map((i) => <option key={i.id} value={i.id}>{i.code} · {i.name}</option>)}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-[12px] text-[var(--ag-muted)]">
              <input type="checkbox" checked={asEntity} onChange={(e) => setAsEntity(e.target.checked)} />
              Adicionar “{input || toolName}” como entidade ({kind})
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button variant="primary" onClick={attach} disabled={!selected}>Registrar</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tool scaffold                                                              */
/* -------------------------------------------------------------------------- */

export function ToolBlock({
  title, description, badge, children, right,
}: { title: string; description?: string; badge?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <Panel title={title} description={description} actions={badge} icon={<ShieldAlert className="h-3.5 w-3.5" />}>
      <div className="space-y-4">{children}{right}</div>
    </Panel>
  );
}

export function Collapse({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-[var(--ag-border)]">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[12px] font-medium text-[#d6e2ef]">
        {title}
        <ChevronDown className={cx("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="border-t border-[var(--ag-border)] p-3">{children}</div>}
    </div>
  );
}

export function apiKeys(): Record<string, string> {
  return getPrefs().apiKeys;
}
