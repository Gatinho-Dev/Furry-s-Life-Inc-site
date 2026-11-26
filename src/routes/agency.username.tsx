import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, AtSign, Ban, CheckCircle2, CircleHelp, Github, GithubIcon, Star } from "lucide-react";
import { githubUser, redditUser, usernameScan } from "@/lib/agency/api/social.functions";
import { QueryTool } from "@/components/agency/QueryTool";
import { SherlockScan } from "@/components/agency/SherlockScan";
import { Badge, Button, DataTable, Empty, ErrorBox, KV, Notice, PageHeader, Panel, Spinner, ValueView, cx, errorMessage } from "@/components/agency/kit";
import { formatDate } from "@/lib/agency/format";

export const Route = createFileRoute("/agency/username")({
  head: () => ({ meta: [{ title: "Username Intelligence — Life Agency" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: UsernamePage,
});

function StatusBadge({ status }: { status: string }) {
  if (status === "found") return <Badge tone="green"><CheckCircle2 className="h-2.5 w-2.5" /> encontrado</Badge>;
  if (status === "not_found") return <Badge tone="neutral">não encontrado</Badge>;
  if (status === "blocked") return <Badge tone="amber"><Ban className="h-2.5 w-2.5" /> bloqueado</Badge>;
  return <Badge tone="neutral"><CircleHelp className="h-2.5 w-2.5" /> indefinido</Badge>;
}

function UsernamePage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="OSINT · Identidade pública"
        title="Username Intelligence"
        subtitle="Verificação em 26 plataformas essenciais e em 464 sites via Sherlock Project, mais perfil GitHub e Reddit. Um mesmo username não prova que as contas pertencem à mesma pessoa."
        actions={<Badge tone="green">sem chave</Badge>}
      />

      <SherlockScan />

      <QueryTool
        title="Username Search"
        description="Requisita a URL pública de perfil em cada plataforma e classifica a resposta HTTP real."
        toolId="username-search"
        toolName="Username Search"
        source="Perfis públicos"
        placeholder="usuario (sem @)"
        cta="Verificar 26 plataformas"
        attachKind="username"
        footer="Plataformas que bloqueiam datacenter (403/429) aparecem como “bloqueado” com o link manual."
        render={(data) => (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="green">{data.found} encontrados</Badge>
              <Badge tone="amber">{data.blocked} bloqueados</Badge>
              <span className="text-[11px] text-[var(--ag-faint)]">{data.checked} plataformas verificadas</span>
            </div>
            <DataTable
              rows={data.results.map((r: any) => ({
                plataforma: r.platform,
                categoria: r.category,
                status: r.status,
                http: r.httpStatus || "—",
                url: r.url,
                observação: r.detail ?? "",
              }))}
              maxRows={30}
            />
            <Notice tone="warn" title="Correlação exige evidência">
              {data.disclaimer}
            </Notice>
          </div>
        )}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <QueryTool
          title="GitHub Username Lookup"
          description="Perfil público, repositórios, linguagens e contagens. Limite de 60 req/h sem token."
          toolId="github-user"
          toolName="GitHub Profile"
          source="GitHub Public API"
          placeholder="torvalds"
          cta="Consultar GitHub"
          attachKind="username"
          render={(data) => {
            if (!("found" in data) || data.found === false) {
              return <Notice tone="warn" title="Perfil não encontrado">{(data as { message?: string }).message ?? "Nenhum usuário público com esse login."}</Notice>;
            }
            const p = data.profile;
            if (!p) return null;
            return (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <img src={p.avatar} alt="" className="h-12 w-12 rounded-full border border-[var(--ag-border)]" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[14px] font-semibold">{p.name ?? p.login} <span className="ag-mono text-[11px] text-[var(--ag-faint)]">@{p.login}</span></div>
                    <a href={p.url} target="_blank" rel="noreferrer" className="ag-link text-[11px]">{p.url}</a>
                  </div>
                </div>
                {p.bio && <p className="rounded-lg border border-[var(--ag-border)] bg-black/20 p-2.5 text-[11.5px] text-[var(--ag-muted)]">{p.bio}</p>}
                <KV
                  cols={3}
                  items={[
                    { label: "Empresa", value: p.company },
                    { label: "Localização", value: p.location },
                    { label: "Site", value: p.blog ? <a href={p.blog} target="_blank" rel="noreferrer" className="ag-link">{p.blog}</a> : undefined },
                    { label: "Twitter", value: p.twitter },
                    { label: "Repositórios", value: p.publicRepos },
                    { label: "Seguidores", value: p.followers },
                    { label: "Criado em", value: formatDate(p.createdAt) },
                    { label: "Atualizado", value: formatDate(p.updatedAt) },
                    { label: "ID", value: <span className="ag-mono">{p.id}</span> },
                  ]}
                />
                {data.topLanguages.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {data.topLanguages.map(([lang, count]: [string, number]) => <Badge key={lang} tone="blue">{lang} · {count}</Badge>)}
                  </div>
                )}
                <div>
                  <div className="ag-label mb-1.5">Repositórios por estrelas</div>
                  <ul className="space-y-1">
                    {data.repositories.slice(0, 8).map((r: any) => (
                      <li key={r.name} className="flex items-center justify-between gap-2 text-[11.5px]">
                        <a href={r.url} target="_blank" rel="noreferrer" className="ag-link truncate">{r.name}</a>
                        <span className="flex shrink-0 items-center gap-2 text-[10px] text-[var(--ag-faint)]">
                          <Star className="h-2.5 w-2.5" /> {r.stars} {r.language && <span>· {r.language}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          }}
        />

        <QueryTool
          title="Reddit Username Lookup"
          description="Perfil público via JSON do Reddit — sujeito a bloqueio de datacenter."
          toolId="reddit-user"
          toolName="Reddit Profile"
          source="Reddit Public JSON"
          placeholder="spez"
          cta="Consultar Reddit"
          attachKind="username"
          render={(data) => {
            if (!data.available) {
              return (
                <Notice tone="warn" title="Consulta automatizada indisponível">
                  {data.reason}
                  {data.manualUrl && <div className="mt-2"><a href={data.manualUrl} target="_blank" rel="noreferrer" className="ag-link">Abrir perfil manualmente →</a></div>}
                </Notice>
              );
            }
            const p = data.profile as Record<string, unknown>;
            return (
              <KV
                items={[
                  { label: "Username", value: String(p.name ?? "") },
                  { label: "Criado em", value: p.created ? formatDate(String(p.created)) : "—" },
                  { label: "Karma de posts", value: p.linkKarma as number },
                  { label: "Karma de comentários", value: p.commentKarma as number },
                  { label: "Moderador", value: Boolean(p.isMod) },
                  { label: "Verificado", value: Boolean(p.verified) },
                  { label: "Perfil", value: <a href={String(p.url)} target="_blank" rel="noreferrer" className="ag-link">{String(p.url)}</a> },
                ]}
              />
            );
          }}
        />
      </div>

      <UsernameComparison />

      <Panel title="Metodologia e limites" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
        <ul className="space-y-1.5 text-[11.5px] leading-relaxed text-[var(--ag-muted)]">
          <li>• A verificação usa apenas a resposta HTTP da URL pública — não autentica, não envia formulários e não acessa conteúdo privado.</li>
          <li>• Várias plataformas retornam 200 mesmo para perfis inexistentes (SPA). Nesses casos o resultado é marcado como “encontrado” com a recomendação de confirmação manual.</li>
          <li>• Instagram, X, TikTok e Reddit frequentemente bloqueiam requisições de datacenter; o status aparece como “bloqueado” e o link direto é fornecido.</li>
          <li>• Nenhuma inferência de identidade é feita automaticamente: correlação é uma decisão analítica registrada por você.</li>
        </ul>
      </Panel>
    </div>
  );
}

function UsernameComparison() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ a: Awaited<ReturnType<typeof usernameScan>>; b: Awaited<ReturnType<typeof usernameScan>> } | null>(null);

  const compare = async () => {
    if (!a.trim() || !b.trim()) return;
    setLoading(true); setError(null); setData(null);
    try {
      const first = await usernameScan({ data: { username: a.trim() } });
      const second = await usernameScan({ data: { username: b.trim() } });
      setData({ a: first, b: second });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const rows = data
    ? data.a.results.map((ra) => {
        const rb = data.b.results.find((x) => x.id === ra.id);
        return { plataforma: ra.platform, [a]: ra.status, [b]: rb?.status ?? "—" };
      })
    : [];

  return (
    <Panel title="Username Comparison" description="Compara em quais plataformas cada username possui perfil público (duas varreduras completas).">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[160px] flex-1">
          <label className="ag-label mb-1.5 block">Username A</label>
          <input className="ag-input" value={a} onChange={(e) => setA(e.target.value)} placeholder="usuario_a" />
        </div>
        <div className="min-w-[160px] flex-1">
          <label className="ag-label mb-1.5 block">Username B</label>
          <input className="ag-input" value={b} onChange={(e) => setB(e.target.value)} placeholder="usuario_b" />
        </div>
        <Button variant="primary" onClick={compare} disabled={loading || !a.trim() || !b.trim()}>
          {loading ? <Spinner label="" /> : <AtSign className="h-3.5 w-3.5" />} Comparar
        </Button>
      </div>
      {loading && <Spinner label="Varrendo as duas identidades…" />}
      {error && <div className="mt-3"><ErrorBox message={error} /></div>}
      {data && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2 text-[11px]">
            <Badge tone="green">{a}: {data.a.found} perfis</Badge>
            <Badge tone="green">{b}: {data.b.found} perfis</Badge>
            <Badge tone="neutral">em comum: {data.a.results.filter((ra) => data.b.results.find((rb) => rb.id === ra.id && rb.status === "found") && ra.status === "found").length}</Badge>
          </div>
          {rows.length ? <DataTable rows={rows} maxRows={30} /> : <Empty title="Sem dados" />}
          <p className="text-[10.5px] text-[var(--ag-faint)]">
            Coincidência de username é um indício fraco. Use bio, avatar, links cruzados e histórico temporal antes de concluir qualquer vínculo.
          </p>
        </div>
      )}
    </Panel>
  );
}

export function GithubBadge() {
  return <span className={cx("hidden")}><Github className="h-3 w-3" /><GithubIcon className="h-3 w-3" /><ValueView value={null} /></span>;
}
