/**
 * Identity discovery — public, key-free sources.
 *
 * Every function returns normalized `IdentitySourceResult` objects with
 * provenance and an explicit confidence. Nothing is inferred as fact.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { cached, enforceRateLimit, fetchJson, UpstreamError } from "@/lib/agency/http.server";
import { SHERLOCK_SITES, SHERLOCK_SITE_MAP } from "@/lib/agency/identity/sherlock-sites";
import type { IdentityProfile, IdentitySignal, IdentitySourceResult, ScanSiteResult } from "@/lib/agency/identity/types";
import { md5 } from "@/lib/agency/format";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const normUser = (v: string) => v.trim().replace(/^@/, "");
const now = () => new Date().toISOString();

function signal(
  sourceId: string,
  source: string,
  kind: IdentitySignal["kind"],
  value: string,
  confidence: IdentitySignal["confidence"],
  reason: string,
  url?: string,
  label?: string,
): IdentitySignal {
  return {
    id: `${sourceId}:${kind}:${value.trim().toLowerCase().slice(0, 80)}`,
    kind,
    value: value.trim(),
    label,
    source,
    sourceId,
    url,
    confidence,
    reason,
    at: now(),
  };
}

function stripHtml(value: string | undefined | null): string {
  return (value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function extractContacts(text: string | undefined, sourceId: string, source: string): IdentitySignal[] {
  const out: IdentitySignal[] = [];
  const clean = stripHtml(text);
  if (!clean) return out;
  for (const match of clean.matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g)) {
    const email = match[0].replace(/[.,;)]+$/, "");
    if (out.some((s) => s.value === email)) continue;
    out.push(signal(sourceId, source, "email", email, "probable", "E-mail escrito no texto público do perfil (auto-declarado, não verificado)."));
  }
  for (const match of clean.matchAll(/https?:\/\/[^\s)<>"']+/g)) {
    if (out.filter((s) => s.kind === "url").length >= 3) break;
    const url = match[0].replace(/[.,;)]+$/, "");
    out.push(signal(sourceId, source, "url", url, "probable", "Link presente no texto público do perfil.", url));
  }
  return out;
}

async function sha256HexBytes(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function avatarHash(url: string | undefined): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "image/*" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return undefined;
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > 900_000) return undefined;
    return await sha256HexBytes(buffer);
  } catch {
    return undefined;
  }
}

/* ========================================================================== */
/* Sherlock-compatible presence scan (batched)                                */
/* ========================================================================== */

function assertSiteUrl(url: string): URL {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new UpstreamError("Somente https.", 400, "validation");
  const host = parsed.hostname.toLowerCase();
  if (!host.includes(".") || /^\d+\.\d+\.\d+\.\d+$/.test(host) || /\.(local|localhost|internal|lan|onion)$/.test(host)) {
    throw new UpstreamError("Host não permitido.", 400, "validation");
  }
  return parsed;
}

async function probeSite(url: string, notFound: string[] | undefined): Promise<{ status: number; body?: string; error?: string }> {
  try {
    assertSiteUrl(url);
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml", "accept-language": "pt-BR,pt;q=0.9,en;q=0.8" },
      signal: AbortSignal.timeout(6000),
    });
    let body: string | undefined;
    if (res.ok) body = (await res.text()).slice(0, 12000);
    else await res.body?.cancel().catch(() => {});
    return { status: res.status, body };
  } catch (e) {
    return { status: 0, error: (e as Error).message };
  }
}

