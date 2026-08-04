import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  FACE_DIM, FACE_VERSION, FACE_MATCH_THRESHOLD, FACE_SINGLE_MIN,
  cosine, averageDescriptors,
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

/** Formato gravado no banco: { v, s } — versões antigas gravavam só o array. */
type StoredFace = { v: number; s: number[][] };

function readStored(raw: unknown): StoredFace | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as { v?: unknown; s?: unknown };
    const v = Number(o.v);
    const s = Array.isArray(o.s) ? o.s : [];
    const clean = s.filter((x): x is number[] => Array.isArray(x) && x.length === FACE_DIM);
    if (v === FACE_VERSION && clean.length) return { v, s: clean };
    return null;
  }
  return null; // array puro = cadastro legado (incompatível)
}

function countStored(raw: unknown): number {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const s = (raw as { s?: unknown }).s;
    return Array.isArray(s) ? s.length : 0;
  }
  return Array.isArray(raw) ? raw.length : 0;
}

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
    return {
      enrolled: true,
      device_label: data.device_label,
      created_at: data.created_at,
      last_used_at: data.last_used_at,
      samples: countStored(data.samples),
      stale: !readStored(data.samples),
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
    const stored: StoredFace = {
      v: FACE_VERSION,
      s: [...data.samples, averageDescriptors(data.samples)],
    };
    const { error } = await db.from("lifepay_faceid").upsert(
      {
        user_id: context.userId,
        samples: stored,
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

    const enrolled = readStored(row.samples);
    if (!enrolled) {
      throw new Error("Seu Face ID foi cadastrado numa versão anterior. Refaça o escaneamento em Segurança.");
    }
    const stored = enrolled.s;

    // Compara também o centroide das capturas (menos ruído) e usa a média das
    // 3 melhores similaridades, exigindo um mínimo em cada uma delas.
    const probes = [...data.samples, averageDescriptors(data.samples)];
    const perProbe = probes
      .map((probe) => stored.reduce((m, ref) => Math.max(m, cosine(probe, ref)), -1))
      .sort((a, b) => b - a);
    const top = perProbe.slice(0, Math.min(3, perProbe.length));
    const best = top.reduce((s, v) => s + v, 0) / top.length;
    const ok = best >= FACE_MATCH_THRESHOLD && top.every((v) => v >= FACE_SINGLE_MIN);

    await db.from("lifepay_audit_logs").insert({
      actor_id: context.userId, actor_kind: "user",
      action: ok ? "faceid_verified" : "faceid_failed",
      target_user: context.userId, target_ref: data.purpose || null, auth_method: "faceid",
    });

    if (!ok) throw new Error("Rosto não reconhecido. Tente novamente de frente, com boa iluminação.");


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
