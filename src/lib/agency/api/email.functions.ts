import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertDomain, cached, doh, enforceRateLimit, fetchJson, txtValue, UpstreamError } from "@/lib/agency/http.server";

export type SourceStatus = { name: string; ok: boolean; detail?: string; url?: string };

const PROVIDERS: Array<[RegExp, string]> = [
  [/google\.com|googlemail\.com|aspmx\.l\.google/i, "Google Workspace / Gmail"],
  [/outlook\.com|protection\.outlook|office365|microsoft/i, "Microsoft 365 / Outlook"],
  [/pphosted|proofpoint/i, "Proofpoint"],
  [/mimecast/i, "Mimecast"],
  [/zoho/i, "Zoho Mail"],
  [/yandex/i, "Yandex Mail"],
  [/mail\.ru/i, "Mail.ru"],
  [/protonmail|proton\.ch/i, "Proton Mail"],
  [/secureserver\.net|godaddy/i, "GoDaddy"],
  [/hostinger|hostgator|locaweb|kinghost|uol|terra/i, "Hospedagem compartilhada"],
  [/amazonaws|amazonses/i, "Amazon SES / AWS"],
  [/cloudflare/i, "Cloudflare Email Routing"],
  [/mailgun|sendgrid|postmark|sparkpost|mailchimp|mandrill/i, "Provedor transacional (ESP)"],
  [/registro\.br/i, "Registro.br (e-mail)"],
];

const COMMON_DKIM_SELECTORS = ["google", "selector1", "selector2", "s1", "s2", "k1", "k2", "mail", "default", "dkim", "mandrill", "smtp", "ses", "amazonses", "everlytickey1"];

type SpfParse = {
  record: string | null;
  mechanisms: string[];
  allQualifier: string | null;
  includes: string[];
  ip4: string[];
  ip6: string[];
  lookupCount: number;
  issues: string[];
};

function parseSpf(record: string | null): SpfParse {
  if (!record) {
    return { record: null, mechanisms: [], allQualifier: null, includes: [], ip4: [], ip6: [], lookupCount: 0, issues: ["Nenhum registro SPF publicado — o domínio não declara quais servidores podem enviar e-mail."] };
  }
  const parts = record.split(/\s+/).filter(Boolean);
  const mechanisms = parts.slice(1);
  const includes = mechanisms.filter((m) => /^include:/i.test(m)).map((m) => m.slice(8));
  const ip4 = mechanisms.filter((m) => /^ip4:/i.test(m)).map((m) => m.slice(4));
  const ip6 = mechanisms.filter((m) => /^ip6:/i.test(m)).map((m) => m.slice(4));
  const allMech = mechanisms.find((m) => /all$/i.test(m));
  const allQualifier = allMech ? allMech.replace(/all$/i, "").replace(/:$/, "") || "+" : null;
  const lookupCount = mechanisms.filter((m) => /^(include|a|mx|ptr|exists):/i.test(m) || /^(a|mx|ptr)$/i.test(m)).length;
  const issues: string[] = [];
  if (lookupCount > 10) issues.push(`SPF com ${lookupCount} mecanismos que exigem DNS lookup (limite recomendado: 10).`);
  if (!allMech) issues.push("SPF sem mecanismo 'all' explícito.");
  if (allQualifier === "+") issues.push("SPF termina em '+all', permitindo que qualquer servidor envie pelo domínio — política permissiva.");
  if (allQualifier === "?") issues.push("SPF termina em '?all' (neutro) — não impede falsificação.");
  if (allQualifier === "~") issues.push("SPF em '~all' (softfail): mensagens falsas são marcadas, não rejeitadas.");
  return { record, mechanisms, allQualifier, includes, ip4, ip6, lookupCount, issues };
}

