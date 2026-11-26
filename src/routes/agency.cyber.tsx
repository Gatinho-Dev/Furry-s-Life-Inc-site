import { createFileRoute } from "@tanstack/react-router";
import { Bug, Flame, KeyRound, PackageSearch, ShieldAlert, Terminal } from "lucide-react";
import { cveLookup, cveSearch, hashLookup, kevSearch, osvQuery, otxIndicator } from "@/lib/agency/api/cyber.functions";
import { websiteAnalyzer } from "@/lib/agency/api/domain.functions";
import { QueryTool } from "@/components/agency/QueryTool";
import { Badge, Collapse, DataTable, KV, Notice, PageHeader, Panel, Severity, ValueView, cx } from "@/components/agency/kit";
import { CvssCalculator, HashCalculator, YaraViewer } from "@/components/agency/CyberTools";
import { formatDate } from "@/lib/agency/format";

export const Route = createFileRoute("/agency/cyber")({
  head: () => ({ meta: [{ title: "Cyber Intelligence — Life Agency" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: CyberPage,
});

function CyberPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Cyber · Vulnerabilidades e malware"
        title="Cyber Intelligence"
        subtitle="CVE, CVSS, CISA KEV, EPSS, OSV, malware por hash e verificação de headers. Dados oficiais (NIST, CISA, FIRST, OSV) e abuse.ch quando a chave gratuita está configurada."
        actions={<Badge tone="green">NVD · KEV · OSV</Badge>}
      />

      <QueryTool
        title="CVE Lookup"
        description="Detalhes completos do NVD + verificação no catálogo CISA KEV + probabilidade de exploração EPSS."
        toolId="cve-lookup"
        toolName="CVE Lookup"
        source="NND + KEV + EPSS"
        placeholder="CVE-2021-44228"
        cta="Consultar CVE"
        attachKind="cve"
        render={(data) => (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-lg font-bold">{data.cve}</span>
              {data.metrics?.score !== undefined && (
                <Badge tone={data.metrics.score >= 9 ? "rose" : data.metrics.score >= 7 ? "amber" : "cyan"}>
                  CVSS {data.metrics.score} · {data.metrics.severity}
                </Badge>
              )}
              {data.kev && <Badge tone="rose"><Flame className="h-2.5 w-2.5" /> explorada ativamente</Badge>}
              {data.epss && <Badge tone="violet">EPSS {(data.epss.score * 100).toFixed(1)}%</Badge>}
            </div>

            {!data.found && <Notice tone="warn" title="CVE não encontrada no NVD">Verifique o identificador. O NVD pode não ter publicado a entrada ainda.</Notice>}

            {data.description && <p className="rounded-xl border border-[var(--ag-border)] bg-black/20 p-3 text-[12px] leading-relaxed text-[#d3dfec]">{data.description}</p>}

            <KV
              cols={3}
              items={[
                { label: "Publicado", value: data.published ? formatDate(data.published) : "—" },
                { label: "Última modificação", value: data.lastModified ? formatDate(data.lastModified) : "—" },
                { label: "Status", value: data.status },
                { label: "Vetor CVSS", value: data.metrics?.vector && <span className="ag-mono break-all text-[10px]">{data.metrics.vector}</span> },
                { label: "EPSS percentil", value: data.epss ? `${(data.epss.percentile * 100).toFixed(1)}%` : undefined },
                { label: "CWE", value: data.weaknesses.join(", ") },
              ]}
            />

            {data.kev && (
              <div className="rounded-xl border border-rose-500/35 bg-rose-500/[0.07] p-3">
                <div className="flex items-center gap-2 text-[12px] font-semibold text-rose-200"><Flame className="h-3.5 w-3.5" /> CISA KEV — exploração confirmada</div>
                <div className="mt-2 grid gap-x-4 gap-y-1 text-[11.5px] text-rose-100/85 sm:grid-cols-2">
                  <div><span className="text-rose-200/60">Produto:</span> {data.kev.vendorProject} {data.kev.product}</div>
                  <div><span className="text-rose-200/60">Adicionado:</span> {data.kev.dateAdded}</div>
                  <div><span className="text-rose-200/60">Prazo de remediação:</span> {data.kev.dueDate}</div>
                  <div><span className="text-rose-200/60">Ransomware:</span> {data.kev.knownRansomwareCampaignUse}</div>
                </div>
                <p className="mt-2 text-[11px] text-rose-100/80">{data.kev.shortDescription}</p>
                <p className="mt-1 text-[11px] text-rose-100/70"><strong>Ação exigida:</strong> {data.kev.requiredAction}</p>
              </div>
            )}

            {data.affectedCpe.length > 0 && (
              <Collapse title={`CPEs vulneráveis (${data.affectedCpe.length})`}>
                <ValueView value={data.affectedCpe} />
              </Collapse>
            )}

            {data.references.length > 0 && (
              <div>
                <div className="ag-label mb-1.5">Referências</div>
                <ul className="space-y-1">
                  {data.references.slice(0, 10).map((r: any) => (
                    <li key={r.url} className="flex items-start gap-2 text-[11px]">
                      <a href={r.url} target="_blank" rel="noreferrer" className="ag-link break-all">{r.url}</a>
                      {r.tags.map((t: any) => <Badge key={t}>{t}</Badge>)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <a href={`https://nvd.nist.gov/vuln/detail/${data.cve}`} target="_blank" rel="noreferrer" className="ag-btn ag-btn-ghost !text-[11px]">NVD</a>
              <a href={`https://www.cve.org/CVERecord?id=${data.cve}`} target="_blank" rel="noreferrer" className="ag-btn ag-btn-ghost !text-[11px]">CVE.org</a>
              <a href={`https://www.cisa.gov/known-exploited-vulnerabilities-catalog`} target="_blank" rel="noreferrer" className="ag-btn ag-btn-ghost !text-[11px]">CISA KEV</a>
            </div>
          </div>
        )}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <QueryTool
          title="NVD Search"
          description="Busca por produto, fornecedor ou palavra-chave na base oficial."
          toolId="cve-search"
          toolName="NVD Search"
          source="NIST NVD"
          placeholder="apache log4j · cisco ios · wordpress plugin"
          cta="Buscar no NVD"
          render={(data) => (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <Badge tone="cyan">{data.total.toLocaleString("pt-BR")} resultados</Badge>
                <span className="text-[var(--ag-faint)]">exibindo {data.results.length}</span>
              </div>
              <DataTable
                rows={data.results.map((r: any) => ({ cve: r.cve, score: r.score ?? "—", severidade: r.severity ?? "—", publicado: r.published?.slice(0, 10), status: r.status, descrição: r.description.slice(0, 160) }))}
                maxRows={20}
              />
            </div>
          )}
        />

        <QueryTool
          title="CISA KEV Lookup"
          description="Pesquisa no catálogo de vulnerabilidades efetivamente exploradas."
          toolId="kev"
          toolName="CISA KEV Search"
          source="CISA"
          placeholder="vazio para as mais recentes · ou 'ivanti', 'cisco', 'CVE-2024-…'"
          cta="Consultar catálogo"
          run={(v) => kevSearch({ data: { query: v || undefined, limit: 40 } })}
          render={(data) => (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <Badge tone="cyan">{data.matched} entradas</Badge>
                <span className="text-[var(--ag-faint)]">catálogo v{data.catalogVersion} · {data.totalInCatalog} CVEs</span>
              </div>
              <DataTable
                rows={data.entries.map((e) => ({ cve: e.cveID, produto: `${e.vendorProject} ${e.product}`, adicionado: e.dateAdded, ransomware: e.knownRansomwareCampaignUse }))}
                maxRows={30}
              />
            </div>
          )}
        />
      </div>

      <QueryTool
        title="OSV Vulnerability Database"
        description="Vulnerabilidades de pacotes open-source em npm, PyPI, Go, crates.io, Maven e outros."
        toolId="osv"
        toolName="OSV Query"
        source="OSV.dev"
        placeholder="lodash 4.17.20"
        cta="Consultar OSV"
        options={[{
          key: "ecosystem", label: "Ecossistema", initial: "npm",
          values: ["npm", "PyPI", "Go", "crates.io", "Maven", "NuGet", "RubyGems", "Packagist", "Pub", "Hex"].map((v) => ({ value: v, label: v })),
        }]}
        run={(v, o) => {
          const idx = v.lastIndexOf(" ");
          const name = idx > 0 ? v.slice(0, idx).trim() : v.trim();
          const version = idx > 0 ? v.slice(idx + 1).trim() : "";
          return osvQuery({ data: { packageName: name, ecosystem: o.ecosystem as "npm", version, } });
        }}
        footer="Formato: nome-do-pacote versão (ex.: lodash 4.17.20)."
        render={(data) => (
          <div className="space-y-2">
            <Badge tone={data.total ? "amber" : "green"}>{data.total} vulnerabilidade(s) para {data.package}@{data.version}</Badge>
            {data.results.length > 0 && (
              <DataTable rows={data.results.map((r) => ({ id: r.id, resumo: r.summary ?? "", severidade: r.severity ?? "—", publicado: r.published?.slice(0, 10), aliases: (r.aliases ?? []).join(", ") }))} />
            )}
          </div>
        )}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <QueryTool
          title="Malware Hash Lookup"
          description="Consulta metadados de amostras por MD5/SHA-1/SHA-256 no MalwareBazaar (Auth-Key gratuita)."
          toolId="hash-lookup"
          toolName="Malware Hash Lookup"
          source="abuse.ch MalwareBazaar"
          placeholder="sha256 do arquivo"
          cta="Consultar hash"
          attachKind="hash"
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
          title="Public Threat Intelligence Search (OTX)"
          description="Pulsos comunitários da AlienVault OTX para IP, domínio, URL ou hash. Endpoint público, sem chave."
          toolId="otx"
          toolName="OTX Indicator"
          source="AlienVault OTX"
          placeholder="8.8.8.8 · dominio.com · https://… · hash"
          cta="Buscar pulsos"
          render={(data) => {
            if (!data.available) return <Notice tone="warn" title="Consulta indisponível">{data.reason}</Notice>;
            return (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={data.pulseCount ? "amber" : "green"}>{data.pulseCount} pulsos</Badge>
                  <span className="text-[11px] text-[var(--ag-faint)]">reputação OTX: {data.reputation ?? "—"}</span>
                </div>
                {data.pulses.length > 0 ? (
                  <ul className="space-y-1">
                    {data.pulses.map((p: any) => (
                      <li key={`${p.name}-${p.modified}`} className="rounded-lg border border-[var(--ag-border)] px-2 py-1.5">
                        <div className="text-[11.5px] text-[#dbe6f4]">{p.name}</div>
                        <div className="flex flex-wrap items-center gap-1 text-[10px] text-[var(--ag-faint)]">
                          <span>{p.modified?.slice(0, 10)}</span>
                          {(p.tags ?? []).slice(0, 5).map((t: any) => <Badge key={t}>{t}</Badge>)}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : <Notice tone="ok">Nenhum pulso comunitário para este indicador.</Notice>}
              </div>
            );
          }}
        />
      </div>

      <QueryTool
        title="Security Headers & TLS Posture Checker"
        description="Verifica os headers de segurança do site e identifica tecnologias associadas."
        toolId="security-headers"
        toolName="Security Headers Checker"
        source="HTTP direto"
        placeholder="https://exemplo.com"
        cta="Verificar headers"
        run={(v) => websiteAnalyzer({ data: { url: v } })}
        render={(data) => (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {data.securityHeaders.map((h) => (
                <Badge key={h.header} tone={h.present ? "green" : "rose"}>{h.header.replace("strict-transport-security", "HSTS")}</Badge>
              ))}
            </div>
            <div className="text-[11.5px] text-[var(--ag-muted)]">
              {data.securityHeaders.filter((h) => h.present).length}/{data.securityHeaders.length} headers de segurança presentes.
              {data.technologies.length > 0 && <> Tecnologias: {data.technologies.map((t) => t.name).join(", ")}.</>}
            </div>
            <DataTable rows={data.securityHeaders.map((h) => ({ header: h.header, presente: h.present ? "sim" : "não", valor: h.value ?? "—" }))} />
            <p className="text-[10.5px] text-[var(--ag-faint)]">A postura TLS ativa (versões/cifras) não é inspecionada; certificados públicos estão em Domain Intelligence → SSL Analyzer.</p>
          </div>
        )}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <CvssCalculator />
        <HashCalculator />
      </div>

      <YaraViewer />

      <Panel title="Cobertura e limitações" icon={<ShieldAlert className="h-3.5 w-3.5" />}>
        <div className="grid gap-3 text-[11.5px] leading-relaxed text-[var(--ag-muted)] sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[#dbe7f4]"><Bug className="h-3.5 w-3.5 text-cyan-300" /> NVD sem chave: 5 requisições/30s</div>
            <p>Buscas amplas podem falhar por rate limit. O cache local evita consultas repetidas.</p>
            <div className="flex items-center gap-2 text-[#dbe7f4]"><PackageSearch className="h-3.5 w-3.5 text-cyan-300" /> OSV cobre dependências</div>
            <p>Para pacotes, informe a versão exata; o OSV retorna advisories com IDs GHSA/PYSEC/CVE.</p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[#dbe7f4]"><Terminal className="h-3.5 w-3.5 text-cyan-300" /> abuse.ch exige Auth-Key gratuita</div>
            <p>Hash, URLhaus e ThreatFox ficam indisponíveis sem a chave — a mensagem aparece na ferramenta.</p>
            <div className={cx("flex items-center gap-2 text-[#dbe7f4]")}><Flame className="h-3.5 w-3.5 text-cyan-300" /> Nenhum upload automático</div>
            <p>Arquivos e hashes só são consultados quando você cola o hash. Nenhum arquivo privado é enviado.</p>
          </div>
        </div>
        <div className="mt-3"><Severity value="info" /></div>
      </Panel>
    </div>
  );
}
