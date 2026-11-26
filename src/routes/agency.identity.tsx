import { createFileRoute } from "@tanstack/react-router";
import { Fingerprint } from "lucide-react";
import { IdentitySeed } from "@/components/agency/IdentitySeed";
import { Badge, Notice, PageHeader } from "@/components/agency/kit";
import { SHERLOCK_TOTAL } from "@/lib/agency/identity/quick-sites";

export const Route = createFileRoute("/agency/identity")({
  validateSearch: (s: Record<string, unknown>) => ({
    seed: typeof s.seed === "string" ? s.seed : undefined,
    deep: s.deep === "1" ? ("1" as const) : undefined,
  }),
  head: () => ({ meta: [{ title: "Case Seeder — Life Agency" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: IdentityPage,
});

function IdentityPage() {
  const { seed, deep } = Route.useSearch();
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Workbench · Identity correlation"
        title="Case Seeder"
        subtitle="Uma semente pública vira um caso: presença em centenas de sites, campos que o perfil declara, chaves, contatos e correlações com fonte, data e nível de confiança."
        actions={<Badge tone="green"><Fingerprint className="h-3 w-3" /> sem chave · {SHERLOCK_TOTAL} sites</Badge>}
      />
      <IdentitySeed initialSeed={seed ?? ""} deep={deep === "1"} />
      <Notice tone="info" title="Atribuição, escopo e limites">
        Catálogo de URLs públicas derivado do <a className="ag-link" href="https://github.com/sherlock-project/sherlock" target="_blank" rel="noreferrer">Sherlock Project</a> (MIT).
        A verificação é HTTP direta, sem autenticação. GitHub só devolve e-mail quando ele é público; telefone não é consultado porque não existe fonte pública gratuita e legítima.
        Um mesmo username, avatar ou e-mail é indício, não prova de identidade — a decisão final fica registrada no caso por você.
      </Notice>
    </div>
  );
}
