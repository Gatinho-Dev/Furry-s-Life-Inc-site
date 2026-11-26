import { createFileRoute } from "@tanstack/react-router";
import { PaletteApp, type PaletteView } from "@/components/palette/PaletteApp";

const VIEWS: PaletteView[] = ["overview", "cases", "recent", "shared", "templates", "library", "knowledge", "sources", "ai", "reports", "settings"];

export const Route = createFileRoute("/agency/palette")({
  validateSearch: (s: Record<string, unknown>) => ({
    case: typeof s.case === "string" ? s.case : undefined,
    view: typeof s.view === "string" && VIEWS.includes(s.view as PaletteView) ? (s.view as PaletteView) : undefined,
    share: typeof s.share === "string" ? s.share : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Life Palette — Visual OSINT Investigation Platform" },
      { name: "description", content: "Canvas infinito, casos persistentes, busca multi-fonte, entidades, evidências e Life Intelligence AI. See Connections. Discover Intelligence." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PalettePage,
});

function PalettePage() {
  const { case: caseId, view } = Route.useSearch();
  return <PaletteApp initialCaseId={caseId} initialView={view ?? "overview"} />;
}
