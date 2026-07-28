import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { Fingerprint, Loader2, Trash2 } from "lucide-react";
import { LpAlert } from "@/components/lifepay/ui";
import {
  lifepayBioList, lifepayBioRegisterOptions, lifepayBioRegister,
  lifepayBioAuthOptions, lifepayBioVerify, lifepayBioRemove,
} from "@/lib/lifepay-webauthn.functions";

export type BioDevice = { id: string; device_label: string; created_at: string; last_used_at: string | null };

export function useBiometrics() {
  const list = useServerFn(lifepayBioList);
  const regOpts = useServerFn(lifepayBioRegisterOptions);
  const reg = useServerFn(lifepayBioRegister);
  const authOpts = useServerFn(lifepayBioAuthOptions);
  const verify = useServerFn(lifepayBioVerify);
  const remove = useServerFn(lifepayBioRemove);

  const [devices, setDevices] = React.useState<BioDevice[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [supported, setSupported] = React.useState(false);

  const reload = React.useCallback(async () => {
    try { setDevices(await list({})); } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [list]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const { browserSupportsWebAuthn, platformAuthenticatorIsAvailable } = await import("@simplewebauthn/browser");
      const ok = browserSupportsWebAuthn() && (await platformAuthenticatorIsAvailable().catch(() => false));
      if (alive) setSupported(ok);
    })();
    void reload();
    return () => { alive = false; };
  }, [reload]);

  const register = React.useCallback(async (label?: string) => {
    const { startRegistration } = await import("@simplewebauthn/browser");
    const options = await regOpts({});
    const response = await startRegistration({ optionsJSON: options as any });
    await reg({ data: { response, label } });
    await reload();
  }, [regOpts, reg, reload]);

  const confirm = React.useCallback(async (purpose: string) => {
    const { startAuthentication } = await import("@simplewebauthn/browser");
    const options = await authOpts({});
    const response = await startAuthentication({ optionsJSON: options as any });
    await verify({ data: { response, purpose } });
    await reload();
    return true;
  }, [authOpts, verify, reload]);

  const removeDevice = React.useCallback(async (id: string) => {
    await remove({ data: { id } });
    await reload();
  }, [remove, reload]);

  return { devices, loading, supported, hasBiometrics: devices.length > 0, register, confirm, removeDevice, reload };
}

function errText(e: unknown, fallback: string) {
  const m = e instanceof Error ? e.message : "";
  if (/NotAllowed/i.test(m)) return "Confirmação biométrica cancelada ou não autorizada.";
  return m || fallback;
}

export function BiometricsCard() {
  const bio = useBiometrics();
  const [label, setLabel] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  const doRegister = async () => {
    setErr(null); setMsg(null); setBusy(true);
    try { await bio.register(label); setLabel(""); setMsg("Biometria cadastrada neste dispositivo."); }
    catch (e) { setErr(errText(e, "Não foi possível cadastrar a biometria.")); }
    finally { setBusy(false); }
  };

  const doTest = async () => {
    setErr(null); setMsg(null); setBusy(true);
    try { await bio.confirm("test"); setMsg("Biometria validada com sucesso."); }
    catch (e) { setErr(errText(e, "Falha ao validar a biometria.")); }
    finally { setBusy(false); }
  };

  return (
    <div className="lp-card space-y-4 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Fingerprint className="h-4 w-4 lp-accent" /> Biometria do dispositivo
      </div>
      <p className="text-xs lp-muted">
        Use a digital ou o reconhecimento facial do seu aparelho para confirmar operações no LifePay,
        no lugar da senha ou do PIN. As credenciais ficam no dispositivo — o LifePay guarda apenas a chave pública.
      </p>

      {!bio.supported && <LpAlert tone="info">Este dispositivo ou navegador não oferece biometria compatível.</LpAlert>}
      {err && <LpAlert>{err}</LpAlert>}
      {msg && <LpAlert tone="success">{msg}</LpAlert>}

      {bio.loading ? (
        <div className="flex items-center gap-2 text-xs lp-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando dispositivos...</div>
      ) : bio.devices.length ? (
        <ul className="space-y-2">
          {bio.devices.map((d) => (
            <li key={d.id} className="lp-card-2 flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{d.device_label}</div>
                <div className="text-[11px] lp-muted">
                  Último uso: {d.last_used_at ? new Date(d.last_used_at).toLocaleString("pt-BR") : "nunca"}
                </div>
              </div>
              <button className="lp-btn lp-btn-danger px-3 py-1.5 text-xs" disabled={busy}
                onClick={async () => { setErr(null); setBusy(true); try { await bio.removeDevice(d.id); } catch (e) { setErr(errText(e, "Falha ao remover.")); } finally { setBusy(false); } }}>
                <Trash2 className="h-3.5 w-3.5" /> Remover
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs lp-muted">Nenhum dispositivo biométrico cadastrado.</p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={label} onChange={(e) => setLabel(e.target.value)} className="lp-input sm:flex-1"
          placeholder="Nome do dispositivo (ex.: iPhone do Gatinho)" />
        <button onClick={doRegister} disabled={busy || !bio.supported} className="lp-btn lp-btn-primary">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />} Cadastrar biometria
        </button>
        {bio.hasBiometrics && (
          <button onClick={doTest} disabled={busy} className="lp-btn lp-btn-ghost">Testar</button>
        )}
      </div>
    </div>
  );
}
