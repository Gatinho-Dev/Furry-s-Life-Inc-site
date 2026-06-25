import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/staff/")({
  head: () => ({ meta: [{ title: "Painel de Staff" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: StaffEntry,
});

function StaffEntry() {
  const nav = useNavigate();
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      nav({ to: data.session ? "/staff/dashboard" : "/auth" });
    });
    return () => { cancelled = true; };
  }, [nav]);
  return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
}
