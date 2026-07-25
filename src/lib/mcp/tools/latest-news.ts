import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

type NewsRow = {
  id: string;
  title: string;
  subtitle: string | null;
  content: string;
  tag: string;
  published: boolean;
  created_at: string;
};

export default defineTool({
  name: "latest_news",
  title: "Latest news",
  description: "Fetch the most recent published news posts from Furry's Life Inc.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe("How many posts to return (1-50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ limit }) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      return { content: [{ type: "text", text: "Backend not configured." }], isError: true };
    }
    const params = new URLSearchParams({
      select: "id,title,subtitle,content,tag,published,created_at",
      published: "eq.true",
      order: "created_at.desc",
      limit: String(limit),
    });

    const res = await fetch(`${url}/rest/v1/news_posts?${params.toString()}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      return {
        content: [{ type: "text", text: `News fetch failed: ${res.status} ${await res.text()}` }],
        isError: true,
      };
    }
    const rows = (await res.json()) as NewsRow[];
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { posts: rows },
    };
  },
});
