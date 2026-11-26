import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight, ArrowUpRight, BadgeCheck, CircleSlash, Database, FolderOpen, Gauge, History,
  Radar, RefreshCw, Search, ShieldAlert, Sparkles, Workflow,
} from "lucide-react";
import { getActivity, activityStats, subscribeActivity, type ActivityEntry } from "@/lib/agency/activity";
import { listInvestigations, getPrefs, subscribeStore } from "@/lib/agency/store";
import { NAV, SOURCES, TOOLS, APP_VERSION, APP_SLOGAN } from "@/lib/agency/catalog";
import { sourceHealth } from "@/lib/agency/api/feed.functions";
import { Badge, Button, Empty, PageHeader, Panel, Stat, cx } from "@/components/agency/kit";

const formatDateOnly = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
import { IntelligenceFeed } from "@/components/agency/Feed";
import { formatDate, timeAgo } from "@/lib/agency/format";

export const Route = createFileRoute("/agency/")({
  head: () => ({ meta: [{ title: "Overview — Life Agency" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: Overview,
});

type Scope = "success" | "domain" | "ip";

function classify(entry: ActivityEntry): Scope | "other" {
  const v = entry.input.toLowerCase();
  if (entry.toolId.includes("cve") || entry.toolId.includes("kev") || entry.toolId.includes("hash") || entry.toolId.includes("threatfox") || entry.toolId.includes("urlhaus")) return "success";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v) || v.includes(":")) return "ip";
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(v)) return "domain";
  return "other";
}

function Overview() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [investigations, setInvestigations] = useState(() => listInvestigations());
  const [health, setHealth] = useState<Awaited<ReturnType<typeof sourceHealth>> | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setEntries(getActivity());
    setInvestigations(listInvestigations());
    const offA = subscribeActivity(() => setEntries(getActivity()));
    const offS = subscribeStore(() => setInvestigations(listInvestigations()));
    return () => { offA(); offS(); };
  }, []);

  const check = async () => {
    setChecking(true); setHealthError(null);
    try {
      setHealth(await sourceHealth({ data: { keys: getPrefs().apiKeys } }));
    } catch (e) {
      setHealthError(e instanceof Error ? e.message : "Falha ao verificar fontes");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => { void check(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const stats = useMemo(() => activityStats(entries), [entries]);
  const domains = useMemo(() => new Set(entries.filter((e) => classify(e) === "domain").map((e) => e.input.toLowerCase())).size, [entries]);
  const ips = useMemo(() => new Set(entries.filter((e) => classify(e) === "ip").map((e) => e.input.toLowerCase())).size, [entries]);
  const threatEvidence = useMemo(
    () => investigations.reduce((sum, inv) => sum + inv.evidence.filter((e) => /cve|kev|hash|threatfox|otx|urlhaus|reputation/i.test(e.toolId)).length, 0),
    [investigations],
  );
  const entities = useMemo(() => investigations.reduce((sum, i) => sum + i.entities.length, 0), [investigations]);
  const online = health?.online ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Life Agency v${APP_VERSION} · OSINT & Cyber Intelligence`}
        title="Intelligence Dashboard"
        subtitle={`${APP_SLOGAN} — visão operacional consolidada. Todos os números abaixo vêm do seu próprio histórico local e de fontes públicas consultadas em tempo real; nada é simulado.`}
        actions={
          <>
            <Link to="/agency/workspace" search={{ case: undefined }} className="ag-btn"><FolderOpen className="h-3.5 w-3.5" /> Novo caso</Link>
            <Link to="/agency/quick-search" search={{ q: undefined }} className="ag-btn ag-btn-primary"><Search className="h-3.5 w-3.5" /> Quick Search</Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Investigações" value={investigations.length} hint={`${entities} entidades registradas`} tone="cyan" />
        <Stat label="Consultas executadas" value={stats.total} hint={`${stats.today} hoje`} />
        <Stat label="Domínios analisados" value={domains} hint="entradas únicas no histórico local" />
        <Stat label="IPs analisados" value={ips} hint="entradas únicas no histórico local" />
        <Stat label="Indicadores de ameaça" value={threatEvidence} hint="evidências cyber salvas em casos" tone="rose" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Panel
            title="Intelligence Feed"
            description="Vulnerabilidades publicadas, exploração ativa confirmada, avisos oficiais e notícias de segurança — de feeds públicos, sem cache fictício."
            actions={<Badge tone="cyan"><Radar className="h-3 w-3" /> ao vivo</Badge>}
          >
            <IntelligenceFeed compact />
          </Panel>

          <Panel
            title="Investigações recentes"
            description="Casos armazenados localmente neste navegador."
            actions={<Link to="/agency/workspace" search={{ case: undefined }} className="text-[11.5px] text-cyan-300 hover:underline">Ver todas</Link>}
          >
            {investigations.length === 0 ? (
              <Empty title="Nenhuma investigação criada" hint="Crie um caso no Investigation Workspace para correlacionar entidades, evidências e notas." icon={<FolderOpen className="h-6 w-6" />} />
            ) : (
              <ul className="divide-y divide-[var(--ag-border)]">
                {investigations.slice(0, 5).map((inv) => (
                  <li key={inv.id}>
                    <Link to="/agency/workspace" search={{ case: inv.id }} className="flex flex-wrap items-center justify-between gap-2 py-2.5 hover:text-cyan-300">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="ag-mono text-[10.5px] text-[var(--ag-faint)]">{inv.code}</span>
                          <span className="truncate text-[12.5px] font-medium">{inv.name}</span>
                        </div>
                        <div className="mt-0.5 text-[10.5px] text-[var(--ag-faint)]">
                          {inv.entities.length} entidades · {inv.evidence.length} evidências · atualizado {timeAgo(inv.updatedAt)}
                        </div>
                      </div>
                      <Badge tone={inv.status === "active" ? "cyan" : inv.status === "completed" ? "green" : inv.status === "archived" ? "neutral" : "amber"}>
                        {inv.status.replace("_", " ")}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Atividade recente"
            description="Trilha de auditoria local de consultas executadas."
            actions={<Link to="/agency/activity" className="text-[11.5px] text-cyan-300 hover:underline">Abrir log</Link>}
          >
            {entries.length === 0 ? (
              <Empty title="Sem atividade registrada" hint="Cada ferramenta executada registra ferramenta, entrada, fonte, horário e resultado." icon={<History className="h-6 w-6" />} />
            ) : (
              <ul className="divide-y divide-[var(--ag-border)]">
                {entries.slice(0, 7).map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", e.status === "success" ? "bg-emerald-400" : e.status === "error" ? "bg-rose-400" : "bg-amber-400")} />
                      <span className="text-[12px] font-medium">{e.tool}</span>
                      <span className="ag-mono truncate text-[10.5px] text-[var(--ag-faint)]">{e.input || "—"}</span>
                    </div>
                    <span className="ag-mono text-[10px] text-[var(--ag-faint)]">{formatDate(e.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel
            title="Status das integrações"
            description="Verificação real de conectividade das fontes gratuitas."
            actions={<Button size="sm" variant="ghost" onClick={check} disabled={checking}><RefreshCw className={cx("h-3.5 w-3.5", checking && "animate-spin")} /></Button>}
          >
            {healthError && <div className="text-[11.5px] text-rose-300">{healthError}</div>}
            {!health && !healthError && <div className="text-[11.5px] text-[var(--ag-faint)]">Verificando…</div>}
            {health && (
              <>
                <div className="mb-3 flex items-center gap-3">
                  <div className="font-display text-2xl font-bold text-emerald-300">{online}<span className="text-[13px] text-[var(--ag-faint)]">/{health.total}</span></div>
                  <div className="text-[11px] text-[var(--ag-muted)]">fontes respondendo<br />{formatDate(health.checkedAt)}</div>
                </div>
                <ul className="space-y-1.5">
                  {health.rows.map((r) => (
                    <li key={r.id} className="flex items-start gap-2 text-[11px]">
                      {r.ok ? <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" /> : <CircleSlash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[#d7e3f0]">{r.name}</span>
                        {r.detail && <span className="block text-[10px] leading-snug text-[var(--ag-faint)]">{r.detail}</span>}
                      </span>
                      <span className="ag-mono text-[9.5px] text-[var(--ag-faint)]">{r.status || "ERR"} · {r.ms}ms</span>
                    </li>
                  ))}
                </ul>
                <Link to="/agency/api" className="mt-3 inline-flex items-center gap-1 text-[11px] text-cyan-300 hover:underline">Gerenciar fontes <ArrowRight className="h-3 w-3" /></Link>
              </>
            )}
          </Panel>

          <Panel title="Ferramentas mais utilizadas" description="Baseado no seu histórico real.">
            {stats.topTools.length === 0 ? (
              <Empty title="Ainda sem uso" hint="Execute ferramentas para gerar métricas." icon={<Gauge className="h-6 w-6" />} />
            ) : (
              <ul className="space-y-2">
                {stats.topTools.map(([tool, count], i) => (
                  <li key={tool}>
                    <div className="flex items-center justify-between text-[11.5px]">
                      <span className="truncate">{tool}</span>
                      <span className="ag-mono text-[10px] text-[var(--ag-faint)]">{count}</span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: `${Math.max(8, (count / stats.topTools[0][1]) * 100)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Capacidades disponíveis" description="Catálogo ativo da plataforma.">
            <div className="space-y-2 text-[11.5px]">
              <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[var(--ag-muted)]"><Database className="h-3.5 w-3.5" /> Fontes catalogadas</span><span className="ag-mono">{SOURCES.length}</span></div>
              <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[var(--ag-muted)]"><Workflow className="h-3.5 w-3.5" /> Ferramentas com integração</span><span className="ag-mono">{TOOLS.length}</span></div>
              <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[var(--ag-muted)]"><Sparkles className="h-3.5 w-3.5" /> Módulos</span><span className="ag-mono">{NAV.length}</span></div>
              <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[var(--ag-muted)]"><ShieldAlert className="h-3.5 w-3.5" /> Erros no histórico</span><span className="ag-mono">{stats.errors}</span></div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {["domain", "ip", "cyber", "username", "email", "web"].map((key) => {
                const n = NAV.find((x) => x.key === key);
                return n ? (
                  <Link key={key} to={n.to} className="flex items-center justify-between rounded-lg border border-[var(--ag-border)] px-2 py-1.5 text-[11px] text-[var(--ag-muted)] hover:border-cyan-400/40 hover:text-white">
                    {n.label.replace(" Intelligence", "")} <ArrowUpRight className="h-3 w-3" />
                  </Link>
                ) : null;
              })}
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Acesso rápido às ferramentas" description="Atalhos para as consultas mais usadas — todas funcionais e gratuitas.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {TOOLS.slice(0, 12).map((t) => {
            const nav = NAV.find((n) => n.key === t.page);
            return (
              <Link key={t.id} to={nav?.to ?? "/agency"} className="rounded-xl border border-[var(--ag-border)] bg-white/[0.015] p-3 transition-colors hover:border-cyan-400/35 hover:bg-white/[0.04]">
                <div className="text-[12px] font-medium text-[#e3ecf6]">{t.name}</div>
                <div className="mt-1 line-clamp-2 text-[10.5px] leading-snug text-[var(--ag-faint)]">{t.description}</div>
              </Link>
            );
          })}
        </div>
        <div className="mt-3 text-[10.5px] text-[var(--ag-faint)]">Snapshot local: {formatDateOnly(new Date().toISOString())} · Nenhum dado é inventado ou pré-preenchido.</div>
      </Panel>
    </div>
  );
}
