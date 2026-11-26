/**
 * Life Knowledge — local retrieval base.
 *
 * Retrieval is lexical (BM25) and fully local: there is no embedding model or
 * vector database in this deployment, so the UI must not claim semantic/vector
 * search. Documents are chunked, indexed and cited by title + excerpt.
 */

import { listKnowledge, saveKnowledge, uid } from "./store";
import type { KnowledgeChunk, KnowledgeDoc } from "./types";

export const KNOWLEDGE_CATEGORIES = [
  "OSINT Fundamentals", "Domain Intelligence", "IP Intelligence", "DNS Intelligence",
  "Network Intelligence", "SOCMINT", "WEBINT", "Cyber Threat Intelligence",
  "Vulnerability Intelligence", "Digital Forensics", "Data Analysis", "Link Analysis",
  "Evidence Analysis", "Investigation Methodology",
] as const;

const SEED: Array<{ title: string; category: string; text: string }> = [
  {
    title: "Método de investigação em seis etapas",
    category: "Investigation Methodology",
    text: `1. Definir a pergunta: escreva o que precisa ser respondido e o que está fora do escopo. Uma investigação sem pergunta vira coleta sem direção.
2. Delimitar o alvo e a base legal: apenas informação pública, dados autorizados e fontes que permitem consulta. Registre a autorização quando existir.
3. Coletar com proveniência: para cada dado, guarde URL, data/hora, ferramenta, payload e o que exatamente foi consultado. Sem proveniência o dado não é evidência.
4. Correlacionar sem concluir cedo: identifique identificadores fortes (registro, DNS, certificado, chave) e fracos (nome, avatar, handle). Correlação é hipótese, não identidade.
5. Verificar e classificar: peça confirmação independente. Use níveis explicáveis de confiança e escreva o motivo de cada nível.
6. Relatar com limites: separe fatos verificados, indícios e hipóteses. Declare o que não foi possível confirmar e o que mudaria a conclusão.
Erros comuns: confundir página HTTP 200 com existência de perfil, tratar username igual como mesma pessoa, ignorar data de coleta, e relatar conclusão sem fonte primária.`,
  },
  {
    title: "Fundamentos de OSINT e escopo ético",
    category: "OSINT Fundamentals",
    text: `OSINT é inteligência produzida a partir de informação pública, coletada e analisada com método. Público não significa irrelevante: agregar dados pode criar risco à pessoa, então minimize coleta, evite dados sensíveis e não tente acessar contas, mensagens privadas ou sistemas.
Pilares: (a) proveniência — toda afirmação aponta para uma fonte; (b) independência — duas fontes que copiam a mesma origem contam como uma; (c) temporalidade — o dado vale para a data da coleta; (d) proporcionalidade — colete o necessário para a pergunta.
Nunca: quebrar autenticação, usar credenciais de terceiros, rastrear pessoas de forma clandestina, comprar bases vazadas ou assediar titulares. Quando a pergunta exigir dado privado, o resultado correto é "não disponível em fontes públicas".`,
  },
  {
    title: "Inteligência de domínio: RDAP, DNS e certificados",
    category: "Domain Intelligence",
    text: `Para um domínio, comece pelo registro (RDAP): registrar, datas, status EPP e nameservers. RDAP não mostra o titular quando há redação por privacidade — nesse caso o dado é indisponível, não "oculto por suspeita".
DNS responde o que o domínio declara: A/AAAA (endereços), NS (autoridade), MX (e-mail), TXT (SPF, DKIM, DMARC, verificações). Compare resolvedores independentes (Google, Cloudflare) e registre divergências.
Certificate Transparency (crt.sh) lista certificados emitidos e revela subdomínios. Um subdomínio em CT pode estar expirado; confirme com DNS antes de afirmar que está ativo.
Wayback Machine mostra o que o site publicava antes; compare tecnologias e mudanças de conteúdo.
Não conclua propriedade a partir de IP compartilhado: hospedagem compartilhada e CDN colocam milhares de domínios no mesmo endereço.`,
  },
  {
    title: "Inteligência de IP, ASN e roteamento",
    category: "IP Intelligence",
    text: `Um IP não é uma pessoa. RDAP de IP retorna bloco, organização e contato técnico; Team Cymru e RIPEstat informam ASN e prefixo; PTR sugere hostname, mas é configurável pelo operador.
Verifique: o IP está anunciado? por qual ASN? o prefixo é do provedor ou do cliente? há múltiplos PTRs? A geolocalização de IP é aproximada e frequentemente errada em VPN, CDN e satélite.
Reputação (OTX, URLhaus, AbuseIPDB) é contexto histórico, não prova de autoria. Um IP listado pode ser NAT compartilhado.
Para infraestrutura: agrupe por ASN/prefixo e certificado, não por vizinhança geográfica.`,
  },
  {
    title: "DNS como fonte de evidência",
    category: "DNS Intelligence",
    text: `Consultas DNS são registros datados. Guarde a resposta bruta (JSON/DoH), o resolvedor e o horário. TTL baixo sugere mudança frequente, não necessariamente má intenção.
Registros úteis: A/AAAA para endereços; CNAME para cadeias; MX para provedor de e-mail; TXT para SPF/DKIM/DMARC e verificações de serviço; CAA para emissores permitidos; NS para autoridade.
Divergência entre resolvedores pode indicar cache, anycast ou configuração inconsistente. Não trate uma resposta isolada como verdade global.
DNSSEC válido confirma integridade da resposta, não identidade do dono.`,
  },
  {
    title: "SOCMINT: perfis públicos sem presumir identidade",
    category: "SOCMINT",
    text: `Perfis públicos fornecem handle, nome de exibição, bio, links, avatar, data de criação e contagens. Nenhum desses campos prova que duas contas pertencem à mesma pessoa.
Sinais mais fortes: prova criptográfica (Keybase), link declarado pela própria plataforma, e-mail publicado pelo titular, chave pública compartilhada. Sinais médios: avatar idêntico, bio com mesmos links, histórico temporal coerente. Sinais fracos: handle parecido, nome igual, mesmo tema.
Verifique se o perfil é realmente da pessoa citada: impersonação é comum. Prefira fontes primárias (site oficial, perfil verificado) e registre a data da observação.
Não infira telefone, endereço residencial ou localização em tempo real; não interaja com o titular.`,
  },
  {
    title: "Análise de vínculos (link analysis) sem inflar o grafo",
    category: "Link Analysis",
    text: `Um grafo é um argumento visual. Cada aresta precisa de tipo, direção, fonte, data e confiança. Sem isso, o desenho sugere relações que não existem.
Boas práticas: comece com poucos nós e expanda a partir de evidência; use linhas contínuas apenas para relações demonstradas, tracejadas para prováveis e pontilhadas para hipóteses; evite cruzar fontes diferentes na mesma aresta sem indicar qual sustenta o quê.
Centralidade mostra importância estrutural, não culpa. Componentes isolados podem ser lacunas de coleta. Ciclos podem indicar infraestrutura compartilhada ou apenas CDN.
Antes de concluir, teste a hipótese contrária: qual evidência refutaria esta conexão?`,
  },
  {
    title: "Evidências: coleta, hash e cadeia de custódia",
    category: "Evidence Analysis",
    text: `Evidência é o dado que sustenta uma afirmação, com proveniência reproduzível. Para cada item registre: título, descrição, URL ou arquivo, data da coleta, responsável, hash SHA-256 e entidades relacionadas.
Capture o conteúdo no momento da coleta: páginas mudam. Prefira payload bruto da API, screenshot com data e hash do arquivo. Preserve o original e registre alterações em vez de editar por cima.
Hash prova integridade do arquivo, não veracidade do conteúdo. Uma captura de tela prova o que estava na tela, não que o fato é verdadeiro.
Ao relatar, cite a evidência pelo ID e explique o que ela sustenta e o que ela não sustenta.`,
  },
  {
    title: "Confiança explicável e fontes independentes",
    category: "Data Analysis",
    text: `Classifique cada descoberta com uma justificativa: verificado (fonte primária + evidência arquivada), alta confiança (múltiplas fontes independentes), média (uma fonte ou evidência parcial), baixa (correspondência fraca) e não verificado.
Não apresente esses níveis como probabilidade: são regras auditáveis, não um modelo calibrado.
Independência importa: agregadores que repetem a mesma fonte não são confirmação. Verifique a origem primária.
Registre o que ainda não pode ser confirmado. Uma conclusão honesta com lacunas explícitas vale mais que uma afirmação forte sem base.`,
  },
  {
    title: "Fontes primárias para infraestrutura e ameaças",
    category: "Cyber Threat Intelligence",
    text: `Fontes primárias: RDAP (registro), DNS (declaração do domínio), Certificate Transparency (emissões), RIPEstat (roteamento), NVD (CVE), CISA KEV (exploração conhecida), OSV (ecossistemas).
Fontes comunitárias (OTX, URLhaus, ThreatFox) são pistas, não veredito: verifique o indicador e registre a data do pulso.
Para CVE, leia a descrição oficial, o CVSS e o estado KEV; EPSS é uma estimativa de exploração em 30 dias e não mede impacto no seu ambiente.
Para hashes, metadados públicos não baixam a amostra; nunca execute artefatos coletados.`,
  },
];

