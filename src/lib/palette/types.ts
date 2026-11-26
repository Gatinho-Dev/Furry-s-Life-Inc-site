/**
 * Life Palette — Visual OSINT investigation model.
 * All content is user/source supplied; nothing here implies ownership.
 */

export type PaletteNodeKind =
  | "domain" | "subdomain" | "ipv4" | "ipv6" | "asn" | "network" | "url"
  | "certificate" | "dns-record" | "username" | "email" | "hash" | "cve"
  | "file" | "document" | "company" | "organization" | "website" | "public-service"
  | "event" | "observation" | "evidence" | "source" | "note"
  | "person" | "phone" | "wallet" | "location" | "social-profile" | "custom";

/** Investigation depth controls how many compatible sources run per entity. */
export type InvestigationDepth = "quick" | "standard" | "deep";

/**
 * Explainable classification of an extracted value. `score` is an operational
 * indicator (0-100) produced by deterministic rules, not a probability.
 */
export type Classification = {
  score: number;
  status: "confirmed" | "probable" | "ambiguous";
  context: string;
  alternates: Array<{ kind: PaletteNodeKind; score: number; why: string }>;
  note?: string;
};

export type CustomFieldType = "text" | "url" | "number" | "date" | "select";

export type CustomEntityType = {
  id: string;
  name: string;
  color: string;
  description: string;
  fields: Array<{ key: string; label: string; type: CustomFieldType; required: boolean; options?: string[] }>;
  relations: string[];
  createdAt: string;
};

export type SourceCategory =
  | "infrastructure" | "registration" | "certificates" | "security"
  | "profiles" | "archives" | "companies" | "search";

export type SearchState =
  | "pending" | "running" | "completed" | "empty" | "rate-limited" | "unavailable" | "error";

export type SearchJob = {
  id: string;
  entityId?: string;
  value: string;
  kind: PaletteNodeKind;
  sourceId: string;
  sourceName: string;
  category: SourceCategory;
  state: SearchState;
  startedAt?: string;
  durationMs: number;
  resultCount: number;
  error?: string;
  reference?: string;
};

export type ConfidenceLevel = "verified" | "high" | "medium" | "low" | "unverified";

export type EdgeStyle = "solid" | "dashed" | "dotted";
export type EdgeOrigin = "user" | "source" | "ai";

export type CaseStatus = "draft" | "active" | "analyzing" | "review" | "completed" | "archived";
export type CasePriority = "low" | "normal" | "high" | "critical";
export type CaseRole = "owner" | "administrator" | "editor" | "viewer";

export type Identifier = { label: string; value: string };

export type PaletteNode = {
  id: string;
  kind: PaletteNodeKind;
  title: string;
  subtitle?: string;
  description: string;
  identifiers: Identifier[];
  properties: Record<string, string>;
  tags: string[];
  confidence: ConfidenceLevel;
  sources: string[];
  evidenceIds: string[];
  classification?: Classification;
  /** Id of a case-defined custom entity type, when kind === "custom". */
  customTypeId?: string;
  groupId?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  createdAt: string;
  updatedAt: string;
};

export type PaletteEdge = {
  id: string;
  source: string;
  target: string;
  relation: string;
  description: string;
  sourceLabel: string;
  confidence: ConfidenceLevel;
  discoveredAt: string;
  observedAt?: string;
  style: EdgeStyle;
  color?: string;
  width?: number;
  directed: boolean;
  notes: string;
  evidenceIds: string[];
  origin: EdgeOrigin;
};

export type PaletteGroup = {
  id: string;
  title: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed: boolean;
};

export type EvidenceKind = "link" | "text" | "file" | "snapshot";

export type PaletteEvidence = {
  id: string;
  title: string;
  description: string;
  kind: EvidenceKind;
  url?: string;
  filename?: string;
  mime?: string;
  size?: number;
  sha256?: string;
  /** Inline text or data URL, kept locally. */
  content?: string;
  source: string;
  collectedAt: string;
  createdAt: string;
  responsible: string;
  nodeIds: string[];
  notes: string;
};

export type PaletteSearchRecord = {
  id: string;
  at: string;
  tool: string;
  source: string;
  query: string;
  queryKind: string;
  status: "ok" | "error" | "empty";
  summary: string;
  resultCount: number;
  durationMs: number;
  error?: string;
  data?: unknown;
};

export type TimelineType =
  | "case" | "entity" | "relationship" | "search" | "evidence" | "note" | "canvas" | "ai" | "report" | "comment";

export type PaletteTimelineEntry = {
  id: string;
  at: string;
  type: TimelineType;
  title: string;
  detail?: string;
  actor: string;
  refId?: string;
};

export type PaletteComment = {
  id: string;
  at: string;
  author: string;
  body: string;
  nodeId?: string;
  edgeId?: string;
  resolved: boolean;
};

export type Participant = { id: string; name: string; role: CaseRole; addedAt: string };

export type PlanStep = {
  id: string;
  label: string;
  hint: string;
  tool?: string;
  done: boolean;
};

export type Viewport = { x: number; y: number; zoom: number };

export type PaletteCase = {
  id: string;
  code: string;
  title: string;
  description: string;
  objective: string;
  owner: string;
  status: CaseStatus;
  priority: CasePriority;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  templateId?: string;
  nodes: PaletteNode[];
  edges: PaletteEdge[];
  groups: PaletteGroup[];
  evidence: PaletteEvidence[];
  searches: PaletteSearchRecord[];
  timeline: PaletteTimelineEntry[];
  notes: { id: string; at: string; author: string; body: string }[];
  comments: PaletteComment[];
  participants: Participant[];
  viewport: Viewport;
  plan: PlanStep[];
  customEntityTypes?: CustomEntityType[];
  shared?: { readOnly: boolean; importedFrom?: string };
};

