import { createFileRoute } from "@tanstack/react-router";
import { Building2, ExternalLink, Landmark, Newspaper, ShieldCheck } from "lucide-react";
import { cnpjLookup, companyOpenDataLinks } from "@/lib/agency/api/company.functions";
import { sslAnalyzer, subdomainFinder, websiteAnalyzer } from "@/lib/agency/api/domain.functions";
import { QueryTool } from "@/components/agency/QueryTool";
import { Badge, Collapse, DataTable, KV, Notice, PageHeader, Panel, ValueView } from "@/components/agency/kit";

export const Route = createFileRoute("/agency/company")({
  head: () => ({ meta: [{ title: "Company Intelligence — Life Agency" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: CompanyPage,
});

function CompanyPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="OSINT · Organizações"
        title="Company Intelligence"
        subtitle="Cadastro público brasileiro (CNPJ), presença digital, tecnologias, certificados e imprensa. Dados oficiais são apresentados como fatos do registro; o restante é apresentado como indício."
        actions={<Badge tone="green">BrasilAPI · Receita Federal</Badge>}
      />

      <QueryTool
        title="Company Search (CNPJ)"
        description="Consulta os dados abertos da Receita Federal via BrasilAPI, com validação local dos dígitos verificadores."
        toolId="cnpj"
        toolName="CNPJ Lookup"
        source="BrasilAPI / Receita Federal"
        placeholder="00.000.000/0000-00"
        cta="Consultar CNPJ"
        attachKind="organization"
        render={(data) => {
          if (!data.found) return <Notice tone="warn" title="CNPJ não encontrado">{data.message}</Notice>;
          const c = data.company;
          return (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="cyan">{c.cnpj}</Badge>
                <Badge tone={c.status?.toLowerCase().includes("ativa") ? "green" : "amber"}>{c.status ?? "situação não informada"}</Badge>
                {c.size && <Badge>{c.size}</Badge>}
              </div>
              <KV
                cols={3}
                items={[
                  { label: "Razão social", value: <span className="font-medium text-white">{c.legalName}</span> },
                  { label: "Nome fantasia", value: c.tradeName },
                  { label: "Natureza jurídica", value: c.legalNature },
                  { label: "Início de atividade", value: c.foundedAt },
                  { label: "Situação desde", value: c.statusSince },
                  { label: "Capital social", value: c.capital !== undefined ? c.capital.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : undefined },
                  { label: "Atividade principal", value: c.mainActivity },
                  { label: "Telefone", value: c.phone },
                  { label: "E-mail", value: c.email },
                  { label: "Simples Nacional", value: c.simples === undefined ? undefined : c.simples ? "optante" : "não optante" },
                  { label: "Endereço", value: [c.address.street, c.address.number, c.address.district, c.address.city, c.address.state, c.address.postalCode].filter(Boolean).join(", ") },
                ]}
              />

              {c.secondaryActivities.length > 0 && (
                <Collapse title={`Atividades secundárias (${c.secondaryActivities.length})`}>
                  <DataTable rows={c.secondaryActivities.map((a: any) => ({ código: a.codigo, descrição: a.descricao }))} maxRows={40} />
                </Collapse>
              )}

              {c.partners.length > 0 && (
                <Collapse title={`Quadro societário público (${c.partners.length})`} defaultOpen>
                  <DataTable rows={c.partners.map((p: any) => ({ nome: p.name, qualificação: p.role, desde: p.since ?? "—" }))} />
                  <p className="mt-2 text-[10.5px] text-[var(--ag-faint)]">Dados públicos do cadastro. Não implicam relação atual, controle ou vínculo operacional.</p>
                </Collapse>
              )}

              <div className="flex flex-wrap gap-2">
                {data.links.map((l: any) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="ag-btn ag-btn-ghost !text-[11px]">
                    <ExternalLink className="h-3 w-3" /> {l.label}
                  </a>
                ))}
              </div>
            </div>
          );
        }}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <QueryTool
          title="Corporate Website Analyzer"
          description="Analisa o site institucional: status, headers, tecnologias, robots e sitemap."
          toolId="website-analyzer"
          toolName="Corporate Website"
          source="HTTP direto"
          placeholder="https://empresa.com.br"
          cta="Analisar site"
          attachKind="domain"
          render={(data) => (
            <div className="space-y-3">
              <KV
                items={[
                  { label: "Status", value: <Badge tone={data.status < 400 ? "green" : "rose"}>{data.status}</Badge> },
                  { label: "URL final", value: <span className="ag-mono text-[11px] break-all">{data.finalUrl}</span> },
                  { label: "Servidor", value: data.headers.server },
                  { label: "Title", value: data.title },
                  { label: "IP", value: data.serverIp },
                ]}
              />
              <div className="flex flex-wrap gap-1.5">
                {data.technologies.map((t: any) => <Badge key={t.name} tone="cyan">{t.name}</Badge>)}
              </div>
              {data.sitemap && <div className="text-[11px] text-[var(--ag-muted)]">sitemap: {data.sitemap.ok ? `${data.sitemap.entries} URLs` : "não encontrado"}</div>}
            </div>
          )}
        />

        <QueryTool
          title="Domain & Certificate Association"
          description="Subdomínios e certificados ligados ao domínio corporativo (Certificate Transparency)."
          toolId="subdomain-finder"
          toolName="Domain Association"
          source="crt.sh"
          placeholder="empresa.com.br"
          cta="Mapear domínio"
          attachKind="domain"
          render={(data) => (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2"><Badge tone="cyan">{data.total} nomes</Badge><Badge>{data.certificates.length} certificados</Badge></div>
              <div className="flex max-h-56 flex-wrap gap-1 overflow-auto">
                {data.subdomains.slice(0, 120).map((s: any) => (
                  <span key={s.name} className="ag-mono rounded border border-[var(--ag-border)] px-1.5 py-0.5 text-[10px] text-[#c7d5e4]">{s.name}</span>
                ))}
              </div>
              <p className="text-[10.5px] text-[var(--ag-faint)]">Subdomínios em CT podem estar expirados ou não resolvidos atualmente.</p>
            </div>
          )}
        />
      </div>

      <QueryTool
        title="SSL Certificate Association"
        description="Certificados públicos emitidos para o domínio — emissores, validade e SANs."
        toolId="ssl-analyzer"
        toolName="Certificate Association"
        source="crt.sh"
        placeholder="empresa.com.br"
        cta="Ver certificados"
        attachKind="certificate"
        run={(v) => sslAnalyzer({ data: { domain: v } })}
        render={(data) => (
          data.certificates.length ? (
            <DataTable
              rows={data.certificates.map((c) => ({ nome: c.commonName, emissor: c.issuer, "válido até": c.notAfter?.slice(0, 10), dias: c.daysToExpiry, expirado: c.expired ? "sim" : "não", sans: c.san.length }))}
              maxRows={30}
            />
          ) : <Notice tone="info">Nenhum certificado público encontrado para este domínio exato.</Notice>
        )}
      />

      <QueryTool
        title="Public News & Official Sources"
        description="Links diretos para busca em imprensa, diários oficiais e diretórios públicos."
        toolId="company-links"
        toolName="Company Public Sources"
        source="Fontes oficiais"
        placeholder="nome da empresa"
        cta="Gerar fontes"
        run={(v) => companyOpenDataLinks({ data: { query: v } })}
        render={(data) => (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {data.links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-lg border border-[var(--ag-border)] px-2.5 py-2 text-[11.5px] hover:border-cyan-400/40">
                {l.label} <ExternalLink className="h-3 w-3 shrink-0 text-[var(--ag-faint)]" />
              </a>
            ))}
          </div>
        )}
      />

      <Panel title="Como ler os resultados" icon={<Landmark className="h-3.5 w-3.5" />}>
        <div className="grid gap-3 text-[11.5px] leading-relaxed text-[var(--ag-muted)] sm:grid-cols-3">
          <div>
            <div className="mb-1 flex items-center gap-2 font-semibold text-[#dce8f5]"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Fatos do registro</div>
            <p>Razão social, CNPJ, situação cadastral, sócios e endereço vêm do cadastro público e são apresentados literalmente.</p>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2 font-semibold text-[#dce8f5]"><Building2 className="h-3.5 w-3.5 text-cyan-400" /> Indícios técnicos</div>
            <p>Subdomínios, certificados e tecnologias indicam infraestrutura relacionada, não necessariamente propriedade ou controle.</p>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2 font-semibold text-[#dce8f5]"><Newspaper className="h-3.5 w-3.5 text-amber-400" /> Imprensa</div>
            <p>Notícias são links de busca; a plataforma não afirma veracidade nem autoria. Verifique a fonte original.</p>
          </div>
        </div>
        <div className="mt-3"><ValueView value={{ nota: "A plataforma não emite opinião sobre idoneidade financeira ou legal de empresas." }} /></div>
      </Panel>
    </div>
  );
}
