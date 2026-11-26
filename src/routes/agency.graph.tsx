import { createFileRoute } from "@tanstack/react-router";
import { Waypoints } from "lucide-react";
import { GraphStudio } from "@/components/agency/GraphStudio";
import { Badge, Notice, PageHeader } from "@/components/agency/kit";

export const Route = createFileRoute("/agency/graph")({
  validateSearch: (s: Record<string, unknown>) => ({ case: typeof s.case === "string" ? s.case : undefined }),
  head: () => ({ meta: [{ title: "Link Analysis — Life Agency" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: GraphPage,
});

function GraphPage() {
  const { case: caseId } = Route.useSearch();
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Workbench · Visual Link Analysis"
        title="Link Analysis"
        subtitle="Grafo de relacionamentos com nós tipados, expansão automática a partir de fontes públicas, painel de detalhes, filtros e exportação em PNG, SVG e JSON."
        actions={<Badge tone="cyan"><Waypoints className="h-3 w-3" /> React Flow</Badge>}
      />
      {caseId && <Notice tone="info">Entidades do caso importadas como nós. Expanda cada nó para descobrir relações reais.</Notice>}
      <GraphStudio caseId={caseId} />
    </div>
  );
}