export type PalettePrefs = {
  nodeSize: "compact" | "regular" | "large";
  density: "comfortable" | "compact";
  edgeStyle: EdgeStyle;
  showMinimap: boolean;
  showGrid: boolean;
  autoLayout: "none" | "hierarchy" | "radial";
  autoSave: boolean;
  confirmDestructive: boolean;
  reduceMotion: boolean;
  analystName: string;
  defaultConfidence: ConfidenceLevel;
};

export type PaletteMemory = {
  global: { id: string; at: string; body: string }[];
  perCase: Record<string, { id: string; at: string; body: string }[]>;
  preferences: string[];
};

export type AiRating = "useful" | "partial" | "incorrect" | "bad-source";

export type AiFeedback = {
  id: string;
  at: string;
  caseId: string;
  messageId: string;
  question: string;
  rating: AiRating;
  note: string;
  reviewed: boolean;
  approved: boolean;
};

export type KnowledgeDoc = {
  id: string;
  title: string;
  category: string;
  source: string;
  license: string;
  addedAt: string;
  updatedAt: string;
  charCount: number;
  chunkCount: number;
  text: string;
  builtIn: boolean;
};

export type KnowledgeChunk = {
  id: string;
  docId: string;
  docTitle: string;
  category: string;
  index: number;
  text: string;
  terms: Record<string, number>;
  length: number;
};

export type AiCitation = { label: string; ref: string; kind: "case" | "source" | "knowledge" | "edge" };

export type AiAction =
  | { type: "add_node"; label: string; kind: PaletteNodeKind; value: string; confidence: ConfidenceLevel; reason: string }
  | { type: "create_edge"; from: string; to: string; relation: string; confidence: ConfidenceLevel; reason: string }
  | { type: "create_note"; body: string; reason: string }
  | { type: "create_group"; title: string; nodeIds: string[]; reason: string }
  | { type: "run_search"; tool: string; value: string; reason: string }
  | { type: "summarize"; reason: string };

export type AiAnswer = {
  id: string;
  at: string;
  question: string;
  headline: string;
  sections: { title: string; body: string }[];
  citations: AiCitation[];
  dataUsed: string[];
  confidence: ConfidenceLevel;
  limitations: string[];
  actions: AiAction[];
  knowledgeHits: { docTitle: string; category: string; excerpt: string }[];
};

export const NODE_KIND_LABEL: Record<PaletteNodeKind, string> = {
  domain: "Domínio",
  subdomain: "Subdomínio",
  ipv4: "IPv4",
  ipv6: "IPv6",
  asn: "ASN",
  network: "Rede / prefixo",
  url: "URL",
  certificate: "Certificado",
  "dns-record": "Registro DNS",
  username: "Username público",
  email: "E-mail público",
  hash: "Hash",
  cve: "CVE",
  file: "Arquivo",
  document: "Documento",
  company: "Empresa",
  organization: "Organização",
  website: "Website",
  "public-service": "Serviço público",
  person: "Pessoa (pública)",
  phone: "Telefone público",
  wallet: "Carteira cripto",
  location: "Localização",
  "social-profile": "Perfil público",
  custom: "Entidade personalizada",
  event: "Evento",
  observation: "Observação",
  evidence: "Evidência",
  source: "Fonte",
  note: "Nota",
};

export const NODE_KIND_GROUP: Record<PaletteNodeKind, "infra" | "identifier" | "org" | "investigation"> = {
  domain: "infra", subdomain: "infra", ipv4: "infra", ipv6: "infra", asn: "infra", network: "infra",
  url: "infra", certificate: "infra", "dns-record": "infra",
  username: "identifier", email: "identifier", hash: "identifier", cve: "identifier", file: "identifier", document: "identifier",
  company: "org", organization: "org", website: "org", "public-service": "org",
  person: "identifier", phone: "identifier", wallet: "identifier", location: "investigation",
  "social-profile": "identifier", custom: "investigation",
  event: "investigation", observation: "investigation", evidence: "investigation", source: "investigation", note: "investigation",
};

export const RELATION_TYPES = [
  "Resolves to", "Hosted on", "Associated with", "Uses certificate", "Subdomain of",
  "Registered by", "Mentions", "References", "Observed in", "Potentially related to",
  "Owns", "Operates", "Announced by", "Shares identifier", "Same infrastructure",
  "Belongs to", "Registered under", "Uses", "Connected through source", "Observed together",
  "Custom relationship",
] as const;

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  verified: "Verificado",
  high: "Alta confiança",
  medium: "Média confiança",
  low: "Baixa confiança",
  unverified: "Não verificado",
};

export const CONFIDENCE_HELP: Record<ConfidenceLevel, string> = {
  verified: "Evidência direta vinda da fonte primária (registro, DNS, CT, API oficial) e registrada no caso.",
  high: "Duas ou mais fontes independentes concordam, ou uma fonte primária com evidência anexada.",
  medium: "Evidência parcial: uma fonte, sem segunda confirmação ou sem evidência anexada.",
  low: "Correspondência fraca (nome/handle parecido) ou resultado ambíguo.",
  unverified: "Ainda não validado; nenhuma fonte ou fonte não confiável.",
};

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  draft: "Rascunho",
  active: "Ativo",
  analyzing: "Em análise",
  review: "Em revisão",
  completed: "Concluído",
  archived: "Arquivado",
};

export const CASE_ROLE_LABEL: Record<CaseRole, string> = {
  owner: "Owner",
  administrator: "Administrador",
  editor: "Editor",
  viewer: "Viewer",
};