export const emailAnalysis = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    email: z.string().min(5).max(254),
    dkimSelector: z.string().max(60).optional(),
  }))
  .handler(async ({ data }) => {
    await enforceRateLimit("email", 1, 15);
    const email = data.email.trim().toLowerCase();
    if (!/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(email)) throw new UpstreamError("Endereço de e-mail inválido.", 400, "validation");
    const [local, domain] = email.split("@");
    const d = assertDomain(domain);
    const sources: SourceStatus[] = [];

    const [mxAns, spfAns, dmarcAns, aAns] = await Promise.all([
      doh(d, "MX", "google").catch(() => null),
      doh(d, "TXT", "google").catch(() => null),
      doh(`_dmarc.${d}`, "TXT", "google").catch(() => null),
      doh(d, "A", "cloudflare").catch(() => null),
    ]);
    sources.push({ name: "Google Public DNS + Cloudflare DNS", ok: Boolean(mxAns || spfAns) });

    const mxRecords = (mxAns?.Answer ?? [])
      .filter((r) => r.type === 15)
      .map((r) => {
        const [priority, host] = r.data.split(/\s+/);
        return { priority: Number(priority), host: (host ?? "").replace(/\.$/, ""), ttl: r.TTL };
      })
      .sort((a, b) => a.priority - b.priority);

    const txtRecords = (spfAns?.Answer ?? []).filter((r) => r.type === 16).map((r) => txtValue(r.data));
    const spfRecord = txtRecords.find((t) => /^v=spf1/i.test(t)) ?? null;
    const spf = parseSpf(spfRecord);

    const dmarcTxt = (dmarcAns?.Answer ?? []).filter((r) => r.type === 16).map((r) => txtValue(r.data)).find((t) => /^v=DMARC1/i.test(t)) ?? null;
    const dmarcTags: Record<string, string> = {};
    if (dmarcTxt) {
      for (const part of dmarcTxt.split(";")) {
        const [k, v] = part.split("=").map((s) => s.trim());
        if (k) dmarcTags[k] = v ?? "";
      }
    }

    const selectorList = [...new Set([...(data.dkimSelector ? [data.dkimSelector] : []), ...COMMON_DKIM_SELECTORS])];
    const dkim = await Promise.all(
      selectorList.slice(0, 14).map(async (selector) => {
        try {
          const ans = await doh(`${selector}._domainkey.${d}`, "TXT", "google");
          const rec = (ans.Answer ?? []).filter((r) => r.type === 16).map((r) => txtValue(r.data)).find((t) => /v=DKIM1|k=|p=/.test(t));
          return rec ? { selector, found: true, record: rec.slice(0, 400) } : null;
        } catch {
          return null;
        }
      }),
    ).then((rows) => rows.filter(Boolean) as Array<{ selector: string; found: boolean; record: string }>);

    const provider = PROVIDERS.find(([re]) => mxRecords.some((m) => re.test(m.host)))?.[1] ?? (mxRecords.length ? "Provedor não identificado" : "Sem MX");
    const usesCatchAllProvider = /google|microsoft|outlook/i.test(mxRecords.map((m) => m.host).join(" "));

    return {
      email,
      localPart: local,
      domain: d,
      queriedAt: new Date().toISOString(),
      syntax: { valid: true, localPartLength: local.length, normalized: email },
      domainResolution: {
        a: (aAns?.Answer ?? []).filter((r) => r.type === 1).map((r) => r.data),
        acceptsMail: mxRecords.length > 0,
      },
      mx: mxRecords,
      provider,
      providerNote: usesCatchAllProvider ? "Provedor de grande porte: a existência da caixa não pode ser verificada sem interação com o servidor." : undefined,
      spf,
      dmarc: {
        record: dmarcTxt,
        policy: dmarcTags.p ?? null,
        subdomainPolicy: dmarcTags.sp ?? null,
        pct: dmarcTags.pct ?? null,
        rua: dmarcTags.rua ?? null,
        ruf: dmarcTags.ruf ?? null,
        adkim: dmarcTags.adkim ?? null,
        aspf: dmarcTags.aspf ?? null,
        issues: !dmarcTxt
          ? ["Nenhum registro DMARC publicado: não há política declarada para falhas de autenticação."]
          : dmarcTags.p === "none"
            ? ["DMARC em p=none: apenas monitora, sem rejeitar mensagens não autenticadas."]
            : [],
      },
      dkim,
      txtRecords,
      reputation: {
        mxBased: provider,
        note: "A validação de existência de caixa e o histórico de vazamentos exigem fontes adicionais (HIBP com chave, SMTP verification).",
      },
      sources,
    };
  });

