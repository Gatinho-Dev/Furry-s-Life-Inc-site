import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { enforceRateLimit, fetchJson, UpstreamError } from "@/lib/agency/http.server";

export type SourceStatus = { name: string; ok: boolean; detail?: string; url?: string };

/* ========================================================================== */
/* Username enumeration on public profile pages                               */
/* ========================================================================== */

type Platform = { id: string; name: string; url: (u: string) => string; category: string; marker?: RegExp };

const PLATFORMS: Platform[] = [
  { id: "github", name: "GitHub", url: (u) => `https://github.com/${u}`, category: "Dev" },
  { id: "gitlab", name: "GitLab", url: (u) => `https://gitlab.com/${u}`, category: "Dev" },
  { id: "codeberg", name: "Codeberg", url: (u) => `https://codeberg.org/${u}`, category: "Dev" },
  { id: "reddit", name: "Reddit", url: (u) => `https://www.reddit.com/user/${u}/`, category: "Fórum" },
  { id: "x", name: "X (Twitter)", url: (u) => `https://x.com/${u}`, category: "Social" },
  { id: "instagram", name: "Instagram", url: (u) => `https://www.instagram.com/${u}/`, category: "Social" },
  { id: "tiktok", name: "TikTok", url: (u) => `https://www.tiktok.com/@${u}`, category: "Social" },
  { id: "youtube", name: "YouTube", url: (u) => `https://www.youtube.com/@${u}`, category: "Vídeo" },
  { id: "twitch", name: "Twitch", url: (u) => `https://www.twitch.tv/${u}`, category: "Vídeo" },
  { id: "steam", name: "Steam", url: (u) => `https://steamcommunity.com/id/${u}`, category: "Games" },
  { id: "roblox", name: "Roblox", url: (u) => `https://www.roblox.com/user.aspx?username=${u}`, category: "Games" },
  { id: "pinterest", name: "Pinterest", url: (u) => `https://www.pinterest.com/${u}/`, category: "Social" },
  { id: "medium", name: "Medium", url: (u) => `https://medium.com/@${u}`, category: "Conteúdo" },
  { id: "deviantart", name: "DeviantArt", url: (u) => `https://www.deviantart.com/${u}`, category: "Arte" },
  { id: "behance", name: "Behance", url: (u) => `https://www.behance.net/${u}`, category: "Arte" },
  { id: "dribbble", name: "Dribbble", url: (u) => `https://dribbble.com/${u}`, category: "Arte" },
  { id: "soundcloud", name: "SoundCloud", url: (u) => `https://soundcloud.com/${u}`, category: "Áudio" },
  { id: "flickr", name: "Flickr", url: (u) => `https://www.flickr.com/people/${u}/`, category: "Imagem" },
  { id: "mastodon", name: "Mastodon (mastodon.social)", url: (u) => `https://mastodon.social/@${u}`, category: "Fediverso" },
  { id: "keybase", name: "Keybase", url: (u) => `https://keybase.io/${u}`, category: "Identidade" },
  { id: "hackernews", name: "Hacker News", url: (u) => `https://news.ycombinator.com/user?id=${u}`, category: "Fórum", marker: /No such user/i },
  { id: "kaggle", name: "Kaggle", url: (u) => `https://www.kaggle.com/${u}`, category: "Dados" },
  { id: "npm", name: "npm", url: (u) => `https://www.npmjs.com/~${u}`, category: "Dev" },
  { id: "pypi", name: "PyPI", url: (u) => `https://pypi.org/user/${u}/`, category: "Dev" },
  { id: "dockerhub", name: "Docker Hub", url: (u) => `https://hub.docker.com/u/${u}`, category: "Dev" },
  { id: "gravatar", name: "Gravatar", url: (u) => `https://gravatar.com/${u}`, category: "Identidade" },
];

async function probe(url: string): Promise<{ status: number; body?: string; error?: string }> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(9000),
    });
    let body: string | undefined;
    if (res.status === 200) {
      body = (await res.text()).slice(0, 6000);
    } else {
      await res.body?.cancel().catch(() => {});
    }
    return { status: res.status, body };
  } catch (e) {
    return { status: 0, error: (e as Error).message };
  }
}

