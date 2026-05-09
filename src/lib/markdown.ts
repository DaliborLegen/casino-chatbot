function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(s: string): string {
  let out = escapeHtml(s);
  out = out.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[0.85em]">$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-zinc-100 font-semibold">$1</strong>');
  out = out.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" class="text-sky-400 underline hover:text-sky-300" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  return out;
}

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let listOpen = false;
  let paraBuf: string[] = [];

  function flushPara() {
    if (paraBuf.length === 0) return;
    out.push(`<p class="text-sm text-zinc-200 leading-relaxed mb-3">${renderInline(paraBuf.join(" "))}</p>`);
    paraBuf = [];
  }
  function closeList() {
    if (listOpen) {
      out.push("</ul>");
      listOpen = false;
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("### ")) {
      flushPara();
      closeList();
      out.push(`<h3 class="text-base font-semibold text-zinc-100 mt-5 mb-2">${renderInline(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      flushPara();
      closeList();
      out.push(`<h2 class="text-lg font-semibold text-zinc-100 mt-6 mb-3 pb-1 border-b border-zinc-800">${renderInline(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      flushPara();
      closeList();
      out.push(`<h1 class="text-xl font-semibold text-zinc-100 mt-6 mb-3">${renderInline(line.slice(2))}</h1>`);
    } else if (/^[-*]\s+/.test(line)) {
      flushPara();
      if (!listOpen) {
        out.push('<ul class="list-disc pl-6 mb-3 space-y-1">');
        listOpen = true;
      }
      out.push(`<li class="text-sm text-zinc-200 leading-relaxed">${renderInline(line.replace(/^[-*]\s+/, ""))}</li>`);
    } else if (line === "---") {
      flushPara();
      closeList();
      out.push('<hr class="border-zinc-800 my-4" />');
    } else if (line === "") {
      flushPara();
      closeList();
    } else {
      closeList();
      paraBuf.push(line);
    }
  }
  flushPara();
  closeList();
  return out.join("\n");
}
