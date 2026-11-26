import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, KeyRound, Mail, ShieldCheck, XCircle } from "lucide-react";
import { breachAccountCheck, breachCatalog, emailAnalysis } from "@/lib/agency/api/email.functions";
import { QueryTool } from "@/components/agency/QueryTool";
import { Badge, Collapse, DataTable, KV, Notice, PageHeader, Panel } from "@/components/agency/kit";
import { formatDate } from "@/lib/agency/format";

export const Route = createFileRoute("/agency/email")({
  head: () => ({ meta: [{ title: "Email Intelligence — Life Agency" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: EmailPage,
});

function EmailPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="OSINT · Autenticação de e-mail"
        title="Email Intelligence"
        subtitle="Validação técnica do domínio de e-mail: MX, provedor, SPF, DMARC e seletores DKIM — tudo via DNS público. A plataforma não tenta confirmar a existência de caixas nem envia mensagens."
        actions={<Badge tone="green">100% DNS público</Badge>}
      />

      <QueryTool
        title="Email Domain Intelligence"
        description="Analisa sintaxe, MX, provedor, política SPF/DMARC e presença de DKIM nos seletores mais comuns."
        toolId="email-analysis"
        toolName="Email Intelligence"
        source="Google + Cloudflare DNS"
        placeholder="contato@empresa.com.br"
        cta="Analisar domínio"
        inputType="email"
        attachKind="email"
        render={(data) => (
          <div className="space-y-4">
            <KV
              cols={3}
              items={[
                { label: "E-mail", value: <span className="ag-mono text-[11.5px]">{data.email}</span> },
                { label: "Sintaxe", value: <Badge tone="green"><CheckCircle2 className="h-2.5 w-2.5" /> válida</Badge> },
                { label: "Aceita e-mail", value: <Badge tone={data.domainResolution.acceptsMail ? "green" : "rose"}>{data.domainResolution.acceptsMail ? "sim" : "sem MX"}</Badge> },
                { label: "Provedor", value: data.provider },
                { label: "Registros MX", value: data.mx.length },
                { label: "Domínio resolve (A)", value: data.domainResolution.a.join(", ") || "—" },
              ]}
            />

            {data.providerNote && <Notice tone="info">{data.providerNote}</Notice>}

            <Collapse title={`Registros MX (${data.mx.length})`} defaultOpen>
              {data.mx.length ? (
                <DataTable rows={data.mx.map((m: any) => ({ prioridade: m.priority, host: m.host, ttl: m.ttl ?? "—" }))} />
              ) : <Notice tone="warn">Nenhum MX publicado: o domínio não recebe e-mail.</Notice>}
            </Collapse>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-[var(--ag-border)] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[12px] font-semibold">SPF</span>
                  <Badge tone={data.spf.record ? (data.spf.allQualifier === "-" ? "green" : "amber") : "rose"}>
                    {data.spf.record ? `all: ${data.spf.allQualifier ?? "?"}` : "ausente"}
                  </Badge>
                </div>
                {data.spf.record ? (
                  <>
                    <pre className="ag-mono mb-2 whitespace-pre-wrap break-all rounded bg-black/30 p-2 text-[10.5px]">{data.spf.record}</pre>
                    <div className="text-[11px] text-[var(--ag-muted)]">
                      {data.spf.lookupCount} mecanismos com lookup · {data.spf.includes.length} include(s) · {data.spf.ip4.length} ip4
                    </div>
                    {data.spf.issues.length > 0 && (
                      <ul className="mt-2 space-y-1 text-[10.5px] text-amber-200/85">
                        {data.spf.issues.map((i: any) => <li key={i}>• {i}</li>)}
                      </ul>
                    )}
                  </>
                ) : <p className="text-[11px] text-[var(--ag-muted)]">Sem registro SPF — qualquer servidor pode enviar em nome do domínio.</p>}
              </div>

              <div className="rounded-xl border border-[var(--ag-border)] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[12px] font-semibold">DMARC</span>
                  <Badge tone={!data.dmarc.record ? "rose" : data.dmarc.policy === "none" ? "amber" : "green"}>
                    p={data.dmarc.policy ?? "—"}
                  </Badge>
                </div>
                {data.dmarc.record ? (
                  <>
                    <pre className="ag-mono mb-2 whitespace-wrap break-all rounded bg-black/30 p-2 text-[10.5px]">{data.dmarc.record}</pre>
                    <KV
                      items={[
                        { label: "sp", value: data.dmarc.subdomainPolicy ?? "—" },
                        { label: "pct", value: data.dmarc.pct ?? "100" },
                        { label: "rua", value: data.dmarc.rua ? <span className="ag-mono text-[10px]">{data.dmarc.rua}</span> : "—" },
                      ]}
                    />
                    {data.dmarc.issues.length > 0 && (
                      <ul className="mt-2 space-y-1 text-[10.5px] text-amber-200/85">
                        {data.dmarc.issues.map((i: any) => <li key={i}>• {i}</li>)}
                      </ul>
                    )}
                  </>
                ) : <p className="text-[11px] text-[var(--ag-muted)]">Sem DMARC: não há política declarada para falhas de autenticação.</p>}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--ag-border)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-semibold">DKIM</span>
                <Badge tone={data.dkim.length ? "green" : "neutral"}>{data.dkim.length} seletor(es) encontrados</Badge>
              </div>
              {data.dkim.length ? (
                <ul className="space-y-1.5">
                  {data.dkim.map((d: any) => (
                    <li key={d.selector} className="rounded-lg bg-black/25 p-2">
                      <div className="flex items-center gap-2 text-[11px]"><span className="ag-mono text-cyan-300">{d.selector}</span> <span className="text-[var(--ag-faint)]">_domainkey</span></div>
                      <pre className="ag-mono mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-all text-[10px] text-[var(--ag-muted)]">{d.record}</pre>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-[var(--ag-muted)]">
                  Nenhum seletor comum publicado. O seletor DKIM não é descobrível por padrão — informe-o quando conhecido (ex.: via cabeçalho DKIM-Signature de uma mensagem legítima).
                </p>
              )}
            </div>

            <Collapse title={`Todos os registros TXT (${data.txtRecords.length})`}>
              <div className="space-y-1">
                {data.txtRecords.map((t: any, i: any) => <pre key={i} className="ag-mono whitespace-pre-wrap break-all rounded bg-black/25 p-2 text-[10.5px]">{t}</pre>)}
              </div>
            </Collapse>

            <p className="text-[10.5px] text-[var(--ag-faint)]">{data.reputation.note}</p>
          </div>
        )}
      />

      <QueryTool
        title="Breach Notification Lookup — catálogo"
        description="Catálogo público de vazamentos do Have I Been Pwned. Pesquise por empresa/domínio para ver se o serviço foi exposto."
        toolId="breach-catalog"
        toolName="Breach Catalog"
        source="HIBP"
        placeholder="dominio.com ou nome do serviço"
        cta="Buscar no catálogo"
        render={(data) => (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge tone="cyan">{data.matched} de {data.totalCatalog} breaches</Badge>
              <span className="text-[11px] text-[var(--ag-faint)]">dados públicos — nenhuma senha é exibida</span>
            </div>
            {data.breaches.length ? (
              <DataTable
                rows={data.breaches.map((b: any) => ({
                  serviço: b.title,
                  domínio: b.domain,
                  "data do vazamento": b.breachDate,
                  "contas expostas": b.pwnCount.toLocaleString("pt-BR"),
                  "dados expostos": b.dataClasses.join(", "),
                  verificado: b.verified ? "sim" : "não",
                }))}
                maxRows={40}
              />
            ) : <Notice tone="info">Nenhum vazamento público com esse termo no catálogo.</Notice>}
          </div>
        )}
      />

      <QueryTool
        title="Breach Account Check (opcional)"
        description="Verifica se um endereço específico aparece em vazamentos conhecidos. Requer chave de API do HIBP."
        toolId="breach-check"
        toolName="Breach Account Check"
        source="HIBP (chave)"
        placeholder="usuario@dominio.com"
        cta="Verificar exposição"
        inputType="email"
        render={(data) => {
          if (!data.available) {
            return (
              <Notice tone="warn" title="Dependência externa">
                {data.reason}
                <div className="mt-2 flex flex-wrap gap-2">
                  <a href={data.signup} target="_blank" rel="noreferrer" className="ag-link inline-flex items-center gap-1 text-[11px]"><KeyRound className="h-3 w-3" /> Obter chave</a>
                  <span className="text-[11px] text-[var(--ag-faint)]">{data.alternative}</span>
                </div>
              </Notice>
            );
          }
          if (!data.breaches.length) {
            return <Notice tone="ok" title="Nenhum vazamento conhecido"><CheckCircle2 className="mr-1 inline h-3 w-3" /> O endereço não aparece em nenhum breach do catálogo do HIBP. Isso não garante que nunca tenha sido exposto.</Notice>;
          }
          return (
            <div className="space-y-3">
              <Badge tone="rose">{data.breaches.length} vazamento(s) encontrados</Badge>
              <DataTable rows={data.breaches.map((b: any) => ({ serviço: b.Title, data: b.BreachDate, "contas": b.PwnCount.toLocaleString("pt-BR"), dados: b.DataClasses.join(", ") }))} />
              <p className="text-[10.5px] text-[var(--ag-faint)]">{data.note}</p>
            </div>
          );
        }}
      />

      <Panel title="Limites e uso responsável" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
        <ul className="space-y-1.5 text-[11.5px] leading-relaxed text-[var(--ag-muted)]">
          <li className="flex gap-2"><Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" /> Consultas são sobre o <strong className="text-[#dce7f5]">domínio</strong> — não é possível validar a existência de uma caixa de e-mail sem interagir com o servidor SMTP.</li>
          <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" /> SPF/DMARC/DKIM são lidos diretamente do DNS público, sem intermediários.</li>
          <li className="flex gap-2"><XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" /> A plataforma nunca tenta adivinhar senhas, acessar contas ou enviar mensagens.</li>
        </ul>
        <div className="mt-3 text-[10.5px] text-[var(--ag-faint)]">Última verificação de fonte: {formatDate(new Date().toISOString())} · DNS over HTTPS (Google + Cloudflare).</div>
      </Panel>
    </div>
  );
}
