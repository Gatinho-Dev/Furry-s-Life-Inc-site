/**
 * Client-side analysis helpers: hashing, file inspection, subnet math,
 * CVSS 3.1 scoring, coordinate conversion and export utilities.
 * Everything here runs locally in the browser.
 */

/* ------------------------------- hashing --------------------------------- */

export function md5(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const len = bytes.length;
  const withPadding = new Uint8Array((((len + 8) >> 6) + 1) * 64);
  withPadding.set(bytes);
  withPadding[len] = 0x80;
  const bitLen = len * 8;
  const view = new DataView(withPadding.buffer);
  view.setUint32(withPadding.length - 8, bitLen >>> 0, true);
  view.setUint32(withPadding.length - 4, Math.floor(bitLen / 4294967296), true);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const M = new Uint32Array(16);

  for (let off = 0; off < withPadding.length; off += 64) {
    for (let i = 0; i < 16; i++) M[i] = view.getUint32(off + i * 4, true);
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number, g: number;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D; D = C; C = B;
      B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  const out = new Uint8Array(16);
  const ov = new DataView(out.buffer);
  ov.setUint32(0, a0, true); ov.setUint32(4, b0, true); ov.setUint32(8, c0, true); ov.setUint32(12, d0, true);
  return [...out].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  let buf: ArrayBuffer;
  if (typeof data === "string") buf = new TextEncoder().encode(data).buffer as ArrayBuffer;
  else if (data instanceof Uint8Array) buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  else buf = data;
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha1Hex(data: ArrayBuffer | string): Promise<string> {
  const buf = typeof data === "string" ? (new TextEncoder().encode(data).buffer as ArrayBuffer) : data;
  const digest = await crypto.subtle.digest("SHA-1", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Difference hash (dHash) 8x8 = 64 bits, computed locally on a canvas. */
export async function perceptualHash(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = 9; canvas.height = 8;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.drawImage(bitmap, 0, 0, 9, 8);
  const { data } = ctx.getImageData(0, 0, 9, 8);
  let bits = "";
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const i = (y * 9 + x) * 4;
      const j = (y * 9 + x + 1) * 4;
      const l1 = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const l2 = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
      bits += l1 > l2 ? "1" : "0";
    }
  }
  let hex = "";
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

/* ----------------------------- file inspection ---------------------------- */

const MAGIC: Array<[string, number[], string]> = [
  ["PNG", [0x89, 0x50, 0x4e, 0x47], "image/png"],
  ["JPEG", [0xff, 0xd8, 0xff], "image/jpeg"],
  ["GIF", [0x47, 0x49, 0x46, 0x38], "image/gif"],
  ["WEBP", [0x52, 0x49, 0x46, 0x46], "image/webp"],
  ["PDF", [0x25, 0x50, 0x44, 0x46], "application/pdf"],
  ["ZIP/OOXML", [0x50, 0x4b, 0x03, 0x04], "application/zip"],
  ["ELF", [0x7f, 0x45, 0x4c, 0x46], "application/x-elf"],
  ["PE (Windows)", [0x4d, 0x5a], "application/vnd.microsoft.portable-executable"],
  ["SQLite", [0x53, 0x51, 0x4c, 0x69], "application/vnd.sqlite3"],
  ["7z", [0x37, 0x7a, 0xbc, 0xaf], "application/x-7z-compressed"],
  ["GZIP", [0x1f, 0x8b], "application/gzip"],
];

export async function identifyFileType(file: File): Promise<{ type: string; mime: string; hex: string }> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const hex = [...head].map((b) => b.toString(16).padStart(2, "0")).join(" ");
  for (const [name, sig, mime] of MAGIC) {
    if (sig.every((b, i) => head[i] === b)) {
      return { type: name, mime, hex };
    }
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const byExt: Record<string, string> = {
    txt: "Texto simples", csv: "CSV", json: "JSON", md: "Markdown",
    docx: "Office Open XML (Word)", xlsx: "Office Open XML (Excel)", pptx: "Office Open XML (PowerPoint)",
    mp4: "MP4", mp3: "MP3", wav: "WAV",
  };
  return { type: byExt[ext] ?? "Desconhecido", mime: file.type || "application/octet-stream", hex };
}

/* --------------------------------- subnet -------------------------------- */

export type SubnetInfo = {
  version: 4 | 6;
  network: string;
  broadcast: string | null;
  firstHost: string | null;
  lastHost: string | null;
  prefix: number;
  netmask: string;
  wildcard: string;
  totalAddresses: string;
  usableHosts: string;
  isPrivate: boolean;
  cidr: string;
};

function ipv4ToBigInt(ip: string): bigint {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) throw new Error("IPv4 inválido");
  return parts.reduce((acc, p) => (acc << 8n) + BigInt(p), 0n);
}
function bigIntToIpv4(n: bigint): string {
  return [24n, 16n, 8n, 0n].map((s) => Number((n >> s) & 255n)).join(".");
}

function expandIpv6(ip: string): bigint {
  const [head, tail] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = tail !== undefined && tail !== "" ? tail.split(":") : [];
  const missing = 8 - (h.length + t.length);
  if (nextMissing(missing)) throw new Error("IPv6 inválido");
  const groups = [...h, ...Array(Math.max(missing, 0)).fill("0"), ...t];
  if (groups.length !== 8) throw new Error("IPv6 inválido");
  let out = 0n;
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) throw new Error("IPv6 inválido");
    out = (out << 16n) + BigInt(parseInt(g, 16));
  }
  return out;
}
function nextMissing(n: number) { return n < 0; }

