-- ============ Life Sheets ============

CREATE TABLE public.spreadsheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES public.drive_folders(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Planilha sem título',
  version integer NOT NULL DEFAULT 1,
  trashed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.spreadsheet_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spreadsheet_id uuid NOT NULL REFERENCES public.spreadsheets(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Planilha1',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Só células com conteúdo ou formatação são gravadas (sem linha para célula vazia).
CREATE TABLE public.spreadsheet_cells (
  sheet_id uuid NOT NULL REFERENCES public.spreadsheet_sheets(id) ON DELETE CASCADE,
  row_idx integer NOT NULL CHECK (row_idx >= 0),
  col_idx integer NOT NULL CHECK (col_idx >= 0),
  raw text,
  style jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (sheet_id, row_idx, col_idx)
);

CREATE TABLE public.spreadsheet_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spreadsheet_id uuid NOT NULL REFERENCES public.spreadsheets(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL DEFAULT 'view' CHECK (permission IN ('view','edit')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (spreadsheet_id, shared_with)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.spreadsheets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spreadsheet_sheets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spreadsheet_cells TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spreadsheet_shares TO authenticated;
GRANT ALL ON public.spreadsheets, public.spreadsheet_sheets, public.spreadsheet_cells, public.spreadsheet_shares TO service_role;

ALTER TABLE public.spreadsheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spreadsheet_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spreadsheet_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spreadsheet_shares ENABLE ROW LEVEL SECURITY;

CREATE INDEX spreadsheets_owner_idx ON public.spreadsheets(owner_id, folder_id);
CREATE INDEX spreadsheet_shares_target_idx ON public.spreadsheet_shares(shared_with);

-- Permissão efetiva do usuário atual sobre uma planilha: owner, edit, view ou NULL.
CREATE OR REPLACE FUNCTION public.sheet_permission(_sheet uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.spreadsheets s WHERE s.id = _sheet AND s.owner_id = auth.uid()) THEN 'owner'
    ELSE (SELECT sh.permission FROM public.spreadsheet_shares sh
          WHERE sh.spreadsheet_id = _sheet AND sh.shared_with = auth.uid() LIMIT 1)
  END
$$;
REVOKE EXECUTE ON FUNCTION public.sheet_permission(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.sheet_permission(uuid) TO authenticated;

-- Dono da planilha que contém uma aba (usado nas políticas de células).
CREATE OR REPLACE FUNCTION public.sheet_spreadsheet(_sheet uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT spreadsheet_id FROM public.spreadsheet_sheets WHERE id = _sheet
$$;
REVOKE EXECUTE ON FUNCTION public.sheet_spreadsheet(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.sheet_spreadsheet(uuid) TO authenticated;

-- Políticas: planilhas
CREATE POLICY "sheets owner all" ON public.spreadsheets FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "sheets shared read" ON public.spreadsheets FOR SELECT TO authenticated
  USING (public.sheet_permission(id) IN ('view','edit'));
CREATE POLICY "sheets shared edit" ON public.spreadsheets FOR UPDATE TO authenticated
  USING (public.sheet_permission(id) = 'edit') WITH CHECK (public.sheet_permission(id) = 'edit');

-- Políticas: abas
CREATE POLICY "tabs owner all" ON public.spreadsheet_sheets FOR ALL TO authenticated
  USING (public.sheet_permission(spreadsheet_id) = 'owner')
  WITH CHECK (public.sheet_permission(spreadsheet_id) = 'owner');
CREATE POLICY "tabs shared read" ON public.spreadsheet_sheets FOR SELECT TO authenticated
  USING (public.sheet_permission(spreadsheet_id) IN ('view','edit'));
CREATE POLICY "tabs shared edit" ON public.spreadsheet_sheets FOR UPDATE TO authenticated
  USING (public.sheet_permission(spreadsheet_id) = 'edit')
  WITH CHECK (public.sheet_permission(spreadsheet_id) = 'edit');

-- Políticas: células (leitura para quem vê, escrita para dono e editores)
CREATE POLICY "cells read" ON public.spreadsheet_cells FOR SELECT TO authenticated
  USING (public.sheet_permission(public.sheet_spreadsheet(sheet_id)) IN ('owner','edit','view'));
CREATE POLICY "cells write" ON public.spreadsheet_cells FOR ALL TO authenticated
  USING (public.sheet_permission(public.sheet_spreadsheet(sheet_id)) IN ('owner','edit'))
  WITH CHECK (public.sheet_permission(public.sheet_spreadsheet(sheet_id)) IN ('owner','edit'));

-- Políticas: compartilhamentos (somente o dono gerencia)
CREATE POLICY "shares owner all" ON public.spreadsheet_shares FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "shares recipient read" ON public.spreadsheet_shares FOR SELECT TO authenticated
  USING (shared_with = auth.uid());

CREATE TRIGGER spreadsheets_touch BEFORE UPDATE ON public.spreadsheets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER spreadsheet_sheets_touch BEFORE UPDATE ON public.spreadsheet_sheets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
