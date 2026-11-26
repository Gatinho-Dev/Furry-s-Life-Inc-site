import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { enforceRateLimit, fetchJson, UpstreamError } from "@/lib/agency/http.server";

export type SourceStatus = { name: string; ok: boolean; detail?: string; url?: string };

function digits(v: string) {
  return v.replace(/\D/g, "");
}

export function validateCnpj(raw: string): boolean {
  const c = digits(raw);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (slice: string, weights: number[]) => {
    const sum = weights.reduce((acc, w, i) => acc + Number(slice[i]) * w, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const d1 = calc(c.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(c.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(c[12]) && d2 === Number(c[13]);
}

type BrasilCnpj = {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  situacao_cadastral?: number;
  descricao_situacao_cadastral?: string;
  data_situacao_cadastral?: string;
  data_inicio_atividade?: string;
  natureza_juridica?: string;
  porte?: string;
  capital_social?: number;
  cnae_fiscal?: number;
  cnae_fiscal_descricao?: string;
  cnaes_secundarios?: Array<{ codigo: number; descricao: string }>;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  municipio?: string;
  uf?: string;
  ddd_telefone_1?: string;
  email?: string | null;
  qsa?: Array<{ nome_socio: string; qualificacao_socio: string; cnpj_cpf_do_socio?: string; data_entrada_sociedade?: string }>;
  opcao_pelo_simples?: boolean;
  data_opcao_pelo_simples?: string | null;
};

export const cnpjLookup = createServerFn({ method: "POST" })
  .inputValidator(z.object({ cnpj: z.string().min(12).max(20) }))
  .handler(async ({ data }) => {
    await enforceRateLimit("cnpj", 1, 15);
    const cnpj = digits(data.cnpj);
    if (cnpj.length !== 14) throw new UpstreamError("CNPJ deve ter 14 dígitos.", 400, "validation");
    if (!validateCnpj(cnpj)) throw new UpstreamError("CNPJ inválido (dígitos verificadores não conferem).", 400, "validation");
    try {
      const json = await fetchJson<BrasilCnpj>(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { timeoutMs: 20000 });
      return {
        found: true as const,
        queriedAt: new Date().toISOString(),
        company: {
          cnpj: json.cnpj,
          legalName: json.razao_social,
          tradeName: json.nome_fantasia,
          status: json.descricao_situacao_cadastral,
          statusSince: json.data_situacao_cadastral,
          foundedAt: json.data_inicio_atividade,
          legalNature: json.natureza_juridica,
          size: json.porte,
          capital: json.capital_social,
          mainActivity: json.cnae_fiscal ? `${json.cnae_fiscal} — ${json.cnae_fiscal_descricao ?? ""}` : undefined,
          secondaryActivities: (json.cnaes_secundarios ?? []).slice(0, 30),
          address: {
            street: json.logradouro, number: json.numero, complement: json.complemento,
            district: json.bairro, postalCode: json.cep, city: json.municipio, state: json.uf,
          },
          phone: json.ddd_telefone_1,
          email: json.email ?? undefined,
          partners: (json.qsa ?? []).map((p) => ({
            name: p.nome_socio,
            role: p.qualificacao_socio,
            since: p.data_entrada_sociedade,
          })),
          simples: json.opcao_pelo_simples,
          simplesSince: json.data_opcao_pelo_simples,
        },
        source: {
          name: "BrasilAPI — dados abertos da Receita Federal",
          ok: true,
          detail: "Dados públicos. Sócios e endereço refletem o cadastro oficial, que pode estar desatualizado.",
          url: `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
        } satisfies SourceStatus,
        links: [
          { label: "Consulta oficial (Receita Federal)", url: `https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp?cnpj=${cnpj}` },
          { label: "CNPJ na web (busca)", url: `https://www.google.com/search?q=${encodeURIComponent(`"${cnpj}"`)}` },
          { label: "Diário Oficial (busca)", url: `https://www.in.gov.br/consulta/-/buscar/dou?q=${cnpj}` },
        ],
      };
    } catch (e) {
      const msg = (e as Error).message;
      if (/404/.test(msg)) return { found: false as const, queriedAt: new Date().toISOString(), cnpj, message: "CNPJ não encontrado na base pública." };
      throw new UpstreamError(msg, 502, "brasilapi");
    }
  });

export const companyOpenDataLinks = createServerFn({ method: "POST" })
  .inputValidator(z.object({ query: z.string().min(2).max(150) }))
  .handler(async ({ data }) => {
    const q = encodeURIComponent(data.query);
    return {
      query: data.query,
      queriedAt: new Date().toISOString(),
      links: [
        { label: "Receita Federal — CNPJ", url: "https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp" },
        { label: "Portal da Transparência", url: `https://portaldatransparencia.gov.br/busca?termo=${q}` },
        { label: "Diário Oficial da União", url: `https://www.in.gov.br/consulta/-/buscar/dou?q=${q}` },
        { label: "OpenCorporates", url: `https://opencorporates.com/companies?q=${q}` },
        { label: "Google News", url: `https://news.google.com/search?q=${q}` },
        { label: "LinkedIn (indexado)", url: `https://www.bing.com/search?q=site%3Alinkedin.com%2Fcompany+${q}` },
        { label: "Crunchbase", url: `https://www.crunchbase.com/textsearch?q=${q}` },
        { label: "SEC EDGAR (EUA)", url: `https://www.sec.gov/cgi-bin/browse-edgar?company=${q}&action=getcompany` },
      ],
      source: { name: "Fontes oficiais e diretórios públicos", ok: true },
    };
  });
