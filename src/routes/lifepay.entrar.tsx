import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, Lock, Mail, ArrowLeft, ScanFace } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LifePayTheme, LifePayMark, LpAlert, DISCLOSURE } from "@/components/lifepay/ui";
import { FaceIdLogin } from "@/components/lifepay/faceid";

export const Route = createFileRoute("/lifepay/entrar")({
  head: () => ({
    meta: [
      { title: "Entrar — LifePay" },
      { name: "description", content: "Acesse sua conta LifePay com e-mail e senha." },
      { property: "og:title", content: "Entrar na sua conta LifePay" },
      { property: "og:description", content: "Área de acesso da plataforma financeira interna LifePay." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LifePayLogin,
});

const LOCK_KEY = "lp_login_lock";
const MAX_TRIES = 5;
const LOCK_MS = 5 * 60 * 1000;

type LockState = { tries: number; until: number };

function readLock(): LockState {
  try { return JSON.parse(localStorage.getItem(LOCK_KEY) ?? "") as LockState; } catch { return { tries: 0, until: 0 }; }
}
function writeLock(s: LockState) { localStorage.setItem(LOCK_KEY, JSON.stringify(s)); }

function LifePayLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [keep, setKeep] = useState(true);
  const [mode, setMode] = useState<"password" | "face">("face");
  const [faceOpen, setFaceOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lockLeft, setLockLeft] = useState(0);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) nav({ to: "/lifepay/app" });
      else setChecking(false);
    });
    return () => { cancelled = true; };
  }, [nav]);

  useEffect(() => {
    const tick = () => {
      const l = readLock();
      setLockLeft(Math.max(0, l.until - Date.now()));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setInfo(null);
    const lock = readLock();
    if (lock.until > Date.now()) {
      setErr("Muitas tentativas. Aguarde para tentar novamente.");
      return;
    }
    if (mode === "face") {
      if (!email.trim()) { setErr("Informe seu e-mail para usar o Face ID."); return; }
      if (keep) localStorage.removeItem("lp_session_only");
      else { localStorage.setItem("lp_session_only", "1"); sessionStorage.setItem("lp_session_alive", "1"); }
      setFaceOpen(true);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) {
        const tries = (lock.tries ?? 0) + 1;
        const next: LockState = tries >= MAX_TRIES ? { tries: 0, until: Date.now() + LOCK_MS } : { tries, until: 0 };
        writeLock(next);
        throw new Error(
          next.until
            ? "Muitas tentativas incorretas. Acesso pausado por 5 minutos."
            : `E-mail ou senha incorretos. Tentativas restantes: ${MAX_TRIES - tries}.`,
        );
      }
      writeLock({ tries: 0, until: 0 });
      if (keep) localStorage.removeItem("lp_session_only");
      else { localStorage.setItem("lp_session_only", "1"); sessionStorage.setItem("lp_session_alive", "1"); }
      nav({ to: "/lifepay/app" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  };

  const recover = async () => {
    setErr(null); setInfo(null);
    if (!email.trim()) { setErr("Informe seu e-mail para receber o link de recuperação."); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) setErr(error.message);
    else setInfo("Se este e-mail tiver uma conta LifePay, enviaremos as instruções de recuperação.");
  };

  if (checking) {
    return <LifePayTheme><div className="flex min-h-screen items-center justify-center"><Loader2 className="h-5 w-5 animate-spin lp-accent" /></div></LifePayTheme>;
  }

  const locked = lockLeft > 0;

  return (
    <LifePayTheme>
      <div className="lp-grid-bg flex min-h-screen flex-col">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
          <Link to="/lifepay" className="inline-flex items-center gap-1.5 text-sm lp-muted hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <LifePayMark />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-14">
          <div className="lp-card lp-fade w-full max-w-md p-7">
            <h1 className="text-2xl font-bold tracking-tight">Entrar na sua conta</h1>
            <p className="mt-1 text-sm lp-muted">
              {mode === "face"
                ? "Use o Face ID do LifePay para entrar sem digitar a senha."
                : "Use o e-mail e a senha da sua conta LifePay."}
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label className="lp-label" htmlFor="lp-email">E-mail</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 lp-muted" />
                  <input id="lp-email" type="email" required autoComplete="email" value={email}
                    onChange={(e) => setEmail(e.target.value)} className="lp-input pl-10" placeholder="voce@empresa.com" />
                </div>
              </div>

              {mode === "password" && (
                <div>
                  <label className="lp-label" htmlFor="lp-pass">Senha</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 lp-muted" />
                    <input id="lp-pass" type={show ? "text" : "password"} required autoComplete="current-password"
                      value={password} onChange={(e) => setPassword(e.target.value)} className="lp-input px-10" placeholder="••••••••" />
                    <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 lp-muted hover:text-white">
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-xs">
                <label className="inline-flex cursor-pointer items-center gap-2 lp-muted">
                  <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="h-3.5 w-3.5 accent-[color:var(--lp-accent)]" />
                  Manter conectado
                </label>
                <button type="button" onClick={recover} className="lp-accent hover:underline">Recuperar senha</button>
              </div>

              {err && <LpAlert>{err}</LpAlert>}
              {info && <LpAlert tone="success">{info}</LpAlert>}
              {locked && <LpAlert tone="info">Tente novamente em {Math.ceil(lockLeft / 1000)}s.</LpAlert>}

              {mode === "password" ? (
                <button type="submit" disabled={loading || locked} className="lp-btn lp-btn-primary w-full py-3">
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Entrando...</> : "Entrar"}
                </button>
              ) : (
                <button type="submit" disabled={locked} className="lp-btn lp-btn-primary w-full py-3">
                  <ScanFace className="h-4 w-4" /> Escanear meu rosto
                </button>
              )}
            </form>

            <div className="mt-4 flex items-center gap-3 text-[11px] lp-muted">
              <span className="h-px flex-1" style={{ background: "rgba(255,255,255,.12)" }} />
              ou
              <span className="h-px flex-1" style={{ background: "rgba(255,255,255,.12)" }} />
            </div>

            <button type="button"
              onClick={() => { setErr(null); setInfo(null); setMode(mode === "face" ? "password" : "face"); }}
              className="lp-btn lp-btn-ghost mt-4 w-full py-3">
              {mode === "face"
                ? <><Lock className="h-4 w-4" /> Entrar com senha</>
                : <><ScanFace className="h-4 w-4" /> Entrar com Face ID</>}
            </button>

            <p className="mt-6 text-center text-xs lp-muted">
              As contas LifePay são criadas por administradores autorizados. Fale com o administrador da sua área.
            </p>
          </div>
        </div>

        <FaceIdLogin
          open={faceOpen}
          email={email.trim().toLowerCase()}
          onCancel={() => setFaceOpen(false)}
          onSuccess={() => { setFaceOpen(false); nav({ to: "/lifepay/app" }); }}
        />


        <div className="px-5 pb-8 text-center text-[11px] lp-muted">{DISCLOSURE}</div>
      </div>
    </LifePayTheme>
  );
}
