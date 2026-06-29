// 軽量・安全な Markdown → HTML レンダラ（外部依存なし）。
// HTML を先にエスケープしてから Markdown 記法を適用するため、
// 投稿者が生の HTML / <script> を埋め込んでも無効化される（XSS対策）。
// リンク/画像の URL は http(s)・相対パス・# のみ許可。

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function safeUrl(u: string): string {
  return /^(https?:\/\/|\/|#|mailto:)/i.test(u.trim()) ? u.trim() : '#';
}

function inline(s: string): string {
  // 画像 ![alt](url)
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt, url) =>
    `<img src="${safeUrl(url)}" alt="${alt}" style="max-width:100%;height:auto;border-radius:10px;margin:8px 0" />`);
  // リンク [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text, url) =>
    `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline">${text}</a>`);
  // 太字 **text**
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // 斜体 *text*
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  // インラインコード `code`
  s = s.replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:.9em">$1</code>');
  return s;
}

export function renderMarkdown(md: string): string {
  const lines = esc(md || '').split('\n');
  let html = '';
  let inUl = false;
  let inOl = false;
  const closeLists = () => {
    if (inUl) { html += '</ul>'; inUl = false; }
    if (inOl) { html += '</ol>'; inOl = false; }
  };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { closeLists(); continue; }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^###\s+(.*)/))) { closeLists(); html += `<h3 style="font-size:1.25rem;font-weight:800;margin:1.5em 0 .5em">${inline(m[1])}</h3>`; continue; }
    if ((m = line.match(/^##\s+(.*)/))) { closeLists(); html += `<h2 style="font-size:1.5rem;font-weight:800;margin:1.6em 0 .6em">${inline(m[1])}</h2>`; continue; }
    if ((m = line.match(/^#\s+(.*)/))) { closeLists(); html += `<h1 style="font-size:1.9rem;font-weight:900;margin:1.5em 0 .6em">${inline(m[1])}</h1>`; continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) { closeLists(); html += '<hr style="border:none;border-top:1px solid #e5e7eb;margin:2em 0" />'; continue; }
    if ((m = line.match(/^>\s?(.*)/))) { closeLists(); html += `<blockquote style="border-left:4px solid #cbd5e1;padding:4px 16px;margin:1em 0;color:#475569">${inline(m[1])}</blockquote>`; continue; }
    if ((m = line.match(/^[-*]\s+(.*)/))) { if (inOl) { html += '</ol>'; inOl = false; } if (!inUl) { html += '<ul style="margin:1em 0;padding-left:1.4em;list-style:disc">'; inUl = true; } html += `<li style="margin:.3em 0">${inline(m[1])}</li>`; continue; }
    if ((m = line.match(/^\d+\.\s+(.*)/))) { if (inUl) { html += '</ul>'; inUl = false; } if (!inOl) { html += '<ol style="margin:1em 0;padding-left:1.4em;list-style:decimal">'; inOl = true; } html += `<li style="margin:.3em 0">${inline(m[1])}</li>`; continue; }
    closeLists();
    html += `<p style="margin:1em 0;line-height:1.9">${inline(line)}</p>`;
  }
  closeLists();
  return html;
}

// Markdown を除去したプレーンテキスト抜粋（メタディスクリプション用）
export function plainExcerpt(md: string | null, max = 120): string {
  if (!md) return '';
  const plain = md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*`_~-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > max ? plain.slice(0, max) + '…' : plain;
}
