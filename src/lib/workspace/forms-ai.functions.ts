import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TYPES = ["short", "long", "email", "number", "date", "choice", "checkbox", "dropdown", "scale"] as const;

const schema = {
  type: "object", additionalProperties: false, required: ["title", "description", "fields"],
  properties: {
    title: { type: "string" }, description: { type: "string" },
    fields: { type: "array", items: { type: "object", additionalProperties: false, required: ["type", "label", "required", "options"], properties: {
      type: { type: "string", enum: TYPES }, label: { type: "string" }, required: { type: "boolean" },
      options: { type: "array", items: { type: "string" } },
    } } },
  },
};

/** Gera um formulário a partir de uma descrição usando o Lovable AI. */
export const generateFormWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ prompt: z.string().min(3).max(1000) }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("IA não configurada");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Lovable-API-Key": key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions: "Você cria formulários em português brasileiro para o Life Forms. Gere de 4 a 10 perguntas claras. Use options vazio para tipos sem opções.",
        input: data.prompt,
        text: { format: { type: "json_schema", name: "form", strict: true, schema } },
      }),
    });
    if (res.status === 429) throw new Error("Muitas solicitações à IA. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados.");
    if (!res.ok || !res.body) throw new Error("Falha ao gerar com IA");

    let text = "", buf = "";
    const reader = res.body.getReader(); const dec = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() ?? "";
      for (const l of lines) {
        if (!l.startsWith("data:")) continue;
        const p = l.slice(5).trim(); if (!p || p === "[DONE]") continue;
        try { const ev = JSON.parse(p); if (ev.type === "response.output_text.delta") text += ev.delta; } catch { /* ignore */ }
      }
    }
    const out = JSON.parse(text || "{}") as { title: string; description: string; fields: { type: string; label: string; required: boolean; options: string[] }[] };
    return {
      title: String(out.title ?? "Novo formulário"),
      description: String(out.description ?? ""),
      fields: (out.fields ?? []).filter((f) => (TYPES as readonly string[]).includes(f.type)).map((f) => ({
        id: Math.random().toString(36).slice(2, 10), type: f.type, label: f.label, required: !!f.required,
        options: ["choice", "checkbox", "dropdown"].includes(f.type) ? (f.options?.length ? f.options : ["Opção 1"]) : undefined,
        max: f.type === "scale" ? 5 : undefined, showIf: null,
      })),
    };
  });
