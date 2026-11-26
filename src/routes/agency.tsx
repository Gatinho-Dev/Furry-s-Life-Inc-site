import { createFileRoute } from "@tanstack/react-router";
import { AgencyShell } from "@/components/agency/Shell";

export const Route = createFileRoute("/agency")({
  head: () => ({
    meta: [
      { title: "Life Agency — OSINT & Cyber Intelligence Platform" },
      { name: "description", content: "Plataforma de OSINT, cyber intelligence e investigação digital com fontes públicas e gratuitas. Intelligence. Investigation. Insight." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Life Agency — OSINT & Cyber Intelligence" },
      { property: "og:description", content: "Intelligence. Investigation. Insight." },
    ],
    links: [
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" },
    ],
  }),
  component: AgencyShell,
});
