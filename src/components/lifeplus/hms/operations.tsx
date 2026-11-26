import { useMemo, useState } from "react";
import {
  AlertTriangle, ArrowRightLeft, BedDouble, Boxes, Building2, CheckCircle2, ClipboardPlus, DoorOpen,
  LogOut, PackageMinus, PackagePlus, Pencil, Pill, Plus, ShoppingCart, Trash2, TrendingDown,
} from "lucide-react";
import { hdb, BED_STATUS, fDate, fDateTime, type Admission, type Bed, type Medication, type Patient } from "./core";
import { useHms } from "./data";
import { PatientSelect, StaffSelect } from "./pickers";
import { Avatar, Banner, Btn, Card, Chip, Empty, Field, Kpi, Modal, Page, SearchInput, Table, Tabs } from "./ui";
import { RecordComposer } from "./patients";

const bedTone = (s: string) => (s === "ocupado" ? "brand" : s === "limpeza" ? "warn" : s === "manutencao" ? "outline" : s === "reservado" ? "warn" : "ok");

/* ============================ INTERNAÇÕES ============================ */

export function AdmissionsModule() {
  const { data, focus, patientById, staffById, bedById, reload, go, can } = useHms();
  const [tab, setTab] = useState<"ativas" | "historico">("ativas");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(!!focus.patientId);
  const [evolve, setEvolve] = useState<Admission | null>(null);
  const [transfer, setTransfer] = useState<Admission | null>(null);
  const [discharge, setDischarge] = useState<Admission | null>(null);
  const active = data.admissions.filter((a) => !a.discharged_at);
  const list = data.admissions.filter((a) => (tab === "ativas" ? !a.discharged_at : !!a.discharged_at)).filter((a) => {
    const p = patientById(a.patient_id);
    return !q.trim() || [p?.full_name, p?.code, a.reason, a.sector].some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase()));
  });

  return (
    <Page eyebrow="Internação hospitalar" title="Internações" sub="Admissão, evolução, transferência de leito e alta — tudo vinculado ao prontuário."
      actions={can("admissions") ? <Btn icon={ClipboardPlus} onClick={() => setOpen(true)}>Nova internação</Btn> : undefined}>
      <div className="hms-cols-4 hms-grid mb-3">
        <Kpi label="Internados" value={active.length} note="pacientes com leito" icon={BedDouble} tone="brand" />
        <Kpi label="Na UTI" value={active.filter((a) => a.sector === "UTI").length} note="cuidados intensivos" icon={AlertTriangle} tone="vital" />
        <Kpi label="Altas" value={data.admissions.filter((a) => a.discharged_at).length} note="histórico" icon={CheckCircle2} tone="ok" />
        <Kpi label="Leitos livres" value={data.beds.filter((b) => b.status === "disponivel" && !active.some((a) => a.bed_id === b.id)).length} note={`de ${data.beds.length}`} icon={DoorOpen} />
      </div>
      <Card noBody>
        <div className="hms-toolbar">
          <Tabs items={[{ key: "ativas", label: "Ativas", count: active.length }, { key: "historico", label: "Histórico", count: data.admissions.length - active.length }]} value={tab} onChange={(v) => setTab(v as "ativas" | "historico")} />
          <div className="push flex items-center gap-2"><SearchInput value={q} onChange={setQ} placeholder="Paciente, setor ou motivo…" /></div>
        </div>
        {list.length === 0 ? <Empty icon={BedDouble} title={tab === "ativas" ? "Nenhuma internação ativa" : "Sem histórico"} children="Registre uma internação para ocupar um leito do hospital." action={<Btn icon={Plus} onClick={() => setOpen(true)}>Nova internação</Btn>} /> : (
          <Table head={<tr><th>Paciente</th><th>Setor / leito</th><th>Motivo</th><th>Responsável</th><th>Entrada</th><th>Status</th><th /></tr>}>
            {list.map((a) => {
              const p = patientById(a.patient_id); const bed = bedById(a.bed_id ?? undefined);
              return (
                <tr key={a.id}>
                  <td><div className="flex items-center gap-2"><Avatar name={p?.full_name} size={26} /><div><div className="strong truncate">{p?.full_name ?? "—"}</div><div className="hms-code">{p?.code}</div></div></div></td>
                  <td><div className="font-medium">{a.sector ?? "—"}</div><div className="hms-code">{bed?.code ?? "sem leito"}</div></td>
                  <td className="muted max-w-[260px] truncate">{a.reason ?? "—"}</td>
                  <td className="muted">{staffById(a.staff_id ?? undefined)?.full_name ?? "—"}</td>
                  <td className="muted whitespace-nowrap">{fDateTime(a.admitted_at)}</td>
                  <td><Chip tone={a.discharged_at ? "ok" : "vital"}>{a.discharged_at ? `alta ${fDate(a.discharged_at)}` : a.status}</Chip></td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-1">
                      {!a.discharged_at && <button className="hms-btn ghost sm" onClick={() => setEvolve(a)}>Evolução</button>}
                      {!a.discharged_at && <button className="hms-btn ghost sm" title="Transferir" onClick={() => setTransfer(a)}><ArrowRightLeft className="h-3.5 w-3.5" /></button>}
                      {!a.discharged_at && <button className="hms-btn soft sm" onClick={() => setDischarge(a)}>Alta</button>}
                      <button className="hms-btn ghost sm" onClick={() => go("patients", { patientId: a.patient_id })}>Ficha</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
      {open && <AdmissionForm presetPatientId={focus.patientId} onClose={() => { setOpen(false); void reload(); }} />}
      {evolve && <AdmissionEvolution admission={evolve} onClose={() => setEvolve(null)} />}
      {transfer && <TransferModal admission={transfer} onClose={() => setTransfer(null)} />}
      {discharge && <DischargeModal admission={discharge} onClose={() => setDischarge(null)} />}
    </Page>
  );
}

function AdmissionForm({ presetPatientId, onClose }: { presetPatientId?: string; onClose: () => void }) {
  const { data, reload, me } = useHms();
  const [f, setF] = useState({ patientId: presetPatientId ?? "", staffId: "", sector: data.settings.sectors[0] ?? "Enfermaria", bedId: "", reason: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const occupied = new Set(data.admissions.filter((a) => !a.discharged_at).map((a) => a.bed_id));
  const freeBeds = data.beds.filter((b) => !occupied.has(b.id) && b.status !== "manutencao" && (!f.sector || b.ward === f.sector));

  const save = async () => {
    if (!f.patientId) { setErr("Selecione o paciente."); return; }
    setBusy(true); setErr(null);
    const res = await hdb.from("lp_admissions").insert({ patient_id: f.patientId, staff_id: f.staffId || me?.id || null, bed_id: f.bedId || null, sector: f.sector, reason: f.reason || null, discharge_notes: f.notes || null, status: "internado" });
    if (!res.error) {
      await hdb.from("lp_patients").update({ status: f.sector === "UTI" ? "uti" : "internado", bed_id: f.bedId || null }).eq("id", f.patientId);
      if (f.bedId) await hdb.from("lp_beds").update({ status: "ocupado" }).eq("id", f.bedId);
      if (f.reason) await hdb.from("lp_records").insert({ patient_id: f.patientId, staff_id: f.staffId || me?.id || null, kind: "observacao", specialty: null, body: `Internação em ${f.sector}. Motivo: ${f.reason}`, data: { setor: f.sector } });
    }
    setBusy(false);
    if (res.error) { setErr(res.error.message); return; }
    await reload(); onClose();
  };

  return (
    <Modal title="Nova internação" sub="A seleção de leito é restrita aos disponíveis do setor." onClose={onClose}
      footer={<><span className="text-[11px] text-[var(--h-muted)]">Gera registro no prontuário automaticamente.</span><div className="ml-auto flex gap-2"><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn icon={BedDouble} disabled={busy} onClick={() => void save()}>{busy ? "Internando…" : "Registrar internação"}</Btn></div></>}>
      {err && <div className="mb-3"><Banner tone="error">{err}</Banner></div>}
      <div className="hms-form-grid">
        <Field label="Paciente *" className="span-2"><PatientSelect patients={data.patients} value={f.patientId} onChange={(id) => set({ patientId: id })} /></Field>
        <Field label="Médico responsável"><StaffSelect staff={data.staff} value={f.staffId} onChange={(id) => set({ staffId: id })} roles={["medico", "diretor"]} placeholder="Selecionar médico" /></Field>
        <Field label="Setor"><select className="hms-select" value={f.sector} onChange={(e) => set({ sector: e.target.value, bedId: "" })}>{data.settings.sectors.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Leito disponível" className="span-2">
          <select className="hms-select" value={f.bedId} onChange={(e) => set({ bedId: e.target.value })}>
            <option value="">Sem leito definido</option>
            {freeBeds.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.ward}{b.room ? ` · quarto ${b.room}` : ""}</option>)}
          </select>
          {!freeBeds.length && <div className="mt-1 text-[11px] text-[var(--h-warn)]">Nenhum leito livre neste setor. Você pode internar sem leito e transferir depois.</div>}
        </Field>
        <Field label="Motivo da internação" className="span-2"><textarea className="hms-textarea" rows={3} value={f.reason} onChange={(e) => set({ reason: e.target.value })} /></Field>
        <Field label="Observações" className="span-2"><input className="hms-input" value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function AdmissionEvolution({ admission, onClose }: { admission: Admission; onClose: () => void }) {
  return <RecordComposer patientId={admission.patient_id} onClose={onClose} onDone={() => undefined} />;
}

function TransferModal({ admission, onClose }: { admission: Admission; onClose: () => void }) {
  const { data, reload, me } = useHms();
  const [sector, setSector] = useState(admission.sector ?? data.settings.sectors[0] ?? "Enfermaria");
  const [bedId, setBedId] = useState(admission.bed_id ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const occupied = new Set(data.admissions.filter((a) => !a.discharged_at && a.id !== admission.id).map((a) => a.bed_id));
  const free = data.beds.filter((b) => b.ward === sector && !occupied.has(b.id) && b.status !== "manutencao");
  const save = async () => {
    setBusy(true);
    const oldBed = admission.bed_id;
    await hdb.from("lp_admissions").update({ sector, bed_id: bedId || null }).eq("id", admission.id);
    await hdb.from("lp_patients").update({ bed_id: bedId || null, status: sector === "UTI" ? "uti" : "internado" }).eq("id", admission.patient_id);
    if (oldBed && oldBed !== bedId) await hdb.from("lp_beds").update({ status: "limpeza" }).eq("id", oldBed);
    if (bedId) await hdb.from("lp_beds").update({ status: "ocupado" }).eq("id", bedId);
    await hdb.from("lp_records").insert({ patient_id: admission.patient_id, staff_id: me?.id ?? null, kind: "conduta", specialty: null, body: `Transferência para ${sector}${bedId ? ` — leito ${data.beds.find((b) => b.id === bedId)?.code}` : ""}.${reason ? ` Motivo: ${reason}` : ""}`, data: { setor: sector } });
    await reload(); setBusy(false); onClose();
  };
  return (
    <Modal slim title="Transferir paciente" sub={data.patients.find((p) => p.id === admission.patient_id)?.full_name} onClose={onClose}
      footer={<><div className="ml-auto flex gap-2"><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn icon={ArrowRightLeft} disabled={busy} onClick={() => void save()}>{busy ? "Transferindo…" : "Transferir"}</Btn></div></>}>
      <div className="hms-form-grid">
        <Field label="Novo setor"><select className="hms-select" value={sector} onChange={(e) => { setSector(e.target.value); setBedId(""); }}>{data.settings.sectors.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Novo leito"><select className="hms-select" value={bedId} onChange={(e) => setBedId(e.target.value)}><option value="">Sem leito</option>{free.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}</select></Field>
        <Field label="Motivo da transferência" className="span-2"><input className="hms-input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function DischargeModal({ admission, onClose }: { admission: Admission; onClose: () => void }) {
  const { data, reload } = useHms();
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"alta" | "obito">("alta");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    await hdb.from("lp_admissions").update({ discharged_at: new Date().toISOString(), discharge_notes: notes || null, status }).eq("id", admission.id);
    if (admission.bed_id) await hdb.from("lp_beds").update({ status: "limpeza" }).eq("id", admission.bed_id);
    await hdb.from("lp_patients").update({ status: status === "alta" ? "alta" : "obito", bed_id: null }).eq("id", admission.patient_id);
    await reload(); setBusy(false); onClose();
  };
  return (
    <Modal slim title={status === "alta" ? "Registrar alta hospitalar" : "Registrar óbito"} sub={data.patients.find((p) => p.id === admission.patient_id)?.full_name} onClose={onClose}
      footer={<><div className="ml-auto flex gap-2"><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn icon={LogOut} disabled={busy} onClick={() => void save()}>{busy ? "Salvando…" : "Confirmar"}</Btn></div></>}>
      <div className="hms-form-grid">
        <Field label="Desfecho" className="span-2"><select className="hms-select" value={status} onChange={(e) => setStatus(e.target.value as "alta" | "obito")}><option value="alta">Alta hospitalar</option><option value="obito">Óbito (fictício)</option></select></Field>
        <Field label="Resumo / orientações de alta" className="span-2"><textarea className="hms-textarea" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Orientações de seguimento…" /></Field>
      </div>
      <div className="mt-3"><Banner tone="warn">O leito será marcado como <b>em limpeza</b> e liberado pela equipe de leitos.</Banner></div>
    </Modal>
  );
}

/* ============================ LEITOS ============================ */

export function BedsModule() {
  const { data, patientById, isAdmin, reload, go } = useHms();
  const [sel, setSel] = useState<Bed | null>(null);
  const [add, setAdd] = useState(false);
  const occupancy = useMemo(() => {
    const map = new Map<string, { patient?: Patient; admission?: Admission }>();
    for (const a of data.admissions.filter((x) => !x.discharged_at && x.bed_id)) map.set(a.bed_id as string, { admission: a, patient: patientById(a.patient_id) });
    for (const p of data.patients.filter((x) => x.bed_id && !["alta", "obito"].includes(x.status))) if (!map.has(p.bed_id as string)) map.set(p.bed_id as string, { patient: p });
    return map;
  }, [data.admissions, data.patients, patientById]);
  const wards = Array.from(new Set(data.beds.map((b) => b.ward)));
  const occupied = data.beds.filter((b) => occupancy.has(b.id)).length;

  return (
    <Page eyebrow="Mapa hospitalar" title="Leitos" sub="Ocupação em tempo real por ala, quarto e status operacional."
      actions={isAdmin ? <Btn icon={Plus} onClick={() => setAdd(true)}>Novo leito</Btn> : undefined}>
      <div className="hms-cols-4 hms-grid mb-3">
        <Kpi label="Leitos totais" value={data.beds.length} note={`${wards.length} alas`} icon={Building2} />
        <Kpi label="Ocupados" value={occupied} note={`${Math.round((occupied / Math.max(data.beds.length, 1)) * 100)}% de ocupação`} icon={BedDouble} tone="brand" />
        <Kpi label="Disponíveis" value={data.beds.filter((b) => !occupancy.has(b.id) && b.status === "disponivel").length} note="prontos para uso" icon={DoorOpen} tone="ok" />
        <Kpi label="Bloqueados" value={data.beds.filter((b) => b.status === "limpeza" || b.status === "manutencao").length} note="limpeza/manutenção" icon={AlertTriangle} tone="warn" />
      </div>
      <div className="hms-stack">
        {wards.map((w) => {
          const beds = data.beds.filter((b) => b.ward === w);
          const occ = beds.filter((b) => occupancy.has(b.id)).length;
          return (
            <Card key={w} title={w} sub={`${occ}/${beds.length} ocupados`} actions={<div className="flex items-center gap-1.5 text-[10.5px] text-[var(--h-muted)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--h-brand)]" />ocupado<span className="ml-2 h-1.5 w-1.5 rounded-full bg-[var(--h-line-strong)]" />livre</div>}>
              <div className="hms-bed-grid">
                {beds.map((b) => {
                  const occInfo = occupancy.get(b.id);
                  const isUti = b.ward === "UTI";
                  return (
                    <button key={b.id} className={`hms-bed ${occInfo ? (isUti ? "is-uti" : "is-ocupado") : `is-${b.status}`}`} onClick={() => setSel(b)}>
                      <span className="bed-dot" />
                      <span className="bed-code">{b.code}</span>
                      <span className="bed-name">{occInfo?.patient?.full_name ?? BED_STATUS[b.status] ?? "Disponível"}</span>
                      <span className="bed-name text-[9.5px] opacity-70">{b.room ? `Quarto ${b.room}` : b.status}</span>
                    </button>
                  );
                })}
              </div>
            </Card>
          );
        })}
        {!wards.length && <Card><Empty icon={BedDouble} title="Nenhum leito cadastrado" children="Cadastre a estrutura hospitalar em Configurações." /></Card>}
      </div>
      {sel && (
        <Modal slim title={`Leito ${sel.code}`} sub={`${sel.ward}${sel.room ? ` · quarto ${sel.room}` : ""}`} onClose={() => setSel(null)}
          footer={<><Chip tone={bedTone(sel.status)}>{BED_STATUS[sel.status] ?? sel.status}</Chip><div className="ml-auto flex gap-2">{occupancy.get(sel.id)?.patient && <Btn variant="ghost" onClick={() => { go("patients", { patientId: occupancy.get(sel.id)?.patient?.id }); setSel(null); }}>Prontuário</Btn>}<Btn variant="ghost" onClick={() => setSel(null)}>Fechar</Btn></div></>}>
          <div className="hms-form-grid">
            <Field label="Status operacional" className="span-2">
              <select className="hms-select" value={sel.status} disabled={!!occupancy.get(sel.id)} onChange={async (e) => { await hdb.from("lp_beds").update({ status: e.target.value }).eq("id", sel.id); await reload(); setSel({ ...sel, status: e.target.value }); }}>
                {Object.entries(BED_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Quarto" className="span-2"><input className="hms-input" defaultValue={sel.room ?? ""} onBlur={async (e) => { await hdb.from("lp_beds").update({ room: e.target.value || null }).eq("id", sel.id); await reload(); }} /></Field>
          </div>
          {occupancy.get(sel.id) && (
            <div className="mt-3 rounded-xl bg-[var(--h-soft)] p-3">
              <div className="hms-section-label">Paciente internado</div>
              <div className="mt-1 flex items-center gap-2"><Avatar name={occupancy.get(sel.id)?.patient?.full_name} size={30} /><div><div className="text-[13px] font-semibold">{occupancy.get(sel.id)?.patient?.full_name}</div><div className="hms-code">{occupancy.get(sel.id)?.patient?.code}</div></div></div>
              <div className="mt-2 text-[11.5px] text-[var(--h-muted)]">Entrada: {fDateTime(occupancy.get(sel.id)?.admission?.admitted_at)}</div>
            </div>
          )}
        </Modal>
      )}
      {add && <BedForm onClose={() => setAdd(false)} />}
    </Page>
  );
}

function BedForm({ onClose }: { onClose: () => void }) {
  const { data, reload } = useHms();
  const [f, setF] = useState({ ward: data.settings.sectors[0] ?? "Enfermaria", code: "", room: "", status: "disponivel" });
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal slim title="Novo leito" onClose={onClose}
      footer={<><div className="ml-auto flex gap-2"><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn icon={Plus} onClick={async () => {
        if (!f.code.trim() || !f.ward.trim()) { setErr("Informe ala e código do leito."); return; }
        const res = await hdb.from("lp_beds").insert({ ward: f.ward, code: f.code.trim(), room: f.room || null, status: f.status });
        if (res.error) { setErr(res.error.message); return; }
        await reload(); onClose();
      }}>Cadastrar leito</Btn></div></>}>
      {err && <div className="mb-3"><Banner tone="error">{err}</Banner></div>}
      <div className="hms-form-grid">
        <Field label="Ala / setor"><input className="hms-input" value={f.ward} onChange={(e) => setF({ ...f, ward: e.target.value })} list="lifeplus-sectors" /></Field>
        <Field label="Código do leito"><input className="hms-input" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="EN-109" /></Field>
        <Field label="Quarto"><input className="hms-input" value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })} placeholder="109" /></Field>
        <Field label="Status"><select className="hms-select" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{Object.entries(BED_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      </div>
      <datalist id="lifeplus-sectors">{data.settings.sectors.map((s) => <option key={s} value={s} />)}</datalist>
    </Modal>
  );
}

/* ============================ FARMÁCIA ============================ */

export function PharmacyModule() {
  const { data, reload, isAdmin, can, lowStock, role } = useHms();
  const canManage = !!role && ["administrador", "diretor", "farmaceutico"].includes(role);
  const canMove = canManage || role === "enfermeiro";
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Medication | "new" | null>(null);
  const [move, setMove] = useState<{ med: Medication; kind: "entrada" | "saida" } | null>(null);
  const [tab, setTab] = useState<"estoque" | "movimentos">("estoque");
  const [moves, setMoves] = useState<{ id: string; medication_id: string; kind: string; qty: number; note: string | null; created_at: string }[]>([]);
  const list = data.meds.filter((m) => [m.name, m.active_ingredient, m.presentation, m.lot, m.manufacturer].some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase())));
  const expiring = data.meds.filter((m) => m.expires_on && +new Date(m.expires_on) - Date.now() < 90 * 86400000);

  const loadMoves = async () => {
    const { data: rows } = await hdb.from("lp_stock_moves").select("*").order("created_at", { ascending: false }).limit(120);
    setMoves((rows ?? []) as typeof moves);
  };

  return (
    <Page eyebrow="Farmácia hospitalar" title="Farmácia" sub="Medicamentos fictícios, lotes, validade, entradas e saídas com baixa automática de estoque."
      actions={canManage ? <Btn icon={Plus} onClick={() => setEdit("new")}>Novo medicamento</Btn> : undefined}>
      <div className="hms-cols-4 hms-grid mb-3">
        <Kpi label="Itens" value={data.meds.length} note="cadastrados" icon={Pill} tone="brand" />
        <Kpi label="Estoque baixo" value={lowStock.length} note="abaixo do mínimo" icon={TrendingDown} tone={lowStock.length ? "vital" : "ok"} />
        <Kpi label="Unidades" value={data.meds.reduce((a, m) => a + m.stock, 0)} note="em estoque" icon={Boxes} />
        <Kpi label="Vencendo" value={expiring.length} note="em até 90 dias" icon={AlertTriangle} tone="warn" />
      </div>
      {lowStock.length > 0 && (
        <div className="mb-3"><Banner tone="warn"><b>{lowStock.length} medicamento(s) no limite:</b> {lowStock.map((m) => `${m.name} (${m.stock})`).join(" · ")}. Registre uma entrada na farmácia.</Banner></div>
      )}
      <Card noBody>
        <div className="hms-toolbar">
          <Tabs items={[{ key: "estoque", label: "Estoque" }, { key: "movimentos", label: "Movimentações" }]} value={tab} onChange={(v) => { setTab(v as "estoque" | "movimentos"); if (v === "movimentos") void loadMoves(); }} />
          <div className="push"><SearchInput value={q} onChange={setQ} placeholder="Nome, princípio ativo, lote…" /></div>
        </div>
        {tab === "estoque" ? (
          list.length === 0 ? <Empty icon={Pill} title="Nenhum medicamento" children="Cadastre medicamentos fictícios para o receituário e a farmácia." action={canManage ? <Btn icon={Plus} onClick={() => setEdit("new")}>Novo medicamento</Btn> : undefined} /> : (
            <Table head={<tr><th>Medicamento</th><th>Concentração</th><th>Apresentação</th><th>Lote</th><th>Validade</th><th className="num">Estoque</th><th>Status</th><th /></tr>}>
              {list.map((m) => (
                <tr key={m.id}>
                  <td><div className="strong">{m.name}</div><div className="hms-code">{m.active_ingredient ?? "—"} · {m.manufacturer ?? "—"}</div></td>
                  <td className="muted">{m.concentration ?? "—"}</td>
                  <td className="muted">{m.presentation ?? "—"}</td>
                  <td className="hms-code">{m.lot ?? "—"}</td>
                  <td className={m.expires_on && +new Date(m.expires_on) < Date.now() ? "text-[var(--h-vital)]" : "muted"}>{m.expires_on ? fDate(m.expires_on) : "—"}</td>
                  <td className="num"><b>{m.stock}</b><span className="muted"> / {m.min_stock}</span></td>
                  <td><Chip tone={m.stock === 0 ? "vital" : m.stock <= m.min_stock ? "warn" : "ok"}>{m.stock === 0 ? "esgotado" : m.stock <= m.min_stock ? "baixo" : "ok"}</Chip></td>
                  <td>
                    <div className="flex justify-end gap-1">
                      {canMove && <button className="hms-btn ghost sm" title="Entrada" onClick={() => setMove({ med: m, kind: "entrada" })}><PackagePlus className="h-3.5 w-3.5" /></button>}
                      {canMove && <button className="hms-btn ghost sm" title="Saída" disabled={m.stock === 0} onClick={() => setMove({ med: m, kind: "saida" })}><PackageMinus className="h-3.5 w-3.5" /></button>}
                      {canManage && <button className="hms-btn ghost sm" title="Editar" onClick={() => setEdit(m)}><Pencil className="h-3.5 w-3.5" /></button>}
                      {isAdmin && <button className="hms-btn danger-ghost sm" title="Excluir" onClick={async () => { if (confirm(`Excluir ${m.name}?`)) { await hdb.from("lp_medications").delete().eq("id", m.id); await reload(); } }}><Trash2 className="h-3.5 w-3.5" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )
        ) : (
          <Table head={<tr><th>Data</th><th>Medicamento</th><th>Tipo</th><th className="num">Qtd.</th><th>Observação</th></tr>}>
            {moves.map((mv) => {
              const m = data.meds.find((x) => x.id === mv.medication_id);
              return <tr key={mv.id}><td className="muted">{fDateTime(mv.created_at)}</td><td className="strong">{m?.name ?? "—"}</td><td><Chip tone={mv.kind === "entrada" ? "ok" : "warn"}>{mv.kind}</Chip></td><td className="num">{mv.qty}</td><td className="muted">{mv.note ?? "—"}</td></tr>;
            })}
            {!moves.length && <tr><td colSpan={5}><Empty icon={ShoppingCart} title="Sem movimentações" children="Entradas e saídas de estoque aparecem aqui." /></td></tr>}
          </Table>
        )}
      </Card>
      {edit && <MedicationForm medication={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
      {move && <StockMoveForm med={move.med} kind={move.kind} onClose={() => { setMove(null); void loadMoves(); }} />}
    </Page>
  );
}

function MedicationForm({ medication, onClose }: { medication: Medication | null; onClose: () => void }) {
  const { reload } = useHms();
  const [f, setF] = useState({
    name: medication?.name ?? "", active_ingredient: medication?.active_ingredient ?? "", concentration: medication?.concentration ?? "",
    presentation: medication?.presentation ?? "", manufacturer: medication?.manufacturer ?? "", stock: String(medication?.stock ?? 0),
    min_stock: String(medication?.min_stock ?? 10), lot: medication?.lot ?? "", expires_on: medication?.expires_on ?? "",
  });
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal title={medication ? `Editar ${medication.name}` : "Novo medicamento"} sub="Medicamentos fictícios, criados para o roleplay da Life+." onClose={onClose}
      footer={<><span className="text-[11px] text-[var(--h-muted)]">O estoque também é ajustado por entradas e saídas.</span><div className="ml-auto flex gap-2"><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn icon={Pill} onClick={async () => {
        if (!f.name.trim()) { setErr("Informe o nome do medicamento."); return; }
        const payload = { name: f.name.trim(), active_ingredient: f.active_ingredient || null, concentration: f.concentration || null, presentation: f.presentation || null, manufacturer: f.manufacturer || null, stock: Number(f.stock) || 0, min_stock: Number(f.min_stock) || 0, lot: f.lot || null, expires_on: f.expires_on || null };
        const res = medication ? await hdb.from("lp_medications").update(payload).eq("id", medication.id) : await hdb.from("lp_medications").insert(payload);
        if (res.error) { setErr(res.error.message); return; }
        await reload(); onClose();
      }}>Salvar</Btn></div></>}>
      {err && <div className="mb-3"><Banner tone="error">{err}</Banner></div>}
      <div className="hms-form-grid">
        <Field label="Nome *" className="span-2"><input className="hms-input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Princípio ativo fictício"><input className="hms-input" value={f.active_ingredient} onChange={(e) => setF({ ...f, active_ingredient: e.target.value })} /></Field>
        <Field label="Concentração"><input className="hms-input" value={f.concentration} onChange={(e) => setF({ ...f, concentration: e.target.value })} placeholder="500 mg" /></Field>
        <Field label="Apresentação"><input className="hms-input" value={f.presentation} onChange={(e) => setF({ ...f, presentation: e.target.value })} placeholder="Comprimido" /></Field>
        <Field label="Fabricante fictício"><input className="hms-input" value={f.manufacturer} onChange={(e) => setF({ ...f, manufacturer: e.target.value })} /></Field>
        <Field label="Estoque atual"><input type="number" min={0} className="hms-input" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} /></Field>
        <Field label="Estoque mínimo"><input type="number" min={0} className="hms-input" value={f.min_stock} onChange={(e) => setF({ ...f, min_stock: e.target.value })} /></Field>
        <Field label="Lote"><input className="hms-input" value={f.lot} onChange={(e) => setF({ ...f, lot: e.target.value })} /></Field>
        <Field label="Validade"><input type="date" className="hms-input" value={f.expires_on} onChange={(e) => setF({ ...f, expires_on: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function StockMoveForm({ med, kind, onClose }: { med: Medication; kind: "entrada" | "saida"; onClose: () => void }) {
  const { reload } = useHms();
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal slim title={kind === "entrada" ? "Entrada de estoque" : "Saída de estoque"} sub={`${med.name} · saldo atual ${med.stock}`} onClose={onClose}
      footer={<><div className="ml-auto flex gap-2"><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn icon={kind === "entrada" ? PackagePlus : PackageMinus} onClick={async () => {
        const n = Number(qty);
        if (!n || n <= 0) { setErr("Quantidade inválida."); return; }
        if (kind === "saida" && n > med.stock) { setErr("Estoque insuficiente."); return; }
        const res = await hdb.from("lp_stock_moves").insert({ medication_id: med.id, kind, qty: n, note: note || null });
        if (res.error) { setErr(res.error.message); return; }
        await reload(); onClose();
      }}>Registrar</Btn></div></>}>
      {err && <div className="mb-3"><Banner tone="error">{err}</Banner></div>}
      <div className="hms-form-grid">
        <Field label="Quantidade" className="span-2"><input type="number" min={1} className="hms-input" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
        <Field label="Observação" className="span-2"><input className="hms-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota fiscal fictícia, dispensação…" /></Field>
      </div>
    </Modal>
  );
}
