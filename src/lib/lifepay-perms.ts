export const LIFEPAY_PERMISSIONS = [
  { key: "view", label: "Visualizar usuários LifePay" },
  { key: "create", label: "Criar usuários LifePay" },
  { key: "edit", label: "Editar usuários LifePay" },
  { key: "block", label: "Bloquear contas" },
  { key: "transactions", label: "Consultar transações" },
  { key: "balance", label: "Ajustar saldo" },
  { key: "limit", label: "Ajustar limite" },
  { key: "cards", label: "Gerenciar cartões" },
  { key: "keys", label: "Gerenciar chaves" },
  { key: "purchases", label: "Gerenciar compras" },
  { key: "invoices", label: "Gerenciar faturas" },
  { key: "refunds", label: "Realizar estornos" },
  { key: "sessions", label: "Revogar sessões" },
  { key: "biometrics", label: "Revogar reconhecimento facial" },
  { key: "audit", label: "Acessar auditoria LifePay" },
] as const;

export type LifePayPermission = (typeof LIFEPAY_PERMISSIONS)[number]["key"];

export const ACCOUNT_TYPES = [
  { key: "standard", label: "Padrão" },
  { key: "premium", label: "Premium" },
  { key: "corporate", label: "Corporativa" },
] as const;

export const ACCOUNT_STATUS_LABEL: Record<string, string> = {
  active: "Ativa",
  blocked: "Bloqueada",
  closed: "Encerrada",
};

/** Valor em centavos -> "R$ 1.234,56" */
export function formatBRL(cents: number | null | undefined): string {
  const v = (cents ?? 0) / 100;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "1.234,56" | "1234.56" -> centavos */
export function parseBRLToCents(input: string): number {
  const clean = input.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(clean);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}

export function passwordIssues(pw: string): string[] {
  const out: string[] = [];
  if (pw.length < 8) out.push("mínimo de 8 caracteres");
  if (!/[A-Za-z]/.test(pw)) out.push("ao menos uma letra");
  if (!/\d/.test(pw)) out.push("ao menos um número");
  return out;
}
