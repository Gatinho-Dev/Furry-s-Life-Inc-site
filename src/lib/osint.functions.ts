import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type FirecrawlScrapeOpts = {
  formats?: Array<string | { type: string; prompt?: string; schema?: unknown }>;
  onlyMainContent?: boolean;
  waitFor?: number;
};

async function callFirecrawl(path: string, body: unknown) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY não configurado.");
  const res = await fetch(`https://api.firecrawl.dev/v2${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as { error?: string })?.error ?? `Firecrawl ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

async function ensureAgencyAccess(ctx: { supabase: ReturnType<typeof Object>; userId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = ctx.supabase as any;
  const { data, error } = await sb.rpc("has_subsidiary_access", { _user_id: ctx.userId, _sub: "agency" });
  if (error) throw new Error("Falha na checagem de acesso.");
  if (!data) throw new Error("Acesso negado a Life Agency.");
}

export const osintSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { query: string; limit?: number }) => {
    if (!d?.query || typeof d.query !== "string" || d.query.length > 200) throw new Error("Query inválida.");
    return { query: d.query.trim(), limit: Math.min(Math.max(d.limit ?? 8, 1), 20) };
  })
  .handler(async ({ data, context }) => {
    await ensureAgencyAccess(context);
    const json = await callFirecrawl("/search", { query: data.query, limit: data.limit });
    const raw = (json as { data?: unknown }).data ?? (json as { web?: unknown }).web ?? [];
    const list = Array.isArray(raw) ? raw : (raw as { web?: unknown[] }).web ?? [];
    return {
      results: (list as Array<{ url?: string; title?: string; description?: string }>).map((r) => ({
        url: r.url ?? "",
        title: r.title ?? r.url ?? "",
        description: r.description ?? "",
      })),
    };
  });

export const osintScrape = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { url: string; formats?: string[] }) => {
    try { new URL(d.url); } catch { throw new Error("URL inválida."); }
    return { url: d.url, formats: d.formats ?? ["markdown", "summary"] };
  })
  .handler(async ({ data, context }) => {
    await ensureAgencyAccess(context);
    const opts: FirecrawlScrapeOpts = { formats: data.formats, onlyMainContent: true };
    const json = await callFirecrawl("/scrape", { url: data.url, ...opts });
    const doc = (json as { data?: Record<string, unknown> }).data ?? (json as Record<string, unknown>);
    return {
      url: data.url,
      title: (doc.metadata as { title?: string } | undefined)?.title ?? "",
      summary: (doc.summary as string | undefined) ?? "",
      markdown: ((doc.markdown as string | undefined) ?? "").slice(0, 8000),
      links: ((doc.links as string[] | undefined) ?? []).slice(0, 50),
    };
  });

export const osintMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { url: string; search?: string; limit?: number }) => {
    try { new URL(d.url); } catch { throw new Error("URL inválida."); }
    return { url: d.url, search: d.search?.trim() || undefined, limit: Math.min(Math.max(d.limit ?? 100, 1), 500) };
  })
  .handler(async ({ data, context }) => {
    await ensureAgencyAccess(context);
    const json = await callFirecrawl("/map", { url: data.url, search: data.search, limit: data.limit });
    const links = ((json as { links?: string[] }).links ?? (json as { data?: { links?: string[] } }).data?.links ?? []) as string[];
    return { links };
  });