/* -------------------------------------------------------------------------- */
/* Breach catalog (HIBP — catalog endpoint is public)                        */
/* -------------------------------------------------------------------------- */

type HibpBreach = {
  Name: string;
  Title: string;
  Domain: string;
  BreachDate: string;
  AddedDate: string;
  PwnCount: number;
  Description: string;
  DataClasses: string[];
  IsVerified: boolean;
  IsSensitive: boolean;
};

export const breachCatalog = createServerFn({ method: "POST" })
  .inputValidator(z.object({ query: z.string().max(120).optional(), limit: z.number().min(1).max(100).optional() }))
  .handler(async ({ data }) => {
    await enforceRateLimit("hibp", 1, 10);
    const rows = await cached("hibp:breaches", 12 * 60 * 60_000, () =>
      fetchJson<HibpBreach[]>("https://haveibeenpwned.com/api/v3/breaches", { timeoutMs: 20000 }),
    );
    const q = (data.query ?? "").trim().toLowerCase();
    const filtered = rows
      .filter((b) => !q || `${b.Name} ${b.Title} ${b.Domain}`.toLowerCase().includes(q))
      .sort((a, b) => b.AddedDate.localeCompare(a.AddedDate))
      .slice(0, data.limit ?? 40)
      .map((b) => ({
        name: b.Name,
        title: b.Title,
        domain: b.Domain,
        breachDate: b.BreachDate,
        addedDate: b.AddedDate,
        pwnCount: b.PwnCount,
        dataClasses: b.DataClasses,
        verified: b.IsVerified,
        sensitive: b.IsSensitive,
      }));
    return {
      queriedAt: new Date().toISOString(),
      totalCatalog: rows.length,
      matched: filtered.length,
      breaches: filtered,
      source: { name: "HIBP — catálogo público de breaches", ok: true, url: "https://haveibeenpwned.com/PwnedWebsites" },
    };
  });

export const breachAccountCheck = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().min(5).max(254), keys: z.record(z.string(), z.string().max(200)).optional() }))
  .handler(async ({ data }) => {
    await enforceRateLimit("hibp-account", 1, 5);
    const key = data.keys?.HIBP_API_KEY;
    if (!key) {
      return {
        available: false as const,
        reason: "A consulta por conta no HIBP exige chave de API paga. O catálogo público de vazamentos continua disponível gratuitamente.",
        signup: "https://haveibeenpwned.com/API/Key",
        queriedAt: new Date().toISOString(),
        alternative: "Use 'Catálogo de vazamentos' para verificar se o domínio foi exposto.",
      };
    }
    try {
      const rows = await fetchJson<Array<{ Name: string; Title: string; BreachDate: string; DataClasses: string[]; PwnCount: number }>>(
        `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(data.email)}?truncateResponse=false`,
        { headers: { "hibp-api-key": key, "user-agent": "Life-Agency-OSINT" }, timeoutMs: 15000 },
      );
      return { available: true as const, email: data.email, queriedAt: new Date().toISOString(), breaches: rows, note: "Senhas e credenciais nunca são exibidas." };
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("404")) return { available: true as const, email: data.email, queriedAt: new Date().toISOString(), breaches: [], note: "Nenhum vazamento conhecido." };
      throw upErr(msg);
    }
  });

function upErr(msg: string) { return new UpstreamError(msg, 502, "hibp"); }
