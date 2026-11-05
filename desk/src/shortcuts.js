/* Convenções de app desktop: atalhos, paleta de comandos, busca na conversa, exportar,
   copiar, ir ao fim e notificação de atividade. Usa o estado e as funções do app.js. */
'use strict';

const isTyping = (t) => !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
const VIEWS = [['broker', 'Broker', 'crown'], ['agents', 'Agentes', 'users'], ['chain', 'Cadeia', 'chat'], ['brain', 'Organograma', 'net'], ['memory', 'Memória', 'db'], ['general', 'Memória geral', 'layers'], ['projects', 'Projetos', 'folder'], ['settings', 'Configurações', 'gear']];

// Sair da tela atual respeitando edição não salva.
function leaveEdit() {
  if (state.edit && state.edit.dirty) { toast('Salve ou cancele a edição antes de sair.', true); return false; }
  state.edit = null;
  return true;
}
function goView(v) {
  if (!leaveEdit()) return;
  state.view = v; state.q = ''; state.justSwitched = true; state.highlightTools = false;
  paintAll(false);
}
function pickAgent(key) {
  if (!leaveEdit()) return;
  state.view = 'agents'; state.sel = key; state.userPicked = true; state.q = ''; state.tokens = 0;
  paintAll(false);
}
function editCurrent() {
  if (state.edit) return;
  if (state.view === 'agents') { const a = curAgent(); if (a && a.defined) { state.edit = { kind: 'agent', dirty: false }; renderCenter(false); } }
  else if (state.view === 'general' && state.gSel) { state.edit = { kind: 'file', path: state.gSel, dirty: false }; renderCenter(false); }
}

// ---------- copiar ----------
async function copyText(text) {
  if (text == null) return;
  await window.desk.copy(String(text));
  toast('Copiado.');
}

// ---------- navegar a lista com ↑ ↓ ----------
function stepSel(dir) {
  const items = [...document.querySelectorAll('#list .item')];
  if (!items.length) return;
  let i = items.findIndex((x) => x.classList.contains('on'));
  i = i < 0 ? (dir > 0 ? 0 : items.length - 1) : Math.max(0, Math.min(items.length - 1, i + dir));
  items[i].click();
  const again = [...document.querySelectorAll('#list .item')][i];
  if (again) again.scrollIntoView({ block: 'nearest' });
}
function focusSearch() { const q = $('#q'); if (q) { q.focus(); q.select(); } }

// ---------- exportar conversa (Markdown) ----------
function exportMarkdown() {
  const lt = state.lastThread;
  if (!lt || !lt.length || !['agents', 'chain'].includes(state.view)) { toast('Nada para exportar nesta tela.', true); return; }
  const title = state.view === 'agents' ? (curAgent() || {}).name : (curSession() || {}).project;
  const L = [`# Conversa: ${title || 'agentes'}`, '', `_Exportado do Nirvana Desk em ${new Date().toLocaleString('pt-BR')}_`, ''];
  for (const { run, data } of lt) {
    const a = run._agent ? run._agent.name : run.agentType;
    L.push(`## ${fmtDay(run.start)} ${fmtTime(run.start)} · ${a}${run.project ? ` · ${run.project}` : ''}${run.description ? ` · ${run.description}` : ''}`, '');
    for (const m of data.msgs) {
      if (m.k === 'brief' || m.k === 'user') L.push(`**Broker → ${a}**`, '', ...m.t.split('\n').map((x) => `> ${x}`), '');
      else if (m.k === 'agent') L.push(`**${a}**`, '', m.t, '');
      else if (m.k === 'tools') L.push(`_Ferramentas:_ ${m.items.map((t) => `${t.name}${t.s ? ` (${t.s})` : ''}`).join('; ')}`, '');
      else if (m.k === 'note') L.push(`_${m.t}_`, '');
    }
  }
  const name = `conversa-${(title || 'agentes').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.md`;
  window.desk.exportSave(name, L.join('\n')).then((r) => toast(r && r.saved ? 'Conversa exportada.' : 'Exportação cancelada.', !(r && r.saved)));
}

