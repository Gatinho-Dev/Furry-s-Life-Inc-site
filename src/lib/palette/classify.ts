/**
 * Life Intelligence Input Engine — deterministic, context-aware classification.
 *
 * Everything here runs locally in the browser. Each candidate keeps the exact
 * matched text, the line it came from, an explainable score (an operational
 * indicator, not a probability) and the alternative types when the value is
 * genuinely ambiguous. Nothing is searched or added to a case from this module.
 */

import { isProbablyDomain, isProbablyIpv6, normalizeEntityValue } from "./extract";
import type { PaletteNodeKind } from "./types";

export type InputAlternate = { kind: PaletteNodeKind; score: number; why: string };

export type InputCandidate = {
  /** Stable key for React lists and review state. */
  key: string;
  kind: PaletteNodeKind;
  /** Value as written by the user. */
  value: string;
  /** Exact substring the rules matched. */
  matched: string;
  score: number;
  status: "confirmed" | "probable" | "ambiguous";
  context: string;
  alternates: InputAlternate[];
  /** Structural provenance, e.g. the domain derived from an email. */
  derivedFromValue?: string;
  derivedRelation?: string;
  /** Optional label of the cue that produced it ("Usuário público", "Empresa"...). */
  cue?: string;
  accepted?: boolean;
};

export type InputAnalysis = {
  candidates: InputCandidate[];
  lines: number;
  chars: number;
  ambiguous: number;
  derived: number;
  byKind: Record<string, number>;
  notes: string[];
};

export type AnalyzeOptions = {
  allowPrivate?: boolean;
  /** Treat every whitespace/comma separated token as a possible identifier. */
  strictLines?: boolean;
};

const PLATFORM_HOSTS: Array<{ host: string; name: string }> = [
  { host: "github.com", name: "GitHub" },
  { host: "gitlab.com", name: "GitLab" },
  { host: "x.com", name: "X" },
  { host: "twitter.com", name: "X" },
  { host: "instagram.com", name: "Instagram" },
  { host: "facebook.com", name: "Facebook" },
  { host: "linkedin.com", name: "LinkedIn" },
  { host: "reddit.com", name: "Reddit" },
  { host: "t.me", name: "Telegram" },
  { host: "youtube.com", name: "YouTube" },
  { host: "tiktok.com", name: "TikTok" },
  { host: "keybase.io", name: "Keybase" },
  { host: "mastodon.social", name: "Mastodon" },
  { host: "dev.to", name: "dev.to" },
  { host: "medium.com", name: "Medium" },
];

const RESERVED_USER_PATHS = new Set([
  "about", "login", "signup", "search", "explore", "settings", "help", "pricing", "features",
  "contact", "privacy", "terms", "blog", "docs", "support", "marketplace", "topics", "orgs",
]);

