/**
 * Motor de PDF Life+ (vetorial, A4 real, sem captura de tela).
 *
 * Layout institucional compartilhado: cabeçalho fixo, identificação do paciente,
 * blocos por tipo de documento, assinatura, autenticidade e rodapé repetido.
 */
import { Document, Page, Text, View, Image, Font } from "@react-pdf/renderer";
import type { PaperBlock, PaperModel, MedLine } from "./model";

/* --------------------------------- fontes --------------------------------- */

let fontsReady = false;

/** Registra as fontes do papel timbrado. `base` permite usar caminho de arquivo no Node. */
export function ensureFonts(base?: string) {
  if (fontsReady) return;
  const dir = base ?? (typeof window === "undefined" ? "public/fonts" : "/fonts");
  Font.register({
    family: "Life Sans",
    fonts: [
      { src: `${dir}/instrument-sans-400.ttf`, fontWeight: 400 },
      { src: `${dir}/instrument-sans-600.ttf`, fontWeight: 600 },
    ],
  });
  Font.register({
    family: "Life Serif",
    fonts: [
      { src: `${dir}/newsreader-400.ttf`, fontWeight: 400 },
      { src: `${dir}/newsreader-600.ttf`, fontWeight: 600 },
    ],
  });
  // Português não deve ser hifenizado no papel timbrado.
  Font.registerHyphenationCallback((word) => [word]);
  fontsReady = true;
}

/* --------------------------------- tokens --------------------------------- */

const INK = "#16212b";
const MUTED = "#5d6a73";
const FAINT = "#8b959d";
const LINE = "#dde3e8";
const PANEL = "#f6f8f9";

const hex = (h: string) => {
  const clean = h.replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean.padEnd(6, "0").slice(0, 6);
  return [parseInt(full.slice(0, 2), 16) || 0, parseInt(full.slice(2, 4), 16) || 0, parseInt(full.slice(4, 6), 16) || 0];
};
const rgb = (v: number[]) => "#" + v.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("");
/** Mistura uma cor com branco (0 = cor original, 1 = branco). */
const tint = (h: string, amount: number) => rgb(hex(h).map((c) => c + (255 - c) * amount));
const shade = (h: string, amount: number) => rgb(hex(h).map((c) => c * (1 - amount)));

const pt = (mm: number) => (mm * 72) / 25.4; // mm → pt

/* -------------------------------- documento -------------------------------- */

