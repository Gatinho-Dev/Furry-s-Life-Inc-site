import { blankSlide, newId, type Deck, type Slide, type SlideElement } from "@/lib/workspace/slides";

const text = (x: number, y: number, w: number, h: number, t: string, o: Partial<SlideElement> = {}): SlideElement =>
  ({ id: newId(), kind: "text", x, y, w, h, text: t, fontSize: 56, color: "#111827", align: "left", ...o });

const shape = (x: number, y: number, w: number, h: number, fill: string, o: Partial<SlideElement> = {}): SlideElement =>
  ({ id: newId(), kind: "shape", x, y, w, h, shape: "rect", fill, stroke: "transparent", strokeWidth: 0, ...o });

const slide = (elements: SlideElement[], background = "#ffffff", notes = ""): Slide =>
  ({ id: newId(), elements, background, notes });

const titleSlide = (title: string, subtitle: string, accent: string, bg = "#ffffff"): Slide =>
  slide([
    shape(0, 0, 1920, 24, accent),
    text(160, 380, 1600, 180, title, { fontSize: 120, bold: true }),
    text(160, 580, 1600, 90, subtitle, { fontSize: 44, color: "#6b7280" }),
  ], bg);

const bulletsSlide = (title: string, items: string[], accent: string): Slide =>
  slide([
    text(120, 100, 1680, 130, title, { fontSize: 80, bold: true, color: accent }),
    text(120, 300, 1680, 680, items.map((i) => `• ${i}`).join("\n"), { fontSize: 44 }),
  ]);

const closingSlide = (msg: string, accent: string): Slide =>
  slide([
    text(160, 400, 1600, 160, msg, { fontSize: 100, bold: true, align: "center", color: accent }),
  ]);

export type SlideTemplate = { key: string; name: string; title: string; build: () => Deck };

const deckOf = (...slides: Slide[]): Deck => ({ slides });

export const SLIDE_TEMPLATES: SlideTemplate[] = [
  { key: "blank", name: "Apresentação em branco", title: "Apresentação sem título",
    build: () => deckOf(blankSlide()) },
  { key: "business", name: "Empresarial", title: "Apresentação empresarial",
    build: () => deckOf(
      titleSlide("Apresentação empresarial", "Resultados, metas e próximos passos", "#1d4ed8"),
      bulletsSlide("Agenda", ["Contexto", "Resultados do período", "Plano de ação"], "#1d4ed8"),
      closingSlide("Obrigado", "#1d4ed8")) },
  { key: "school", name: "Escolar", title: "Apresentação escolar",
    build: () => deckOf(
      titleSlide("Tema do trabalho", "Nome · Turma · Data", "#15803d"),
      bulletsSlide("Introdução", ["Objetivo do estudo", "Pergunta central"], "#15803d"),
      bulletsSlide("Conclusão", ["Principais aprendizados", "Referências"], "#15803d")) },
  { key: "report", name: "Relatório de resultados", title: "Relatório de resultados",
    build: () => deckOf(
      titleSlide("Relatório de resultados", "Período de referência", "#7c3aed"),
      bulletsSlide("Destaques", ["Indicador principal", "Comparativo com a meta"], "#7c3aed"),
      bulletsSlide("Próximos passos", ["Ação 1", "Ação 2"], "#7c3aed")) },
  { key: "project", name: "Projeto", title: "Apresentação de projeto",
    build: () => deckOf(
      titleSlide("Nome do projeto", "Objetivo em uma frase", "#0f766e"),
      bulletsSlide("Escopo", ["Entregas", "Prazos", "Responsáveis"], "#0f766e"),
      bulletsSlide("Riscos", ["Principal risco", "Plano de mitigação"], "#0f766e")) },
  { key: "portfolio", name: "Portfólio", title: "Portfólio",
    build: () => deckOf(
      titleSlide("Seu nome", "Portfólio profissional", "#be185d"),
      bulletsSlide("Sobre mim", ["Formação", "Experiência", "Especialidades"], "#be185d"),
      closingSlide("Vamos conversar?", "#be185d")) },
  { key: "product", name: "Produto", title: "Apresentação de produto",
    build: () => deckOf(
      titleSlide("Nome do produto", "O que ele resolve", "#ea580c"),
      bulletsSlide("Benefícios", ["Benefício principal", "Diferencial", "Preço"], "#ea580c"),
      closingSlide("Experimente agora", "#ea580c")) },
  { key: "strategy", name: "Planejamento estratégico", title: "Planejamento estratégico",
    build: () => deckOf(
      titleSlide("Planejamento estratégico", "Visão, objetivos e iniciativas", "#334155"),
      bulletsSlide("Objetivos", ["Objetivo 1", "Objetivo 2", "Objetivo 3"], "#334155"),
      bulletsSlide("Iniciativas", ["Iniciativa 1", "Iniciativa 2"], "#334155")) },
  { key: "minimal", name: "Minimalista", title: "Apresentação minimalista",
    build: () => deckOf(
      slide([text(160, 440, 1600, 200, "Título", { fontSize: 140, bold: true })], "#fafafa"),
      slide([text(160, 300, 1600, 500, "Uma ideia por slide.", { fontSize: 72 })], "#fafafa")) },
  { key: "creative", name: "Criativa", title: "Apresentação criativa",
    build: () => deckOf(
      titleSlide("Sua grande ideia", "Inspire sua audiência", "#db2777", "#fdf2f8"),
      slide([shape(1200, 200, 560, 560, "#f9a8d4", { shape: "ellipse" }),
        text(120, 380, 900, 220, "Surpreenda", { fontSize: 110, bold: true, color: "#831843" })], "#fdf2f8"),
      closingSlide("Obrigado!", "#db2777")) },
];
