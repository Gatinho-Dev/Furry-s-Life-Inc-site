import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Compass, Image as ImageIcon, MapPin, Search, ShieldOff } from "lucide-react";
import { ipLookup } from "@/lib/agency/api/ip.functions";
import { GeoMap, type GeoPoint } from "@/components/agency/GeoMap";
import {
  Badge, Button, DataTable, ErrorBox, Field, KV, Notice, PageHeader, Panel, Spinner, ValueView, errorMessage,
} from "@/components/agency/kit";
import { ddToDms, dmsToDd, geohashEncode } from "@/lib/agency/format";

export const Route = createFileRoute("/agency/geospatial")({
  head: () => ({ meta: [{ title: "Geospatial Intelligence — Life Agency" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: GeoPage,
});

function GeoPage() {
  const [ip, setIp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geo, setGeo] = useState<{ lat: number; lon: number; label: string; detail: string } | null>(null);

  const [lat, setLat] = useState("38.7223");
  const [lon, setLon] = useState("-9.1393");
  const [dms, setDms] = useState("");
  const [geojson, setGeojson] = useState("");
  const [kml, setKml] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const lookupIp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ip.trim()) return;
    setLoading(true); setError(null); setGeo(null);
    try {
      const data = await ipLookup({ data: { ip: ip.trim() } });
      if (data.geo?.latitude === undefined || data.geo?.longitude === undefined) {
        setError(data.classification === "private/reserved"
          ? "Endereço privado/reservado: não há geolocalização pública."
          : "Fonte de geolocalização não retornou coordenadas para este IP.");
      } else {
        setGeo({
          lat: data.geo.latitude, lon: data.geo.longitude,
          label: `${data.ip} · ${data.geo.city ?? ""} ${data.geo.country ?? ""}`.trim(),
          detail: `${data.network.asn ?? ""} ${data.network.organization ?? ""} — localização aproximada de rede`,
        });
        setLat(String(data.geo.latitude));
        setLon(String(data.geo.longitude));
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const parsed = useMemo(() => {
    const la = Number(lat);
    const lo = Number(lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
    const dmsPair = ddToDms(la, lo);
    return { la, lo, dms: dmsPair, geohash: geohashEncode(la, lo), osm: `https://www.openstreetmap.org/?mlat=${la}&mlon=${lo}#map=13/${la}/${lo}` };
  }, [lat, lon]);

  const points: GeoPoint[] = useMemo(() => {
    const list: GeoPoint[] = [];
    if (parsed) list.push({ lat: parsed.la, lon: parsed.lo, label: "Coordenada informada" });
    if (geo) list.push({ lat: geo.lat, lon: geo.lon, label: geo.label, detail: geo.detail });
    return list;
  }, [parsed, geo]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="OSINT · Geografia"
        title="Geospatial Intelligence"
        subtitle="Mapa OpenStreetMap, geolocalização aproximada de IP, conversão de coordenadas e visualização local de GeoJSON e KML. Nenhum rastreamento de pessoas ou dispositivos."
        actions={<Badge tone="green">OSM + Leaflet</Badge>}
      />

      <Panel title="Mapa operacional" description="Camadas carregadas localmente. Atribuição OpenStreetMap obrigatória." icon={<MapPin className="h-3.5 w-3.5" />}>
        <GeoMap points={points} geojson={geojson.trim() || undefined} kml={kml || undefined} height={420} />
        <p className="mt-2 text-[10.5px] text-[var(--ag-faint)]">
          Tiles © OpenStreetMap contributors. A localização de IP é aproximada em nível de rede/cidade e <strong>não</strong> representa a posição de uma pessoa.
        </p>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Public IP Geolocation Map" description="Consulta a geolocalização pública do IP e plota no mapa." icon={<Search className="h-3.5 w-3.5" />}>
          <form onSubmit={lookupIp} className="flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1">
              <Field label="Endereço IP"><input className="ag-input" value={ip} onChange={(e) => setIp(e.target.value)} placeholder="8.8.8.8" /></Field>
            </div>
            <Button type="submit" variant="primary" disabled={loading || !ip.trim()}>Plotar</Button>
          </form>
          {loading && <Spinner label="Consultando geolocalização…" />}
          {error && <div className="mt-3"><ErrorBox message={error} /></div>}
          {geo && (
            <div className="mt-3">
              <KV
                items={[
                  { label: "Rótulo", value: geo.label },
                  { label: "Coordenadas", value: <span className="ag-mono">{geo.lat.toFixed(4)}, {geo.lon.toFixed(4)}</span> },
                  { label: "Detalhe", value: geo.detail },
                  { label: "Precisão", value: "aproximada (rede)" },
                ]}
              />
            </div>
          )}
        </Panel>

        <Panel title="Coordinate Converter" description="DD → DMS, DMS → DD e geohash, com cálculo local." icon={<Compass className="h-3.5 w-3.5" />}>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Latitude (DD)"><input className="ag-input" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-23.5505" /></Field>
            <Field label="Longitude (DD)"><input className="ag-input" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="-46.6333" /></Field>
          </div>
          {parsed ? (
            <div className="mt-3 space-y-2">
              <KV
                cols={2}
                items={[
                  { label: "Latitude DMS", value: <span className="ag-mono">{parsed.dms.lat}</span> },
                  { label: "Longitude DMS", value: <span className="ag-mono">{parsed.dms.lon}</span> },
                  { label: "Geohash", value: <span className="ag-mono">{parsed.geohash}</span> },
                  { label: "OpenStreetMap", value: <a href={parsed.osm} target="_blank" rel="noreferrer" className="ag-link">abrir mapa</a> },
                ]}
              />
            </div>
          ) : <Notice tone="warn">Coordenadas inválidas.</Notice>}
          <div className="mt-4 border-t border-[var(--ag-border)] pt-3">
            <Field label="Conversor DMS → DD" hint="Ex.: 23°33′01.8″S 46°37′59.9″W">
              <input className="ag-input" value={dms} onChange={(e) => setDms(e.target.value)} placeholder={`23°33'01.8"S 46°37'59.9"W`} />
            </Field>
            {dms.trim() && (
              <div className="mt-2 space-y-1 text-[11.5px]">
                {(() => {
                  const parts = dms.trim().split(/\s+/);
                  const first = dmsToDd(parts[0] ?? "");
                  const second = dmsToDd(parts.slice(1).join(" ") || parts[0] || "");
                  return (
                    <>
                      <div className="text-[var(--ag-muted)]">Primeiro valor: <span className="ag-mono text-[#dbe7f5]">{first ?? "inválido"}</span></div>
                      {parts.length > 1 && <div className="text-[var(--ag-muted)]">Segundo valor: <span className="ag-mono text-[#dbe7f5]">{second ?? "inválido"}</span></div>}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="GeoJSON Viewer" description="Cole um GeoJSON para renderizar no mapa. O parse acontece no navegador.">
          <Field label="GeoJSON">
            <textarea
              className="ag-textarea ag-mono !text-[10.5px]"
              rows={8}
              value={geojson}
              onChange={(e) => {
                setGeojson(e.target.value);
                setJsonError(null);
                if (e.target.value.trim()) {
                  try { JSON.parse(e.target.value); } catch (err) { setJsonError((err as Error).message); }
                }
              }}
              placeholder='{"type":"FeatureCollection","features":[]}'
            />
          </Field>
          {jsonError && <div className="mt-1 text-[11px] text-rose-300">JSON inválido: {jsonError}</div>}
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => setGeojson(SAMPLE_GEOJSON)}>Carregar exemplo</Button>
            <Button size="sm" variant="ghost" onClick={() => { setGeojson(""); setJsonError(null); }}>Limpar</Button>
          </div>
        </Panel>

        <Panel title="KML Viewer" description="Carregue um KML local; linhas e pontos são convertidos e plotados no mapa.">
          <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-dashed border-[var(--ag-border-strong)] px-3 py-4 text-[12px] text-[var(--ag-muted)] hover:border-cyan-400/40">
            <span className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Selecionar arquivo .kml</span>
            <span className="text-[10.5px] text-[var(--ag-faint)]">processamento local</span>
            <input
              type="file"
              accept=".kml,.xml"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setKml(await f.text());
              }}
            />
          </label>
          {kml && (
            <div className="mt-2 space-y-2">
              <Badge tone="violet">{kml.length.toLocaleString("pt-BR")} caracteres carregados</Badge>
              <pre className="ag-mono max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-[var(--ag-border)] bg-black/30 p-2 text-[10px] text-[var(--ag-muted)]">{kml.slice(0, 1200)}</pre>
              <Button size="sm" variant="ghost" onClick={() => setKml("")}>Remover camada</Button>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Dados públicos recomendados" icon={<ShieldOff className="h-3.5 w-3.5" />}>
        <div className="grid gap-2 text-[11.5px] sm:grid-cols-2 lg:grid-cols-3">
          {[
            { name: "OpenStreetMap", url: "https://www.openstreetmap.org", desc: "Base cartográfica aberta." },
            { name: "Nominatim", url: "https://nominatim.openstreetmap.org", desc: "Geocodificação (respeite 1 req/s)." },
            { name: "Overpass Turbo", url: "https://overpass-turbo.eu", desc: "Consultas OSM por tags." },
            { name: "Natural Earth", url: "https://www.naturalearthdata.com", desc: "Dados vetoriais globais." },
            { name: "IBGE Malhas", url: "https://servicodados.ibge.gov.br/api/docs/malhas", desc: "Limites municipais/estaduais do Brasil." },
            { name: "Wikimapia", url: "https://wikimapia.org", desc: "Marcações colaborativas." },
          ].map((d) => (
            <a key={d.name} href={d.url} target="_blank" rel="noreferrer" className="rounded-lg border border-[var(--ag-border)] px-2.5 py-2 hover:border-cyan-400/40">
              <div className="text-[12px] font-medium text-[#dce8f5]">{d.name}</div>
              <div className="text-[10.5px] text-[var(--ag-faint)]">{d.desc}</div>
            </a>
          ))}
        </div>
        <div className="mt-3">
          <Notice tone="warn" title="Sem rastreamento">
            A plataforma não rastreia pessoas, veículos ou dispositivos. Coordenadas de EXIF são exibidas apenas como metadados técnicos da imagem, quando presentes.
          </Notice>
        </div>
        <div className="mt-3">
          <DataTable rows={[{ recurso: "Tiles OSM", limite: "uso moderado com atribuição", contato: "operations@osmfoundation.org" }]} />
        </div>
        <span className="hidden"><ImageIcon /></span>
      </Panel>
    </div>
  );
}

const SAMPLE_GEOJSON = JSON.stringify({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Área de exemplo" },
      geometry: {
        type: "Polygon",
        coordinates: [[[-46.7, -23.6], [-46.5, -23.6], [-46.5, -23.5], [-46.7, -23.5], [-46.7, -23.6]]],
      },
    },
  ],
}, null, 2);

export function GeoValue({ value }: { value: unknown }) {
  return <ValueView value={value} />;
}
