// Markdown mínimo e seguro (tudo é escapado antes de formatar).
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:]|$)/g, '$1<em>$2</em>');
}
function md(src) {
  const lines = String(src).replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  let list = null;
  const closeList = () => { if (list) { out.push('</' + list + '>'); list = null; } };
  const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
  while (i < lines.length) {
    const ln = lines[i];
    if (/^```/.test(ln)) {
      closeList();
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>');
      continue;
    }
    if (isTableRow(ln) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      closeList();
      const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(ln);
      i += 2;
      const rows = [];
      while (i < lines.length && isTableRow(lines[i])) rows.push(cells(lines[i++]));
      out.push('<div class="tw"><table><thead><tr>' + head.map((c) => '<th>' + inline(c) + '</th>').join('') +
        '</tr></thead><tbody>' + rows.map((r) => '<tr>' + r.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') +
        '</tbody></table></div>');
      continue;
    }
    const h = ln.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      closeList();
      const lv = Math.min(h[1].length + 2, 6);
      out.push('<h' + lv + ' class="mh">' + inline(h[2]) + '</h' + lv + '>');
      i++;
      continue;
    }
    const ul = ln.match(/^\s*[-*•]\s+(.*)$/);
    const ol = ln.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      const t = ul ? 'ul' : 'ol';
      if (list !== t) { closeList(); out.push('<' + t + '>'); list = t; }
      out.push('<li>' + inline((ul || ol)[1]) + '</li>');
      i++;
      continue;
    }
    if (/^---+\s*$/.test(ln)) { closeList(); out.push('<hr>'); i++; continue; }
    if (!ln.trim()) { closeList(); i++; continue; }
    closeList();
    const para = [ln];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,4}\s|\s*[-*•]\s|\s*\d+[.)]\s|\s*\|)/.test(lines[i])) para.push(lines[i++]);
    out.push('<p>' + inline(para.join('\n')).replace(/\n/g, '<br>') + '</p>');
  }
  closeList();
  return out.join('');
}