export const usernameScan = createServerFn({ method: "POST" })
  .inputValidator(z.object({ username: z.string().min(2).max(40) }))
  .handler(async ({ data }) => {
    await enforceRateLimit("username-scan", 1, 6);
    const username = data.username.trim().replace(/^@/, "");
    if (!/^[a-z0-9._-]{2,40}$/i.test(username)) throw new UpstreamError("Username inválido (use letras, números, ponto, hífen ou underscore).", 400, "validation");
    const queriedAt = new Date().toISOString();

    const queue = [...PLATFORMS];
    const results: Array<{
      platform: string; id: string; category: string; url: string;
      status: "found" | "not_found" | "unknown" | "blocked";
      httpStatus: number; detail?: string;
    }> = [];
    const workers = Array.from({ length: 6 }, async () => {
      for (;;) {
        const p = queue.shift();
        if (!p) return;
        const url = p.url(username);
        const res = await probe(url);
        let status: "found" | "not_found" | "unknown" | "blocked" = "unknown";
        let detail: string | undefined;
        if (res.status === 200) {
          if (p.marker && res.body && p.marker.test(res.body)) {
            status = "not_found";
            detail = "Página respondeu 200, mas contém indicador de usuário inexistente.";
          } else {
            status = "found";
            detail = "Página respondeu 200. Confirme manualmente que é o mesmo perfil.";
          }
        } else if (res.status === 404) {
          status = "not_found";
        } else if (res.status === 403 || res.status === 429) {
          status = "blocked";
          detail = `Plataforma bloqueou a verificação automática (HTTP ${res.status}).`;
        } else if (res.status === 0) {
          status = "unknown";
          detail = res.error;
        } else {
          status = "unknown";
          detail = `HTTP ${res.status}`;
        }
        results.push({ platform: p.name, id: p.id, category: p.category, url, status, httpStatus: res.status, detail });
      }
    });
    await Promise.all(workers);
    results.sort((a, b) => (a.status === b.status ? a.platform.localeCompare(b.platform) : a.status === "found" ? -1 : b.status === "found" ? 1 : 0));

    return {
      username,
      queriedAt,
      checked: PLATFORMS.length,
      found: results.filter((r) => r.status === "found").length,
      blocked: results.filter((r) => r.status === "blocked").length,
      results,
      disclaimer: "Um perfil com o mesmo username não prova que pertence à mesma pessoa. Verifique foto, bio, links e histórico antes de correlacionar.",
      source: { name: "Perfis públicos das plataformas", ok: true },
    };
  });

/* ========================================================================== */
/* GitHub                                                                     */
/* ========================================================================== */

type GhUser = {
  login: string; id: number; name?: string; company?: string; blog?: string; location?: string;
  email?: string; bio?: string; twitter_username?: string; public_repos: number; public_gists: number;
  followers: number; following: number; created_at: string; updated_at: string; avatar_url: string; html_url: string;
  hireable?: boolean; site_admin?: boolean;
};

type GhRepo = {
  name: string; html_url: string; description?: string; language?: string; stargazers_count: number;
  forks_count: number; updated_at: string; fork: boolean; archived?: boolean;
};

