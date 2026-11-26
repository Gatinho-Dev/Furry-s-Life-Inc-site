import { useState, type ReactNode } from "react";
import { Loader2, Play, RotateCcw } from "lucide-react";
import { ApiOutput, AttachEvidence, Button, Field, Notice, Panel, useApi } from "./kit";
import type { EntityKind } from "@/lib/agency/store";
import { getRunner } from "@/lib/agency/run";

export type QueryOption = {
  key: string;
  label: string;
  values: Array<{ value: string; label: string }>;
  initial?: string;
};

/**
 * Declarative single-query tool block:
 * form + validation + loading + error + results + sources + evidence capture.
 */
export function QueryTool<T = any>({
  title, description, toolId, toolName, source, placeholder, cta = "Executar",
  options, run, render, attachKind, inputType = "text", value: controlledValue, onValueChange, extra, footer, dense,
}: {
  title: string;
  description?: string;
  toolId: string;
  toolName: string;
  source: string;
  placeholder: string;
  cta?: string;
  options?: QueryOption[];
  run?: (value: string, opts: Record<string, string>) => Promise<T>;
  render?: (data: T) => ReactNode;
  attachKind?: EntityKind;
  inputType?: "text" | "url" | "email" | "search";
  value?: string;
  onValueChange?: (v: string) => void;
  extra?: ReactNode;
  footer?: ReactNode;
  dense?: boolean;
}) {
  const [internal, setInternal] = useState("");
  const value = controlledValue ?? internal;
  const setValue = onValueChange ?? setInternal;
  const [opts, setOpts] = useState<Record<string, string>>(
    Object.fromEntries((options ?? []).map((o) => [o.key, o.initial ?? o.values[0]?.value ?? ""])),
  );
  const api = useApi<T>({ id: toolId, name: toolName, source });
  const [attach, setAttach] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || api.loading) return;
    if (inputType === "url" && !/^https?:\/\//i.test(value) && !/^[a-z0-9.-]+\.[a-z]{2,}/i.test(value)) {
      return;
    }
    const runner = run ?? ((v: string) => getRunner(toolId)?.run(v) as Promise<T>);
    if (!run && !getRunner(toolId)) {
      api.reset();
      return;
    }
    await api.run(value.trim(), () => runner(value.trim(), opts), source);
  };

  return (
    <Panel
      title={title}
      description={description}
      className={dense ? "!p-4" : undefined}
      actions={
        api.data ? (
          <Button variant="ghost" size="sm" onClick={api.reset} title="Limpar resultado">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        ) : undefined
      }
    >
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <Field label="Consulta">
            <input
              className="ag-input"
              type={inputType === "url" ? "text" : inputType}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
        </div>
        {(options ?? []).map((o) => (
          <div key={o.key} className="min-w-[128px]">
            <Field label={o.label}>
              <select className="ag-select" value={opts[o.key]} onChange={(e) => setOpts({ ...opts, [o.key]: e.target.value })}>
                {o.values.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </Field>
          </div>
        ))}
        {extra}
        <Button type="submit" variant="primary" disabled={api.loading || !value.trim()}>
          {api.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          {api.loading ? "Consultando…" : cta}
        </Button>
      </form>

      {value.trim() && inputType === "url" && !/^https?:\/\//i.test(value) && (
        <p className="mt-2 text-[11px] text-[var(--ag-faint)]">Sem protocolo: será usado https:// automaticamente.</p>
      )}

      <div className="mt-4">
        <ApiOutput
          api={api}
          render={render}
          onAttach={api.data ? () => setAttach(true) : undefined}
          attachKind={attachKind}
        />
        {!api.data && !api.loading && !api.error && (
          <div className="text-[11.5px] text-[var(--ag-faint)]">
            {footer ?? "Os resultados incluem a fonte de dados e o horário da consulta."}
          </div>
        )}
      </div>

      {api.data !== null && (
        <AttachEvidence
          open={attach}
          onClose={() => setAttach(false)}
          toolId={toolId}
          toolName={toolName}
          source={source}
          input={value}
          data={api.data}
          defaultKind={attachKind}
        />
      )}
    </Panel>
  );
}

/** Static explanation of a source limitation or dependency. */
export function SourceNote({ children }: { children: ReactNode }) {
  return <Notice tone="warn">{children}</Notice>;
}
