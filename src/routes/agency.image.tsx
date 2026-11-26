import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Aperture, Download, ExternalLink, ImageOff, Info, MapPin, Upload } from "lucide-react";
import exifr from "exifr";
import { Badge, Button, CopyButton, DataTable, Empty, Field, KV, Notice, PageHeader, Panel, Spinner, ValueView } from "@/components/agency/kit";
import { download, formatBytes, identifyFileType, perceptualHash, sha256Hex, md5 } from "@/lib/agency/format";

export const Route = createFileRoute("/agency/image")({
  head: () => ({ meta: [{ title: "Image Intelligence — Life Agency" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: ImagePage,
});

type ImageReport = {
  name: string;
  size: number;
  type: string;
  mime: string;
  width: number;
  height: number;
  aspect: string;
  orientation?: string;
  hashes: { md5: string; sha256: string; dhash: string };
  meta: Record<string, unknown> | null;
  gps?: { lat: number; lon: number } | null;
  previewUrl: string;
  exifCount: number;
};

const REVERSE_SEARCH = [
  { name: "Google Lens", url: "https://lens.google.com/", desc: "Busca visual do Google." },
  { name: "Bing Visual Search", url: "https://www.bing.com/visualsearch", desc: "Busca visual da Microsoft." },
  { name: "Yandex Images", url: "https://yandex.com/images/", desc: "Boa cobertura de imagens da Europa/Ásia." },
  { name: "TinEye", url: "https://tineye.com/", desc: "Correspondência exata e variações." },
];

function ImagePage() {
  const [report, setReport] = useState<ImageReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removedUrl, setRemovedUrl] = useState<string | null>(null);

  const analyze = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError(null); setReport(null); setRemovedUrl(null);
    try {
      if (file.size > 40 * 1024 * 1024) throw new Error("Imagem maior que 40 MB — reduza o arquivo para análise local.");
      const [buffer, type, bitmap] = await Promise.all([
        file.arrayBuffer(),
        identifyFileType(file),
        createImageBitmap(file).catch(() => null),
      ]);
      const [sha256, dhash] = await Promise.all([sha256Hex(buffer), perceptualHash(file).catch(() => "")]);

      let meta: Record<string, unknown> | null = null;
      try {
        meta = (await exifr.parse(file, { gps: true, tiff: true, exif: true, xmp: true, icc: true, iptc: true, jfif: true })) as Record<string, unknown> | undefined ?? null;
      } catch {
        meta = null;
      }
      if (meta && Object.keys(meta).length === 0) meta = null;

      const lat = meta?.latitude as number | undefined;
      const lon = meta?.longitude as number | undefined;
      setReport({
        name: file.name,
        size: file.size,
        type: type.type,
        mime: type.mime,
        width: bitmap?.width ?? 0,
        height: bitmap?.height ?? 0,
        aspect: bitmap ? (bitmap.width / bitmap.height).toFixed(3) : "—",
        orientation: meta?.Orientation ? String(meta.Orientation) : undefined,
        hashes: { md5: md5(new Uint8Array(buffer)), sha256, dhash },
        meta,
        gps: Number.isFinite(lat) && Number.isFinite(lon) ? { lat: lat as number, lon: lon as number } : null,
        previewUrl: URL.createObjectURL(file),
        exifCount: meta ? Object.keys(meta).length : 0,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const stripMetadata = async () => {
    if (!report) return;
    const img = new Image();
    img.src = report.previewUrl;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setError("Canvas indisponível."); return; }
    ctx.drawImage(img, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      setRemovedUrl(url);
      download(`${report.name.replace(/\.[^.]+$/, "")}-clean.jpg`, blob, "image/jpeg");
    }, "image/jpeg", 0.94);
  };

  const metaRows = report?.meta ? flatten(report.meta).filter(([k]) => !k.startsWith("_")) : [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="OSINT · Mídia"
        title="Image Intelligence"
        subtitle="Metadados EXIF, dimensões, hashes e remoção de metadados — tudo processado localmente no navegador. Nenhuma imagem é enviada a servidores externos."
        actions={<Badge tone="green">processamento local</Badge>}
      />

      <Panel title="Upload e análise" description="A imagem nunca sai deste dispositivo. Aceita JPEG, PNG, WebP, GIF, TIFF, HEIC (conforme suporte do navegador).">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--ag-border-strong)] px-6 py-10 text-center transition-colors hover:border-cyan-400/40 hover:bg-white/[0.02]">
          <Aperture className="h-6 w-6 text-cyan-300" />
          <span className="text-[12.5px] font-medium text-[#dce8f5]">Selecionar imagem para análise</span>
          <span className="text-[11px] text-[var(--ag-faint)]">EXIF · dimensões · MD5 · SHA-256 · dHash</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => void analyze(e.target.files?.[0])} />
        </label>
        {busy && <Spinner label="Lendo metadados e calculando hashes…" />}
        {error && <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/[0.07] p-3 text-[12px] text-rose-200">{error}</div>}

        {report && (
          <div className="mt-4 grid gap-4 lg:grid-cols-[280px_1fr]">
            <div className="space-y-2">
              <img src={report.previewUrl} alt={report.name} className="w-full rounded-xl border border-[var(--ag-border)] object-contain" />
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" onClick={() => void stripMetadata()}><Download className="h-3 w-3" /> Remover metadados</Button>
                <Button size="sm" variant="ghost" onClick={() => download(`${report.name}.hashes.txt`, `md5 ${report.hashes.md5}\nsha256 ${report.hashes.sha256}\ndhash ${report.hashes.dhash}`)}>
                  Exportar hashes
                </Button>
              </div>
              {removedUrl && <a href={removedUrl} download="clean.jpg" className="ag-link block text-[11px]">baixar novamente a versão limpa</a>}
            </div>

            <div className="space-y-4">
              <KV
                cols={3}
                items={[
                  { label: "Arquivo", value: report.name },
                  { label: "Tipo", value: <Badge tone="cyan">{report.type} · {report.mime}</Badge> },
                  { label: "Tamanho", value: formatBytes(report.size) },
                  { label: "Dimensões", value: report.width ? `${report.width} × ${report.height}` : "—" },
                  { label: "Proporção", value: report.aspect },
                  { label: "Campos de metadados", value: report.exifCount },
                ]}
              />

              <div className="space-y-1.5">
                {(["md5", "sha256", "dhash"] as const).map((k) => (
                  <div key={k} className="rounded-lg border border-[var(--ag-border)] bg-black/25 px-2.5 py-1.5">
                    <div className="flex items-center justify-between">
                      <span className="ag-label">{k === "dhash" ? "dHash perceptual (64-bit)" : k}</span>
                      <CopyButton value={report.hashes[k]} />
                    </div>
                    <div className="ag-mono mt-0.5 break-all text-[10.5px] text-[#c7d6e6]">{report.hashes[k] || "—"}</div>
                  </div>
                ))}
              </div>

              {report.gps ? (
                <div className="rounded-xl border border-amber-500/35 bg-amber-500/[0.06] p-3">
                  <div className="flex items-center gap-2 text-[12px] font-semibold text-amber-200"><MapPin className="h-3.5 w-3.5" /> Coordenadas EXIF registradas</div>
                  <div className="ag-mono mt-1 text-[11.5px] text-amber-100/90">{report.gps.lat.toFixed(6)}, {report.gps.lon.toFixed(6)}</div>
                  <a href={`https://www.openstreetmap.org/?mlat=${report.gps.lat}&mlon=${report.gps.lon}#map=15/${report.gps.lat}/${report.gps.lon}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[10.5px] text-amber-200 hover:underline">
                    Ver no mapa <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                  <p className="mt-1 text-[10.5px] text-amber-100/70">Metadado técnico da câmera/dispositivo — não inferimos a localização de pessoas.</p>
                </div>
              ) : (
                <Notice tone="info" title="Sem coordenadas EXIF">A imagem não contém GPS ou os metadados foram removidos por um serviço/editor.</Notice>
              )}
            </div>
          </div>
        )}
      </Panel>

      {report && (
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <Panel title={`EXIF / Metadata Viewer (${metaRows.length} campos)`} description="Valores lidos localmente, sem normalização artificial.">
            {metaRows.length ? (
              <div className="max-h-[520px] overflow-auto pr-1">
                <DataTable rows={metaRows.map(([key, value]) => ({ campo: key, valor: value }))} maxRows={300} columns={["campo", "valor"]} />
              </div>
            ) : (
              <Empty title="Nenhum metadado legível" hint="A imagem pode ter sido otimizada, capturada de tela ou ter metadados removidos." icon={<ImageOff className="h-6 w-6" />} />
            )}
          </Panel>

          <div className="space-y-5">
            <Panel title="Reverse Image Search" description="Buscas reversas exigem upload manual no serviço escolhido — a plataforma não envia sua imagem.">
              <ul className="space-y-1.5">
                {REVERSE_SEARCH.map((r) => (
                  <li key={r.name}>
                    <a href={r.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-lg border border-[var(--ag-border)] px-2.5 py-2 hover:border-cyan-400/40">
                      <span>
                        <span className="block text-[12px] text-[#dce8f5]">{r.name}</span>
                        <span className="block text-[10px] text-[var(--ag-faint)]">{r.desc}</span>
                      </span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-[var(--ag-faint)]" />
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Boas práticas" icon={<Info className="h-3.5 w-3.5" />}>
              <ul className="space-y-1.5 text-[11.5px] leading-relaxed text-[var(--ag-muted)]">
                <li>• dHash identifica imagens visualmente semelhantes; use junto com SHA-256 (match exato).</li>
                <li>• &quot;Remover metadados&quot; reencoda a imagem em JPEG, eliminando EXIF/XMP — perda de qualidade mínima.</li>
                <li>• Não tentamos reconhecer rostos nem inferir identidade.</li>
              </ul>
            </Panel>
          </div>
        </div>
      )}

      <Panel title="Analisador de formato" description="Leitura técnica do arquivo enviado.">
        {report ? (
          <KV
            cols={4}
            items={[
              { label: "Assinatura", value: report.type },
              { label: "MIME", value: report.mime },
              { label: "Orientação EXIF", value: report.orientation ?? "não informada" },
              { label: "Megapixels", value: report.width ? `${((report.width * report.height) / 1_000_000).toFixed(2)} MP` : "—" },
            ]}
          />
        ) : (
          <div className="text-[11.5px] text-[var(--ag-faint)]">Envie uma imagem para ver a análise de formato.</div>
        )}
        <div className="mt-4">
          <Field label="Hash de texto (imagens não são necessárias)">
            <ValueView value={null} />
          </Field>
        </div>
        <span className="hidden"><Upload /></span>
      </Panel>
    </div>
  );
}

function flatten(obj: Record<string, unknown>, prefix = ""): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v === null || v === undefined) continue;
    if (v instanceof Date) rows.push([key, v.toISOString()]);
    else if (typeof v === "object") {
      if (Array.isArray(v)) rows.push([key, v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ")]);
      else if (ArrayBuffer.isView(v)) rows.push([key, `${(v as Uint8Array).length} bytes`]);
      else rows.push(...flatten(v as Record<string, unknown>, key));
    } else rows.push([key, String(v)]);
  }
  return rows;
}