export const usernameScanBatch = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    username: z.string().min(2).max(40),
    siteIds: z.array(z.string().min(1).max(60)).min(1).max(24),
  }))
  .handler(async ({ data }) => {
    await enforceRateLimit("sherlock-scan", 1, 60);
    const username = normUser(data.username);
    if (!/^[a-z0-9._-]{2,40}$/i.test(username)) throw new UpstreamError("Username inválido.", 400, "validation");

    const sites = data.siteIds
      .map((id) => SHERLOCK_SITE_MAP.get(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));

    const results: ScanSiteResult[] = [];
    const queue = [...sites];
    const workers = Array.from({ length: 6 }, async () => {
      for (;;) {
        const site = queue.shift();
        if (!site) return;
        const url = site.url.replace("{}", encodeURIComponent(username));
        const base: ScanSiteResult = { id: site.id, name: site.name, category: site.category, url, status: "unknown", httpStatus: 0 };

        if (site.regex) {
          try {
            if (!new RegExp(site.regex).test(username)) {
              results.push({ ...base, status: "not_found", detail: "Username não atende ao padrão desta plataforma." });
              continue;
            }
          } catch { /* ignore invalid pattern from data snapshot */ }
        }

        const cachedProbe = await cached(`sherlock:${site.id}:${username.toLowerCase()}`, 10 * 60_000, () => probeSite(url, site.notFound));
        base.httpStatus = cachedProbe.status;

        if (cachedProbe.status === 200) {
          if (site.notFound?.length && cachedProbe.body && site.notFound.some((m) => cachedProbe.body!.includes(m))) {
            base.status = "not_found";
            base.detail = "Página existe, mas contém a mensagem de usuário inexistente usada pelo Sherlock.";
          } else {
            base.status = "found";
            base.detail = "Página pública respondeu 200. Confirme visualmente que é o mesmo perfil.";
          }
        } else if (cachedProbe.status === 404 || cachedProbe.status === 410) {
          base.status = "not_found";
        } else if (cachedProbe.status === 403 || cachedProbe.status === 429) {
          base.status = "blocked";
          base.detail = `Plataforma bloqueou a verificação automática (HTTP ${cachedProbe.status}). Use o link.`;
        } else if (cachedProbe.status === 0) {
          base.detail = cachedProbe.error;
        } else {
          base.detail = `HTTP ${cachedProbe.status}`;
        }
        results.push(base);
      }
    });
    await Promise.all(workers);

    return {
      username,
      queriedAt: now(),
      requested: sites.length,
      found: results.filter((r) => r.status === "found").length,
      blocked: results.filter((r) => r.status === "blocked").length,
      results,
      source: { name: "Sherlock Project (MIT) · sites públicos", ok: true, url: "https://github.com/sherlock-project/sherlock" },
    };
  });

