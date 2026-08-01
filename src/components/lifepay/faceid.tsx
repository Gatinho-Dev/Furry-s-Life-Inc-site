import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { ScanFace, Loader2, Trash2, Check, X } from "lucide-react";
import { LpAlert } from "@/components/lifepay/ui";
import {
  lifepayFaceStatus, lifepayFaceEnroll, lifepayFaceVerify, lifepayFaceRemove,
  type FaceIdStatus,
} from "@/lib/lifepay-faceid.functions";
import {
  detectFaceBox, frameToDescriptors, cosine, averageDescriptors,
  FACE_STEPS, FACE_MIN_ENERGY, FACE_FRAMES_PER_SAMPLE, FACE_SCALES,
} from "@/lib/faceid-descriptor";


/* --------------------------------------------------------------- *
 * Liquid Glass                                                     *
 * --------------------------------------------------------------- */
const GLASS_CSS = `
.fid-glass{position:relative;border-radius:28px;overflow:hidden;
  background:linear-gradient(150deg,rgba(255,255,255,.10),rgba(255,255,255,.03) 45%,rgba(255,255,255,.07));
  backdrop-filter:blur(28px) saturate(180%);-webkit-backdrop-filter:blur(28px) saturate(180%);
  border:1px solid rgba(255,255,255,.16);
  box-shadow:0 24px 60px -30px rgba(0,0,0,.9),inset 0 1px 0 rgba(255,255,255,.22),inset 0 -1px 0 rgba(255,255,255,.06);}
.fid-glass::after{content:"";position:absolute;inset:-40% -10% auto -10%;height:70%;pointer-events:none;
  background:radial-gradient(60% 100% at 50% 0%,rgba(255,255,255,.22),transparent 70%);filter:blur(12px);}
.fid-btn{border-radius:999px;backdrop-filter:blur(18px) saturate(170%);-webkit-backdrop-filter:blur(18px) saturate(170%);
  border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.10);transition:transform .18s cubic-bezier(.2,.8,.2,1),background .18s;}
.fid-btn:hover:not(:disabled){background:rgba(255,255,255,.16);transform:translateY(-1px);}
.fid-btn:active:not(:disabled){transform:scale(.97);}
.fid-btn-accent{background:linear-gradient(160deg,rgba(47,227,194,.92),rgba(20,184,148,.85));color:#04211B;border-color:rgba(47,227,194,.5);
  box-shadow:0 16px 34px -18px rgba(47,227,194,.85),inset 0 1px 0 rgba(255,255,255,.4);}
.fid-scrim{position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:1rem;
  background:rgba(6,8,10,.55);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);}
.fid-ring{animation:fid-breathe 3.4s ease-in-out infinite}
@keyframes fid-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.015)}}
@keyframes fid-sweep{0%{transform:translateY(-110%)}100%{transform:translateY(110%)}}
.fid-sweep{position:absolute;left:0;right:0;height:38%;pointer-events:none;
  background:linear-gradient(180deg,transparent,rgba(47,227,194,.35),transparent);animation:fid-sweep 2.2s linear infinite;}
`;

function GlassStyles() {
  return <style dangerouslySetInnerHTML={{ __html: GLASS_CSS }} />;
}

/* --------------------------------------------------------------- *
 * Anel de traços (estilo Apple Face ID)                            *
 * --------------------------------------------------------------- */
function TickRing({ progress, active }: { progress: number; active: boolean }) {
  const total = 60;
  const filled = Math.round(progress * total);
  return (
    <svg viewBox="0 0 200 200" className={`absolute inset-0 h-full w-full ${active ? "fid-ring" : ""}`}>
      {Array.from({ length: total }).map((_, i) => {
        const on = i < filled;
        const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
        const r1 = 82, r2 = 95;
        return (
          <line
            key={i}
            x1={100 + Math.cos(angle) * r1} y1={100 + Math.sin(angle) * r1}
            x2={100 + Math.cos(angle) * r2} y2={100 + Math.sin(angle) * r2}
            stroke={on ? "var(--lp-accent)" : "rgba(255,255,255,.28)"}
            strokeWidth={on ? 4 : 3} strokeLinecap="round"
            style={{ transition: "stroke .25s ease, stroke-width .25s ease" }}
          />
        );
      })}
    </svg>
  );
}

