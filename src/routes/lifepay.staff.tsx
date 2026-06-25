import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LayoutDashboard, CreditCard, Wallet, ShieldCheck, BarChart3, Bell } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { StaffShell, KpiCard, type ShellTab } from "@/components/staff/StaffShell";

export const Route = createFileRoute("/lifepay/staff")({
  head: () => ({ meta: [{ title: "Painel Staff — LifePay" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: LifePayStaff,
});

type TabKey = "dashboard" | "cards" | "pix" | "invest" | "security" | "alerts";

function LifePayStaff() {
  const nav = useNavigate();
  const auth = useAuth();
  const [tab, setTab] = useState<TabKey>("dashboard");

  useEffect(() => { if (!auth.loading && !auth.user) nav({ to: "/auth", search: { redirect: "/lifepay/staff" } }); }, [auth.loading, auth.user, nav]);

  if (auth.loading || !auth.user) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!auth.hasAccess("lifepay")) {
    return <div className="flex min-h-screen items-center justify-center px-4 text-center"><div>
      <div className="font-display text-xl font-semibold">Sem acesso ao LifePay</div>
      <p className="mt-2 text-sm text-muted-foreground">Peça ao CEO/Admin para liberar acesso.</p>
      <Link to="/staff/dashboard" className="mt-4 inline-block text-sm text-primary hover:underline">Voltar ao painel</Link>
    </div></div>;
  }

  const tabs: ShellTab<TabKey>[] = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "cards", label: "Cartões", icon: CreditCard },
    { key: "pix", label: "Pix", icon: Wallet },
    { key: "invest", label: "Investimentos", icon: BarChart3 },
    { key: "security", label: "Segurança", icon: ShieldCheck },
    { key: "alerts", label: "Alertas", icon: Bell },
  ];

  return (
    <StaffShell brand="LifePay" subtitle="Banco digital fictício" tabs={tabs} active={tab} onSelect={setTab}>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Painel LifePay</h1>
          <p className="text-sm text-muted-foreground">Aba: {tabs.find((t) => t.key === tab)?.label}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Clientes ativos" value="12.430" hint="Simulado" icon={Wallet} tone="primary" />
          <KpiCard label="Volume Pix (mês)" value="R$ 8,2M" hint="Simulado" icon={BarChart3} tone="success" />
          <KpiCard label="Cartões emitidos" value="5.218" hint="Simulado" icon={CreditCard} tone="warning" />
          <KpiCard label="Alertas abertos" value={0} icon={ShieldCheck} tone="danger" />
        </div>
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-sm text-muted-foreground">
          LifePay é um projeto fictício da Furry's Life Inc. Nenhuma operação financeira real é processada. Este painel é uma demonstração visual.
        </div>
        <div className="text-center text-xs">
          <Link to="/lifepay" className="text-primary hover:underline">Abrir landing pública do LifePay →</Link>
        </div>
      </div>
    </StaffShell>
  );
}
