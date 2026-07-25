import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listSubsidiaries from "./tools/list-subsidiaries";
import getCompanyInfo from "./tools/get-company-info";
import latestNews from "./tools/latest-news";
import createNewsPost from "./tools/create-news-post";
import updateNewsPost from "./tools/update-news-post";
import deleteNewsPost from "./tools/delete-news-post";
import sendMessage from "./tools/send-message";
import listMessages from "./tools/list-messages";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "furrys-life-mcp",
  title: "Furry's Life Inc. MCP",
  version: "0.2.0",
  instructions:
    "Tools for Furry's Life Inc. Read: list_subsidiaries, get_company_info, latest_news, list_messages. Write: create_news_post / update_news_post / delete_news_post change the site's news section, and send_message posts to the internal staff inbox. Write tools act as the signed-in user, so permissions follow that account's staff role.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listSubsidiaries,
    getCompanyInfo,
    latestNews,
    listMessages,
    createNewsPost,
    updateNewsPost,
    deleteNewsPost,
    sendMessage,
  ],
});
