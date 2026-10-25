// Motor de fórmulas do Life Sheets. Sem eval / new Function.

export type CellValue = number | string | boolean | null | SheetError;

export type SheetError = { error: "#DIV/0!" | "#REF!" | "#VALUE!" | "#NAME?" | "#CYCLE!" | "#ERROR!" };

export const isError = (v: unknown): v is SheetError =>
  typeof v === "object" && v !== null && "error" in v;

export type Token =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "ref"; col: number; row: number; absCol: boolean; absRow: boolean }
  | { t: "ident"; v: string }
  | { t: "op"; v: string }
  | { t: "lp" }
  | { t: "rp" }
  | { t: "comma" }
  | { t: "colon" };

const colToIndex = (letters: string) => {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

export function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t") { i++; continue; }
    if (c === "(") { out.push({ t: "lp" }); i++; continue; }
    if (c === ")") { out.push({ t: "rp" }); i++; continue; }
    if (c === ",") { out.push({ t: "comma" }); i++; continue; }
    if (c === ":") { out.push({ t: "colon" }); i++; continue; }
    if ("+-*/^&=<>".includes(c)) {
      const two = src.slice(i, i + 2);
      if (two === "<=" || two === ">=" || two === "<>") { out.push({ t: "op", v: two }); i += 2; continue; }
      out.push({ t: "op", v: c }); i++; continue;
    }
    if (c === '"') {
      let j = i + 1; let s = "";
      while (j < src.length) {
        if (src[j] === '"') { if (src[j + 1] === '"') { s += '"'; j += 2; continue; } break; }
        s += src[j++];
      }
      if (j >= src.length) throw new SyntaxError("Texto sem aspas de fechamento");
      out.push({ t: "str", v: s }); i = j + 1; continue;
    }
    const num = /^\d+(\.\d+)?/.exec(src.slice(i));
    if (num) { out.push({ t: "num", v: Number(num[0]) }); i += num[0].length; continue; }
    const ref = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(])/.exec(src.slice(i));
    if (ref) {
      out.push({ t: "ref", col: colToIndex(ref[2]), row: Number(ref[4]) - 1, absCol: ref[1] === "$", absRow: ref[3] === "$" });
      i += ref[0].length; continue;
    }
    const id = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(src.slice(i));
    if (id) {
      const word = id[0].toUpperCase();
      if (word === "TRUE" || word === "FALSE") out.push({ t: "bool", v: word === "TRUE" });
      else out.push({ t: "ident", v: word });
      i += id[0].length; continue;
    }
    throw new SyntaxError(`Caractere inesperado: ${c}`);
  }
  return out;
}

export type Node =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "bool"; v: boolean }
  | { k: "ref"; col: number; row: number }
  | { k: "range"; a: { col: number; row: number }; b: { col: number; row: number } }
  | { k: "call"; name: string; args: Node[] }
  | { k: "unary"; op: string; x: Node }
  | { k: "bin"; op: string; l: Node; r: Node };

const PREC: Record<string, number> = { "=": 1, "<>": 1, "<": 1, ">": 1, "<=": 1, ">=": 1, "&": 2, "+": 3, "-": 3, "*": 4, "/": 4, "^": 5 };

export function parse(src: string): Node {
  const toks = tokenize(src.startsWith("=") ? src.slice(1) : src);
  let p = 0;
  const peek = () => toks[p];
  const eat = () => toks[p++];

  const primary = (): Node => {
    const t = eat();
    if (!t) throw new SyntaxError("Fórmula incompleta");
    if (t.t === "num") return { k: "num", v: t.v };
    if (t.t === "str") return { k: "str", v: t.v };
    if (t.t === "bool") return { k: "bool", v: t.v };
    if (t.t === "lp") { const e = expr(0); if (eat()?.t !== "rp") throw new SyntaxError("Falta fechar parêntese"); return e; }
    if (t.t === "op" && (t.v === "-" || t.v === "+")) return { k: "unary", op: t.v, x: expr(5) };
    if (t.t === "ref") {
      const a = { col: t.col, row: t.row };
      if (peek()?.t === "colon") {
        eat(); const b = eat();
        if (b?.t !== "ref") throw new SyntaxError("Intervalo inválido");
        return { k: "range", a, b: { col: b.col, row: b.row } };
      }
      return { k: "ref", col: t.col, row: t.row };
    }
    if (t.t === "ident") {
      if (peek()?.t !== "lp") throw new SyntaxError(`Nome desconhecido: ${t.v}`);
      eat();
      const args: Node[] = [];
      if (peek()?.t !== "rp") {
        do { args.push(expr(0)); } while (peek()?.t === "comma" && eat());
      }
      if (eat()?.t !== "rp") throw new SyntaxError("Falta fechar parêntese");
      return { k: "call", name: t.v, args };
    }
    throw new SyntaxError("Token inesperado");
  };

  const expr = (minP: number): Node => {
    let left = primary();
    for (;;) {
      const t = peek();
      if (!t || t.t !== "op" || PREC[t.v] === undefined || PREC[t.v] < minP) break;
      eat();
      // ^ é associativo à direita; os demais, à esquerda
      const right = expr(t.v === "^" ? PREC[t.v] : PREC[t.v] + 1);
      left = { k: "bin", op: t.v, l: left, r: right };
    }
    return left;
  };

  const tree = expr(0);
  if (p < toks.length) throw new SyntaxError("Sintaxe inválida");
  return tree;
}