/* --------------------------------------------------------------- *
 * Motor de câmera + escaneamento                                   *
 * --------------------------------------------------------------- */
type Mode = "enroll" | "verify";

function useScanner(mode: Mode, open: boolean) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch {
        setError("Não foi possível acessar a câmera. Permita o acesso e tente novamente.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setReady(false);
    };
  }, [open, mode]);

  /**
   * Uma amostra = média temporal de vários frames, em 3 escalas de recorte.
   * Devolve um vetor por escala (mais robusto a distância/enquadramento).
   */
  const capture = React.useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;
    const perScale: number[][][] = FACE_SCALES.map(() => []);
    for (let i = 0; i < FACE_FRAMES_PER_SAMPLE; i++) {
      const box = await detectFaceBox(video);
      const { vectors, energy } = frameToDescriptors(video, box, canvas);
      if (energy >= FACE_MIN_ENERGY) vectors.forEach((v, s) => perScale[s].push(v));
      if (i < FACE_FRAMES_PER_SAMPLE - 1) await new Promise((r) => setTimeout(r, 110));
    }
    if (perScale[0].length < 2) return null;
    return perScale.map((frames) => averageDescriptors(frames));
  }, []);


  return { videoRef, canvasRef, ready, error, capture };
}

function ScannerOverlay({
  mode, open, onClose, onDone,
}: {
  mode: Mode;
  open: boolean;
  onClose: () => void;
  onDone: (samples: number[][]) => Promise<void>;
}) {
  const { videoRef, canvasRef, ready, error, capture } = useScanner(mode, open);
  const [progress, setProgress] = React.useState(0);
  const [stepIdx, setStepIdx] = React.useState(0);
  const [hint, setHint] = React.useState("Posicione o rosto dentro do círculo");
  const [status, setStatus] = React.useState<"scanning" | "saving" | "ok" | "fail">("scanning");
  const [failMsg, setFailMsg] = React.useState<string | null>(null);

  const totalNeeded = mode === "enroll" ? FACE_STEPS.length : 5;

  React.useEffect(() => {
    if (!open) { setProgress(0); setStepIdx(0); setStatus("scanning"); setFailMsg(null); }
  }, [open]);

  React.useEffect(() => {
    if (!open || !ready || status !== "scanning") return;
    let stop = false;
    const samples: number[][] = [];
    let misses = 0;

    const loop = async () => {
      while (!stop && samples.length < totalNeeded) {
        await new Promise((r) => setTimeout(r, mode === "enroll" ? 420 : 180));
        if (stop) return;
        const v = await capture();
        if (!v) {
          misses++;
          setHint(misses > 4 ? "Rosto não detectado — melhore a iluminação" : "Posicione o rosto dentro do círculo");
          continue;
        }
        // Evita capturar o mesmo frame duas vezes no cadastro (exige variação de ângulo).
        if (mode === "enroll" && samples.length && cosine(v, samples[samples.length - 1]) > 0.995) {
          setHint("Mova a cabeça devagar");

          continue;
        }

        samples.push(v);
        setStepIdx(samples.length);
        setProgress(samples.length / totalNeeded);
        setHint(mode === "enroll"
          ? (FACE_STEPS[Math.min(samples.length, FACE_STEPS.length - 1)] as string)
          : "Analisando...");
      }
      if (stop) return;
      setStatus("saving");
      try {
        await onDone(samples);
        setStatus("ok");
        setTimeout(() => { if (!stop) onClose(); }, 1100);
      } catch (e) {
        setFailMsg(e instanceof Error ? e.message : "Falha na verificação facial.");
        setStatus("fail");
      }
    };
    void loop();
    return () => { stop = true; };
  }, [open, ready, status, mode, totalNeeded, capture, onDone, onClose]);

  if (!open) return null;

  return (
    <div className="fid-scrim" role="dialog" aria-modal="true" aria-label="Face ID">
      <GlassStyles />
      <div className="fid-glass w-full max-w-sm p-6 text-center" style={{ color: "var(--lp-fg)" }}>
        <button onClick={onClose} aria-label="Fechar"
          className="fid-btn absolute right-4 top-4 grid h-9 w-9 place-items-center">
          <X className="h-4 w-4" />
        </button>

        <div className="relative mx-auto mt-2 h-56 w-56">
          <TickRing progress={status === "ok" ? 1 : progress} active={status === "scanning"} />
          <div className="absolute inset-[18%] overflow-hidden rounded-full border"
            style={{ borderColor: "rgba(255,255,255,.22)", background: "rgba(255,255,255,.04)" }}>
            <video ref={videoRef} playsInline muted autoPlay
              className="h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} />
            {status === "scanning" && ready && <div className="fid-sweep" />}
            {status === "ok" && (
              <div className="absolute inset-0 grid place-items-center" style={{ background: "rgba(4,33,27,.55)" }}>
                <Check className="h-12 w-12" style={{ color: "var(--lp-accent)" }} />
              </div>
            )}
            {!ready && !error && (
              <div className="absolute inset-0 grid place-items-center">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />

        <h3 className="mt-5 text-lg font-semibold">
          {mode === "enroll" ? "Configurar o Face ID" : "Confirmar com Face ID"}
        </h3>
        <p className="mx-auto mt-1 max-w-[19rem] text-sm" style={{ color: "var(--lp-fg-2)" }}>
          {error ? error
            : status === "ok" ? (mode === "enroll" ? "Face ID configurado." : "Rosto reconhecido.")
            : status === "saving" ? "Processando..."
            : status === "fail" ? (failMsg ?? "Falha na verificação.")
            : mode === "enroll"
              ? `${hint} · etapa ${Math.min(stepIdx + 1, totalNeeded)} de ${totalNeeded}`
              : hint}
        </p>

        {status === "fail" && (
          <button onClick={() => { setFailMsg(null); setProgress(0); setStepIdx(0); setStatus("scanning"); }}
            className="fid-btn fid-btn-accent mt-5 w-full px-5 py-3 text-sm font-semibold">
            Tentar novamente
          </button>
        )}
        {status !== "fail" && (
          <button onClick={onClose} className="fid-btn mt-5 w-full px-5 py-3 text-sm font-medium">Cancelar</button>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- *
 * Hook público                                                     *
 * --------------------------------------------------------------- */
export function useFaceId() {
  const statusFn = useServerFn(lifepayFaceStatus);
  const enrollFn = useServerFn(lifepayFaceEnroll);
  const verifyFn = useServerFn(lifepayFaceVerify);
  const removeFn = useServerFn(lifepayFaceRemove);

  const [status, setStatus] = React.useState<FaceIdStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [supported, setSupported] = React.useState(true);

  const reload = React.useCallback(async () => {
    try { setStatus(await statusFn({})); } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [statusFn]);

  React.useEffect(() => {
    setSupported(typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia);
    void reload();
  }, [reload]);

  return {
    status, loading, supported,
    enrolled: !!status?.enrolled,
    reload,
    enroll: React.useCallback(async (samples: number[][], label?: string) => {
      await enrollFn({ data: { samples, label } });
      await reload();
    }, [enrollFn, reload]),
    verify: React.useCallback(async (samples: number[][], purpose: string) => {
      await verifyFn({ data: { samples, purpose } });
      await reload();
    }, [verifyFn, reload]),
    remove: React.useCallback(async () => {
      await removeFn({});
      await reload();
    }, [removeFn, reload]),
  };
}

/** Overlay reutilizável para confirmar uma operação com Face ID. */
export function FaceIdConfirm({
  open, purpose, onCancel, onSuccess,
}: { open: boolean; purpose: string; onCancel: () => void; onSuccess: () => void }) {
  const face = useFaceId();
  const done = React.useCallback(async (samples: number[][]) => {
    await face.verify(samples, purpose);
    onSuccess();
  }, [face, purpose, onSuccess]);
  return <ScannerOverlay mode="verify" open={open} onClose={onCancel} onDone={done} />;
}

/* --------------------------------------------------------------- *
 * Card na aba Segurança                                            *
 * --------------------------------------------------------------- */
export function FaceIdCard() {
  const face = useFaceId();
  const [label, setLabel] = React.useState("");
  const [scan, setScan] = React.useState<Mode | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  const onEnroll = React.useCallback(async (samples: number[][]) => {
    await face.enroll(samples, label);
    setLabel(""); setMsg("Face ID configurado com sucesso."); setErr(null);
  }, [face, label]);

  const onVerify = React.useCallback(async (samples: number[][]) => {
    await face.verify(samples, "test");
    setMsg("Rosto reconhecido — Face ID funcionando."); setErr(null);
  }, [face]);

  return (
    <div className="lp-card space-y-4 p-5">
      <GlassStyles />
      <div className="flex items-center gap-2 text-sm font-semibold">
        <ScanFace className="h-4 w-4 lp-accent" /> Face ID do LifePay
      </div>
      <p className="text-xs lp-muted">
        Reconhecimento facial próprio do LifePay: o escaneamento é feito pela câmera aqui no site e o rosto
        vira uma assinatura numérica — nenhuma foto é armazenada. Use-o para confirmar transferências.
      </p>

      {!face.supported && <LpAlert tone="info">Este navegador não permite acesso à câmera.</LpAlert>}
      {err && <LpAlert>{err}</LpAlert>}
      {msg && <LpAlert tone="success">{msg}</LpAlert>}

      {face.status?.stale && (
        <LpAlert tone="info">
          Seu Face ID foi cadastrado numa versão anterior do reconhecimento. Refaça o escaneamento para voltar a usá-lo.
        </LpAlert>
      )}

      {face.loading ? (
        <div className="flex items-center gap-2 text-xs lp-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando...</div>
      ) : face.enrolled ? (
        <div className="lp-card-2 flex items-center justify-between gap-3 p-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{face.status?.device_label}</div>
            <div className="text-[11px] lp-muted">
              {face.status?.samples} amostras · último uso:{" "}
              {face.status?.last_used_at ? new Date(face.status.last_used_at).toLocaleString("pt-BR") : "nunca"}
            </div>
          </div>
          <button className="lp-btn lp-btn-danger px-3 py-1.5 text-xs" disabled={busy}
            onClick={async () => {
              setErr(null); setMsg(null); setBusy(true);
              try { await face.remove(); setMsg("Face ID removido."); }
              catch (e) { setErr(e instanceof Error ? e.message : "Falha ao remover."); }
              finally { setBusy(false); }
            }}>
            <Trash2 className="h-3.5 w-3.5" /> Remover
          </button>
        </div>
      ) : (
        <p className="text-xs lp-muted">Nenhum Face ID configurado neste perfil.</p>
      )}


      <div className="flex flex-col gap-2 sm:flex-row">
        {!face.enrolled && (
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="lp-input sm:flex-1"
            placeholder="Nome do perfil facial (ex.: Rosto do Gatinho)" />
        )}
        <button onClick={() => { setErr(null); setMsg(null); setScan("enroll"); }}
          disabled={!face.supported} className="lp-btn lp-btn-primary">
          <ScanFace className="h-4 w-4" /> {face.enrolled ? "Refazer escaneamento" : "Configurar Face ID"}
        </button>
        {face.enrolled && (
          <button onClick={() => { setErr(null); setMsg(null); setScan("verify"); }} className="lp-btn lp-btn-ghost">
            Testar
          </button>
        )}
      </div>

      <ScannerOverlay mode={scan ?? "enroll"} open={scan !== null} onClose={() => setScan(null)}
        onDone={scan === "verify" ? onVerify : onEnroll} />
    </div>
  );
}
