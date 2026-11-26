import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check, Copy, Download, FileUp, Fingerprint, Link2, Loader2, Plus, Search, Share2,
  ShieldCheck, Upload, X,
} from "lucide-react";
import { extractFromUnknown, normalizeEntityValue } from "@/lib/palette/extract";
import { newEvidence, sha256Hex, type ExtractedCandidate } from "@/lib/palette/store";
import { PALETTE_TEMPLATES, templateById } from "@/lib/palette/templates";
import { CONFIDENCE_LABEL, NODE_KIND_LABEL, type ConfidenceLevel, type PaletteCase, type PaletteEvidence, type PaletteGroup, type PaletteNode, type PaletteNodeKind } from "@/lib/palette/types";
import { PalButton, PalField, PalLabel, Modal, inputCls, selectCls, KindPill, ConfidencePill } from "./kit";
import { cx } from "@/components/agency/kit";

export type NewCasePayload = {
  title: string; description: string; objective: string; priority: PaletteCase["priority"];
  templateId: string; seedKind?: PaletteNodeKind; seedValue?: string; tags: string[];
};

export function NewCaseModal({
  open, initialTemplate, onClose, onCreate,
}: { open: boolean; initialTemplate?: string; onClose: () => void; onCreate: (p: NewCasePayload) => void }) {
  const [templateId, setTemplateId] = useState(initialTemplate ?? "custom");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [objective, setObjective] = useState("");
  const [priority, setPriority] = useState<PaletteCase["priority"]>("normal");
  const [seedValue, setSeedValue] = useState("");
  const [tags, setTags] = useState("");
  const tpl = templateById(templateId);

  useEffect(() => {
    if (!open) return;
    setTemplateId(initialTemplate ?? "custom");
    const t = templateById(initialTemplate ?? "custom");
    setTitle(t && t.id !== "custom" ? t.name : "");
    setObjective(t?.objective ?? "");
    setDescription(t?.description ?? "");
    setSeedValue("");
    setPriority("normal");
    setTags(t?.tags.join(", ") ?? "");
  }, [open, initialTemplate]);

  const submit = () => {
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      description: description.trim(),
      objective: objective.trim(),
      priority,
      templateId,
      seedKind: tpl?.seedKind,
      seedValue: seedValue.trim() || undefined,
      tags: tags.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean),
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Nova investigação" subtitle="O caso começa vazio: nada é inserido sem você adicionar ou importar."
      footer={<><PalButton variant="ghost" onClick={onClose}>Cancelar</PalButton><PalButton variant="primary" onClick={submit} disabled={!title.trim()}><Plus className="h-3.5 w-3.5" /> Criar investigação</PalButton></>}>
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <PalField label="Template">
            <select className={selectCls} value={templateId} onChange={(e) => {
              setTemplateId(e.target.value);
              const t = templateById(e.target.value);
              if (t) { setObjective(t.objective); setDescription(t.description); setTags(t.tags.join(", ")); if (!title || PALETTE_TEMPLATES.some((x) => x.name === title)) setTitle(t.id === "custom" ? "" : t.name); }
            }}>
              {PALETTE_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </PalField>
          <PalField label="Prioridade">
            <select className={selectCls} value={priority} onChange={(e) => setPriority(e.target.value as PaletteCase["priority"])}>
              {["low", "normal", "high", "critical"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </PalField>
        </div>
        <PalField label="Título"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex.: Infraestrutura pública de exemplo.com" /></PalField>
        <PalField label="Objetivo"><textarea className={cx(inputCls, "min-h-[56px] resize-y")} value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="O que esta investigação precisa responder?" /></PalField>
        <PalField label="Descrição"><textarea className={cx(inputCls, "min-h-[48px] resize-y")} value={description} onChange={(e) => setDescription(e.target.value)} /></PalField>
        {tpl?.seedKind && (
          <PalField label={tpl.seedLabel ?? "Semente"} hint="Opcional. Cria uma única entidade inicial marcada como não verificada.">
            <input className={inputCls} value={seedValue} onChange={(e) => setSeedValue(e.target.value)} placeholder={tpl.seedPlaceholder} />
          </PalField>
        )}
        <PalField label="Tags" hint="separadas por vírgula"><input className={inputCls} value={tags} onChange={(e) => setTags(e.target.value)} /></PalField>
        {tpl && tpl.steps.length > 0 && (
          <div className="rounded-lg border border-[#1e2c3a] bg-[#0a1118] p-2">
            <PalLabel>Plano incluído ({tpl.steps.length} etapas)</PalLabel>
            <ul className="mt-1 space-y-0.5 text-[9.5px] text-[#8399ae]">{tpl.steps.map((s) => <li key={s.label}>• {s.label} — {s.hint}</li>)}</ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function AddEntityModal({
  open, groups, suggestedKind, onClose, onAdd,
}: {
  open: boolean; groups: PaletteGroup[]; suggestedKind?: PaletteNodeKind;
  onClose: () => void;
  onAdd: (values: Array<{ kind: PaletteNodeKind; title: string; description: string; confidence: ConfidenceLevel; source: string; groupId?: string; tags: string[] }>) => void;
}) {
  const [kind, setKind] = useState<PaletteNodeKind>(suggestedKind ?? "domain");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [confidence, setConfidence] = useState<ConfidenceLevel>("unverified");
  const [source, setSource] = useState("Inserção manual");
  const [groupId, setGroupId] = useState("");
  const [tags, setTags] = useState("");

  useEffect(() => { if (open) { setValue(""); setDescription(""); setConfidence("unverified"); setSource("Inserção manual"); } }, [open]);

  const submit = () => {
    const lines = value.split("\n").map((v) => v.trim()).filter(Boolean);
    if (!lines.length) return;
    onAdd(lines.map((title) => ({ kind, title, description, confidence, source, groupId: groupId || undefined, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) })));
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Adicionar entidade" subtitle="Uma por linha. Valores duplicados do mesmo tipo são consolidados com registro na timeline."
      footer={<><PalButton variant="ghost" onClick={onClose}>Cancelar</PalButton><PalButton variant="primary" onClick={submit} disabled={!value.trim()}><Plus className="h-3.5 w-3.5" /> Adicionar</PalButton></>}>
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <PalField label="Tipo">
            <select className={selectCls} value={kind} onChange={(e) => setKind(e.target.value as PaletteNodeKind)}>
              {(Object.keys(NODE_KIND_LABEL) as PaletteNodeKind[]).map((k) => <option key={k} value={k}>{NODE_KIND_LABEL[k]}</option>)}
            </select>
          </PalField>
          <PalField label="Confiança">
            <select className={selectCls} value={confidence} onChange={(e) => setConfidence(e.target.value as ConfidenceLevel)}>
              {Object.entries(CONFIDENCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </PalField>
        </div>
        <PalField label="Valor(es)"><textarea className={cx(inputCls, "min-h-[74px] resize-y ag-mono !text-[11px]")} value={value} onChange={(e) => setValue(e.target.value)} placeholder={"exemplo.com\napi.exemplo.com\n203.0.113.10"} /></PalField>
        <PalField label="Descrição"><input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="contexto ou observação" /></PalField>
        <div className="grid gap-2 sm:grid-cols-2">
          <PalField label="Fonte"><input className={inputCls} value={source} onChange={(e) => setSource(e.target.value)} /></PalField>
          <PalField label="Grupo">
            <select className={selectCls} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">Sem grupo</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </PalField>
        </div>
        <PalField label="Tags"><input className={inputCls} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="separadas por vírgula" /></PalField>
      </div>
    </Modal>
  );
}

export function EvidenceModal({
  open, c, nodeId, onClose, onSave, onToast,
}: {
  open: boolean; c: PaletteCase; nodeId?: string;
  onClose: () => void; onSave: (e: PaletteEvidence) => void; onToast: (m: string, t?: "ok" | "warn" | "info") => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<PaletteEvidence["kind"]>("link");
  const [url, setUrl] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [content, setContent] = useState("");
  const [fileInfo, setFileInfo] = useState<{ name: string; mime: string; size: number; sha256: string; dataUrl?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [nodeIds, setNodeIds] = useState<string[]>(nodeId ? [nodeId] : []);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(""); setDescription(""); setUrl(""); setSource(""); setNotes(""); setContent(""); setFileInfo(null);
    setNodeIds(nodeId ? [nodeId] : []);
  }, [open, nodeId]);

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      if (file.size > 1_500_000) throw new Error("Arquivo acima de 1,5 MB. Registre o link/hash e mantenha o original fora do navegador.");
      const buffer = await file.arrayBuffer();
      const hash = await sha256Hex(buffer);
      const dataUrl = file.type.startsWith("image/") ? await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
        reader.readAsDataURL(file);
      }) : undefined;
      setFileInfo({ name: file.name, mime: file.type || "application/octet-stream", size: file.size, sha256: hash, dataUrl });
      if (!title) setTitle(file.name);
      if (kind !== "file") setKind("file");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Falha ao processar arquivo.", "warn");
    } finally { setBusy(false); }
  };

  const save = async () => {
    if (!title.trim()) { onToast("Informe um título.", "warn"); return; }
    let hash: string | undefined = fileInfo?.sha256;
    if (!hash && content.trim() && kind === "text") hash = await sha256Hex(content);
    onSave(newEvidence({
      title: title.trim(),
      description: description.trim(),
      kind,
      url: url.trim() || undefined,
      filename: fileInfo?.name,
      mime: fileInfo?.mime,
      size: fileInfo?.size,
      sha256: hash,
      content: fileInfo?.dataUrl ?? (content.trim() || undefined),
      source: source.trim() || "Coleta manual",
      nodeIds,
      notes: notes.trim(),
    }));
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Registrar evidência" subtitle="Preserve o original, registre fonte, data e hash. A evidência é armazenada neste navegador."
      footer={<><PalButton variant="ghost" onClick={onClose}>Cancelar</PalButton><PalButton variant="primary" onClick={() => void save()} disabled={busy}><Check className="h-3.5 w-3.5" /> Salvar evidência</PalButton></>}>
      <div className="space-y-3">
        <PalField label="Título"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex.: Payload RDAP de exemplo.com (2026-11-26)" /></PalField>
        <PalField label="Descrição"><textarea className={cx(inputCls, "min-h-[52px] resize-y")} value={description} onChange={(e) => setDescription(e.target.value)} /></PalField>
        <div className="grid gap-2 sm:grid-cols-3">
          <PalField label="Tipo">
            <select className={selectCls} value={kind} onChange={(e) => setKind(e.target.value as PaletteEvidence["kind"])}>
              <option value="link">Link</option>
              <option value="text">Texto / payload</option>
              <option value="file">Arquivo</option>
              <option value="snapshot">Captura</option>
            </select>
          </PalField>
          <PalField label="Fonte"><input className={inputCls} value={source} onChange={(e) => setSource(e.target.value)} placeholder="RDAP, crt.sh, análise manual" /></PalField>
          <PalField label="Coleta"><input type="date" className={inputCls} value={new Date().toISOString().slice(0, 10)} readOnly /></PalField>
        </div>
        {kind === "link" && <PalField label="URL"><input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></PalField>}
        {(kind === "text" || kind === "snapshot") && <PalField label="Conteúdo"><textarea className={cx(inputCls, "min-h-[90px] resize-y ag-mono !text-[10px]")} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Cole o payload ou a captura em texto." /></PalField>}
        {kind === "file" && (
          <div className="rounded-lg border border-dashed border-[#27394b] p-3 text-center">
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />
            <PalButton size="sm" variant="soft" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Escolher arquivo</PalButton>
            {fileInfo && <div className="mt-2 text-[9.5px] text-[#8399ae]">{fileInfo.name} · {(fileInfo.size / 1024).toFixed(1)} KB<div className="ag-mono text-[8px] text-[#5f7488]">sha256 {fileInfo.sha256}</div></div>}
            <p className="mt-1 text-[8.5px] text-[#5f7488]">Imagens até 1,5 MB são preservadas como data URL; outros formatos guardam apenas metadados e hash.</p>
          </div>
        )}
        <PalField label="Entidades vinculadas">
          <div className="max-h-[120px] overflow-y-auto rounded-lg border border-[#21303f] bg-[#0a1017] p-1.5">
            {c.nodes.length === 0 && <p className="text-[9.5px] text-[#657b90]">Nenhuma entidade no caso.</p>}
            {c.nodes.map((n) => (
              <label key={n.id} className="flex cursor-pointer items-center gap-1.5 text-[10px] text-[#a5b9cc]">
                <input type="checkbox" checked={nodeIds.includes(n.id)} onChange={() => setNodeIds((prev) => prev.includes(n.id) ? prev.filter((id) => id !== n.id) : [...prev, n.id])} className="h-3 w-3 accent-cyan-400" />
                <span className="truncate">{n.title}</span>
              </label>
            ))}
          </div>
        </PalField>
        <PalField label="Observações"><textarea className={cx(inputCls, "min-h-[42px] resize-y")} value={notes} onChange={(e) => setNotes(e.target.value)} /></PalField>
        {fileInfo && <div className="rounded border border-emerald-400/25 bg-emerald-400/[0.04] px-2 py-1 text-[9.5px] text-emerald-200"><ShieldCheck className="mr-1 inline h-3 w-3" /> Hash SHA-256 calculado no navegador.</div>}
      </div>
    </Modal>
  );
}

export type ImportPayload = { query: string; nodeId?: string; outcomes: Array<{ sourceId: string; sourceName: string; data?: unknown; ok: boolean }> };

export function ExtractReviewModal({
  open, c, payload, onClose, onConfirm,
}: {
  open: boolean; c: PaletteCase; payload: ImportPayload | null;
  onClose: () => void;
  onConfirm: (values: Array<{ candidate: ExtractedCandidate; selected: boolean }>, opts: { relation: string; confidence: ConfidenceLevel; linkToQuery: boolean; archiveEvidence: boolean }) => void;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [relation, setRelation] = useState("Associated with");
  const [confidence, setConfidence] = useState<ConfidenceLevel>("medium");
  const [linkToQuery, setLinkToQuery] = useState(true);
  const [archiveEvidence, setArchiveEvidence] = useState(true);

  const candidates = useMemo(() => {
    if (!payload) return [];
    const map = new Map<string, ExtractedCandidate>();
    for (const o of payload.outcomes) {
      if (!o.ok || !o.data) continue;
      for (const cand of extractFromUnknown(o.data, 120)) {
        const key = `${cand.kind}:${cand.value.toLowerCase()}`;
        if (!map.has(key)) map.set(key, { kind: cand.kind, value: cand.value, source: o.sourceName, confidence: "unverified", label: cand.label });
      }
    }
    const rank = (kind: string) => {
      const order = ["domain", "subdomain", "ipv4", "ipv6", "url", "email", "cve", "asn", "hash", "username", "certificate"];
      const i = order.indexOf(kind);
      return i === -1 ? order.length : i;
    };
    // Payloads can contain hundreds of schema/CDN values; keep the most
    // useful shapes first and cap the review list so it stays auditable.
    return [...map.values()].sort((a, b) => rank(a.kind) - rank(b.kind) || a.value.localeCompare(b.value)).slice(0, 200);
  }, [payload]);

  useEffect(() => {
    if (!open) return;
    const initial: Record<string, boolean> = {};
    for (const cand of candidates.slice(0, 60)) initial[`${cand.kind}:${cand.value.toLowerCase()}`] = true;
    setSelected(initial);
  }, [open, candidates]);

  const existing = new Set(c.nodes.map((n) => `${n.kind}:${normalizeEntityValue(n.kind, n.title)}`));
  const chosen = candidates.filter((cand) => selected[`${cand.kind}:${cand.value.toLowerCase()}`]);

  return (
    <Modal open={open} onClose={onClose} width="max-w-3xl"
      title="Revisar entidades extraídas" subtitle="Extração local por padrões. Nada entra no caso sem sua confirmação — os 60 primeiros vêm pré-selecionados por tipo."
      footer={<><PalButton variant="ghost" onClick={onClose}>Cancelar</PalButton><PalButton variant="primary" onClick={() => {
        onConfirm(chosen.map((cand) => ({ candidate: cand, selected: true })), { relation, confidence, linkToQuery, archiveEvidence });
        onClose();
      }} disabled={!chosen.length}><Plus className="h-3.5 w-3.5" /> Importar {chosen.length}</PalButton></>}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#8399ae]">
          <span>Consulta: <b className="text-[#dbe7f4]">{payload?.query}</b></span>
          <span>·</span>
          <span>{candidates.length} candidato(s){chosen.length < candidates.length ? ` · ${chosen.length} selecionado(s)` : ""}</span>
          <button className="ml-auto text-cyan-300 hover:underline" onClick={() => setSelected(Object.fromEntries(candidates.map((cand) => [`${cand.kind}:${cand.value.toLowerCase()}`, true])))}>selecionar todos</button>
          <button className="text-[#8399ae] hover:underline" onClick={() => setSelected({})}>limpar</button>
        </div>
        <div className="max-h-[300px] overflow-y-auto rounded-lg border border-[#1b2836]">
          <table className="w-full text-[10px]">
            <thead className="sticky top-0 bg-[#0b141d] text-[#71879c]"><tr><th className="w-6"></th><th className="text-left">Valor</th><th className="text-left">Tipo</th><th className="text-left">Fonte</th><th className="text-left">Estado</th></tr></thead>
            <tbody>
              {candidates.map((cand) => {
                const key = `${cand.kind}:${cand.value.toLowerCase()}`;
                const exists = existing.has(`${cand.kind}:${normalizeEntityValue(cand.kind, cand.value)}`);
                return (
                  <tr key={key} className="border-t border-[#15202c] text-[#b6c8da]">
                    <td className="pl-2"><input type="checkbox" checked={Boolean(selected[key])} onChange={(e) => setSelected((p) => ({ ...p, [key]: e.target.checked }))} className="h-3 w-3 accent-cyan-400" /></td>
                    <td className="max-w-[280px] truncate py-1 text-[#e6eef7]">{cand.value}</td>
                    <td className="whitespace-nowrap">{NODE_KIND_LABEL[cand.kind]}</td>
                    <td className="max-w-[120px] truncate text-[#8399ae]">{cand.source}{cand.label ? ` · ${cand.label}` : ""}</td>
                    <td>{exists ? <span className="text-[9px] text-amber-300">já existe · mesclar</span> : <span className="text-[9px] text-emerald-300">novo</span>}</td>
                  </tr>
                );
              })}
              {candidates.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-[#657b90]">Nenhuma entidade reconhecida no payload. Você pode adicionar manualmente.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <PalField label="Relação com a consulta">
            <select className={selectCls} value={relation} onChange={(e) => setRelation(e.target.value)}>
              {["Associated with", "Resolves to", "Hosted on", "Uses certificate", "Subdomain of", "Registered by", "Observed in", "Potentially related to"].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </PalField>
          <PalField label="Confiança das novas entidades">
            <select className={selectCls} value={confidence} onChange={(e) => setConfidence(e.target.value as ConfidenceLevel)}>
              {Object.entries(CONFIDENCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </PalField>
        </div>
        <label className="flex items-center gap-2 text-[10px] text-[#a5b9cc]"><input type="checkbox" checked={linkToQuery} onChange={(e) => setLinkToQuery(e.target.checked)} className="h-3 w-3 accent-cyan-400" /> Criar relação entre a entidade consultada e cada nova entidade</label>
        <label className="flex items-center gap-2 text-[10px] text-[#a5b9cc]"><input type="checkbox" checked={archiveEvidence} onChange={(e) => setArchiveEvidence(e.target.checked)} className="h-3 w-3 accent-cyan-400" /> Arquivar payload das fontes como evidência (com hash)</label>
        <p className="text-[8.5px] leading-relaxed text-[#5f7488]">A extração inclui domínios, URLs, IPv4/IPv6, e-mails, hashes, CVEs e ASNs. Correspondências por semelhança de nome não são criadas automaticamente.</p>
      </div>
    </Modal>
  );
}

export function ShareModal({ open, c, onClose, onToast, onImportToken, onImportFile }: {
  open: boolean; c: PaletteCase | null; onClose: () => void; onToast: (m: string, t?: "ok" | "warn" | "info") => void;
  onImportToken: (token: string) => void;
  onImportFile: (file: File) => void;
}) {
  const [link, setLink] = useState("");
  const [token, setToken] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const build = async () => {
    if (!c) return;
    const { encodeShare } = await import("@/lib/palette/store");
    const encoded = encodeShare(c);
    const url = `${window.location.origin}/agency/palette?share=${encoded}&view=cases`;
    setLink(url);
    try { await navigator.clipboard.writeText(url); onToast("Link read-only copiado.", "ok"); } catch { onToast("Link gerado. Copie manualmente.", "info"); }
  };

  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title="Compartilhar investigação" subtitle="Snapshot comprimido, somente leitura. Sem backend: o outro lado importa o snapshot; edição simultânea não está habilitada.">
      <div className="space-y-3">
        {c && (
          <div className="rounded-lg border border-[#1e2c3a] bg-[#0a1118] p-2 text-[10.5px] text-[#b6c8da]">
            {c.code} — {c.title} · {c.nodes.length} entidades · {c.evidence.length} evidências
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          <PalButton variant="primary" onClick={() => void build()}><Share2 className="h-3.5 w-3.5" /> Gerar link read-only</PalButton>
          {c && <PalButton variant="soft" onClick={() => {
            downloadFile(`${c.code}-palette.json`, JSON.stringify({ kind: "life-palette-case", v: 1, case: c }, null, 2));
            onToast("Arquivo do caso exportado.", "ok");
          }}><Download className="h-3.5 w-3.5" /> Exportar arquivo</PalButton>}
        </div>
        {link && (
          <div className="rounded-lg border border-[#1e2c3a] bg-[#0a1118] p-2">
            <PalLabel>Link (contém o snapshot; trate como dado sensível)</PalLabel>
            <textarea readOnly className={cx(inputCls, "mt-1 min-h-[60px] resize-y !text-[8.5px]")} value={link} />
            <PalButton size="sm" variant="soft" className="mt-1" onClick={() => void navigator.clipboard.writeText(link).then(() => onToast("Copiado.", "ok")).catch(() => onToast("Copie manualmente.", "warn"))}><Copy className="h-3 w-3" /> Copiar</PalButton>
          </div>
        )}
        <div className="border-t border-[#182432] pt-2">
          <PalLabel>Importar snapshot</PalLabel>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <input className={cx(inputCls, "!w-64 !text-[9px]")} value={token} onChange={(e) => setToken(e.target.value)} placeholder="cole o token do link (?share=…)" />
            <PalButton size="sm" onClick={() => { if (token.trim()) { onImportToken(token.trim()); onClose(); } }} disabled={!token.trim()}><FileUp className="h-3 w-3" /> Importar token</PalButton>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { onImportFile(f); onClose(); } }} />
            <PalButton size="sm" variant="soft" onClick={() => fileRef.current?.click()}><Upload className="h-3 w-3" /> Arquivo</PalButton>
          </div>
          <p className="mt-1 text-[8.5px] text-[#5f7488]">Snapshots importados ficam em “Shared Cases” e não podem ser editados; use “Duplicar” para trabalhar sobre uma cópia.</p>
        </div>
      </div>
    </Modal>
  );
}

function downloadFile(name: string, content: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------- global search ---------------------------- */

export function PaletteGlobalSearch({
  open, cases, onClose, onOpenCase, onOpenNode,
}: {
  open: boolean; cases: PaletteCase[]; onClose: () => void;
  onOpenCase: (id: string) => void; onOpenNode: (caseId: string, nodeId: string) => void;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "cases" | "nodes" | "evidence" | "notes" | "searches">("all");
  useEffect(() => { if (open) setQ(""); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const term = q.trim().toLowerCase();

  const results = useMemo(() => {
    const out: Array<{ id: string; type: string; label: string; sub: string; action: () => void }> = [];
    for (const c of cases) {
      if ((filter === "all" || filter === "cases") && (!term || `${c.title} ${c.code} ${c.tags.join(" ")}`.toLowerCase().includes(term))) {
        out.push({ id: `case-${c.id}`, type: "Caso", label: `${c.code} — ${c.title}`, sub: c.objective || c.description, action: () => { onOpenCase(c.id); onClose(); } });
      }
      if (filter === "all" || filter === "nodes") {
        for (const n of c.nodes) if (!term || n.title.toLowerCase().includes(term)) {
          out.push({ id: `node-${c.id}-${n.id}`, type: `Entidade · ${NODE_KIND_LABEL[n.kind]}`, label: n.title, sub: `${c.code} · ${n.sources.join(", ") || "sem fonte"}`, action: () => { onOpenNode(c.id, n.id); onClose(); } });
        }
      }
      if (filter === "all" || filter === "evidence") {
        for (const e of c.evidence) if (!term || `${e.title} ${e.description}`.toLowerCase().includes(term)) {
          out.push({ id: `ev-${c.id}-${e.id}`, type: "Evidência", label: e.title, sub: `${c.code} · ${e.source}`, action: () => { onOpenCase(c.id); onClose(); } });
        }
      }
      if (filter === "all" || filter === "notes") {
        for (const n of c.notes) if (!term || n.body.toLowerCase().includes(term)) {
          out.push({ id: `note-${c.id}-${n.id}`, type: "Nota", label: n.body.slice(0, 70), sub: `${c.code} · ${n.author}`, action: () => { onOpenCase(c.id); onClose(); } });
        }
      }
      if (filter === "all" || filter === "searches") {
        for (const s of c.searches) if (!term || `${s.query} ${s.source}`.toLowerCase().includes(term)) {
          out.push({ id: `search-${c.id}-${s.id}`, type: "Consulta", label: s.query, sub: `${c.code} · ${s.source}`, action: () => { onOpenCase(c.id); onClose(); } });
        }
      }
    }
    return out.slice(0, 60);
  }, [cases, term, filter, onOpenCase, onOpenNode, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[85] flex items-start justify-center bg-black/70 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-[#243546] bg-[#080e15] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[#182432] px-3 py-2">
          <Search className="h-4 w-4 text-cyan-300" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar casos, entidades, evidências, notas…" className="flex-1 bg-transparent text-[12.5px] text-[#e8f1fb] outline-none placeholder:text-[#55687c]" />
          <button onClick={onClose} className="text-[#657b90] hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex gap-1 border-b border-[#182432] px-3 py-1.5">
          {(["all", "cases", "nodes", "evidence", "notes", "searches"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cx("rounded px-1.5 py-0.5 text-[9px]", filter === f ? "bg-cyan-400/15 text-cyan-200" : "text-[#71879c] hover:text-white")}>{f === "all" ? "tudo" : f === "cases" ? "casos" : f === "nodes" ? "entidades" : f === "evidence" ? "evidências" : f === "notes" ? "notas" : "consultas"}</button>
          ))}
        </div>
        <div className="max-h-[46vh] overflow-y-auto p-1.5">
          {results.length === 0 && <p className="p-4 text-center text-[10.5px] text-[#657b90]">Nenhum resultado. Tente outro termo.</p>}
          {results.map((r) => (
            <button key={r.id} onClick={r.action} className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/[0.05]">
              <span className="mt-0.5 rounded border border-[#243546] px-1 text-[8px] uppercase text-[#8399ae]">{r.type}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] text-[#dbe7f4]">{r.label}</span>
                <span className="block truncate text-[8.5px] text-[#657b90]">{r.sub}</span>
              </span>
              {r.type === "Caso" && <Fingerprint className="mt-1 h-3 w-3 text-[#4f6a82]" />}
            </button>
          ))}
        </div>
        <div className="border-t border-[#182432] px-3 py-1.5 text-[8.5px] text-[#4f6377]">Busca local em todos os casos deste navegador · Ctrl+K</div>
      </div>
    </div>
  );
}
