#!/usr/bin/env node
/**
 * Regenerates src/lib/agency/identity/sherlock-sites.ts from the public
 * Sherlock Project data file (MIT License, https://github.com/sherlock-project/sherlock).
 *
 *   node scripts/gen-sherlock.mjs
 *
 * The output is a filtered, typed snapshot committed to the repo so the app
 * never needs network access just to know which sites exist. Scanning is done
 * by our own server functions (identity.functions.ts), not by Sherlock itself.
 */
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE = "https://raw.githubusercontent.com/sherlock-project/sherlock/master/sherlock_project/resources/data.json";
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../src/lib/agency/identity/sherlock-sites.ts");

/** Coarse categories derived from tags, so the UI can group sites. */
const CATEGORY_RULES = [
  [/coding|programming|tech|developer/i, "Dev"],
  [/social|network|microblog/i, "Social"],
  [/gaming|game|esport/i, "Gaming"],
  [/music|audio|podcast/i, "Música"],
  [/photo|image|art|design/i, "Criativo"],
  [/video|stream/i, "Vídeo"],
  [/dating|adult/i, "Adulto"],
  [/finance|money|crypto|trading/i, "Finanças"],
  [/fitness|sport|health/i, "Saúde"],
  [/news|blog|writing|forum/i, "Conteúdo"],
];

const ADULT = /adult|nsfw|porn|xxx|escort|fetish|dating/i;

const res = await fetch(SOURCE, { headers: { "user-agent": "Life-Agency-snapshot/3.0" } });
if (!res.ok) throw new Error(`Sherlock data.json: HTTP ${res.status}`);
const raw = await res.json();

const sites = [];
for (const [name, entry] of Object.entries(raw.sites ?? {})) {
  if (!entry || !entry.url) continue;
  const tags = Array.isArray(entry.tags) ? entry.tags : [];
  if (tags.some((t) => ADULT.test(String(t))) || ADULT.test(name)) continue;
  const tagsJoined = tags.join(" ");
  const category = CATEGORY_RULES.find(([re]) => re.test(tagsJoined))?.[1] ?? "Outros";
  sites.push({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    name: name.trim(),
    url: String(entry.url).replace("{username}", "{}"),
    category,
    regex: entry.regex_check ? String(entry.regex_check) : undefined,
    notFound: entry.errorMsg ? String(entry.errorMsg) : undefined,
  });
}

sites.sort((a, b) => a.name.localeCompare(b.name));

const body = `/**
 * Sherlock Project site snapshot — GENERATED, do not edit by hand.
 * Source: ${SOURCE}
 * Regenerate with: node scripts/gen-sherlock.mjs
 * License: MIT (Sherlock Project, 2019). Only public profile URLs are stored.
 */
export type SherlockSite = {
  id: string;
  name: string;
  /** Profile URL with \`{}\` as the username placeholder. */
  url: string;
  category: string;
  regex?: string;
  notFound?: string;
};

export const SHERLOCK_SITES: SherlockSite[] = ${JSON.stringify(sites, null, 2)};

export const SHERLOCK_SITE_MAP = new Map<string, SherlockSite>(SHERLOCK_SITES.map((s) => [s.id, s]));
`;

await writeFile(OUT, body, "utf8");
console.log(`wrote ${sites.length} sites to ${OUT}`);
