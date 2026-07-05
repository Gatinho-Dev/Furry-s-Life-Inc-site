import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { subsidiaries } from "@/lib/site-data";

export default defineTool({
  name: "list_subsidiaries",
  title: "List subsidiaries",
  description:
    "List every Furry's Life Inc. subsidiary (name, category, description, and internal path when published).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const rows = subsidiaries.map((s) => ({
      key: s.key,
      name: s.name,
      category: s.category,
      description: s.description,
      href: s.href ?? null,
      externalHref: s.externalHref ?? null,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { subsidiaries: rows },
    };
  },
});
