import { useState } from "react";
import { Calculator, Network } from "lucide-react";
import { Badge, Field, KV, Panel } from "./kit";
import { isPrivateIpv4, parseCidr } from "@/lib/agency/format";

function isIpv6(value: string) {
  return value.includes(":") && /^[0-9a-f:]+$/i.test(value.trim());
}
function isIpv4(value: string) {
  return /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(value.trim());
}

export function IpValidator() {
  const [value, setValue] = useState("");
  const v = value.trim();
  const valid = isIpv4(v) || isIpv6(v);
  const privateIp = isIpv4(v) ? isPrivateIpv4(v) : v.toLowerCase().startsWith("fc") || v.toLowerCase().startsWith("fd") || v.toLowerCase().startsWith("fe80") || v === "::1";
  return (
    <Panel title="IPv4 / IPv6 Validator" description="Validação local, sem consulta externa." icon={<Network className="h-3.5 w-3.5" />}>
      <Field label="Endereço IP">
        <input className="ag-input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="192.168.1.1 · 2001:4860:4860::8888" spellCheck={false} />
      </Field>
      {v && (
        <div className="mt-3">
          <KV
            cols={3}
            items={[
              { label: "Válido", value: <Badge tone={valid ? "green" : "rose"}>{valid ? "sim" : "não"}</Badge> },
              { label: "Versão", value: valid ? (isIpv6(v) ? "IPv6" : "IPv4") : "—" },
              { label: "Classe", value: valid ? (privateIp ? "privado/reservado" : "público") : "—" },
            ]}
          />
        </div>
      )}
    </Panel>
  );
}

export function SubnetCalculator({ title = "Subnet / CIDR Calculator" }: { title?: string }) {
  const [value, setValue] = useState("");
  let info = null as ReturnType<typeof parseCidr> | null;
  let error: string | null = null;
  if (value.trim()) {
    try {
      const input = value.includes("/") ? value.trim() : `${value.trim()}/${value.includes(":") ? 64 : 24}`;
      info = parseCidr(input);
    } catch (e) {
      error = (e as Error).message;
    }
  }
  return (
    <Panel title={title} description="Cálculo local de rede, máscara, broadcast e faixa de hosts. Sem consulta externa." icon={<Calculator className="h-3.5 w-3.5" />}>
      <Field label="Endereço / prefixo" hint="Sem prefixo, assume /24 (IPv4) ou /64 (IPv6).">
        <input className="ag-input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="10.0.0.0/8 · 192.168.1.130/26 · 2001:db8::/32" spellCheck={false} />
      </Field>
      {error && <div className="mt-2 text-[11.5px] text-rose-300">{error}</div>}
      {info && !error && (
        <div className="mt-3 space-y-3">
          <KV
            cols={3}
            items={[
              { label: "CIDR", value: <span className="ag-mono text-cyan-300">{info.cidr}</span> },
              { label: "Versão", value: `IPv${info.version}` },
              { label: "Escopo", value: <Badge tone={info.isPrivate ? "amber" : "green"}>{info.isPrivate ? "privado" : "público"}</Badge> },
              { label: "Máscara", value: <span className="ag-mono">{info.version === 4 ? info.netmask : `${info.prefix} bits`}</span> },
              { label: "Wildcard", value: <span className="ag-mono">{info.wildcard}</span> },
              { label: "Broadcast", value: info.broadcast ? <span className="ag-mono">{info.broadcast}</span> : "n/a (IPv6)" },
              { label: "Primeiro host", value: <span className="ag-mono">{info.firstHost ?? "—"}</span> },
              { label: "Último host", value: <span className="ag-mono">{info.lastHost ?? "—"}</span> },
              { label: "Endereços totais", value: <span className="ag-mono">{info.totalAddresses}</span> },
              { label: "Hosts utilizáveis", value: <span className="ag-mono">{info.usableHosts}</span> },
            ]}
          />
        </div>
      )}
    </Panel>
  );
}