export function DocPdf({ model }: { model: PaperModel }) {
  ensureFonts();
  const { style, institution } = model;
  const sans = "Life Sans";
  const body = style.family === "sans" ? sans : "Life Serif";
  const fs = 9.8 * style.scale;
  const lh = 1.52 * style.spacing;
  const margin = pt(style.marginMm);
  const accent = style.accent;
  const accentSoft = tint(accent, 0.92);
  const headingAlign = style.headingAlign;

  const headerTop = 32;
  const contentTop = headerTop + 70;

  return (
    <Document
      title={`${model.title}${model.code ? " · " + model.code : ""}`}
      author={institution.name}
      subject={model.kicker}
      creator="Life+ · Central de documentos"
      producer="Life+ Document Engine"
    >
      <Page
        size="A4"
        style={{
          backgroundColor: "#ffffff",
          paddingTop: contentTop,
          paddingBottom: 86,
          paddingHorizontal: margin,
          fontFamily: body,
          fontSize: fs,
          lineHeight: lh,
          color: INK,
        }}
      >
        {/* ------------------------------ header ------------------------------ */}
        <View fixed style={{ position: "absolute", top: headerTop, left: 0, right: 0, paddingHorizontal: margin }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {institution.logoUrl ? (
                <Image src={institution.logoUrl} style={{ width: 34, height: 34, marginRight: 10, objectFit: "contain" }} />
              ) : style.logoMark ? (
                <View style={{ width: 3, height: 34, backgroundColor: accent, marginRight: 10, borderRadius: 1 }} />
              ) : null}
              <View>
                <Text style={{ fontFamily: sans, fontSize: 15.5, fontWeight: 600, letterSpacing: 1.8, color: INK }}>
                  {(institution.name || "LIFE+").toUpperCase()}
                </Text>
                <Text style={{ fontFamily: sans, fontSize: 5.6, letterSpacing: 1.5, color: MUTED, marginTop: 3 }}>
                  HOSPITAL PARTICULAR · REDE LIFE+
                </Text>
              </View>
            </View>

            <View style={{ maxWidth: 210, alignItems: "flex-end" }}>
              {institution.address ? <Text style={{ fontFamily: sans, fontSize: 6.3, color: MUTED, lineHeight: 1.5, textAlign: "right" }}>{institution.address}</Text> : null}
              {institution.phone || institution.email ? (
                <Text style={{ fontFamily: sans, fontSize: 6.3, color: MUTED, lineHeight: 1.5, textAlign: "right", marginTop: 1 }}>
                  {[institution.phone, institution.email].filter(Boolean).join("  ·  ")}
                </Text>
              ) : null}
              {institution.cnpj ? <Text style={{ fontFamily: sans, fontSize: 6.3, color: FAINT, lineHeight: 1.5, textAlign: "right", marginTop: 1 }}>CNPJ {institution.cnpj}</Text> : null}
              {institution.sector ? (
                <Text style={{ fontFamily: sans, fontSize: 6.3, fontWeight: 600, color: accent, letterSpacing: 0.8, textAlign: "right", marginTop: 2 }}>
                  {institution.sector.toUpperCase()}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={{ height: 0.9, backgroundColor: accent, marginTop: 10, opacity: 0.85 }} />
          <View style={{ height: 0.4, backgroundColor: tint(accent, 0.6), marginTop: 1.4 }} />
        </View>

        {/* ------------------------------- título ----------------------------- */}
        <View style={{ marginBottom: 11 * style.spacing }}>
          <Text style={{ fontFamily: sans, fontSize: 6, letterSpacing: 1.7, color: accent, textAlign: headingAlign, fontWeight: 600 }}>
            {model.kicker.toUpperCase()}
          </Text>
          <Text style={{ fontFamily: sans, fontSize: 16.5, fontWeight: 600, letterSpacing: 0.9, color: INK, textAlign: headingAlign, marginTop: 5 }}>
            {model.title.toUpperCase()}
          </Text>
          <View style={{ flexDirection: "row", justifyContent: headingAlign === "center" ? "center" : "flex-start", marginTop: 7 }}>
            <View style={{ width: 54, height: 1.4, backgroundColor: accent }} />
          </View>
        </View>

        {/* --------------------------- identificação -------------------------- */}
        {model.patient ? <PatientBlock model={model} /> : null}

        {/* ------------------------------ conteúdo ---------------------------- */}
        {model.blocks.length ? (
          model.blocks.map((b, i) => <Block key={i} block={b} model={model} />)
        ) : (
          <Text style={{ color: FAINT, fontSize: fs * 0.92, fontFamily: "Life Serif" }}>Documento sem conteúdo — preencha os campos ao lado para visualizar.</Text>
        )}

        {/* ----------------------------- assinatura --------------------------- */}
        <Signature model={model} />

        {/* ------------------------------- rodapé ----------------------------- */}
        <View fixed style={{ position: "absolute", top: 762, left: 0, right: 0, paddingHorizontal: margin }}>
          <View style={{ height: 0.5, backgroundColor: LINE, marginBottom: 6 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ maxWidth: 300 }}>
              <Text style={{ fontFamily: sans, fontSize: 6.4, fontWeight: 600, letterSpacing: 0.6, color: MUTED }}>
                {(institution.name || "LIFE+").toUpperCase()}
              </Text>
              <Text style={{ fontFamily: sans, fontSize: 6, color: FAINT, marginTop: 1.5, lineHeight: 1.4 }}>
                {[institution.address, institution.phone].filter(Boolean).join(" · ")}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontFamily: sans, fontSize: 6, color: MUTED, letterSpacing: 0.4 }}>
                {model.code ? model.code : "SEM REGISTRO"} · {model.emittedAt}
              </Text>
              <Text style={{ fontFamily: sans, fontSize: 5.6, color: FAINT, marginTop: 1.5 }}>
                {model.templateName ? `Modelo ${model.templateName}` : "Documento institucional de roleplay"}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 5 }}>
            <Text style={{ fontFamily: sans, fontSize: 5, color: FAINT, letterSpacing: 0.5, flex: 1 }}>{model.disclaimer}</Text>
            <Text
              style={{ fontFamily: sans, fontSize: 5.8, color: FAINT, marginLeft: 10 }}
              render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
            />
          </View>
        </View>

      </Page>
    </Document>
  );
}

/* --------------------------- identificação do paciente --------------------- */

