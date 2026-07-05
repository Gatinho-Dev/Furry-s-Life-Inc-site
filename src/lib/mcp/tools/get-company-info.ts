import { defineTool } from "@lovable.dev/mcp-js";
import { DISCORD_URL, subsidiaries } from "@/lib/site-data";

export default defineTool({
  name: "get_company_info",
  title: "Get company info",
  description:
    "Return top-level info about Furry's Life Inc.: site URL, Discord invite, and subsidiary count.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const info = {
      name: "Furry's Life Inc.",
      site: "https://furrys.life",
      discord: DISCORD_URL,
      subsidiaryCount: subsidiaries.length,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
      structuredContent: info,
    };
  },
});
