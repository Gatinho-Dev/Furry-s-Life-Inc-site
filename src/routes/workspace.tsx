import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/workspace")({
  ssr: false,
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  const auth = useAuth();
  if (!auth.ready) return <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Carregando…</div>;
  if (!auth.user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Furry's Life Inc.</div>
          <h1 className="mt-2 font-display text-2xl font-bold">Life Workspace</h1>
          <p className="mt-2 text-sm text-muted-foreground">Entre com sua conta para acessar seu espaço de trabalho.</p>
          <Link to="/auth" search={{ redirect: typeof window !== "undefined" ? window.location.pathname : "/workspace" }}
            className="mt-6 inline-flex w-full justify-center rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Entrar
          </Link>
        </div>
      </div>
    );
  }
  return (<><Outlet /><Toaster position="bottom-right" richColors /></>);
}
