import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ArrowLeft, Plus, Trash2, Wind, Factory, Activity } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/aircare/staff")({
  head: () => ({ meta: [{ title: "Life AirCare · Painel" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AirCareStaff,
});

type Unit = { id: string; name: string; location: string | null; filter_model: string | null; installed_at: string | null; notes: string | null };
type Reading = { id: string; unit_id: string; pm25: number | null; co2_ppm: number | null; temperature_c: number | null; humidity_pct: number | null; measured_at: string; notes: string | null };

function AirCareStaff() {
  const auth = useAuth(); const nav = useNavigate();
  const [tab, setTab] = useState<"units"|"readings">("units");
  const [units, setUnits] = useState<Unit[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [err, setErr] = useState<string|null>(null);

  const load = async () => {
    const [u, r] = await Promise.all([
      supabase.from("aircare_units").select("*").order("created_at", { ascending: false }),
      supabase.from("aircare_readings").select("*").order("measured_at", { ascending: false }).limit(100),
    ]);
    if (u.error) setErr(u.error.message); else setUnits(u.data as Unit[]);
    if (!r.error) setReadings(r.data as Reading[]);
  };
  useEffect(() => { if (auth.user && auth.hasAccess("aircare")) load(); }, [auth.user, auth.ready]);

  if (auth.loading) return <div className="flex min-h-screen items-center justify-center bg-[#0b1f12]"><Loader2 className="h-6 w-6 animate-spin text-emerald-300" /></div>;
  if (!auth.user) { nav({ to: "/auth" }); return null; }
  if (!auth.hasAccess("aircare")) return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b1f12] px-4 text-center text-emerald-100">
      <div><div className="font-display text-xl font-semibold">Acesso negado</div><p className="mt-2 text-sm text-emerald-200/60">Peça acesso a Life AirCare.</p><Link to="/staff/dashboard" className="mt-4 inline-block text-sm text-emerald-300 hover:underline">Voltar</Link></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0b1f12] text-emerald-50">
      <header className="flex items-center justify-between border-b border-emerald-300/15 px-6 py-4">
        <Link to="/staff/dashboard" className="inline-flex items-center gap-1.5 text-sm text-emerald-200/70 hover:text-emerald-50"><ArrowLeft className="h-4 w-4" /> Painel central</Link>
        <div className="flex items-center gap-2 text-sm"><Wind className="h-4 w-4 text-emerald-300" /><span className="font-display font-semibold">Life AirCare</span></div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <nav className="flex gap-1 border-b border-emerald-300/15">
          <TabBtn active={tab==="units"} onClick={()=>setTab("units")} icon={<Factory className="h-4 w-4"/>} label="Unidades"/>
          <TabBtn active={tab==="readings"} onClick={()=>setTab("readings")} icon={<Activity className="h-4 w-4"/>} label="Leituras"/>
        </nav>
        {err && <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">{err}</div>}
        {tab==="units" && <UnitsPanel units={units} reload={load} />}
        {tab==="readings" && <ReadingsPanel units={units} readings={readings} reload={load} />}
      </main>
    </div>
  );
}

function TabBtn({active,onClick,icon,label}:{active:boolean;onClick:()=>void;icon:React.ReactNode;label:string}) {
  return <button onClick={onClick} className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm ${active?"border-emerald-400 text-emerald-200":"border-transparent text-emerald-200/60 hover:text-emerald-100"}`}>{icon}{label}</button>;
}

function UnitsPanel({ units, reload }: { units: Unit[]; reload: ()=>void }) {
  const [f, setF] = useState({ name: "", location: "", filter_model: "", installed_at: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const add = async (e: React.FormEvent) => {
    e.preventDefault(); if (!f.name.trim()) return;
    setBusy(true);
    await supabase.from("aircare_units").insert({ name: f.name, location: f.location || null, filter_model: f.filter_model || null, installed_at: f.installed_at || null, notes: f.notes || null });
    setBusy(false);
    setF({ name: "", location: "", filter_model: "", installed_at: "", notes: "" });
    reload();
  };
  const del = async (id: string) => { await supabase.from("aircare_units").delete().eq("id", id); reload(); };
  return (
    <div className="space-y-4">
      <form onSubmit={add} className="grid gap-2 rounded-2xl border border-emerald-300/15 bg-emerald-900/30 p-4 sm:grid-cols-2">
        <input className="rounded-xl border border-emerald-300/20 bg-emerald-950/60 px-3 py-2 text-sm" placeholder="Nome da fábrica" value={f.name} onChange={(e)=>setF({...f,name:e.target.value})}/>
        <input className="rounded-xl border border-emerald-300/20 bg-emerald-950/60 px-3 py-2 text-sm" placeholder="Localização" value={f.location} onChange={(e)=>setF({...f,location:e.target.value})}/>
        <input className="rounded-xl border border-emerald-300/20 bg-emerald-950/60 px-3 py-2 text-sm" placeholder="Modelo do filtro" value={f.filter_model} onChange={(e)=>setF({...f,filter_model:e.target.value})}/>
        <input type="date" className="rounded-xl border border-emerald-300/20 bg-emerald-950/60 px-3 py-2 text-sm" value={f.installed_at} onChange={(e)=>setF({...f,installed_at:e.target.value})}/>
        <input className="sm:col-span-2 rounded-xl border border-emerald-300/20 bg-emerald-950/60 px-3 py-2 text-sm" placeholder="Observações" value={f.notes} onChange={(e)=>setF({...f,notes:e.target.value})}/>
        <button disabled={busy} className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-300 disabled:opacity-60"><Plus className="h-4 w-4"/>Adicionar unidade</button>
      </form>
      <div className="space-y-2">
        {units.map((u)=>(
          <div key={u.id} className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-900/30 p-4">
            <div>
              <div className="font-display font-semibold">{u.name}</div>
              <div className="text-xs text-emerald-200/60">{u.location ?? "—"} · filtro: {u.filter_model ?? "—"}</div>
              {u.notes && <div className="mt-1 text-xs text-emerald-100/70">{u.notes}</div>}
            </div>
            <button onClick={()=>del(u.id)} className="rounded-lg p-2 text-emerald-200/60 hover:bg-red-500/20 hover:text-red-300"><Trash2 className="h-4 w-4"/></button>
          </div>
        ))}
        {units.length===0 && <div className="rounded-2xl border border-dashed border-emerald-300/20 p-6 text-center text-sm text-emerald-200/60">Nenhuma unidade cadastrada.</div>}
      </div>
    </div>
  );
}

function ReadingsPanel({ units, readings, reload }: { units: Unit[]; readings: Reading[]; reload: ()=>void }) {
  const [f, setF] = useState({ unit_id: "", pm25: "", co2_ppm: "", temperature_c: "", humidity_pct: "", notes: "" });
  const add = async (e: React.FormEvent) => {
    e.preventDefault(); if (!f.unit_id) return;
    await supabase.from("aircare_readings").insert({
      unit_id: f.unit_id,
      pm25: f.pm25 ? Number(f.pm25) : null,
      co2_ppm: f.co2_ppm ? Number(f.co2_ppm) : null,
      temperature_c: f.temperature_c ? Number(f.temperature_c) : null,
      humidity_pct: f.humidity_pct ? Number(f.humidity_pct) : null,
      notes: f.notes || null,
    });
    setF({ unit_id: f.unit_id, pm25: "", co2_ppm: "", temperature_c: "", humidity_pct: "", notes: "" });
    reload();
  };
  return (
    <div className="space-y-4">
      <form onSubmit={add} className="grid gap-2 rounded-2xl border border-emerald-300/15 bg-emerald-900/30 p-4 sm:grid-cols-3">
        <select className="rounded-xl border border-emerald-300/20 bg-emerald-950/60 px-3 py-2 text-sm" value={f.unit_id} onChange={(e)=>setF({...f,unit_id:e.target.value})}>
          <option value="">Selecione a unidade</option>
          {units.map((u)=> <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <input type="number" step="0.1" placeholder="PM2.5 (µg/m³)" className="rounded-xl border border-emerald-300/20 bg-emerald-950/60 px-3 py-2 text-sm" value={f.pm25} onChange={(e)=>setF({...f,pm25:e.target.value})}/>
        <input type="number" step="1" placeholder="CO₂ (ppm)" className="rounded-xl border border-emerald-300/20 bg-emerald-950/60 px-3 py-2 text-sm" value={f.co2_ppm} onChange={(e)=>setF({...f,co2_ppm:e.target.value})}/>
        <input type="number" step="0.1" placeholder="Temp (°C)" className="rounded-xl border border-emerald-300/20 bg-emerald-950/60 px-3 py-2 text-sm" value={f.temperature_c} onChange={(e)=>setF({...f,temperature_c:e.target.value})}/>
        <input type="number" step="0.1" placeholder="Umidade (%)" className="rounded-xl border border-emerald-300/20 bg-emerald-950/60 px-3 py-2 text-sm" value={f.humidity_pct} onChange={(e)=>setF({...f,humidity_pct:e.target.value})}/>
        <input placeholder="Observações" className="rounded-xl border border-emerald-300/20 bg-emerald-950/60 px-3 py-2 text-sm" value={f.notes} onChange={(e)=>setF({...f,notes:e.target.value})}/>
        <button className="sm:col-span-3 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-300"><Plus className="h-4 w-4"/>Registrar leitura</button>
      </form>
      <div className="overflow-hidden rounded-2xl border border-emerald-300/15">
        <table className="w-full text-sm">
          <thead className="bg-emerald-900/50 text-xs uppercase text-emerald-200/70">
            <tr><th className="px-3 py-2 text-left">Quando</th><th className="px-3 py-2 text-left">Unidade</th><th className="px-3 py-2">PM2.5</th><th className="px-3 py-2">CO₂</th><th className="px-3 py-2">°C</th><th className="px-3 py-2">% UR</th></tr>
          </thead>
          <tbody>
            {readings.map((r)=>(
              <tr key={r.id} className="border-t border-emerald-300/10">
                <td className="px-3 py-2 text-emerald-100/80">{new Date(r.measured_at).toLocaleString("pt-BR")}</td>
                <td className="px-3 py-2">{units.find((u)=>u.id===r.unit_id)?.name ?? r.unit_id.slice(0,6)}</td>
                <td className="px-3 py-2 text-center">{r.pm25 ?? "—"}</td>
                <td className="px-3 py-2 text-center">{r.co2_ppm ?? "—"}</td>
                <td className="px-3 py-2 text-center">{r.temperature_c ?? "—"}</td>
                <td className="px-3 py-2 text-center">{r.humidity_pct ?? "—"}</td>
              </tr>
            ))}
            {readings.length===0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-emerald-200/60">Sem leituras ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