function bigIntToIpv6(n: bigint): string {
  const groups: string[] = [];
  for (let i = 7; i >= 0; i--) groups.push(((n >> BigInt(i * 16)) & 0xffffn).toString(16));
  let best = { start: -1, len: 0 };
  let cur = { start: -1, len: 0 };
  groups.forEach((g, i) => {
    if (g === "0") {
      if (cur.start < 0) cur = { start: i, len: 0 };
      cur.len++;
      if (cur.len > best.len) best = { ...cur };
    } else cur = { start: -1, len: 0 };
  });
  if (best.len < 2) return groups.join(":");
  return `${groups.slice(0, best.start).join(":")}::${groups.slice(best.start + best.len).join(":")}`;
}

const PRIVATE_V4 = [
  [ipv4ToBigInt("10.0.0.0"), 8],
  [ipv4ToBigInt("172.16.0.0"), 12],
  [ipv4ToBigInt("192.168.0.0"), 16],
  [ipv4ToBigInt("127.0.0.0"), 8],
  [ipv4ToBigInt("169.254.0.0"), 16],
  [ipv4ToBigInt("100.64.0.0"), 10],
] as const;

export function isPrivateIpv4(ip: string): boolean {
  try {
    const n = ipv4ToBigInt(ip);
    return PRIVATE_V4.some(([base, bits]) => (n >> BigInt(32 - bits)) === (base >> BigInt(32 - bits)));
  } catch { return false; }
}

export function parseCidr(input: string): SubnetInfo {
  const raw = input.trim();
  const [addr, prefixRaw] = raw.split("/");
  const isV6 = addr.includes(":");
  const maxPrefix = isV6 ? 128 : 32;
  const prefix = prefixRaw === undefined || prefixRaw === "" ? maxPrefix : Number(prefixRaw);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > maxPrefix) throw new Error("Prefixo inválido");

  if (isV6) {
    const value = expandIpv6(addr);
    const hostBits = BigInt(maxPrefix - prefix);
    const mask = hostBits === 0n ? ~0n : ((1n << 128n) - 1n) ^ ((1n << hostBits) - 1n);
    const network = value & mask;
    const last = network | ((1n << hostBits) - 1n);
    const total = 1n << hostBits;
    return {
      version: 6,
      network: bigIntToIpv6(network),
      broadcast: null,
      firstHost: prefix >= 127 ? null : bigIntToIpv6(network + 1n),
      lastHost: prefix >= 127 ? null : bigIntToIpv6(last - 1n),
      prefix,
      netmask: bigIntToIpv6(mask),
      wildcard: bigIntToIpv6(((1n << 128n) - 1n) ^ mask),
      totalAddresses: total.toString(),
      usableHosts: prefix >= 127 ? "0" : (total - 2n).toString(),
      isPrivate: /^f[cd]|^fe80/.test(bigIntToIpv6(network)),
      cidr: `${bigIntToIpv6(network)}/${prefix}`,
    };
  }

  const value = ipv4ToBigInt(addr);
  const hostBits = BigInt(32 - prefix);
  const mask = hostBits === 0n ? 0xffffffffn : (((1n << 32n) - 1n) ^ ((1n << hostBits) - 1n));
  const network = value & mask;
  const broadcast = network | ((1n << hostBits) - 1n);
  const total = 1n << hostBits;
  const usable = prefix >= 31 ? total : total - 2n;
  return {
    version: 4,
    network: bigIntToIpv4(network),
    broadcast: bigIntToIpv4(broadcast),
    firstHost: prefix >= 31 ? bigIntToIpv4(network) : bigIntToIpv4(network + 1n),
    lastHost: prefix >= 31 ? bigIntToIpv4(broadcast) : bigIntToIpv4(broadcast - 1n),
    prefix,
    netmask: bigIntToIpv4(mask),
    wildcard: bigIntToIpv4(((1n << 32n) - 1n) ^ mask),
    totalAddresses: total.toString(),
    usableHosts: usable.toString(),
    isPrivate: isPrivateIpv4(bigIntToIpv4(network)),
    cidr: `${bigIntToIpv4(network)}/${prefix}`,
  };
}

