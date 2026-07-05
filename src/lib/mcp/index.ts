import { defineMcp } from "@lovable.dev/mcp-js";
import listSubsidiaries from "./tools/list-subsidiaries";
import getCompanyInfo from "./tools/get-company-info";
import latestNews from "./tools/latest-news";

export default defineMcp({
  name: "furrys-life-mcp",
  title: "Furry's Life Inc. MCP",
  version: "0.1.0",
  instructions:
    "Read-only tools for Furry's Life Inc.: list subsidiaries, get company info (site + Discord), and fetch latest news posts (optionally filtered by subsidiary).",
  tools: [listSubsidiaries, getCompanyInfo, latestNews],
});
