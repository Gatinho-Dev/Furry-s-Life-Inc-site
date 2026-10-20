import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ddb = supabase as any;

export type DocRow = {
  id: string; owner_id: string; title: string; content: unknown; preview: string;
  folder_id: string | null; trashed_at: string | null; version: number; created_at: string; updated_at: string;
};
export type DocShare = { doc_id: string; user_id: string; email: string; role: "viewer" | "editor" };

const h = (level: number, text: string) => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });
const p = (text = "") => (text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" });
const ul = (items: string[]) => ({ type: "bulletList", content: items.map((t) => ({ type: "listItem", content: [p(t)] })) });

export const DOC_TEMPLATES: { key: string; name: string; title: string; content: unknown }[] = [
  { key: "blank", name: "Documento em branco", title: "Documento sem título", content: { type: "doc", content: [p()] } },
  { key: "report", name: "Relatório", title: "Relatório", content: { type: "doc", content: [
    h(1, "Título do relatório"), p("Autor · Data"), h(2, "Resumo"), p("Descreva brevemente o objetivo e as conclusões."),
    h(2, "Contexto"), p(""), h(2, "Resultados"), ul(["Resultado 1", "Resultado 2"]), h(2, "Conclusão"), p(""),
  ] } },
  { key: "notes", name: "Anotações", title: "Anotações", content: { type: "doc", content: [
    h(1, "Anotações"), p("Data:"), h(3, "Pontos principais"), ul(["", ""]), h(3, "Próximos passos"), ul([""]),
  ] } },
  { key: "letter", name: "Carta", title: "Carta", content: { type: "doc", content: [
    p("Cidade, data"), p(""), p("Prezado(a) destinatário(a),"), p(""), p("Escreva aqui o conteúdo da carta."), p(""), p("Atenciosamente,"), p("Seu nome"),
  ] } },
  { key: "plan", name: "Planejamento", title: "Planejamento", content: { type: "doc", content: [
    h(1, "Planejamento"), h(2, "Objetivo"), p(""), h(2, "Metas"), ul(["Meta 1", "Meta 2", "Meta 3"]),
    h(2, "Cronograma"), { type: "table", content: [
      { type: "tableRow", content: ["Etapa", "Responsável", "Prazo"].map((t) => ({ type: "tableHeader", content: [p(t)] })) },
      { type: "tableRow", content: ["", "", ""].map(() => ({ type: "tableCell", content: [p()] })) },
    ] }, h(2, "Riscos"), ul([""]),
  ] } },
];

export async function createDoc(ownerId: string, title: string, content: unknown) {
  const { data, error } = await ddb.from("docs").insert({ owner_id: ownerId, title, content }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export const fmtDate = (s: string) =>
  new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
