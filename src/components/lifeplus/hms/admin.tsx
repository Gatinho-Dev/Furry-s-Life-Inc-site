import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Bell, Bot, Building2, CalendarDays, CheckCheck, ClipboardList, Download, FileText, FlaskConical,
  Hospital, Info, LineChart, Lock, Pencil, Plus, Printer, ScrollText, Settings as SettingsIcon, Shield,
  ShieldCheck, Sparkles, Stethoscope, Trash2, UserCog, Users, Wand2,
} from "lucide-react";
import {
  hdb, ageOf, fDate, fDateTime, toCSV, download, ROLES, INSURANCES, type Staff,
} from "./core";
import { useHms, ALL_ROLES, PERMS, type AuditRow, type ModuleKey } from "./data";
import { Avatar, Banner, Btn, Card, Chip, CopyBtn, Empty, Field, Kpi, Modal, Page, SearchInput, Table, Tabs } from "./ui";
import { PatientSelect } from "./pickers";
import { paperToPdf, printPaper, PaperView } from "./docs";

/* ============================ EQUIPE ============================ */

export function TeamModule() {
  const { data, reload, isAdmin, can } = useHms();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [edit, setEdit] = useState<Staff | "new" | null>(null);
  const [matrix, setMatrix] = useState(false);
  const list = data.staff.filter((s) => (!role || s.role === role) && [s.full_name, s.username, s.specialty, s.registry, s.uf].some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase())));

  return (
    <Page eyebrow="Corpo clínico" title="Equipe" sub="Médicos, enfermagem, recepção, farmácia e administração — com registro profissional fictício e permissões por cargo."
      actions={<><Btn variant="ghost" icon={Shield} onClick={() => setMatrix(true)}>Permissões</Btn>{can("team") && <Btn icon={Plus} onClick={() => setEdit("new")}>Novo profissional</Btn>}</>}>
      <div className="hms-cols-4 hms-grid mb-3">
        <Kpi label="Equipe" value={data.staff.length} note="profissionais cadastrados" icon={Users} tone="brand" />
        <Kpi label="Médicos" value={data.staff.filter((s) => s.role === "medico").length} note="corpo clínico" icon={Stethoscope} />
        <Kpi label="Enfermagem" value={data.staff.filter((s) => s.role === "enfermeiro" || s.role === "tecnico").length} note="assistência" icon={Activity} tone="ok" />
        <Kpi label="Ativos" value={data.staff.filter((s) => s.status === "ativo").length} note="disponíveis" icon={ShieldCheck} />
      </div>
      <Card noBody>
        <div className="hms-toolbar">
          <SearchInput value={q} onChange={setQ} placeholder="Nome, especialidade, registro…" />
          <select className="hms-select" value={role} onChange={(e) => setRole(e.target.value)}><option value="">Todos os cargos</option>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <span className="push hms-code">{list.length} profissionais</span>
        </div>
        {list.length === 0 ? <Empty icon={Users} title="Nenhum profissional" children="Cadastre o corpo clínico da Life+ para vincular consultas, prontuários e documentos." action={<Btn icon={Plus} onClick={() => setEdit("new")}>Novo profissional</Btn>} /> : (
          <Table head={<tr><th>Profissional</th><th>Cargo</th><th>Especialidade</th><th>Registro</th><th>Vínculo</th><th>Status</th><th /></tr>}>
            {list.map((s) => (
              <tr key={s.id}>
                <td><div className="flex items-center gap-2"><Avatar name={s.full_name} url={s.photo_url} size={30} /><div><div className="strong">{s.full_name}</div><div className="hms-code">{s.username ?? "—"}</div></div></div></td>
                <td><Chip tone={s.role === "administrador" || s.role === "diretor" ? "vital" : s.role === "medico" ? "brand" : "default"}>{ROLES[s.role] ?? s.role}</Chip></td>
                <td className="muted">{s.specialty ?? "—"}</td>
                <td className="hms-code">{s.registry ? `${s.registry}${s.uf ? "/" + s.uf : ""}` : "—"}</td>
                <td className="muted">{s.user_id ? "conta vinculada" : "sem conta"}</td>
                <td><Chip tone={s.status === "ativo" ? "ok" : s.status === "ferias" ? "warn" : "outline"}>{s.status}</Chip></td>
                <td>{isAdmin && <div className="flex justify-end gap-1"><button className="hms-btn ghost sm" onClick={() => setEdit(s)}><Pencil className="h-3.5 w-3.5" /></button><button className="hms-btn danger-ghost sm" onClick={async () => { if (confirm(`Remover ${s.full_name} da equipe?`)) { await hdb.from("lp_staff").delete().eq("id", s.id); await reload(); } }}><Trash2 className="h-3.5 w-3.5" /></button></div>}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {edit && <StaffForm staff={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
      {matrix && (
        <Modal wide title="Permissões por cargo" sub="Aplicadas na interface e no banco de dados (RLS por cargo)." onClose={() => setMatrix(false)} footer={<Btn variant="ghost" onClick={() => setMatrix(false)}>Fechar</Btn>}>
          <div className="hms-table-wrap">
            <table className="hms-table">
              <thead><tr><th>Módulo</th>{ALL_ROLES.map((r) => <th key={r} className="text-center">{ROLES[r]}</th>)}</tr></thead>
              <tbody>
                {(Object.keys(PERMS) as ModuleKey[]).filter((m) => !["dashboard", "notifications", "ai", "shift", "maple"].includes(m)).map((m) => (
                  <tr key={m}>
                    <td className="strong capitalize">{m}</td>
                    {ALL_ROLES.map((r) => <td key={r} className="text-center">{PERMS[m].includes(r) ? <CheckCheck className="mx-auto h-3.5 w-3.5 text-[var(--h-ok)]" /> : <span className="text-[var(--h-line-strong)]">—</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3"><Banner tone="info">Administradores e diretores têm acesso integral. A finalização de documentos é exclusiva de médicos e diretores, garantida por trigger no banco.</Banner></div>
        </Modal>
      )}
    </Page>
  );
}

function StaffForm({ staff, onClose }: { staff: Staff | null; onClose: () => void }) {
  const { reload } = useHms();
  const [f, setF] = useState({
    full_name: staff?.full_name ?? "", photo_url: staff?.photo_url ?? "", username: staff?.username ?? "",
    role: staff?.role ?? "medico", specialty: staff?.specialty ?? "", registry: staff?.registry ?? "", uf: staff?.uf ?? "",
    status: staff?.status ?? "ativo", user_id: staff?.user_id ?? "",
  });
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal title={staff ? `Editar ${staff.full_name}` : "Novo profissional"} sub="Registro profissional fictício (CRM RP) usado nos documentos." onClose={onClose}
      footer={<><span className="text-[11px] text-[var(--h-muted)]">Contas de acesso são criadas no painel central FLI.</span><div className="ml-auto flex gap-2"><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn icon={UserCog} onClick={async () => {
        if (!f.full_name.trim()) { setErr("Informe o nome completo."); return; }
        const payload = { full_name: f.full_name.trim(), photo_url: f.photo_url || null, username: f.username || null, role: f.role, specialty: f.specialty || null, registry: f.registry || null, uf: f.uf || null, status: f.status, user_id: f.user_id || null };
        const res = staff ? await hdb.from("lp_staff").update(payload).eq("id", staff.id) : await hdb.from("lp_staff").insert(payload);
        if (res.error) { setErr(res.error.message); return; }
        await reload(); onClose();
      }}>Salvar</Btn></div></>}>
      {err && <div className="mb-3"><Banner tone="error">{err}</Banner></div>}
      <div className="hms-form-grid">
        <Field label="Nome completo *" className="span-2"><input className="hms-input" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
        <Field label="Cargo"><select className="hms-select" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Status"><select className="hms-select" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="ativo">Ativo</option><option value="ferias">Férias</option><option value="inativo">Inativo</option></select></Field>
        <Field label="Especialidade"><input className="hms-input" value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value })} placeholder="Cardiologia" /></Field>
        <Field label="Nome de usuário / apelido"><input className="hms-input" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} placeholder="@dr.life" /></Field>
        <Field label="Registro profissional RP"><input className="hms-input" value={f.registry} onChange={(e) => setF({ ...f, registry: e.target.value })} placeholder="CRM-RP 000000" /></Field>
        <Field label="UF"><input className="hms-input" value={f.uf} onChange={(e) => setF({ ...f, uf: e.target.value })} placeholder="RP" maxLength={4} /></Field>
        <Field label="Foto (URL)"><input className="hms-input" value={f.photo_url} onChange={(e) => setF({ ...f, photo_url: e.target.value })} /></Field>
        <Field label="ID da conta de acesso (opcional)" hint="UUID do usuário no Supabase, quando houver conta vinculada."><input className="hms-input" value={f.user_id} onChange={(e) => setF({ ...f, user_id: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

/* ============================ RELATÓRIOS ============================ */

type ReportKind = "pacientes" | "atendimentos" | "consultas" | "internacoes" | "leitos" | "documentos" | "receitas" | "atestados" | "exames" | "convenios" | "medicos";
const REPORTS: Record<ReportKind, { label: string; icon: typeof FileText }> = {
  pacientes: { label: "Pacientes cadastrados", icon: Users },
  atendimentos: { label: "Atendimentos", icon: Activity },
  consultas: { label: "Consultas", icon: CalendarDays },
  internacoes: { label: "Internações", icon: Hospital },
  leitos: { label: "Ocupação de leitos", icon: Building2 },
  documentos: { label: "Documentos emitidos", icon: FileText },
  receitas: { label: "Receitas", icon: ClipboardList },
  atestados: { label: "Atestados", icon: ScrollText },
  exames: { label: "Exames", icon: FlaskConical },
  convenios: { label: "Pacientes por convênio", icon: LineChart },
  medicos: { label: "Atendimentos por médico", icon: Stethoscope },
};

export function ReportsModule() {
  const { data, patientById, staffById, bedById } = useHms();
  const today = new Date();
  const [kind, setKind] = useState<ReportKind>("atendimentos");
  const [from, setFrom] = useState(new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [staffId, setStaffId] = useState("");
  const paperRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const inRange = (s: string | null | undefined) => { if (!s) return false; const d = s.slice(0, 10); return d >= from && d <= to; };

  const { head, rows, summary, title } = useMemo(() => {
    const range = { head: [] as string[], rows: [] as (string | number)[][], summary: [] as { label: string; value: string | number }[], title: REPORTS[kind].label };
    switch (kind) {
      case "pacientes":
        range.head = ["Código", "Paciente", "Idade", "Convênio", "Situação", "Cadastro"];
        range.rows = data.patients.filter((p) => inRange(p.created_at)).map((p) => [p.code, p.full_name, ageOf(p.birth_date) ?? "—", p.insurance || "Nenhum", p.status, fDate(p.created_at)]);
        range.summary = [{ label: "Pacientes no período", value: range.rows.length }, { label: "Life+", value: data.patients.filter((p) => p.insurance === "Life+").length }];
        break;
      case "atendimentos":
        range.head = ["Código", "Paciente", "Profissional", "Especialidade", "Data", "Status"];
        range.rows = data.appointments.filter((a) => inRange(a.starts_at) && (!staffId || a.staff_id === staffId)).map((a) => [a.code, patientById(a.patient_id)?.full_name ?? "—", staffById(a.staff_id ?? undefined)?.full_name ?? "—", a.specialty ?? "—", fDateTime(a.starts_at), a.status]);
        range.summary = [{ label: "Atendimentos", value: range.rows.length }, { label: "Concluídos", value: data.appointments.filter((a) => a.status === "concluida" && inRange(a.starts_at)).length }];
        break;
      case "consultas":
        range.head = ["Código", "Paciente", "Data", "Duração", "Prioridade", "Status"];
        range.rows = data.appointments.filter((a) => inRange(a.starts_at) && (!staffId || a.staff_id === staffId)).map((a) => [a.code, patientById(a.patient_id)?.full_name ?? "—", fDateTime(a.starts_at), `${a.duration_min} min`, a.priority, a.status]);
        range.summary = [{ label: "Consultas", value: range.rows.length }];
        break;
      case "internacoes":
        range.head = ["Paciente", "Setor", "Leito", "Entrada", "Saída", "Status"];
        range.rows = data.admissions.filter((a) => inRange(a.admitted_at)).map((a) => [patientById(a.patient_id)?.full_name ?? "—", a.sector ?? "—", bedById(a.bed_id ?? undefined)?.code ?? "—", fDateTime(a.admitted_at), a.discharged_at ? fDateTime(a.discharged_at) : "—", a.status]);
        range.summary = [{ label: "Internações", value: range.rows.length }, { label: "Ativas", value: data.admissions.filter((a) => !a.discharged_at).length }];
        break;
      case "leitos":
        range.head = ["Leito", "Ala", "Quarto", "Status", "Paciente"];
        range.rows = data.beds.map((b) => { const adm = data.admissions.find((a) => !a.discharged_at && a.bed_id === b.id); return [b.code, b.ward, b.room ?? "—", b.status, adm ? patientById(adm.patient_id)?.full_name ?? "—" : "—"]; });
        range.summary = [{ label: "Leitos", value: data.beds.length }, { label: "Ocupados", value: data.admissions.filter((a) => !a.discharged_at && a.bed_id).length }];
        break;
      case "documentos":
      case "receitas":
      case "atestados": {
        const kinds = kind === "receitas" ? ["receita"] : kind === "atestados" ? ["atestado", "afastamento", "declaracao", "acompanhamento"] : undefined;
        range.head = ["Código", "Documento", "Paciente", "Profissional", "Status", "Emissão"];
        range.rows = data.docs.filter((d) => inRange(d.finalized_at ?? d.created_at) && (!kinds || kinds.includes(d.kind)) && (!staffId || d.staff_id === staffId)).map((d) => [d.code, d.title, patientById(d.patient_id ?? undefined)?.full_name ?? "—", staffById(d.staff_id ?? undefined)?.full_name ?? "—", d.status, fDate(d.created_at)]);
        range.summary = [{ label: "Documentos", value: range.rows.length }, { label: "Finalizados", value: data.docs.filter((d) => d.status === "finalizado" && inRange(d.created_at)).length }];
        break;
      }
      case "exames":
        range.head = ["Exame", "Paciente", "Categoria", "Solicitado", "Status"];
        range.rows = data.exams.filter((e) => inRange(e.requested_at) && (!staffId || e.staff_id === staffId)).map((e) => [e.kind, patientById(e.patient_id)?.full_name ?? "—", e.category, fDate(e.requested_at), e.status]);
        range.summary = [{ label: "Exames", value: range.rows.length }, { label: "Pendentes", value: data.exams.filter((e) => !["concluido", "laudo", "cancelado"].includes(e.status)).length }];
        break;
      case "convenios":
        range.head = ["Convênio", "Pacientes", "% do total"];
        range.rows = INSURANCES.map((i) => { const n = data.patients.filter((p) => (p.insurance || "Nenhum") === i).length; return [i, n, `${Math.round((n / Math.max(data.patients.length, 1)) * 100)}%`]; });
        range.summary = [{ label: "Pacientes", value: data.patients.length }];
        break;
      case "medicos":
        range.head = ["Profissional", "Especialidade", "Atendimentos", "Concluídos", "Documentos"];
        range.rows = data.staff.filter((s) => ["medico", "diretor"].includes(s.role)).map((s) => {
          const appts = data.appointments.filter((a) => a.staff_id === s.id && inRange(a.starts_at));
          return [s.full_name, s.specialty ?? "—", appts.length, appts.filter((a) => a.status === "concluida").length, data.docs.filter((d) => d.staff_id === s.id && inRange(d.created_at)).length];
        });
        range.summary = [{ label: "Profissionais", value: range.rows.length }];
        break;
    }
    return range;
  }, [kind, from, to, staffId, data, patientById, staffById, bedById]);

  const csv = () => { download(`lifeplus-${kind}-${from}_${to}.csv`, toCSV(rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]]))))); };

  return (
    <Page eyebrow="Inteligência operacional" title="Relatórios" sub="Filtre por período e profissional, exporte em CSV ou gere um PDF institucional A4."
      actions={<><Btn variant="ghost" icon={Download} onClick={csv}>CSV</Btn><Btn variant="ghost" icon={Printer} onClick={() => paperRef.current && printPaper(paperRef.current)}>Imprimir</Btn><Btn icon={Download} disabled={busy} onClick={async () => { if (!paperRef.current) return; setBusy(true); try { await paperToPdf(paperRef.current, `lifeplus-${kind}-${from}.pdf`); } finally { setBusy(false); } }}>{busy ? "Gerando…" : "PDF"}</Btn></>}>
      <div className="hms-grid hms-cols-3 mb-3">
        <Kpi label="Registros no relatório" value={rows.length} note={title} icon={ClipboardList} tone="brand" />
        {summary.slice(0, 2).map((s) => <Kpi key={s.label} label={s.label} value={s.value} note={`${fDate(from)} – ${fDate(to)}`} icon={LineChart} />)}
      </div>

      <Card noBody className="mb-3">
        <div className="hms-toolbar">
          <select className="hms-select" value={kind} onChange={(e) => setKind(e.target.value as ReportKind)}>{Object.entries(REPORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          <input type="date" className="hms-input" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-[11px] text-[var(--h-faint)]">até</span>
          <input type="date" className="hms-input" value={to} onChange={(e) => setTo(e.target.value)} />
          <select className="hms-select" value={staffId} onChange={(e) => setStaffId(e.target.value)}><option value="">Todos os profissionais</option>{data.staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
          <span className="push hms-code">{rows.length} linhas</span>
        </div>
        <div className="max-h-[420px] overflow-auto">
          <Table head={<tr>{head.map((h) => <th key={h}>{h}</th>)}</tr>}>
            {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j === 1 ? "strong" : "muted"}>{String(c)}</td>)}</tr>)}
          </Table>
          {!rows.length && <Empty icon={ClipboardList} title="Sem registros no período" children="Ajuste o período ou o profissional selecionado." />}
        </div>
      </Card>

      <div className="rounded-xl border border-[var(--h-line)] bg-[var(--h-soft)] p-4">
        <div className="mb-2 flex items-center justify-between"><div className="hms-section-label">Prévia do PDF institucional</div><Chip tone="outline">A4 · Life+ RP</Chip></div>
        <div className="overflow-auto">
          <div ref={paperRef} style={{ zoom: 0.72 }}>
            <PaperView settings={data.settings} title={title.toUpperCase()} code={`REL-${from.replace(/-/g, "")}`} date={`${fDate(from)} a ${fDate(to)}`} body={`Relatório institucional gerado em ${fDateTime(new Date().toISOString())}.\nTotal de registros: ${rows.length}.\nProfissional: ${staffId ? staffById(staffId)?.full_name : "todos"}.`} extraFields={summary.map((s) => ({ label: s.label, value: String(s.value) }))} />
          </div>
        </div>
      </div>
    </Page>
  );
}

/* ============================ NOTIFICAÇÕES ============================ */

export function NotificationsModule() {
  const { notifications, go } = useHms();
  const [dismissed, setDismissed] = useState<string[]>(() => { if (typeof window === "undefined") return []; try { return JSON.parse(localStorage.getItem("lifeplus.hms.dismissed") ?? "[]") as string[]; } catch { return []; } });
  const [filter, setFilter] = useState<"todas" | "vital" | "warn" | "brand" | "ok">("todas");
  const save = (ids: string[]) => { setDismissed(ids); localStorage.setItem("lifeplus.hms.dismissed", JSON.stringify(ids)); };
  const list = notifications.filter((n) => !dismissed.includes(n.id) && (filter === "todas" || n.tone === filter));

  return (
    <Page eyebrow="Central de alertas" title="Notificações" sub="Consultas, fila, exames, internações, documentos e estoque — tudo em um só lugar."
      actions={<Btn variant="ghost" icon={CheckCheck} onClick={() => save(notifications.map((n) => n.id))}>Marcar todas como lidas</Btn>}>
      <div className="hms-cols-4 hms-grid mb-3">
        {(["vital", "warn", "brand", "ok"] as const).map((t) => <Kpi key={t} label={{ vital: "Críticas", warn: "Atenção", brand: "Informativas", ok: "Recentes" }[t]} value={notifications.filter((n) => n.tone === t && !dismissed.includes(n.id)).length} note="não lidas" tone={t} icon={Bell} />)}
      </div>
      <div className="mb-3"><Tabs items={[{ key: "todas", label: "Todas", count: notifications.filter((n) => !dismissed.includes(n.id)).length }, { key: "vital", label: "Críticas" }, { key: "warn", label: "Atenção" }, { key: "brand", label: "Informativas" }, { key: "ok", label: "Recentes" }]} value={filter} onChange={(v) => setFilter(v as typeof filter)} /></div>
      <div className="hms-stack">
        {list.map((n) => (
          <div key={n.id} className="hms-card flex items-start gap-3 p-3.5">
            <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${n.tone === "vital" ? "bg-[var(--h-vital-soft)] text-[var(--h-vital)]" : n.tone === "warn" ? "bg-[var(--h-warn-soft)] text-[var(--h-warn)]" : n.tone === "ok" ? "bg-[var(--h-ok-soft)] text-[var(--h-ok)]" : "bg-[var(--h-brand-soft)] text-[var(--h-brand)]"}`}><Bell className="h-3.5 w-3.5" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold">{n.title}</div>
              <div className="text-[12px] text-[var(--h-muted)]">{n.detail}</div>
              <div className="hms-code mt-0.5">{fDateTime(n.when)}</div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Btn size="sm" variant="ghost" onClick={() => go(n.module)}>Abrir</Btn>
              <Btn size="sm" variant="ghost" icon={CheckCheck} onClick={() => save([...dismissed, n.id])} aria-label="Marcar como lida" />
            </div>
          </div>
        ))}
        {!list.length && <Card><Empty icon={Bell} title="Tudo em dia" children="Nenhuma notificação pendente neste filtro." /></Card>}
      </div>
    </Page>
  );
}

/* ============================ AUDITORIA ============================ */

export function AuditModule() {
  const { isAdmin } = useHms();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [table, setTable] = useState("");
  const [action, setAction] = useState("");
  const [detail, setDetail] = useState<AuditRow | null>(null);

  useEffect(() => {
    (async () => {
      if (!isAdmin) { setLoading(false); return; }
      const { data, error } = await hdb.from("lp_audit").select("*").order("created_at", { ascending: false }).limit(400);
      setRows((data ?? []) as AuditRow[]); setErr(error?.message ?? null); setLoading(false);
    })();
  }, [isAdmin]);
  if (!isAdmin) return <Page eyebrow="Segurança" title="Auditoria" sub="Somente administradores e diretores."><Card><Empty icon={Lock} title="Acesso restrito" children="Seu cargo não permite consultar o registro de auditoria." /></Card></Page>;

  const list = rows.filter((r) => (!table || r.table_name === table) && (!action || r.action === action));
  const tables = Array.from(new Set(rows.map((r) => r.table_name))).sort();

  return (
    <Page eyebrow="Segurança e rastreabilidade" title="Auditoria" sub="Cada criação, alteração e exclusão registrada automaticamente no banco, com autor e dados anteriores."
      actions={<Chip tone="ok"><ShieldCheck className="h-3 w-3" />registro automático</Chip>}>
      <div className="hms-cols-4 hms-grid mb-3">
        <Kpi label="Eventos" value={rows.length} note="últimos 400" icon={ScrollText} tone="brand" />
        <Kpi label="Criações" value={rows.filter((r) => r.action === "insert").length} note="insert" icon={Plus} tone="ok" />
        <Kpi label="Alterações" value={rows.filter((r) => r.action === "update").length} note="update" icon={Pencil} tone="warn" />
        <Kpi label="Exclusões" value={rows.filter((r) => r.action === "delete").length} note="delete" icon={Trash2} tone="vital" />
      </div>
      <Card noBody>
        <div className="hms-toolbar">
          <select className="hms-select" value={table} onChange={(e) => setTable(e.target.value)}><option value="">Todas as tabelas</option>{tables.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          <select className="hms-select" value={action} onChange={(e) => setAction(e.target.value)}><option value="">Todas as ações</option><option value="insert">Criação</option><option value="update">Alteração</option><option value="delete">Exclusão</option></select>
          <span className="push hms-code">{list.length} eventos</span>
        </div>
        {err && <div className="p-3"><Banner tone="error">{err}</Banner></div>}
        {loading ? <div className="p-6 text-center text-xs text-[var(--h-muted)]">Carregando eventos…</div> : list.length === 0 ? <Empty icon={ScrollText} title="Nenhum evento" children="As ações da equipe aparecem aqui automaticamente." /> : (
          <Table head={<tr><th>Quando</th><th>Tabela</th><th>Ação</th><th>Registro</th><th>Autor</th><th /></tr>}>
            {list.map((r) => (
              <tr key={r.id} className="is-clickable" onClick={() => setDetail(r)}>
                <td className="muted whitespace-nowrap">{fDateTime(r.created_at)}</td>
                <td className="hms-code">{r.table_name}</td>
                <td><Chip tone={r.action === "delete" ? "vital" : r.action === "update" ? "warn" : "ok"}>{r.action}</Chip></td>
                <td className="hms-code">{r.row_id?.slice(0, 8) ?? "—"}</td>
                <td className="hms-code">{r.actor?.slice(0, 8) ?? "sistema"}</td>
                <td><button className="hms-btn ghost sm">Ver</button></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {detail && (
        <Modal wide title={`${detail.action} em ${detail.table_name}`} sub={`${fDateTime(detail.created_at)} · autor ${detail.actor ?? "sistema"}`} onClose={() => setDetail(null)} footer={<Btn variant="ghost" onClick={() => setDetail(null)}>Fechar</Btn>}>
          <div className="grid gap-3 md:grid-cols-2">
            <div><div className="hms-section-label">Antes</div><pre className="mt-1 max-h-80 overflow-auto rounded-xl bg-[var(--h-soft)] p-3 text-[10.5px]">{JSON.stringify(detail.before_data ?? null, null, 2)}</pre></div>
            <div><div className="hms-section-label">Depois</div><pre className="mt-1 max-h-80 overflow-auto rounded-xl bg-[var(--h-soft)] p-3 text-[10.5px]">{JSON.stringify(detail.after_data ?? null, null, 2)}</pre></div>
          </div>
        </Modal>
      )}
    </Page>
  );
}

/* ============================ CONFIGURAÇÕES ============================ */

export function SettingsModule() {
  const { data, reload, can, go } = useHms();
  const s = data.settings;
  const [f, setF] = useState({ name: s.name, logo_url: s.logo_url ?? "", address: s.address ?? "", phone: s.phone ?? "", cnpj: s.cnpj ?? "", director: s.director ?? "", technical_lead: s.technical_lead ?? "", accent: s.accent, specialties: s.specialties.join(", "), sectors: s.sectors.join(", ") });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const editable = can("settings");

  const save = async () => {
    setBusy(true); setErr(null); setMsg(null);
    const res = await hdb.from("lp_settings").update({
      name: f.name.trim() || "Life+", logo_url: f.logo_url || null, address: f.address || null, phone: f.phone || null,
      cnpj: f.cnpj || null, director: f.director || null, technical_lead: f.technical_lead || null, accent: f.accent,
      specialties: f.specialties.split(",").map((x) => x.trim()).filter(Boolean), sectors: f.sectors.split(",").map((x) => x.trim()).filter(Boolean),
    }).eq("id", 1);
    setBusy(false);
    if (res.error) { setErr(res.error.message); return; }
    await reload(); setMsg("Configurações institucionais salvas. Elas passam a valer em todos os documentos.");
  };

  return (
    <Page eyebrow="Institucional" title="Configurações" sub="Identidade, contatos fictícios, direção técnica, especialidades e setores usados em todo o sistema.">
      <div className="hms-split items-start">
        <Card title="Dados da instituição" actions={<Chip tone={editable ? "ok" : "outline"}>{editable ? "editável" : "somente leitura"}</Chip>}>
          <div className="hms-form-grid">
            <Field label="Nome"><input className="hms-input" value={f.name} disabled={!editable} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Cor institucional"><input type="color" className="hms-input h-9 p-1" value={f.accent} disabled={!editable} onChange={(e) => setF({ ...f, accent: e.target.value })} /></Field>
            <Field label="Logotipo (URL)" className="span-2"><input className="hms-input" value={f.logo_url} disabled={!editable} onChange={(e) => setF({ ...f, logo_url: e.target.value })} placeholder="https://…" /></Field>
            <Field label="Endereço fictício" className="span-2"><input className="hms-input" value={f.address} disabled={!editable} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
            <Field label="Telefone fictício"><input className="hms-input" value={f.phone} disabled={!editable} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="CNPJ fictício" hint="Ambientação — sempre identificado como fictício."><input className="hms-input" value={f.cnpj} disabled={!editable} onChange={(e) => setF({ ...f, cnpj: e.target.value })} /></Field>
            <Field label="Diretor(a)"><input className="hms-input" value={f.director} disabled={!editable} onChange={(e) => setF({ ...f, director: e.target.value })} /></Field>
            <Field label="Responsável técnico"><input className="hms-input" value={f.technical_lead} disabled={!editable} onChange={(e) => setF({ ...f, technical_lead: e.target.value })} /></Field>
            <Field label="Especialidades" hint="Separe por vírgulas." className="span-2"><input className="hms-input" value={f.specialties} disabled={!editable} onChange={(e) => setF({ ...f, specialties: e.target.value })} /></Field>
            <Field label="Setores" hint="Separe por vírgulas. Usados em internações e leitos." className="span-2"><input className="hms-input" value={f.sectors} disabled={!editable} onChange={(e) => setF({ ...f, sectors: e.target.value })} /></Field>
          </div>
          {err && <div className="mt-3"><Banner tone="error">{err}</Banner></div>}
          {msg && <div className="mt-3"><Banner tone="info">{msg}</Banner></div>}
          {editable && <div className="mt-4 flex justify-end"><Btn icon={SettingsIcon} disabled={busy} onClick={() => void save()}>{busy ? "Salvando…" : "Salvar configurações"}</Btn></div>}
        </Card>
        <div className="hms-stack">
          <Card title="Prévia institucional" sub="Cabeçalho usado em todos os documentos">
            <div style={{ zoom: 0.55 }} className="origin-top-left">
              <PaperView settings={{ ...s, name: f.name, address: f.address, phone: f.phone, cnpj: f.cnpj, director: f.director, technical_lead: f.technical_lead, accent: f.accent, logo_url: f.logo_url || null }} title="DOCUMENTO LIFE+" code="DOC-000000" date={fDate(new Date().toISOString())} body={"Este é o cabeçalho institucional aplicado a atestados, receitas, laudos e relatórios.\n\nTodos os documentos são fictícios e exclusivos do roleplay."} />
            </div>
          </Card>
          <Card title="Estrutura hospitalar" sub={`${data.beds.length} leitos · ${s.sectors.length} setores`}>
            <div className="space-y-2 text-[12px]">
              <div className="flex justify-between"><span className="text-[var(--h-muted)]">Especialidades</span><b>{s.specialties.length}</b></div>
              <div className="flex justify-between"><span className="text-[var(--h-muted)]">Setores</span><b>{s.sectors.length}</b></div>
              <div className="flex justify-between"><span className="text-[var(--h-muted)]">Leitos cadastrados</span><b>{data.beds.length}</b></div>
              <div className="flex justify-between"><span className="text-[var(--h-muted)]">Convênios aceitos</span><b>{INSURANCES.join(" · ")}</b></div>
            </div>
            <div className="mt-3 flex gap-2"><Btn size="sm" variant="ghost" icon={Building2} onClick={() => go("beds")}>Gerenciar leitos</Btn></div>
          </Card>
          <Card title="Segurança e privacidade">
            <ul className="space-y-2 text-[12px] text-[var(--h-muted)]">
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-[var(--h-ok)] shrink-0" />Permissões por cargo aplicadas no banco (RLS).</li>
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-[var(--h-ok)] shrink-0" />Auditoria automática de todas as alterações.</li>
              <li className="flex gap-2"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />Nenhum documento pessoal real é solicitado — apenas dados de roleplay.</li>
              <li className="flex gap-2"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />Arquivos anexados ficam no bucket privado <code>lp-files</code>.</li>
            </ul>
          </Card>
        </div>
      </div>
    </Page>
  );
}

/* ============================ LIFE+ AI ============================ */

type AiMode = "resumo" | "relatorio" | "administrativo" | "busca";

export function AiModule() {
  const { data, patientById, staffById, go } = useHms();
  const [mode, setMode] = useState<AiMode>("resumo");
  const [patientId, setPatientId] = useState("");
  const [topic, setTopic] = useState("");
  const [period, setPeriod] = useState("7");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const patient = patientById(patientId);

  const generate = () => {
    setBusy(true);
    setTimeout(() => {
      const L: string[] = [];
      if (mode === "resumo" && patient) {
        const recs = data.records.filter((r) => r.patient_id === patient.id).slice(0, 6);
        const docs = data.docs.filter((d) => d.patient_id === patient.id).slice(0, 4);
        const exams = data.exams.filter((e) => e.patient_id === patient.id).slice(0, 4);
        const adm = data.admissions.filter((a) => a.patient_id === patient.id);
        L.push(`RESUMO DE PRONTUÁRIO — ${patient.full_name} (${patient.code})`);
        L.push(`Idade: ${ageOf(patient.birth_date) ?? "não informada"} · Convênio: ${patient.insurance || "Nenhum"} · Tipo sanguíneo: ${patient.blood_type || "não informado"}`);
        if (patient.allergies) L.push(`Alergias registradas: ${patient.allergies}`);
        if (patient.conditions) L.push(`Condições preexistentes: ${patient.conditions}`);
        L.push("");
        L.push("Histórico recente:");
        if (!recs.length) L.push("• Sem evoluções registradas no prontuário.");
        recs.reverse().forEach((r) => L.push(`• ${fDate(r.created_at)} — ${r.kind}: ${r.body.replace(/\n+/g, " ").slice(0, 220)}`));
        if (docs.length) { L.push(""); L.push("Documentos emitidos:"); docs.forEach((d) => L.push(`• ${d.code} — ${d.title} (${d.status})`)); }
        if (exams.length) { L.push(""); L.push("Exames:"); exams.forEach((e) => L.push(`• ${e.kind} — ${e.status}${e.result ? `: ${e.result.slice(0, 100)}` : ""}`)); }
        if (adm.length) { L.push(""); L.push("Internações:"); adm.forEach((a) => L.push(`• ${fDate(a.admitted_at)} — ${a.sector ?? "setor"}${a.discharged_at ? `, alta em ${fDate(a.discharged_at)}` : ", em curso"}`)); }
        L.push(""); L.push("Sugestão de conduta para o RP: revisar evolução clínica, confirmar alergias e atualizar a prescrição antes do próximo atendimento.");
      } else if (mode === "relatorio" && patient) {
        const days = Number(period) || 7;
        const since = Date.now() - days * 86400000;
        const recs = data.records.filter((r) => r.patient_id === patient.id && +new Date(r.created_at) >= since);
        L.push(`RELATÓRIO MÉDICO (RP) — ${data.settings.name}`);
        L.push(`Paciente: ${patient.full_name} — ${patient.code}`);
        L.push(`Período: últimos ${days} dias`);
        L.push("");
        L.push(`O(a) paciente encontra-se em acompanhamento nesta instituição. No período, foram registrados ${recs.length} registros clínicos.`);
        if (recs.length) { L.push(""); recs.forEach((r) => L.push(`Em ${fDate(r.created_at)}, ${r.kind} registrada por ${staffById(r.staff_id ?? undefined)?.full_name ?? "equipe"}: ${r.body.replace(/\n+/g, " ").slice(0, 200)}.`)); }
        L.push(""); L.push("Conduta e seguimento: manter acompanhamento ambulatorial, reavaliar sintomas e reforçar orientações. Documento fictício de roleplay.");
      } else if (mode === "administrativo") {
        L.push(`COMUNICADO INTERNO — ${data.settings.name}`);
        L.push(`Assunto: ${topic || "alinhamento operacional"}`);
        L.push("");
        L.push(`À equipe,`);
        L.push("");
        L.push(`Informamos que ${topic ? topic.toLowerCase() : "as rotinas assistenciais"} passa a seguir o fluxo padronizado da instituição. Registros clínicos devem ser lançados no prontuário eletrônico, documentos finalizados no módulo Documentos e leitos atualizados na admissão e na alta.`);
        L.push("");
        L.push(`Dúvidas devem ser encaminhadas à direção técnica (${data.settings.technical_lead ?? "responsável técnico"}).`);
        L.push("");
        L.push(`Atenciosamente, ${data.settings.director ?? "Direção"} — ${data.settings.name} (documento fictício de roleplay).`);
      } else {
        const term = topic.trim().toLowerCase();
        L.push(`BUSCA INSTITUCIONAL — "${topic || "todos"}"`);
        L.push("");
        if (!term) L.push("Digite um termo para pesquisar em pacientes, documentos, exames e equipe.");
        else {
          const pts = data.patients.filter((p) => [p.full_name, p.code, p.nickname, p.insurance].some((v) => (v ?? "").toLowerCase().includes(term))).slice(0, 5);
          const docs = data.docs.filter((d) => [d.title, d.code].some((v) => (v ?? "").toLowerCase().includes(term))).slice(0, 5);
          const exams = data.exams.filter((e) => e.kind.toLowerCase().includes(term)).slice(0, 5);
          const stf = data.staff.filter((s) => [s.full_name, s.specialty, s.registry].some((v) => (v ?? "").toLowerCase().includes(term))).slice(0, 5);
          L.push(`Pacientes (${pts.length}):`); pts.forEach((p) => L.push(`• ${p.full_name} — ${p.code} — ${p.insurance || "Nenhum"}`));
          L.push(""); L.push(`Documentos (${docs.length}):`); docs.forEach((d) => L.push(`• ${d.code} — ${d.title}`));
          L.push(""); L.push(`Exames (${exams.length}):`); exams.forEach((e) => L.push(`• ${e.kind} — ${e.status}`));
          L.push(""); L.push(`Equipe (${stf.length}):`); stf.forEach((s) => L.push(`• ${s.full_name} — ${s.specialty ?? s.role}`));
          if (!pts.length && !docs.length && !exams.length && !stf.length) L.push("Nenhum resultado encontrado.");
        }
      }
      L.push(""); L.push("— Gerado pela Life+ AI a partir dos dados cadastrados. Revise antes de usar em qualquer documento.");
      setOut(L.join("\n")); setBusy(false);
    }, 320);
  };

  return (
    <Page eyebrow="Assistência inteligente" title="Life+ AI" sub="Organiza históricos, resume prontuários fictícios e redige textos administrativos a partir dos dados do sistema. Sempre com revisão humana.">
      <div className="hms-split items-start">
        <Card title="O que você precisa?" sub="A IA nunca emite documentos sozinha: ela prepara o texto e você confirma no editor.">
          <div className="grid grid-cols-2 gap-2">
            {([["resumo", "Resumir prontuário", ClipboardList], ["relatorio", "Relatório de RP", FileText], ["administrativo", "Texto administrativo", Wand2], ["busca", "Pesquisar cadastros", Activity]] as const).map(([k, l, Icon]) => (
              <button key={k} onClick={() => { setMode(k); setOut(""); }}
                className={`flex items-start gap-2 rounded-xl border p-3 text-left transition ${mode === k ? "border-[var(--h-brand)] bg-[var(--h-brand-soft)] text-[var(--h-brand-ink)]" : "border-[var(--h-line)] hover:border-[var(--h-line-strong)]"}`}>
                <Icon className="mt-0.5 h-4 w-4 shrink-0" /><span className="text-[12px] font-semibold">{l}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-3">
            {(mode === "resumo" || mode === "relatorio") && <Field label="Paciente"><PatientSelect patients={data.patients} value={patientId} onChange={setPatientId} /></Field>}
            {mode === "relatorio" && <Field label="Período"><select className="hms-select" value={period} onChange={(e) => setPeriod(e.target.value)}><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option></select></Field>}
            {(mode === "administrativo" || mode === "busca") && <Field label={mode === "busca" ? "Termo de pesquisa" : "Tema do comunicado"}><input className="hms-input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={mode === "busca" ? "Nome, código, exame…" : "Ex.: protocolo de triagem"} /></Field>}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Btn icon={Sparkles} disabled={busy || ((mode === "resumo" || mode === "relatorio") && !patientId)} onClick={generate}>{busy ? "Organizando…" : "Gerar"}</Btn>
            <Btn variant="ghost" icon={Trash2} onClick={() => setOut("")}>Limpar</Btn>
          </div>
          <div className="mt-4"><Banner tone="info">A Life+ AI trabalha apenas com os dados fictícios cadastrados no sistema. Ela não prescreve, não diagnostica e não assina documentos.</Banner></div>
        </Card>
        <Card title="Resultado" sub="Revise, copie ou envie para o editor de documentos" actions={out ? <><CopyBtn text={out} /><Btn size="sm" variant="soft" icon={FileText} onClick={() => { try { sessionStorage.setItem("lifeplus.ai.draft", out); } catch { /* ignore */ } go("documents", { docKind: mode === "administrativo" ? "personalizado" : "relatorio", patientId: patientId || undefined }); }}>Usar em documento</Btn></> : undefined}>
          {out ? <pre className="max-h-[520px] whitespace-pre-wrap rounded-xl bg-[var(--h-soft)] p-4 text-[12px] leading-relaxed">{out}</pre> : (
            <div className="flex flex-col items-center gap-2 py-14 text-center text-[var(--h-muted)]">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--h-brand-soft)] text-[var(--h-brand)]"><Bot className="h-5 w-5" /></span>
              <b className="text-[13px] text-[var(--h-fg)]">Nada gerado ainda</b>
              <p className="max-w-[38ch] text-[12px]">Escolha uma tarefa, preencha os campos e gere o texto. Nenhum dado sai do sistema.</p>
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}
