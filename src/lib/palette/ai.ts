/**
 * Life Intelligence AI — contextual analyst for Life Palette.
 *
 * This is a deterministic, local reasoning engine over the case's own records.
 * It does not call an LLM and it cannot invent sources: every statement is
 * derived from stored nodes, edges, searches, evidence or Life Knowledge
 * documents, and the answer carries citations plus explicit limitations.
 */

import { caseStats, findDuplicates, type CaseStats } from "./store";
import { knowledgeStats, retrieve, type KnowledgeHit } from "./knowledge";
import {
  CONFIDENCE_LABEL, NODE_KIND_LABEL, type AiAction, type AiAnswer, type AiCitation,
  type PaletteCase, type PaletteEdge, type PaletteNode, type PalettePrefs,
} from "./types";
import { uid } from "./store";
import { normalizeText } from "./knowledge";

export type AiContext = {
  case: PaletteCase;
  prefs?: PalettePrefs;
  memoryNote?: string;
};

const SEARCH_TOOL: Partial<Record<PaletteNode["kind"], { tool: string; label: string }>> = {
  domain: { tool: "domainLookup", label: "RDAP + DNS do domínio" },
  subdomain: { tool: "domainLookup", label: "DNS do subdomínio" },
  ipv4: { tool: "ipLookup", label: "RDAP + ASN do IP" },
  ipv6: { tool: "ipLookup", label: "RDAP + ASN do IPv6" },
  asn: { tool: "asnLookup", label: "RIPEstat do ASN" },
  url: { tool: "urlAnalyzer", label: "Análise da URL" },
  username: { tool: "usernameScan", label: "Perfis públicos do username" },
  email: { tool: "emailAnalysis", label: "DNS/e-mail do domínio" },
  cve: { tool: "cveLookup", label: "NVD + KEV + EPSS" },
  hash: { tool: "hashLookup", label: "Metadados públicos do hash" },
  company: { tool: "cnpjLookup", label: "Dados públicos de CNPJ" },
  "social-profile": { tool: "urlAnalyzer", label: "Análise do perfil público" },
  person: { tool: "githubSearch", label: "Busca pública do nome" },
  organization: { tool: "githubSearch", label: "Busca pública da organização" },
};

/** Types with no working free connector: the AI must say so, not invent one. */
export const NO_FREE_SOURCE: Partial<Record<PaletteNode["kind"], string>> = {
  phone: "telefone",
  wallet: "carteira de criptomoedas",
  location: "localização",
  event: "evento",
  custom: "entidade personalizada",
};

function ageDays(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.round((Date.now() - t) / 86_400_000));
}

