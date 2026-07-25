import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, notAuthed, ok, supabaseForUser } from "../supabase";

export default defineTool({
  name: "send_message",
  title: "Send message to inbox",
  description:
    "Send a message to the internal Furry's Life Inc. inbox (visible in the staff dashboard).",
  inputSchema: {
    subject: z.string().min(2).describe("Message subject."),
    body: z.string().min(2).describe("Message body."),
    name: z.string().optional().describe("Sender name shown in the inbox."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ subject, body, name }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const email = ctx.getUserEmail() ?? "agent@furrys.life";
    const { data, error } = await supabaseForUser(ctx)
      .from("contact_inbox")
      .insert({ name: name ?? email, email, subject, body })
      .select("id,created_at,subject")
      .maybeSingle();
    if (error) return fail(error.message);
    return ok({ sent: true, message: data }, { message: data ?? undefined });
  },
});
