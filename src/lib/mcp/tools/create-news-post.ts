import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, notAuthed, ok, supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_news_post",
  title: "Create news post",
  description:
    "Publish a news post on the Furry's Life Inc. site (title, optional subtitle, markdown content, tag).",
  inputSchema: {
    title: z.string().min(2).describe("Post headline."),
    content: z.string().min(1).describe("Post body in Markdown."),
    subtitle: z.string().optional().describe("Optional short subtitle."),
    tag: z.string().optional().describe("Category tag, e.g. 'Geral', 'LifePay'."),
    published: z.boolean().optional().describe("Publish immediately (default true)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, content, subtitle, tag, published }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const { data, error } = await supabaseForUser(ctx)
      .from("news_posts")
      .insert({
        title,
        content,
        subtitle: subtitle ?? null,
        tag: tag ?? "Geral",
        published: published ?? true,
        author_id: ctx.getUserId(),
      })
      .select()
      .maybeSingle();
    if (error) return fail(error.message);
    return ok(data, { post: data });
  },
});
