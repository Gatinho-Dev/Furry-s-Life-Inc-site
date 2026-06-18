import { useEffect, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "ceo" | "admin" | "staff";
export type SubsidiaryKey =
  | "fli" | "studios" | "cruise" | "maldivas" | "college" | "cond" | "camping"
  | "labs" | "theater" | "energy" | "server" | "soccer" | "agency"
  | "lifeplus" | "aircare";

export type AuthState = {
  user: User | null;
  roles: AppRole[];
  access: SubsidiaryKey[];
  loading: boolean;
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
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    const u = data.user ?? null;
    setUser(u);
    if (u) {
      const { roles, access } = await loadRolesAndAccess(u.id);
      setRoles(roles);
      setAccess(access);
    } else {
      setRoles([]);
      setAccess([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (cancelled) return;
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        refresh();
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [refresh]);

  return {
    user,
    roles,
    access,
    loading,
    isCeoOrAdmin: roles.includes("ceo") || roles.includes("admin"),
    hasRole: (r) => roles.includes(r),
    hasAccess: (s) => roles.includes("ceo") || roles.includes("admin") || access.includes(s),
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refresh,
  };
}
