import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  FACE_DIM, FACE_MATCH_THRESHOLD, FACE_SINGLE_MIN, cosine, averageDescriptors,
} from "@/lib/faceid-descriptor";


/* ------------------------------------------------------------------ *
 * Face ID do LifePay (reconhecimento facial próprio do site)          *
 * ------------------------------------------------------------------ */

export type FaceIdStatus = {
  enrolled: boolean;
  device_label: string | null;
  created_at: string | null;
  last_used_at: string | null;
  samples: number;
  /** Cadastro feito com uma versão anterior da assinatura — precisa refazer. */
  stale: boolean;
};


function validVectors(v: unknown): number[][] {
  if (!Array.isArray(v) || v.length < 2) throw new Error("Escaneamento incompleto. Refaça o cadastro do Face ID.");
  return v.map((s) => {
    if (!Array.isArray(s) || s.length !== FACE_DIM) throw new Error("Assinatura facial inválida.");
    return s.map((n) => {
      const x = Number(n);
      if (!Number.isFinite(x)) throw new Error("Assinatura facial inválida.");
      return x;
    });
  });
}


export const lifepayFaceStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FaceIdStatus> => {
    const { data } = await (context.supabase as any)
      .from("lifepay_faceid")
      .select("device_label, created_at, last_used_at, samples")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data) return { enrolled: false, device_label: null, created_at: null, last_used_at: null, samples: 0, stale: false };
    const samples: unknown[] = Array.isArray(data.samples) ? data.samples : [];
    return {
      enrolled: true,
      device_label: data.device_label,
      created_at: data.created_at,
      last_used_at: data.last_used_at,
      samples: samples.length,
      stale: !samples.some((s) => Array.isArray(s) && s.length === FACE_DIM),
    };

  });

export const lifepayFaceEnroll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { samples: number[][]; label?: string }) => ({
    samples: validVectors(d?.samples),
    label: (d?.label ?? "").toString().slice(0, 60),
  }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    // Guarda as amostras + o centroide (média): melhora muito o reconhecimento.
    const samples = [...data.samples, averageDescriptors(data.samples)];
    const { error } = await db.from("lifepay_faceid").upsert(
      {
        user_id: context.userId,
        samples,
        device_label: data.label.trim() || "Face ID do LifePay",
        last_used_at: null,
      },
      { onConflict: "user_id" },
    );

    if (error) throw new Error(error.message);

    await db.from("lifepay_audit_logs").insert({
      actor_id: context.userId, actor_kind: "user", action: "faceid_enrolled",
      target_user: context.userId, auth_method: "faceid",
    });
    return { ok: true };
  });

export const lifepayFaceVerify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { samples: number[][]; purpose?: string }) => ({
    samples: validVectors(d?.samples),
    purpose: (d?.purpose ?? "").toString().slice(0, 40),
  }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: row } = await db
      .from("lifepay_faceid").select("id, samples").eq("user_id", context.userId).maybeSingle();
    if (!row) throw new Error("Nenhum Face ID cadastrado neste perfil.");

    const all: number[][] = Array.isArray(row.samples) ? row.samples : [];
    const stored = all.filter((s) => Array.isArray(s) && s.length === FACE_DIM);
    if (!stored.length) {
      throw new Error("Seu Face ID foi cadastrado numa versão anterior. Refaça o escaneamento em Segurança.");
    }

    // Melhor similaridade de cada amostra capturada; considera a média das duas melhores.
    const perProbe = data.samples
      .map((probe) => stored.reduce((m, ref) => Math.max(m, cosine(probe, ref)), -1))
      .sort((a, b) => b - a);
    const top = perProbe.slice(0, 2);
    const best = top.reduce((s, v) => s + v, 0) / top.length;

    await db.from("lifepay_audit_logs").insert({
      actor_id: context.userId, actor_kind: "user",
      action: best >= FACE_MATCH_THRESHOLD ? "faceid_verified" : "faceid_failed",
      target_user: context.userId, target_ref: data.purpose || null, auth_method: "faceid",
    });

    if (best < FACE_MATCH_THRESHOLD) throw new Error("Rosto não reconhecido. Tente novamente com boa iluminação.");

    await db.from("lifepay_faceid").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);
    return { ok: true, score: Number(best.toFixed(4)), method: "faceid" as const };
  });


export const lifepayFaceRemove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { error } = await db.from("lifepay_faceid").delete().eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    await db.from("lifepay_audit_logs").insert({
      actor_id: context.userId, actor_kind: "user", action: "faceid_removed",
      target_user: context.userId, auth_method: "faceid",
    });
    return { ok: true };
  });
