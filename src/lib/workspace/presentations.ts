import { ddb } from "@/lib/workspace/docs";
import { supabase } from "@/integrations/supabase/client";
import { blankSlide, type Deck, parseDeck } from "@/lib/workspace/slides";

export type PresentationRow = {
  id: string;
  owner_id: string;
  title: string;
  deck: unknown;
  folder_id: string | null;
  trashed_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

const COLUMNS = "id,owner_id,title,folder_id,trashed_at,version,created_at,updated_at";

export const emptyDeck = (): Deck => ({ slides: [blankSlide()] });

/** Lista as apresentações visíveis ao usuário (RLS filtra dono e compartilhadas). */
export async function listPresentations(): Promise<PresentationRow[]> {
  const { data, error } = await ddb.from("presentations").select(COLUMNS).order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PresentationRow[];
}

/** Cria uma apresentação com deck inicial válido e retorna o id. */
export async function createPresentation(ownerId: string, title: string, deck: Deck = emptyDeck()): Promise<string> {
  const { data, error } = await ddb.from("presentations")
    .insert({ owner_id: ownerId, title, deck })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Carrega uma apresentação e valida o deck antes de usá-lo. */
export async function loadPresentation(id: string): Promise<{ row: PresentationRow; deck: Deck } | null> {
  const { data, error } = await ddb.from("presentations").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const deck = parseDeck(data.deck) ?? emptyDeck();
  return { row: data as PresentationRow, deck };
}

/**
 * Salva o deck com controle de versão otimista. Retorna a nova versão confirmada pelo banco,
 * ou null quando outra sessão alterou a apresentação (conflito) — nesse caso nada é sobrescrito.
 */
export async function saveDeck(id: string, deck: Deck, expectedVersion: number): Promise<number | null> {
  const { data, error } = await ddb.from("presentations")
    .update({ deck })
    .eq("id", id)
    .eq("version", expectedVersion)
    .select("version");
  if (error) throw error;
  if (!data || data.length === 0) return null;
  return data[0].version as number;
}

/** Bucket compartilhado com o Life Drive. Imagens de slides ficam em <uid>/slides/<presentation_id>/<id>. */
export const SLIDE_BUCKET = "life-drive";
export const SLIDE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** Envia uma imagem para a apresentação e retorna o caminho guardado no elemento. */
export async function uploadSlideImage(ownerId: string, presentationId: string, file: File): Promise<string> {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error("Formato não suportado. Use PNG, JPEG, WebP ou GIF.");
  if (file.size > SLIDE_IMAGE_MAX_BYTES) throw new Error("A imagem passa de 10 MB.");
  const path = `${ownerId}/slides/${presentationId}/${crypto.randomUUID()}`;
  const { error } = await supabase.storage.from(SLIDE_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

/** URL assinada temporária para exibir a imagem. Não é armazenada no deck. */
export async function slideImageUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(SLIDE_BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function renamePresentation(id: string, title: string): Promise<void> {
  const { error } = await ddb.from("presentations").update({ title: title.trim() || "Apresentação sem título" }).eq("id", id);
  if (error) throw error;
}
