export type FieldType = "short" | "long" | "email" | "number" | "date" | "choice" | "checkbox" | "dropdown" | "scale" | "section" | "rating" | "nps" | "yesno" | "phone" | "url" | "time";
export type Field = {
  id: string;
  type: FieldType;
  label: string;
  help?: string;
  required?: boolean;
  options?: string[];
  max?: number; // escala / estrelas
  placeholder?: string;
  shuffle?: boolean;
  minLength?: number;
  maxLength?: number;
  minLabel?: string;
  maxLabel?: string;
  showIf?: { fieldId: string; equals: string } | null;
};
export type FormSettings = {
  theme?: string;
  confirmation?: string;
  accepting?: boolean;
  oneResponse?: boolean;
  accentHex?: string;
  font?: "sans" | "serif" | "mono" | "rounded";
  background?: "plain" | "tint" | "gradient" | "dots";
  radius?: "sharp" | "soft" | "round";
  coverUrl?: string;
  logoUrl?: string;
  submitLabel?: string;
  showProgress?: boolean;
  allowAnother?: boolean;
  redirectUrl?: string;
  closesAt?: string;
  maxResponses?: number;
  hideBranding?: boolean;
};
export type FormRow = {
  id: string; owner_id: string; title: string; description: string; fields: Field[]; settings: FormSettings;
  status: "draft" | "published" | "closed"; visibility: "public" | "private"; created_at: string; updated_at: string;
};

export const FIELD_TYPES: { type: FieldType; label: string }[] = [
  { type: "short", label: "Resposta curta" },
  { type: "long", label: "Parágrafo" },
  { type: "email", label: "E-mail" },
  { type: "number", label: "Número" },
  { type: "date", label: "Data" },
  { type: "choice", label: "Múltipla escolha" },
  { type: "checkbox", label: "Caixas de seleção" },
  { type: "dropdown", label: "Lista suspensa" },
  { type: "scale", label: "Escala linear" },
  { type: "rating", label: "Avaliação (estrelas)" },
  { type: "nps", label: "NPS (0 a 10)" },
  { type: "yesno", label: "Sim / Não" },
  { type: "phone", label: "Telefone" },
  { type: "url", label: "Link (URL)" },
  { type: "time", label: "Horário" },
  { type: "section", label: "Título de seção" },
];
export const hasOptions = (t: FieldType) => t === "choice" || t === "checkbox" || t === "dropdown";

/** Temas: cor de destaque em oklch. */
export const THEMES: { key: string; label: string; color: string }[] = [
  { key: "indigo", label: "Índigo", color: "oklch(0.52 0.18 258)" },
  { key: "violet", label: "Violeta", color: "oklch(0.55 0.2 295)" },
  { key: "rose", label: "Rosa", color: "oklch(0.6 0.2 10)" },
  { key: "amber", label: "Âmbar", color: "oklch(0.7 0.16 65)" },
  { key: "emerald", label: "Esmeralda", color: "oklch(0.6 0.15 160)" },
  { key: "teal", label: "Turquesa", color: "oklch(0.6 0.11 195)" },
  { key: "graphite", label: "Grafite", color: "oklch(0.32 0.02 260)" },
];
export const themeColor = (k?: string, hex?: string) => (k === "custom" && hex ? hex : THEMES.find((t) => t.key === k)?.color ?? THEMES[0].color);
export const FONTS = { sans: "ui-sans-serif, -apple-system, system-ui, sans-serif", serif: "ui-serif, Georgia, 'Times New Roman', serif", mono: "ui-monospace, SFMono-Regular, Menlo, monospace", rounded: "ui-rounded, 'SF Pro Rounded', system-ui, sans-serif" } as const;
export const RADIUS = { sharp: "0.5rem", soft: "1rem", round: "1.75rem" } as const;
/** Valores possíveis para estatísticas de perguntas fechadas. */
export function optionsFor(f: Field): string[] | null {
  if (hasOptions(f.type)) return f.options ?? [];
  if (f.type === "scale" || f.type === "rating") return Array.from({ length: f.max ?? 5 }, (_, i) => String(i + 1));
  if (f.type === "nps") return Array.from({ length: 11 }, (_, i) => String(i));
  if (f.type === "yesno") return ["Sim", "Não"];
  return null;
}

