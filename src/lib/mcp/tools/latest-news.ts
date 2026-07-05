import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

type NewsRow = {
  id: string;
  title: string;
  slug: string | null;
  excerpt: string | null;
  subsidiary: string | null;
  published_at: string | null;
  created_at: string;
};

export default defineTool({
  name: "latest_news",
  title: "Latest news",
  description:
    "Fetch the most recent published news posts from Furry's Life Inc. Optionally filter by subsidiary key.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe("How many posts to return (1-50)."),
    subsidiary: z
      .string()
      .optional()
      .describe("Optional subsidiary key filter, e.g. 'lifepay', 'aircare'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ limit, subsidiary }) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      return {
        content: [{ type: "text", text: "Backend not configured." }],
        isError: true,
      };
    }
    const params = new URLSearchParams({
      select: "id,title,slug,excerpt,subsidiary,published_at,created_at",
      order: "published_at.desc.nullslast,created_at.desc",
      limit: String(limit),
    });
    if (subsidiary) params.set("subsidiary", `eq.${subsidiary}`);

    const res = await fetch(`${url}/rest/v1/news_posts?${params.toString()}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      return {
        content: [
          { type: "text", text: `News fetch failed: ${res.status} ${await res.text()}` },
        ],
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
