import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, KeyRound, Link2, ShieldAlert, ShieldCheck } from "lucide-react";
import { safeBrowsingLookup, urlAnalyzer, urlhausLookup, virusTotalLookup } from "@/lib/agency/api/web.functions";
import { QueryTool } from "@/components/agency/QueryTool";
import { Badge, Collapse, DataTable, KV, Notice, PageHeader, Panel, Severity, ValueView, cx } from "@/components/agency/kit";

export const Route = createFileRoute("/agency/web")({
  head: () => ({ meta: [{ title: "Web & URL Intelligence — Life Agency" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: WebPage,
});

function RiskBar({ score }: { score: number }) {
  const tone = score >= 60 ? "from-rose-500 to-rose-400" : score >= 30 ? "from-amber-500 to-amber-400" : "from-emerald-500 to-emerald-400";
  return (
    <div>
      <div className="flex items-center justify-between text-[10.5px] text-[var(--ag-faint)]">
        <span>Indicadores heurísticos de risco</span>
        <span className="ag-mono">{score}/100</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
        <div className={cx("h-full rounded-full bg-gradient-to-r transition-all", tone)} style={{ width: `${Math.max(3, score)}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-[var(--ag-faint)]">Escore heurístico local, não um veredito. Correlacione com as fontes de reputação.</p>
    </div>
  );
}

function WebPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="OSINT · Conteúdo e reputação"
        title="Web & URL Intelligence"
        subtitle="Parse de URL, cadeia de redirecionamentos, headers de segurança, parâmetros suspeitos e reputação. A análise é feita sem renderizar a página no seu navegador."
        actions={<Badge tone="green">anti-SSRF</Badge>}
      />

      <Notice tone="info" title="Proteção contra SSRF">
        O servidor bloqueia destinos privados, loopback, link-local e metadados de nuvem, revalidando cada salto de redirecionamento.
      </Notice>

      <QueryTool
        title="URL Analysis"
        description="Tudo em uma consulta: normalização, parâmetros, redirecionamentos, headers, tecnologias implícitas e indicadores de phishing."
        toolId="url-analyzer"
        toolName="URL Analysis"
        source="HTTP direto + heurísticas"
        placeholder="https://exemplo.com/caminho?param=valor"
        cta="Analisar URL"
        attachKind="url"
        render={(data) => (
          <div className="space-y-4">
            <RiskBar score={data.riskScore} />
            <KV
              cols={3}
              items={[
                { label: "Protocolo", value: data.parsed.protocol.toUpperCase() },
                { label: "Host", value: <span className="ag-mono">{data.parsed.host}</span> },
                { label: "Domínio registrável", value: <span className="ag-mono">{data.parsed.registrableDomain}</span> },
                { label: "Porta", value: data.parsed.port },
                { label: "Caminho", value: <span className="ag-mono break-all text-[11px]">{data.parsed.path}</span> },
                { label: "Status final", value: <Badge tone={data.status && data.status < 400 ? "green" : "rose"}>{data.status || "sem resposta"}</Badge> },
                { label: "Title", value: data.title },
                { label: "Server", value: data.server },
                { label: "Tamanho", value: `${(data.contentLength / 1024).toFixed(1)} KB` },
                { label: "Encurtador", value: data.isShortened ? data.shortenerName : "não" },
                { label: "Host é IP", value: data.parsed.isIpHost },
                { label: "URL final", value: <span className="ag-mono break-all text-[10.5px]">{data.finalUrl}</span> },
              ]}
            />

            <div>
              <div className="ag-label mb-1.5">Indicadores ({data.indicators.length})</div>
              {data.indicators.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] px-2.5 py-2 text-[11.5px] text-emerald-200">
                  <ShieldCheck className="h-3.5 w-3.5" /> Nenhum indicador heurístico óbvio. Isso não atesta legitimidade.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {data.indicators.map((i: any, idx: any) => (
                    <li key={idx} className="flex items-start gap-2 rounded-lg border border-[var(--ag-border)] px-2.5 py-1.5">
                      <AlertTriangle className={cx("mt-0.5 h-3.5 w-3.5 shrink-0", i.severity === "high" ? "text-rose-400" : i.severity === "medium" ? "text-amber-400" : "text-cyan-400")} />
                      <div className="min-w-0">
                        <div className="text-[11.5px] font-medium text-[#dde8f4]">{i.label} <Severity value={i.severity} /></div>
                        <div className="text-[10.5px] text-[var(--ag-muted)]">{i.detail}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {data.queryParams.length > 0 && (
              <div>
                <div className="ag-label mb-1.5">Parâmetros de consulta</div>
                <DataTable rows={data.queryParams.map((p: any) => ({ parâmetro: p.key, valor: p.value, suspeito: p.suspicious ? "sim" : "não" }))} />
              </div>
            )}

            {data.redirectChain.length > 1 && (
              <Collapse title={`Cadeia de redirecionamentos (${data.redirectChain.length})`} defaultOpen>
                <ol className="space-y-1">
                  {data.redirectChain.map((c: any, i: any) => (
                    <li key={i} className="flex items-center gap-2 text-[11px]">
                      <span className="ag-mono text-[var(--ag-faint)]">{i + 1}.</span>
                      <Badge tone={c.status < 400 ? "green" : "rose"}>{c.status}</Badge>
                      <span className="ag-mono break-all text-[#c9d6e4]">{c.url}</span>
                    </li>
                  ))}
                </ol>
              </Collapse>
            )}

            <div>
              <div className="ag-label mb-1.5">HTTP Security Headers</div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {data.securityHeaders.map((h: any) => (
                  <div key={h.header} className="flex items-start gap-2 rounded-lg border border-[var(--ag-border)] px-2 py-1.5">
                    <span className={cx("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", h.present ? "bg-emerald-400" : "bg-rose-400")} />
                    <div className="min-w-0">
                      <div className="ag-mono text-[10.5px] text-[#cbd8e6]">{h.header}</div>
                      <div className="truncate text-[10px] text-[var(--ag-faint)]" title={h.value}>{h.value ?? "ausente"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Collapse title={`Headers retornados (${Object.keys(data.headers).length})`}>
              <DataTable rows={Object.entries(data.headers).map(([k, v]) => ({ header: k, valor: v }))} maxRows={40} />
            </Collapse>
          </div>
        )}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <QueryTool
          title="URLhaus Lookup"
          description="Consulta de URL/host na base comunitária de distribuição de malware do abuse.ch."
          toolId="urlhaus-url"
          toolName="URLhaus Lookup"
          source="abuse.ch"
          placeholder="http://exemplo.com/arquivo.exe ou host"
          cta="Consultar URLhaus"
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
          title="VirusTotal (opcional)"
          description="Reputação multi-engine. Funciona apenas com chave configurada no API Center."
          toolId="virustotal"
          toolName="VirusTotal"
          source="VirusTotal"
          placeholder="https://exemplo.com · dominio.com · 8.8.8.8"
          cta="Consultar VT"
          render={(data) => {
            if (!data.available) {
              return (
                <Notice tone="warn" title="Chave opcional">
                  {data.reason}
                  <div className="mt-2"><a href={data.signup} target="_blank" rel="noreferrer" className="ag-link inline-flex items-center gap-1 text-[11px]"><KeyRound className="h-3 w-3" /> Obter chave gratuita</a></div>
                </Notice>
              );
            }
            const stats = data.stats as Record<string, number> | null;
            return (
              <div className="space-y-2">
                {stats ? (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(stats).map(([k, v]) => (
                      <Badge key={k} tone={k === "malicious" && v > 0 ? "rose" : k === "suspicious" && v > 0 ? "amber" : "neutral"}>{k}: {v}</Badge>
                    ))}
                  </div>
                ) : <Notice tone="info">Sem estatísticas retornadas para este alvo.</Notice>}
                <KV items={[{ label: "Reputação", value: data.reputation as number }, { label: "Última análise", value: data.lastAnalysis ? new Date(Number(data.lastAnalysis) * 1000).toLocaleString("pt-BR") : "—" }]} />
              </div>
            );
          }}
        />

        <QueryTool
          title="Google Safe Browsing (opcional)"
          description="Verificação contra as listas do Google. Requer chave gratuita com cota diária."
          toolId="safe-browsing"
          toolName="Safe Browsing"
          source="Google"
          placeholder="https://exemplo.com"
          cta="Verificar URL"
          render={(data) => {
            if (!data.available) {
              return (
                <Notice tone="warn" title="Chave opcional">
                  {data.reason}
                  <div className="mt-2"><a href={data.signup} target="_blank" rel="noreferrer" className="ag-link inline-flex items-center gap-1 text-[11px]"><KeyRound className="h-3 w-3" /> Configurar chave</a></div>
                </Notice>
              );
            }
            return data.safe ? (
              <Notice tone="ok" title="Sem correspondência">A URL não consta nas listas consultadas.</Notice>
            ) : (
              <Notice tone="warn" title="Correspondência encontrada"><ValueView value={data.matches} /></Notice>
            );
          }}
        />

        <Panel title="Análise de encurtadores e redirecionamentos" icon={<Link2 className="h-3.5 w-3.5" />} description="Como interpretar os resultados.">
          <ul className="space-y-2 text-[11.5px] leading-relaxed text-[var(--ag-muted)]">
            <li>• O URL Analysis segue redirecionamentos no servidor (máx. 5 saltos) e mostra a URL final, sem executar JavaScript.</li>
            <li>• Encurtadores são identificados pelo domínio registrável; o destino real aparece em “URL final”.</li>
            <li>• Parâmetros como <span className="ag-mono text-[10.5px]">url=</span>, <span className="ag-mono text-[10.5px]">redirect=</span> e <span className="ag-mono text-[10.5px]">token=</span> elevam o risco por permitirem redirecionamentos e vazamento de dados.</li>
            <li>• Nenhuma URL é aberta no seu navegador durante a análise.</li>
          </ul>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-[var(--ag-border)] px-2.5 py-2 text-[11px]">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-300" /> Reputação de fontes comunitárias é indicativa, não conclusiva.
          </div>
        </Panel>
      </div>
    </div>
  );
}
