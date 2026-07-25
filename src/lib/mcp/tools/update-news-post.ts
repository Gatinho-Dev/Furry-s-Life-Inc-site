import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, notAuthed, ok, supabaseForUser } from "../supabase";

export default defineTool({
  name: "update_news_post",
  title: "Update news post",
  description: "Edit an existing news post on the Furry's Life Inc. site by its id.",
  inputSchema: {
    id: z.string().describe("News post id (uuid)."),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    content: z.string().optional(),
    tag: z.string().optional(),
    published: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, title, subtitle, content, tag, published }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (title !== undefined) patch.title = title;
    if (subtitle !== undefined) patch.subtitle = subtitle;
    if (content !== undefined) patch.content = content;
    if (tag !== undefined) patch.tag = tag;
    if (published !== undefined) patch.published = published;

    const { data, error } = await supabaseForUser(ctx)
      .from("news_posts")
      .update(patch)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("No post updated — check the id or your permissions.");
    return ok(data, { post: data });
  },
});
