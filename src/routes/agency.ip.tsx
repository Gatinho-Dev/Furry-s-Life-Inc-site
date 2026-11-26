import { createFileRoute, Link } from "@tanstack/react-router";
import { Compass, Globe2, MapPin, Network, Server, ShieldQuestion } from "lucide-react";
import { ipLookup, ipReputation, publicDnsResolve, reverseDnsLookup } from "@/lib/agency/api/ip.functions";
import { QueryTool } from "@/components/agency/QueryTool";
import { Badge, Collapse, DataTable, KV, Notice, PageHeader, Panel } from "@/components/agency/kit";
import { IpValidator, SubnetCalculator } from "@/components/agency/NetCalc";
import { formatDate } from "@/lib/agency/format";

export const Route = createFileRoute("/agency/ip")({
  head: () => ({ meta: [{ title: "IP Intelligence — Life Agency" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: IpPage,
});

function IpPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="OSINT · Infraestrutura"
        title="IP Intelligence"
        subtitle="ASN, prefixo, organização, geolocalização aproximada, DNS reverso e reputação pública. Endereços privados são identificados localmente e não são enviados a terceiros."
        actions={<Badge tone="green">RDAP · RIPEstat · DoH</Badge>}
      />

      <Notice tone="warn" title="Localização aproximada">
        A geolocalização de IP indica país/região/provedor de rede — nunca a posição exata de uma pessoa ou dispositivo.
      </Notice>

      <QueryTool
        title="IP Lookup"
        description="Consolida RDAP, RIPEstat, Team Cymru, DNS reverso e geolocalização em uma única visão."
        toolId="ip-lookup"
        toolName="IP Lookup"
        source="RDAP + RIPEstat + ipwho.is"
        placeholder="8.8.8.8 ou 2001:4860:4860::8888"
        cta="Consultar IP"
        attachKind="ip"
        render={(data) => (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={data.classification === "public" ? "green" : "amber"}>{data.classification}</Badge>
              <Badge tone="blue">{data.version}</Badge>
              {data.network.asn && <Badge tone="cyan">{data.network.asn}</Badge>}
              {data.routing?.seenBy && <Badge tone="neutral">visto por {data.routing.seenBy}/{data.routing.total} peers RIPE RIS</Badge>}
            </div>

            {data.classification === "private/reserved" && (
              <Notice tone="warn" title="Endereço privado/reservado">Não há dados públicos de registro para este endereço. Nenhuma consulta externa foi realizada.</Notice>
            )}

            {data.geo && (
              <div>
                <div className="ag-label mb-1.5">Geolocalização aproximada</div>
                <KV
                  cols={3}
                  items={[
                    { label: "País", value: `${data.geo.country ?? "—"}${data.geo.countryCode ? ` (${data.geo.countryCode})` : ""}` },
                    { label: "Região", value: data.geo.region },
                    { label: "Cidade", value: data.geo.city },
                    { label: "Coordenadas", value: data.geo.latitude !== undefined ? <span className="ag-mono">{data.geo.latitude}, {data.geo.longitude}</span> : undefined },
                    { label: "Fuso horário", value: data.geo.timezone },
                    { label: "Observação", value: <span className="text-[11px] text-amber-200/80">{data.geo.accuracyNote}</span> },
                  ]}
                />
                {data.geo.latitude !== undefined && (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${data.geo.latitude}&mlon=${data.geo.longitude}#map=9/${data.geo.latitude}/${data.geo.longitude}`}
                    target="_blank" rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-[11px] text-cyan-300 hover:underline"
                  >
                    <MapPin className="h-3 w-3" /> Abrir no OpenStreetMap (aproximado)
                  </a>
                )}
              </div>
            )}

            <div>
              <div className="ag-label mb-1.5">Rede</div>
              <KV
                cols={3}
                items={[
                  { label: "ASN", value: <span className="ag-mono">{data.network.asn ?? "—"}</span> },
                  { label: "Organização", value: data.network.organization },
                  { label: "ISP", value: data.network.isp },
                  { label: "Prefixo", value: <span className="ag-mono">{data.network.prefix ?? "—"}</span> },
                  { label: "RIR", value: data.network.rir },
                  { label: "Alocado em", value: data.network.allocated },
                  { label: "Handle RDAP", value: data.network.handle && <span className="ag-mono">{data.network.handle}</span> },
                  { label: "Faixa registrada", value: data.network.range && <span className="ag-mono text-[11px]">{data.network.range}</span> },
                  { label: "Última atualização", value: data.routing?.lastUpdate ? formatDate(data.routing.lastUpdate) : undefined },
                ]}
              />
            </div>

            <div>
              <div className="ag-label mb-1.5">DNS reverso (PTR)</div>
              {data.reverseDns.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {data.reverseDns.map((h: any) => <span key={h} className="ag-mono rounded-md border border-[var(--ag-border)] bg-black/30 px-1.5 py-0.5 text-[11px]">{h}</span>)}
                </div>
              ) : <span className="text-[11.5px] text-[var(--ag-faint)]">Sem PTR publicado.</span>}
            </div>

            {data.rdap && (
              <Collapse title="Registro RDAP (detalhes)">
                <KV
                  cols={3}
                  items={[
                    { label: "Nome", value: data.rdap.name },
                    { label: "Handle", value: data.rdap.handle },
                    { label: "Tipo", value: data.rdap.type },
                    { label: "País", value: data.rdap.country },
                    { label: "Registrado", value: data.rdap.registered ? formatDate(data.rdap.registered) : undefined },
                    { label: "Atualizado", value: data.rdap.updated ? formatDate(data.rdap.updated) : undefined },
                    { label: "Entidades", value: data.rdap.entities?.join(", ") },
                  ]}
                />
              </Collapse>
            )}

            <div className="flex flex-wrap gap-2">
              <a href={`https://bgp.tools/prefix/${data.network.prefix ?? data.ip}`} target="_blank" rel="noreferrer" className="ag-btn ag-btn-ghost !text-[11px]"><Network className="h-3 w-3" /> BGP.tools</a>
              <a href={`https://stat.ripe.net/${data.ip}`} target="_blank" rel="noreferrer" className="ag-btn ag-btn-ghost !text-[11px]"><Globe2 className="h-3 w-3" /> RIPEstat</a>
              <a href={`https://rdap.org/ip/${data.ip}`} target="_blank" rel="noreferrer" className="ag-btn ag-btn-ghost !text-[11px]"><Server className="h-3 w-3" /> RDAP JSON</a>
            </div>
          </div>
        )}
      />

      <QueryTool
        title="IP Geolocation"
        description="Visão focada em localização aproximada e provedor."
        toolId="ip-geo"
        toolName="IP Geolocation"
        source="ipwho.is"
        placeholder="1.1.1.1"
        cta="Geolocalizar"
        attachKind="ip"
        run={(v) => ipLookup({ data: { ip: v } })}
        render={(data) => (
          data.geo ? (
            <KV
              cols={3}
              items={[
                { label: "País", value: data.geo.country },
                { label: "Região", value: data.geo.region },
                { label: "Cidade", value: data.geo.city },
                { label: "Latitude", value: data.geo.latitude },
                { label: "Longitude", value: data.geo.longitude },
                { label: "ASN", value: data.network.asn },
                { label: "Organização", value: data.network.organization },
                { label: "Fuso", value: data.geo.timezone },
              ]}
            />
          ) : <Notice tone="warn">Sem dados de geolocalização para este endereço (privado, reservado ou não indexado).</Notice>
        )}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <QueryTool
          title="Reverse DNS"
          description="Consulta PTR no Google Public DNS."
          toolId="reverse-dns"
          toolName="Reverse DNS"
          source="Google Public DNS"
          placeholder="8.8.8.8"
          cta="Resolver PTR"
          attachKind="ip"
          run={(v) => reverseDnsLookup({ data: { ip: v } })}
          render={(data) => (
            <KV
              items={[
                { label: "Consulta PTR", value: <span className="ag-mono text-[11px]">{data.ptrQuery}</span> },
                { label: "Status", value: <Badge tone={data.status === "NOERROR" ? "green" : "amber"}>{data.status}</Badge> },
                { label: "Hostnames", value: data.hostnames.length ? data.hostnames.join(", ") : "—" },
                { label: "Resolver", value: data.resolver },
              ]}
            />
          )}
        />

        <QueryTool
          title="IP Reputation"
          description="OTX público sempre disponível; AbuseIPDB, VirusTotal, Shodan e GreyNoise entram automaticamente se você configurar as chaves gratuitas."
          toolId="ip-reputation"
          toolName="IP Reputation"
          source="OTX + fontes opcionais"
          placeholder="45.155.205.233"
          cta="Verificar reputação"
          attachKind="ip"
          run={(v) => ipReputation({ data: { ip: v } })}
          render={(data) => (
            <div className="space-y-3">
              <KV
                items={[
                  { label: "Pulsos OTX", value: (data.results.otx as { pulses?: number } | undefined)?.pulses ?? 0 },
                  { label: "Reputação OTX", value: (data.results.otx as { reputation?: number } | undefined)?.reputation ?? "—" },
                ]}
              />
              <Collapse title="Fontes opcionais e detalhes" defaultOpen>
                <DataTable rows={data.sources.map((s) => ({ fonte: s.name, disponível: s.ok ? "sim" : "não", detalhe: s.detail ?? "" }))} />
              </Collapse>
              <p className="text-[11px] text-[var(--ag-faint)]">{data.interpretation}</p>
            </div>
          )}
        />
      </div>

      <QueryTool
        title="Public DNS Resolver"
        description="Consulta qualquer tipo de registro contra os principais resolvers públicos."
        toolId="dns-resolve"
        toolName="Public DNS Resolver"
        source="DNS over HTTPS"
        placeholder="exemplo.com ou nome.in-addr.arpa"
        cta="Resolver"
        options={[
          { key: "type", label: "Tipo", initial: "A", values: ["A", "AAAA", "MX", "TXT", "NS", "CNAME", "SOA", "PTR", "CAA", "DS", "DNSKEY"].map((v) => ({ value: v, label: v })) },
          { key: "resolver", label: "Resolver", values: [{ value: "google", label: "Google" }, { value: "cloudflare", label: "Cloudflare" }, { value: "adguard", label: "AdGuard" }] },
        ]}
        run={(v, o) => publicDnsResolve({ data: { name: v, type: o.type, resolver: o.resolver as "google" | "cloudflare" | "adguard" } })}
        render={(data) => (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={data.status === "NOERROR" ? "green" : "amber"}>{data.status}</Badge>
              <Badge tone={data.dnssecAuthenticated ? "green" : "neutral"}>DNSSEC AD: {data.dnssecAuthenticated ? "sim" : "não"}</Badge>
              <span className="text-[11px] text-[var(--ag-faint)]">{data.resolver}</span>
            </div>
            {data.answers.length ? (
              <DataTable rows={data.answers.map((a) => ({ nome: a.name, tipo: a.type, ttl: a.ttl, valor: a.data }))} />
            ) : <Notice tone="warn">Nenhuma resposta para {data.type} em {data.name}.</Notice>}
          </div>
        )}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <IpValidator />
        <SubnetCalculator />
      </div>

      <Panel title="Próximos passos" icon={<Compass className="h-3.5 w-3.5" />}>
        <p className="text-[11.5px] leading-relaxed text-[var(--ag-muted)]">
          Cruzar o ASN/prefixo com <Link to="/agency/network" className="ag-link">Network Intelligence</Link>, verificar reputação de domínios
          associados em <Link to="/agency/web" className="ag-link">Web Intelligence</Link> e registrar os achados em uma{" "}
          <Link to="/agency/workspace" search={{ case: undefined }} className="ag-link">investigação</Link> para gerar relatório.
        </p>
        <div className="mt-2 flex items-center gap-1.5 text-[10.5px] text-[var(--ag-faint)]"><ShieldQuestion className="h-3 w-3" /> Nenhuma varredura invasiva é executada.</div>
      </Panel>
    </div>
  );
}
