import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, ShieldCheck, Timer, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LifePayTheme, LifePayMark, LpAlert, LpSpinner } from "@/components/lifepay/ui";
import { FaceIdConfirm } from "@/components/lifepay/faceid";
import { lifepayGetPaymentRequest, lifepayPayPaymentRequest, type PaymentRequestPublic } from "@/lib/lifepay-pay.functions";
import { lifepayVerifySecret } from "@/lib/lifepay.functions";
import { newIdempotencyKey } from "@/lib/lifepay-client";
import { formatBRL } from "@/lib/lifepay-perms";
import { sfx } from "@/lib/sfx";

export const Route = createFileRoute("/lifepay/pagar/$token")({
  head: () => ({
    meta: [
      { title: "Pagar cobrança — LifePay" },
      { name: "description", content: "Confirme o pagamento de uma cobrança LifePay com valor já definido pelo recebedor." },
      { property: "og:title", content: "Pagar cobrança LifePay" },
      { property: "og:description", content: "Pagamento com valor pré-definido dentro do LifePay." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  ssr: false,
  component: PayPage,
});

function remaining(iso: string): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

function PayPage() {
  const { token } = useParams({ from: "/lifepay/pagar/$token" });
  const nav = useNavigate();
  const get = useServerFn(lifepayGetPaymentRequest);
  const pay = useServerFn(lifepayPayPaymentRequest);
  const verify = useServerFn(lifepayVerifySecret);

  const [req, setReq] = useState<PaymentRequestPublic | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [left, setLeft] = useState(0);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [faceOpen, setFaceOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        sessionStorage.setItem("lp_after_login", `/lifepay/pagar/${token}`);
        nav({ to: "/lifepay/entrar" });
        return;
      }
      try {
        const r = await get({ data: { token } });
        setReq(r);
        setLeft(remaining(r.expires_at));
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Cobrança indisponível.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token, get, nav]);

  useEffect(() => {
    if (!req || req.status !== "pending") return;
    const id = setInterval(() => setLeft(remaining(req.expires_at)), 1000);
    return () => clearInterval(id);
  }, [req]);

  const confirm = async (method: "pin" | "faceid") => {
    if (!req) return;
    setBusy(true); setErr(null);
    try {
      if (method === "pin") await verify({ data: { method: "pin", value: pin } });
      await pay({ data: { token, authMethod: method, idempotencyKey: newIdempotencyKey(), source: "balance" } });
      sfx("money");
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Não foi possível concluir o pagamento.");
      sfx("error");
    } finally { setBusy(false); }
  };

  if (loading) {
    return <LifePayTheme><div className="flex min-h-screen items-center justify-center"><LpSpinner label="Abrindo cobrança..." /></div></LifePayTheme>;
  }

  const expired = req ? req.status === "expired" || (req.status === "pending" && left <= 0) : false;

  return (
    <LifePayTheme>
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
        <div className="mb-6 flex justify-center"><LifePayMark /></div>

        {!req ? (
          <LpAlert>{err ?? "Cobrança não encontrada."}</LpAlert>
        ) : done ? (
          <div className="lp-card animate-scale-in p-7 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--lp-accent)_18%,transparent)]">
              <Check className="h-8 w-8 lp-accent" />
            </div>
            <h1 className="text-xl font-bold">Pagamento concluído</h1>
            <p className="mt-1 text-sm lp-muted">{formatBRL(req.amount)} enviados para {req.receiver_name}.</p>
            <button onClick={() => nav({ to: "/lifepay/app" })} className="lp-btn lp-btn-primary mt-6 w-full">Ir para minha conta</button>
          </div>
        ) : (
          <div className="lp-card space-y-5 p-7">
            <div className="text-center">
              <div className="text-[11px] uppercase tracking-wider lp-muted">Cobrança de</div>
              <div className="mt-0.5 text-base font-semibold">{req.receiver_name}</div>
              <div className="mt-4 text-4xl font-bold tracking-tight">{formatBRL(req.amount)}</div>
              {req.note && <p className="mt-2 text-sm lp-muted">{req.note}</p>}
            </div>

            {req.status === "paid" ? (
              <LpAlert>Esta cobrança já foi paga.</LpAlert>
            ) : req.status === "canceled" ? (
              <LpAlert>Esta cobrança foi cancelada pelo recebedor.</LpAlert>
            ) : expired ? (
              <LpAlert>O link de pagamento expirou. Peça um novo ao recebedor.</LpAlert>
            ) : req.is_own ? (
              <LpAlert>Esta é a sua própria cobrança — compartilhe o link com quem vai pagar.</LpAlert>
            ) : (
              <>
                <div className="lp-card-2 flex items-center justify-center gap-2 p-3 text-sm">
                  <Timer className="h-4 w-4 lp-accent" />
                  Expira em {String(Math.floor(left / 60)).padStart(2, "0")}:{String(left % 60).padStart(2, "0")}
                </div>

                {err && <LpAlert>{err}</LpAlert>}

                <div>
                  <label className="lp-label">PIN de 4 a 6 dígitos</label>
                  <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric" type="password" placeholder="••••" className="lp-input text-center tracking-[0.5em]" />
                </div>

                <button onClick={() => void confirm("pin")} disabled={busy || pin.length < 4} className="lp-btn lp-btn-primary w-full py-3">
                  {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</> : <>Pagar {formatBRL(req.amount)}</>}
                </button>
                <button onClick={() => { setErr(null); setFaceOpen(true); }} disabled={busy} className="lp-btn lp-btn-ghost w-full">
                  <ShieldCheck className="h-4 w-4" /> Confirmar com Face ID
                </button>
                <button onClick={() => nav({ to: "/lifepay/app" })} className="lp-btn lp-btn-soft w-full">
                  <X className="h-4 w-4" /> Cancelar
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <FaceIdConfirm open={faceOpen} purpose="payment_request"
        onCancel={() => setFaceOpen(false)}
        onSuccess={() => { setFaceOpen(false); void confirm("faceid"); }} />
    </LifePayTheme>
  );
}
