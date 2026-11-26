import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Archive, Trash2, Pencil, Upload, User } from "lucide-react";
import { hdb, INSURANCES, BLOOD, ageOf, fDate, fDateTime, uploadLp, lpUrl, can, DOC_KINDS, APPT_STATUS, EXAM_STATUS, type Core, type Patient } from "./core";
import { PageHead, Modal, F, Empty, Badge } from "./ui";

export function Avatar({ path, name, size = 40 }: { path: string | null; name: string; size?: number }) {
  const [url, setUrl] = useState("");
  useEffect(() => { if (path) lpUrl(path).then(setUrl); }, [path]);
  return url ? <img src={url} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
    : <div className="h-accent-soft flex shrink-0 items-center justify-center rounded-full font-semibold" style={{ width: size, height: size, fontSize: size / 2.6 }}>{name.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase() || <User className="h-4 w-4" />}</div>;
}

const empty = { full_name: "", nickname: "", birth_date: "", sex: "", phone: "", email: "", address: "", blood_type: "", allergies: "", conditions: "", medications: "", medical_notes: "", insurance: "Nenhum", photo_url: "" };

export function PatientForm({ initial, onClose, onSaved }: { initial?: Patient | null; onClose: () => void; onSaved: (id: string) => void }) {
  const [f, setF] = useState<Record<string, string>>(() => initial ? Object.fromEntries(Object.keys(empty).map((k) => [k, String((initial as unknown as Record<string, unknown>)[k] ?? "")])) : { ...empty });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const age = ageOf(f.birth_date || null);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.full_name.trim()) return toast.error("Informe o nome completo.");
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) return toast.error("E-mail inválido.");
    setBusy(true);
    const row = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() ? v.trim() : null]));
    row.insurance = INSURANCES.includes(f.insurance as never) ? f.insurance : "Nenhum";
    const q = initial ? hdb.from("lp_patients").update(row).eq("id", initial.id).select("id").single() : hdb.from("lp_patients").insert({ ...row, triage: "verde", status: "triagem" }).select("id").single();
    const { data, error } = await q; setBusy(false);
    if (error) return toast.error("Não foi possível salvar: " + error.message);
    toast.success(initial ? "Paciente atualizado." : "Paciente cadastrado."); onSaved(data.id);
  };
  const photo = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Escolha uma imagem.");
    try { setF({ ...f, photo_url: await uploadLp(file, "patients") }); } catch { toast.error("Falha no envio da foto."); }
  };
  return (
    <Modal title={initial ? `Editar ${initial.full_name}` : "Novo paciente"} onClose={onClose} wide>
      <form onSubmit={save} className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar path={f.photo_url || null} name={f.full_name} size={64} />
          <label className="h-btn-ghost cursor-pointer"><Upload className="h-4 w-4" /> Foto de perfil<input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && photo(e.target.files[0])} /></label>
          {f.photo_url && <button type="button" className="h-muted text-xs underline" onClick={() => setF({ ...f, photo_url: "" })}>Remover</button>}
        </div>
        <section><h3 className="mb-3 text-sm font-semibold">Informações pessoais</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <F label="Nome completo *" span><input className="h-input" required value={f.full_name} onChange={set("full_name")} /></F>
            <F label="Usuário / apelido no RP"><input className="h-input" value={f.nickname} onChange={set("nickname")} /></F>
            <F label={`Data de nascimento${age != null ? ` · ${age} anos` : ""}`}><input type="date" className="h-input" value={f.birth_date} onChange={set("birth_date")} /></F>
            <F label="Sexo"><select className="h-input" value={f.sex} onChange={set("sex")}><option value="">Não informado</option><option>Masculino</option><option>Feminino</option><option>Outro</option></select></F>
            <F label="Telefone"><input className="h-input" value={f.phone} onChange={set("phone")} /></F>
            <F label="E-mail (opcional)"><input type="email" className="h-input" value={f.email} onChange={set("email")} /></F>
            <F label="Endereço" span><input className="h-input" value={f.address} onChange={set("address")} /></F>
          </div></section>
        <section><h3 className="mb-3 text-sm font-semibold">Informações médicas</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <F label="Tipo sanguíneo (opcional)"><select className="h-input" value={f.blood_type} onChange={set("blood_type")}><option value="">Não informado</option>{BLOOD.map((b) => <option key={b}>{b}</option>)}</select></F>
            <F label="Convênio médico">
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Convênio">
                {INSURANCES.map((i) => <button type="button" key={i} role="radio" aria-checked={f.insurance === i} onClick={() => setF({ ...f, insurance: i })} className={f.insurance === i ? "h-btn" : "h-btn-ghost"}>{i}</button>)}
              </div>
            </F>
            <F label="Alergias"><textarea className="h-input" rows={2} value={f.allergies} onChange={set("allergies")} /></F>
            <F label="Condições preexistentes"><textarea className="h-input" rows={2} value={f.conditions} onChange={set("conditions")} /></F>
            <F label="Medicamentos em uso"><textarea className="h-input" rows={2} value={f.medications} onChange={set("medications")} /></F>
            <F label="Observações médicas"><textarea className="h-input" rows={2} value={f.medical_notes} onChange={set("medical_notes")} /></F>
          </div></section>
        <div className="flex justify-end gap-2"><button type="button" className="h-btn-ghost" onClick={onClose}>Cancelar</button><button className="h-btn" disabled={busy}>{busy ? "Salvando…" : "Salvar paciente"}</button></div>
      </form>
    </Modal>
  );
}

