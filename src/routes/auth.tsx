import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Lock, Mail, ShieldCheck, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import symbol from "@/assets/fli-symbol.png.asset.json";

const ALLOWED_REDIRECTS = ["/staff/dashboard", "/agency/staff", "/college/staff", "/cond/staff", "/aircare/staff", "/life-server"];
const safeRedirect = (r?: string) => {
  if (!r || typeof r !== "string") return "/staff/dashboard";
  if (!r.startsWith("/")) return "/staff/dashboard";
  return ALLOWED_REDIRECTS.some((p) => r === p || r.startsWith(p + "/")) ? r : "/staff/dashboard";
};

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ redirect: typeof s.redirect === "string" ? s.redirect : undefined }),
  head: () => ({
    meta: [
      { title: "Acesso — Furry's Life Inc." },
      { name: "description", content: "Entre na sua conta de staff da Furry's Life Inc." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuthPage,
});


function AuthPage() {
  const nav = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const target = safeRedirect(redirect);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) nav({ to: target });
    });
    return () => { cancelled = true; };
  }, [nav, target]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setInfo(null); setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav({ to: target });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}${target}` },
        });
        if (error) throw error;
        if (data.session) {
          nav({ to: target });
        } else {
          const { error: signinErr } = await supabase.auth.signInWithPassword({ email, password });
          if (!signinErr) { nav({ to: target }); return; }
          setInfo("Conta criada. Faça login para continuar.");
          setMode("signin");
        }
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setErr(null);
    try { sessionStorage.setItem("post_login_redirect", target); } catch { /* ignore */ }
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}${target}` });
    if (res.error) setErr(res.error.message);
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
            <div className="relative rounded-2xl border border-border bg-secondary/60 p-3">
              <img src={symbol.url} alt="" className="h-10 w-10" />
              <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary shadow">
                <ShieldCheck className="h-3 w-3 text-primary-foreground" />
              </span>
            </div>
            <h1 className="mt-5 font-display text-2xl font-bold">
              {mode === "signin" ? "Entrar" : "Criar conta"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Acesso interno · Furry's Life Inc.</p>
          </div>

          <button onClick={google} type="button"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary">
            <svg viewBox="0 0 24 24" className="h-4 w-4"><path fill="#EA4335" d="M12 11v3.2h5.3c-.2 1.4-1.7 4-5.3 4-3.2 0-5.8-2.6-5.8-5.9S8.8 6.4 12 6.4c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.6 4 14.5 3 12 3 7 3 3 7 3 12s4 9 9 9c5.2 0 8.6-3.7 8.6-8.8 0-.6-.1-1.1-.2-1.6H12z"/></svg>
            Continuar com Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> ou email <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="voce@empresa.com" />
              </div>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Senha</span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input type={show ? "text" : "password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="••••••" />
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            {err && <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            {info && <div className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm">{info}</div>}

            <button type="submit" disabled={loading}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-70">
              {loading ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>Não tem conta? <button onClick={() => setMode("signup")} className="text-primary hover:underline">Criar conta</button></>
            ) : (
              <>Já tem conta? <button onClick={() => setMode("signin")} className="text-primary hover:underline">Entrar</button></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
