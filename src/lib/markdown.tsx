// Tiny inline markdown renderer for headings, bold, italic, code, links, lists, line breaks.
// Avoids pulling a full markdown lib into the bundle.

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string) {
  let t = escapeHtml(s);
  t = t.replace(/`([^`]+)`/g, '<code class="rounded bg-secondary px-1.5 py-0.5 text-[0.85em]">$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  t = t.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline-offset-2 hover:underline">$1</a>');
  return t;
}

export function renderMarkdown(src: string): string {
  const lines = (src ?? "").replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let list: string[] | null = null;

  const flushPara = () => { if (para.length) { out.push(`<p class="leading-relaxed">${inline(para.join(" "))}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<ul class="list-disc space-y-1 pl-6">${list.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`); list = null; } };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushPara(); flushList(); continue; }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^######\s+(.*)/))) { flushPara(); flushList(); out.push(`<h6 class="font-display text-sm font-semibold">${inline(m[1])}</h6>`); }
    else if ((m = line.match(/^#####\s+(.*)/))) { flushPara(); flushList(); out.push(`<h5 class="font-display text-base font-semibold">${inline(m[1])}</h5>`); }
    else if ((m = line.match(/^####\s+(.*)/))) { flushPara(); flushList(); out.push(`<h4 class="font-display text-lg font-semibold">${inline(m[1])}</h4>`); }
    else if ((m = line.match(/^###\s+(.*)/))) { flushPara(); flushList(); out.push(`<h3 class="font-display text-xl font-bold">${inline(m[1])}</h3>`); }
    else if ((m = line.match(/^##\s+(.*)/))) { flushPara(); flushList(); out.push(`<h2 class="font-display text-2xl font-bold">${inline(m[1])}</h2>`); }
    else if ((m = line.match(/^#\s+(.*)/))) { flushPara(); flushList(); out.push(`<h1 class="font-display text-3xl font-bold">${inline(m[1])}</h1>`); }
    else if ((m = line.match(/^[-*]\s+(.*)/))) { flushPara(); if (!list) list = []; list.push(m[1]); }
    else { flushList(); para.push(line); }
  }
  flushPara(); flushList();
  return out.join("\n");
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  return <div className={`space-y-3 text-sm text-foreground/90 ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }} />;
}