export type Lookup = (col: number, row: number) => CellValue;

const err = (e: SheetError["error"]): SheetError => ({ error: e });

const toNum = (v: CellValue): number | SheetError => {
  if (isError(v)) return v;
  if (v === null || v === "") return 0;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number") return v;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && v.trim() !== "" ? n : err("#VALUE!");
};

const toText = (v: CellValue): string | SheetError => {
  if (isError(v)) return v;
  if (v === null) return "";
  return String(v);
};

const rangeCells = (n: Extract<Node, { k: "range" }>): Array<[number, number]> => {
  const c1 = Math.min(n.a.col, n.b.col), c2 = Math.max(n.a.col, n.b.col);
  const r1 = Math.min(n.a.row, n.b.row), r2 = Math.max(n.a.row, n.b.row);
  const out: Array<[number, number]> = [];
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) out.push([c, r]);
  return out;
};

export function evaluate(node: Node, look: Lookup, stack: Set<string> = new Set()): CellValue {
  switch (node.k) {
    case "num": return node.v;
    case "str": return node.v;
    case "bool": return node.v;
    case "ref": return look(node.col, node.row);
    case "range": return err("#VALUE!");
    case "unary": {
      const x = toNum(evaluate(node.x, look, stack));
      if (typeof x !== "number") return x;
      return node.op === "-" ? -x : x;
    }
    case "bin": {
      const l = evaluate(node.l, look, stack);
      const r = evaluate(node.r, look, stack);
      if (isError(l)) return l;
      if (isError(r)) return r;
      if (node.op === "&") return `${toText(l)}${toText(r)}`;
      if (node.op === "=" || node.op === "<>" || node.op === "<" || node.op === ">" || node.op === "<=" || node.op === ">=") {
        const a = l ?? "", b = r ?? "";
        const cmp = typeof a === "string" && typeof b === "string" ? a.localeCompare(b, "pt-BR") : Number(a) - Number(b);
        return node.op === "=" ? cmp === 0 : node.op === "<>" ? cmp !== 0 : node.op === "<" ? cmp < 0 : node.op === ">" ? cmp > 0 : node.op === "<=" ? cmp <= 0 : cmp >= 0;
      }
      const a = toNum(l), b = toNum(r);
      if (typeof a !== "number") return a;
      if (typeof b !== "number") return b;
      if (node.op === "+") return a + b;
      if (node.op === "-") return a - b;
      if (node.op === "*") return a * b;
      if (node.op === "/") return b === 0 ? err("#DIV/0!") : a / b;
      if (node.op === "^") return a ** b;
      return err("#VALUE!");
    }
    case "call": return callFn(node.name, node.args, look, stack);
  }
}

/** Entrada crua de uma célula: número, texto, booleano ou fórmula (começa com "="). */
export type RawCell = string | number | boolean | null;

const key = (c: number, r: number) => `${c},${r}`;

/**
 * Calcula o valor de todas as células de uma aba. Resolve dependências sob demanda com cache
 * e detecta referências circulares (#CYCLE!). Erros de sintaxe viram #ERROR!.
 */
export function computeSheet(raw: Map<string, RawCell>): Map<string, CellValue> {
  const memo = new Map<string, CellValue>();
  const visiting = new Set<string>();

  const valueOf = (c: number, r: number): CellValue => {
    const k = key(c, r);
    if (memo.has(k)) return memo.get(k)!;
    const input = raw.get(k) ?? null;
    if (typeof input !== "string" || !input.startsWith("=")) {
      memo.set(k, input);
      return input;
    }
    if (visiting.has(k)) return err("#CYCLE!");
    visiting.add(k);
    let result: CellValue;
    try {
      result = evaluate(parse(input), valueOf);
    } catch {
      result = err("#ERROR!");
    }
    visiting.delete(k);
    memo.set(k, result);
    return result;
  };

  for (const k of raw.keys()) {
    const [c, r] = k.split(",").map(Number);
    valueOf(c, r);
  }
  return memo;
}

