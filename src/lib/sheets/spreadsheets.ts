import { ddb } from "@/lib/workspace/docs";

export type SpreadsheetRow = {
  id: string;
  owner_id: string;
  title: string;
  version: number;
  trashed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SheetTab = { id: string; spreadsheet_id: string; name: string; position: number };

/** Mudança de uma célula. raw vazio ("" ou null) apaga a célula. */
export type CellChange = { row: number; col: number; raw: string | null };

const COLUMNS = "id,owner_id,title,version,trashed_at,created_at,updated_at";
const PAGE = 1000;

/** Lista as planilhas visíveis ao usuário (RLS filtra dono e compartilhadas). */
export async function listSpreadsheets(): Promise<SpreadsheetRow[]> {
  const { data, error } = await ddb.from("spreadsheets").select(COLUMNS).order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SpreadsheetRow[];
}

/** Cria uma planilha com uma aba inicial e retorna o id. */
export async function createSpreadsheet(ownerId: string, title: string): Promise<string> {
  const { data, error } = await ddb.from("spreadsheets").insert({ owner_id: ownerId, title }).select("id").single();
  if (error) throw error;
  const id = data.id as string;
  const { error: tabError } = await ddb.from("spreadsheet_sheets").insert({ spreadsheet_id: id, name: "Planilha1", position: 0 });
  if (tabError) throw tabError;
  return id;
}

/** Carrega a planilha, suas abas e as células de cada aba. Células vêm como { "linha,coluna": texto }. */
export async function loadSpreadsheet(id: string): Promise<{
  row: SpreadsheetRow;
  tabs: SheetTab[];
  cells: Record<string, Record<string, string>>;
} | null> {
  const { data, error } = await ddb.from("spreadsheets").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: tabs, error: tabError } = await ddb.from("spreadsheet_sheets")
    .select("id,spreadsheet_id,name,position")
    .eq("spreadsheet_id", id)
    .order("position");
  if (tabError) throw tabError;
  const cells: Record<string, Record<string, string>> = {};
  for (const tab of (tabs ?? []) as SheetTab[]) cells[tab.id] = await loadCells(tab.id);
  return { row: data as SpreadsheetRow, tabs: (tabs ?? []) as SheetTab[], cells };
}

async function loadCells(sheetId: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await ddb.from("spreadsheet_cells")
      .select("row_idx,col_idx,raw")
      .eq("sheet_id", sheetId)
      .order("row_idx")
      .order("col_idx")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    for (const c of data ?? []) if (c.raw !== null) out[`${c.row_idx},${c.col_idx}`] = c.raw;
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** Adiciona uma aba à planilha. */
export async function addSheetTab(spreadsheetId: string, name: string, position: number): Promise<SheetTab> {
  const { data, error } = await ddb.from("spreadsheet_sheets")
    .insert({ spreadsheet_id: spreadsheetId, name, position })
    .select("id,spreadsheet_id,name,position")
    .single();
  if (error) throw error;
  return data as SheetTab;
}

/** Grava as células alteradas de uma aba e atualiza a data da planilha. */
export async function saveCells(spreadsheetId: string, sheetId: string, changes: CellChange[]): Promise<void> {
  const clears = changes.filter((c) => !c.raw);
  const sets = changes.filter((c) => !!c.raw);
  await Promise.all(clears.map(async (c) => {
    const { error } = await ddb.from("spreadsheet_cells")
      .delete()
      .eq("sheet_id", sheetId)
      .eq("row_idx", c.row)
      .eq("col_idx", c.col);
    if (error) throw error;
  }));
  if (sets.length > 0) {
    const { error } = await ddb.from("spreadsheet_cells").upsert(
      sets.map((c) => ({ sheet_id: sheetId, row_idx: c.row, col_idx: c.col, raw: c.raw })),
      { onConflict: "sheet_id,row_idx,col_idx" },
    );
    if (error) throw error;
  }
  const { error } = await ddb.from("spreadsheets").update({ updated_at: new Date().toISOString() }).eq("id", spreadsheetId);
  if (error) throw error;
}

export async function renameSpreadsheet(id: string, title: string): Promise<void> {
  const { error } = await ddb.from("spreadsheets").update({ title: title.trim() || "Planilha sem título" }).eq("id", id);
  if (error) throw error;
}
