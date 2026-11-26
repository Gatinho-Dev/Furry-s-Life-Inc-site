import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, CircleSlash, Eye, EyeOff, KeyRound, PlugZap, RefreshCw, Save, Trash2 } from "lucide-react";
import { SOURCES } from "@/lib/agency/catalog";
import { sourceHealth } from "@/lib/agency/api/feed.functions";
import { getPrefs, setPrefs } from "@/lib/agency/store";
import { getActivity } from "@/lib/agency/activity";
import { Badge, Button, Empty, PageHeader, Panel, Stat, cx } from "@/components/agency/kit";
import { formatDate } from "@/lib/agency/format";

export const Route = createFileRoute("/agency/api")({
  head: () => ({ meta: [{ title: "API Center — Life Agency" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: ApiCenter,
});

const KEY_DEFS: Array<{ env: string; sourceId: string; label: string; signup: string; note: string }> = [
  { env: "ABUSECH_AUTH_KEY", sourceId: "urlhaus", label: "abuse.ch Auth-Key", signup: "https://auth.abuse.ch/", note: "Desbloqueia URLhaus, MalwareBazaar e ThreatFox. Gratuita." },
  { env: "VT_API_KEY", sourceId: "virustotal", label: "VirusTotal API Key", signup: "https://www.virustotal.com/gui/my-apikey", note: "4 requisições/min no plano gratuito." },
  { env: "ABUSEIPDB_API_KEY", sourceId: "abuseipdb", label: "AbuseIPDB API Key", signup: "https://www.abuseipdb.com/account/api", note: "1.000 checagens/dia gratuitas." },
  { env: "SHODAN_API_KEY", sourceId: "shodan", label: "Shodan API Key", signup: "https://account.shodan.io/", note: "Créditos gratuitos limitados; host lookup." },
  { env: "OTX_API_KEY", sourceId: "otx", label: "AlienVault OTX Key", signup: "https://otx.alienvault.com/api", note: "Opcional: o endpoint público já funciona sem chave." },
  { env: "GREYNOISE_API_KEY", sourceId: "greynoise", label: "GreyNoise Key", signup: "https://viz.greynoise.io/account/", note: "Plano comunitário gratuito." },
  { env: "HIBP_API_KEY", sourceId: "hibp", label: "Have I Been Pwned Key", signup: "https://haveibeenpwned.com/API/Key", note: "Chave paga; o catálogo de breaches continua gratuito." },
  { env: "GOOGLE_SAFE_BROWSING_KEY", sourceId: "safe-browsing", label: "Google Safe Browsing Key", signup: "https://developers.google.com/safe-browsing/v4/get-started", note: "Chave gratuita com cota diária." },
];

function ApiCenter() {
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [health, setHealth] = useState<Awaited<ReturnType<typeof sourceHealth>> | null>(null);
  const [checking, setChecking] = useState(false);
  const [saved, setSaved] = useState(false);
  const activity = useMemo(() => getActivity(), []);

  useEffect(() => {
    const prefs = getPrefs();
    setKeys(prefs.apiKeys);
    setDraft(prefs.apiKeys);
  }, []);

  const check = async (useKeys = keys) => {
    setChecking(true);
    try {
      setHealth(await sourceHealth({ data: { keys: useKeys } }));
    } catch {
      setHealth(null);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => { void check({}); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const save = () => {
    const cleaned = Object.fromEntries(Object.entries(draft).filter(([, v]) => v && v.trim()));
    setPrefs({ apiKeys: cleaned });
    setKeys(cleaned);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    void check(cleaned);
  };

  const statusFor = (id: string) => health?.rows.find((r) => r.id === id);
  const lastQueryFor = (sourceId: string) => activity.find((a) => a.source.toLowerCase().includes(sourceId) || a.toolId.includes(sourceId));
  const free = SOURCES.filter((s) => s.access === "free");
  const optional = SOURCES.filter((s) => s.access === "key-optional");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Integrações"
        title="Free API Center"
        subtitle="Todas as fontes essenciais funcionam sem chave. Chaves opcionais ampliam cobertura e nunca são enviadas a terceiros pelo navegador — ficam neste dispositivo e são usadas apenas pelo servidor da plataforma na consulta."
        actions={<Button size="sm" variant="primary" onClick={save}><Save className="h-3 w-3" /> {saved ? "Salvo" : "Salvar chaves"}</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Fontes sem chave" value={free.length} tone="green" hint="prontas para uso" />
        <Stat label="Fontes com chave opcional" value={optional.length} hint="nunca obrigatórias" tone="amber" />
        <Stat label="Online agora" value={health ? `${health.online}/${health.total}` : "—"} tone="cyan" hint="verificação real" />
        <Stat label="Chaves configuradas" value={Object.keys(keys).length} />
      </div>

      <Panel
        title="Chaves opcionais"
        description="Guardadas apenas no localStorage deste navegador. Para produção multiusuário, use variáveis de ambiente do servidor."
        actions={<Button size="sm" variant="ghost" onClick={() => void check(keys)} disabled={checking}><RefreshCw className={cx("h-3.5 w-3.5", checking && "animate-spin")} /> Testar tudo</Button>}
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {KEY_DEFS.map((k) => {
            const source = SOURCES.find((s) => s.id === k.sourceId);
            const row = statusFor(k.sourceId === "urlhaus" ? "abusech" : k.sourceId);
            return (
              <div key={k.env} className="rounded-xl border border-[var(--ag-border)] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-[12.5px] font-medium"><KeyRound className="h-3.5 w-3.5 text-cyan-300" /> {k.label}</div>
                    <div className="mt-0.5 text-[10.5px] text-[var(--ag-faint)]">{k.note}</div>
                  </div>
                  {row && <Badge tone={row.ok ? "green" : "rose"}>{row.ok ? "ativo" : "inativo"}</Badge>}
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <input
                    className="ag-input !py-1.5 !text-[11px]"
                    type={visible[k.env] ? "text" : "password"}
                    placeholder={`${k.env} (não configurada)`}
                    value={draft[k.env] ?? ""}
                    onChange={(e) => setDraft({ ...draft, [k.env]: e.target.value })}
                  />
                  <button className="ag-btn ag-btn-ghost !px-2 !py-1.5" onClick={() => setVisible({ ...visible, [k.env]: !visible[k.env] })} title="Mostrar/ocultar">
                    {visible[k.env] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    className="ag-btn ag-btn-ghost !px-2 !py-1.5"
                    title="Remover"
                    onClick={() => { const next = { ...draft }; delete next[k.env]; setDraft(next); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-[var(--ag-faint)]">
                  <a href={k.signup} target="_blank" rel="noreferrer" className="ag-link">obter chave</a>
                  {source && <span>{source.limits}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="FREE — NO API KEY" description="Todas funcionam imediatamente, sem cadastro." actions={<Badge tone="green">{free.length} fontes</Badge>}>
        <div className="overflow-auto rounded-xl border border-[var(--ag-border)]">
          <table className="ag-table">
            <thead><tr><th>Fonte</th><th>Categoria</th><th>Descrição</th><th>Limites</th><th>Status</th><th>Última consulta</th></tr></thead>
            <tbody>
              {free.map((s) => {
                const row = statusFor(s.id === "abusech" ? "abusech" : s.id);
                const last = lastQueryFor(s.id);
                return (
                  <tr key={s.id}>
                    <td><a href={s.url} target="_blank" rel="noreferrer" className="ag-link text-[11.5px]">{s.name}</a></td>
                    <td className="text-[10.5px]">{s.category}</td>
                    <td className="text-[10.5px] text-[var(--ag-muted)]">{s.description}</td>
                    <td className="text-[10px] text-[var(--ag-faint)]">{s.limits}</td>
                    <td>{row ? (row.ok ? <Badge tone="green">online · {row.ms}ms</Badge> : <Badge tone="rose">{row.status || "falha"}</Badge>) : <Badge>Sob demanda</Badge>}</td>
                    <td className="text-[10px] text-[var(--ag-faint)]">{last ? formatDate(last.at) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="FREE — OPTIONAL API KEY" description="Melhoram cobertura, mas nunca são necessárias para usar a plataforma." actions={<Badge tone="amber">{optional.length} fontes</Badge>}>
        <div className="overflow-auto rounded-xl border border-[var(--ag-border)]">
          <table className="ag-table">
            <thead><tr><th>Fonte</th><th>Variável</th><th>Descrição</th><th>Limites</th><th>Status</th></tr></thead>
            <tbody>
              {optional.map((s) => {
                const row = statusFor(s.id === "urlhaus" ? "abusech" : s.id);
                const configured = s.keyEnv ? Boolean(keys[s.keyEnv]) : false;
                return (
                  <tr key={s.id}>
                    <td><a href={s.url} target="_blank" rel="noreferrer" className="ag-link text-[11.5px]">{s.name}</a></td>
                    <td className="ag-mono text-[10px]">{s.keyEnv}</td>
                    <td className="text-[10.5px] text-[var(--ag-muted)]">{s.description}</td>
                    <td className="text-[10px] text-[var(--ag-faint)]">{s.limits}</td>
                    <td>{configured ? <Badge tone="green">configurada</Badge> : <Badge tone="neutral">não configurada</Badge>}{row && !row.ok && <div className="text-[9.5px] text-rose-300">{row.detail}</div>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Documentação técnica das integrações" description="Endpoints usados, autenticação e observações operacionais." icon={<PlugZap className="h-3.5 w-3.5" />}>
        <div className="grid gap-2 lg:grid-cols-2">
          {[
            { name: "DNS over HTTPS", endpoint: "GET https://dns.google/resolve · https://cloudflare-dns.com/dns-query · https://dns.adguard-dns.com/resolve", auth: "nenhuma", note: "Tipos A/AAAA/MX/TXT/NS/CNAME/SOA/PTR/CAA/DS/DNSKEY. DNSSEC via flag AD." },
            { name: "RDAP", endpoint: "GET https://rdap.org/domain/{domain} · /ip/{ip}", auth: "nenhuma", note: "Redireciona ao registro autoritativo; limites variam." },
            { name: "crt.sh", endpoint: "GET https://crt.sh/?q=%.{domain}&output=json", auth: "nenhuma", note: "Pode retornar 429/timeout em domínios grandes; cache de 15 min." },
            { name: "RIPEstat", endpoint: "GET https://stat.ripe.net/data/{dataset}/data.json?resource=", auth: "nenhuma", note: "Datasets: prefix-overview, as-overview, announced-prefixes, asn-neighbours, routing-status." },
            { name: "Team Cymru", endpoint: "DNS TXT {ip}.origin.asn.cymru.com", auth: "nenhuma", note: "Formato: ASN | prefixo | país | registro | data." },
            { name: "ipwho.is", endpoint: "GET https://ipwho.is/{ip}", auth: "nenhuma", note: "Geolocalização aproximada; sem SLA." },
            { name: "NIST NVD 2.0", endpoint: "GET https://services.nvd.nist.gov/rest/json/cves/2.0", auth: "nenhuma (5 req/30s)", note: "Busca por cveId ou keywordSearch." },
            { name: "CISA KEV", endpoint: "GET https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json", auth: "nenhuma", note: "Catálogo completo em cache de 30 min." },
            { name: "OSV.dev", endpoint: "POST https://api.osv.dev/v1/query", auth: "nenhuma", note: "Corpo: package{name,ecosystem} + version." },
            { name: "FIRST EPSS", endpoint: "GET https://api.first.org/data/v1/epss?cve=", auth: "nenhuma", note: "Probabilidade de exploração em 30 dias." },
            { name: "abuse.ch", endpoint: "POST https://urlhaus-api.abuse.ch/v1/url|host/ · https://mb-api.abuse.ch/api/v1/ · https://threatfox-api.abuse.ch/api/v1/", auth: "Auth-Key gratuita (obrigatória)", note: "Sem chave a API responde 401 — a UI explica a dependência." },
            { name: "Wayback", endpoint: "GET https://archive.org/wayback/available · /cdx/search/cdx", auth: "nenhuma", note: "CDX filtrado por status 200 e colapsado por mês." },
            { name: "GitHub", endpoint: "GET https://api.github.com/users/{u} · /search/repositories", auth: "nenhuma (60 req/h)", note: "User-Agent obrigatório." },
            { name: "BrasilAPI", endpoint: "GET https://brasilapi.com.br/api/cnpj/v1/{cnpj}", auth: "nenhuma", note: "Base pública da Receita Federal; validação de dígitos local." },
            { name: "HIBP", endpoint: "GET https://haveibeenpwned.com/api/v3/breaches", auth: "nenhuma para o catálogo", note: "Consulta por conta exige chave paga." },
            { name: "AlienVault OTX", endpoint: "GET https://otx.alienvault.com/api/v1/indicators/{type}/{value}/general", auth: "nenhuma (público)", note: "Pulsos comunitários; limites por IP." },
            { name: "Mastodon / HN", endpoint: "GET https://{instance}/api/v1/timelines/tag/{tag} · https://hn.algolia.com/api/v1/search", auth: "nenhuma", note: "Somente conteúdo público." },
            { name: "VirusTotal / Safe Browsing", endpoint: "GET /api/v3/... · POST safebrowsing.googleapis.com/v4/threatMatches:find", auth: "chave opcional", note: "Usadas apenas se você configurar." },
          ].map((d) => (
            <details key={d.name} className="rounded-xl border border-[var(--ag-border)] px-3 py-2">
              <summary className="cursor-pointer text-[12px] font-medium text-[#dbe7f4]">{d.name}</summary>
              <div className="mt-2 space-y-1 text-[10.5px]">
                <div className="ag-mono break-all text-[var(--ag-faint)]">{d.endpoint}</div>
                <div><span className="text-[var(--ag-faint)]">Auth:</span> {d.auth}</div>
                <div className="text-[var(--ag-muted)]">{d.note}</div>
              </div>
            </details>
          ))}
        </div>
      </Panel>

      <Panel title="Estado da verificação" description="Resultado da última checagem real de conectividade.">
        {!health ? (
          <Empty title="Nenhuma verificação executada" hint="Clique em “Testar tudo” para consultar cada fonte." icon={<CircleSlash className="h-6 w-6" />} />
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {health.rows.map((r) => (
              <div key={r.id} className="flex items-start gap-2 rounded-lg border border-[var(--ag-border)] px-2.5 py-1.5">
                {r.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" /> : <CircleSlash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />}
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-[#dbe7f4]">{r.name}</div>
                  <div className="text-[9.5px] text-[var(--ag-faint)]">{r.status || "ERR"} · {r.ms}ms {r.detail ? `· ${r.detail}` : ""}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
