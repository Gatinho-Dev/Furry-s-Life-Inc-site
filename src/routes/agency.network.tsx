import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, GitBranch, Network, Router } from "lucide-react";
import { asnLookup, bgpLookup, dnsPropagation } from "@/lib/agency/api/ip.functions";
import { QueryTool } from "@/components/agency/QueryTool";
import { Badge, Collapse, DataTable, KV, Notice, PageHeader, Panel, ValueView } from "@/components/agency/kit";
import { SubnetCalculator } from "@/components/agency/NetCalc";

export const Route = createFileRoute("/agency/network")({
  head: () => ({ meta: [{ title: "Network Intelligence — Life Agency" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: NetworkPage,
});

function NetworkPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="OSINT · Roteamento e DNS"
        title="Network Intelligence"
        subtitle="ASNs, prefixos anunciados, vizinhos de rede, status de roteamento e propagação DNS entre resolvers públicos. Consultas passivas a bases públicas — sem varredura de portas."
        actions={<Badge tone="green">RIPEstat · DoH</Badge>}
      />

      <QueryTool
        title="ASN Lookup"
        description="Detalhes do sistema autônomo, prefixos anunciados e vizinhos BGP (RIPEstat)."
        toolId="asn-lookup"
        toolName="ASN Lookup"
        source="RIPEstat"
        placeholder="AS15169"
        cta="Consultar ASN"
        attachKind="asn"
        run={(v) => asnLookup({ data: { asn: v } })}
        render={(data) => (
          <div className="space-y-4">
            <KV
              cols={3}
              items={[
                { label: "ASN", value: <span className="ag-mono text-cyan-300">{data.asn}</span> },
                { label: "Holder", value: data.holder },
                { label: "Anunciado", value: <Badge tone={data.announced ? "green" : "amber"}>{data.announced ? "sim" : "não"}</Badge> },
                { label: "Tipo", value: data.type },
                { label: "Prefixos anunciados", value: data.prefixes.length },
                { label: "Vizinhos", value: data.neighbours.length },
              ]}
            />
            <Collapse title={`Prefixos anunciados (${data.prefixes.length})`} defaultOpen={data.prefixes.length < 25}>
              <ValueView value={data.prefixes} />
            </Collapse>
            <Collapse title={`Vizinhos BGP (${data.neighbours.length})`}>
              <DataTable rows={data.neighbours.map((n) => ({ asn: n.asn, direção: n.type, força: n.power }))} maxRows={40} />
            </Collapse>
            <div className="flex flex-wrap gap-2">
              {data.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="ag-btn ag-btn-ghost !text-[11px]">{l.label}</a>)}
            </div>
          </div>
        )}
      />

      <QueryTool
        title="BGP Prefix Lookup"
        description="Prefixo de origem, ASNs, visibilidade entre peers RIPE RIS e último update."
        toolId="bgp-lookup"
        toolName="BGP Prefix Lookup"
        source="RIPEstat"
        placeholder="8.8.8.8 ou 8.8.8.0/24"
        cta="Consultar rota"
        attachKind="ip"
        run={(v) => bgpLookup({ data: { resource: v } })}
        render={(data) => (
          <div className="space-y-3">
            <KV
              cols={3}
              items={[
                { label: "Prefixo", value: <span className="ag-mono">{data.prefix ?? "—"}</span> },
                { label: "ASN de origem", value: data.originAsns.length ? data.originAsns.join(", ") : "—" },
                { label: "Visibilidade", value: data.visibility ? `${data.visibility.seenBy ?? "?"}/${data.visibility.total ?? "?"} peers` : "—" },
                { label: "Última atualização", value: data.lastUpdate },
                { label: "Holders", value: data.holders.map((h) => h.holder).join(", ") },
              ]}
            />
            {data.announcedPrefixes.length > 0 && (
              <Collapse title={`Prefixos do ASN de origem (${data.announcedPrefixes.length})`}>
                <ValueView value={data.announcedPrefixes.map((p) => p.prefix)} />
              </Collapse>
            )}
            <div className="flex flex-wrap gap-2">
              {data.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="ag-btn ag-btn-ghost !text-[11px]">{l.label}</a>)}
            </div>
          </div>
        )}
      />

      <QueryTool
        title="DNS Propagation Checker"
        description="Compara a mesma consulta em Google Public DNS, Cloudflare e AdGuard para detectar divergências de propagação."
        toolId="dns-propagation"
        toolName="DNS Propagation Checker"
        source="Google + Cloudflare + AdGuard"
        placeholder="exemplo.com"
        cta="Comparar resolvers"
        attachKind="domain"
        options={[{
          key: "type", label: "Tipo", initial: "A",
          values: ["A", "AAAA", "MX", "TXT", "NS", "CNAME", "CAA"].map((v) => ({ value: v, label: v })),
        }]}
        run={(v, o) => dnsPropagation({ data: { domain: v, type: o.type as "A" } })}
        render={(data) => (
          <div className="space-y-3">
            <Badge tone={data.consistent ? "green" : "amber"}>
              {data.consistent ? "Respostas consistentes" : "Divergência entre resolvers"}
            </Badge>
            <div className="grid gap-2 md:grid-cols-3">
              {data.results.map((r) => (
                <div key={r.resolver} className="rounded-xl border border-[var(--ag-border)] bg-black/20 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px] font-medium">{r.resolver}</span>
                    <Badge tone={r.ok ? "green" : "rose"}>{r.status}</Badge>
                  </div>
                  <div className="mt-2 space-y-1">
                    {r.values.length ? r.values.map((v, i) => (
                      <div key={i} className="ag-mono break-all rounded bg-white/[0.03] px-1.5 py-0.5 text-[10.5px]">{v}</div>
                    )) : <span className="text-[10.5px] text-[var(--ag-faint)]">sem resposta</span>}
                  </div>
                  {r.ttl !== undefined && <div className="mt-1.5 text-[10px] text-[var(--ag-faint)]">TTL {r.ttl}s</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <SubnetCalculator title="IPv4 / IPv6 Subnet Calculator" />
        <Panel title="Análise de infraestrutura" description="Como correlacionar os dados de rede." icon={<GitBranch className="h-3.5 w-3.5" />}>
          <ul className="space-y-2 text-[11.5px] leading-relaxed text-[var(--ag-muted)]">
            <li className="flex gap-2"><Router className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" /> Um ASN pode anunciar centenas de prefixos; use <Link to="/agency/ip" className="ag-link">IP Intelligence</Link> para o prefixo exato de um host.</li>
            <li className="flex gap-2"><Network className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" /> Vizinhos BGP indicam relações de trânsito/peering — não provam propriedade da infraestrutura.</li>
            <li className="flex gap-2"><Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" /> Divergência de DNS pode indicar cache, qualquercast ou configuração regional — não necessariamente comprometimento.</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href="https://bgp.tools" target="_blank" rel="noreferrer" className="ag-btn ag-btn-ghost !text-[11px]">BGP.tools</a>
            <a href="https://stat.ripe.net" target="_blank" rel="noreferrer" className="ag-btn ag-btn-ghost !text-[11px]">RIPEstat</a>
            <a href="https://www.peeringdb.com" target="_blank" rel="noreferrer" className="ag-btn ag-btn-ghost !text-[11px]">PeeringDB</a>
          </div>
        </Panel>
      </div>

      <Notice tone="info" title="Sem ações invasivas">
        Esta plataforma não realiza varredura de portas, exploração de serviços, nem acesso não autorizado a redes. Todas as informações vêm de bases públicas de roteamento e DNS.
      </Notice>
    </div>
  );
}
