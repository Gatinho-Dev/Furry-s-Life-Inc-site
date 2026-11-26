import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle, ArrowRight, AtSign, Check, CheckCircle2, ChevronRight, Circle, Fingerprint,
  GitBranch, KeyRound, Loader2, Mail, Play, ShieldCheck, Sparkles, X,
} from "lucide-react";
import {
  identityDevto, identityGitlab, identityGithub, identityGravatar, identityHackerNews,
  identityKeybase, identityMastodon, sherlockCatalog, usernameScanBatch,
} from "@/lib/agency/api/identity.functions";
import { POPULAR_SITE_IDS } from "@/lib/agency/identity/quick-sites";
import { confidenceCounts, deriveMatches, mergeSignals, toEntityKind } from "@/lib/agency/identity/correlate";
import type { IdentityConfidence, IdentitySignal, IdentitySourceResult, ScanSiteResult } from "@/lib/agency/identity/types";
import { addEntity, addEvidence, addNote, createInvestigation } from "@/lib/agency/store";
import { ENTITY_LABELS } from "@/lib/agency/types";
import { Badge, Button, Empty, Field, Notice, Panel, cx, errorMessage } from "./kit";

const BATCH = 20;

type StepId = "presence" | "profiles" | "contacts" | "hop";
type Step = { id: StepId; label: string; hint: string; state: "idle" | "running" | "done" | "error" | "skipped"; detail?: string };

const STEP_LABEL: Record<StepId, string> = {
  presence: "Presença pública",
  profiles: "Perfis declarados",
  contacts: "Contatos públicos",
  hop: "Segundo salto",
};

const TONE: Record<IdentityConfidence, "green" | "amber" | "neutral"> = {
  confirmed: "green", probable: "amber", unconfirmed: "neutral",
};

const CONF_LABEL: Record<IdentityConfidence, string> = {
  confirmed: "confirmado", probable: "provável", unconfirmed: "não confirmado",
};

