import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

/** Supabase client acting as the signed-in MCP caller (RLS applies as that user). */
export function supabaseForUser(ctx: ToolContext) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Backend not configured.");
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function notAuthed() {
  return {
    content: [{ type: "text" as const, text: "Not authenticated. Connect with your Furry's Life account." }],
    isError: true,
  };
}

export function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export function ok(data: unknown, structured?: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: structured,
  };
}
