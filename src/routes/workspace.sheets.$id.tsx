import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Sheet, Check, Loader2, AlertCircle, ArrowLeft, Plus } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { computeSheet, isError, type CellValue, type RawCell } from "@/lib/sheets/formula";
import {
  addSheetTab, loadSpreadsheet, renameSpreadsheet, saveCells,
  type CellChange, type SheetTab, type SpreadsheetRow,
} from "@/lib/sheets/spreadsheets";

export const Route = createFileRoute("/workspace/sheets/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Life Sheets — Planilha" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SheetEditor,
});

const COLS = 26;
const ROWS = 100;
const SAVE_DELAY = 900;

type Save = "saved" | "dirty" | "saving" | "error";

/** Nome de coluna: 0 → A, 25 → Z, 26 → AA. */
const colName = (c: number) => {
  let s = "";
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
const keyOf = (r: number, c: number) => `${r},${c}`;

function display(v: CellValue | undefined): string {
  if (v === undefined || v === null) return "";
  if (isError(v)) return v.error;
  if (typeof v === "boolean") return v ? "VERDADEIRO" : "FALSO";
  return String(v);
}

function SheetEditor() {
  const { id } = Route.useParams();
  const auth = useAuth();
  const uid = auth.user?.id ?? "";
  const [row, setRow] = useState<SpreadsheetRow | null>(null);
  const [title, setTitle] = useState("");
  const [tabs, setTabs] = useState<SheetTab[]>([]);
  const [cells, setCells] = useState<Record<string, Record<string, string>>>({});
  const [activeTab, setActiveTab] = useState<string>("");
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [save, setSave] = useState<Save>("saved");
  const [canEdit, setCanEdit] = useState(false);

  // Alterações ainda não gravadas, por aba: "linha,coluna" -> texto ("" apaga).
  const pending = useRef<Record<string, Record<string, string>>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!uid) return;
    loadSpreadsheet(id)
      .then((res) => {
        if (!res) { setMissing(true); return; }
        setRow(res.row);
        setTitle(res.row.title);
        setTabs(res.tabs);
        setCells(res.cells);
        setActiveTab(res.tabs[0]?.id ?? "");
        setCanEdit(res.row.owner_id === uid);
      })
      .catch(() => setMissing(true));
  }, [uid, id]);

  const flush = async () => {
    if (inflight.current) return;
    const batch = pending.current;
    const tabIds = Object.keys(batch).filter((t) => Object.keys(batch[t]).length > 0);
    if (tabIds.length === 0) { setSave("saved"); return; }
    pending.current = {};
    inflight.current = true;
    setSave("saving");
    try {
      for (const tabId of tabIds) {
        const changes: CellChange[] = Object.entries(batch[tabId]).map(([k, raw]) => {
          const [r, c] = k.split(",").map(Number);
          return { row: r, col: c, raw: raw === "" ? null : raw };
        });
        await saveCells(id, tabId, changes);
      }
      setSave(Object.keys(pending.current).length ? "dirty" : "saved");
    } catch {
      // Mantém as alterações para a próxima tentativa, sem perder edições novas.
      for (const tabId of tabIds) pending.current[tabId] = { ...batch[tabId], ...(pending.current[tabId] ?? {}) };
      setSave("error");
      if (!timer.current) timer.current = setTimeout(() => { timer.current = null; flush(); }, 3000);
    } finally {
      inflight.current = false;
      if (Object.values(pending.current).some((m) => Object.keys(m).length > 0) && !timer.current) {
        timer.current = setTimeout(() => { timer.current = null; flush(); }, SAVE_DELAY);
      }
    }
  };

  const queue = (tabId: string, r: number, c: number, raw: string) => {
    pending.current[tabId] = { ...(pending.current[tabId] ?? {}), [keyOf(r, c)]: raw };
    setCells((prev) => {
      const tab = { ...(prev[tabId] ?? {}) };
      if (raw === "") delete tab[keyOf(r, c)]; else tab[keyOf(r, c)] = raw;
      return { ...prev, [tabId]: tab };
    });
    setSave("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; flush(); }, SAVE_DELAY);
  };

  const values = useMemo(() => {
    const out: Record<string, Map<string, CellValue>> = {};
    for (const tab of tabs) {
      const raw = new Map<string, RawCell>();
      for (const [k, v] of Object.entries(cells[tab.id] ?? {})) {
        const [r, c] = k.split(",").map(Number);
        raw.set(keyOf(c, r), v);
      }
      out[tab.id] = computeSheet(raw);
    }
    return out;
  }, [tabs, cells]);

  if (missing) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <p className="font-medium">Planilha não encontrada ou você não tem acesso.</p>
      <Link to="/workspace/sheets" className="text-sm text-primary underline">Voltar ao Life Sheets</Link>
    </div>
  );
  if (!row) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const commitTitle = async (t: string) => {
    const clean = t.trim() || "Planilha sem título";
    setTitle(clean);
    try { await renameSpreadsheet(id, clean); } catch { toast.error("Não foi possível renomear."); }
  };

  const addTab = async () => {
    if (!canEdit) return;
    try {
      const tab = await addSheetTab(id, `Planilha${tabs.length + 1}`, tabs.length);
      setTabs((t) => [...t, tab]);
      setCells((prev) => ({ ...prev, [tab.id]: {} }));
      setActiveTab(tab.id);
    } catch {
      toast.error("Não foi possível criar a aba.");
    }
  };

  const tabCells = cells[activeTab] ?? {};
  const tabValues = values[activeTab] ?? new Map<string, CellValue>();
  const selKey = selected ? keyOf(selected.r, selected.c) : null;
  const selRaw = selKey ? tabCells[selKey] ?? "" : "";

  const commitEdit = (value: string) => {
    if (!editing || !activeTab || !canEdit) return;
    const [r, c] = editing.split(",").map(Number);
    queue(activeTab, r, c, value);
    setEditing(null);
  };

  const statusView = {
    saved: { icon: Check, text: "Salvo", cls: "text-muted-foreground" },
    dirty: { icon: Loader2, text: "Alterações pendentes", cls: "text-muted-foreground" },
    saving: { icon: Loader2, text: "Salvando…", cls: "text-muted-foreground" },
    error: { icon: AlertCircle, text: "Erro ao salvar — será tentado novamente", cls: "text-destructive" },
  }[save];

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-4 py-2">
        <Link to="/workspace/sheets" aria-label="Voltar" className="rounded-full p-2 hover:bg-muted"><ArrowLeft className="h-4 w-4" /></Link>
        <Sheet className="h-5 w-5 text-primary" />
        <input key={row.id} defaultValue={title} onBlur={(e) => e.currentTarget.value !== title && commitTitle(e.currentTarget.value)}
          disabled={!canEdit} aria-label="Nome da planilha"
          className="min-w-0 max-w-md flex-1 rounded-lg bg-transparent px-2 py-1 text-sm font-medium outline-none focus:bg-muted disabled:opacity-70" />
        <span className={`flex items-center gap-1.5 text-xs ${statusView.cls}`} role="status">
          <statusView.icon className={`h-3.5 w-3.5 ${save === "saving" || save === "dirty" ? "animate-spin" : ""}`} />{statusView.text}
        </span>
      </header>

      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-sm">
        <span className="w-16 shrink-0 text-center text-xs text-muted-foreground">{selected ? `${colName(selected.c)}${selected.r + 1}` : ""}</span>
        <span className="text-muted-foreground">fx</span>
        <input value={editing !== null ? (editing === selKey ? "" : selRaw) : selRaw} readOnly={!canEdit || !selected}
          onChange={() => {}} onFocus={() => selected && canEdit && selKey && setEditing(selKey)}
          aria-label="Conteúdo da célula" placeholder={selected ? "" : "Selecione uma célula"}
          className="min-w-0 flex-1 rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-primary" />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-secondary">
            <tr>
              <th className="sticky left-0 z-20 h-7 w-12 border border-border bg-secondary" />
              {Array.from({ length: COLS }, (_, c) => (
                <th key={c} className="h-7 min-w-[120px] border border-border px-2 text-xs font-medium text-muted-foreground">{colName(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }, (_, r) => (
              <tr key={r}>
                <th className="sticky left-0 z-10 bg-secondary px-2 text-xs font-medium text-muted-foreground border border-border">{r + 1}</th>
                {Array.from({ length: COLS }, (_, c) => {
                  const k = keyOf(r, c);
                  const isSel = selected?.r === r && selected?.c === c;
                  const computed = tabValues.get(keyOf(c, r));
                  const shown = display(computed);
                  const isNum = typeof computed === "number";
                  return (
                    <td key={c} onClick={() => setSelected({ r, c })}
                      onDoubleClick={() => canEdit && setEditing(k)}
                      className={`h-7 max-w-[240px] truncate border border-border px-2 ${isSel ? "outline outline-2 outline-primary -outline-offset-1" : ""} ${isNum ? "text-right" : ""}`}>
                      {isSel && editing === k && canEdit ? (
                        <input autoFocus defaultValue={tabCells[k] ?? ""} aria-label={`Editar ${colName(c)}${r + 1}`}
                          onBlur={(e) => { if (cancelRef.current) { cancelRef.current = false; return; } commitEdit(e.currentTarget.value); }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); commitEdit(e.currentTarget.value); }
                            if (e.key === "Escape") { cancelRef.current = true; setEditing(null); }
                          }}
                          className="h-full w-full bg-transparent outline-none" />
                      ) : shown}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto border-t border-border bg-secondary/40 px-2 py-1 text-sm">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setSelected(null); setEditing(null); }}
            className={`rounded-t-md px-3 py-1 ${t.id === activeTab ? "bg-background font-medium" : "text-muted-foreground hover:bg-muted"}`}>
            {t.name}
          </button>
        ))}
        <button onClick={addTab} disabled={!canEdit} aria-label="Nova aba" className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-40">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