export const sherlockCatalog = createServerFn({ method: "POST" })
  .inputValidator(z.object({}))
  .handler(async () => {
    const byCategory = new Map<string, number>();
    for (const site of SHERLOCK_SITES) byCategory.set(site.category, (byCategory.get(site.category) ?? 0) + 1);
    return {
      total: SHERLOCK_SITES.length,
      ids: SHERLOCK_SITES.map((s) => s.id),
      categories: [...byCategory.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
      license: "MIT · Sherlock Project",
      source: "https://github.com/sherlock-project/sherlock",
    };
  });

/* ========================================================================== */
/* GitHub public identity                                                     */
/* ========================================================================== */

type GhUser = {
  login: string; id: number; name?: string; company?: string; blog?: string; location?: string;
  email?: string; bio?: string; twitter_username?: string; public_repos: number; followers: number;
  created_at: string; updated_at: string; avatar_url: string; html_url: string;
};
type GhSocial = { provider: string; url: string };
type GhKey = { id: number; key: string };
type GhGpgKey = { id: number; key_id: string; emails?: Array<{ email: string; verified: boolean }>; raw_key?: string };

export const identityGithub = createServerFn({ method: "POST" })
  .inputValidator(z.object({ username: z.string().min(1).max(60) }))
  .handler(async ({ data }): Promise<IdentitySourceResult> => {
    await enforceRateLimit("identity-github", 1, 10);
    const username = normUser(data.username);
    if (!/^[a-z0-9-]{1,39}$/i.test(username)) return { id: "github", name: "GitHub", ok: false, note: "Login do GitHub inválido.", profiles: [], signals: [] };
    try {
      const [user, socials, keys, gpg] = await Promise.all([
        cached(`identity:gh:${username.toLowerCase()}`, 10 * 60_000, () => fetchJson<GhUser>(`https://api.github.com/users/${encodeURIComponent(username)}`, {
          headers: { accept: "application/vnd.github+json", "user-agent": "LifeAgency-OSINT" }, timeoutMs: 12000,
        })),
        cached(`identity:gh:social:${username.toLowerCase()}`, 10 * 60_000, () => fetchJson<GhSocial[]>(`https://api.github.com/users/${encodeURIComponent(username)}/social_accounts`, {
          headers: { accept: "application/vnd.github+json", "user-agent": "LifeAgency-OSINT" }, timeoutMs: 12000,
        }).catch(() => [])),
        cached(`identity:gh:keys:${username.toLowerCase()}`, 10 * 60_000, () => fetchJson<GhKey[]>(`https://api.github.com/users/${encodeURIComponent(username)}/keys`, {
          headers: { accept: "application/vnd.github+json", "user-agent": "LifeAgency-OSINT" }, timeoutMs: 12000,
        }).catch(() => [])),
        cached(`identity:gh:gpg:${username.toLowerCase()}`, 10 * 60_000, () => fetchJson<GhGpgKey[]>(`https://api.github.com/users/${encodeURIComponent(username)}/gpg_keys`, {
          headers: { accept: "application/vnd.github+json", "user-agent": "LifeAgency-OSINT" }, timeoutMs: 12000,
        }).catch(() => [])),
      ]);

      const hash = await avatarHash(user.avatar_url);
      const signals: IdentitySignal[] = [
        signal("github", "GitHub", "username", user.login, "confirmed", "Identidade da plataforma (perfil público do GitHub).", user.html_url),
        signal("github", "GitHub", "url", user.html_url, "confirmed", "URL pública do perfil.", user.html_url),
      ];
      if (user.name) signals.push(signal("github", "GitHub", "person", user.name, "probable", "Nome exibido no perfil público (auto-declarado).", user.html_url));
      if (user.email) signals.push(signal("github", "GitHub", "email", user.email, "confirmed", "E-mail publicado explicitamente no perfil do GitHub.", user.html_url));
      if (user.blog) {
        const blog = /^https?:\/\//i.test(user.blog) ? user.blog : `https://${user.blog}`;
        signals.push(signal("github", "GitHub", "url", blog, "confirmed", "Site declarado no perfil do GitHub.", blog));
        try {
          const domain = new URL(blog).hostname.replace(/^www\./, "");
          signals.push(signal("github", "GitHub", "domain", domain, "probable", "Domínio derivado do site declarado no perfil."));
        } catch { /* invalid blog url */ }
      }
      if (user.company) signals.push(signal("github", "GitHub", "organization", user.company.replace(/^@/, ""), "probable", "Empresa declarada no perfil público."));
      if (user.location) signals.push(signal("github", "GitHub", "location", user.location, "unconfirmed", "Localização auto-declarada, sem verificação."));
      if (user.twitter_username) signals.push(signal("github", "GitHub", "username", user.twitter_username, "confirmed", "Conta do X declarada no próprio perfil do GitHub.", `https://x.com/${user.twitter_username}`));
      for (const account of socials.slice(0, 10)) {
        signals.push(signal("github", "GitHub", "url", account.url, "confirmed", `Link cadastrado pelo próprio usuário no GitHub (${account.provider}).`, account.url));
        const handle = account.url.split("/").filter(Boolean).pop();
        if (handle) signals.push(signal("github", "GitHub", "username", handle, "probable", `Identificador derivado do link ${account.provider} cadastrado no GitHub.`, account.url));
      }
      for (const key of keys.slice(0, 5)) {
        const parts = key.key.split(/\s+/);
        const tail = (parts[1] ?? "").slice(-8);
        signals.push(signal("github", "GitHub", "crypto_key", `${parts[0] ?? "ssh"} …${tail}`, "confirmed", "Chave SSH pública cadastrada no perfil do GitHub.", `${user.html_url}.keys`));
      }
      for (const key of gpg.slice(0, 5)) {
        if (key.key_id) signals.push(signal("github", "GitHub", "crypto_key", key.key_id, "confirmed", "Chave GPG pública cadastrada no GitHub.", `${user.html_url}.gpg`));
        for (const email of key.emails ?? []) {
          if (email.verified) signals.push(signal("github", "GitHub", "email", email.email, "probable", "E-mail associado a uma chave GPG verificada no GitHub."));
        }
      }
      for (const extra of extractContacts(user.bio, "github", "GitHub")) signals.push(extra);

      const fields: IdentityProfile["fields"] = [
        { label: "Repositórios", value: String(user.public_repos) },
        { label: "Seguidores", value: String(user.followers) },
        { label: "Criado em", value: user.created_at.slice(0, 10) },
        { label: "Social accounts", value: String(socials.length) },
        { label: "Chaves SSH/GPG", value: `${keys.length} / ${gpg.length}` },
      ];

      return {
        id: "github",
        name: "GitHub",
        ok: true,
        url: user.html_url,
        profiles: [{
          source: "GitHub", username: user.login, displayName: user.name ?? user.login, bio: user.bio ?? undefined,
          avatar: user.avatar_url, avatarHash: hash, location: user.location ?? undefined,
          company: user.company ?? undefined, joined: user.created_at, url: user.html_url, fields,
        }],
        signals,
        raw: { user, socials, keys, gpg },
      };
    } catch (e) {
      const msg = (e as Error).message;
      return {
        id: "github", name: "GitHub", ok: false,
        note: /404/.test(msg) ? "Login não encontrado no GitHub." : /403/.test(msg) ? "Limite público do GitHub atingido (60/h). Tente mais tarde." : msg,
        profiles: [], signals: [],
      };
    }
  });

/* ========================================================================== */
/* Keybase — cryptographic proofs                                             */
/* ========================================================================== */

type KeybaseLookup = {
  status?: { code: number; name: string; desc?: string };
  them?: Array<{
    basics?: { username?: string; ctime?: number; full_name?: string; location?: string; bio?: string };
    profile?: { full_name?: string; location?: string; bio?: string; avatar?: string };
    proofs?: { all?: Array<{ proof_type?: string; nametag?: string; service_url?: string; human_url?: string; proof_id?: string }> };
    public_keys?: { primary?: { kid?: string }; pgp_public_keys?: string[] };
  }>;
};

export const identityKeybase = createServerFn({ method: "POST" })
  .inputValidator(z.object({ username: z.string().min(1).max(60) }))
  .handler(async ({ data }): Promise<IdentitySourceResult> => {
    await enforceRateLimit("identity-keybase", 1, 12);
    const username = normUser(data.username);
    try {
      const json = await cached(`identity:keybase:${username.toLowerCase()}`, 10 * 60_000, () => fetchJson<KeybaseLookup>(
        `https://keybase.io/_/api/1.0/user/lookup.json?username=${encodeURIComponent(username)}&fields=basics,profile,proofs,public_keys`,
        { headers: { accept: "application/json", "user-agent": "LifeAgency-OSINT" }, timeoutMs: 12000 },
      ));
      const them = json.them?.[0];
      if (!them) {
        return { id: "keybase", name: "Keybase", ok: false, note: "Nenhum perfil público do Keybase com esse username.", profiles: [], signals: [] };
      }
      const proofList = (them.proofs?.all ?? []).filter((p) => p.proof_type && p.nametag);
      const signals: IdentitySignal[] = [
        signal("keybase", "Keybase", "username", username, "confirmed", "Conta pública do Keybase.", `https://keybase.io/${username}`),
      ];
      const fullName = them.profile?.full_name ?? them.basics?.full_name;
      if (fullName) signals.push(signal("keybase", "Keybase", "person", fullName, "probable", "Nome declarado no perfil do Keybase.", `https://keybase.io/${username}`));
      if (them.basics?.location) signals.push(signal("keybase", "Keybase", "location", them.basics.location, "unconfirmed", "Localização auto-declarada no Keybase."));
      const kid = them.public_keys?.primary?.kid;
      if (kid) signals.push(signal("keybase", "Keybase", "crypto_key", kid, "confirmed", "Chave pública principal do Keybase."));
      for (const proof of proofList.slice(0, 12)) {
        const value = proof.nametag!;
        const url = proof.human_url ?? proof.service_url;
        signals.push(signal("keybase", "Keybase", "username", value, "confirmed",
          `Prova criptográfica publicada no Keybase (${proof.proof_type}).`, url));
      }
      const avatarUrl = `https://keybase.io/${encodeURIComponent(username)}/picture`;
      const hash = await avatarHash(avatarUrl);
      const fields: IdentityProfile["fields"] = [
        { label: "Provas verificadas", value: String(proofList.length) },
        { label: "Chave principal", value: kid ? `${kid.slice(0, 12)}…` : "não publicada" },
      ];
      for (const proof of proofList.slice(0, 8)) {
        fields.push({ label: proof.proof_type ?? "prova", value: proof.nametag!, url: proof.human_url ?? proof.service_url });
      }
      return {
        id: "keybase", name: "Keybase", ok: true, url: `https://keybase.io/${username}`,
        profiles: [{
          source: "Keybase", username, displayName: fullName, bio: them.basics?.bio ?? them.profile?.bio,
          avatar: avatarUrl, avatarHash: hash, location: them.basics?.location, url: `https://keybase.io/${username}`,
          joined: them.basics?.ctime ? new Date(them.basics.ctime * 1000).toISOString() : undefined,
          fields,
        }],
        signals,
        raw: them,
      };
    } catch (e) {
      return { id: "keybase", name: "Keybase", ok: false, note: (e as Error).message, profiles: [], signals: [] };
    }
  });

/* ========================================================================== */
/* Hacker News                                                                */
/* ========================================================================== */

type HnUser = { username?: string; about?: string; karma?: number; created_at?: string; id?: string };

export const identityHackerNews = createServerFn({ method: "POST" })
  .inputValidator(z.object({ username: z.string().min(1).max(60) }))
  .handler(async ({ data }): Promise<IdentitySourceResult> => {
    await enforceRateLimit("identity-hn", 1, 20);
    const username = normUser(data.username);
    try {
      const user = await cached(`identity:hn:${username.toLowerCase()}`, 10 * 60_000, () => fetchJson<HnUser>(
        `https://hn.algolia.com/api/v1/users/${encodeURIComponent(username)}`,
        { headers: { accept: "application/json", "user-agent": "LifeAgency-OSINT" }, timeoutMs: 10000 },
      ));
      if (!user?.username) return { id: "hackernews", name: "Hacker News", ok: false, note: "Nenhum perfil público no Hacker News.", profiles: [], signals: [] };
      const about = stripHtml(user.about);
      const signals: IdentitySignal[] = [
        signal("hackernews", "Hacker News", "username", user.username, "confirmed", "Conta pública do Hacker News.", `https://news.ycombinator.com/user?id=${user.username}`),
      ];
      for (const extra of extractContacts(about, "hackernews", "Hacker News")) signals.push(extra);
      return {
        id: "hackernews", name: "Hacker News", ok: true,
        url: `https://news.ycombinator.com/user?id=${user.username}`,
        profiles: [{
          source: "Hacker News", username: user.username, bio: about || undefined,
          joined: user.created_at, url: `https://news.ycombinator.com/user?id=${user.username}`,
          fields: [{ label: "Karma", value: String(user.karma ?? 0) }],
        }],
        signals, raw: user,
      };
    } catch (e) {
      return { id: "hackernews", name: "Hacker News", ok: false, note: (e as Error).message, profiles: [], signals: [] };
    }
  });

/* ========================================================================== */
/* Mastodon (public account lookup)                                           */
/* ========================================================================== */

type MastodonAccount = {
  id: string; username: string; acct: string; display_name?: string; note?: string; url?: string;
  avatar?: string; created_at?: string; fields?: Array<{ name: string; value: string; verified_at?: string | null }>;
};

export const identityMastodon = createServerFn({ method: "POST" })
  .inputValidator(z.object({ username: z.string().min(1).max(60), instance: z.string().max(120).optional() }))
  .handler(async ({ data }): Promise<IdentitySourceResult> => {
    await enforceRateLimit("identity-mastodon", 1, 15);
    const username = normUser(data.username);
    const instance = (data.instance ?? "mastodon.social").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(instance)) {
      return { id: "mastodon", name: "Mastodon", ok: false, note: "Instância inválida.", profiles: [], signals: [] };
    }
    try {
      const account = await cached(`identity:mastodon:${instance}:${username.toLowerCase()}`, 10 * 60_000, () => fetchJson<MastodonAccount>(
        `https://${instance}/api/v1/accounts/lookup?acct=${encodeURIComponent(username)}`,
        { headers: { accept: "application/json", "user-agent": "LifeAgency-OSINT" }, timeoutMs: 12000 },
      ));
      if (!account?.username) return { id: "mastodon", name: "Mastodon", ok: false, note: `Nenhuma conta @${username} na instância ${instance}.`, profiles: [], signals: [] };
      const note = stripHtml(account.note);
      const url = account.url ?? `https://${instance}/@${account.username}`;
      const signals: IdentitySignal[] = [
        signal("mastodon", "Mastodon", "username", account.acct ?? `${account.username}@${instance}`, "confirmed", "Conta pública na instância consultada.", url),
      ];
      for (const field of account.fields ?? []) {
        const value = stripHtml(field.value);
        if (!value) continue;
        if (/^https?:\/\//i.test(value)) signals.push(signal("mastodon", "Mastodon", "url", value, field.verified_at ? "confirmed" : "probable", field.verified_at ? `Link verificado no perfil do Mastodon (${field.name}).` : `Link declarado no perfil (${field.name}).`, value));
      }
      for (const extra of extractContacts(note, "mastodon", "Mastodon")) signals.push(extra);
      return {
        id: "mastodon", name: "Mastodon", ok: true, url,
        profiles: [{
          source: `Mastodon (${instance})`, username: account.acct, displayName: account.display_name ?? account.username,
          bio: note || undefined, avatar: account.avatar, avatarHash: await avatarHash(account.avatar),
          joined: account.created_at, url,
          fields: (account.fields ?? []).map((f) => ({ label: f.name, value: stripHtml(f.value), url: /^https?:/i.test(f.value) ? stripHtml(f.value) : undefined })),
        }],
        signals, raw: account,
      };
    } catch (e) {
      return { id: "mastodon", name: "Mastodon", ok: false, note: (e as Error).message, profiles: [], signals: [] };
    }
  });

/* ========================================================================== */
/* GitLab                                                                     */
/* ========================================================================== */

type GitlabUser = {
  username: string; name?: string; bio?: string; location?: string; public_email?: string;
  website_url?: string; twitter?: string; linkedin?: string; created_at?: string; web_url?: string; avatar_url?: string;
};

export const identityGitlab = createServerFn({ method: "POST" })
  .inputValidator(z.object({ username: z.string().min(1).max(60) }))
  .handler(async ({ data }): Promise<IdentitySourceResult> => {
    await enforceRateLimit("identity-gitlab", 1, 15);
    const username = normUser(data.username);
    try {
      const rows = await cached(`identity:gitlab:${username.toLowerCase()}`, 10 * 60_000, () => fetchJson<GitlabUser[]>(
        `https://gitlab.com/api/v4/users?username=${encodeURIComponent(username)}`,
        { headers: { accept: "application/json", "user-agent": "LifeAgency-OSINT" }, timeoutMs: 12000 },
      ));
      const user = Array.isArray(rows) ? rows[0] : undefined;
      if (!user?.username) return { id: "gitlab", name: "GitLab", ok: false, note: "Nenhum perfil público no GitLab.", profiles: [], signals: [] };
      const url = user.web_url ?? `https://gitlab.com/${user.username}`;
      const signals: IdentitySignal[] = [
        signal("gitlab", "GitLab", "username", user.username, "confirmed", "Conta pública do GitLab.", url),
      ];
      if (user.name) signals.push(signal("gitlab", "GitLab", "person", user.name, "probable", "Nome exibido no perfil do GitLab."));
      if (user.public_email) signals.push(signal("gitlab", "GitLab", "email", user.public_email, "confirmed", "E-mail público declarado no perfil do GitLab.", url));
      if (user.website_url) signals.push(signal("gitlab", "GitLab", "url", user.website_url, "confirmed", "Site declarado no perfil do GitLab.", user.website_url));
      if (user.twitter) signals.push(signal("gitlab", "GitLab", "username", user.twitter, "confirmed", "Conta do X declarada no perfil do GitLab.", `https://x.com/${user.twitter}`));
      if (user.linkedin) signals.push(signal("gitlab", "GitLab", "url", /^https?:/i.test(user.linkedin) ? user.linkedin : `https://www.linkedin.com/in/${user.linkedin}`, "confirmed", "LinkedIn declarado no perfil do GitLab."));
      if (user.location) signals.push(signal("gitlab", "GitLab", "location", user.location, "unconfirmed", "Localização auto-declarada."));
      for (const extra of extractContacts(user.bio, "gitlab", "GitLab")) signals.push(extra);
      return {
        id: "gitlab", name: "GitLab", ok: true, url,
        profiles: [{
          source: "GitLab", username: user.username, displayName: user.name, bio: user.bio,
          avatar: user.avatar_url, avatarHash: await avatarHash(user.avatar_url),
          location: user.location, joined: user.created_at, url,
          fields: [
            { label: "E-mail público", value: user.public_email ?? "—" },
            { label: "Site", value: user.website_url ?? "—", url: user.website_url },
          ],
        }],
        signals, raw: user,
      };
    } catch (e) {
      return { id: "gitlab", name: "GitLab", ok: false, note: (e as Error).message, profiles: [], signals: [] };
    }
  });

/* ========================================================================== */
/* dev.to                                                                     */
/* ========================================================================== */

type DevtoUser = {
  name?: string; username: string; summary?: string; location?: string; website_url?: string;
  twitter_username?: string; github_username?: string; joined_at?: string; profile_image?: string;
};

export const identityDevto = createServerFn({ method: "POST" })
  .inputValidator(z.object({ username: z.string().min(1).max(60) }))
  .handler(async ({ data }): Promise<IdentitySourceResult> => {
    await enforceRateLimit("identity-devto", 1, 15);
    const username = normUser(data.username);
    try {
      const user = await cached(`identity:devto:${username.toLowerCase()}`, 10 * 60_000, () => fetchJson<DevtoUser>(
        `https://dev.to/api/users/by_username?url=${encodeURIComponent(username)}`,
        { headers: { accept: "application/json", "user-agent": "LifeAgency-OSINT" }, timeoutMs: 10000 },
      ));
      if (!user?.username) return { id: "devto", name: "dev.to", ok: false, note: "Nenhum perfil público no dev.to.", profiles: [], signals: [] };
      const url = `https://dev.to/${user.username}`;
      const signals: IdentitySignal[] = [
        signal("devto", "dev.to", "username", user.username, "confirmed", "Conta pública no dev.to.", url),
      ];
      if (user.name) signals.push(signal("devto", "dev.to", "person", user.name, "probable", "Nome exibido no perfil do dev.to."));
      if (user.github_username) signals.push(signal("devto", "dev.to", "username", user.github_username, "confirmed", "GitHub vinculado no perfil do dev.to.", `https://github.com/${user.github_username}`));
      if (user.twitter_username) signals.push(signal("devto", "dev.to", "username", user.twitter_username, "confirmed", "X vinculado no perfil do dev.to.", `https://x.com/${user.twitter_username}`));
      if (user.website_url) signals.push(signal("devto", "dev.to", "url", user.website_url, "confirmed", "Site declarado no perfil do dev.to.", user.website_url));
      if (user.location) signals.push(signal("devto", "dev.to", "location", user.location, "unconfirmed", "Localização auto-declarada."));
      for (const extra of extractContacts(user.summary, "devto", "dev.to")) signals.push(extra);
      return {
        id: "devto", name: "dev.to", ok: true, url,
        profiles: [{
          source: "dev.to", username: user.username, displayName: user.name, bio: user.summary,
          avatar: user.profile_image, avatarHash: await avatarHash(user.profile_image),
          location: user.location, joined: user.joined_at, url,
          fields: [{ label: "Site", value: user.website_url ?? "—", url: user.website_url }],
        }],
        signals, raw: user,
      };
    } catch (e) {
      return { id: "devto", name: "dev.to", ok: false, note: (e as Error).message, profiles: [], signals: [] };
    }
  });

/* ========================================================================== */
/* Gravatar — public profile for an e-mail address                            */
/* ========================================================================== */

type GravatarEntry = {
  displayName?: string; aboutMe?: string; preferredUsername?: string;
  name?: { formatted?: string }; currentLocation?: string; profileUrl?: string;
  accounts?: Array<{ domain?: string; username?: string; url?: string; verified?: string | boolean; shortname?: string }>;
  thumbnailUrl?: string;
};

export const identityGravatar = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email().max(254) }))
  .handler(async ({ data }): Promise<IdentitySourceResult> => {
    await enforceRateLimit("identity-gravatar", 1, 12);
    const email = data.email.trim().toLowerCase();
    try {
      const json = await cached(`identity:gravatar:${email}`, 10 * 60_000, () => fetchJson<{ entry?: GravatarEntry[] }>(
        `https://gravatar.com/${md5(email)}.json`,
        { headers: { accept: "application/json", "user-agent": "LifeAgency-OSINT" }, timeoutMs: 10000 },
      ));
      const entry = json.entry?.[0];
      if (!entry) return { id: "gravatar", name: "Gravatar", ok: false, note: "Nenhum perfil público do Gravatar para este e-mail.", profiles: [], signals: [] };
      const url = entry.profileUrl ?? `https://gravatar.com/${md5(email)}`;
      const signals: IdentitySignal[] = [
        signal("gravatar", "Gravatar", "email", email, "confirmed", "E-mail com perfil público no Gravatar (SHA-256 do endereço corresponde ao hash do perfil).", url),
      ];
      const name = entry.name?.formatted ?? entry.displayName;
      if (name) signals.push(signal("gravatar", "Gravatar", "person", name, "probable", "Nome exibido no perfil público do Gravatar.", url));
      if (entry.preferredUsername) signals.push(signal("gravatar", "Gravatar", "username", entry.preferredUsername, "probable", "Username preferido declarado no Gravatar.", url));
      if (entry.currentLocation) signals.push(signal("gravatar", "Gravatar", "location", entry.currentLocation, "unconfirmed", "Localização auto-declarada no Gravatar."));
      for (const account of (entry.accounts ?? []).slice(0, 10)) {
        if (!account.url) continue;
        const confidence = account.verified === true || account.verified === "true" ? "confirmed" : "probable";
        const handle = account.username ?? account.shortname;
        if (handle) signals.push(signal("gravatar", "Gravatar", "username", handle, confidence,
          `${confidence === "confirmed" ? "Conta verificada" : "Conta declarada"} no perfil do Gravatar (${account.domain ?? account.shortname ?? "site"}).`, account.url));
        else signals.push(signal("gravatar", "Gravatar", "url", account.url, confidence, "Link declarado no perfil do Gravatar.", account.url));
      }
      for (const extra of extractContacts(entry.aboutMe, "gravatar", "Gravatar")) signals.push(extra);
      return {
        id: "gravatar", name: "Gravatar", ok: true, url,
        profiles: [{
          source: "Gravatar", username: entry.preferredUsername, displayName: name, bio: stripHtml(entry.aboutMe) || undefined,
          avatar: entry.thumbnailUrl, avatarHash: await avatarHash(entry.thumbnailUrl),
          location: entry.currentLocation, url,
          fields: (entry.accounts ?? []).slice(0, 8).map((a) => ({ label: a.domain ?? a.shortname ?? "conta", value: a.username ?? a.url ?? "", url: a.url })),
        }],
        signals, raw: entry,
      };
    } catch (e) {
      return { id: "gravatar", name: "Gravatar", ok: false, note: (e as Error).message, profiles: [], signals: [] };
    }
  });