const STOP = new Set(
  "a o e de da do das dos em no na nos nas para por com sem sob sobre que qual quais como quando onde porque porquê um uma uns umas ao aos à às é são foi ser estar está estão tem têm há e ou mas se não sim mais menos muito pouco já ainda entre até desde cada todos todas isto isso este esta aquele aquela seu sua seus suas meu minha nosso nossa dos das the and or of to in for on with is are was were this that these those what which how why when where".split(/\s+/),
);

export function normalizeText(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function tokenize(s: string): string[] {
  return normalizeText(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && t.length <= 40 && !STOP.has(t));
}

export function chunkText(text: string, size = 900, overlap = 90): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= size) return [clean];
  const paragraphs = clean.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).length > size && current.trim()) {
      chunks.push(current.trim());
      current = current.slice(-overlap) + "\n\n" + paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
    while (current.length > size * 1.6) {
      chunks.push(current.slice(0, size).trim());
      current = current.slice(size - overlap);
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

const seedSignature = "seed-v1";

function seedDocs(): KnowledgeDoc[] {
  const now = new Date().toISOString();
  return SEED.map((doc, i) => {
    const chunks = chunkText(doc.text);
    return {
      id: `kn-seed-${i}-${seedSignature}`,
      title: doc.title,
      category: doc.category,
      source: "Life Knowledge · documento interno",
      license: "Conteúdo próprio Life Agency",
      addedAt: now,
      updatedAt: now,
      charCount: doc.text.length,
      chunkCount: chunks.length,
      text: doc.text,
      builtIn: true,
    };
  });
}

export function ensureSeedKnowledge(): KnowledgeDoc[] {
  const existing = listKnowledge();
  if (existing.length > 0) return existing;
  const docs = seedDocs();
  saveKnowledge(docs);
  return docs;
}

export function buildChunks(docs: KnowledgeDoc[]): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  for (const doc of docs) {
    chunkText(doc.text).forEach((text, index) => {
      const terms: Record<string, number> = {};
      for (const token of tokenize(text)) terms[token] = (terms[token] ?? 0) + 1;
      chunks.push({
        id: `${doc.id}::${index}`,
        docId: doc.id,
        docTitle: doc.title,
        category: doc.category,
        index,
        text,
        terms,
        length: Object.values(terms).reduce((a, b) => a + b, 0),
      });
    });
  }
  return chunks;
}

let cache: { at: number; docs: KnowledgeDoc[]; chunks: KnowledgeChunk[] } | null = null;

function getIndex(): { chunks: KnowledgeChunk[] } {
  const docs = ensureSeedKnowledge();
  if (cache && Date.now() - cache.at < 5000 && cache.docs.length === docs.length) return cache;
  cache = { at: Date.now(), docs, chunks: buildChunks(docs) };
  return cache;
}

export function invalidateKnowledgeCache(): void { cache = null; }

export function knowledgeStats() {
  const docs = ensureSeedKnowledge();
  const chunks = getIndex().chunks;
  const byCategory: Record<string, number> = {};
  for (const d of docs) byCategory[d.category] = (byCategory[d.category] ?? 0) + 1;
  return {
    docs: docs.length,
    chunks: chunks.length,
    categories: byCategory,
    lastUpdated: docs.map((d) => d.updatedAt).sort().pop() ?? null,
    builtIn: docs.filter((d) => d.builtIn).length,
    uploaded: docs.filter((d) => !d.builtIn).length,
  };
}

export type KnowledgeHit = {
  docId: string;
  docTitle: string;
  category: string;
  text: string;
  score: number;
};

/** BM25 lexical retrieval over local chunks. */
export function retrieve(query: string, k = 4): KnowledgeHit[] {
  const chunks = getIndex().chunks;
  if (!chunks.length) return [];
  const terms = [...new Set(tokenize(query))];
  if (!terms.length) return [];
  const avg = chunks.reduce((sum, c) => sum + c.length, 0) / chunks.length || 1;
  const df = new Map<string, number>();
  for (const term of terms) df.set(term, chunks.filter((c) => c.terms[term]).length);
  const k1 = 1.4;
  const b = 0.75;
  const scored = chunks.map((chunk) => {
    let score = 0;
    for (const term of terms) {
      const freq = chunk.terms[term] ?? 0;
      if (!freq) continue;
      const n = df.get(term) ?? 0;
      const idf = Math.log(1 + (chunks.length - n + 0.5) / (n + 0.5));
      score += idf * ((freq * (k1 + 1)) / (freq + k1 * (1 - b + (b * chunk.length) / avg)));
    }
    return { chunk, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b2) => b2.score - a.score)
    .slice(0, k)
    .map(({ chunk, score }) => ({
      docId: chunk.docId,
      docTitle: chunk.docTitle,
      category: chunk.category,
      text: chunk.text,
      score: Math.round(score * 100) / 100,
    }));
}

/** Extract plain text from an uploaded file. Supports text-like formats only. */
export async function extractDocumentText(file: File): Promise<{ text: string; warning?: string }> {
  const name = file.name.toLowerCase();
  const maxBytes = 2_000_000;
  if (file.size > maxBytes) throw new Error("Arquivo acima de 2 MB. Divida o documento antes de indexar.");
  const raw = await file.text();
  if (name.endsWith(".html") || name.endsWith(".htm")) {
    return { text: raw.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() };
  }
  if (name.endsWith(".json")) {
    try {
      return { text: JSON.stringify(JSON.parse(raw), null, 2) };
    } catch {
      return { text: raw };
    }
  }
  const warning = name.endsWith(".pdf") || name.endsWith(".docx")
    ? "PDF/DOCX não são extraídos localmente nesta versão. Converta para texto/Markdown antes de indexar."
    : undefined;
  return { text: raw, warning };
}

export function makeKnowledgeDoc(input: { title: string; category: string; source: string; text: string }): KnowledgeDoc {
  const now = new Date().toISOString();
  return {
    id: uid("kn"),
    title: input.title,
    category: input.category,
    source: input.source,
    license: "Fornecido pelo usuário",
    addedAt: now,
    updatedAt: now,
    charCount: input.text.length,
    chunkCount: chunkText(input.text).length,
    text: input.text,
    builtIn: false,
  };
}
