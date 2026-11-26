import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Hash, MessageSquare, Radio, Share2, Users } from "lucide-react";
import { hackerNewsSearch, mastodonHashtag, redditSearch, socialOperators } from "@/lib/agency/api/social.functions";
import { QueryTool } from "@/components/agency/QueryTool";
import { Badge, Notice, PageHeader, Panel, ValueView } from "@/components/agency/kit";

export const Route = createFileRoute("/agency/social")({
  head: () => ({ meta: [{ title: "Social Intelligence — Life Agency" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: SocialPage,
});

function SocialPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="SOCMINT · Fontes abertas"
        title="Social Media Intelligence"
        subtitle="Conteúdo público de redes abertas: Mastodon (fediverso), Hacker News e operadores de busca para as demais plataformas. Nada de contas privadas, mensagens diretas ou bypass de autenticação."
        actions={<Badge tone="green">conteúdo público</Badge>}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <QueryTool
          title="Public Post Search (Hacker News)"
          description="Busca pública via API Algolia do Hacker News — histórias e comentários indexados."
          toolId="hn-search"
          toolName="HN Public Search"
          source="HN Algolia API"
          placeholder="ransomware · cve-2024 · empresa"
          cta="Buscar posts"
          options={[{
            key: "type", label: "Tipo", initial: "all",
            values: [{ value: "all", label: "Tudo" }, { value: "story", label: "Histórias" }, { value: "comment", label: "Comentários" }],
          }]}
          run={(v, o) => hackerNewsSearch({ data: { query: v, type: o.type as "all" } })}
          render={(data) => (
            <div className="space-y-2">
              <Badge tone="cyan">{data.total.toLocaleString("pt-BR")} resultados</Badge>
              <ul className="divide-y divide-[var(--ag-border)]">
                {data.results.map((r, i) => (
                  <li key={i} className="py-2">
                    <a href={r.url} target="_blank" rel="noreferrer" className="text-[12px] font-medium text-[#e0eaf5] hover:text-cyan-300">{r.title ?? "(comentário)"}</a>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-[var(--ag-faint)]">
                      <span>@{r.author}</span>
                      {r.points !== undefined && <span>· {r.points} pontos</span>}
                      <span>· {r.createdAt?.slice(0, 10)}</span>
                    </div>
                    {r.comment && <p className="mt-1 line-clamp-2 text-[10.5px] text-[var(--ag-muted)]">{r.comment}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        />

        <QueryTool
          title="Hashtag Research (Mastodon)"
          description="Linha do tempo pública de uma hashtag em uma instância do fediverso."
          toolId="mastodon"
          toolName="Mastodon Hashtag"
          source="Mastodon API pública"
          placeholder="osint · threatintel · seguranca"
          cta="Buscar hashtag"
          options={[{
            key: "instance", label: "Instância", initial: "mastodon.social",
            values: [
              { value: "mastodon.social", label: "mastodon.social" },
              { value: "infosec.exchange", label: "infosec.exchange" },
              { value: "mstdn.social", label: "mstdn.social" },
              { value: "hachyderm.io", label: "hachyderm.io" },
            ],
          }]}
          run={(v, o) => mastodonHashtag({ data: { tag: v, instance: o.instance, limit: 20 } })}
          render={(data) => (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="cyan">#{data.tag}</Badge>
                <Badge>{data.count} posts</Badge>
                <span className="text-[10.5px] text-[var(--ag-faint)]">{data.instance}</span>
              </div>
              <ul className="space-y-1.5">
                {data.posts.map((p) => (
                  <li key={String(p.id)} className="rounded-lg border border-[var(--ag-border)] px-2.5 py-2">
                    <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-[var(--ag-faint)]">
                      <span className="text-[#dbe6f4]">@{p.account}</span>
                      <span>· {String(p.createdAt).slice(0, 10)}</span>
                      <span>· ♥ {String(p.favourites)} · ⇄ {String(p.boosts)} · 💬 {String(p.replies)}</span>
                    </div>
                    <p className="mt-1 line-clamp-3 text-[11px] text-[var(--ag-muted)]">{String(p.content)}</p>
                    {p.url && <a href={String(p.url)} target="_blank" rel="noreferrer" className="ag-link mt-1 inline-flex items-center gap-1 text-[10px]">abrir post <ExternalLink className="h-2.5 w-2.5" /></a>}
                  </li>
                ))}
                {data.posts.length === 0 && <Notice tone="info">Nenhum post público retornado para esta hashtag nesta instância.</Notice>}
              </ul>
            </div>
          )}
        />
      </div>

      <QueryTool
        title="Public Post Search (Reddit)"
        description="Busca em posts públicos. O Reddit bloqueia com frequência requisições de datacenter — nesse caso a ferramenta oferece o link direto."
        toolId="reddit-search"
        toolName="Reddit Search"
        source="Reddit Public JSON"
        placeholder="termo de busca"
        cta="Buscar no Reddit"
        run={(v) => redditSearch({ data: { query: v, limit: 15 } })}
        render={(data) => {
          if (!data.available) {
            return (
              <Notice tone="warn" title="Busca automatizada bloqueada">
                {data.reason}
                <div className="mt-2"><a href={data.manualUrl} target="_blank" rel="noreferrer" className="ag-link">Abrir busca no Reddit →</a></div>
              </Notice>
            );
          }
          return <ValueView value={data.posts} />;
        }}
      />

      <QueryTool
        title="Social Media Search Operators"
        description="Gera consultas prontas e links oficiais para cada plataforma. A plataforma não faz scraping autenticado."
        toolId="social-operators"
        toolName="Social Operators"
        source="Mecanismos de busca"
        placeholder="marca, pessoa pública ou termo"
        cta="Gerar operadores"
        run={(v) => socialOperators({ data: { term: v } })}
        render={(data) => (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {data.operators.map((o) => (
              <a key={o.label} href={o.url} target="_blank" rel="noreferrer" className="rounded-lg border border-[var(--ag-border)] px-2.5 py-2 hover:border-cyan-400/40">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-medium text-[#dce8f5]">{o.label}</span>
                  <span className="text-[9.5px] uppercase tracking-wider text-[var(--ag-faint)]">{o.engine}</span>
                </div>
                <div className="ag-mono mt-0.5 break-all text-[10px] text-[var(--ag-faint)]">{o.query}</div>
              </a>
            ))}
          </div>
        )}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Brand Monitoring" icon={<Radio className="h-3.5 w-3.5" />} description="Fluxo recomendado para acompanhar uma marca.">
          <ol className="space-y-2 text-[11.5px] leading-relaxed text-[var(--ag-muted)]">
            <li><strong className="text-[#dbe7f4]">1.</strong> Gere operadores de busca para a marca e termos associados.</li>
            <li><strong className="text-[#dbe7f4]">2.</strong> Busque hashtags no fediverso e em mecanismos indexados.</li>
            <li><strong className="text-[#dbe7f4]">3.</strong> Registre menções relevantes como evidência em uma investigação.</li>
            <li><strong className="text-[#dbe7f4]">4.</strong> Acompanhe o Intelligence Feed para fraudes e campanhas em andamento.</li>
          </ol>
        </Panel>

        <Panel title="Public Engagement Analysis" icon={<Users className="h-3.5 w-3.5" />} description="Métricas públicas disponíveis nas fontes consultadas.">
          <ul className="space-y-1.5 text-[11.5px] text-[var(--ag-muted)]">
            <li>• Mastodon: respostas, boosts, favoritos e data de publicação.</li>
            <li>• Hacker News: pontos e data do envio.</li>
            <li>• Reddit: score e número de comentários (quando acessível).</li>
          </ul>
          <p className="mt-2 text-[10.5px] text-[var(--ag-faint)]">Métricas agregadas não são calculadas automaticamente — evita-se apresentar números inventados.</p>
        </Panel>

        <Panel title="Public Link Collection" icon={<Share2 className="h-3.5 w-3.5" />} description="Fontes abertas úteis e legítimas.">
          <ul className="space-y-1 text-[11.5px]">
            {[
              ["Bluesky (busca pública)", "https://bsky.app/search"],
              ["Mastodon (explorar)", "https://mastodon.social/explore"],
              ["Hacker News (busca)", "https://hn.algolia.com/"],
              ["GitHub (pessoas)", "https://github.com/search?type=users"],
              ["Reddit (busca)", "https://www.reddit.com/search/"],
            ].map(([label, url]) => (
              <li key={url}><a href={url} target="_blank" rel="noreferrer" className="ag-link inline-flex items-center gap-1">{label} <ExternalLink className="h-2.5 w-2.5" /></a></li>
            ))}
          </ul>
        </Panel>
      </div>

      <Notice tone="warn" title="Escopo SOCMINT">
        Coletamos apenas conteúdo que a própria plataforma expõe publicamente para visitantes não autenticados. Não acessamos mensagens privadas, contas privadas, grupos fechados ou dados de anúncios.
      </Notice>
      <span className="hidden"><MessageSquare /><Hash /></span>
    </div>
  );
}