/** Valores numéricos de argumentos, expandindo intervalos e ignorando texto/vazio. */
function numbersOf(args: Node[], look: Lookup, stack: Set<string>): number[] | SheetError {
  const out: number[] = [];
  for (const a of args) {
    const cells = a.k === "range" ? rangeCells(a).map(([c, r]) => look(c, r)) : [evaluate(a, look, stack)];
    for (const v of cells) {
      if (isError(v)) return v;
      if (typeof v === "number") out.push(v);
    }
  }
  return out;
}

function callFn(name: string, args: Node[], look: Lookup, stack: Set<string>): CellValue {
  const nums = () => numbersOf(args, look, stack);
  switch (name) {
    case "SUM": { const n = nums(); return Array.isArray(n) ? n.reduce((s, x) => s + x, 0) : n; }
    case "AVERAGE": {
      const n = nums(); if (!Array.isArray(n)) return n;
      return n.length ? n.reduce((s, x) => s + x, 0) / n.length : err("#DIV/0!");
    }
    case "MIN": { const n = nums(); return Array.isArray(n) ? (n.length ? Math.min(...n) : 0) : n; }
    case "MAX": { const n = nums(); return Array.isArray(n) ? (n.length ? Math.max(...n) : 0) : n; }
    case "COUNT": { const n = nums(); return Array.isArray(n) ? n.length : n; }
    case "ABS": case "SQRT": case "ROUND": case "ROUNDUP": case "ROUNDDOWN": case "MOD": case "POWER": {
      const v = args.map((a) => toNum(evaluate(a, look, stack)));
      const bad = v.find((x): x is SheetError => typeof x !== "number");
      if (bad) return bad;
      const [x = 0, y = 0] = v as number[];
      if (name === "ABS") return Math.abs(x);
      if (name === "SQRT") return x < 0 ? err("#VALUE!") : Math.sqrt(x);
      if (name === "POWER") return x ** y;
      if (name === "MOD") return y === 0 ? err("#DIV/0!") : x - y * Math.floor(x / y);
      const f = 10 ** y;
      if (name === "ROUND") return Math.round(x * f) / f;
      if (name === "ROUNDUP") return (x < 0 ? -Math.ceil(-x * f) : Math.ceil(x * f)) / f;
      return (x < 0 ? -Math.floor(-x * f) : Math.floor(x * f)) / f;
    }
    case "IF": {
      const c = evaluate(args[0], look, stack);
      if (isError(c)) return c;
      const truthy = typeof c === "string" ? c !== "" : Boolean(c);
      if (truthy) return args[1] ? evaluate(args[1], look, stack) : true;
      return args[2] ? evaluate(args[2], look, stack) : false;
    }
    case "IFERROR": {
      const v = evaluate(args[0], look, stack);
      return isError(v) ? evaluate(args[1], look, stack) : v;
    }
    case "AND": case "OR": {
      const vals = args.map((a) => evaluate(a, look, stack));
      const err1 = vals.find(isError); if (err1) return err1;
      const bools = vals.map((v) => (typeof v === "string" ? v !== "" : Boolean(v)));
      return name === "AND" ? bools.every(Boolean) : bools.some(Boolean);
    }
    case "NOT": {
      const v = evaluate(args[0], look, stack);
      if (isError(v)) return v;
      return !(typeof v === "string" ? v !== "" : Boolean(v));
    }
    case "CONCATENATE": case "CONCAT": {
      let s = "";
      for (const a of args) {
        const cells = a.k === "range" ? rangeCells(a).map(([c, r]) => look(c, r)) : [evaluate(a, look, stack)];
        for (const v of cells) { const t = toText(v); if (typeof t !== "string") return t; s += t; }
      }
      return s;
    }
    case "LEFT": case "RIGHT": case "MID": case "LEN": case "UPPER": case "LOWER": case "TRIM": {
      const t = toText(evaluate(args[0], look, stack));
      if (typeof t !== "string") return t;
      if (name === "LEN") return t.length;
      if (name === "UPPER") return t.toUpperCase();
      if (name === "LOWER") return t.toLowerCase();
      if (name === "TRIM") return t.trim().replace(/\s+/g, " ");
      const n = args[1] ? toNum(evaluate(args[1], look, stack)) : 1;
      if (typeof n !== "number") return n;
      if (name === "LEFT") return t.slice(0, n);
      if (name === "RIGHT") return n === 0 ? "" : t.slice(-n);
      const start = args[2] ? toNum(evaluate(args[2], look, stack)) : 0;
      if (typeof start !== "number") return start;
      return t.substr(n - 1, start);
    }
    case "COUNTA": {
      let c = 0;
      for (const a of args) {
        const cells = a.k === "range" ? rangeCells(a).map(([x, r]) => look(x, r)) : [evaluate(a, look, stack)];
        c += cells.filter((v) => v !== null && v !== "").length;
      }
      return c;
    }
    default: return err("#NAME?");
  }
}
