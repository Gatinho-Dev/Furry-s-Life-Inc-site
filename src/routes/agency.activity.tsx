import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, History, Search, Trash2 } from "lucide-react";
import { clearActivity, getActivity, subscribeActivity, type ActivityEntry } from "@/lib/agency/activity";
import { download, formatDate, toCsv } from "@/lib/agency/format";
import { listInvestigations } from "@/lib/agency/store";
import { Badge, Button, DataTable, Empty, PageHeader, Panel, Stat, cx } from "@/components/agency/kit";

export const Route = createFileRoute("/agency/activity")({
  head: () => ({ meta: [{ title: "Activity Log — Life Agency" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: ActivityPage,
});

function ActivityPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [tool, setTool] = useState("all");
  const [days, setDays] = useState(0);

  useEffect(() => {
    setEntries(getActivity());
    return subscribeActivity(() => setEntries(getActivity()));
  }, []);

  const tools = useMemo(() => ["all", ...new Set(entries.map((e) => e.tool))], [entries]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cutoff = days ? Date.now() - days * 86400000 : 0;
    return entries.filter((e) => {
      if (status !== "all" && e.status !== status) return false;
      if (tool !== "all" && e.tool !== tool) return false;
      if (cutoff && new Date(e.at).getTime() < cutoff) return false;
      if (q && !`${e.tool} ${e.input} ${e.source} ${e.detail ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, query, status, tool, days]);

  const investigations = useMemo(() => listInvestigations(), [entries]);

  const exportCsv = () => download("life-agency-activity.csv", toCsv(filtered.map((e) => ({
    data: formatDate(e.at), ferramenta: e.tool, entrada: e.input, status: e.status, fonte: e.source, duracao_ms: e.durationMs ?? "", detalhe: e.detail ?? "",
  }))), "text/csv;charset=utf-8");

  const exportJson = () => download("life-agency-activity.json", JSON.stringify(filtered, null, 2), "application/json");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Auditoria"
        title="Global Activity Log"
        subtitle="Trilha completa das consultas executadas neste navegador: ferramenta, entrada, fonte, horário, status, duração e erro. Exportável em CSV/JSON."
        actions={
          <>
            <Button size="sm" onClick={exportCsv} disabled={!filtered.length}><Download className="h-3 w-3" /> CSV</Button>
            <Button size="sm" onClick={exportJson} disabled={!filtered.length}><Download className="h-3 w-3" /> JSON</Button>
            <Button size="sm" variant="danger" onClick={() => { if (confirm("Limpar todo o histórico local de atividades?")) clearActivity(); }} disabled={!entries.length}>
              <Trash2 className="h-3 w-3" /> Limpar
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Registros" value={entries.length} tone="cyan" />
        <Stat label="Sucessos" value={entries.filter((e) => e.status === "success").length} tone="green" />
        <Stat label="Erros" value={entries.filter((e) => e.status === "error").length} tone="rose" />
        <Stat label="Filtrados" value={filtered.length} hint="com os critérios atuais" />
      </div>

      <Panel>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <label className="ag-label mb-1.5 block">Pesquisar</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ag-faint)]" />
              <input className="ag-input !pl-8" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ferramenta, entrada, fonte…" />
            </div>
          </div>
          <div className="min-w-[150px]">
            <label className="ag-label mb-1.5 block">Status</label>
            <select className="ag-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Todos</option>
              <option value="success">Sucesso</option>
              <option value="error">Erro</option>
              <option value="partial">Parcial</option>
            </select>
          </div>
          <div className="min-w-[170px]">
            <label className="ag-label mb-1.5 block">Ferramenta</label>
            <select className="ag-select" value={tool} onChange={(e) => setTool(e.target.value)}>
              {tools.map((t) => <option key={t} value={t}>{t === "all" ? "Todas" : t}</option>)}
            </select>
          </div>
          <div className="min-w-[130px]">
            <label className="ag-label mb-1.5 block">Período</label>
            <select className="ag-select" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={0}>Tudo</option>
              <option value={1}>24 horas</option>
              <option value={7}>7 dias</option>
              <option value={30}>30 dias</option>
            </select>
          </div>
        </div>
      </Panel>

      {filtered.length === 0 ? (
        <Empty title="Nenhuma atividade registrada" hint="Execute ferramentas para popular o histórico. Cada consulta registra fonte, horário e resultado." icon={<History className="h-6 w-6" />} />
      ) : (
        <Panel title={`${filtered.length} registro(s)`} description="Ordem cronológica reversa. Dados 100% locais.">
          <DataTable
            maxRows={300}
            columns={["data", "ferramenta", "entrada", "status", "fonte", "duração", "detalhe"]}
            rows={filtered.map((e) => ({
              data: <span className="ag-mono text-[10.5px]">{formatDate(e.at)}</span>,
              ferramenta: <span className="text-[11.5px]">{e.tool}</span>,
              entrada: <span className="ag-mono text-[10.5px]">{e.input || "—"}</span>,
              status: <Badge tone={e.status === "success" ? "green" : e.status === "error" ? "rose" : "amber"}>{e.status}</Badge>,
              fonte: <span className="text-[10.5px]">{e.source}</span>,
              duração: <span className="ag-mono text-[10px]">{e.durationMs ? `${e.durationMs} ms` : "—"}</span>,
              detalhe: <span className={cx("text-[10px]", e.status === "error" ? "text-rose-300" : "text-[var(--ag-faint)]")}>{e.detail ?? ""}</span>,
            }))}
          />
        </Panel>
      )}

      <Panel title="Investigações associadas" description="O histórico é vinculado a casos quando você salva evidências.">
        {investigations.length === 0 ? (
          <div className="text-[11.5px] text-[var(--ag-faint)]">Nenhuma investigação criada. <Link to="/agency/workspace" search={{ case: undefined }} className="ag-link">Criar agora</Link>.</div>
        ) : (
          <ul className="space-y-1">
            {investigations.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 text-[11.5px]">
                <Link to="/agency/workspace" search={{ case: i.id }} className="ag-link">{i.code} · {i.name}</Link>
                <span className="text-[10px] text-[var(--ag-faint)]">{i.evidence.length} evidências</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