const ORG_SUFFIX = /\b([A-Z][\p{L}\d&.,'’\- ]{2,60}?\s(?:Ltda\.?|LTDA|S\.?A\.?|S\/A|Inc\.?|LLC|GmbH|Tecnologia|Technologies|Tech|Labs|Group|Solutions|Sistemas|Serviços|Servicos|Foundation|Universidade|Institute|Holding|Consultoria))\b/gu;

const CUE = {
  email: /\b(?:e-?mail|correio(?:\s+eletr[oô]nico)?|contato)\s*[:=]\s*/i,
  username: /\b(?:usu[aá]rio(?:\s+p[uú]blico)?|username|handle|perfil(?:\s+p[uú]blico)?|nick)\s*[:=]\s*/i,
  domain: /\b(?:site|website|dom[ií]nio|domain|endere[cç]o\s+web)\s*[:=]\s*/i,
  ip: /\b(?:ip(?:\s*(?:v4|v6))?|endere[cç]o\s+ip|host)\s*[:=]\s*/i,
  company: /\b(?:empresa|organiza[cç][aã]o|company|org(?:anization)?|institui[cç][aã]o)\s*[:=]\s*/i,
  person: /\b(?:nome(?:\s+completo)?|name|pessoa|respons[aá]vel)\s*[:=]\s*/i,
  phone: /\b(?:telefone|celular|phone|fone|whatsapp)\s*[:=]\s*/i,
  wallet: /\b(?:carteira|wallet|endere[cç]o\s+btc|endere[cç]o\s+eth)\s*[:=]\s*/i,
  location: /\b(?:localiza[cç][aã]o|local|cidade|endere[cç]o\s+f[ií]sico)\s*[:=]\s*/i,
  cnpj: /\bcnpj\s*[:=]\s*/i,
  hash: /\b(?:hash|sha-?256|md5|sha-?1)\s*[:=]\s*/i,
} as const;

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}\b/gi;
const URL_RE = /\bhttps?:\/\/[^\s"'<>\])}]{3,2048}/gi;
const IPV4_RE = /\b(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}\b/g;
const IPV6_RE = /(?<![\w:])(?:[0-9a-f]{1,4}(?::[0-9a-f]{0,4}){2,7}|::[0-9a-f]{1,4})(?![\w:])/gi;
const DOMAIN_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,24})\b/gi;
const HASH_RE = /\b[a-f0-9]{64}\b|\b[a-f0-9]{40}\b|\b[a-f0-9]{32}\b/gi;
const CVE_RE = /\bCVE-\d{4}-\d{4,}\b/gi;
const ASN_RE = /\bAS\d{1,10}\b/g;
const CNPJ_RE = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
const ETH_RE = /\b0x[a-fA-F0-9]{40}\b/g;
const BTC_RE = /\b(?:bc1[a-z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/g;
const PHONE_INTL_RE = /\+\d{1,3}[\s.-]?(?:\(?\d{1,4}\)?[\s.-]?){2,4}\d{2,4}\b/g;
const PHONE_LOCAL_RE = /\(?\b\d{2}\)?\s?9?\d{4}[-.\s]?\d{4}\b/g;
const HANDLE_RE = /(?<![\w@])@([a-zA-Z0-9._-]{2,40})\b/g;
const CITY_UF_RE = /\b([A-Z][\p{L}]{2,}(?:\s[A-Z][\p{L}]{2,})?)\s*[-–/]\s*([A-Z]{2})\b/gu;
const PERSON_LINE_RE = /^[\p{Lu}][\p{L}'’-]+(?:\s(?:d[aeo]s?\s|de\s|da\s|do\s)?[\p{Lu}][\p{L}'’-]+){1,4}$/u;
const CJK_NAME_RE = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]{2,12}$/u;

