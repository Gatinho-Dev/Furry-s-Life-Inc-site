import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Users, Megaphone, ShieldBan, UserX, Power, Settings2, Terminal, Hourglass, Server } from "lucide-react";
import { mapleAction, mapleLookup, mapleOverview } from "@/lib/maple.functions";

type Overview = Awaited<ReturnType<typeof mapleOverview>>;
const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const inp = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none";
const btn = "inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50";
const ghost = "inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";

export function MaplePanel() {
  const overview = useServerFn(mapleOverview);
  const act = useServerFn(mapleAction);
  const lookup = useServerFn(mapleLookup);
  const [o, setO] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ t: string; ok: boolean; m: string }[]>([]);
  const [msg, setMsg] = useState(""); const [banner, setBanner] = useState("");
  const [target, setTarget] = useState(""); const [reason, setReason] = useState("");
  const [minLevel, setMinLevel] = useState("");
  const [cmd, setCmd] = useState("");

  const load = async () => { setLoading(true); try { setO(await overview()); } catch (e) { setLog((l) => [{ t: now(), ok: false, m: (e as Error).message }, ...l]); } setLoading(false); };
  useEffect(() => { load(); }, []);
  const now = () => new Date().toLocaleTimeString("pt-BR");
  const name = (id: number) => o?.names[id] ?? `#${id}`;

  const run = async (label: string, data: Parameters<typeof act>[0]["data"], confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    try { const r = await act({ data }); setLog((l) => [{ t: now(), ok: r.ok, m: `${label}: ${r.message}` }, ...l].slice(0, 50)); if (r.ok) setTimeout(load, 1500); }
    catch (e) { setLog((l) => [{ t: now(), ok: false, m: `${label}: ${(e as Error).message}` }, ...l]); }
    setBusy(false);
  };
  const resolveId = async (v: string) => {
    const s = v.trim(); if (/^\d+$/.test(s)) return Number(s);
    const u = await lookup({ data: { username: s } }); if (!u) { setLog((l) => [{ t: now(), ok: false, m: `Usuário "${s}" não encontrado no Roblox` }, ...l]); return null; }
    return u.id;
  };

  // Comandos livres: :announce texto | :kick usuario motivo | :ban usuario | :unban usuario | :shutdown | :private on/off | :hide on/off | :minlevel N | :banner texto
  const runCmd = async () => {
    const [c, ...rest] = cmd.trim().replace(/^[:/]/, "").split(/\s+/); const arg = rest.join(" ");
    const on = (x: string) => ["on", "sim", "true", "1"].includes(x.toLowerCase());
    switch ((c ?? "").toLowerCase()) {
      case "announce": case "anunciar": case "m": if (arg) await run("Anúncio", { type: "announce", message: arg }); break;
      case "kick": case "expulsar": { const id = await resolveId(rest[0] ?? ""); if (id) await run(`Expulsar ${rest[0]}`, { type: "kick", userId: id, reason: rest.slice(1).join(" ") }); break; }
      case "ban": case "banir": { const id = await resolveId(rest[0] ?? ""); if (id) await run(`Banir ${rest[0]}`, { type: "ban", userId: id, banned: true }); break; }
      case "unban": case "desbanir": { const id = await resolveId(rest[0] ?? ""); if (id) await run(`Desbanir ${rest[0]}`, { type: "ban", userId: id, banned: false }); break; }
      case "shutdown": case "desligar": await run("Desligar servidor", { type: "shutdown" }, "Desligar o servidor em 30 segundos?"); break;
      case "private": case "privado": await run("Privado", { type: "setting", Private: on(arg) }); break;
      case "hide": case "ocultar": await run("Ocultar da lista", { type: "setting", HideFromList: on(arg) }); break;
      case "minlevel": await run("Nível mínimo", { type: "setting", minLevel: Number(arg) || 0 }); break;
      case "banner": await run("Banner", { type: "banner", banner: arg }); break;
      case "refresh": case "atualizar": await load(); break;
      default: setLog((l) => [{ t: now(), ok: false, m: `Comando desconhecido: ${c}. Use :help` }, ...l]);
    }
    setCmd("");
  };

  const s = o?.server as Record<string, unknown> | null | undefined;
  return (
    <div className="space-y-4">
      <div className={`${card} flex flex-wrap items-center gap-4 bg-gradient-to-r from-red-600 to-rose-500 text-white`}>
        {s?.Icon ? <img src={String(s.Icon)} alt="" className="h-12 w-12 rounded-xl bg-white/20 object-cover" /> : <Server className="h-10 w-10" />}
        <div className="flex-1">
          <div className="text-lg font-semibold">{s?.ServerName ? String(s.ServerName) : "Maple Hospital"}</div>
          <div className="text-sm text-white/80">{s?.ServerDescription ? String(s.ServerDescription) : "Controle remoto do servidor privado"}{s?.Code ? ` · Código ${String(s.Code)}` : ""}</div>
        </div>
        {s && <div className="text-center"><div className="text-2xl font-semibold">{String(s.PlayerCount ?? o?.players.length ?? 0)}/{String(s.MaxPlayers ?? "?")}</div><div className="text-xs text-white/70">jogadores</div></div>}
        <button onClick={load} disabled={loading} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-medium text-red-600"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Atualizar</button>
      </div>
      {o?.error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{o.error}</div>}
      {o?.rate?.remaining && <div className="text-xs text-slate-500">Pedidos restantes: {o.rate.remaining}/{o.rate.limit}</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`${card} lg:col-span-2`}>
          <div className="mb-3 flex items-center gap-2 font-semibold"><Users className="h-4 w-4 text-blue-600" />Jogadores online ({o?.players.length ?? 0})</div>
          {!o && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}
          {o && !o.players.length && <div className="py-6 text-center text-sm text-slate-500">Ninguém no servidor agora.</div>}
          <div className="divide-y divide-slate-100">
            {o?.players.map((id) => (
              <div key={id} className="flex items-center gap-2 py-2">
                <img src={`https://www.roblox.com/headshot-thumbnail/image?userId=${id}&width=48&height=48&format=png`} alt="" className="h-8 w-8 rounded-full bg-slate-100" />
                <div className="flex-1 text-sm"><div className="font-medium">{name(id)}</div><div className="text-xs text-slate-500">ID {id}{s && (s.Admins as number[] | undefined)?.includes(id) ? " · Admin" : ""}{s && (s.HeadAdmins as number[] | undefined)?.includes(id) ? " · Head Admin" : ""}{s?.Owner === id ? " · Dono" : ""}</div></div>
                <button disabled={busy} className={ghost} onClick={() => run(`Expulsar ${name(id)}`, { type: "kick", userId: id, reason: reason || undefined }, `Expulsar ${name(id)}?`)}><UserX className="h-3 w-3" />Expulsar</button>
                <button disabled={busy} className={`${ghost} text-red-600`} onClick={() => run(`Banir ${name(id)}`, { type: "ban", userId: id, banned: true }, `Banir ${name(id)}?`)}><ShieldBan className="h-3 w-3" />Banir</button>
              </div>
            ))}
          </div>
          {!!o?.queue.length && <div className="mt-4 border-t border-slate-100 pt-3"><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Hourglass className="h-4 w-4" />Fila ({o.queue.length})</div><div className="flex flex-wrap gap-1.5">{o.queue.map((id) => <span key={id} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{name(id)}</span>)}</div></div>}
        </div>

        <div className="space-y-4">
          <div className={card}>
            <div className="mb-2 flex items-center gap-2 font-semibold"><Megaphone className="h-4 w-4 text-blue-600" />Anúncio</div>
            <textarea className={inp} rows={3} maxLength={500} placeholder="Mensagem para todos no servidor" value={msg} onChange={(e) => setMsg(e.target.value)} />
            <button disabled={busy || !msg.trim()} className={`${btn} mt-2`} onClick={async () => { await run("Anúncio", { type: "announce", message: msg }); setMsg(""); }}>Enviar anúncio</button>
          </div>
          <div className={card}>
            <div className="mb-2 flex items-center gap-2 font-semibold"><ShieldBan className="h-4 w-4 text-blue-600" />Moderação</div>
            <input className={inp} placeholder="@usuário do Roblox ou ID" value={target} onChange={(e) => setTarget(e.target.value)} />
            <input className={`${inp} mt-2`} placeholder="Motivo (para expulsão)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {([["Expulsar", "kick"], ["Banir", "ban"], ["Desbanir", "unban"]] as const).map(([l, k]) => (
                <button key={k} disabled={busy || !target.trim()} className={ghost} onClick={async () => { const id = await resolveId(target); if (!id) return; if (k === "kick") await run(`${l} ${target}`, { type: "kick", userId: id, reason }); else await run(`${l} ${target}`, { type: "ban", userId: id, banned: k === "ban" }, k === "ban" ? `Banir ${target}?` : undefined); }}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={card}>
          <div className="mb-2 flex items-center gap-2 font-semibold"><Settings2 className="h-4 w-4 text-blue-600" />Configurações do servidor</div>
          <div className="flex flex-wrap gap-1.5">
            <button disabled={busy} className={ghost} onClick={() => run("Tornar privado", { type: "setting", Private: true })}>Tornar privado</button>
            <button disabled={busy} className={ghost} onClick={() => run("Tornar público", { type: "setting", Private: false })}>Tornar público</button>
            <button disabled={busy} className={ghost} onClick={() => run("Ocultar da lista", { type: "setting", HideFromList: true })}>Ocultar da lista</button>
            <button disabled={busy} className={ghost} onClick={() => run("Mostrar na lista", { type: "setting", HideFromList: false })}>Mostrar na lista</button>
          </div>
          <div className="mt-3 flex gap-2"><input className={inp} type="number" min={0} placeholder="Nível mínimo para entrar" value={minLevel} onChange={(e) => setMinLevel(e.target.value)} /><button disabled={busy || minLevel === ""} className={btn} onClick={() => run("Nível mínimo", { type: "setting", minLevel: Number(minLevel) })}>Salvar</button></div>
          <div className="mt-3 flex gap-2"><input className={inp} placeholder="Banner do servidor" value={banner} onChange={(e) => setBanner(e.target.value)} /><button disabled={busy} className={btn} onClick={() => run("Banner", { type: "banner", banner })}>Definir</button></div>
          <button disabled={busy} onClick={() => run("Desligar servidor", { type: "shutdown" }, "Desligar o servidor? Todos serão desconectados em 30 segundos.")} className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"><Power className="h-4 w-4" />Desligar servidor</button>
        </div>
        <div className={card}>
          <div className="mb-2 flex items-center gap-2 font-semibold"><ShieldBan className="h-4 w-4 text-blue-600" />Banidos ({o?.bans.length ?? 0})</div>
          <div className="max-h-64 space-y-1 overflow-y-auto">{o?.bans.map((id) => <div key={id} className="flex items-center justify-between text-sm"><span>{name(id)}</span><button disabled={busy} className={ghost} onClick={() => run(`Desbanir ${name(id)}`, { type: "ban", userId: id, banned: false })}>Desbanir</button></div>)}{o && !o.bans.length && <div className="text-xs text-slate-500">Nenhum banido.</div>}</div>
        </div>
        <div className={`${card} bg-slate-900 text-slate-100`}>
          <div className="mb-2 flex items-center gap-2 font-semibold"><Terminal className="h-4 w-4" />Console</div>
          <form onSubmit={(e) => { e.preventDefault(); if (cmd.trim() === ":help" || cmd.trim() === "help") { setLog((l) => [{ t: now(), ok: true, m: "Comandos: :announce texto · :kick @user motivo · :ban @user · :unban @user · :private on/off · :hide on/off · :minlevel N · :banner texto · :shutdown · :refresh" }, ...l]); setCmd(""); return; } runCmd(); }}>
            <input className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none" placeholder=":help" value={cmd} onChange={(e) => setCmd(e.target.value)} />
          </form>
          <div className="mt-2 max-h-56 space-y-1 overflow-y-auto font-mono text-[11px]">{log.map((l, i) => <div key={i} className={l.ok ? "text-emerald-300" : "text-red-300"}>[{l.t}] {l.m}</div>)}</div>
        </div>
      </div>
    </div>
  );
}
