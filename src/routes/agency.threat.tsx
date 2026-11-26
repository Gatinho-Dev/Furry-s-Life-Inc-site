import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, KeyRound, Radar, ShieldAlert, Zap } from "lucide-react";
import { otxIndicator, threatFoxLookup } from "@/lib/agency/api/cyber.functions";
import { QueryTool } from "@/components/agency/QueryTool";
import { IntelligenceFeed } from "@/components/agency/Feed";
import { Badge, Notice, PageHeader, Panel, ValueView } from "@/components/agency/kit";

export const Route = createFileRoute("/agency/threat")({
  head: () => ({ meta: [{ title: "Threat Intelligence — Life Agency" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: ThreatPage,
});

function ThreatPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Cyber · Indicadores"
        title="Threat Intelligence"
        subtitle="Feeds públicos de vulnerabilidades exploradas, avisos oficiais, notícias e indicadores de comprometimento. Filtre por categoria e período; cada item aponta para a fonte original."
        actions={<Badge tone="cyan"><Radar className="h-3 w-3" /> feeds ao vivo</Badge>}
      />

      <Panel title="Intelligence Feed" description="Agregação em tempo real de NVD, CISA KEV, CISA Advisories, The Hacker News, BleepingComputer e abuse.ch (quando configurado).">
        <IntelligenceFeed />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <QueryTool
          title="ThreatFox IOC Search"
          description="Consulta IOCs de C2 comunitários por valor (IP, domínio, URL ou hash) ou lista os mais recentes."
          toolId="threatfox"
          toolName="ThreatFox Search"
          source="abuse.ch ThreatFox"
          placeholder="deixe vazio para os IOCs recentes · ou 45.155.205.233"
          cta="Consultar ThreatFox"
          attachKind="hash"
          run={(v) => threatFoxLookup({ data: { ioc: v || undefined, recentDays: 1 } })}
          render={(data) => {
            if (!data.available) {
              return (
                <Notice tone="warn" title="Dependência externa">
                  {data.reason}
                  <div className="mt-2"><a href={data.signup} target="_blank" rel="noreferrer" className="ag-link inline-flex items-center gap-1 text-[11px]"><KeyRound className="h-3 w-3" /> Criar Auth-Key gratuita</a></div>
                </Notice>
              );
            }
            return <ValueView value={data.data} />;
          }}
        />

        <QueryTool
          title="OTX Threat Search"
          description="Pulsos comunitários da AlienVault OTX — endpoint público, sem chave."
          toolId="otx"
          toolName="OTX Indicator"
          source="AlienVault OTX"
          placeholder="dominio-suspeito.com"
          cta="Buscar indicador"
          render={(data) => {
            if (!data.available) return <Notice tone="warn" title="Consulta indisponível">{data.reason}</Notice>;
            return (
              <div className="space-y-2">
                <Badge tone={data.pulseCount ? "amber" : "green"}>{data.pulseCount} pulsos comunitários</Badge>
                {data.pulses.length > 0 ? (
                  <ul className="space-y-1">
                    {data.pulses.map((p: any) => (
                      <li key={`${p.name}-${p.modified}`} className="rounded-lg border border-[var(--ag-border)] px-2 py-1.5 text-[11.5px]">
                        <div className="text-[#dbe6f4]">{p.name}</div>
                        <div className="text-[10px] text-[var(--ag-faint)]">{p.modified?.slice(0, 10)} · {(p.tags ?? []).slice(0, 6).join(", ")}</div>
                      </li>
                    ))}
                  </ul>
                ) : <Notice tone="ok">Sem pulsos para este indicador. Ausência de reporte não garante legitimidade.</Notice>}
              </div>
            );
          }}
        />
      </div>

      <Panel title="Como interpretar indicadores" icon={<ShieldAlert className="h-3.5 w-3.5" />}>
        <div className="grid gap-4 text-[11.5px] leading-relaxed text-[var(--ag-muted)] md:grid-cols-3">
          <div>
            <div className="mb-1 flex items-center gap-2 font-semibold text-[#dce8f5]"><Zap className="h-3.5 w-3.5 text-rose-400" /> KEV</div>
            <p>Entrar no catálogo da CISA significa exploração ativa confirmada com evidência pública. Priorize remediação.</p>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2 font-semibold text-[#dce8f5]"><Activity className="h-3.5 w-3.5 text-cyan-400" /> EPSS</div>
            <p>Probabilidade estimada de exploração em 30 dias. Complementa o CVSS (impacto), não o substitui.</p>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2 font-semibold text-[#dce8f5]"><Radar className="h-3.5 w-3.5 text-amber-400" /> IOCs</div>
            <p>Indicadores envelhecem rápido. Sempre verifique data de primeira observação e confiança da fonte.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/agency/cyber" className="ag-btn ag-btn-ghost !text-[11px]">Detalhar uma CVE</Link>
          <Link to="/agency/web" className="ag-btn ag-btn-ghost !text-[11px]">Analisar URL suspeita</Link>
          <Link to="/agency/graph" search={{ case: undefined }} className="ag-btn ag-btn-ghost !text-[11px]">Correlacionar em grafo</Link>
        </div>
      </Panel>
    </div>
  );
}
