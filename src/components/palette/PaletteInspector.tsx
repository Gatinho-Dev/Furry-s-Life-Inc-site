import { useMemo, useState } from "react";
import {
  ArrowUpRight, Bot, Check, ExternalLink, FilePlus2, Focus, Link2, Plus, Radar, Search,
  Sparkles, Trash2, X,
} from "lucide-react";
import { CONFIDENCE_HELP, CONFIDENCE_LABEL, NODE_KIND_LABEL, RELATION_TYPES } from "@/lib/palette/types";
import type { ConfidenceLevel, EdgeStyle, PaletteCase, PaletteEdge, PaletteNode } from "@/lib/palette/types";
import { PalButton, PalField, PalLabel, ConfidencePill, KindPill, inputCls, selectCls } from "./kit";
import { cx } from "@/components/agency/kit";

const TABS = ["Resumo", "Propriedades", "Conexões", "Evidências", "Histórico", "IA"] as const;
type Tab = typeof TABS[number];

export function EntityInspector({
  c, node, readOnly, onUpdate, onDelete, onAddConnection, onInvestigate, onAsk, onAddEvidence, onSelect, onClose,
}: {
  c: PaletteCase;
  node: PaletteNode;
  readOnly: boolean;
  onUpdate: (node: PaletteNode) => void;
  onDelete: () => void;
  onAddConnection: () => void;
  onInvestigate: () => void;
  onAsk: (question: string) => void;
  onAddEvidence: () => void;
  onSelect: (nodeId: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("Resumo");
  const [tagInput, setTagInput] = useState("");
  const edges = useMemo(() => c.edges.filter((e) => e.source === node.id || e.target === node.id), [c.edges, node.id]);
  const evidence = c.evidence.filter((e) => e.nodeIds.includes(node.id));
  const history = c.timeline.filter((t) => t.refId === node.id).slice(0, 12);
  const groups = c.groups;

  const set = (patch: Partial<PaletteNode>) => onUpdate({ ...node, ...patch, updatedAt: new Date().toISOString() });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-[#182432] px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <KindPill kind={node.kind} />
            <div className="ag-mono mt-1 break-all text-[12px] font-semibold leading-snug text-[#e8f1fb]">{node.title}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <ConfidencePill level={node.confidence} small />
              <span className="text-[9.5px] text-[#657b90]">{node.sources.length} fonte(s) · {evidence.length} evidência(s)</span>
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1 text-[#6f859a] hover:bg-white/5 hover:text-white" aria-label="Fechar inspetor"><X className="h-3.5 w-3.5" /></button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          <PalButton size="sm" variant="primary" onClick={onInvestigate}><Radar className="h-3 w-3" /> Investigar</PalButton>
          <PalButton size="sm" variant="soft" onClick={onAddConnection} disabled={readOnly}><Link2 className="h-3 w-3" /> Conectar</PalButton>
          <PalButton size="sm" variant="soft" onClick={onAddEvidence}><FilePlus2 className="h-3 w-3" /> Evidência</PalButton>
          <PalButton size="sm" variant="ghost" onClick={() => onAsk(`O que sabemos sobre ${node.title}?`)}><Bot className="h-3 w-3" /> Life AI</PalButton>
          <PalButton size="sm" variant="ghost" onClick={onDelete} disabled={readOnly}><Trash2 className="h-3 w-3" /></PalButton>
        </div>
        <div className="mt-2 flex gap-0.5 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cx("whitespace-nowrap rounded-md px-2 py-1 text-[10px] transition-colors", tab === t ? "bg-cyan-400/10 text-cyan-200" : "text-[#71879c] hover:bg-white/[0.04] hover:text-[#c6d6e6]")}>{t}</button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {tab === "Resumo" && (
          <div className="space-y-3">
            <div>
              <PalLabel>Descrição</PalLabel>
              <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-[#b6c8da]">{node.description || "Sem descrição registrada."}</p>
            </div>
            <div>
              <PalLabel>Fontes</PalLabel>
              <div className="mt-1 flex flex-wrap gap-1">
                {node.sources.length ? node.sources.map((s) => (
                  <span key={s} className="rounded-full border border-[#243546] bg-[#0c141d] px-2 py-0.5 text-[9.5px] text-[#a5b9cc]">{s}</span>
                )) : <span className="text-[10px] text-amber-300/80">Nenhuma fonte registrada — não trate como fato.</span>}
              </div>
            </div>
            <div>
              <PalLabel>Identificadores</PalLabel>
              <dl className="mt-1 space-y-1">
                {node.identifiers.length ? node.identifiers.map((i, idx) => (
                  <div key={idx} className="flex justify-between gap-2 text-[10.5px]">
                    <dt className="text-[#6f859a]">{i.label}</dt>
                    <dd className="ag-mono break-all text-right text-[#c6d6e6]">{i.value}</dd>
                  </div>
                )) : <dd className="text-[10px] text-[#657b90]">Nenhum.</dd>}
              </dl>
            </div>
            {node.tags.length > 0 && (
              <div>
                <PalLabel>Tags</PalLabel>
                <div className="mt-1 flex flex-wrap gap-1">{node.tags.map((t) => <span key={t} className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[9.5px] text-[#9db0c4]">#{t}</span>)}</div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-[10px] text-[#71879c]">
              <div><span className="text-[#566a7e]">Criado</span><br />{node.createdAt.slice(0, 16).replace("T", " ")}</div>
              <div><span className="text-[#566a7e]">Atualizado</span><br />{node.updatedAt.slice(0, 16).replace("T", " ")}</div>
            </div>
            <div className="rounded-lg border border-[#1e2c3a] bg-[#0a1118] p-2">
              <PalLabel>Confiança: {CONFIDENCE_LABEL[node.confidence]}</PalLabel>
              <p className="mt-1 text-[10px] leading-relaxed text-[#8399ae]">{CONFIDENCE_HELP[node.confidence]}</p>
              <p className="mt-1 text-[9.5px] leading-relaxed text-[#5f7488]">Classificação por regras auditáveis — não é probabilidade estatística.</p>
            </div>
            <div className="flex flex-wrap gap-1">
              <PalButton size="sm" variant="soft" onClick={() => onAsk(`Quais entidades estão conectadas a ${node.title}?`)}><Sparkles className="h-3 w-3" /> Expandir conexões</PalButton>
              <PalButton size="sm" variant="soft" onClick={() => onAsk(`Sugira próximos passos para ${node.title}`)}><Focus className="h-3 w-3" /> Encontrar relações</PalButton>
            </div>
          </div>
        )}

        {tab === "Propriedades" && (
          <div className="space-y-3">
            <PalField label="Nome / valor">
              <input className={inputCls} value={node.title} disabled={readOnly} onChange={(e) => set({ title: e.target.value })} />
            </PalField>
            <PalField label="Subtítulo">
              <input className={inputCls} value={node.subtitle ?? ""} disabled={readOnly} onChange={(e) => set({ subtitle: e.target.value })} />
            </PalField>
            <PalField label="Descrição">
              <textarea className={cx(inputCls, "min-h-[68px] resize-y")} value={node.description} disabled={readOnly} onChange={(e) => set({ description: e.target.value })} />
            </PalField>
            <div className="grid grid-cols-2 gap-2">
              <PalField label="Confiança">
                <select className={selectCls} value={node.confidence} disabled={readOnly} onChange={(e) => set({ confidence: e.target.value as ConfidenceLevel })}>
                  {(Object.keys(CONFIDENCE_LABEL) as ConfidenceLevel[]).map((l) => <option key={l} value={l}>{CONFIDENCE_LABEL[l]}</option>)}
                </select>
              </PalField>
              <PalField label="Grupo">
                <select className={selectCls} value={node.groupId ?? ""} disabled={readOnly} onChange={(e) => set({ groupId: e.target.value || undefined })}>
                  <option value="">Sem grupo</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              </PalField>
            </div>
            <PalField label="Tags" hint="Enter para adicionar">
              <div className="flex flex-wrap gap-1 rounded-lg border border-[#21303f] bg-[#0a1017] p-1.5">
                {node.tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded bg-white/[0.06] px-1.5 py-0.5 text-[9.5px] text-[#c3d3e2]">
                    #{t}
                    {!readOnly && <button onClick={() => set({ tags: node.tags.filter((x) => x !== t) })}><X className="h-2.5 w-2.5" /></button>}
                  </span>
                ))}
                <input
                  value={tagInput}
                  disabled={readOnly}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && tagInput.trim()) { set({ tags: [...new Set([...node.tags, tagInput.trim().replace(/^#/, "")])] }); setTagInput(""); }
                  }}
                  placeholder="adicionar tag"
                  className="min-w-[80px] flex-1 bg-transparent text-[10.5px] text-[#e6eef7] outline-none placeholder:text-[#55687c]"
                />
              </div>
            </PalField>

            <div>
              <div className="flex items-center justify-between"><PalLabel>Identificadores</PalLabel>
                {!readOnly && <PalButton size="sm" variant="ghost" onClick={() => set({ identifiers: [...node.identifiers, { label: "", value: "" }] })}><Plus className="h-3 w-3" /> add</PalButton>}
              </div>
              <div className="mt-1 space-y-1">
                {node.identifiers.map((ident, idx) => (
                  <div key={idx} className="flex gap-1">
                    <input className={cx(inputCls, "!w-24 !py-1 !text-[10px]")} placeholder="rótulo" value={ident.label} disabled={readOnly} onChange={(e) => set({ identifiers: node.identifiers.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)) })} />
                    <input className={cx(inputCls, "!py-1 !text-[10px]")} placeholder="valor" value={ident.value} disabled={readOnly} onChange={(e) => set({ identifiers: node.identifiers.map((x, i) => (i === idx ? { ...x, value: e.target.value } : x)) })} />
                    {!readOnly && <button className="px-1 text-[#6f859a] hover:text-rose-300" onClick={() => set({ identifiers: node.identifiers.filter((_, i) => i !== idx) })}><X className="h-3 w-3" /></button>}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between"><PalLabel>Propriedades</PalLabel>
                {!readOnly && <PalButton size="sm" variant="ghost" onClick={() => set({ properties: { ...node.properties, [`campo_${Object.keys(node.properties).length + 1}`]: "" } })}><Plus className="h-3 w-3" /> add</PalButton>}
              </div>
              <div className="mt-1 space-y-1">
                {Object.entries(node.properties).map(([k, v]) => (
                  <div key={k} className="flex gap-1">
                    <input className={cx(inputCls, "!w-28 !py-1 !text-[10px]")} value={k} disabled={readOnly} onChange={(e) => {
                      const next: Record<string, string> = {};
                      for (const [key, val] of Object.entries(node.properties)) next[key === k ? e.target.value : key] = val;
                      set({ properties: next });
                    }} />
                    <input className={cx(inputCls, "!py-1 !text-[10px]")} value={v} disabled={readOnly} onChange={(e) => set({ properties: { ...node.properties, [k]: e.target.value } })} />
                    {!readOnly && <button className="px-1 text-[#6f859a] hover:text-rose-300" onClick={() => { const next = { ...node.properties }; delete next[k]; set({ properties: next }); }}><X className="h-3 w-3" /></button>}
                  </div>
                ))}
              </div>
            </div>

            <PalField label="Fontes" hint="Uma fonte por linha (nome da fonte, URL ou observação)">
              <textarea className={cx(inputCls, "min-h-[54px] resize-y !text-[10.5px]")} value={node.sources.join("\n")} disabled={readOnly} onChange={(e) => set({ sources: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
            </PalField>
          </div>
        )}

        {tab === "Conexões" && (
          <div className="space-y-2">
            {edges.length === 0 ? <p className="text-[10.5px] leading-relaxed text-[#71879c]">Nenhuma conexão. Use “Conectar” e escolha a entidade, o tipo de relação e a fonte. Sem evidência, a relação fica como hipótese.</p> : edges.map((e) => {
              const otherId = e.source === node.id ? e.target : e.source;
              const other = c.nodes.find((n) => n.id === otherId);
              return (
                <button key={e.id} onClick={() => onSelect(otherId)} className="w-full rounded-lg border border-[#1e2c3a] bg-[#0a1118] p-2 text-left transition-colors hover:border-cyan-400/35">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[10.5px] text-[#cfdeed]">{other?.title ?? "(removida)"}</span>
                    <ConfidencePill level={e.confidence} small />
                  </div>
                  <div className="mt-0.5 text-[9.5px] text-[#71879c]">{e.source === node.id ? "→" : "←"} {e.relation} · {e.sourceLabel || "fonte não informada"}</div>
                </button>
              );
            })}
          </div>
        )}

        {tab === "Evidências" && (
          <div className="space-y-2">
            {evidence.length === 0 ? <p className="text-[10.5px] text-[#71879c]">Nenhuma evidência vinculada.</p> : evidence.map((e) => (
              <div key={e.id} className="rounded-lg border border-[#1e2c3a] bg-[#0a1118] p-2">
                <div className="flex items-center justify-between gap-2"><span className="truncate text-[10.5px] text-[#dbe7f4]">{e.title}</span><span className="text-[9px] text-[#657b90]">{e.kind}</span></div>
                <div className="mt-0.5 text-[9.5px] text-[#71879c]">coletada {e.collectedAt.slice(0, 10)} · {e.responsible}</div>
                {e.url && <a href={e.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[9.5px] text-cyan-300 hover:underline">abrir fonte <ArrowUpRight className="h-2.5 w-2.5" /></a>}
                {e.sha256 && <div className="ag-mono mt-1 break-all text-[8.5px] text-[#5f7488]">sha256: {e.sha256.slice(0, 32)}…</div>}
              </div>
            ))}
            <PalButton size="sm" variant="soft" onClick={onAddEvidence}><FilePlus2 className="h-3 w-3" /> Anexar evidência</PalButton>
          </div>
        )}

        {tab === "Histórico" && (
          <ol className="space-y-2">
            {history.length === 0 && <p className="text-[10.5px] text-[#71879c]">Nenhum evento registrado para esta entidade.</p>}
            {history.map((t) => (
              <li key={t.id} className="border-l border-[#243546] pl-2 text-[10px] text-[#9db0c4]">
                <div className="text-[#c6d6e6]">{t.title}</div>
                <div className="text-[9px] text-[#5f7488]">{t.at.slice(0, 16).replace("T", " ")} · {t.actor}</div>
                {t.detail && <div className="mt-0.5 text-[9.5px] text-[#71879c]">{t.detail}</div>}
              </li>
            ))}
          </ol>
        )}

        {tab === "IA" && (
          <div className="space-y-2">
            <p className="text-[10.5px] leading-relaxed text-[#8399ae]">A IA responde com base nos registros desta entidade e do caso. Sem fonte registrada, ela dirá que não há dado — não inventa.</p>
            {[
              `O que sabemos sobre ${node.title}?`,
              `Quais entidades estão conectadas a ${node.title}?`,
              `Quais fontes sustentam ${node.title}?`,
              `Compare ${node.title} com outra entidade do caso`,
              `Quais informações estão faltando sobre ${node.title}?`,
            ].map((q) => (
              <button key={q} onClick={() => onAsk(q)} className="flex w-full items-start gap-1.5 rounded-lg border border-[#1e2c3a] bg-[#0a1118] p-2 text-left text-[10.5px] text-[#c2d2e2] hover:border-violet-400/40">
                <Sparkles className="mt-0.5 h-3 w-3 flex-none text-violet-300" /> {q}
              </button>
            ))}
            <PalButton size="sm" variant="soft" onClick={() => onAsk(`Resuma a investigação e destaque onde ${node.title} se encaixa`)}><Bot className="h-3 w-3" /> Resumo do caso</PalButton>
          </div>
        )}
      </div>
    </div>
  );
}

export function EdgeInspector({
  c, edge, readOnly, onUpdate, onDelete, onClose, onSelect,
}: {
  c: PaletteCase;
  edge: PaletteEdge;
  readOnly: boolean;
  onUpdate: (edge: PaletteEdge) => void;
  onDelete: () => void;
  onClose: () => void;
  onSelect: (nodeId: string) => void;
}) {
  const [customRelation, setCustomRelation] = useState(!RELATION_TYPES.includes(edge.relation as typeof RELATION_TYPES[number]));
  const source = c.nodes.find((n) => n.id === edge.source);
  const target = c.nodes.find((n) => n.id === edge.target);
  const set = (patch: Partial<PaletteEdge>) => onUpdate({ ...edge, ...patch });
  const linkedEvidence = c.evidence.filter((e) => edge.evidenceIds.includes(e.id));

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#182432] px-3 py-2.5">
        <div className="flex items-start justify-between">
          <div>
            <PalLabel>Relação</PalLabel>
            <div className="mt-1 text-[12px] font-semibold text-[#e8f1fb]">{edge.relation}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-[#8399ae]">
              <button className="hover:text-cyan-300" onClick={() => onSelect(edge.source)}>{source?.title ?? edge.source}</button>
              <span>→</span>
              <button className="hover:text-cyan-300" onClick={() => onSelect(edge.target)}>{target?.title ?? edge.target}</button>
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1 text-[#6f859a] hover:text-white"><X className="h-3.5 w-3.5" /></button>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <ConfidencePill level={edge.confidence} small />
          <span className="text-[9px] text-[#657b90]">{edge.style === "solid" ? "linha contínua" : edge.style === "dashed" ? "tracejada" : "pontilhada"}</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        <PalField label="Tipo de relação">
          <select className={selectCls} value={customRelation ? "custom" : edge.relation} disabled={readOnly} onChange={(e) => {
            if (e.target.value === "custom") { setCustomRelation(true); return; }
            setCustomRelation(false);
            set({ relation: e.target.value });
          }}>
            {RELATION_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
            <option value="custom">Personalizada…</option>
          </select>
          {customRelation && <input className={cx(inputCls, "mt-1")} placeholder="ex.: compartilha certificado" value={edge.relation} disabled={readOnly} onChange={(e) => set({ relation: e.target.value })} />}
        </PalField>
        <PalField label="Descrição">
          <textarea className={cx(inputCls, "min-h-[52px] resize-y")} value={edge.description} disabled={readOnly} onChange={(e) => set({ description: e.target.value })} placeholder="O que exatamente essa relação significa?" />
        </PalField>
        <PalField label="Fonte da relação">
          <input className={inputCls} value={edge.sourceLabel} disabled={readOnly} onChange={(e) => set({ sourceLabel: e.target.value })} placeholder="ex.: RDAP, crt.sh, análise manual" />
        </PalField>
        <div className="grid grid-cols-2 gap-2">
          <PalField label="Confiança">
            <select className={selectCls} value={edge.confidence} disabled={readOnly} onChange={(e) => set({ confidence: e.target.value as ConfidenceLevel })}>
              {(Object.keys(CONFIDENCE_LABEL) as ConfidenceLevel[]).map((l) => <option key={l} value={l}>{CONFIDENCE_LABEL[l]}</option>)}
            </select>
          </PalField>
          <PalField label="Estilo">
            <select className={selectCls} value={edge.style} disabled={readOnly} onChange={(e) => set({ style: e.target.value as EdgeStyle })}>
              <option value="solid">Contínua</option>
              <option value="dashed">Tracejada</option>
              <option value="dotted">Pontilhada</option>
            </select>
          </PalField>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <PalField label="Direção">
            <select className={selectCls} value={edge.directed ? "directed" : "both"} disabled={readOnly} onChange={(e) => set({ directed: e.target.value === "directed" })}>
              <option value="directed">Direcionada</option>
              <option value="both">Bidirecional</option>
            </select>
          </PalField>
          <PalField label="Espessura">
            <input type="number" min={1} max={5} step={0.5} className={inputCls} value={edge.width ?? 1.6} disabled={readOnly} onChange={(e) => set({ width: Number(e.target.value) })} />
          </PalField>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <PalField label="Cor">
            <input type="color" className="h-8 w-full rounded border border-[#21303f] bg-[#0a1017]" value={edge.color ?? "#22d3ee"} disabled={readOnly} onChange={(e) => set({ color: e.target.value })} />
          </PalField>
          <PalField label="Descoberta em">
            <input type="date" className={inputCls} value={edge.discoveredAt.slice(0, 10)} disabled={readOnly} onChange={(e) => set({ discoveredAt: new Date(e.target.value).toISOString() })} />
          </PalField>
        </div>
        <PalField label="Observações">
          <textarea className={cx(inputCls, "min-h-[44px] resize-y")} value={edge.notes} disabled={readOnly} onChange={(e) => set({ notes: e.target.value })} />
        </PalField>
        <div className="rounded-lg border border-[#1e2c3a] bg-[#0a1118] p-2">
          <PalLabel>Evidências vinculadas</PalLabel>
          {linkedEvidence.length ? linkedEvidence.map((e) => <div key={e.id} className="mt-1 text-[10px] text-[#a5b9cc]">• {e.title}</div>) : <p className="mt-1 text-[10px] text-[#71879c]">Nenhuma. Relação sem evidência deve ficar como hipótese.</p>}
        </div>
        <PalButton size="sm" variant="danger" onClick={onDelete} disabled={readOnly}><Trash2 className="h-3 w-3" /> Remover relação</PalButton>
      </div>
    </div>
  );
}

export function RelationPicker({
  c, sourceId, targetId, onConfirm, onClose,
}: {
  c: PaletteCase;
  sourceId: string;
  targetId: string;
  onConfirm: (edge: Omit<PaletteEdge, "id">) => void;
  onClose: () => void;
}) {
  const [relation, setRelation] = useState<string>("Associated with");
  const [custom, setCustom] = useState("");
  const [confidence, setConfidence] = useState<ConfidenceLevel>("unverified");
  const [style, setStyle] = useState<EdgeStyle>("dotted");
  const [directed, setDirected] = useState(true);
  const [sourceLabel, setSourceLabel] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const source = c.nodes.find((n) => n.id === sourceId);
  const target = c.nodes.find((n) => n.id === targetId);

  const submit = () => {
    const rel = relation === "custom" ? custom.trim() : relation;
    if (!rel) { setError("Informe o tipo de relação."); return; }
    if (!sourceLabel.trim()) { setError("Informe a fonte que sustenta esta relação (ou escreva “hipótese” e marque não verificado)."); return; }
    onConfirm({
      source: sourceId,
      target: targetId,
      relation: rel,
      description,
      sourceLabel,
      confidence,
      discoveredAt: new Date().toISOString(),
      style,
      directed,
      notes: "",
      evidenceIds: [],
      origin: "user",
    });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[#1e2c3a] bg-[#0a1118] p-2 text-[11px] text-[#b6c8da]">
        <span className="text-[#e8f1fb]">{source?.title}</span> <span className="text-[#5f7488]">→</span> <span className="text-[#e8f1fb]">{target?.title}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <PalField label="Tipo de relação">
          <select className={selectCls} value={relation} onChange={(e) => setRelation(e.target.value)}>
            {RELATION_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
            <option value="custom">Personalizada…</option>
          </select>
          {relation === "custom" && <input className={cx(inputCls, "mt-1")} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="tipo de relação" />}
        </PalField>
        <PalField label="Fonte / base">
          <input className={inputCls} value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} placeholder="ex.: RDAP, WHOIS, análise manual" />
        </PalField>
        <PalField label="Confiança">
          <select className={selectCls} value={confidence} onChange={(e) => {
            const next = e.target.value as ConfidenceLevel;
            setConfidence(next);
            setStyle(next === "verified" || next === "high" ? "solid" : next === "medium" ? "dashed" : "dotted");
          }}>
            {(Object.keys(CONFIDENCE_LABEL) as ConfidenceLevel[]).map((l) => <option key={l} value={l}>{CONFIDENCE_LABEL[l]}</option>)}
          </select>
        </PalField>
        <PalField label="Aparência">
          <select className={selectCls} value={style} onChange={(e) => setStyle(e.target.value as EdgeStyle)}>
            <option value="solid">Contínua (evidência)</option>
            <option value="dashed">Tracejada (possível)</option>
            <option value="dotted">Pontilhada (hipótese)</option>
          </select>
        </PalField>
      </div>
      <PalField label="Direção">
        <label className="flex items-center gap-2 text-[11px] text-[#b6c8da]">
          <input type="checkbox" checked={directed} onChange={(e) => setDirected(e.target.checked)} /> Direcionada (origem → destino)
        </label>
      </PalField>
      <PalField label="Descrição / justificativa">
        <textarea className={cx(inputCls, "min-h-[54px] resize-y")} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="O que sustenta esta conexão?" />
      </PalField>
      {error && <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1.5 text-[10.5px] text-amber-200">{error}</p>}
      <div className="flex justify-end gap-2">
        <PalButton variant="ghost" onClick={onClose}>Cancelar</PalButton>
        <PalButton variant="primary" onClick={submit}><Check className="h-3.5 w-3.5" /> Criar relação</PalButton>
      </div>
    </div>
  );
}

export function SearchResultCard({ children, onOpen }: { children: React.ReactNode; onOpen?: () => void }) {
  return (
    <div className="rounded-lg border border-[#1e2c3a] bg-[#0a1118] p-2 text-[10.5px] text-[#a5b9cc]">
      {children}
      {onOpen && <button onClick={onOpen} className="mt-1 inline-flex items-center gap-1 text-[9.5px] text-cyan-300 hover:underline">detalhes <ExternalLink className="h-2.5 w-2.5" /></button>}
    </div>
  );
}

export { Search, Link2 };