// ---------- paleta de comandos (Ctrl+K) ----------
const norm2 = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function fuzzy(label, q) {
  if (!q) return 1;
  const L = norm2(label), Q = norm2(q).trim();
  const at = L.indexOf(Q);
  if (at >= 0) return 100 - at + (at === 0 ? 50 : 0);
  let i = 0, score = 0, run = 0;
  for (const c of L) { if (c === Q[i]) { i++; run++; score += run * 2; } else run = 0; if (i === Q.length) return score; }
  return 0;
}
function commands() {
  const out = [];
  VIEWS.forEach(([v, name, ic], i) => out.push({ ic, label: `Ir para ${name}`, hint: i < 7 ? `Ctrl+${i + 1}` : 'Ctrl+,', run: () => goView(v) }));
  out.push({ ic: 'refresh', label: 'Atualizar agora', hint: 'F5', run: () => refresh(true) });
  out.push({ ic: 'search', label: 'Buscar na conversa', hint: 'Ctrl+F', run: openFind });
  out.push({ ic: 'download', label: 'Exportar conversa (Markdown)', hint: 'Ctrl+Shift+E', run: exportMarkdown });
  out.push({ ic: 'pen', label: 'Editar o agente ou arquivo atual', hint: 'Ctrl+E', run: editCurrent });
  out.push({ ic: 'command', label: 'Atalhos de teclado', hint: '?', run: openHelp });
  state.agents.forEach((a) => out.push({ ic: a.icon, color: a.color, label: `Agente: ${a.name}`, hint: a.role || '', run: () => pickAgent(a.key) }));
  state.sessions.slice(0, 20).forEach((s) => out.push({ ic: 'branch', label: `Sessão: ${s.project || s.id}`, hint: `${s.runs.length} execuções`, run: () => { if (!leaveEdit()) return; state.view = 'chain'; state.selSession = s.id; state.shownChain = 8; paintAll(false); } }));
  state.gmem.slice(0, 120).forEach((m) => out.push({ ic: gIcon(m.group), color: gColor(m.group), label: `Memória: ${m.title}`, hint: m.group, run: () => { if (!leaveEdit()) return; state.view = 'general'; state.gSel = m.path; paintAll(false); } }));
  return out;
}
let pal = { open: false, items: [], idx: 0 };
function ensureOverlays() {
  if ($('#pal')) return;
  document.body.insertAdjacentHTML('beforeend', `
  <div id="pal" class="overlay" hidden><div class="palbox" role="dialog" aria-label="Paleta de comandos"><input id="pal-q" placeholder="Digite um comando, agente ou memória…" autocomplete="off" spellcheck="false"><div id="pal-list"></div><div class="palfoot"><kbd>↑</kbd><kbd>↓</kbd> navegar · <kbd>Enter</kbd> executar · <kbd>Esc</kbd> fechar</div></div></div>
  <div id="help" class="overlay" hidden><div class="helpbox" role="dialog" aria-label="Atalhos de teclado"><h2>Atalhos de teclado</h2>${helpHtml()}</div></div>
  <div id="findbar" hidden><input id="find-q" placeholder="Buscar na conversa" autocomplete="off" spellcheck="false" aria-label="Buscar na conversa"><span id="find-n"></span><button data-f="prev" title="Anterior (Shift+Enter)" aria-label="Anterior">${icon('up', 16)}</button><button data-f="next" title="Próximo (Enter)" aria-label="Próximo">${icon('down', 16)}</button><button data-f="close" title="Fechar (Esc)" aria-label="Fechar">${icon('x', 16)}</button></div>
  <button id="jump" hidden>${icon('down', 16)} Ir para o fim</button>`);
  $('#pal').addEventListener('mousedown', (e) => { if (e.target.id === 'pal') closePalette(); });
  $('#help').addEventListener('mousedown', (e) => { if (e.target.id === 'help') closeHelp(); });
  $('#pal-q').addEventListener('input', renderPalette);
  $('#pal-list').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) runPalette(+b.dataset.i); });
  $('#find-q').addEventListener('input', () => doFind(true));
  $('#findbar').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (!b) return; if (b.dataset.f === 'close') closeFind(); else doFind(false, b.dataset.f === 'next'); });
  $('#jump').addEventListener('click', () => { const t = document.querySelector('.thread'); if (t) t.scrollTo({ top: t.scrollHeight, behavior: 'smooth' }); });
}
function helpHtml() {
  const g = (title, rows) => `<div class="grp">${title}</div>` + rows.map(([d, k]) => `<div class="kr"><span>${d}</span><span>${k.split('+').map((x) => `<kbd>${x}</kbd>`).join('')}</span></div>`).join('');
  return g('Navegação', [['Paleta de comandos', 'Ctrl+K'], ['Broker / Agentes / Cadeia / Organograma / Memória / Memória geral / Projetos', 'Ctrl+1…7'], ['Configurações', 'Ctrl+,'], ['Item anterior / próximo da lista', '↑+↓'], ['Buscar na lista', '/']])
    + g('Conversa', [['Buscar na conversa', 'Ctrl+F'], ['Próximo / anterior resultado', 'Enter+Shift+Enter'], ['Ir ao fim / ao início', 'End+Home'], ['Exportar em Markdown', 'Ctrl+Shift+E'], ['Copiar mensagem', 'passe o mouse e clique']])
    + g('Geral', [['Atualizar agora', 'F5'], ['Editar agente ou arquivo', 'Ctrl+E'], ['Salvar edição', 'Ctrl+S'], ['Fechar / cancelar', 'Esc'], ['Este painel', '?']]);
}
function openPalette() { ensureOverlays(); closeHelp(); pal.open = true; $('#pal').hidden = false; $('#pal-q').value = ''; pal.idx = 0; renderPalette(); $('#pal-q').focus(); }
function closePalette() { pal.open = false; const p = $('#pal'); if (p) p.hidden = true; }
function renderPalette() {
  const q = $('#pal-q').value;
  pal.items = commands().map((c) => ({ c, s: fuzzy(c.label + ' ' + (c.hint || ''), q) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 14).map((x) => x.c);
  pal.idx = Math.min(pal.idx, Math.max(0, pal.items.length - 1));
  $('#pal-list').innerHTML = pal.items.length ? pal.items.map((c, i) => `<button class="pal-item ${i === pal.idx ? 'on' : ''}" data-i="${i}" style="${c.color ? `--c:${c.color}` : ''}">${icon(c.ic || 'command', 18)}<span class="tt">${esc(c.label)}</span><small>${esc(c.hint || '')}</small></button>`).join('') : '<div class="pal-empty">Nada encontrado.</div>';
  const on = $('#pal-list .on'); if (on) on.scrollIntoView({ block: 'nearest' });
}
function runPalette(i) { const c = pal.items[i]; closePalette(); if (c) c.run(); }
function palKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); pal.idx = Math.min(pal.items.length - 1, pal.idx + 1); renderPalette(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); pal.idx = Math.max(0, pal.idx - 1); renderPalette(); }
  else if (e.key === 'Enter') { e.preventDefault(); runPalette(pal.idx); }
}