export const githubUser = createServerFn({ method: "POST" })
  .inputValidator(z.object({ username: z.string().min(1).max(60) }))
  .handler(async ({ data }) => {
    await enforceRateLimit("github", 1, 12);
    const username = data.username.trim().replace(/^@/, "");
    if (!/^[a-z0-9-]{1,39}$/i.test(username)) throw new UpstreamError("Username do GitHub inválido.", 400, "validation");
    try {
      const user = await fetchJson<GhUser>(`https://api.github.com/users/${encodeURIComponent(username)}`, {
        headers: { accept: "application/vnd.github+json", "user-agent": "LifeAgency-OSINT" },
        timeoutMs: 12000,
      });
      const repos = await fetchJson<GhRepo[]>(
        `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`,
        { headers: { accept: "application/vnd.github+json", "user-agent": "LifeAgency-OSINT" }, timeoutMs: 15000 },
      ).catch(() => [] as GhRepo[]);
      const languages = new Map<string, number>();
      for (const r of repos) if (r.language) languages.set(r.language, (languages.get(r.language) ?? 0) + 1);
      return {
        found: true,
        queriedAt: new Date().toISOString(),
        profile: {
          login: user.login,
          id: user.id,
          name: user.name,
          company: user.company,
          blog: user.blog,
          location: user.location,
          bio: user.bio,
          twitter: user.twitter_username,
          publicRepos: user.public_repos,
          gists: user.public_gists,
          followers: user.followers,
          following: user.following,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
          url: user.html_url,
          avatar: user.avatar_url,
        },
        repositories: repos
          .sort((a, b) => b.stargazers_count - a.stargazers_count)
          .slice(0, 30)
          .map((r) => ({
            name: r.name, description: r.description, language: r.language,
            stars: r.stargazers_count, forks: r.forks_count, updatedAt: r.updated_at,
            url: r.html_url, archived: r.archived, fork: r.fork,
          })),
        topLanguages: [...languages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
        source: { name: "GitHub Public API", ok: true, url: user.html_url },
      };
    } catch (e) {
      const msg = (e as Error).message;
      if (/404/.test(msg)) return { found: false as const, queriedAt: new Date().toISOString(), message: "Usuário não encontrado no GitHub." };
      throw new UpstreamError(msg.includes("403") ? "Limite de requisições do GitHub atingido (60/h sem token). Tente mais tarde." : msg, 502, "github");
    }
  });

export const githubSearch = createServerFn({ method: "POST" })
  .inputValidator(z.object({ query: z.string().min(1).max(150), limit: z.number().min(1).max(30).optional() }))
  .handler(async ({ data }) => {
    await enforceRateLimit("github-search", 1, 8);
    const json = await fetchJson<{ total_count: number; items: Array<Record<string, any>> }>(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(data.query)}&sort=stars&per_page=${data.limit ?? 15}`,
      { headers: { accept: "application/vnd.github+json", "user-agent": "LifeAgency-OSINT" }, timeoutMs: 15000 },
    );
    return {
      query: data.query,
      total: json.total_count,
      queriedAt: new Date().toISOString(),
      results: json.items.map((r) => ({
        name: r.full_name,
        description: r.description,
        stars: r.stargazers_count,
        language: r.language,
        url: r.html_url,
        updatedAt: r.updated_at,
      })),
      source: { name: "GitHub Code Search API", ok: true },
    };
  });

/* ========================================================================== */
/* Reddit (may be blocked from datacenter IPs — reported honestly)            */
/* ========================================================================== */

export const redditUser = createServerFn({ method: "POST" })
  .inputValidator(z.object({ username: z.string().min(2).max(40) }))
  .handler(async ({ data }) => {
    await enforceRateLimit("reddit", 1, 8);
    const username = data.username.trim().replace(/^@/, "").replace(/^u\//, "");
    try {
      const json = await fetchJson<{ data?: Record<string, any>; message?: string; error?: number }>(
        `https://www.reddit.com/user/${encodeURIComponent(username)}/about.json`,
        { headers: { "user-agent": "Mozilla/5.0 (compatible; LifeAgency-OSINT/3.0)" }, timeoutMs: 12000 },
      );
      const d = json.data ?? {};
      return {
        available: true as const,
        queriedAt: new Date().toISOString(),
        profile: {
          name: d.name,
          created: d.created_utc ? new Date(Number(d.created_utc) * 1000).toISOString() : undefined,
          linkKarma: d.link_karma,
          commentKarma: d.comment_karma,
          isMod: d.is_mod,
          verified: d.verified,
          isEmployee: d.is_employee,
          url: `https://www.reddit.com/user/${username}`,
          icon: d.icon_img,
        },
        source: { name: "Reddit Public JSON", ok: true },
      };
    } catch (e) {
      const msg = (e as Error).message;
      return {
        available: false as const,
        queriedAt: new Date().toISOString(),
        reason: /403/.test(msg)
          ? "O Reddit bloqueia requisições automáticas vindas deste servidor (HTTP 403). Abra o perfil manualmente no link abaixo."
          : /404/.test(msg) ? "Usuário não encontrado no Reddit." : msg,
        manualUrl: `https://www.reddit.com/user/${encodeURIComponent(username)}`,
        source: { name: "Reddit Public JSON", ok: false, detail: "Acesso automatizado bloqueado pelo Reddit." },
      };
    }
  });

export const redditSearch = createServerFn({ method: "POST" })
  .inputValidator(z.object({ query: z.string().min(2).max(120), limit: z.number().min(1).max(25).optional() }))
  .handler(async ({ data }) => {
    await enforceRateLimit("reddit", 1, 6);
    try {
      const json = await fetchJson<{ data?: { children?: Array<{ data: Record<string, any> }> } }>(
        `https://www.reddit.com/search.json?q=${encodeURIComponent(data.query)}&limit=${data.limit ?? 15}&sort=relevance`,
        { headers: { "user-agent": "Mozilla/5.0 (compatible; LifeAgency-OSINT/3.0)" }, timeoutMs: 12000 },
      );
      const posts = (json.data?.children ?? []).map((c) => ({
        title: c.data.title,
        subreddit: c.data.subreddit,
        author: c.data.author,
        score: c.data.score,
        comments: c.data.num_comments,
        created: c.data.created_utc ? new Date(Number(c.data.created_utc) * 1000).toISOString() : undefined,
        url: c.data.permalink ? `https://www.reddit.com${c.data.permalink}` : undefined,
      }));
      return { available: true as const, query: data.query, queriedAt: new Date().toISOString(), posts, source: { name: "Reddit Public JSON", ok: true } };
    } catch (e) {
      return {
        available: false as const,
        query: data.query,
        queriedAt: new Date().toISOString(),
        reason: "O Reddit bloqueia buscas automatizadas deste servidor. Use os links de operadores abaixo para abrir a busca no navegador.",
        manualUrl: `https://www.reddit.com/search/?q=${encodeURIComponent(data.query)}`,
        source: { name: "Reddit Public JSON", ok: false, detail: (e as Error).message },
      };
    }
  });