export const uid = () => Math.random().toString(36).slice(2, 10);
export const newField = (type: FieldType = "short"): Field => ({
  id: uid(), type, label: type === "section" ? "Nova seção" : "Pergunta sem título", required: false,
  options: hasOptions(type) ? ["Opção 1"] : undefined, max: type === "scale" || type === "rating" ? 5 : undefined, showIf: null,
});

export type Answers = Record<string, string | string[]>;
export function isVisible(f: Field, a: Answers) {
  if (!f.showIf?.fieldId) return true;
  const v = a[f.showIf.fieldId];
  return Array.isArray(v) ? v.includes(f.showIf.equals) : v === f.showIf.equals;
}

const T = (label: string, type: FieldType, extra: Partial<Field> = {}): Field => ({ ...newField(type), label, ...extra });
export const TEMPLATES: { key: string; name: string; description: string; title: string; fields: () => Field[]; theme: string }[] = [
  { key: "blank", name: "Em branco", description: "Comece do zero", title: "Formulário sem título", theme: "indigo", fields: () => [newField()] },
  { key: "contact", name: "Contato", description: "Nome, e-mail e mensagem", title: "Fale conosco", theme: "teal", fields: () => [
    T("Nome", "short", { required: true }), T("E-mail", "email", { required: true }), T("Assunto", "dropdown", { options: ["Dúvida", "Sugestão", "Suporte", "Outro"] }), T("Mensagem", "long", { required: true }) ] },
  { key: "event", name: "Inscrição em evento", description: "Confirme presença", title: "Inscrição no evento", theme: "violet", fields: () => {
    const go = T("Você vai participar?", "choice", { required: true, options: ["Sim", "Não"] });
    return [T("Nome completo", "short", { required: true }), T("E-mail", "email", { required: true }), go,
      T("Restrições alimentares", "checkbox", { options: ["Nenhuma", "Vegetariano", "Vegano", "Sem glúten"], showIf: { fieldId: go.id, equals: "Sim" } }),
      T("Por que não poderá ir?", "long", { showIf: { fieldId: go.id, equals: "Não" } })];
  } },
  { key: "feedback", name: "Pesquisa de satisfação", description: "Avaliação de 1 a 5", title: "Como foi sua experiência?", theme: "amber", fields: () => [
    T("Qual sua satisfação geral?", "scale", { required: true, max: 5 }), T("Você nos recomendaria?", "choice", { options: ["Com certeza", "Talvez", "Não"] }), T("O que podemos melhorar?", "long") ] },
  { key: "job", name: "Candidatura", description: "Processo seletivo", title: "Trabalhe na Furry's Life", theme: "graphite", fields: () => [
    T("Nome completo", "short", { required: true }), T("E-mail", "email", { required: true }), T("Área de interesse", "dropdown", { options: ["Tecnologia", "Design", "Marketing", "Operações"] }),
    T("Anos de experiência", "number"), T("Data disponível para início", "date"), T("Conte sobre você", "long") ] },
  { key: "nps", name: "NPS", description: "Net Promoter Score", title: "De 0 a 10, quanto nos recomendaria?", theme: "emerald", fields: () => [
    T("Qual a probabilidade de você nos recomendar a um amigo?", "nps", { required: true, minLabel: "Nada provável", maxLabel: "Muito provável" }), T("O que motivou sua nota?", "long") ] },
  { key: "order", name: "Pedido", description: "Produtos e entrega", title: "Faça seu pedido", theme: "rose", fields: () => [
    T("Nome", "short", { required: true }), T("Telefone", "phone", { required: true }), T("Produtos", "checkbox", { options: ["Produto A", "Produto B", "Produto C"], required: true }),
    T("Quantidade", "number"), T("Data de entrega", "date"), T("Horário preferido", "time"), T("Observações", "long") ] },
  { key: "review", name: "Avaliação de produto", description: "Estrelas e comentários", title: "Avalie nosso produto", theme: "amber", fields: () => [
    T("Nota geral", "rating", { required: true, max: 5 }), T("Recomendaria?", "yesno"), T("Comentários", "long") ] },
];

export function toCSV(fields: Field[], rows: { created_at: string; answers: Answers }[]) {
  const qs = fields.filter((f) => f.type !== "section");
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const head = ["Data", ...qs.map((q) => q.label)].map(esc).join(",");
  const body = rows.map((r) => [new Date(r.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    ...qs.map((q) => { const v = r.answers[q.id]; return Array.isArray(v) ? v.join("; ") : v ?? ""; })].map((x) => esc(String(x))).join(","));
  return "\uFEFF" + [head, ...body].join("\n");
}