// ---------- ajuda ----------
let helpOpen = false;
function openHelp() { ensureOverlays(); closePalette(); helpOpen = true; $('#help').hidden = false; }
function closeHelp() { helpOpen = false; const h = $('#help'); if (h) h.hidden = true; }

// ---------- buscar na conversa (Ctrl+F) ----------
let findOpen = false;
function openFind() { ensureOverlays(); findOpen = true; $('#findbar').hidden = false; const i = $('#find-q'); i.focus(); i.select(); if (i.value) doFind(true); }
function closeFind() { findOpen = false; const f = $('#findbar'); if (f) f.hidden = true; window.desk.stopFind(); }
function doFind(fresh, forward = true) {
  const text = $('#find-q').value;
  if (!text) { window.desk.stopFind(); $('#find-n').textContent = ''; return; }
  window.desk.find(text, { forward, findNext: !fresh });
  setTimeout(() => { if (findOpen) $('#find-q').focus(); }, 0); // o findInPage pode roubar o foco
}
if (window.desk.onFound) window.desk.onFound((r) => { const n = $('#find-n'); if (n) n.textContent = r.matches ? `${r.active}/${r.matches}` : 'sem resultado'; if (findOpen) { const i = $('#find-q'); if (i && document.activeElement !== i) i.focus(); } });