/* ========================================================================== */
/* Mastodon + Hacker News (public, no auth)                                   */
/* ========================================================================== */

export const mastodonHashtag = createServerFn({ method: "POST" })
  .inputValidator(z.object({ tag: z.string().min(1).max(60), instance: z.string().max(120).optional(), limit: z.number().min(1).max(40).optional() }))
  .handler(async ({ data }) => {
    await enforceRateLimit("mastodon", 1, 10);
    const tag = data.tag.trim().replace(/^#/, "").toLowerCase();
    if (!/^[a-z0-9_]+$/.test(tag)) throw new UpstreamError("Hashtag inválida.", 400, "validation");
    const instance = (data.instance ?? "mastodon.social").replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(instance)) throw new UpstreamError("Instância inválida.", 400, "validation");
    const json = await fetchJson<Array<Record<string, any>>>(
      `https://${instance}/api/v1/timelines/tag/${encodeURIComponent(tag)}?limit=${data.limit ?? 20}`,
      { timeoutMs: 12000 },
    );
    return {
      tag,
      instance,
      queriedAt: new Date().toISOString(),
      count: json.length,
      posts: json.map((p) => ({
        id: p.id,
        url: p.url,
        content: String(p.content ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400),
        createdAt: p.created_at,
        account: (p.account as { acct?: string; display_name?: string; url?: string } | undefined)?.acct,
        displayName: (p.account as { display_name?: string } | undefined)?.display_name,
        replies: p.replies_count,
        boosts: p.reblogs_count,
        favourites: p.favourites_count,
      })),
      source: { name: `Mastodon (${instance})`, ok: true, url: `https://${instance}/tags/${tag}` },
    };
  });

export const hackerNewsSearch = createServerFn({ method: "POST" })
  .inputValidator(z.object({ query: z.string().min(1).max(120), type: z.enum(["story", "comment", "all"]).optional() }))
  .handler(async ({ data }) => {
    await enforceRateLimit("hn", 1, 15);
    const tags = data.type === "story" ? "story" : data.type === "comment" ? "comment" : "(story,comment)";
    const json = await fetchJson<{ hits: Array<Record<string, any>>; nbHits: number }>(
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(data.query)}&tags=${tags}&hitsPerPage=20`,
      { timeoutMs: 12000 },
    );
    return {
      query: data.query,
      total: json.nbHits,
      queriedAt: new Date().toISOString(),
      results: json.hits.map((h) => ({
        title: h.title ?? h.story_title,
        author: h.author,
        points: h.points,
        createdAt: h.created_at,
        url: h.url ?? (h.objectID ? `https://news.ycombinator.com/item?id=${h.objectID}` : undefined),
        comment: h.comment_text ? String(h.comment_text).replace(/<[^>]+>/g, " ").slice(0, 240) : undefined,
      })),
      source: { name: "HN Algolia Public API", ok: true },
    };
  });

export const socialOperators = createServerFn({ method: "POST" })
  .inputValidator(z.object({ term: z.string().min(1).max(120) }))
  .handler(async ({ data }) => {
    const t = data.term.trim();
    const q = encodeURIComponent(t);
    const qq = encodeURIComponent(`"${t}"`);
    return {
      term: t,
      queriedAt: new Date().toISOString(),
      operators: [
        { label: "Posts públicos no X", engine: "Google", query: `site:x.com ${qq}`, url: `https://www.google.com/search?q=site%3Ax.com+${qq}` },
        { label: "Posts no Bluesky", engine: "Google", query: `site:bsky.app ${qq}`, url: `https://www.google.com/search?q=site%3Absky.app+${qq}` },
        { label: "Mastodon", engine: "Google", query: `site:mastodon.social ${qq}`, url: `https://www.google.com/search?q=site%3Amastodon.social+${qq}` },
        { label: "Reddit", engine: "Reddit", query: t, url: `https://www.reddit.com/search/?q=${q}` },
        { label: "LinkedIn (indexado)", engine: "Bing", query: `site:linkedin.com ${qq}`, url: `https://www.bing.com/search?q=site%3Alinkedin.com+${qq}` },
        { label: "PDFs e documentos", engine: "Google", query: `${qq} filetype:pdf`, url: `https://www.google.com/search?q=${qq}+filetype%3Apdf` },
        { label: "Menções em notícias", engine: "Google News", query: t, url: `https://news.google.com/search?q=${q}` },
        { label: "Imagens (Google Lens)", engine: "Google Lens", query: t, url: `https://lens.google.com/uploadbyurl?url=${q}` },
      ],
      source: { name: "Operadores de busca (links oficiais)", ok: true },
    };
  });
