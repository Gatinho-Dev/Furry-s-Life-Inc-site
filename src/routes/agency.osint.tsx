import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, BookOpen, ExternalLink, Filter, Search } from "lucide-react";
import { FRAMEWORK, type FrameworkEntry } from "@/lib/agency/catalog";
import { Badge, Empty, Notice, PageHeader, Panel, Stat, cx } from "@/components/agency/kit";

export const Route = createFileRoute("/agency/osint")({
  head: () => ({ meta: [{ title: "OSINT Framework — Life Agency" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: OsintPage,
});

const ACCESS_LABEL: Record<string, string> = {
  free: "Gratuito, sem chave",
  "key-optional": "Gratuito, chave opcional",
  client: "Processamento local",
  link: "Acesso via site oficial",
};

const STATUS_TONE: Record<string, "green" | "amber" | "neutral" | "rose"> = {
  available: "green",
  limited: "amber",
  external: "neutral",
  paid: "rose",
};

const STATUS_LABEL: Record<string, string> = {
  available: "Disponível",
  limited: "Uso limitado",
  external: "Externo (site)",
  paid: "Pago",
};

function OsintPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [access, setAccess] = useState("all");

  const categories = useMemo(() => ["all", ...new Set(FRAMEWORK.map((f) => f.category))], []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FRAMEWORK.filter((f) => {
      if (category !== "all" && f.category !== category) return false;
      if (access !== "all" && f.access !== access) return false;
      if (q && !`${f.name} ${f.description} ${f.category}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, category, access]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Biblioteca interna"
        title="OSINT Framework"
        subtitle="Catálogo curado de fontes e ferramentas com categoria, link oficial, tipo de acesso, dependência de chave, disponibilidade e limitações conhecidas."
        actions={<Badge tone="cyan"><BookOpen className="h-3 w-3" /> {FRAMEWORK.length} entradas</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Fontes catalogadas" value={FRAMEWORK.length} tone="cyan" />
        <Stat label="Sem chave de API" value={FRAMEWORK.filter((f) => !f.needsKey).length} hint="funcionam imediatamente" />
        <Stat label="Integradas na plataforma" value={FRAMEWORK.filter((f) => f.internal).length} hint="executam consultas reais" />
        <Stat label="Com limitação documentada" value={FRAMEWORK.filter((f) => f.limitations).length} tone="amber" />
      </div>

      <Panel>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <label className="ag-label mb-1.5 block">Pesquisar</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ag-faint)]" />
              <input className="ag-input !pl-8" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="nome, descrição ou categoria" />
            </div>
          </div>
          <div className="min-w-[190px]">
            <label className="ag-label mb-1.5 block">Categoria</label>
            <select className="ag-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => <option key={c} value={c}>{c === "all" ? "Todas" : c}</option>)}
            </select>
          </div>
          <div className="min-w-[190px]">
            <label className="ag-label mb-1.5 block">Tipo de acesso</label>
            <select className="ag-select" value={access} onChange={(e) => setAccess(e.target.value)}>
              <option value="all">Todos</option>
              <option value="free">Gratuito sem chave</option>
              <option value="key-optional">Chave opcional</option>
              <option value="client">Processamento local</option>
              <option value="link">Site oficial</option>
            </select>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[var(--ag-faint)]"><Filter className="h-3.5 w-3.5" /> {filtered.length} resultados</div>
        </div>
      </Panel>

      {filtered.length === 0 ? <Empty title="Nenhuma fonte com esses filtros" hint="Ajuste a busca ou selecione outra categoria." /> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((f) => <FrameworkCard key={f.name} entry={f} />)}
        </div>
      )}

      <Notice tone="info" title="Curadoria honesta">
        Todo item indica explicitamente se exige chave, se é apenas um link externo ou se o processamento acontece localmente. Nada aqui promete integração inexistente.
      </Notice>
    </div>
  );
}

function FrameworkCard({ entry }: { entry: FrameworkEntry }) {
  return (
    <article className="ag-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-[#e6eef8]">{entry.name}</h3>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-[var(--ag-faint)]">{entry.category}</div>
        </div>
        <Badge tone={STATUS_TONE[entry.status]}>{STATUS_LABEL[entry.status]}</Badge>
      </div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--ag-muted)]">{entry.description}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-[10.5px]">
        <div><dt className="ag-label">Acesso</dt><dd className="mt-0.5 text-[#c9d7e6]">{ACCESS_LABEL[entry.access]}</dd></div>
        <div><dt className="ag-label">API Key</dt><dd className="mt-0.5"><span className={cx(entry.needsKey ? "text-amber-300" : "text-emerald-300")}>{entry.needsKey ? "necessária" : "não necessária"}</span></dd></div>
      </dl>
      {entry.limitations && (
        <p className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.05] px-2 py-1.5 text-[10.5px] leading-snug text-amber-200/85">
          Limitação: {entry.limitations}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={entry.url} target="_blank" rel="noreferrer" className="ag-btn ag-btn-ghost !px-2 !py-1 !text-[10.5px]">
          Site oficial <ExternalLink className="h-2.5 w-2.5" />
        </a>
        {entry.internal && (
          <Link to={entry.internal} className="ag-btn !px-2 !py-1 !text-[10.5px]">
            Abrir ferramenta <ArrowUpRight className="h-2.5 w-2.5" />
          </Link>
        )}
      </div>
    </article>
  );
}