export function IdentitySeed({ initialSeed = "", deep = false }: { initialSeed?: string; deep?: boolean }) {
  const navigate = useNavigate();
  const [seed, setSeed] = useState(initialSeed);
  const [kind, setKind] = useState<"username" | "email" | "other">(() => guessKind(initialSeed));
  const [catalog, setCatalog] = useState<{ total: number; ids: string[] } | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [scan, setScan] = useState<{ done: number; total: number; found: number; blocked: number; sites: ScanSiteResult[] }>({ done: 0, total: 0, found: 0, blocked: 0, sites: [] });
  const [sources, setSources] = useState<IdentitySourceResult[]>([]);
  const [signals, setSignals] = useState<IdentitySignal[]>([]);
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [scope, setScope] = useState<"quick" | "all">(deep ? "all" : "quick");
  const stopRef = useRef(false);
  const autoRan = useRef(false);
  const popular = useMemo(() => new Set(POPULAR_SITE_IDS), []);

  useEffect(() => {
    sherlockCatalog({ data: {} }).then((c) => setCatalog({ total: c.total, ids: c.ids })).catch(() => setCatalog(null));
  }, []);

  useEffect(() => {
    setSeed(initialSeed);
    setKind(guessKind(initialSeed));
  }, [initialSeed]);

  useEffect(() => {
    if (initialSeed && deep && catalog && !autoRan.current) {
      autoRan.current = true;
      void run(initialSeed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, initialSeed, deep]);

  const setStep = (id: StepId, patch: Partial<Step>) =>
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const startSteps = (): Step[] => [
    { id: "presence", label: STEP_LABEL.presence, hint: "perfis públicos por username", state: "idle" },
    { id: "profiles", label: STEP_LABEL.profiles, hint: "campos que o próprio perfil publica", state: "idle" },
    { id: "contacts", label: STEP_LABEL.contacts, hint: "e-mails, sites e chaves", state: "idle" },
    { id: "hop", label: STEP_LABEL.hop, hint: "e-mail → Gravatar", state: "idle" },
  ];

  const run = async (override?: string) => {
    const raw = (override ?? seed).trim();
    if (!raw || running) return;
    const detected = guessKind(raw);
    setKind(detected); setSeed(raw);
    setRunning(true); setError(null); setCreated(null); setSignals([]); setSources([]); setDecisions({});
    setScan({ done: 0, total: 0, found: 0, blocked: 0, sites: [] });
    setSteps(startSteps());
    stopRef.current = false;

    const collectedSources: IdentitySourceResult[] = [];
    const flush = () => {
      setSources([...collectedSources]);
      setSignals(mergeSignals(collectedSources));
    };

    try {
      if (detected === "username") {
        const handle = raw.replace(/^@/, "");
        const ids = catalog ? (scope === "quick" ? catalog.ids.filter((id) => popular.has(id)) : catalog.ids) : [];

        setStep("presence", { state: "running", detail: `${ids.length} sites` });
        const sites: ScanSiteResult[] = [];
        for (let i = 0; i < ids.length; i += BATCH) {
          if (stopRef.current) break;
          const chunk = ids.slice(i, i + BATCH);
          const res = await usernameScanBatch({ data: { username: handle, siteIds: chunk } });
          sites.push(...res.results);
          setScan({
            done: Math.min(i + chunk.length, ids.length), total: ids.length,
            found: sites.filter((s) => s.status === "found").length,
            blocked: sites.filter((s) => s.status === "blocked").length,
            sites: [...sites],
          });
        }
        setStep("presence", {
          state: sites.length ? "done" : "skipped",
          detail: `${sites.filter((s) => s.status === "found").length} encontrados · ${sites.filter((s) => s.status === "blocked").length} bloqueados`,
        });
        collectedSources.push({
          id: "sherlock", name: "Presença pública (Sherlock)", ok: sites.length > 0,
          note: sites.length ? undefined : "Varredura não executada.",
          profiles: [], signals: sites.filter((s) => s.status === "found").map((s) => ({
            id: `presence:${s.id}`, kind: "url" as const, value: s.url, label: s.name,
            source: "Sherlock (MIT)", sourceId: "sherlock", url: s.url,
            confidence: "unconfirmed" as const,
            reason: `Página pública respondeu 200 em ${s.name}. Confirme o perfil antes de vincular.`, at: new Date().toISOString(),
          })),
          raw: sites,
        });
        flush();

        setStep("profiles", { state: "running" });
        const calls = [
          ["GitHub", () => identityGithub({ data: { username: handle } })],
          ["Keybase", () => identityKeybase({ data: { username: handle } })],
          ["Hacker News", () => identityHackerNews({ data: { username: handle } })],
          ["Mastodon", () => identityMastodon({ data: { username: handle } })],
          ["GitLab", () => identityGitlab({ data: { username: handle } })],
          ["dev.to", () => identityDevto({ data: { username: handle } })],
        ] as const;
        const settled = await Promise.allSettled(calls.map(([, fn]) => fn()));
        settled.forEach((result, index) => {
          const name = calls[index][0];
          if (result.status === "fulfilled") collectedSources.push(result.value);
          else collectedSources.push({ id: name.toLowerCase().replace(/\W+/g, "-"), name, ok: false, note: errorMessage(result.reason), profiles: [], signals: [] });
        });
        flush();
        const profileCount = collectedSources.reduce((n, s) => n + s.profiles.length, 0);
        setStep("profiles", { state: profileCount ? "done" : "error", detail: `${profileCount} perfis` });

        setStep("contacts", { state: "running" });
        const emails = new Set(mergeSignals(collectedSources).filter((s) => s.kind === "email").map((s) => s.value));
        setStep("contacts", { state: emails.size ? "done" : "skipped", detail: emails.size ? `${emails.size} e-mail(s)` : "nenhum e-mail publicado" });

        if (emails.size) {
          setStep("hop", { state: "running" });
          const targets = [...emails].slice(0, 2);
          const gravatars = await Promise.allSettled(targets.map((email) => identityGravatar({ data: { email } })));
          gravatars.forEach((result) => { if (result.status === "fulfilled") collectedSources.push(result.value); });
          flush();
          const ok = gravatars.filter((r) => r.status === "fulfilled" && r.value.ok).length;
          setStep("hop", { state: ok ? "done" : "skipped", detail: ok ? `${ok} perfil(is) Gravatar` : "sem perfil Gravatar" });
        } else {
          setStep("hop", { state: "skipped", detail: "sem e-mail público" });
        }
      } else {
        setStep("presence", { state: "skipped", detail: "aplicável a username" });
        setStep("profiles", { state: "running" });
        if (detected === "email") {
          const gravatar = await identityGravatar({ data: { email: raw } });
          collectedSources.push(gravatar);
          flush();
          setStep("profiles", { state: gravatar.ok ? "done" : "error", detail: gravatar.ok ? "Gravatar público" : gravatar.note });
        } else {
          setStep("profiles", { state: "skipped", detail: "semente sem varredura automática" });
        }
        setStep("contacts", { state: collectedSources.some((s) => s.signals.some((x) => x.kind === "email")) ? "done" : "skipped" });
        setStep("hop", { state: "skipped" });
      }
    } catch (e) {
      setError(errorMessage(e));
      setSteps((prev) => prev.map((s) => (s.state === "running" ? { ...s, state: "error" } : s)));
    } finally {
      setRunning(false);
    }
  };

  const merged = signals;
  const counts = confidenceCounts(merged);
  const matches = useMemo(() => deriveMatches(sources, merged), [sources, merged]);
  const profiles = sources.flatMap((s) => s.profiles);
  const decisionFor = (s: IdentitySignal) => decisions[s.id] ?? s.confidence !== "unconfirmed";
  const accepted = merged.filter(decisionFor);
  const found = scan.sites.filter((s) => s.status === "found");

  const createCase = () => {
    if (!seed.trim()) return;
    const inv = createInvestigation({
      name: kind === "username" ? `Identidade pública · @${seed.replace(/^@/, "")}` : `Identidade pública · ${seed}`,
      description: `Correlação de identidade pública a partir de ${seed} (${kind === "email" ? "e-mail" : "username"}).`,
      objective: "Mapear perfis públicos, contatos declarados e vínculos verificáveis, separando fatos de indícios.",
      tags: ["identity", "osint", kind],
      status: "active",
      seed: { kind, value: seed },
    });

    for (const signal of accepted) {
      addEntity(inv.id, {
        kind: toEntityKind(signal.kind) as never,
        value: signal.value,
        label: signal.label,
        source: signal.source,
        confidence: signal.confidence,
        notes: signal.reason,
      });
    }
    for (const source of sources.filter((s) => s.ok && s.profiles.length)) {
      addEvidence(inv.id, {
        toolId: `identity-${source.id}`,
        tool: `Identity · ${source.name}`,
        input: seed,
        source: source.name,
        summary: `${source.profiles.length} perfil(is) público(s) e ${source.signals.length} sinal(is) extraídos de ${source.name}.`,
        data: source,
      });
    }
    if (matches.length) {
      addEvidence(inv.id, {
        toolId: "identity-correlation",
        tool: "Correlação derivada",
        input: seed,
        source: "Life Agency (regras locais)",
        summary: `${matches.length} correlação(ões) derivada(s) por avatar/chave/contato — todas exigem confirmação humana.`,
        data: matches,
      });
    }
    addNote(inv.id, [
      `Pipeline de identidade executado para ${seed}.`,
      `Sinais aceitos: ${accepted.length} (${accepted.filter((s) => s.confidence === "confirmed").length} confirmados, ${accepted.filter((s) => s.confidence === "probable").length} prováveis).`,
      `Sinais rejeitados: ${merged.length - accepted.length}.`,
      "Mesmo username ou avatar idêntico não prova que as contas pertencem à mesma pessoa. Nenhum telefone foi consultado: não existe fonte pública gratuita e legítima para isso.",
      "Fontes: Sherlock (MIT) para catálogo de sites, GitHub, Keybase, Hacker News, Mastodon, GitLab, dev.to e Gravatar (perfis públicos).",
    ].join("\n"));
    setCreated(inv.id);
  };

  return (
    <div className="space-y-4">
      <Panel className="ag-glass !p-4 md:!p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_150px_auto_auto] lg:items-end">
          <Field label="Semente" hint="@username ou e-mail público. Domínios e URLs usam as ferramentas de infraestrutura.">
            <div className="relative">
              <AtSign className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ag-faint)]" />
              <input className="ag-input !pl-9" value={seed} onChange={(e) => { setSeed(e.target.value); setKind(guessKind(e.target.value)); }} placeholder="@nick ou nome@dominio.com" onKeyDown={(e) => { if (e.key === "Enter") void run(); }} />
            </div>
          </Field>
          <Field label="Escopo da presença">
            <select className="ag-select" value={scope} onChange={(e) => setScope(e.target.value as "quick" | "all")} disabled={running}>
              <option value="quick">Rápido</option>
              <option value="all">Completo ({catalog?.total ?? 464})</option>
            </select>
          </Field>
          <Button variant="primary" onClick={() => void run()} disabled={running || !seed.trim()}>
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Investigar
          </Button>
          <Button variant="ghost" onClick={() => { stopRef.current = true; }} disabled={!running}>Parar</Button>
        </div>
        <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--ag-faint)]">
          Consulte apenas perfis públicos. Sem senhas, sem contas privadas, sem telefone. O resultado é um conjunto de indícios com fonte e confiança — a correlação final é sua.
        </p>
      </Panel>

      {error && <Notice tone="warn">{error}</Notice>}

      {steps.length > 0 && (
        <div className="grid gap-3 xl:grid-cols-[260px_1fr]">
          <Panel className="!p-3">
            <div className="ag-label mb-2">Pipeline</div>
            <ol className="space-y-1">
              {steps.map((step, index) => (
                <li key={step.id} className={cx("ag-step", `ag-step-${step.state}`)}>
                  <span className="ag-step-dot">
                    {step.state === "running" ? <Loader2 className="h-3 w-3 animate-spin" /> : step.state === "done" ? <Check className="h-3 w-3" /> : step.state === "error" ? <AlertTriangle className="h-3 w-3" /> : <Circle className="h-2.5 w-2.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11.5px] font-medium text-[#dbe7f4]">{index + 1}. {step.label}</span>
                    <span className="block truncate text-[10px] text-[var(--ag-faint)]">{step.detail ?? step.hint}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-3 border-t border-[var(--ag-border)] pt-2 text-[10px] text-[var(--ag-faint)]">
              {scan.total > 0 && <div>{scan.done}/{scan.total} sites · {scan.found} encontrados · {scan.blocked} bloqueados</div>}
              <div>{sources.length} fontes consultadas</div>
            </div>
          </Panel>

          <div className="space-y-3">
            <Panel className="ag-glass !p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="ag-label">Rastro público</div>
                  <div className="text-[13px] font-semibold text-[#e8f0f9]">{seed || "—"}</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone="green">{counts.confirmed} confirmados</Badge>
                  <Badge tone="amber">{counts.probable} prováveis</Badge>
                  <Badge tone="neutral">{counts.unconfirmed} não confirmados</Badge>
                </div>
              </div>
              <div className="ag-ribbon">
                <span className="ag-ribbon-node ag-ribbon-seed">{seed || "semente"}</span>
                {merged.filter((s) => s.confidence !== "unconfirmed").slice(0, 5).map((s, i) => (
                  <span key={s.id} className="ag-ribbon-hop" style={{ animationDelay: `${i * 70}ms` }}>
                    <ChevronRight className="h-3 w-3 text-[var(--ag-faint)]" />
                    <span className={cx("ag-ribbon-node", s.confidence === "confirmed" ? "ag-ribbon-confirmed" : "ag-ribbon-probable")} title={`${s.source} · ${s.reason}`}>
                      {shortValue(s.value)}
                    </span>
                  </span>
                ))}
                {merged.length === 0 && <span className="text-[10.5px] text-[var(--ag-faint)]">Os saltos aparecem conforme as fontes respondem.</span>}
              </div>
            </Panel>

            {found.length > 0 && (
              <Panel title="Presença encontrada" description="Páginas públicas que responderam 200. Indício, não confirmação." className="!p-4">
                <div className="flex flex-wrap gap-1.5">
                  {found.slice(0, 40).map((site) => (
                    <a key={site.id} href={site.url} target="_blank" rel="noreferrer" className="ag-chip" title={site.detail}>
                      {site.name}
                    </a>
                  ))}
                  {found.length > 40 && <span className="text-[10.5px] text-[var(--ag-faint)]">+{found.length - 40}</span>}
                </div>
              </Panel>
            )}

            {profiles.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2">
                {profiles.map((profile, i) => (
                  <article key={`${profile.source}-${i}`} className="ag-card ag-glass !p-4">
                    <div className="flex items-start gap-3">
                      {profile.avatar ? (
                        <img src={profile.avatar} alt="" className="h-10 w-10 rounded-full border border-[var(--ag-border)] object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--ag-border)] text-[var(--ag-faint)]"><Fingerprint className="h-4 w-4" /></div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-semibold text-[#e8f0f9]">{profile.displayName ?? profile.username ?? profile.source}</div>
                        <div className="text-[10.5px] text-[var(--ag-faint)]">{profile.source}{profile.username ? ` · @${profile.username}` : ""}</div>
                      </div>
                      {profile.url && <a href={profile.url} target="_blank" rel="noreferrer" className="ag-link text-[10.5px]">abrir</a>}
                    </div>
                    {profile.bio && <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-[var(--ag-muted)]">{profile.bio}</p>}
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--ag-muted)]">
                      {profile.location && <span>local: {profile.location}</span>}
                      {profile.company && <span>empresa: {profile.company}</span>}
                      {profile.joined && <span>desde {profile.joined.slice(0, 10)}</span>}
                    </div>
                    {profile.fields.length > 0 && (
                      <dl className="mt-2 space-y-0.5 border-t border-[var(--ag-border)] pt-2 text-[10.5px]">
                        {profile.fields.slice(0, 5).map((f, idx) => (
                          <div key={idx} className="flex justify-between gap-3">
                            <dt className="text-[var(--ag-faint)]">{f.label}</dt>
                            <dd className="truncate text-right text-[var(--ag-muted)]">{f.url ? <a href={f.url} target="_blank" rel="noreferrer" className="ag-link">{f.value}</a> : f.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </article>
                ))}
              </div>
            )}

            {matches.length > 0 && (
              <Panel title="Correlações derivadas" description="Regras locais comparam avatares e contatos. Todas exigem confirmação." className="!p-4">
                <ul className="space-y-2">
                  {matches.map((m) => (
                    <li key={m.id} className="rounded-lg border border-[var(--ag-border)] bg-black/20 p-2.5 text-[11px] text-[var(--ag-muted)]">
                      <div className="flex items-center gap-2"><GitBranch className="h-3 w-3 text-[var(--ag-cyan)]" /><Badge tone={TONE[m.confidence]}>{CONF_LABEL[m.confidence]}</Badge></div>
                      <p className="mt-1 break-all">{m.reason}</p>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            <Panel title="Sinais" description="Marque o que deve entrar no caso. Fontes e motivo ficam gravados em cada entidade." className="!p-4">
              {merged.length === 0 ? (
                <Empty title="Nenhum sinal ainda" hint="Rode a investigação para preencher o pipeline." icon={<Sparkles className="h-5 w-5" />} />
              ) : (
                <div className="max-h-[420px] overflow-auto rounded-xl border border-[var(--ag-border)]">
                  <table className="ag-table w-full">
                    <thead className="sticky top-0 bg-[var(--ag-surface-2)]"><tr><th className="w-8"></th><th>Valor</th><th>Tipo</th><th>Fonte</th><th>Confiança</th><th>Motivo</th></tr></thead>
                    <tbody>
                      {merged.map((s) => {
                        const on = decisionFor(s);
                        return (
                          <tr key={s.id} className={cx(!on && "opacity-45")}>
                            <td>
                              <button
                                onClick={() => setDecisions((d) => ({ ...d, [s.id]: !on }))}
                                className={cx("flex h-4 w-4 items-center justify-center rounded border", on ? "border-cyan-400/60 bg-cyan-400/20 text-cyan-200" : "border-[var(--ag-border-strong)] text-transparent")}
                                aria-label={on ? "Rejeitar sinal" : "Aceitar sinal"}
                              >
                                {on ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                              </button>
                            </td>
                            <td className="max-w-[220px] truncate">
                              {s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="ag-link ag-mono text-[10.5px]">{s.value}</a> : <span className="ag-mono text-[10.5px]">{s.value}</span>}
                              {s.label && <span className="ml-1 text-[9.5px] text-[var(--ag-faint)]">({s.label})</span>}
                            </td>
                            <td className="whitespace-nowrap text-[10px] text-[var(--ag-muted)]">{ENTITY_LABELS[toEntityKind(s.kind)] ?? s.kind}</td>
                            <td className="whitespace-nowrap text-[10px] text-[var(--ag-muted)]">{s.source}</td>
                            <td><Badge tone={TONE[s.confidence]}>{CONF_LABEL[s.confidence]}</Badge></td>
                            <td className="max-w-[300px] text-[10px] leading-relaxed text-[var(--ag-faint)]">{s.reason}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            {merged.length > 0 && (
              <div className="ag-card ag-glass sticky bottom-3 flex flex-wrap items-center justify-between gap-3 !p-3">
                <div className="flex items-center gap-2 text-[11.5px] text-[var(--ag-muted)]">
                  <ShieldCheck className="h-3.5 w-3.5 text-[var(--ag-cyan)]" />
                  {accepted.length} de {merged.length} sinais serão gravados
                  <span className="hidden text-[10px] text-[var(--ag-faint)] sm:inline">· armazenamento local</span>
                </div>
                <div className="flex items-center gap-2">
                  {created ? (
                    <>
                      <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> caso criado</Badge>
                      <Link to="/agency/workspace" search={{ case: created }} className="ag-btn ag-btn-primary !text-[11px]">Abrir caso</Link>
                      <Link to="/agency/graph" search={{ case: created }} className="ag-btn ag-btn-ghost !text-[11px]">Ver no grafo</Link>
                    </>
                  ) : (
                    <Button variant="primary" onClick={createCase} disabled={!seed.trim()}>
                      <KeyRound className="h-3.5 w-3.5" /> Criar caso com {accepted.length} sinais <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {steps.length === 0 && (
        <Panel className="!p-5">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300"><Mail className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold text-[#e8f0f9]">O que este pipeline encontra — e o que não encontra</div>
              <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-[var(--ag-muted)]">
                <li>• <strong className="text-[#cfe0f0]">Sim:</strong> perfis públicos com o mesmo handle, campos que o perfil publica (e-mail, site, empresa, local), chaves SSH/GPG, provas do Keybase, contas vinculadas e avatar idêntico.</li>
                <li>• <strong className="text-[#cfe0f0]">Não:</strong> telefone, contas privadas, mensagens, senhas ou vazamentos nominais. GitHub só devolve e-mail se ele estiver público no perfil.</li>
                <li>• <strong className="text-[#cfe0f0]">Nunca:</strong> afirmar que duas contas são da mesma pessoa. Isso fica na coluna “confiança” e na sua decisão.</li>
              </ul>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}

function guessKind(value: string): "username" | "email" | "other" {
  const v = value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "email";
  if (/^@?[a-z0-9._-]{2,40}$/i.test(v) && !v.includes(".")) return "username";
  if (/^[a-z0-9._-]{2,40}$/i.test(v)) return "username";
  return "other";
}

function shortValue(value: string): string {
  const v = value.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return v.length > 26 ? `${v.slice(0, 24)}…` : v;
}
