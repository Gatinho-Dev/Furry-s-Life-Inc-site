import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Lock, User, ShieldCheck, ArrowLeft } from "lucide-react";
import symbol from "@/assets/fli-symbol.png.asset.json";

export const Route = createFileRoute("/staff")({
  head: () => ({
    meta: [
      { title: "Painel de Staff — Furry's Life Inc." },
      { name: "description", content: "Acesso restrito ao painel interno da Furry's Life Inc." },
    ],
  }),
  component: StaffLogin,
});

function StaffLogin() {
  const nav = useNavigate();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("fli_staff") === "1") {
      nav({ to: "/staff/dashboard" });
    }
  }, [nav]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(false);
    setLoading(true);
    setTimeout(() => {
      if (user === "Lobo_2033" && pass === "L") {
        sessionStorage.setItem("fli_staff", "1");
        nav({ to: "/staff/dashboard" });
      } else {
        setErr(true);
        setLoading(false);
      }
    }, 700);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute inset-0 bg-grid" aria-hidden />
      <Link to="/" className="absolute left-6 top-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar ao site
      </Link>

      <div className="relative w-full max-w-md">
        <div className="glass-card animate-fade-up rounded-3xl p-8">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <img src={symbol.url} alt="" className="h-14 w-14" />
              <span className="absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary glow-primary">
                <ShieldCheck className="h-3 w-3 text-primary-foreground" />
              </span>
            </div>
            <h1 className="mt-5 font-display text-2xl font-bold">Painel de Staff</h1>
            <p className="mt-1 text-sm text-muted-foreground">Acesso restrito · Furry's Life Inc.</p>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Usuário</span>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={user} onChange={(e) => setUser(e.target.value)} required
                  className="w-full rounded-xl border border-border bg-secondary/40 py-3 pl-10 pr-4 text-sm outline-none transition-colors focus:border-primary focus:bg-secondary/70"
                  placeholder="Digite seu usuário" />
              </div>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Senha</span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input type={show ? "text" : "password"} value={pass} onChange={(e) => setPass(e.target.value)} required
                  className="w-full rounded-xl border border-border bg-secondary/40 py-3 pl-10 pr-10 text-sm outline-none transition-colors focus:border-primary focus:bg-secondary/70"
                  placeholder="••••••" />
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            {err && (
              <div className="animate-fade-up rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Usuário ou senha incorretos.
              </div>
            )}

            <button type="submit" disabled={loading}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 glow-primary disabled:opacity-70">
              {loading ? "Autenticando..." : "Entrar no painel"}
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-xs text-muted-foreground">
            <span className="text-foreground">Demo:</span> usuário <code className="text-primary">Lobo_2033</code> · senha <code className="text-primary">L</code>
          </div>
        </div>
      </div>
    </div>
  );
}
