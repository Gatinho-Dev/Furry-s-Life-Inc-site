import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, CalendarClock, Globe, KeyRound, Layers, Link2, ShieldCheck, Waypoints } from "lucide-react";
import { domainLookup, dnsLookup, sslAnalyzer, subdomainFinder, waybackHistory, websiteAnalyzer } from "@/lib/agency/api/domain.functions";
import { QueryTool } from "@/components/agency/QueryTool";
import { Badge, Collapse, DataTable, Empty, KV, Notice, PageHeader, Panel, Severity, ValueView } from "@/components/agency/kit";
import { formatDate } from "@/lib/agency/format";

export const Route = createFileRoute("/agency/domain")({
  head: () => ({ meta: [{ title: "Domain Intelligence — Life Agency" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: DomainPage,
});

function DomainPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="OSINT · Superfície de domínio"
        title="Domain Intelligence"
        subtitle="Registro, DNS, Certificate Transparency, TLS público, análise técnica e histórico. Todas as consultas são feitas em fontes abertas, com cache curto e limites de uso respeitados."
        actions={<Badge tone="green"><BadgeCheck className="h-3 w-3" /> sem chave de API</Badge>}
      />

      <QueryTool
        title="Domain Lookup (RDAP)"
        description="Registrador, datas, status EPP, nameservers e resolução básica via RDAP + Google DNS."
        toolId="domain-lookup"
        toolName="Domain Lookup"
        source="rdap.org + Google DNS"
        placeholder="exemplo.com.br"
        cta="Consultar RDAP"
        attachKind="domain"
        render={(data) => {
          const rdap = data.rdap;
          if (!rdap) {
            return (
              <Notice tone="warn" title="Registro não retornado pelo RDAP">
                O RDAP não devolveu dados para este domínio. Isso é comum em alguns ccTLDs (inclusive .br em determinados registros).
                Os registros DNS abaixo continuam sendo dados reais.
                <div className="mt-2">
                  <KV cols={3} items={[
                    { label: "A", value: data.dns.a.join(", ") || "—" },
                    { label: "AAAA", value: data.dns.aaaa.join(", ") || "—" },
                    { label: "MX", value: data.dns.mx.join(", ") || "—" },
                    { label: "NS", value: data.dns.ns.join(", ") || "—" },
                  ]} />
                </div>
              </Notice>
            );
          }
          return (
            <div className="space-y-4">
              <KV
                items={[
                  { label: "Domínio", value: <span className="font-medium text-white">{rdap.name}</span> },
                  { label: "Handle", value: rdap.handle && <span className="ag-mono">{rdap.handle}</span> },
                  { label: "Registrador", value: rdap.registrar ?? "—" },
                  { label: "IANA ID", value: rdap.registrarIanaId },
                  { label: "Criado em", value: rdap.created ? formatDate(rdap.created) : "—" },
                  { label: "Expira em", value: rdap.expires ? formatDate(rdap.expires) : "—" },
                  { label: "Última alteração", value: rdap.updated ? formatDate(rdap.updated) : "—" },
                  { label: "DNSSEC", value: rdap.dnssec ?? "—" },
                  { label: "E-mail de abuso", value: rdap.abuseEmail },
                  { label: "Registro (fonte)", value: rdap.raw_url && <a className="ag-link text-[11.5px]" href={rdap.raw_url} target="_blank" rel="noreferrer">abrir JSON RDAP</a> },
                ]}
              />
              <div>
                <div className="ag-label mb-1.5">Nameservers</div>
                <div className="flex flex-wrap gap-1.5">
                  {(rdap.nameservers ?? []).length ? rdap.nameservers!.map((n: any) => (
                    <span key={n} className="ag-mono rounded-md border border-[var(--ag-border)] bg-black/30 px-1.5 py-0.5 text-[11px]">{n}</span>
                  )) : <span className="text-[11.5px] text-[var(--ag-faint)]">não informados</span>}
                </div>
              </div>
              <div>
                <div className="ag-label mb-1.5">Status EPP</div>
                <div className="flex flex-wrap gap-1">
                  {(rdap.status ?? []).map((s: any) => <Badge key={s} tone="blue">{s.replace(/([A-Z])/g, " $1").trim()}</Badge>)}
                </div>
              </div>
            </div>
          );
        }}
      />

      <QueryTool
        title="DNS Lookup"
        description="Todos os registros relevantes via DNS over HTTPS, incluindo DNSSEC e PTR."
        toolId="dns-lookup"
        toolName="DNS Lookup"
        source="DNS over HTTPS"
        placeholder="exemplo.com"
        cta="Consultar DNS"
        attachKind="domain"
        options={[{
          key: "resolver", label: "Resolver",
          values: [
            { value: "google", label: "Google Public DNS" },
            { value: "cloudflare", label: "Cloudflare 1.1.1.1" },
            { value: "adguard", label: "AdGuard DNS" },
          ],
        }]}
        run={(value, opts) => dnsLookup({ data: { domain: value, resolver: opts.resolver as "google" | "cloudflare" | "adguard" } })}
        render={(data) => (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={data.status === "NOERROR" ? "green" : "amber"}>{data.status}</Badge>
              <Badge tone={data.dnssecValidated ? "green" : "neutral"}>DNSSEC {data.dnssecValidated ? "validado" : "não validado"}</Badge>
              <span className="text-[11px] text-[var(--ag-faint)]">resolver: {data.resolver}</span>
            </div>
            {Object.keys(data.records).length === 0 ? (
              <Empty title="Nenhum registro retornado" hint="O domínio pode não existir (NXDOMAIN) ou não publicar esses tipos." />
            ) : (
              <div className="space-y-2">
                {Object.entries(data.records).map(([type, rows]) => (
                  <div key={type} className="rounded-lg border border-[var(--ag-border)]">
                    <div className="flex items-center justify-between border-b border-[var(--ag-border)] px-3 py-1.5">
                      <span className="ag-mono text-[11px] font-semibold text-cyan-300">{type}</span>
                      <span className="text-[10px] text-[var(--ag-faint)]">{rows.length} registro(s)</span>
                    </div>
                    <div className="p-2.5">
                      <ValueView value={rows.map((r) => r.value)} />
                      {type === "MX" && (
                        <div className="mt-1.5 text-[10.5px] text-[var(--ag-faint)]">prioridade primeiro: {rows[0]?.value}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      />

      <QueryTool
        title="Subdomain Finder"
        description="Subdomínios descobertos por Certificate Transparency (crt.sh), com data de primeira observação e emissor."
        toolId="subdomain-finder"
        toolName="Subdomain Finder"
        source="crt.sh"
        placeholder="exemplo.com"
        cta="Descobrir subdomínios"
        attachKind="domain"
        footer="O crt.sh pode demorar 10–30s em domínios grandes e ocasionalmente recusa consultas — nesse caso a mensagem de erro real é exibida."
        render={(data) => (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="cyan">{data.total} nomes únicos</Badge>
              <Badge tone="neutral">{data.certificates.length} certificados recentes</Badge>
            </div>
            <Collapse title={`Subdomínios encontrados (${data.subdomains.length})`} defaultOpen>
              {data.subdomains.length === 0 ? <Empty title="Nenhum subdomínio em CT para este domínio" /> : (
                <DataTable
                  rows={data.subdomains.map((s: any) => ({ subdomínio: s.name, "primeira observação": s.firstSeen ? formatDate(s.firstSeen) : "—", emissor: s.issuer ?? "—" }))}
                  maxRows={120}
                />
              )}
            </Collapse>
            <Collapse title="Certificados recentes">
              <DataTable
                rows={data.certificates.map((c: any) => ({ "nome comum": c.commonName, emissor: c.issuer, "válido de": c.notBefore?.slice(0, 10), "válido até": c.notAfter?.slice(0, 10) }))}
                maxRows={60}
              />
            </Collapse>
          </div>
        )}
      />

      <QueryTool
        title="SSL Analyzer"
        description="Certificados públicos emitidos para o domínio: emissor, validade, SANs e dias até expirar. Não realiza handshake TLS ativo."
        toolId="ssl-analyzer"
        toolName="SSL Analyzer"
        source="crt.sh"
        placeholder="exemplo.com"
        cta="Analisar certificados"
        attachKind="certificate"
        render={(data) => (
          <div className="space-y-2">
            {data.certificates.length === 0 ? <Empty title="Nenhum certificado público encontrado para este domínio exato" hint="Domínios sem HTTPS ou sem emissões registradas em CT não aparecem." /> : (
              data.certificates.slice(0, 12).map((c: any) => (
                <div key={c.id} className="rounded-lg border border-[var(--ag-border)] bg-black/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[12.5px] font-medium"><ShieldCheck className="h-3.5 w-3.5 text-cyan-300" /> {c.commonName}</div>
                    <div className="flex items-center gap-2">
                      {c.expired ? <Badge tone="rose">expirado</Badge> : <Badge tone={c.daysToExpiry < 30 ? "amber" : "green"}>{c.daysToExpiry} dias restantes</Badge>}
                    </div>
                  </div>
                  <div className="mt-2 grid gap-x-4 gap-y-1 text-[11px] text-[var(--ag-muted)] sm:grid-cols-2">
                    <div><span className="text-[var(--ag-faint)]">Emissor:</span> {c.issuer}</div>
                    <div><span className="text-[var(--ag-faint)]">Serial:</span> <span className="ag-mono">{c.serialNumber?.slice(0, 24) ?? "—"}</span></div>
                    <div><span className="text-[var(--ag-faint)]">Válido de:</span> {c.notBefore?.slice(0, 19).replace("T", " ")}</div>
                    <div><span className="text-[var(--ag-faint)]">Até:</span> {c.notAfter?.slice(0, 19).replace("T", " ")}</div>
                  </div>
                  {c.san.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.san.slice(0, 18).map((s: any) => <span key={s} className="ag-mono rounded border border-[var(--ag-border)] px-1 py-0.5 text-[10px] text-[#c2d2e3]">{s}</span>)}
                      {c.san.length > 18 && <span className="text-[10px] text-[var(--ag-faint)]">+{c.san.length - 18}</span>}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      />

      <QueryTool
        title="Website Analyzer"
        description="Status, cadeia de redirecionamentos, headers HTTP, tecnologias, meta tags, robots.txt, sitemap e hash do favicon."
        toolId="website-analyzer"
        toolName="Website Analyzer"
        source="HTTP direto"
        placeholder="https://exemplo.com"
        cta="Analisar site"
        attachKind="url"
        render={(data) => (
          <div className="space-y-4">
            <KV
              cols={3}
              items={[
                { label: "Status", value: <Badge tone={data.status < 400 ? "green" : "rose"}>{data.status} {data.statusText}</Badge> },
                { label: "URL final", value: <span className="ag-mono text-[11px]">{data.finalUrl}</span> },
                { label: "Servidor", value: data.headers.server },
                { label: "Title", value: data.title },
                { label: "Descrição", value: data.description },
                { label: "IP resolvido", value: data.serverIp },
                { label: "Favicon SHA-256", value: data.favicon?.sha256 && <span className="ag-mono break-all text-[10px]">{data.favicon.sha256}</span> },
                { label: "Tamanho HTML", value: `${(data.contentLength / 1024).toFixed(1)} KB${data.truncated ? " (truncado)" : ""}` },
                { label: "Redirects", value: data.chain.length },
              ]}
            />

            {data.chain.length > 1 && (
              <div>
                <div className="ag-label mb-1.5">Cadeia de redirecionamentos</div>
                <ol className="space-y-1">
                  {data.chain.map((c: any, i: any) => (
                    <li key={i} className="flex items-center gap-2 text-[11px]">
                      <span className="ag-mono text-[var(--ag-faint)]">{i + 1}.</span>
                      <Badge tone={c.status < 400 ? "green" : "rose"}>{c.status}</Badge>
                      <span className="ag-mono break-all text-[#c9d6e4]">{c.url}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div>
              <div className="ag-label mb-1.5">Tecnologias detectadas ({data.technologies.length})</div>
              <div className="flex flex-wrap gap-1.5">
                {data.technologies.length ? data.technologies.map((t: any) => (
                  <span key={t.name} title={t.evidence} className="rounded-md border border-cyan-400/25 bg-cyan-400/[0.07] px-1.5 py-0.5 text-[10.5px] text-cyan-200">
                    {t.name} <span className="text-cyan-200/40">· {t.category}</span>
                  </span>
                )) : <span className="text-[11px] text-[var(--ag-faint)]">nenhuma assinatura reconhecida</span>}
              </div>
            </div>

            <div>
              <div className="ag-label mb-1.5">Headers de segurança</div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {data.securityHeaders.map((h: any) => (
                  <div key={h.header} className="flex items-start gap-2 rounded-lg border border-[var(--ag-border)] px-2 py-1.5">
                    <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${h.present ? "bg-emerald-400" : "bg-rose-400"}`} />
                    <div className="min-w-0">
                      <div className="ag-mono text-[10.5px] text-[#cbd8e6]">{h.header}</div>
                      <div className="truncate text-[10px] text-[var(--ag-faint)]" title={h.value}>{h.value ?? "ausente"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {data.technologies.some((t: any) => t.name === "HSTS") && <span className="hidden"><Layers /></span>}

            <div className="grid gap-3 md:grid-cols-2">
              <Collapse title={`robots.txt ${data.robots?.ok ? "(" + data.robots.status + ")" : "(não disponível)"}`}>
                {data.robots ? <pre className="ag-mono max-h-64 overflow-auto whitespace-pre-wrap text-[10.5px] text-[#c3d1e0]">{data.robots.content || "(vazio)"}</pre> : <span className="text-[11px] text-[var(--ag-faint)]">Não foi possível consultar.</span>}
              </Collapse>
              <Collapse title={`sitemap.xml ${data.sitemap?.ok ? "(" + data.sitemap.entries + " URLs)" : "(não encontrado)"}`}>
                {data.sitemap ? (
                  <ul className="max-h-64 space-y-0.5 overflow-auto text-[10.5px]">
                    {data.sitemap.sample.map((u: any) => <li key={u}><a href={u} target="_blank" rel="noreferrer" className="ag-link break-all">{u}</a></li>)}
                  </ul>
                ) : <span className="text-[11px] text-[var(--ag-faint)]">Não foi possível consultar.</span>}
              </Collapse>
            </div>

            <Collapse title={`Todos os headers HTTP (${Object.keys(data.headers).length})`}>
              <DataTable rows={Object.entries(data.headers).map(([k, v]) => ({ header: k, valor: v }))} maxRows={40} />
            </Collapse>

            {data.h1.length > 0 && (
              <div>
                <div className="ag-label mb-1.5">H1 ({data.h1.length})</div>
                <ul className="list-inside list-disc text-[11.5px] text-[var(--ag-muted)]">{data.h1.map((h: any, i: any) => <li key={i}>{h}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      />

      <QueryTool
        title="Historical Domain Intelligence"
        description="Capturas arquivadas na Wayback Machine, com datas e links para as versões históricas."
        toolId="wayback"
        toolName="Wayback History"
        source="Internet Archive"
        placeholder="exemplo.com"
        cta="Buscar histórico"
        attachKind="domain"
        render={(data) => (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={data.totalCaptures ? "cyan" : "neutral"}>{data.totalCaptures} capturas retornadas</Badge>
              {data.closest?.available && (
                <a href={data.closest.url} target="_blank" rel="noreferrer" className="ag-link inline-flex items-center gap-1 text-[11.5px]">
                  <CalendarClock className="h-3 w-3" /> captura mais próxima: {data.closest.timestamp}
                </a>
              )}
            </div>
            {data.totalCaptures === 0 ? (
              <Empty title="Nenhuma captura encontrada" hint="O domínio pode nunca ter sido arquivado, ou o CDX não retornou registros com status 200." />
            ) : (
              <DataTable
                rows={data.captures.map((c: any) => ({
                  data: `${c.timestamp.slice(0, 4)}-${c.timestamp.slice(4, 6)}-${c.timestamp.slice(6, 8)}`,
                  url: c.url,
                  tipo: c.mimeType,
                  status: c.statusCode,
                }))}
                maxRows={80}
              />
            )}
          </div>
        )}
      />

      <Panel title="Escopo e limitações" icon={<Link2 className="h-3.5 w-3.5" />}>
        <ul className="space-y-1.5 text-[11.5px] leading-relaxed text-[var(--ag-muted)]">
          <li>• <strong className="text-[#dbe6f7]">RDAP</strong>: alguns ccTLDs (como .br) publicam dados por caminhos próprios; nesses casos o RDAP do rdap.org pode não retornar o registro.</li>
          <li>• <strong className="text-[#dbe6f7]">crt.sh</strong>: o Certificate Transparency registra nomes mesmo após expiração; um subdomínio listado pode não estar mais ativo.</li>
          <li>• <strong className="text-[#dbe6f7]">TLS</strong>: a análise descreve certificados públicos emitidos. A configuração TLS ativa (protocolos/cifras) não é inspecionada.</li>
          <li>• <strong className="text-[#dbe6f7]">Website Analyzer</strong>: faz uma requisição GET real ao site, com proteção anti-SSRF e limite de tamanho.</li>
        </ul>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-2 rounded-lg border border-[var(--ag-border)] px-2.5 py-2 text-[11px]"><Globe className="h-3.5 w-3.5 text-cyan-300" /> Fonte: rdap.org</div>
          <div className="flex items-center gap-2 rounded-lg border border-[var(--ag-border)] px-2.5 py-2 text-[11px]"><Waypoints className="h-3.5 w-3.5 text-cyan-300" /> Fonte: crt.sh</div>
          <div className="flex items-center gap-2 rounded-lg border border-[var(--ag-border)] px-2.5 py-2 text-[11px]"><KeyRound className="h-3.5 w-3.5 text-cyan-300" /> Google/Cloudflare/AdGuard DoH</div>
          <div className="flex items-center gap-2 rounded-lg border border-[var(--ag-border)] px-2.5 py-2 text-[11px]"><ShieldCheck className="h-3.5 w-3.5 text-cyan-300" /> Sem chave de API</div>
        </div>
      </Panel>
    </div>
  );
}
