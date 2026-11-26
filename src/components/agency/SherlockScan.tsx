import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Ban, CheckCircle2, Fingerprint, Play, Square, Users } from "lucide-react";
import { sherlockCatalog, usernameScanBatch } from "@/lib/agency/api/identity.functions";
import { POPULAR_SITE_IDS } from "@/lib/agency/identity/quick-sites";
import type { ScanSiteResult } from "@/lib/agency/identity/types";
import { Badge, Button, Field, Notice, Panel, Spinner, cx, errorMessage } from "./kit";

const BATCH = 20;

/**
 * Sherlock-compatible username scan (464 public sites), executed in batches so
 * the server never fires hundreds of requests at once. Each batch is real HTTP.
 */
export function SherlockScan({ initialUsername = "" }: { initialUsername?: string }) {
  const [username, setUsername] = useState(initialUsername);
  const [scope, setScope] = useState<"quick" | "all">("quick");
  const [catalog, setCatalog] = useState<{ total: number; ids: string[] } | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, found: 0, blocked: 0 });
  const [results, setResults] = useState<ScanSiteResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const stopRef = useRef(false);
  const popular = useMemo(() => new Set(POPULAR_SITE_IDS), []);

  useEffect(() => {
    sherlockCatalog({ data: {} })
      .then((c) => setCatalog({ total: c.total, ids: c.ids }))
      .catch((e) => setCatalogError(errorMessage(e)));
  }, []);

  const ids = useMemo(() => {
    if (!catalog) return [] as string[];
    return scope === "quick" ? catalog.ids.filter((id) => popular.has(id)) : catalog.ids;
  }, [catalog, scope, popular]);

  const run = async () => {
    const handle = username.trim().replace(/^@/, "");
    if (!handle || running || !ids.length) return;
    setRunning(true); stopRef.current = false; setError(null); setResults([]);
    setProgress({ done: 0, total: ids.length, found: 0, blocked: 0 });
    const collected: ScanSiteResult[] = [];
    try {
      for (let i = 0; i < ids.length; i += BATCH) {
        if (stopRef.current) break;
        const chunk = ids.slice(i, i + BATCH);
        const res = await usernameScanBatch({ data: { username: handle, siteIds: chunk } });
        collected.push(...res.results);
        setResults([...collected]);
        setProgress({
          done: Math.min(i + chunk.length, ids.length),
          total: ids.length,
          found: collected.filter((r) => r.status === "found").length,
          blocked: collected.filter((r) => r.status === "blocked").length,
        });
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRunning(false);
    }
  };

  const found = results.filter((r) => r.status === "found");
  const visible = found.filter((r) => !filter.trim() || `${r.name} ${r.category} ${r.url}`.toLowerCase().includes(filter.trim().toLowerCase()));
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Panel
      title="Sherlock · varredura estendida"
      description="Mesma base pública do Sherlock Project (MIT), consultada em lotes com timeout e cache. O modo completo testa centenas de sites e pode levar alguns minutos."
      icon={<Fingerprint className="h-3.5 w-3.5" />}
      actions={<Badge tone="cyan"><Users className="h-3 w-3" /> {catalog?.total ?? "…"} sites</Badge>}
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_170px_auto_auto] sm:items-end">
        <Field label="Username">
          <input className="ag-input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="usuario (sem @)" />
        </Field>
        <Field label="Escopo">
          <select className="ag-select" value={scope} onChange={(e) => setScope(e.target.value as "quick" | "all")} disabled={running}>
            <option value="quick">Rápido · populares</option>
            <option value="all">Completo · todos</option>
          </select>
        </Field>
        <Button variant="primary" onClick={() => void run()} disabled={running || !username.trim() || !ids.length}>
          {running ? <Spinner label="" /> : <Play className="h-3.5 w-3.5" />} Verificar {ids.length || ""}
        </Button>
        <Button variant="ghost" onClick={() => { stopRef.current = true; }} disabled={!running}>
          <Square className="h-3 w-3" /> Parar
        </Button>
      </div>

      {catalogError && <Notice tone="warn">Não foi possível carregar a lista de sites: {catalogError}</Notice>}
      {error && <Notice tone="warn">{error}</Notice>}

      {(running || progress.done > 0) && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--ag-muted)]">
            <span className="ag-mono">{progress.done}/{progress.total}</span>
            <span className="text-[var(--ag-faint)]">· {pct}%</span>
            <Badge tone="green"><CheckCircle2 className="h-2.5 w-2.5" /> {progress.found} encontrados</Badge>
            <Badge tone="amber"><Ban className="h-2.5 w-2.5" /> {progress.blocked} bloqueados</Badge>
            {running && <span className="text-[var(--ag-faint)]">consultando em lotes de {BATCH}…</span>}
          </div>
          <div className="ag-progress" aria-hidden>
            <span style={{ width: `${pct}%` }} className={cx(running && "ag-progress-live")} />
          </div>
        </div>
      )}

      {progress.done > 0 && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <input className="ag-input !w-auto min-w-[180px] flex-1 !py-1.5 !text-[11px]" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="filtrar encontrados" />
            <Link to="/agency/identity" search={{ seed: username.trim().replace(/^@/, ""), deep: scope === "all" ? "1" : undefined }} className="ag-btn ag-btn-primary !px-2.5 !py-1.5 !text-[11px]">
              <Fingerprint className="h-3 w-3" /> Abrir no Case Seeder
            </Link>
          </div>
          <div className="max-h-[300px] overflow-auto rounded-xl border border-[var(--ag-border)]">
            <table className="ag-table w-full">
              <thead className="sticky top-0 bg-[var(--ag-surface-2)]"><tr><th>Plataforma</th><th>Categoria</th><th>Status</th><th>Link</th></tr></thead>
              <tbody>
                {visible.slice(0, 120).map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-[11.5px]">{r.name}</td>
                    <td className="text-[10.5px] text-[var(--ag-faint)]">{r.category}</td>
                    <td><Badge tone={r.status === "found" ? "green" : r.status === "blocked" ? "amber" : "neutral"}>{r.status === "found" ? "encontrado" : r.status === "blocked" ? "bloqueado" : r.status === "not_found" ? "ausente" : "indefinido"}</Badge></td>
                    <td><a href={r.url} target="_blank" rel="noreferrer" className="ag-link text-[10.5px]">{new URL(r.url).hostname.replace(/^www\./, "")}</a></td>
                  </tr>
                ))}
                {visible.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-[11px] text-[var(--ag-faint)]">{results.length ? "Nenhum perfil encontrado neste escopo." : "Aguardando consulta."}</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] leading-relaxed text-[var(--ag-faint)]">
            Página 200 é indício, não prova: várias plataformas devolvem 200 para perfis inexistentes. O Sherlock é usado apenas como catálogo de URLs públicas (MIT); a verificação é feita por HTTP direto, sem autenticação.
          </p>
        </div>
      )}
    </Panel>
  );
}
