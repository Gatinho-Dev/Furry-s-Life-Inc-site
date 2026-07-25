import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, notAuthed, ok, supabaseForUser } from "../supabase";

export default defineTool({
  name: "delete_news_post",
  title: "Delete news post",
  description: "Permanently delete a news post from the Furry's Life Inc. site by its id.",
  inputSchema: { id: z.string().describe("News post id (uuid).") },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const { data, error } = await supabaseForUser(ctx)
      .from("news_posts")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Nothing deleted — check the id or your permissions.");
    return ok({ deleted: data.id }, { deleted: data.id });
  },
});