// ---------- ir ao fim ----------
function updateJump() {
  const j = $('#jump'); if (!j) return;
  const t = document.querySelector('.thread');
  j.hidden = !(t && t.scrollHeight - t.scrollTop - t.clientHeight > 220);
}
document.addEventListener('scroll', (e) => { if (e.target.classList && e.target.classList.contains('thread')) updateJump(); }, true);
new MutationObserver(() => { ensureOverlays(); updateJump(); }).observe(document.getElementById('center'), { childList: true });

// ---------- notificação de atividade (só com a janela sem foco) ----------
let prevActive = null;
function notifyChanges() {
  const now = new Set(state.agents.filter((a) => a.active).map((a) => a.key));
  if (prevActive && !document.hasFocus()) {
    for (const a of state.agents) {
      if (now.has(a.key) && !prevActive.has(a.key)) {
        try { new Notification(`${a.name} está trabalhando`, { body: (a.runs[0] && a.runs[0].description) || a.role || 'Nova atividade', silent: true }); } catch { /* sem permissão */ }
      }
    }
  }
  prevActive = now;
}

// ---------- teclado ----------
document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key;
  const lower = k.length === 1 ? k.toLowerCase() : k;
  ensureOverlays();
  if (pal.open) { palKey(e); return; }
  if (helpOpen) { if (k === 'Escape' || k === '?' || k === 'F1') { e.preventDefault(); closeHelp(); } return; }
  const typing = isTyping(e.target);
  if (mod && lower === 'k') { e.preventDefault(); openPalette(); return; }
  if (mod && lower === 'f') { e.preventDefault(); openFind(); return; }
  if (findOpen && e.target.id === 'find-q') {
    if (k === 'Enter') { e.preventDefault(); doFind(false, !e.shiftKey); return; }
    if (k === 'Escape') { e.preventDefault(); closeFind(); return; }
  }
  if (mod && e.shiftKey && lower === 'e') { e.preventDefault(); exportMarkdown(); return; }
  if (mod && /^[1-7]$/.test(k)) { e.preventDefault(); goView(VIEWS[+k - 1][0]); return; }
  if (mod && k === ',') { e.preventDefault(); goView('settings'); return; }
  if (mod && !e.shiftKey && lower === 'e') { e.preventDefault(); editCurrent(); return; }
  if (k === 'F5' || (mod && lower === 'r')) { e.preventDefault(); refresh(true); return; }
  if (k === 'F1' || (k === '?' && !typing)) { e.preventDefault(); openHelp(); return; }
  if (k === 'Escape') {
    if (findOpen) { closeFind(); return; }
    if (typing && e.target.id === 'q') { state.q = ''; renderList(); const q2 = $('#q'); if (q2) q2.blur(); }
    return;
  }
  if (typing) return;
  if (k === '/') { e.preventDefault(); focusSearch(); return; }
  if (k === 'ArrowDown') { e.preventDefault(); stepSel(1); return; }
  if (k === 'ArrowUp') { e.preventDefault(); stepSel(-1); return; }
  const th = document.querySelector('.thread');
  if (k === 'End' && th) { e.preventDefault(); th.scrollTo({ top: th.scrollHeight, behavior: 'instant' }); return; }
  if (k === 'Home' && th) { e.preventDefault(); th.scrollTo({ top: 0, behavior: 'instant' }); }
});

// ---------- comandos vindos do menu nativo ----------
if (window.desk.onCommand) {
  window.desk.onCommand((c) => {
    const run = { palette: openPalette, refresh: () => refresh(true), export: exportMarkdown, help: openHelp, find: openFind }[c];
    if (run) run();
  });
}
