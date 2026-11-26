import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Database, Download, Info, Lock, Palette, ShieldCheck, Trash2, User } from "lucide-react";
import { DEFAULT_PREFS, getPrefs, setPrefs, type Prefs } from "@/lib/agency/store";
import { clearActivity, getActivity } from "@/lib/agency/activity";
import { NAV, SOURCES, TOOLS, APP_NAME, APP_SLOGAN, APP_VERSION } from "@/lib/agency/catalog";
import { Badge, Button, Field, Notice, PageHeader, Panel, cx } from "@/components/agency/kit";
import { useAuth } from "@/lib/use-auth";
import { download, formatDate } from "@/lib/agency/format";

export const Route = createFileRoute("/agency/settings")({
  head: () => ({ meta: [{ title: "Settings — Life Agency" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: SettingsPage,
});

const STORAGE_KEYS = ["life-agency.investigations.v1", "life-agency.graphs.v1", "life-agency.prefs.v1", "life-agency.activity.v1", "life-agency.workflows.v1"];

function SettingsPage() {
  const [prefs, setLocalPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const auth = useAuth();
  const [savedFlag, setSavedFlag] = useState<string | null>(null);

  useEffect(() => { setLocalPrefs(getPrefs()); }, []);

  const update = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    setLocalPrefs(next);
    setPrefs(patch);
    setSavedFlag("Preferências salvas");
    setTimeout(() => setSavedFlag(null), 1600);
    if (patch.theme) document.documentElement.dataset.agencyTheme = patch.theme;
  };

  const exportAll = () => {
    const bundle: Record<string, unknown> = {};
    for (const key of STORAGE_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        bundle[key] = raw ? JSON.parse(raw) : null;
      } catch { bundle[key] = null; }
    }
    if (bundle["life-agency.prefs.v1"]) {
      const p = bundle["life-agency.prefs.v1"] as Record<string, unknown>;
      delete p.apiKeys;
      bundle["life-agency.prefs.v1"] = p;
    }
    download(`life-agency-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(bundle, null, 2), "application/json");
  };

  const wipe = () => {
    if (!confirm("Apagar todos os dados locais (investigações, grafos, histórico e preferências)? Chaves de API também serão removidas.")) return;
    for (const key of STORAGE_KEYS) localStorage.removeItem(key);
    location.reload();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Configuração"
        title="Settings"
        subtitle="Identidade, aparência, idioma, privacidade, dados e segurança. Todas as preferências ficam neste dispositivo."
        actions={savedFlag ? <Badge tone="green">{savedFlag}</Badge> : undefined}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Profile" description="Identidade usada no console." icon={<User className="h-3.5 w-3.5" />}>
          <div className="space-y-2 text-[12px]">
            <div className="flex items-center justify-between rounded-lg border border-[var(--ag-border)] px-3 py-2">
              <span className="text-[var(--ag-muted)]">Sessão</span>
              <span>{auth.user ? auth.user.email : "anônima (ferramentas públicas)"}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[var(--ag-border)] px-3 py-2">
              <span className="text-[var(--ag-muted)]">Papéis</span>
              <span>{auth.roles.length ? auth.roles.join(", ") : "—"}</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link to="/auth" search={{ redirect: "/agency/staff" }} className="ag-btn ag-btn-ghost !text-[11px]">Entrar / trocar conta</Link>
              <Link to="/agency/staff" className="ag-btn ag-btn-ghost !text-[11px]">Painel restrito legado</Link>
              {auth.user && <Button size="sm" variant="ghost" onClick={() => void auth.signOut()}>Sair</Button>}
            </div>
            <p className="text-[10.5px] text-[var(--ag-faint)]">
              As ferramentas OSINT usam apenas fontes públicas e não exigem autenticação. A sessão é usada para o painel corporativo restrito.
            </p>
          </div>
        </Panel>

        <Panel title="Appearance" description="Tema escuro operacional. Aplicado imediatamente." icon={<Palette className="h-3.5 w-3.5" />}>
          <div className="grid gap-2 sm:grid-cols-3">
            {([
              { id: "carbon", label: "Carbon", desc: "Preto + ciano" },
              { id: "graphite", label: "Graphite", desc: "Grafite neutro" },
              { id: "midnight", label: "Midnight", desc: "Azul profundo" },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => update({ theme: t.id })}
                className={cx(
                  "rounded-xl border p-3 text-left transition-colors",
                  prefs.theme === t.id ? "border-cyan-400/50 bg-cyan-400/[0.07]" : "border-[var(--ag-border)] hover:border-[var(--ag-border-strong)]",
                )}
              >
                <div className={cx("mb-1.5 h-6 rounded-md border border-white/10", t.id === "carbon" ? "bg-gradient-to-r from-black to-cyan-900" : t.id === "graphite" ? "bg-gradient-to-r from-zinc-800 to-zinc-600" : "bg-gradient-to-r from-slate-950 to-blue-900")} />
                <div className="text-[12px] font-medium">{t.label}</div>
                <div className="text-[10px] text-[var(--ag-faint)]">{t.desc}</div>
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            {([
              { key: "compact", label: "Densidade compacta", desc: "Menos espaçamento entre painéis." },
              { key: "reduceMotion", label: "Reduzir animações", desc: "Desativa transições e pulsos." },
            ] as const).map((o) => (
              <label key={o.key} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--ag-border)] px-3 py-2">
                <span>
                  <span className="block text-[12px]">{o.label}</span>
                  <span className="block text-[10px] text-[var(--ag-faint)]">{o.desc}</span>
                </span>
                <input type="checkbox" checked={prefs[o.key]} onChange={(e) => update({ [o.key]: e.target.checked } as Partial<Prefs>)} />
              </label>
            ))}
          </div>
        </Panel>

        <Panel title="Language" description="Idioma da interface de navegação." icon={<Info className="h-3.5 w-3.5" />}>
          <Field label="Interface" hint="O conteúdo das ferramentas e dos relatórios permanece em português técnico.">
            <select className="ag-select" value={prefs.language} onChange={(e) => update({ language: e.target.value as Prefs["language"] })}>
              <option value="pt-BR">Português (Brasil)</option>
              <option value="en-US">English (US) — navigation labels</option>
            </select>
          </Field>
          <div className="mt-3"><Notice tone="info">A troca de idioma afeta rótulos de navegação do console. Dados e relatórios são gerados no idioma da consulta.</Notice></div>
        </Panel>

        <Panel title="Privacy" description="Preferências de tratamento de dados." icon={<Lock className="h-3.5 w-3.5" />}>
          <div className="space-y-2">
            {([
              { key: "persistResults", label: "Registrar consultas no histórico local", desc: "Ferramenta, entrada, fonte e horário." },
              { key: "blurPii", label: "Desfocar valores sensíveis na tela", desc: "Ofusca campos monoespaçados até passar o mouse." },
            ] as const).map((o) => (
              <label key={o.key} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--ag-border)] px-3 py-2">
                <span>
                  <span className="block text-[12px]">{o.label}</span>
                  <span className="block text-[10px] text-[var(--ag-faint)]">{o.desc}</span>
                </span>
                <input type="checkbox" checked={prefs[o.key]} onChange={(e) => update({ [o.key]: e.target.checked } as Partial<Prefs>)} />
              </label>
            ))}
          </div>
          <div className="mt-3"><Notice tone="ok">Nenhum resultado é enviado ao servidor da plataforma para armazenamento. Consultas saem do servidor apenas para as fontes públicas.</Notice></div>
        </Panel>
      </div>

      <Panel title="API Integrations" description="Chaves opcionais e estado das fontes." icon={<Database className="h-3.5 w-3.5" />}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11.5px] text-[var(--ag-muted)]">
            {Object.keys(prefs.apiKeys).length} chave(s) configurada(s) · {SOURCES.filter((s) => !s.keyEnv).length} fontes sem necessidade de chave.
          </div>
          <Link to="/agency/api" className="ag-btn !text-[11px]">Abrir API Center</Link>
        </div>
      </Panel>

      <Panel title="Data Management" description="Exporte ou apague os dados locais." icon={<Database className="h-3.5 w-3.5" />}>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportAll}><Download className="h-3.5 w-3.5" /> Exportar tudo (JSON)</Button>
          <Button onClick={() => download("life-agency-activity.csv", getActivity().map((e) => `${e.at};${e.tool};${e.input};${e.status};${e.source}`).join("\n"), "text/csv")}>
            <Download className="h-3.5 w-3.5" /> Histórico CSV
          </Button>
          <Button variant="ghost" onClick={() => { if (confirm("Limpar histórico de atividades?")) clearActivity(); }}>Limpar histórico</Button>
          <Button variant="danger" onClick={wipe}><Trash2 className="h-3.5 w-3.5" /> Apagar dados locais</Button>
        </div>
        <p className="mt-2 text-[10.5px] text-[var(--ag-faint)]">
          Exportação inclui investigações, grafos, histórico e preferências (sem chaves de API). Última exportação: {formatDate(new Date().toISOString())}.
        </p>
      </Panel>

      <Panel title="Security" description="Controles ativos nesta plataforma." icon={<ShieldCheck className="h-3.5 w-3.5" />}>
        <div className="grid gap-2 text-[11.5px] leading-relaxed text-[var(--ag-muted)] sm:grid-cols-2">
          <ul className="space-y-1.5">
            <li>• Validação de entrada com Zod em todas as server functions.</li>
            <li>• Proteção SSRF: bloqueio de IPs privados/reservados e revalidação de cada redirecionamento.</li>
            <li>• Rate limiting por IP e por ferramenta no servidor.</li>
            <li>• Timeouts e limite de bytes em todas as requisições de saída.</li>
          </ul>
          <ul className="space-y-1.5">
            <li>• Nenhuma chave de API é embarcada no bundle do cliente.</li>
            <li>• Chaves opcionais ficam no armazenamento local do seu navegador.</li>
            <li>• Nenhum SQL é executado pela plataforma: os dados de trabalho ficam no navegador.</li>
            <li>• Logs de auditoria locais, exportáveis e apagáveis.</li>
          </ul>
        </div>
      </Panel>

      <Panel title="About Life Agency" description="Identidade da plataforma." icon={<Info className="h-3.5 w-3.5" />}>
        <div className="grid gap-3 text-[12px] sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="font-display text-lg font-bold">{APP_NAME} <span className="ag-mono text-[11px] text-[var(--ag-faint)]">v{APP_VERSION}</span></div>
            <div className="text-[11.5px] text-[var(--ag-muted)]">{APP_SLOGAN}</div>
            <div className="text-[11px] text-[var(--ag-faint)]">Categoria: OSINT &amp; Cyber Intelligence</div>
            <div className="text-[11px] text-[var(--ag-faint)]">{NAV.length} módulos · {TOOLS.length} ferramentas integradas · {SOURCES.length} fontes catalogadas</div>
          </div>
          <div className="rounded-xl border border-[var(--ag-border)] p-3 text-[11px] leading-relaxed text-[var(--ag-muted)]">
            Plataforma operada pela Furry&apos;s Life Inc. Uso restrito a informações públicas, dados autorizados e fontes legítimas.
            Não realiza quebra de senhas, invasão de contas, acesso a mensagens privadas, rastreamento clandestino ou exploração de sistemas.
          </div>
        </div>
      </Panel>
    </div>
  );
}
