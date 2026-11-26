import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowUpRight, RefreshCw, ShieldAlert, Zap } from "lucide-react";
import { intelFeed, type FeedItem } from "@/lib/agency/api/feed.functions";
import { Badge, Button, Empty, ErrorBox, Severity, Spinner } from "./kit";
import { getPrefs } from "@/lib/agency/store";

function formatDateOnly(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

const CATEGORIES: Array<{ key: FeedItem["category"] | "all"; label: string }> = [
  { key: "all", label: "Tudo" },
  { key: "vulnerability", label: "Novas CVEs" },
  { key: "exploited", label: "Exploradas (KEV)" },
  { key: "malware", label: "Malware" },
  { key: "c2", label: "C2 / IOCs" },
  { key: "advisory", label: "Advisories" },
  { key: "news", label: "Notícias" },
];

const PERIODS = [1, 3, 7, 15, 30];

export function IntelligenceFeed({ compact = false }: { compact?: boolean }) {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [sources, setSources] = useState<Array<{ name: string; ok: boolean; detail?: string; count: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<FeedItem["category"] | "all">("all");
  const [days, setDays] = useState(7);

  const load = async (windowDays = days) => {
    setLoading(true); setError(null);
    try {
      const res = await intelFeed({ data: { days: windowDays, keys: getPrefs().apiKeys } });
      setItems(res.items);
      setSources(res.sources);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar o feed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(days); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [days]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const cutoff = Date.now() - days * 86400000;
    return items
      .filter((i) => category === "all" || i.category === category)
      .filter((i) => new Date(i.date).getTime() >= cutoff || i.category === "exploited")
      .slice(0, compact ? 8 : 120);
  }, [items, category, days, compact]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {CATEGORIES.filter((c) => compact ? ["all", "vulnerability", "exploited", "news"].includes(c.key) : true).map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`rounded-md border px-2 py-1 text-[10.5px] font-medium transition-colors ${
                category === c.key
                  ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                  : "border-[var(--ag-border)] text-[var(--ag-muted)] hover:text-white"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select className="ag-select !w-auto !py-1 !text-[11px]" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {PERIODS.map((p) => <option key={p} value={p}>Últimos {p} {p === 1 ? "dia" : "dias"}</option>)}
          </select>
          <Button size="sm" variant="ghost" onClick={() => load(days)} disabled={loading} title="Atualizar feed">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {error && <div className="mt-3"><ErrorBox message={error} retry={() => load(days)} /></div>}
      {loading && !items && <Spinner label="Agregando feeds públicos…" />}

      {filtered.length > 0 && (
        <ul className="mt-3 divide-y divide-[var(--ag-border)]">
          {filtered.map((item) => (
            <li key={item.id} className="py-2.5">
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-2">
                <span className="mt-1.5 shrink-0">
                  {item.category === "exploited" ? <Zap className="h-3.5 w-3.5 text-rose-400" />
                    : item.category === "vulnerability" ? <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                    : <Activity className="h-3.5 w-3.5 text-cyan-400" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[12.5px] font-medium text-[#e2ebf5] group-hover:text-cyan-300">{item.title}</span>
                    {item.severity && <Severity value={item.severity} />}
                  </span>
                  {item.detail && <span className="mt-0.5 block line-clamp-2 text-[11.5px] text-[var(--ag-muted)]">{item.detail}</span>}
                  <span className="ag-mono mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[var(--ag-faint)]">
                    <span>{formatDateOnly(item.date)}</span>
                    <span>·</span>
                    <span>{item.source}</span>
                    <ArrowUpRight className="h-2.5 w-2.5" />
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {items && filtered.length === 0 && !loading && (
        <div className="mt-3"><Empty title="Nenhum item no filtro selecionado" hint="Ajuste a categoria ou o período." /></div>
      )}

      {sources.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-[var(--ag-border)] pt-2">
          {sources.map((s) => (
            <span key={s.name} className="flex items-center gap-1 text-[10px] text-[var(--ag-faint)]" title={s.detail}>
              <span className={`h-1.5 w-1.5 rounded-full ${s.ok ? "bg-emerald-400" : "bg-rose-400"}`} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function FeedBadge({ count }: { count: number }) {
  return <Badge tone="cyan">{count} itens</Badge>;
}
