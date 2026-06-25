import { useEffect, useRef, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "ceo" | "admin" | "staff";
export type SubsidiaryKey =
  | "fli" | "studios" | "cruise" | "maldivas" | "college" | "cond" | "camping"
  | "labs" | "theater" | "energy" | "server" | "soccer" | "agency"
  | "lifeplus" | "aircare" | "lifepay";

export type AuthState = {
  user: User | null;
  roles: AppRole[];
  access: SubsidiaryKey[];
  loading: boolean;
  ready: boolean;
  isCeoOrAdmin: boolean;
  hasRole: (r: AppRole) => boolean;
  hasAccess: (s: SubsidiaryKey) => boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

async function loadRolesAndAccess(userId: string) {
  const [{ data: roleRows }, { data: accRows }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("user_subsidiary_access").select("subsidiary").eq("user_id", userId),
  ]);
  const roles = (roleRows ?? []).map((r) => r.role as AppRole);
  const access = (accRows ?? []).map((r) => r.subsidiary as SubsidiaryKey);
  return { roles, access };
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [access, setAccess] = useState<SubsidiaryKey[]>([]);
  const [ready, setReady] = useState(false);
  const lastUserId = useRef<string | null>(null);

  const hydrate = useCallback(async (u: User | null) => {
    if (!u) {
      lastUserId.current = null;
      setUser(null); setRoles([]); setAccess([]);
      setReady(true);
      return;
    }
    // Avoid redundant reloads for the same user (TOKEN_REFRESHED, INITIAL_SESSION).
    if (lastUserId.current === u.id && ready) {
      setUser(u);
      return;
    }
    lastUserId.current = u.id;
    setUser(u);
    const { roles, access } = await loadRolesAndAccess(u.id);
    setRoles(roles);
    setAccess(access);
    setReady(true);
  }, [ready]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await hydrate(data.session?.user ?? null);
  }, [hydrate]);

  useEffect(() => {
    let cancelled = false;
    // Register listener FIRST so we never miss SIGNED_IN, then read current session.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "SIGNED_OUT") {
        hydrate(null);
      } else if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
        hydrate(session?.user ?? null);
      }
      // Ignore TOKEN_REFRESHED to avoid thrash.
    });
    supabase.auth.getSession().then(({ data }) => { if (!cancelled) hydrate(data.session?.user ?? null); });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [hydrate]);

  const isCeoOrAdmin = roles.includes("ceo") || roles.includes("admin");

  return {
    user,
    roles,
    access,
    loading: !ready,
    ready,
    isCeoOrAdmin,
    hasRole: (r) => roles.includes(r),
    hasAccess: (s) => isCeoOrAdmin || access.includes(s),
    signOut: async () => { await supabase.auth.signOut(); },
    refresh,
  };
}
