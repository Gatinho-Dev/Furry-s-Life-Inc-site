import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BASE = "https://maple-api.marizma.games";

type Ctx = { supabase: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> }; userId: string };
async function assertAccess(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("has_subsidiary_access", { _user_id: ctx.userId, _sub: "lifeplus" });
  if (error || !data) throw new Error("Sem acesso à Life+");
}

async function maple(path: string, method: "GET" | "POST" = "GET", body?: unknown) {
  const key = process.env["MAPLE_API_KEY"];
  if (!key) return { ok: false, status: 0, data: null, message: "Chave do Maple Hospital não configurada", rate: null };
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "X-Api-Key": key, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: { success?: boolean; data?: unknown } | null = null;
  try { json = await res.json(); } catch { /* sem corpo */ }
  const rate = { limit: res.headers.get("x-ratelimit-limit"), remaining: res.headers.get("x-ratelimit-remaining"), reset: res.headers.get("x-ratelimit-reset") };
  const msg = (json?.data as { Message?: string } | undefined)?.Message;
  if (!res.ok || json?.success === false) {
    console.error("Maple API", path, res.status, msg);
    return { ok: false, status: res.status, data: null, message: res.status === 429 ? "Limite de pedidos atingido. Aguarde alguns segundos." : res.status === 401 ? "Chave da API inválida" : msg || `Erro ${res.status}`, rate };
  }
  return { ok: true, status: res.status, data: json?.data ?? null, message: msg ?? null, rate };
}

async function robloxNames(ids: number[]): Promise<Record<number, string>> {
  if (!ids.length) return {};
  try {
    const r = await fetch("https://users.roblox.com/v1/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userIds: ids.slice(0, 100), excludeBannedUsers: false }) });
    const j = (await r.json()) as { data?: { id: number; name: string; displayName: string }[] };
    return Object.fromEntries((j.data ?? []).map((u) => [u.id, u.displayName && u.displayName !== u.name ? `${u.displayName} (@${u.name})` : `@${u.name}`]));
  } catch { return {}; }
}

export type MapleServer = { ServerName?: string; ServerDescription?: string; Code?: string; Icon?: string; PlayerCount?: number; MaxPlayers?: number; Owner?: number; Admins?: number[]; HeadAdmins?: number[] };
export type MapleOverview = { server: MapleServer | null; error: string | null; players: number[]; queue: number[]; bans: number[]; names: Record<string, string>; rate: { limit: string | null; remaining: string | null; reset: string | null } | null };
export type MapleActionInput = z.infer<typeof action>;

export const mapleOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MapleOverview> => {
    await assertAccess(context as unknown as Ctx);
    const server = await maple("/v1/server");
    const players = await maple("/v1/server/players");
    const queue = await maple("/v1/server/queue");
    const bans = await maple("/v1/server/bans");
    const pIds = ((players.data as { Players?: number[] } | null)?.Players ?? []).map(Number);
    const qIds = ((queue.data as { Queue?: number[] } | null)?.Queue ?? []).map(Number);
    const bansRaw = bans.data as unknown;
    const bIds: number[] = Array.isArray(bansRaw) ? bansRaw.map(Number)
      : Array.isArray((bansRaw as { Bans?: unknown[] } | null)?.Bans) ? (bansRaw as { Bans: unknown[] }).Bans.map((b) => Number(typeof b === "object" && b ? (b as { UserId?: number }).UserId : b))
      : bansRaw && typeof bansRaw === "object" ? Object.keys(bansRaw).map(Number).filter((n) => !isNaN(n)) : [];
    const srv = server.data as { Admins?: number[]; HeadAdmins?: number[]; Owner?: number } | null;
    const names = await robloxNames([...new Set([...pIds, ...qIds, ...bIds, ...(srv?.Admins ?? []), ...(srv?.HeadAdmins ?? []), ...(srv?.Owner ? [srv.Owner] : [])])]);
    return {
      server: srv,
      error: server.ok ? null : server.message,
      players: pIds, queue: qIds, bans: bIds, names, rate: bans.rate ?? server.rate,
    };
  });

const action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("announce"), message: z.string().trim().min(1).max(500) }),
  z.object({ type: z.literal("kick"), userId: z.number().int().positive(), reason: z.string().trim().max(300).optional() }),
  z.object({ type: z.literal("ban"), userId: z.number().int().positive(), banned: z.boolean() }),
  z.object({ type: z.literal("shutdown") }),
  z.object({ type: z.literal("setting"), HideFromList: z.boolean().optional(), Private: z.boolean().optional(), minLevel: z.number().int().min(0).max(1000).optional() }),
  z.object({ type: z.literal("banner"), banner: z.string().trim().max(500) }),
]);

export const mapleAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => action.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; message: string | null }> => {
    await assertAccess(context as unknown as Ctx);
    let r;
    switch (data.type) {
      case "announce": r = await maple("/v1/server/announce", "POST", { message: data.message }); break;
      case "kick": r = await maple("/v1/server/moderation/kick", "POST", { UserId: data.userId, ModerationReason: data.reason || "Removido pela equipe Life+" }); break;
      case "ban": r = await maple("/v1/server/banplayer", "POST", { UserId: data.userId, Banned: data.banned }); break;
      case "shutdown": r = await maple("/v1/server/shutdown", "POST", {}); break;
      case "setting": { const { type: _t, ...rest } = data; r = await maple("/v1/server/setSetting", "POST", rest); break; }
      case "banner": r = await maple("/v1/server/setbanner", "POST", { banner: data.banner }); break;
    }
    return { ok: r.ok, message: r.ok ? (r.message ?? "Comando executado") : r.message };
  });

/** Resolve @usuario do Roblox para ID numérico. */
export const mapleLookup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ username: z.string().trim().min(1).max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAccess(context as unknown as Ctx);
    const r = await fetch("https://users.roblox.com/v1/usernames/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usernames: [data.username.replace(/^@/, "")], excludeBannedUsers: false }) });
    const j = (await r.json()) as { data?: { id: number; name: string }[] };
    const u = j.data?.[0];
    return u ? { id: u.id, name: u.name } : null;
  });