function mentionedNodes(c: PaletteCase, question: string): PaletteNode[] {
  const q = normalizeText(question);
  const scored = c.nodes
    .map((n) => {
      const title = normalizeText(n.title);
      const bare = title.replace(/^https?:\/\//, "");
      let score = 0;
      if (q.includes(title) && title.length >= 3) score += title.length;
      if (q.includes(bare) && bare.length >= 3) score += bare.length;
      for (const ident of n.identifiers) {
        const v = normalizeText(ident.value);
        if (v.length >= 3 && q.includes(v)) score += v.length;
      }
      if (n.id && q.includes(normalizeText(n.id))) score += 20;
      return { n, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map((s) => s.n);
}

function edgeLabel(c: PaletteCase, id: string): string {
  const n = c.nodes.find((x) => x.id === id);
  return n ? n.title : "(entidade removida)";
}

function citeNode(n: PaletteNode): AiCitation {
  return { label: `${NODE_KIND_LABEL[n.kind]}: ${n.title}`, ref: n.id, kind: "case" };
}
function citeEdge(e: PaletteEdge): AiCitation {
  return { label: `${e.relation}: ${e.sourceLabel || "relação"}`, ref: e.id, kind: "edge" };
}
function citesKnowledge(hits: KnowledgeHit[]): AiCitation[] {
  return hits.map((h) => ({ label: `${h.docTitle} (${h.category})`, ref: h.docId, kind: "knowledge" as const }));
}

function levelForCase(stats: CaseStats, cited: number): AiAnswer["confidence"] {
  if (!stats.nodes) return "unverified";
  if (stats.verified > 0 && cited >= stats.verified) return "verified";
  if (stats.high + stats.verified >= 2) return "high";
  if (stats.medium > 0) return "medium";
  if (stats.low > 0) return "low";
  return "unverified";
}

function searchActions(nodes: PaletteNode[], limit = 3): AiAction[] {
  const out: AiAction[] = [];
  for (const n of nodes) {
    const tool = SEARCH_TOOL[n.kind];
    if (!tool) continue;
    out.push({ type: "run_search", tool: tool.tool, value: n.title, reason: `${n.title} ainda não tem consulta registrada para ${tool.label}.` });
    if (out.length >= limit) break;
  }
  return out;
}

/* ------------------------------------------------------------------ intents */

type Intent =
  | "help" | "summary" | "entity" | "connections" | "unverified" | "gaps"
  | "sources" | "duplicates" | "timeline" | "evidence" | "compare"
  | "why" | "knowledge" | "confidence";

function detectIntent(question: string, hasMention: boolean): Intent {
  const q = normalizeText(question);
  if (/^(oi|ola|bom dia|boa tarde|boa noite|ajuda|help|o que voce faz|comandos)/.test(q.trim())) return "help";
  if (/(por que|porque|explica|justifica).*(relac|conex|aresta|ligac)/.test(q) || /(relac|conex|aresta).*(por que|porque)/.test(q)) return "why";
  if (/(comparar|compare|diferenca|versus|\bvs\b)/.test(q)) return "compare";
  if (/(duplic|repetid|mesma entidade)/.test(q)) return "duplicates";
  if (/(resum|panorama|visao geral|tudo sobre o caso|status do caso|descobertas|achados)/.test(q)) return "summary";
  if (/(nao verificado|nao confirmad|pendente|validar|o que falta confirmar|inconsist)/.test(q)) return "unverified";
  if (/(falta|lacuna|proximo passo|proximos passos|sugir|sugestao|o que pesquisar|proximo)/.test(q)) return "gaps";
  if (/(fonte|fontes|sustenta|baseado em que|origem do dado)/.test(q)) return "sources";
  if (/(historico|linha do tempo|timeline|quando foi|registro de atividade)/.test(q)) return "timeline";
  if (/(evidencia|captura|hash do arquivo|arquivo coletado)/.test(q)) return "evidence";
  if (/(confianca|score|nivel|classificacao)/.test(q)) return "confidence";
  if (/(relac|conex|conectad|ligad|vizinh|grafo)/.test(q)) return "connections";
  if (/(o que sabemos|sobre|detalh|quem e|informac)/.test(q) && hasMention) return "entity";
  return "entity";
}

/* ------------------------------------------------------------------ answers */

export function answerQuestion(question: string, ctx: AiContext): AiAnswer {
  const c = ctx.case;
  const stats = caseStats(c);
  const mentioned = mentionedNodes(c, question);
  const intent = detectIntent(question, mentioned.length > 0);
  const knowledgeHits = retrieve(question, 3);
  const dataUsed: string[] = [];
  const limitations: string[] = [];
  const actions: AiAction[] = [];
  const citations: AiCitation[] = [];
  const sections: AiAnswer["sections"] = [];
  let headline = "";

  const push = (title: string, body: string) => sections.push({ title, body });
  const addCitations = (list: AiCitation[]) => {
    for (const c1 of list) if (!citations.some((x) => x.ref === c1.ref && x.kind === c1.kind)) citations.push(c1);
  };

  dataUsed.push(`Caso ${c.code} · ${c.nodes.length} entidades · ${c.edges.length} relações · ${c.evidence.length} evidências · ${c.searches.length} consultas`);

  if (intent === "help") {
    headline = "Sou o analista contextual deste caso";
    push("O que eu faço", [
      "Respondo usando apenas os registros deste caso e a base Life Knowledge:",
      "• “Resuma a investigação” e “quais são as principais descobertas?”",
      "• “O que sabemos sobre <entidade>?” e “quais entidades estão conectadas a <entidade>?”",
      "• “O que ainda não foi verificado?” e “quais informações estão faltando?”",
      "• “Quais fontes sustentam esta conclusão?” e “compare A e B”",
      "• “Sugira os próximos passos” e “mostre o histórico”",
      "Eu não invento fontes, conexões ou resultados. Ações que alteram o caso aparecem como propostas e só rodam com sua confirmação.",
    ].join("\n"));
    limitations.push("Sem modelo de linguagem generativo: as respostas são compostas a partir dos dados registrados.");
    return finalize(question, headline, sections, citations, dataUsed, "high", limitations, [], knowledgeHits, ctx);
  }

  if (intent === "summary") {
    headline = `Panorama de ${c.title}`;
    push("Situação", [
      `${c.code} · status ${c.status} · prioridade ${c.priority} · responsável ${c.owner}.`,
      c.objective ? `Objetivo: ${c.objective}` : "Objetivo ainda não registrado.",
      `Canvas: ${stats.nodes} entidades, ${stats.edges} relações, ${stats.groups} grupos. ${stats.isolatedNodes} entidade(s) sem conexão.`,
      `Cobertura de proveniência: ${stats.coverage}% das entidades têm fonte ou evidência.`,
    ].join("\n"));
    const verified = c.nodes.filter((n) => n.confidence === "verified" || n.confidence === "high");
    push("Principais descobertas", verified.length
      ? verified.slice(0, 6).map((n) => `• ${NODE_KIND_LABEL[n.kind]} ${n.title} — ${CONFIDENCE_LABEL[n.confidence]} (${n.sources.join(", ") || "sem fonte registrada"})`).join("\n")
      : "Nenhuma entidade com confiança alta ou verificada. O caso ainda está em coleta.");
    addCitations(verified.slice(0, 6).map(citeNode));
    if (c.plan.length) {
      push("Plano", c.plan.map((s) => `${s.done ? "✓" : "○"} ${s.label} — ${s.hint}`).join("\n"));
    }
    const gaps = c.nodes.filter((n) => n.confidence === "unverified" || n.confidence === "low");
    if (gaps.length) {
      push("O que ainda está aberto", `${gaps.length} entidade(s) em baixa confiança ou não verificadas: ${gaps.slice(0, 6).map((n) => n.title).join(", ")}.`);
      addCitations(gaps.slice(0, 6).map(citeNode));
    }
    actions.push({ type: "summarize", reason: "Registrar este panorama como nota no caso." });
    limitations.push("Resumo baseado apenas no que está registrado no caso; não substitui a leitura das evidências.");
    return finalize(question, headline, sections, citations, dataUsed, levelForCase(stats, verified.length), limitations, actions, knowledgeHits, ctx);
  }

  if (intent === "connections") {
    const focus = mentioned[0];
    const scope = focus ? c.edges.filter((e) => e.source === focus.id || e.target === focus.id) : c.edges;
    headline = focus ? `Conexões de ${focus.title}` : "Mapa de relações do caso";
    if (!scope.length) {
      push("Resultado", focus
        ? `${focus.title} não possui nenhuma relação registrada. Isso é uma lacuna de análise, não uma prova de isolamento.`
        : "Nenhuma relação registrada. Use o canvas para conectar entidades somente quando houver evidência.");
      if (focus) actions.push(...searchActions([focus], 1));
    } else {
      const rows = scope.slice(0, 12).map((e) => {
        const other = e.source === focus?.id ? e.target : e.source;
        return `• ${edgeLabel(c, e.source)} → ${edgeLabel(c, e.target)} — ${e.relation} · ${CONFIDENCE_LABEL[e.confidence]} · fonte: ${e.sourceLabel || "não informada"} (${e.discoveredAt.slice(0, 10)})`;
      });
      push(focus ? `Relações diretas (${scope.length})` : `Relações (${scope.length})`, rows.join("\n"));
      addCitations(scope.slice(0, 12).map(citeEdge));
      for (const id of new Set(scope.flatMap((e) => [e.source, e.target]))) {
        const n = c.nodes.find((x) => x.id === id);
        if (n) addCitations([citeNode(n)]);
      }
      const weak = scope.filter((e) => e.confidence === "unverified" || e.confidence === "low");
      if (weak.length) push("Atenção", `${weak.length} relação(ões) são hipótese/baixa confiança. Linha pontilhada ou tracejada significa que a conexão não está demonstrada.`);
    }
    return finalize(question, headline, sections, citations, dataUsed, scope.length ? "medium" : "unverified", limitations, actions, knowledgeHits, ctx);
  }

  if (intent === "unverified") {
    const lowNodes = c.nodes.filter((n) => n.confidence === "unverified" || n.confidence === "low" || !n.sources.length);
    const lowEdges = c.edges.filter((e) => e.confidence === "unverified" || e.confidence === "low");
    headline = "Pendências de verificação";
    push("Entidades", lowNodes.length
      ? lowNodes.slice(0, 12).map((n) => `• ${NODE_KIND_LABEL[n.kind]} ${n.title} — ${CONFIDENCE_LABEL[n.confidence]}; fontes: ${n.sources.join(", ") || "nenhuma"}; evidências: ${n.evidenceIds.length}`).join("\n")
      : "Todas as entidades têm fonte e confiança média ou superior.");
    push("Relações", lowEdges.length
      ? lowEdges.slice(0, 10).map((e) => `• ${edgeLabel(c, e.source)} → ${edgeLabel(c, e.target)} (${e.relation}) — ${CONFIDENCE_LABEL[e.confidence]}`).join("\n")
      : "Nenhuma relação em baixa confiança.");
    addCitations([...lowNodes.slice(0, 8).map(citeNode), ...lowEdges.slice(0, 6).map(citeEdge)]);
    actions.push(...searchActions(lowNodes, 3));
    limitations.push("Confiança é uma classificação por regras auditáveis, não uma probabilidade estatística.");
    return finalize(question, headline, sections, citations, dataUsed, "low", limitations, actions, knowledgeHits, ctx);
  }

  if (intent === "gaps") {
    headline = "Lacunas e próximos passos";
    const noSource = c.nodes.filter((n) => !n.sources.length);
    const isolated = c.nodes.filter((n) => !c.edges.some((e) => e.source === n.id || e.target === n.id));
    const noEvidence = c.nodes.filter((n) => !n.evidenceIds.length);
    const pendingPlan = c.plan.filter((s) => !s.done);
    push("O que falta", [
      noSource.length ? `• ${noSource.length} entidade(s) sem fonte registrada: ${noSource.slice(0, 5).map((n) => n.title).join(", ")}.` : "• Toda entidade tem ao menos uma fonte.",
      isolated.length ? `• ${isolated.length} entidade(s) sem conexão: ${isolated.slice(0, 5).map((n) => n.title).join(", ")}.` : "• Nenhuma entidade isolada.",
      noEvidence.length ? `• ${noEvidence.length} entidade(s) sem evidência arquivada.` : "• Todas as entidades têm evidência vinculada.",
      pendingPlan.length ? `• ${pendingPlan.length} etapa(s) do plano pendente(s): ${pendingPlan.slice(0, 4).map((s) => s.label).join(", ")}.` : "• Plano do template concluído.",
      stats.searches === 0 ? "• Nenhuma consulta a fonte externa registrada neste caso." : `• ${stats.searches} consulta(s) registrada(s).`,
    ].join("\n"));
    const targets = [...isolated, ...noSource].filter((n) => SEARCH_TOOL[n.kind]);
    actions.push(...searchActions(targets, 3));
    actions.push({ type: "create_note", body: "Pendências levantadas pelo Life AI:\n" + [noSource.length && `${noSource.length} sem fonte`, isolated.length && `${isolated.length} isoladas`, noEvidence.length && `${noEvidence.length} sem evidência`, pendingPlan.length && `${pendingPlan.length} etapas pendentes`].filter(Boolean).join("; "), reason: "Registrar as lacunas na timeline do caso." });
    addCitations(targets.slice(0, 6).map(citeNode));
    limitations.push("Sugestões apontam lacunas estruturais; a decisão de investigar cada alvo é sua.");
    return finalize(question, headline, sections, citations, dataUsed, "medium", limitations, actions, knowledgeHits, ctx);
  }

  if (intent === "sources") {
    headline = "Proveniência do caso";
    const bySource = new Map<string, number>();
    for (const n of c.nodes) for (const s of n.sources) bySource.set(s, (bySource.get(s) ?? 0) + 1);
    for (const e of c.edges) if (e.sourceLabel) bySource.set(e.sourceLabel, (bySource.get(e.sourceLabel) ?? 0) + 1);
    push("Fontes registradas", bySource.size
      ? [...bySource.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => `• ${s} — ${n} registro(s)`).join("\n")
      : "Nenhuma fonte registrada. Sem fonte, nenhuma conclusão deve ser apresentada como fato.");
    if (mentioned[0]) {
      const n = mentioned[0];
      push(`Sobre ${n.title}`, [
        `Confiança: ${CONFIDENCE_LABEL[n.confidence]}.`,
        `Fontes: ${n.sources.join(", ") || "nenhuma"}.`,
        `Evidências: ${n.evidenceIds.length ? n.evidenceIds.map((id) => c.evidence.find((e) => e.id === id)?.title ?? id).join(", ") : "nenhuma"}.`,
        `Motivo registrado: ${n.description || "não informado"}.`,
      ].join("\n"));
      addCitations([citeNode(n)]);
    }
    if (knowledgeHits.length) push("Metodologia (Life Knowledge)", knowledgeHits.map((h) => `• ${h.docTitle}: ${h.text.slice(0, 220)}…`).join("\n"));
    addCitations(citesKnowledge(knowledgeHits));
    return finalize(question, headline, sections, citations, dataUsed, bySource.size ? "medium" : "unverified", limitations, actions, knowledgeHits, ctx);
  }

  if (intent === "duplicates") {
    const dupes = findDuplicates(c);
    headline = "Verificação de duplicatas";
    push("Resultado", dupes.length
      ? dupes.map((d) => `• ${NODE_KIND_LABEL[d.kind]} “${d.nodes[0].title}” aparece ${d.nodes.length} vezes (${d.nodes.map((n) => n.id).join(", ")}).`).join("\n")
      : "Nenhuma duplicata exata por tipo + valor normalizado. Semelhança de nome não é mesclada automaticamente.");
    limitations.push("A detecção é exata por tipo e valor; variações (http/https, caixa, barra final) já são normalizadas.");
    return finalize(question, headline, sections, citations, dataUsed, "high", limitations, actions, knowledgeHits, ctx);
  }

  if (intent === "timeline") {
    headline = "Histórico do caso";
    const recent = c.timeline.slice(0, 15);
    push("Eventos recentes", recent.length ? recent.map((t) => `• ${new Date(t.at).toLocaleString("pt-BR")} · ${t.title}${t.detail ? ` — ${t.detail}` : ""} (${t.actor})`).join("\n") : "Nenhum evento registrado.");
    limitations.push(`Mostrando ${Math.min(15, c.timeline.length)} de ${c.timeline.length} eventos.`);
    return finalize(question, headline, sections, citations, dataUsed, "high", limitations, actions, knowledgeHits, ctx);
  }

  if (intent === "evidence") {
    headline = "Evidências registradas";
    push("Inventário", c.evidence.length
      ? c.evidence.slice(0, 12).map((e) => `• ${e.title} — ${e.kind}; coletada ${e.collectedAt.slice(0, 10)}; hash ${e.sha256 ? e.sha256.slice(0, 16) + "…" : "não calculado"}; entidades: ${e.nodeIds.length}.`).join("\n")
      : "Nenhuma evidência registrada. Coletas sem evidência permanecem como pistas.");
    if (stats.orphanEvidence) push("Atenção", `${stats.orphanEvidence} evidência(s) sem entidade vinculada.`);
    limitations.push("Hash comprova integridade do arquivo, não veracidade do conteúdo.");
    return finalize(question, headline, sections, citations, dataUsed, c.evidence.length ? "high" : "unverified", limitations, actions, knowledgeHits, ctx);
  }

  if (intent === "compare") {
    const pair = mentioned.slice(0, 2);
    headline = pair.length === 2 ? `${pair[0].title} × ${pair[1].title}` : "Comparação de entidades";
    if (pair.length < 2) {
      push("Preciso de dois alvos", "Cite duas entidades existentes no caso, por exemplo: “compare exemplo.com e 203.0.113.10”.");
    } else {
      const [a, b] = pair;
      const shared = c.edges.filter((e) =>
        (e.source === a.id && e.target === b.id) || (e.source === b.id && e.target === a.id) ||
        (e.source === a.id && e.target === b.id));
      push("Lado a lado", [
        `• ${a.title} — ${NODE_KIND_LABEL[a.kind]}, ${CONFIDENCE_LABEL[a.confidence]}, fontes: ${a.sources.join(", ") || "nenhuma"}, conexões: ${c.edges.filter((e) => e.source === a.id || e.target === a.id).length}.`,
        `• ${b.title} — ${NODE_KIND_LABEL[b.kind]}, ${CONFIDENCE_LABEL[b.confidence]}, fontes: ${b.sources.join(", ") || "nenhuma"}, conexões: ${c.edges.filter((e) => e.source === b.id || e.target === b.id).length}.`,
        shared.length ? `Relação direta registrada: ${shared.map((e) => e.relation).join(", ")}.` : "Nenhuma relação direta registrada entre as duas.",
        a.kind === b.kind ? "Mesmo tipo de entidade: comparação direta de identificadores." : "Tipos diferentes: compare apenas o que cada fonte declara, não equivalente.",
      ].join("\n"));
      addCitations([citeNode(a), citeNode(b), ...shared.map(citeEdge)]);
    }
    limitations.push("Comparação limitada aos campos registrados; ausência de relação não prova ausência de vínculo.");
    return finalize(question, headline, sections, citations, dataUsed, "medium", limitations, actions, knowledgeHits, ctx);
  }

  if (intent === "why") {
    const edge = mentioned.length >= 2
      ? c.edges.find((e) => [e.source, e.target].includes(mentioned[0].id) && [e.source, e.target].includes(mentioned[1].id))
      : mentioned[0] ? c.edges.find((e) => e.source === mentioned[0].id || e.target === mentioned[0].id) : undefined;
    headline = "Justificativa de uma relação";
    if (!edge) {
      push("Nenhuma relação encontrada", "Não existe aresta registrada entre esses elementos. Se você viu uma linha no canvas, selecione a aresta para inspecionar origem e confiança.");
    } else {
      push("Relação", `${edgeLabel(c, edge.source)} → ${edgeLabel(c, edge.target)} · ${edge.relation} · ${CONFIDENCE_LABEL[edge.confidence]}.`);
      push("Por que existe", [
        `Fonte registrada: ${edge.sourceLabel || "não informada"}.`,
        `Descoberta em ${edge.discoveredAt.slice(0, 10)} · origem: ${edge.origin === "user" ? "criada manualmente" : edge.origin === "source" ? "importada de fonte" : "sugerida pela IA"}.`,
        edge.description ? `Descrição: ${edge.description}` : "Sem descrição adicional.",
        edge.evidenceIds.length ? `Evidências: ${edge.evidenceIds.map((id) => c.evidence.find((x) => x.id === id)?.title ?? id).join(", ")}.` : "Sem evidência vinculada — trate como indício.",
        edge.notes ? `Observações: ${edge.notes}` : "",
      ].filter(Boolean).join("\n"));
      addCitations([citeEdge(edge)]);
      if (!edge.evidenceIds.length) limitations.push("A aresta não possui evidência arquivada; confiança limitada.");
    }
    return finalize(question, headline, sections, citations, dataUsed, edge ? edge.confidence : "unverified", limitations, actions, knowledgeHits, ctx);
  }

  if (intent === "confidence") {
    headline = "Como a confiança é classificada";
    push("Regras aplicadas neste caso", [
      `Verificado: ${stats.verified} · Alta: ${stats.high} · Média: ${stats.medium} · Baixa: ${stats.low} · Não verificado: ${stats.unverified}.`,
      "Verificado exige fonte primária + evidência arquivada + duas fontes independentes.",
      "Alta exige múltiplas fontes ou fonte primária com evidência.",
      "Média: uma fonte ou evidência parcial. Baixa: correspondência fraca.",
      "Os níveis são regras auditáveis, não probabilidades.",
    ].join("\n"));
    if (knowledgeHits.length) push("Metodologia", knowledgeHits[0].text.slice(0, 500));
    addCitations(citesKnowledge(knowledgeHits));
    return finalize(question, headline, sections, citations, dataUsed, "high", ["Não há modelo estatístico calibrado; não interprete como probabilidade."], actions, knowledgeHits, ctx);
  }

  if (intent === "entity" && mentioned.length === 0) {
    // No entity mentioned: treat as a knowledge/method question with explicit scope.
    headline = "Resposta baseada na base de conhecimento";
    if (knowledgeHits.length) {
      push("Life Knowledge", knowledgeHits.map((h) => `• ${h.docTitle} — ${h.text.slice(0, 450)}`).join("\n\n"));
      addCitations(citesKnowledge(knowledgeHits));
    } else {
      push("Sem dados para responder", "Não encontrei essa entidade no caso nem um trecho correspondente na base de conhecimento. Informe o nome exato de uma entidade do canvas ou cadastre um documento no AI Knowledge Center.");
    }
    limitations.push("Esta resposta vem de documentação interna, não de uma consulta a fonte externa.");
    return finalize(question, headline, sections, citations, dataUsed, knowledgeHits.length ? "medium" : "unverified", limitations, actions, knowledgeHits, ctx);
  }

  // Entity detail
  const node = mentioned[0];
  headline = `${NODE_KIND_LABEL[node.kind]}: ${node.title}`;
  push("Identificação", [
    `Tipo: ${NODE_KIND_LABEL[node.kind]} · confiança: ${CONFIDENCE_LABEL[node.confidence]}.`,
    node.description || "Sem descrição registrada.",
    node.identifiers.length ? `Identificadores: ${node.identifiers.map((i) => `${i.label}=${i.value}`).join("; ")}.` : "",
    node.tags.length ? `Tags: ${node.tags.join(", ")}.` : "",
  ].filter(Boolean).join("\n"));
  push("Proveniência", `Fontes: ${node.sources.join(", ") || "nenhuma registrada"}. Evidências: ${node.evidenceIds.length}. Última atualização: ${ageDays(node.updatedAt)} dia(s) atrás.`);
  const edges = c.edges.filter((e) => e.source === node.id || e.target === node.id);
  push("Conexões", edges.length
    ? edges.slice(0, 10).map((e) => {
      const other = e.source === node.id ? e.target : e.source;
      const direction = e.source === node.id ? "→" : "←";
      return `• ${direction} ${edgeLabel(c, other)} — ${e.relation} · ${CONFIDENCE_LABEL[e.confidence]} · ${e.sourceLabel || "fonte não informada"}`;
    }).join("\n")
    : "Nenhuma conexão registrada. Expanda a partir de outra entidade ou crie a relação com evidência.");
  addCitations([citeNode(node)]);
  for (const e of edges.slice(0, 8)) addCitations([citeEdge(e)]);
  if (!node.sources.length) limitations.push("Entidade sem fonte registrada; não use como fato.");
  if (!node.evidenceIds.length) limitations.push("Sem evidência arquivada para esta entidade.");
  const tool = SEARCH_TOOL[node.kind];
  if (tool) actions.push({ type: "run_search", tool: tool.tool, value: node.title, reason: `Atualizar ${tool.label} para ${node.title}.` });
  actions.push({ type: "create_note", body: `Análise Life AI sobre ${node.title}:\n${sections.map((s) => `${s.title}: ${s.body}`).join("\n")}`, reason: "Registrar a análise na timeline." });
  return finalize(question, headline, sections, citations, dataUsed, node.confidence, limitations, actions, knowledgeHits, ctx);
}

function finalize(
  question: string,
  headline: string,
  sections: AiAnswer["sections"],
  citations: AiCitation[],
  dataUsed: string[],
  confidence: AiAnswer["confidence"],
  limitations: string[],
  actions: AiAction[],
  knowledgeHits: KnowledgeHit[],
  ctx: AiContext,
): AiAnswer {
  const answer: AiAnswer = {
    id: uid("ai"),
    at: new Date().toISOString(),
    question,
    headline,
    sections,
    citations,
    dataUsed,
    confidence,
    limitations: [...new Set(limitations)],
    actions: dedupeActions(actions),
    knowledgeHits: knowledgeHits.map((h) => ({ docTitle: h.docTitle, category: h.category, excerpt: h.text.slice(0, 240) })),
  };
  if (ctx.memoryNote?.trim()) answer.dataUsed.push(`Memória da investigação: ${ctx.memoryNote.trim()}`);
  return answer;
}

function dedupeActions(actions: AiAction[]): AiAction[] {
  const seen = new Set<string>();
  return actions.filter((a) => {
    const key = JSON.stringify(a);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Deterministic executive summary used by reports. Never fabricates sources. */
export function executiveSummary(c: PaletteCase): string {
  const stats = caseStats(c);
  const topNodes = c.nodes.filter((n) => n.confidence === "verified" || n.confidence === "high").slice(0, 5);
  const lines = [
    `O caso ${c.code} — ${c.title} — reúne ${stats.nodes} entidades, ${stats.edges} relações e ${stats.evidence} evidências, com ${stats.searches} consultas registradas.`,
    c.objective ? `Objetivo: ${c.objective}` : "O objetivo não foi formalmente registrado.",
    stats.verified > 0
      ? `Há ${stats.verified} entidade(s) verificada(s) por fonte primária e ${stats.high} de alta confiança.`
      : "Nenhuma entidade alcançou o nível verificado; os achados permanecem como indícios.",
    topNodes.length ? `Principais achados: ${topNodes.map((n) => `${n.title} (${NODE_KIND_LABEL[n.kind]})`).join("; ")}.` : "Não há achados de alta confiança para destacar.",
    `Cobertura de proveniência: ${stats.coverage}% das entidades possuem fonte ou evidência. ${stats.isolatedNodes} entidade(s) permanecem sem conexão e ${stats.unverifiedEdges} relação(ões) têm confiança baixa ou não verificada.`,
    "As classificações de confiança são regras auditáveis, não probabilidades. Este resumo não afirma identidade, autoria ou intenção.",
  ];
  return lines.join("\n\n");
}

export function nextStepSuggestions(c: PaletteCase): Array<{ text: string; nodeId?: string; tool?: string }> {
  const out: Array<{ text: string; nodeId?: string; tool?: string }> = [];
  for (const n of c.nodes) {
    if (!n.sources.length) out.push({ text: `Registrar fonte para ${n.title}`, nodeId: n.id });
    const tool = SEARCH_TOOL[n.kind];
    if (tool && !c.searches.some((s) => s.query.toLowerCase() === n.title.toLowerCase())) {
      out.push({ text: `Consultar ${tool.label} para ${n.title}`, nodeId: n.id, tool: tool.tool });
    }
    if (n.confidence === "unverified" && n.sources.length) out.push({ text: `Confirmar ${n.title} em uma segunda fonte`, nodeId: n.id });
  }
  if (c.edges.some((e) => e.confidence === "unverified")) out.push({ text: "Revisar relações não verificadas e vincular evidência ou rebaixar para hipótese" });
  if (c.evidence.length === 0 && c.nodes.length > 0) out.push({ text: "Arquivar a primeira evidência (payload/captura/hash)" });
  if (c.plan.some((s) => !s.done)) out.push({ text: "Concluir as etapas pendentes do plano do template" });
  return out.slice(0, 6);
}

export function aiCapabilities(): string[] {
  return [
    "Resumo do caso e descobertas principais",
    "Análise de entidade e proveniência",
    "Conexões e justificativa de relações",
    "Pendências, lacunas e próximos passos",
    "Comparação entre entidades",
    "Consulta à base Life Knowledge com citações",
    "Propostas de ação com confirmação",
  ];
}

export function knowledgeSummary(): string {
  const s = knowledgeStats();
  return `${s.docs} documento(s) · ${s.chunks} trecho(s) indexado(s) · ${Object.keys(s.categories).length} categoria(s).`;
}