function PatientBlock({ model }: { model: PaperModel }) {
  const p = model.patient;
  if (!p) return null;
  const sans = "Life Sans";
  const cells: { label: string; value: string }[] = [];
  if (p.code) cells.push({ label: "Código do paciente", value: p.code });
  if (p.birth) cells.push({ label: "Data de nascimento", value: p.birth });
  if (p.age != null) cells.push({ label: "Idade", value: `${p.age} anos` });
  if (p.insurance) cells.push({ label: "Convênio", value: p.insurance });
  if (p.blood) cells.push({ label: "Tipo sanguíneo", value: p.blood });
  const rows: { label: string; value: string }[][] = [];
  for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2));

  return (
    <View style={{ borderWidth: 0.6, borderColor: LINE, backgroundColor: PANEL, borderRadius: 2, padding: 8, paddingBottom: 6, marginBottom: 12 * model.style.spacing }}>
      <View style={{ marginBottom: 6 }}>
        <Text style={{ fontFamily: sans, fontSize: 5.6, letterSpacing: 1.1, color: FAINT, marginBottom: 1.6 }}>PACIENTE</Text>
        <Text style={{ fontFamily: sans, fontSize: 9.6, fontWeight: 600, color: INK }}>{p.name}</Text>
      </View>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: "row", marginTop: i === 0 ? 0 : 4.5 }}>
          {row.map((c) => (
            <View key={c.label} style={{ width: "50%", paddingRight: 8 }}>
              <Text style={{ fontFamily: sans, fontSize: 5.6, letterSpacing: 1.1, color: FAINT }}>{c.label.toUpperCase()}</Text>
              <Text style={{ fontFamily: sans, fontSize: 8.1, color: INK, marginTop: 1 }}>{c.value}</Text>
            </View>
          ))}
          {row.length === 1 ? <View style={{ width: "50%" }} /> : null}
        </View>
      ))}
    </View>
  );
}

/* --------------------------------- blocos --------------------------------- */

function Block({ block, model }: { block: PaperBlock; model: PaperModel }) {
  switch (block.t) {
    case "prose":
      return <Prose text={block.text} model={model} />;
    case "section":
      return <Section block={block} model={model} />;
    case "fields":
      return <Fields items={block.items} columns={block.columns ?? 2} model={model} />;
    case "meds":
      return <Meds items={block.items} orientation={block.orientation} model={model} />;
    case "exams":
      return <Exams block={block} model={model} />;
    case "callout":
      return <Callout label={block.label} text={block.text} model={model} />;
    case "table":
      return <TableBlock head={block.head} rows={block.rows} model={model} />;
    default:
      return null;
  }
}

function Prose({ text, model }: { text: string; model: PaperModel }) {
  const paras = text.split(/\n{2,}/).filter((p) => p.trim());
  return (
    <View>
      {paras.map((p, i) => (
        <Text key={i} style={{ textAlign: "justify", marginBottom: 7.5 * model.style.spacing }}>
          {p.trim()}
        </Text>
      ))}
    </View>
  );
}

