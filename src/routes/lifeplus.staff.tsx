import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { HmsProvider } from "@/components/lifeplus/hms/data";
import { HmsApp } from "@/components/lifeplus/hms/app";

export const Route = createFileRoute("/lifeplus/staff")({
  head: () => ({
    meta: [
      { title: "Life+ · Sistema de gestão hospitalar RP" },
      { name: "description", content: "Sistema hospitalar de roleplay da Life+: pacientes, prontuários, consultas, documentos, leitos e farmácia." },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap" },
    ],
  }),
  component: LifePlusStaff,
});

function LifePlusStaff() {
  const auth = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!auth.loading && !auth.user) nav({ to: "/auth", search: { redirect: "/lifeplus/staff" } });
  }, [auth.loading, auth.user, nav]);

  if (auth.loading) {
    return (
      <div className="hms flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-[var(--h-muted)]"><Loader2 className="h-4 w-4 animate-spin" />Carregando sistema hospitalar…</div>
      </div>
    );
  }

  if (!auth.user) return null;

  if (!auth.hasAccess("lifeplus")) {
    return (
      <div className="hms flex min-h-screen items-center justify-center p-6 text-center">
        <div className="hms-card max-w-md p-8">
          <div className="text-xl font-semibold">Acesso restrito à equipe Life+</div>
          <p className="mt-2 text-sm text-[var(--h-muted)]">Sua conta não possui acesso ao hospital Life+. Solicite liberação no painel central da Furry's Life Inc.</p>
          <div className="mt-5 flex justify-center gap-2">
            <Link to="/lifeplus" className="hms-btn ghost">Site público</Link>
            <Link to="/staff/dashboard" className="hms-btn">Painel central</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <HmsProvider>
      <HmsApp />
    </HmsProvider>
  );
}
