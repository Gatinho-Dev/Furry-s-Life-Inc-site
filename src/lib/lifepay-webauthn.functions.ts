import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ------------------------------------------------------------------ *
 * Biometria do dispositivo (WebAuthn / passkey de plataforma)          *
 * ------------------------------------------------------------------ */

async function rp() {
  const { getRequest } = await import("@tanstack/react-start/server");
  const req = getRequest();
  const origin = new URL(req.url).origin;
  const rpID = new URL(origin).hostname;
  return { origin, rpID };
}

const b64 = {
  enc: (u: Uint8Array) => Buffer.from(u).toString("base64url"),
  dec: (s: string) => new Uint8Array(Buffer.from(s, "base64url")),
};

async function putChallenge(userId: string, challenge: string, purpose: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  await db.from("lifepay_webauthn_challenges").delete().eq("user_id", userId).eq("purpose", purpose);
  await db.from("lifepay_webauthn_challenges").insert({
    user_id: userId, challenge, purpose,
    expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
  });
}

async function takeChallenge(userId: string, purpose: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data } = await db.from("lifepay_webauthn_challenges")
    .select("id, challenge, expires_at").eq("user_id", userId).eq("purpose", purpose)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) throw new Error("Sessão de biometria expirada. Tente novamente.");
  await db.from("lifepay_webauthn_challenges").delete().eq("id", data.id);
  if (new Date(data.expires_at).getTime() < Date.now()) throw new Error("Sessão de biometria expirada. Tente novamente.");
  return data.challenge as string;
}

export const lifepayBioList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any)
      .from("lifepay_webauthn_credentials")
      .select("id, device_label, created_at, last_used_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    return (data ?? []) as { id: string; device_label: string; created_at: string; last_used_at: string | null }[];
  });

export const lifepayBioRegisterOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { generateRegistrationOptions } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rpID } = await rp();
    const email = ((context.claims as any)?.email as string | undefined) ?? "usuario";

    const { data: existing } = await (supabaseAdmin as any)
      .from("lifepay_webauthn_credentials").select("credential_id, transports").eq("user_id", context.userId);

    const options = await generateRegistrationOptions({
      rpName: "LifePay",
      rpID,
      userName: email,
      userDisplayName: email,
      attestationType: "none",
      excludeCredentials: (existing ?? []).map((c: any) => ({ id: c.credential_id, transports: c.transports ?? undefined })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
        authenticatorAttachment: "platform",
      },
    });
    await putChallenge(context.userId, options.challenge, "register");
    return options;
  });

export const lifepayBioRegister = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { response: any; label?: string }) => {
    if (!d?.response) throw new Error("Resposta biométrica inválida.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { verifyRegistrationResponse } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { origin, rpID } = await rp();
    const expectedChallenge = await takeChallenge(context.userId, "register");

    const verification = await verifyRegistrationResponse({
      response: data.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) throw new Error("Não foi possível validar a biometria.");

    const cred = verification.registrationInfo.credential;
    const { error } = await (supabaseAdmin as any).from("lifepay_webauthn_credentials").insert({
      user_id: context.userId,
      credential_id: cred.id,
      public_key: b64.enc(cred.publicKey),
      counter: cred.counter ?? 0,
      device_label: (data.label ?? "").trim() || "Este dispositivo",
      transports: cred.transports ?? null,
    });
    if (error) throw new Error(error.message);

    await (supabaseAdmin as any).from("lifepay_audit_logs").insert({
      actor_id: context.userId, actor_kind: "user", action: "biometric_registered",
      target_user: context.userId, auth_method: "biometric",
    });
    return { ok: true };
  });

export const lifepayBioAuthOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { generateAuthenticationOptions } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rpID } = await rp();

    const { data: creds } = await (supabaseAdmin as any)
      .from("lifepay_webauthn_credentials").select("credential_id, transports").eq("user_id", context.userId);
    if (!creds?.length) throw new Error("Nenhuma biometria cadastrada neste perfil.");

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
      allowCredentials: creds.map((c: any) => ({ id: c.credential_id, transports: c.transports ?? undefined })),
    });
    await putChallenge(context.userId, options.challenge, "auth");
    return options;
  });

export const lifepayBioVerify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { response: any; purpose?: string }) => {
    if (!d?.response) throw new Error("Resposta biométrica inválida.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { verifyAuthenticationResponse } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { origin, rpID } = await rp();
    const expectedChallenge = await takeChallenge(context.userId, "auth");

    const { data: row } = await (supabaseAdmin as any)
      .from("lifepay_webauthn_credentials").select("*")
      .eq("user_id", context.userId).eq("credential_id", data.response.id).maybeSingle();
    if (!row) throw new Error("Biometria não reconhecida neste dispositivo.");

    const verification = await verifyAuthenticationResponse({
      response: data.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: row.credential_id,
        publicKey: b64.dec(row.public_key),
        counter: Number(row.counter ?? 0),
        transports: row.transports ?? undefined,
      },
    });
    if (!verification.verified) throw new Error("Biometria não confirmada.");

    await (supabaseAdmin as any).from("lifepay_webauthn_credentials")
      .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
      .eq("id", row.id);

    await (supabaseAdmin as any).from("lifepay_audit_logs").insert({
      actor_id: context.userId, actor_kind: "user", action: "biometric_verified",
      target_user: context.userId, target_ref: data.purpose ?? null, auth_method: "biometric",
    });
    return { ok: true, method: "biometric" as const };
  });

export const lifepayBioRemove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!d?.id) throw new Error("Dispositivo inválido.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("lifepay_webauthn_credentials")
      .delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    await (supabaseAdmin as any).from("lifepay_audit_logs").insert({
      actor_id: context.userId, actor_kind: "user", action: "biometric_removed",
      target_user: context.userId, target_ref: data.id,
    });
    return { ok: true };
  });
