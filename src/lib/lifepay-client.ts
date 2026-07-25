import { supabase } from "@/integrations/supabase/client";

export type LifePayAccount = {
  user_id: string;
  full_name: string | null;
  display_name: string;
  email: string | null;
  pix_key: string;
  status: string;
  account_type: string;
  balance: number;
  credit_limit: number;
  closing_day: number;
  due_day: number;
  first_access_done: boolean;
  must_change_password: boolean;
  last_access_at: string | null;
  created_at: string;
};

export type LifePayKey = {
  id: string;
  user_id: string;
  key_type: "email" | "random";
  key_value: string;
  status: "active" | "inactive";
  created_at: string;
};

export type LifePayTx = {
  id: string;
  from_user: string | null;
  to_user: string | null;
  amount: number;
  note: string | null;
  kind: string;
  status: string;
  key_used: string | null;
  auth_method: string | null;
  from_balance_before: number | null;
  from_balance_after: number | null;
  to_balance_before: number | null;
  to_balance_after: number | null;
  receipt_code: string | null;
  created_at: string;
};

const db = supabase as any;

export async function ensureAccount(userId: string): Promise<LifePayAccount> {
  const { data, error } = await db.rpc("ensure_lifepay_account", { _user_id: userId });
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data[0] : data) as LifePayAccount;
}

export async function loadAccount(userId: string): Promise<LifePayAccount | null> {
  const { data, error } = await db.from("lifepay_accounts").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as LifePayAccount | null;
}

export async function loadKeys(userId: string): Promise<LifePayKey[]> {
  const { data, error } = await db.from("lifepay_keys").select("*")
    .eq("user_id", userId).is("deleted_at", null).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as LifePayKey[];
}

export type TxFilters = {
  direction?: "all" | "in" | "out";
  kind?: string;
  from?: string;
  to?: string;
  limit?: number;
};

export async function loadTransactions(userId: string, f: TxFilters = {}): Promise<LifePayTx[]> {
  let q = db.from("lifepay_transactions").select("*").order("created_at", { ascending: false }).limit(f.limit ?? 100);
  if (f.direction === "in") q = q.eq("to_user", userId);
  else if (f.direction === "out") q = q.eq("from_user", userId);
  else q = q.or(`from_user.eq.${userId},to_user.eq.${userId}`);
  if (f.kind && f.kind !== "all") q = q.eq("kind", f.kind);
  if (f.from) q = q.gte("created_at", f.from);
  if (f.to) q = q.lte("created_at", f.to);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as LifePayTx[];
}

export async function counterpartyNames(): Promise<Map<string, string>> {
  const { data } = await db.rpc("lifepay_counterparty_names");
  const map = new Map<string, string>();
  for (const r of (data ?? []) as any[]) map.set(r.user_id, r.display_name);
  return map;
}

export type ResolvedKey = { user_id: string; display_name: string; key_value: string; key_type: string; status: string };

export async function resolveKey(key: string): Promise<ResolvedKey | null> {
  const { data, error } = await db.rpc("lifepay_resolve_key", { _key: key });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as ResolvedKey | null;
}

export async function transfer(args: {
  key: string; amount: number; note?: string; authMethod: string; idempotencyKey: string;
}): Promise<LifePayTx> {
  const { data, error } = await db.rpc("lifepay_transfer_v2", {
    _key: args.key, _amount: args.amount, _note: args.note ?? null,
    _auth_method: args.authMethod, _idem: args.idempotencyKey,
  });
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data[0] : data) as LifePayTx;
}

export async function createRandomKey(): Promise<LifePayKey> {
  const { data, error } = await db.rpc("lifepay_create_random_key");
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data[0] : data) as LifePayKey;
}

export async function updateKey(id: string, action: "delete" | "activate" | "deactivate") {
  const { error } = await db.rpc("lifepay_update_key", { _id: id, _action: action });
  if (error) throw new Error(error.message);
}

export function newIdempotencyKey(): string {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/-/g, "");
}
