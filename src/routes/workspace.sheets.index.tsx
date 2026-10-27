import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Sheet, Plus, Search, Clock, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { fmtDate } from "@/lib/workspace/docs";
import { createSpreadsheet, listSpreadsheets, type SpreadsheetRow } from "@/lib/sheets/spreadsheets";

export const Route = createFileRoute("/workspace/sheets/")({
  head: () => ({
    meta: [
      { title: "Life Sheets — Life Workspace" },
      { name: "description", content: "Planilhas do Life Workspace." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SheetsHome,
});

function SheetsHome() {
  const auth = useAuth();
  const uid = auth.user?.id ?? "";
  const nav = useNavigate();
  const [rows, setRows] = useState<SpreadsheetRow[] | null>(null);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!uid) return;
    listSpreadsheets()
      .then(setRows)
      .catch(() => { toast.error("Não foi possível carregar as planilhas."); setRows([]); });
  }, [uid]);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => !r.trashed_at && r.title.toLowerCase().includes(s));
  }, [rows, q]);

  const create = async () => {
    if (!uid || creating) return;
    setCreating(true);
    try {
      const id = await createSpreadsheet(uid, "Planilha sem título");
      nav({ to: "/workspace/sheets/$id", params: { id } });
    } catch {
      toast.error("Não foi possível criar a planilha.");
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:px-8">
        <Link to="/workspace" className="flex items-center gap-2 text-sm font-semibold"><Sheet className="h-5 w-5 text-primary" />Life Sheets</Link>
        <div className="relative ml-auto w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar planilhas"
            className="w-full rounded-full border border-border bg-secondary/60 py-2 pl-9 pr-4 text-sm outline-none focus:border-primary" />
        </div>
        <Link to="/workspace" className="text-sm text-muted-foreground hover:text-foreground">Life Workspace</Link>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <div className="mb-6 flex items-center gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Minhas planilhas</h2>
          <button onClick={create} disabled={creating}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-60">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Nova planilha
          </button>
        </div>

        {rows === null ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : visible.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border px-6 py-16 text-center">
            <Sheet className="mx-auto h-10 w-10 text-primary" />
            <p className="mt-3 font-medium">{q ? "Nenhuma planilha encontrada." : "Você ainda não tem planilhas."}</p>
            {!q && <p className="mt-1 text-sm text-muted-foreground">Crie a primeira com o botão acima.</p>}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((r) => (
              <Link key={r.id} to="/workspace/sheets/$id" params={{ id: r.id }}
                className="group rounded-2xl border border-border bg-card p-3 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex aspect-video items-center justify-center rounded-xl bg-secondary/60 text-primary"><Sheet className="h-6 w-6" /></div>
                <div className="mt-2 truncate text-sm font-medium">{r.title}</div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Clock className="h-3 w-3" />{fmtDate(r.updated_at)}</div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
