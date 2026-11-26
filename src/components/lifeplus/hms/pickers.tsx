import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { ageOf, type Patient, type Staff } from "./core";

function useOutside(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);
  return ref;
}

export function PatientSelect({ value, onChange, patients, placeholder = "Selecionar paciente…", allowEmpty, className = "" }: {
  value: string; onChange: (id: string) => void; patients: Patient[]; placeholder?: string; allowEmpty?: boolean; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useOutside(() => setOpen(false));
  const selected = patients.find((p) => p.id === value);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = t ? patients.filter((p) => [p.full_name, p.code, p.nickname, p.insurance].some((v) => (v ?? "").toLowerCase().includes(t))) : patients;
    return base.slice(0, 60);
  }, [patients, q]);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button type="button" className="hms-input flex items-center gap-2 text-left" onClick={() => { setOpen((o) => !o); setQ(""); }}>
        <span className={`min-w-0 flex-1 truncate ${selected ? "" : "text-[var(--h-faint)]"}`}>
          {selected ? <><b className="font-semibold">{selected.full_name}</b> <span className="hms-code ml-1">{selected.code}</span></> : placeholder}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-[var(--h-faint)]" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-[var(--h-line-strong)] bg-[var(--h-panel)] shadow-[var(--h-shadow-lg)]">
          <div className="flex items-center gap-2 border-b border-[var(--h-line)] px-2.5 py-2">
            <Search className="h-3.5 w-3.5 text-[var(--h-faint)]" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome ou código LIFE-" className="w-full bg-transparent text-[12.5px] outline-none" />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {allowEmpty && <button type="button" className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-[12.5px] text-[var(--h-muted)] hover:bg-[var(--h-soft)]" onClick={() => { onChange(""); setOpen(false); }}>Nenhum paciente</button>}
            {list.map((p) => (
              <button key={p.id} type="button" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[var(--h-soft)]" onClick={() => { onChange(p.id); setOpen(false); }}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium">{p.full_name}</span>
                  <span className="hms-code">{p.code} · {p.insurance || "Nenhum"}{ageOf(p.birth_date) != null ? ` · ${ageOf(p.birth_date)} anos` : ""}</span>
                </span>
                {p.id === value && <Check className="h-3.5 w-3.5 text-[var(--h-brand)]" />}
              </button>
            ))}
            {!list.length && <div className="px-3 py-5 text-center text-xs text-[var(--h-muted)]">Nenhum paciente encontrado.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export function StaffSelect({ value, onChange, staff, roles, placeholder = "Selecionar profissional…", className = "" }: {
  value: string; onChange: (id: string) => void; staff: Staff[]; roles?: string[]; placeholder?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useOutside(() => setOpen(false));
  const pool = useMemo(() => (roles ? staff.filter((s) => roles.includes(s.role)) : staff).filter((s) => s.status !== "inativo"), [staff, roles]);
  const selected = staff.find((s) => s.id === value);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (t ? pool.filter((s) => [s.full_name, s.specialty, s.registry, s.username].some((v) => (v ?? "").toLowerCase().includes(t))) : pool).slice(0, 60);
  }, [pool, q]);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button type="button" className="hms-input flex items-center gap-2 text-left" onClick={() => { setOpen((o) => !o); setQ(""); }}>
        <span className={`min-w-0 flex-1 truncate ${selected ? "" : "text-[var(--h-faint)]"}`}>
          {selected ? <><b className="font-semibold">{selected.full_name}</b> <span className="text-[11px] text-[var(--h-muted)]">{selected.specialty ?? ""}</span></> : placeholder}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-[var(--h-faint)]" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-[var(--h-line-strong)] bg-[var(--h-panel)] shadow-[var(--h-shadow-lg)]">
          <div className="flex items-center gap-2 border-b border-[var(--h-line)] px-2.5 py-2">
            <Search className="h-3.5 w-3.5 text-[var(--h-faint)]" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, especialidade ou registro" className="w-full bg-transparent text-[12.5px] outline-none" />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {list.map((s) => (
              <button key={s.id} type="button" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[var(--h-soft)]" onClick={() => { onChange(s.id); setOpen(false); }}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium">{s.full_name}</span>
                  <span className="text-[11px] text-[var(--h-muted)]">{s.specialty ?? s.role}{s.registry ? ` · ${s.registry}${s.uf ? "/" + s.uf : ""}` : ""}</span>
                </span>
                {s.id === value && <Check className="h-3.5 w-3.5 text-[var(--h-brand)]" />}
              </button>
            ))}
            {!list.length && <div className="px-3 py-5 text-center text-xs text-[var(--h-muted)]">Nenhum profissional. Cadastre a equipe em <b>Equipe</b>.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