function Section({ block, model }: { block: Extract<PaperBlock, { t: "section" }>; model: PaperModel }) {
  const sans = "Life Sans";
  const { accent } = model.style;
  const lines = block.text ? block.text.split(/\n{2,}/).filter((l) => l.trim()) : [];
  return (
    <View style={{ marginBottom: 9 * model.style.spacing }} minPresenceAhead={64}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4.5 }} wrap={false}>
        <Text style={{ fontFamily: sans, fontSize: 6.6, fontWeight: 600, letterSpacing: 1.3, color: accent }}>{block.title.toUpperCase()}</Text>
        <View style={{ flex: 1, height: 0.5, backgroundColor: LINE, marginLeft: 8 }} />
      </View>
      {lines.map((p, i) => (
        <Text key={i} style={{ textAlign: "justify", marginBottom: i === lines.length - 1 ? 0 : 6 }}>{p.trim()}</Text>
      ))}
      {block.bullets?.filter(Boolean).length ? (
        <View style={{ marginTop: 2 }}>
          {block.bullets.filter(Boolean).map((b, i) => (
            <View key={i} style={{ flexDirection: "row", marginBottom: 2.6 }} wrap={false}>
              <Text style={{ fontFamily: sans, fontSize: 7, color: accent, width: 14 }}>{block.numbered ? `${i + 1}.` : "•"}</Text>
              <Text style={{ flex: 1 }}>{b}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Fields({ items, columns, model }: { items: { label: string; value: string }[]; columns: number; model: PaperModel }) {
  const sans = "Life Sans";
  if (!items.length) return null;
  const rows: { label: string; value: string }[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  return (
    <View style={{ borderTopWidth: 0.5, borderTopColor: LINE, paddingTop: 8, marginBottom: 12 * model.style.spacing }} wrap={false}>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: "row", marginTop: i === 0 ? 0 : 6 }}>
          {row.map((c) => (
            <View key={c.label} style={{ width: `${100 / columns}%`, paddingRight: 8 }}>
              <Text style={{ fontFamily: sans, fontSize: 5.6, letterSpacing: 1.1, color: FAINT }}>{c.label.toUpperCase()}</Text>
              <Text style={{ fontFamily: sans, fontSize: 8.4, color: INK, marginTop: 1 }}>{c.value}</Text>
            </View>
          ))}
          {Array.from({ length: columns - row.length }).map((_, k) => <View key={k} style={{ width: `${100 / columns}%` }} />)}
        </View>
      ))}
    </View>
  );
}

function Meds({ items, orientation, model }: { items: MedLine[]; orientation?: string; model: PaperModel }) {
  const sans = "Life Sans";
  const { accent } = model.style;
  return (
    <View>
      {items.map((m, i) => (
        <View key={i} wrap={false} style={{ marginBottom: 8, paddingBottom: 7, borderBottomWidth: i === items.length - 1 ? 0 : 0.5, borderBottomColor: LINE }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <View style={{ width: 15, height: 15, borderRadius: 7.5, backgroundColor: tint(accent, 0.86), alignItems: "center", justifyContent: "center", marginRight: 7, marginTop: 1 }}>
              <Text style={{ fontFamily: sans, fontSize: 7, fontWeight: 600, color: shade(accent, 0.15) }}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Life Serif", fontSize: 11, fontWeight: 600, color: INK }}>
                {m.name}
                {m.concentration ? <Text style={{ fontFamily: sans, fontSize: 8.4, fontWeight: 400, color: MUTED }}>{`  ${m.concentration}`}</Text> : null}
              </Text>
              {m.presentation || m.qty ? (
                <Text style={{ fontFamily: sans, fontSize: 7.4, color: MUTED, marginTop: 1.5 }}>
                  {[m.presentation, m.qty ? `Quantidade: ${m.qty}` : ""].filter(Boolean).join("  ·  ")}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={{ flexDirection: "row", marginLeft: 22, marginTop: 4 }}>
            {[
              { label: "Dose", value: m.dose },
              { label: "Via", value: m.route },
              { label: "Frequência", value: m.frequency },
              { label: "Duração", value: m.duration },
            ].map((c) => (
              <View key={c.label} style={{ width: "25%", paddingRight: 6 }}>
                <Text style={{ fontFamily: sans, fontSize: 5.4, letterSpacing: 0.9, color: FAINT }}>{c.label.toUpperCase()}</Text>
                <Text style={{ fontFamily: sans, fontSize: 7.8, color: INK, marginTop: 0.8 }}>{c.value || "—"}</Text>
              </View>
            ))}
          </View>

          {m.notes ? (
            <Text style={{ fontFamily: "Life Serif", fontSize: 8, color: MUTED, marginLeft: 22, marginTop: 3 }}>Obs.: {m.notes}</Text>
          ) : null}
        </View>
      ))}

      {orientation ? (
        <View style={{ marginTop: 2 }} wrap={false}>
          <Text style={{ fontFamily: sans, fontSize: 6.2, fontWeight: 600, letterSpacing: 1.2, color: accent, marginBottom: 3 }}>ORIENTAÇÕES</Text>
          <Text style={{ textAlign: "justify" }}>{orientation}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Exams({ block, model }: { block: Extract<PaperBlock, { t: "exams" }>; model: PaperModel }) {
  const sans = "Life Sans";
  const { accent } = model.style;
  const groups = new Map<string, string[]>();
  block.items.forEach((e) => {
    const key = e.category || "Exames";
    groups.set(key, [...(groups.get(key) ?? []), e.name]);
  });
  let index = 0;
  return (
    <View>
      {Array.from(groups.entries()).map(([category, names]) => (
        <View key={category} style={{ marginBottom: 8 }}>
          <Text style={{ fontFamily: sans, fontSize: 6, fontWeight: 600, letterSpacing: 1.2, color: FAINT, marginBottom: 3 }}>{category.toUpperCase()}</Text>
          {names.map((name) => {
            index += 1;
            return (
              <View key={name} style={{ flexDirection: "row", paddingVertical: 3.6, borderBottomWidth: 0.5, borderBottomColor: LINE }} wrap={false}>
                <Text style={{ fontFamily: sans, fontSize: 7, color: accent, width: 16 }}>{String(index).padStart(2, "0")}</Text>
                <Text style={{ flex: 1, fontFamily: sans, fontSize: 8.8, color: INK }}>{name}</Text>
              </View>
            );
          })}
        </View>
      ))}

      {block.justification ? (
        <View style={{ marginTop: 4 }} wrap={false}>
          <Text style={{ fontFamily: sans, fontSize: 6.2, fontWeight: 600, letterSpacing: 1.2, color: accent, marginBottom: 3 }}>JUSTIFICATIVA CLÍNICA</Text>
          <Text style={{ textAlign: "justify" }}>{block.justification}</Text>
        </View>
      ) : null}
      {block.observations ? (
        <View style={{ marginTop: 8 }} wrap={false}>
          <Text style={{ fontFamily: sans, fontSize: 6.2, fontWeight: 600, letterSpacing: 1.2, color: accent, marginBottom: 3 }}>OBSERVAÇÕES</Text>
          <Text style={{ textAlign: "justify" }}>{block.observations}</Text>
        </View>
      ) : null}
    </View>
  );
}

function TableBlock({ head, rows, model }: { head: string[]; rows: string[][]; model: PaperModel }) {
  const sans = "Life Sans";
  const { accent } = model.style;
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", backgroundColor: tint(accent, 0.93), borderTopWidth: 0.6, borderBottomWidth: 0.6, borderColor: tint(accent, 0.72), paddingVertical: 4 }} wrap={false}>
        {head.map((h, i) => (
          <Text key={i} style={{ flex: i === 0 ? 1.6 : 1, paddingHorizontal: 4, fontFamily: sans, fontSize: 5.8, fontWeight: 600, letterSpacing: 0.8, color: shade(accent, 0.15) }}>
            {h.toUpperCase()}
          </Text>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} style={{ flexDirection: "row", borderBottomWidth: 0.4, borderBottomColor: LINE, paddingVertical: 3.2 }} wrap={false}>
          {r.map((c, ci) => (
            <Text key={ci} style={{ flex: ci === 0 ? 1.6 : 1, paddingHorizontal: 4, fontFamily: sans, fontSize: 7.2, color: INK }}>
              {String(c ?? "")}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function Callout({ label, text, model }: { label: string; text: string; model: PaperModel }) {
  const sans = "Life Sans";
  const { accent } = model.style;
  return (
    <View wrap={false} style={{ flexDirection: "row", marginBottom: 10, backgroundColor: tint(accent, 0.94), padding: 8, borderRadius: 2 }}>
      <View style={{ width: 2, backgroundColor: accent, marginRight: 8, borderRadius: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: sans, fontSize: 6, fontWeight: 600, letterSpacing: 1.2, color: shade(accent, 0.1), marginBottom: 2.5 }}>{label.toUpperCase()}</Text>
        <Text style={{ textAlign: "justify" }}>{text}</Text>
      </View>
    </View>
  );
}

/* -------------------------------- assinatura ------------------------------- */

function Signature({ model }: { model: PaperModel }) {
  const sans = "Life Sans";
  const style = model.style;
  const signatureUrl = model.institution.signatureUrl;
  const who = model.staff;
  return (
    <View wrap={false} style={{ marginTop: 10 * style.spacing, alignItems: "center" }}>
      {model.city ? (
        <Text style={{ fontFamily: sans, fontSize: 8, color: MUTED, marginBottom: 9 }}>
          {model.city}, {model.emittedAt}.
        </Text>
      ) : (
        <Text style={{ fontFamily: sans, fontSize: 8, color: MUTED, marginBottom: 9 }}>{model.emittedAt}</Text>
      )}

      {signatureUrl ? <Image src={signatureUrl} style={{ height: 26, width: 110, objectFit: "contain", marginBottom: 1 }} /> : null}
      <View style={{ width: 200, height: 0.8, backgroundColor: INK, marginBottom: 3.5 }} />
      <Text style={{ fontFamily: sans, fontSize: 9.2, fontWeight: 600, color: INK }}>{who?.name ?? "Profissional responsável"}</Text>
      <Text style={{ fontFamily: sans, fontSize: 7.2, color: MUTED, marginTop: 1 }}>
        {[who?.roleLabel, who?.specialty, model.institution.name].filter(Boolean).join(" · ") || "Profissional da instituição"}
      </Text>
      {who?.registry ? <Text style={{ fontFamily: sans, fontSize: 7.2, color: MUTED, marginTop: 0.5 }}>Registro {who.registry}</Text> : null}

      <Text style={{ fontFamily: sans, fontSize: 5.4, color: FAINT, letterSpacing: 0.4, textAlign: "center", marginTop: 4, maxWidth: 380 }}>
        {model.signatureNote} · {model.authenticity}
      </Text>
    </View>
  );
}
