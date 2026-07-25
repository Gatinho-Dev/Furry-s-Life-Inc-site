import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, notAuthed, ok, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_messages",
  title: "List inbox messages",
  description: "Read the most recent messages from the internal Furry's Life Inc. inbox.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("How many messages to return (1-50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const { data, error } = await supabaseForUser(ctx)
      .from("contact_inbox")
      .select("id,name,email,subject,body,status,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return fail(error.message);
    return ok(data ?? [], { messages: data ?? [] });
  },
});