export function PatientsModule({ core, reload, openPatient }: { core: Core; reload: () => void; openPatient: (id: string) => void }) {
  const [q, setQ] = useState(""); const [ins, setIns] = useState(""); const [showArch, setShowArch] = useState(false);
  const [form, setForm] = useState(false);
  const list = useMemo(() => core.patients.filter((p) => !p.is_simulated && (showArch ? p.archived_at : !p.archived_at)
    && (!ins || (p.insurance || "Nenhum") === ins)
    && (!q || `${p.full_name} ${p.code} ${p.nickname ?? ""}`.toLowerCase().includes(q.toLowerCase()))), [core.patients, q, ins, showArch]);
  return (
    <div>
      <PageHead title="Pacientes" sub={`${core.patients.filter((p) => !p.archived_at && !p.is_simulated).length} pacientes ativos`} actions={<button className="h-btn" onClick={() => setForm(true)}><Plus className="h-4 w-4" /> Novo paciente</button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <label className="relative min-w-60 flex-1"><Search className="h-muted absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" /><input className="h-input" style={{ paddingLeft: 34 }} placeholder="Pesquisar por nome, código ou apelido" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select className="h-input" style={{ width: 180 }} value={ins} onChange={(e) => setIns(e.target.value)} aria-label="Convênio"><option value="">Todos os convênios</option>{INSURANCES.map((i) => <option key={i}>{i}</option>)}</select>
        <button className={showArch ? "h-btn" : "h-btn-ghost"} onClick={() => setShowArch(!showArch)}><Archive className="h-4 w-4" /> Arquivados</button>
      </div>
      {list.length === 0 ? <Empty text="Nenhum paciente encontrado." /> : (
        <div className="h-panel overflow-x-auto"><table className="h-table"><thead><tr><th>Paciente</th><th>Código</th><th>Idade</th><th>Convênio</th><th>Tipo sanguíneo</th><th>Cadastro</th></tr></thead><tbody>
          {list.map((p) => (
            <tr key={p.id} className="cursor-pointer" onClick={() => openPatient(p.id)}>
              <td><div className="flex items-center gap-3"><Avatar path={p.photo_url} name={p.full_name} size={34} /><div><div className="font-medium">{p.full_name}</div>{p.nickname && <div className="h-muted text-xs">@{p.nickname}</div>}</div></div></td>
              <td className="font-mono text-xs">{p.code}</td><td>{ageOf(p.birth_date) ?? "—"}</td><td><Badge>{p.insurance || "Nenhum"}</Badge></td><td>{p.blood_type || "—"}</td><td className="h-muted text-xs">{fDate(p.created_at)}</td>
            </tr>))}
        </tbody></table></div>
      )}
      {form && <PatientForm onClose={() => setForm(false)} onSaved={(id) => { setForm(false); reload(); openPatient(id); }} />}
    </div>
  );
}

type TL = { at: string; kind: string; title: string; detail?: string };
export function PatientPage({ id, core, reload, back, go }: { id: string; core: Core; reload: () => void; back: () => void; go: (m: string, extra?: Record<string, string>) => void }) {
  const p = core.patients.find((x) => x.id === id);
  const [edit, setEdit] = useState(false);
  const [d, setD] = useState<{ appts: { id: string; starts_at: string; specialty: string | null; status: string; reason: string | null }[]; recs: { id: string; kind: string; body: string; created_at: string; data: Record<string, unknown> }[]; docs: { id: string; kind: string; title: string; code: string; status: string; created_at: string }[]; exams: { id: string; kind: string; status: string; requested_at: string; category: string }[]; adms: { id: string; admitted_at: string; discharged_at: string | null; reason: string | null; status: string; sector: string | null }[] } | null>(null);
  const [tab, setTab] = useState("timeline");
  useEffect(() => {
    (async () => {
      const [a, r, dc, e, ad] = await Promise.all([
        hdb.from("lp_appointments").select("id,starts_at,specialty,status,reason").eq("patient_id", id).order("starts_at", { ascending: false }),
        hdb.from("lp_records").select("id,kind,body,created_at,data").eq("patient_id", id).order("created_at", { ascending: false }),
        hdb.from("lp_documents").select("id,kind,title,code,status,created_at").eq("patient_id", id).order("created_at", { ascending: false }),
        hdb.from("lp_exams").select("id,kind,status,requested_at,category").eq("patient_id", id).order("requested_at", { ascending: false }),
        hdb.from("lp_admissions").select("id,admitted_at,discharged_at,reason,status,sector").eq("patient_id", id).order("admitted_at", { ascending: false }),
      ]);
      setD({ appts: a.data ?? [], recs: r.data ?? [], docs: dc.data ?? [], exams: e.data ?? [], adms: ad.data ?? [] });
    })();
  }, [id]);
  if (!p) return <Empty text="Paciente não encontrado." />;
  const timeline: TL[] = d ? [
    ...d.appts.map((x) => ({ at: x.starts_at, kind: "Consulta", title: `${x.specialty ?? "Consulta"} — ${APPT_STATUS[x.status]}`, detail: x.reason ?? "" })),
    ...d.recs.map((x) => ({ at: x.created_at, kind: x.kind === "diagnostico" ? "Diagnóstico" : "Prontuário", title: x.kind === "diagnostico" ? String(x.data.principal ?? "Diagnóstico") : x.kind, detail: x.body })),
    ...d.docs.map((x) => ({ at: x.created_at, kind: "Documento", title: `${x.title} (${x.code})`, detail: x.status })),
    ...d.exams.map((x) => ({ at: x.requested_at, kind: "Exame", title: `${x.kind} · ${x.category}`, detail: EXAM_STATUS[x.status] ?? x.status })),
    ...d.adms.flatMap((x) => [{ at: x.admitted_at, kind: "Internação", title: `Internação — ${x.sector ?? ""}`, detail: x.reason ?? "" }, ...(x.discharged_at ? [{ at: x.discharged_at, kind: "Alta", title: "Alta hospitalar" }] : [])]),
  ].sort((a, b) => b.at.localeCompare(a.at)) : [];
  const archive = async () => { await hdb.from("lp_patients").update({ archived_at: p.archived_at ? null : new Date().toISOString() }).eq("id", p.id); toast.success(p.archived_at ? "Cadastro reativado." : "Cadastro arquivado."); reload(); };
  const del = async () => { if (!confirm(`Excluir definitivamente ${p.full_name} e todo o histórico?`)) return; const { error } = await hdb.from("lp_patients").delete().eq("id", p.id); if (error) return toast.error("Sem permissão para excluir."); reload(); back(); };
  const age = ageOf(p.birth_date);
  const tabs = [["timeline", "Linha do tempo"], ["consultas", `Consultas (${d?.appts.length ?? 0})`], ["diagnosticos", "Diagnósticos"], ["documentos", `Documentos (${d?.docs.length ?? 0})`], ["exames", `Exames (${d?.exams.length ?? 0})`], ["internacoes", `Internações (${d?.adms.length ?? 0})`]];
  return (
    <div>
      <button className="h-muted mb-4 text-sm hover:underline" onClick={back}>← Pacientes</button>
      <div className="h-panel mb-5 flex flex-wrap items-start gap-5 p-6">
        <Avatar path={p.photo_url} name={p.full_name} size={84} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold">{p.full_name}</h1>{p.archived_at && <Badge tone="muted">Arquivado</Badge>}</div>
          <div className="h-muted mt-1 text-sm"><span className="font-mono">{p.code}</span>{p.nickname && ` · @${p.nickname}`} · {age != null ? `${age} anos` : "idade não informada"} · {p.sex || "sexo não informado"}</div>
          <div className="mt-3 flex flex-wrap gap-2"><Badge>Convênio: {p.insurance || "Nenhum"}</Badge><Badge>Tipo sanguíneo: {p.blood_type || "—"}</Badge>{p.allergies && <Badge tone="danger">Alergias: {p.allergies}</Badge>}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="h-btn" onClick={() => go("consultas", { patient: p.id })}>Agendar consulta</button>
          <button className="h-btn-ghost" onClick={() => go("prontuarios", { patient: p.id })}>Prontuário</button>
          <button className="h-btn-ghost" onClick={() => go("documentos", { patient: p.id })}>Novo documento</button>
          <button className="h-btn-ghost" onClick={() => setEdit(true)} aria-label="Editar"><Pencil className="h-4 w-4" /></button>
          <button className="h-btn-ghost" onClick={archive} aria-label="Arquivar"><Archive className="h-4 w-4" /></button>
          {can(core.role, ["diretor"]) && <button className="h-btn-ghost h-danger" onClick={del} aria-label="Excluir"><Trash2 className="h-4 w-4" /></button>}
        </div>
      </div>
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        {[["Condições preexistentes", p.conditions], ["Medicamentos em uso", p.medications], ["Observações médicas", p.medical_notes], ["Telefone", p.phone], ["E-mail", p.email], ["Endereço", p.address]].map(([l, v]) => (
          <div key={l} className="h-panel p-4"><div className="h-muted text-xs">{l}</div><div className="mt-1 whitespace-pre-wrap text-sm">{v || "—"}</div></div>))}
      </div>
      <div className="mb-4 flex flex-wrap gap-1">{tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={tab === k ? "h-btn" : "h-btn-ghost"}>{l}</button>)}</div>
      {!d ? <div className="h-muted text-sm">Carregando…</div> : tab === "timeline" ? (
        timeline.length === 0 ? <Empty text="Nenhum acontecimento registrado." /> :
        <ol className="relative ml-3 border-l h-border pl-6">{timeline.map((t, i) => (
          <li key={i} className="mb-5"><span className="h-accent-bg absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full" /><div className="h-muted text-xs">{fDateTime(t.at)} · {t.kind}</div><div className="font-medium">{t.title}</div>{t.detail && <div className="h-muted line-clamp-2 text-sm">{t.detail}</div>}</li>))}</ol>
      ) : tab === "consultas" ? <SimpleList rows={d.appts.map((a) => [fDateTime(a.starts_at), a.specialty ?? "—", APPT_STATUS[a.status], a.reason ?? ""])} />
      : tab === "diagnosticos" ? <SimpleList rows={d.recs.filter((r) => r.kind === "diagnostico").map((r) => [fDateTime(r.created_at), String(r.data.principal ?? ""), ((r.data.secundarios as string[]) ?? []).join(", "), r.body])} />
      : tab === "documentos" ? <SimpleList rows={d.docs.map((x) => [fDateTime(x.created_at), x.code, DOC_KINDS[x.kind] ?? x.title, x.status])} onClick={(i) => go("documentos", { doc: d.docs[i].id })} />
      : tab === "exames" ? <SimpleList rows={d.exams.map((x) => [fDateTime(x.requested_at), x.kind, x.category, EXAM_STATUS[x.status] ?? x.status])} />
      : <SimpleList rows={d.adms.map((x) => [fDateTime(x.admitted_at), x.sector ?? "—", x.reason ?? "", x.discharged_at ? `Alta ${fDateTime(x.discharged_at)}` : "Internado"])} />}
      {edit && <PatientForm initial={p} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); reload(); }} />}
    </div>
  );
}

export function SimpleList({ rows, onClick }: { rows: string[][]; onClick?: (i: number) => void }) {
  if (!rows.length) return <Empty text="Nada registrado ainda." />;
  return <div className="h-panel overflow-x-auto"><table className="h-table"><tbody>{rows.map((r, i) => <tr key={i} className={onClick ? "cursor-pointer" : ""} onClick={() => onClick?.(i)}>{r.map((c, j) => <td key={j} className={j === 0 ? "h-muted whitespace-nowrap text-xs" : ""}>{c}</td>)}</tr>)}</tbody></table></div>;
}
