export type InvestigationStatus = "draft" | "active" | "under_review" | "completed" | "archived";

export const STATUS_LABELS: Record<InvestigationStatus, string> = {
  draft: "Draft",
  active: "Active",
  under_review: "Under Review",
  completed: "Completed",
  archived: "Archived",
};

export const CONFIDENCE_LABELS: Record<"confirmed" | "probable" | "unconfirmed", string> = {
  confirmed: "Confirmado",
  probable: "Provável",
  unconfirmed: "Não confirmado",
};

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export const ENTITY_LABELS: Record<string, string> = {
  domain: "Domínio",
  subdomain: "Subdomínio",
  ip: "IP",
  asn: "ASN",
  organization: "Organização",
  certificate: "Certificado",
  url: "URL",
  cve: "CVE",
  hash: "Hash",
  username: "Username público",
  email: "E-mail",
  key: "Chave pública",
  person: "Pessoa",
  note: "Nota",
};