/* ---------------------------------- CVSS 3.1 ------------------------------ */

export type CvssMetrics = {
  AV: "N" | "A" | "L" | "P";
  AC: "L" | "H";
  PR: "N" | "L" | "H";
  UI: "N" | "R";
  S: "U" | "C";
  C: "H" | "L" | "N";
  I: "H" | "L" | "N";
  A: "H" | "L" | "N";
};

const W = {
  AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
  AC: { L: 0.77, H: 0.44 },
  UI: { N: 0.85, R: 0.62 },
  CIA: { H: 0.56, L: 0.22, N: 0 },
};

export function cvss31Score(m: CvssMetrics): { score: number; severity: string; vector: string } {
  const iss = 1 - (1 - W.CIA[m.C]) * (1 - W.CIA[m.I]) * (1 - W.CIA[m.A]);
  const impact = m.S === "U" ? 6.42 * iss : 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15);
  const pr = m.S === "U"
    ? { N: 0.85, L: 0.62, H: 0.27 }[m.PR]
    : { N: 0.85, L: 0.68, H: 0.5 }[m.PR];
  const exploitability = 8.22 * W.AV[m.AV] * W.AC[m.AC] * pr * W.UI[m.UI];
  let score = 0;
  if (impact > 0) {
    score = m.S === "U"
      ? Math.min(impact + exploitability, 10)
      : Math.min(1.08 * (impact + exploitability), 10);
  }
  const rounded = Math.ceil(score * 10) / 10;
  const severity = rounded === 0 ? "None" : rounded < 4 ? "Low" : rounded < 7 ? "Medium" : rounded < 9 ? "High" : "Critical";
  return {
    score: rounded,
    severity,
    vector: `CVSS:3.1/AV:${m.AV}/AC:${m.AC}/PR:${m.PR}/UI:${m.UI}/S:${m.S}/C:${m.C}/I:${m.I}/A:${m.A}`,
  };
}

/* ------------------------------- coordinates ----------------------------- */

export function ddToDms(lat: number, lon: number): { lat: string; lon: string } {
  const fmt = (v: number, pos: string, neg: string) => {
    const dir = v >= 0 ? pos : neg;
    const abs = Math.abs(v);
    const deg = Math.floor(abs);
    const minFull = (abs - deg) * 60;
    const min = Math.floor(minFull);
    const sec = ((minFull - min) * 60).toFixed(2);
    return `${deg}° ${min}' ${sec}" ${dir}`;
  };
  return { lat: fmt(lat, "N", "S"), lon: fmt(lon, "E", "W") };
}

export function dmsToDd(input: string): number | null {
  const m = input.trim().match(/^(-?\d+(?:\.\d+)?)\s*°?\s*(?:(\d+(?:\.\d+)?)\s*'?\s*)?(?:(\d+(?:\.\d+)?)\s*"?\s*)?([NSEW])?$/i);
  if (!m) return null;
  const deg = parseFloat(m[1]);
  const min = m[2] ? parseFloat(m[2]) : 0;
  const sec = m[3] ? parseFloat(m[3]) : 0;
  const sign = m[4] && /[SW]/i.test(m[4]) ? -1 : 1;
  return sign * (Math.abs(deg) + min / 60 + sec / 3600);
}

const GEOHASH_BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
export function geohashEncode(lat: number, lon: number, precision = 9): string {
  let latMin = -90, latMax = 90, lonMin = -180, lonMax = 180;
  let even = true, bit = 0, ch = 0, out = "";
  while (out.length < precision) {
    if (even) {
      const mid = (lonMin + lonMax) / 2;
      if (lon >= mid) { ch = (ch << 1) + 1; lonMin = mid; } else { ch = ch << 1; lonMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) { ch = (ch << 1) + 1; latMin = mid; } else { ch = ch << 1; latMax = mid; }
    }
    even = !even;
    if (++bit === 5) { out += GEOHASH_BASE32[ch]; bit = 0; ch = 0; }
  }
  return out;
}

/* ------------------------------- formatting ------------------------------ */

export function formatBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(n) / Math.log(1024));
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

export function formatDate(iso: string | number | Date | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("pt-BR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "—";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min atrás`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h atrás`;
  const d = Math.floor(h / 24);
  return `${d} d atrás`;
}

export function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? "";
  } catch {
    return String(value);
  }
}

export function download(filename: string, content: BlobPart, type = "text/plain;charset=utf-8") {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

export function isValidDomain(v: string): boolean {
  return /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i.test(v.trim());
}
export function isValidEmail(v: string): boolean {
  return /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(v.trim());
}
export function isIp(v: string): boolean {
  return /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(v.trim()) || v.includes(":");
}