const PRIVATE_V4 = (parts: number[]): boolean =>
  parts[0] === 10 || parts[0] === 127 ||
  (parts[0] === 169 && parts[1] === 254) ||
  (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
  (parts[0] === 192 && parts[1] === 168) ||
  (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
  (parts[0] === 0);

export function isValidCnpj(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;
  const calc = (slice: number): number => {
    const weights = slice === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + Number(digits[i]) * w, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(12) === Number(digits[12]) && calc(13) === Number(digits[13]);
}

function platformFor(url: string): { name: string; username?: string } | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const platform = PLATFORM_HOSTS.find((p) => host === p.host || host.endsWith(`.${p.host}`));
    if (!platform) return null;
    const segment = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    const username = segment && !RESERVED_USER_PATHS.has(segment.toLowerCase()) && /^[a-zA-Z0-9._-]{2,40}$/.test(segment)
      ? segment.replace(/^@/, "")
      : undefined;
    return { name: platform.name, username };
  } catch {
    return null;
  }
}

function lineOf(text: string, index: number): string {
  const start = text.lastIndexOf("\n", Math.max(0, index - 1)) + 1;
  const end = text.indexOf("\n", index);
  return text.slice(start, end === -1 ? text.length : end).trim().slice(0, 220);
}

function statusFor(score: number): InputCandidate["status"] {
  if (score >= 80) return "confirmed";
  if (score >= 60) return "probable";
  return "ambiguous";
}

export function analyzeInput(raw: string, opts: AnalyzeOptions = {}): InputAnalysis {
  const text = raw.replace(/\r\n?/g, "\n").slice(0, 400_000);
  const out: InputCandidate[] = [];
  const notes: string[] = [];
  const seen = new Map<string, InputCandidate>();

  const NAME_FAMILY: PaletteNodeKind[] = ["person", "organization", "company"];
  const add = (
    kind: PaletteNodeKind,
    value: string,
    score: number,
    matched: string,
    context: string,
    extra: Partial<InputCandidate> = {},
  ) => {
    const clean = value.trim().replace(/[.,;]$/, "");
    if (!clean || clean.length > 2048) return;
    // The same proper name should not become a person, an organization and a
    // company at once: keep the best-scored interpretation of the family.
    if (NAME_FAMILY.includes(kind)) {
      const sibling = out.find((c) => NAME_FAMILY.includes(c.kind) && c.value.toLowerCase() === clean.toLowerCase());
      if (sibling) {
        if (score > sibling.score + 4) {
          sibling.kind = kind;
          sibling.score = score;
          sibling.status = statusFor(score);
          sibling.cue = extra.cue ?? sibling.cue;
        }
        return;
      }
    }
    const key = `${kind}:${normalizeEntityValue(kind, clean).toLowerCase()}`;
    const existing = seen.get(key);
    if (existing) {
      if (score > existing.score) {
        existing.score = score;
        existing.status = statusFor(score);
        existing.matched = matched || existing.matched;
      }
      if (extra.derivedFromValue && !existing.derivedFromValue) {
        existing.derivedFromValue = extra.derivedFromValue;
        existing.derivedRelation = extra.derivedRelation;
      }
      return;
    }
    const alternates = (extra.alternates ?? []).filter((a) => a.kind !== kind && a.score >= 30);
    const candidate: InputCandidate = {
      key,
      kind,
      value: clean,
      matched: matched || clean,
      score,
      status: statusFor(score),
      context,
      alternates,
      cue: extra.cue,
      derivedFromValue: extra.derivedFromValue,
      derivedRelation: extra.derivedRelation,
      accepted: true,
    };
    seen.set(key, candidate);
    out.push(candidate);
  };

  /* ------------------------------ strong formats ----------------------------- */

  for (const m of text.matchAll(URL_RE)) {
    const url = m[0].replace(/[.,;]$/, "");
    const platform = platformFor(url);
    add(platform ? "social-profile" : "url", url, platform ? 90 : 95, m[0], lineOf(text, m.index ?? 0),
      platform ? { cue: platform.name } : {});
    if (platform?.username) {
      add("username", platform.username, 88, platform.username, lineOf(text, m.index ?? 0), {
        cue: `URL de perfil ${platform.name}`,
        alternates: [{ kind: "person", score: 34, why: "Um handle pode pertencer a uma pessoa ou a uma marca." }],
      });
    }
    try {
      const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
      if (isProbablyDomain(host)) {
        add("domain", host, 94, host, lineOf(text, m.index ?? 0), {
          cue: "Domínio da URL",
          derivedFromValue: url,
          derivedRelation: "Hosted on",
        });
      }
    } catch {
      /* URL inválida: a extração já registrou o texto bruto. */
    }
  }

  for (const m of text.matchAll(EMAIL_RE)) {
    const email = m[0].toLowerCase();
    const context = lineOf(text, m.index ?? 0);
    add("email", email, 98, m[0], context);
    const domain = email.split("@")[1];
    if (domain && isProbablyDomain(domain)) {
      add("domain", domain, 96, domain, context, {
        cue: "Domínio do e-mail",
        derivedFromValue: email,
        derivedRelation: "Belongs to",
      });
    }
  }

  for (const m of text.matchAll(CVE_RE)) add("cve", m[0].toUpperCase(), 99, m[0], lineOf(text, m.index ?? 0));

  for (const m of text.matchAll(ETH_RE)) add("wallet", m[0], 93, m[0], lineOf(text, m.index ?? 0), { cue: "Ethereum/EVM" });
  for (const m of text.matchAll(BTC_RE)) add("wallet", m[0], 88, m[0], lineOf(text, m.index ?? 0), { cue: "Bitcoin" });

  for (const m of text.matchAll(CNPJ_RE)) {
    const valid = isValidCnpj(m[0]);
    add("company", m[0], valid ? 97 : 70, m[0], lineOf(text, m.index ?? 0), {
      cue: valid ? "CNPJ (dígitos verificados)" : "CNPJ (dígitos não conferem)",
    });
  }

  for (const m of text.matchAll(HASH_RE)) add("hash", m[0].toLowerCase(), 95, m[0], lineOf(text, m.index ?? 0));

  for (const m of text.matchAll(IPV4_RE)) {
    const parts = m[0].split(".").map(Number);
    if (PRIVATE_V4(parts) && !opts.allowPrivate) continue;
    add("ipv4", m[0], 96, m[0], lineOf(text, m.index ?? 0));
  }

  for (const m of text.matchAll(IPV6_RE)) {
    if (!isProbablyIpv6(m[0])) continue;
    add("ipv6", m[0], 92, m[0], lineOf(text, m.index ?? 0));
  }

  for (const m of text.matchAll(ASN_RE)) add("asn", m[0].toUpperCase(), 94, m[0], lineOf(text, m.index ?? 0));

  for (const m of text.matchAll(DOMAIN_RE)) {
    const value = m[0].replace(/\.$/, "");
    if (!isProbablyDomain(value)) continue;
    const context = lineOf(text, m.index ?? 0);
    // The domain part of an email is registered by the email rule above.
    if (out.some((c) => c.kind === "email" && c.value.endsWith(`@${value.toLowerCase()}`))) continue;
    add("domain", value, 90, value, context);
  }

  /* ------------------------------- cue-based -------------------------------- */

  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) continue;

    const grab = (re: RegExp): string | undefined => {
      const m = re.exec(trimmed);
      if (!m) return undefined;
      return trimmed.slice((m.index ?? 0) + m[0].length).trim().replace(/^["'“]|["'”]$/g, "");
    };

    const email = grab(CUE.email);
    if (email) {
      const first = email.split(/[\s,;]/)[0];
      if (EMAIL_RE.test(first)) {
        EMAIL_RE.lastIndex = 0;
        add("email", first, 99, first, trimmed, { cue: "Campo de e-mail" });
      }
      EMAIL_RE.lastIndex = 0;
    }
    const username = grab(CUE.username);
    if (username) {
      const handle = username.split(/[\s,;]/)[0].replace(/^@/, "");
      if (/^[a-zA-Z0-9._-]{2,40}$/.test(handle)) {
        add("username", handle, 86, handle, trimmed, {
          cue: "Campo de username",
          alternates: [{ kind: "person", score: 32, why: "O mesmo texto pode ser um nome de pessoa." }],
        });
      }
    }
    const domain = grab(CUE.domain);
    if (domain) {
      const first = domain.split(/[\s,;]/)[0].replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
      if (isProbablyDomain(first)) add("domain", first, 92, first, trimmed, { cue: "Campo de site/domínio" });
    }
    const ip = grab(CUE.ip);
    if (ip) {
      const first = ip.split(/[\s,;]/)[0];
      if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(first)) add("ipv4", first, 97, first, trimmed, { cue: "Campo de IP" });
      else if (isProbablyIpv6(first)) add("ipv6", first, 94, first, trimmed, { cue: "Campo de IPv6" });
    }
    const company = grab(CUE.company);
    if (company) {
      const value = company.replace(/[.;]$/, "").slice(0, 160);
      add("company", value, 82, value, trimmed, {
        cue: "Campo de empresa",
        alternates: [{ kind: "person", score: 36, why: "O texto pode ser um nome próprio." }],
      });
    }
    const person = grab(CUE.person);
    if (person) {
      const value = person.replace(/[.;]$/, "").slice(0, 120);
      if (value && !value.includes("@") && !/\d{3}/.test(value)) {
        add("person", value, 80, value, trimmed, {
          cue: "Campo de nome",
          alternates: [
            { kind: "organization", score: 42, why: "Pode ser uma empresa ou instituição." },
            { kind: "username", score: 30, why: "Pode ser um handle sem @." },
          ],
        });
      }
    }
    const phone = grab(CUE.phone);
    if (phone) {
      const first = phone.split(/[;]|\s{2,}/)[0].trim();
      if (/\d{8,}/.test(first)) add("phone", first.slice(0, 40), 82, first, trimmed, { cue: "Campo de telefone" });
    }
    const wallet = grab(CUE.wallet);
    if (wallet) {
      const first = wallet.split(/[\s,;]/)[0];
      if (/^(?:0x[a-fA-F0-9]{40}|bc1[a-z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(first)) {
        add("wallet", first, 92, first, trimmed, { cue: "Campo de carteira" });
      }
    }
    const location = grab(CUE.location);
    if (location) {
      const value = location.replace(/[.;]$/, "").slice(0, 120);
      if (value) add("location", value, 74, value, trimmed, { cue: "Campo de localização" });
    }
    const cnpj = grab(CUE.cnpj);
    if (cnpj) {
      const first = cnpj.split(/[\s,;]/)[0];
      if (/\d{14}/.test(first.replace(/\D/g, ""))) {
        add("company", first, isValidCnpj(first) ? 98 : 72, first, trimmed, { cue: "Campo de CNPJ" });
      }
    }
    const hash = grab(CUE.hash);
    if (hash) {
      const first = hash.split(/[\s,;]/)[0];
      if (/^[a-f0-9]{32,64}$/i.test(first)) add("hash", first.toLowerCase(), 97, first, trimmed, { cue: "Campo de hash" });
    }
  }

  /* --------------------------- handles, phones, places ----------------------- */

  for (const m of text.matchAll(HANDLE_RE)) {
    add("username", m[1], 90, m[0], lineOf(text, m.index ?? 0), {
      cue: "Handle explícito",
      alternates: [{ kind: "person", score: 32, why: "Um handle pode ser um nome público." }],
    });
  }

  const phoneCandidates: Array<{ raw: string; intl: boolean; at: number }> = [];
  for (const m of text.matchAll(PHONE_INTL_RE)) phoneCandidates.push({ raw: m[0], intl: true, at: m.index ?? 0 });
  for (const m of text.matchAll(PHONE_LOCAL_RE)) phoneCandidates.push({ raw: m[0], intl: false, at: m.index ?? 0 });
  for (const phone of phoneCandidates) {
    const digits = phone.raw.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) continue;
    if (/^\d{14}$/.test(digits) && isValidCnpj(digits)) continue;
    add("phone", phone.raw.trim(), phone.intl ? 86 : 52, phone.raw, lineOf(text, phone.at), {
      cue: phone.intl ? "Número com código de país" : "Formato local — confirme o país",
      alternates: [{ kind: "custom", score: 25, why: "Pode ser um identificador interno." }],
    });
  }

  for (const m of text.matchAll(CITY_UF_RE)) {
    add("location", m[0], 62, m[0], lineOf(text, m.index ?? 0), {
      cue: "Cidade/UF",
      alternates: [{ kind: "organization", score: 28, why: "Pode ser parte de um nome de empresa." }],
    });
  }

  /* -------------------------------- names/orgs ------------------------------- */

  for (const m of text.matchAll(ORG_SUFFIX)) {
    const value = m[1].trim();
    if (value.length < 4) continue;
    add("organization", value, 70, m[1], lineOf(text, m.index ?? 0), {
      cue: "Sufixo empresarial",
      alternates: [{ kind: "company", score: 54, why: "Empresa e organização são registros diferentes." }],
    });
  }

  for (const line of lines) {
    const value = line.trim().replace(/^[-*•]\s*/, "");
    if (!value || value.length > 80) continue;
    if (out.some((c) => c.context === line.trim() || value.includes(c.value))) continue;
    if (PERSON_LINE_RE.test(value) || CJK_NAME_RE.test(value)) {
      add("person", value, 52, value, value, {
        cue: "Nome próprio provável",
        alternates: [
          { kind: "organization", score: 48, why: "Sem contexto, pode ser uma organização." },
          { kind: "username", score: 34, why: "Pode ser um identificador sem @." },
        ],
      });
    }
  }

  out.sort((a, b) => b.score - a.score || a.kind.localeCompare(b.kind) || a.value.localeCompare(b.value));

  const byKind: Record<string, number> = {};
  for (const c of out) byKind[c.kind] = (byKind[c.kind] ?? 0) + 1;
  const ambiguous = out.filter((c) => c.status === "ambiguous").length;
  const derived = out.filter((c) => c.derivedFromValue).length;

  if (out.length === 0) {
    notes.push("Nenhum identificador reconhecido. Você ainda pode adicionar entidades manualmente ou colar um texto maior.");
  }
  if (ambiguous > 0) {
    notes.push(`${ambiguous} valor(es) sem contexto suficiente: confirme o tipo antes de pesquisar.`);
  }
  if (out.some((c) => c.kind === "person")) {
    notes.push("Nomes de pessoas só são pesquisados em fontes públicas e não identificam alguém de forma definitiva.");
  }
  if (out.some((c) => c.kind === "phone" || c.kind === "wallet" || c.kind === "location")) {
    notes.push("Telefone, carteira e localização não têm conector gratuito compatível nesta instalação: serão registrados como entidades sem consulta automática.");
  }

  return { candidates: out, lines: lines.length, chars: text.length, ambiguous, derived, byKind, notes };
}

/** Quick check used by the input box to enable the primary action. */
export function hasIdentifier(text: string): boolean {
  return analyzeInput(text).candidates.length > 0;
}
