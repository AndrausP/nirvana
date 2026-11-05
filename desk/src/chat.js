/* Falar com o Claude Code pelo app. Cada conversa é um processo `claude -p` (stream-json) no main:
   mesmos comandos, skills, hooks, plugins, ferramentas e memória do CLI instalado. Aqui: UI e eventos. */
const Chat = (() => {
  const sessions = new Map();   // chave da conversa -> sessão viva
  const byProc = new Map();     // id do processo -> sessão
  let info = null;              // { bin, version, modes }
  let cmds = [];                // comandos conhecidos antes do init
  let newN = 0;
  const prefs = Object.assign({ model: '', mode: 'manual' }, store.get('nirvana-desk.chat', {}));
  const savePrefs = () => store.set('nirvana-desk.chat', prefs);

  const MODELS = [['', 'Modelo padrão'], ['opus', 'Opus'], ['sonnet', 'Sonnet'], ['haiku', 'Haiku']];
  const MODE_LABEL = { manual: 'Perguntar antes', acceptEdits: 'Aceitar edições', plan: 'Só planejar', bypassPermissions: 'Pular permissões' };

  // ---------- alvo da conversa ----------
  function target() {
    if (state.newChat) return { key: state.newChat.key, cwd: state.newChat.cwd, resume: '', title: 'Nova conversa' };
    const b = state.broker.find((x) => x.id === state.bSel);
    if (b) return { key: b.id, cwd: b.cwd, resume: b.id, title: b.project };
    const ls = sessions.get(state.bSel); // sessão já viva cujo transcript ainda não foi indexado
    return ls ? { key: ls.key, cwd: ls.cwd, resume: ls.sessionId || '', title: 'Nova conversa' } : { key: '', cwd: '', resume: '', title: '' };
  }
  const cur = () => sessions.get(target().key);

  // ---------- eventos do CLI ----------
  function tsum(name, input) {
    input = input || {};
    const p = input.file_path || input.path || input.pattern || input.command || input.description || input.query || input.url || input.prompt || '';
    return clip(String(p).replace(/\s+/g, ' ').trim(), 110);
  }
  const lastOf = (s, f) => { for (let i = s.items.length - 1; i >= 0; i--) if (f(s.items[i])) return s.items[i]; return null; };

  function onEvent({ id, ev }) {
    const s = byProc.get(id);
    if (!s) return;
    if (ev.type === 'desk_exit') {
      s.dead = true; s.busy = false;
      s.items.push({ k: 'note', t: ev.code ? `A sessão do Claude Code terminou (código ${ev.code}).${ev.error ? ' ' + ev.error : ''}` : 'Sessão encerrada.' });
      byProc.delete(id); done(s); return;
    }
    if (ev.parent_tool_use_id) return; // fala interna de subagente: aparece no chat do agente, não aqui
    switch (ev.type) {
      case 'system':
        if (ev.subtype === 'init') {
          s.sessionId = ev.session_id; s.model = ev.model || s.model; s.mode = ev.permissionMode || s.mode;
          s.slash = [...new Set([...(ev.slash_commands || []), ...(ev.skills || [])])];
          if (s.key.startsWith('new:')) { sessions.delete(s.key); s.key = ev.session_id; sessions.set(s.key, s); if (state.newChat && state.newChat.key.startsWith('new:')) { state.newChat = null; state.bSel = s.key; } refresh(true); }
        } else if (ev.subtype === 'compact_boundary') s.items.push({ k: 'note', t: 'Conversa compactada.' });
        break;
      case 'stream_event': stream(s, ev.event || {}); break;
      case 'assistant': finalize(s, ev.message || {}); break;
      case 'user': {
        for (const b of ((ev.message || {}).content || [])) if (b && b.type === 'tool_result') {
          const t = lastOf(s, (x) => x.k === 'tool' && x.id === b.tool_use_id);
          if (t) { t.state = b.is_error ? 'err' : 'ok'; }
        }
        break;
      }
      case 'control_request':
        if (ev.request && ev.request.subtype === 'can_use_tool') {
          s.items.push({ k: 'perm', req: ev.request_id, tool: ev.request.tool_name, input: ev.request.input || {}, desc: ev.request.decision_reason || ev.request.description || '', sugg: ev.request.permission_suggestions || [], st: 'ask' });
          if (!document.hasFocus() && 'Notification' in window) { try { new Notification('Claude pede permissão', { body: `${ev.request.tool_name}: ${tsum(ev.request.tool_name, ev.request.input)}` }); } catch { /* sem notificação */ } }
        }
        break;
      case 'control_cancel_request': { const p = lastOf(s, (x) => x.k === 'perm' && x.req === ev.request_id); if (p && p.st === 'ask') p.st = 'cancel'; break; }
      case 'result':
        s.busy = false;
        s.items.push({ k: 'result', ok: !ev.is_error && ev.subtype === 'success', ms: ev.duration_ms, cost: ev.total_cost_usd, sub: ev.subtype, t: ev.is_error ? String(ev.result || '') : '' });
        done(s, true); return;
    }
    paint();
  }

  function stream(s, e) {
    if (e.type === 'message_start') { s.mid = (e.message || {}).id; return; }
    if (e.type === 'content_block_start') {
      const b = e.content_block || {};
      if (b.type === 'text') s.items.push({ k: 'agent', t: '', mid: s.mid, idx: e.index, live: true });
      else if (b.type === 'tool_use') s.items.push({ k: 'tool', id: b.id, name: b.name, s: '', json: '', state: 'run' });
      else if (b.type === 'thinking') s.thinking = true;
    } else if (e.type === 'content_block_delta') {
      const d = e.delta || {};
      if (d.type === 'text_delta') { const it = lastOf(s, (x) => x.k === 'agent' && x.live); if (it) it.t += d.text || ''; }
      else if (d.type === 'input_json_delta') { const it = lastOf(s, (x) => x.k === 'tool' && x.state === 'run'); if (it) { it.json += d.partial_json || ''; } }
    } else if (e.type === 'content_block_stop') {
      s.thinking = false;
      const it = lastOf(s, (x) => x.k === 'tool' && x.json && !x.s);
      if (it) { try { it.s = tsum(it.name, JSON.parse(it.json)); } catch { /* json parcial */ } }
      const tx = lastOf(s, (x) => x.k === 'agent' && x.live);
      if (tx) tx.live = false;
    }
  }
  function finalize(s, m) {
    for (const b of m.content || []) {
      if (b.type === 'text' && b.text) {
        const it = lastOf(s, (x) => x.k === 'agent' && x.mid === m.id && x.t.length <= b.text.length) || null;
        if (it) { it.t = b.text; it.live = false; } else if (!lastOf(s, (x) => x.k === 'agent' && x.mid === m.id && x.t === b.text)) s.items.push({ k: 'agent', t: b.text, mid: m.id });
      } else if (b.type === 'tool_use') {
        const it = lastOf(s, (x) => x.k === 'tool' && x.id === b.id);
        if (it) it.s = tsum(b.name, b.input); else s.items.push({ k: 'tool', id: b.id, name: b.name, s: tsum(b.name, b.input), state: 'run' });
      }
    }
  }
  async function done(s, ok) {
    paint();
    if (ok) {
      await refresh(true);
      // quando o transcript já traz a conversa, o trecho "ao vivo" some (sem duplicar)
      if (state.broker.find((x) => x.id === s.sessionId) && !s.items.some((x) => x.k === 'perm' && x.st === 'ask')) {
        let iMe = -1; s.items.forEach((x, i) => { if (x.k === 'me') iMe = i; });
        s.items = s.items.slice(iMe + 1).filter((x) => x.k === 'note' || x.k === 'result');
      }
      paint();
    }
  }

  // ---------- ações ----------
  async function ensureInfo() {
    if (info) return info;
    const r = await window.desk.cliInfo();
    info = r.ok ? r.v : { bin: '', version: '', modes: [] };
    try { cmds = await window.desk.commands(); } catch { cmds = []; }
    return info;
  }
  async function start(t) {
    const i = await ensureInfo();
    if (!i.bin) { toast('Claude Code (claude) não encontrado neste computador.', true); return null; }
    const r = await window.desk.cliOpen({ cwd: t.cwd, resume: t.resume, model: prefs.model, mode: prefs.mode });
    if (!r.ok) { toast(r.error, true); return null; }
    const s = { key: t.key, id: r.v.id, cwd: t.cwd, items: [], busy: false, dead: false, model: prefs.model, mode: prefs.mode, slash: [], sessionId: t.resume };
    sessions.set(t.key, s); byProc.set(s.id, s);
    return s;
  }
  async function send(raw) {
    const text = String(raw || '').trim();
    if (!text) return;
    const t = target();
    if (!t.cwd) { await pickDir(true); return; }
    let s = sessions.get(t.key);
    if (/^\/clear\s*$/.test(text)) { newChat(t.cwd); return; }
    if (s && s.busy) { toast('Aguarde a resposta ou pare com Esc.', true); return; }
    const mm = text.match(/^\/model\s+(\S+)\s*$/);
    if (mm) { prefs.model = mm[1]; savePrefs(); if (s && !s.dead) await window.desk.cliSetModel(s.id, mm[1]); toast(`Modelo: ${mm[1]}`); mount(); return; }
    if (!s || s.dead) { s = await start(t); if (!s) return; }
    s.items.push({ k: 'me', t: text, at: Date.now() });
    s.busy = true;
    paint(true);
    const r = await window.desk.cliSend(s.id, text);
    if (!r.ok) { s.busy = false; s.items.push({ k: 'note', t: r.error }); paint(); }
  }
  async function stop() {
    const s = cur();
    if (s && s.busy) { await window.desk.cliInterrupt(s.id); s.items.push({ k: 'note', t: 'Interrompido.' }); paint(); }
  }
  async function answer(req, how) {
    const s = cur();
    const p = s && s.items.find((x) => x.k === 'perm' && x.req === req);
    if (!s || !p || p.st !== 'ask') return;
    const allow = how !== 'deny';
    p.st = allow ? 'allow' : 'deny';
    paint();
    const r = await window.desk.cliAnswer(s.id, req, { allow, input: p.input, remember: how === 'always', suggestions: p.sugg });
    if (!r.ok) toast(r.error, true);
  }
  function newChat(cwd) {
    state.newChat = { key: 'new:' + (++newN), cwd: cwd || '' };
    paintAll(false);
    setTimeout(() => { const i = $('#cmp'); if (i) i.focus(); }, 30);
  }
  async function pickDir(thenFocus) {
    const d = await window.desk.pickDir();
    if (!d) return;
    if (state.newChat) state.newChat.cwd = d; else state.newChat = { key: 'new:' + (++newN), cwd: d };
    paintAll(false);
    if (thenFocus) setTimeout(() => { const i = $('#cmp'); if (i) i.focus(); }, 30);
  }
  async function setMode(m) {
    if (m === 'bypassPermissions') {
      const ok = await confirmBox('Pular permissões deixa o Claude executar comandos e editar arquivos <b>sem perguntar</b> nesta pasta. Só use em projetos que você confia.', 'Pular permissões');
      if (!ok) { mount(); return; }
    }
    prefs.mode = m; savePrefs();
    const s = cur();
    if (s && !s.dead) { const r = await window.desk.cliSetMode(s.id, m); if (!r.ok) toast(r.error, true); else s.mode = m; }
    mount();
  }
  async function setModel(m) {
    prefs.model = m; savePrefs();
    const s = cur();
    if (s && !s.dead) { const r = await window.desk.cliSetModel(s.id, m); if (!r.ok) toast(r.error, true); }
    mount();
  }
  function confirmBox(html, label) {
    return new Promise((res) => {
      const o = document.createElement('div');
      o.className = 'confirm-ov';
      o.innerHTML = `<div class="confirm" role="dialog" aria-modal="true"><p>${html}</p><div class="cf-b"><button class="btn ghost" data-r="0">Cancelar</button><button class="btn danger" data-r="1">${esc(label)}</button></div></div>`;
      o.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b || e.target === o) { o.remove(); res(!!b && b.dataset.r === '1'); } });
      document.body.appendChild(o);
      o.querySelector('[data-r="0"]').focus();
    });
  }

  // ---------- UI ----------
  function composerHtml() {
    const t = target();
    const s = cur();
    const dirName = t.cwd ? t.cwd.replace(/[\\/]+$/, '').split(/[\\/]/).pop() : 'escolher pasta';
    const mode = (s && s.mode) || prefs.mode;
    const sel = (id, opts, val) => `<select id="${id}" aria-label="${id}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === val ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    return `<div class="composer chat" data-key="${esc(t.key)}">
      <div class="cbar">
        <button class="chip dirchip" data-act="chat-dir" title="${esc(t.cwd || 'Escolha a pasta do projeto')}">${icon('folder', 13)}${esc(dirName)}</button>
        ${sel('c-model', MODELS, prefs.model)}${sel('c-mode', Object.entries(MODE_LABEL), mode)}
        <span class="grow"></span><span class="cinfo" id="cinfo"></span>
      </div>
      <div class="crow">
        <textarea id="cmp" rows="1" placeholder="${t.key ? 'Fale com o Claude Code…  (/ para comandos, Enter envia, Shift+Enter quebra linha)' : 'Escolha uma conversa ou clique em “Nova conversa”'}" aria-label="Mensagem"></textarea>
        <button class="send go" data-act="chat-send" title="Enviar (Enter)" aria-label="Enviar">${icon('send', 17)}</button>
        <button class="send stop" data-act="chat-stop" title="Parar (Esc)" aria-label="Parar" hidden>${icon('x', 17)}</button>
      </div>
      <div id="slashmenu" class="slashmenu" hidden></div>
    </div>`;
  }

  function liveHtml(s) {
    if (!s) return '';
    const bk = { color: '#e9d5ff', icon: 'crown' };
    let h = '', tools = [];
    const flush = () => { if (tools.length) { h += `<div class="tools open">${tools.map((x) => `<span class="tool ${x.state}" title="${esc(x.s)}">${icon(x.state === 'ok' ? 'check' : x.state === 'err' ? 'x' : 'wrench', 12)}<b>${esc(x.name)}</b>${x.s ? `<span>${esc(x.s)}</span>` : ''}</span>`).join('')}</div>`; tools = []; } };
    for (const it of s.items) {
      if (it.k === 'tool') { tools.push(it); continue; }
      flush();
      if (it.k === 'me') h += `<div class="row me"><div class="bubble brief">${copyBtn(it.t)}<div class="who">Você <i>→ Claude Code</i></div><div class="body">${md(it.t)}</div><div class="time">${fmtTime(new Date(it.at).toISOString())}</div></div></div>`;
      else if (it.k === 'agent') h += `<div class="row">${avatar(bk, 'sm')}<div class="bubble agent" style="--c:#e9d5ff"><div class="who">Broker${it.live ? '<i>respondendo…</i>' : ''}</div><div class="body">${md(it.t || '…')}${it.live ? '<span class="caret"></span>' : ''}</div></div></div>`;
      else if (it.k === 'perm') h += permHtml(it);
      else if (it.k === 'result') h += it.ok ? `<div class="note ok">Concluído${it.ms ? ' · ' + dur(it.ms) : ''}${it.cost ? ' · US$ ' + it.cost.toFixed(3) : ''}</div>` : `<div class="note">${esc(it.t || it.sub || 'Terminou com erro')}</div>`;
      else if (it.k === 'note') h += `<div class="note">${esc(it.t)}</div>`;
    }
    flush();
    if (s.busy && !(s.items.length && s.items[s.items.length - 1].live)) h += `<div class="typing"><i></i><i></i><i></i><span>${s.thinking ? 'pensando…' : 'trabalhando…'}</span></div>`;
    return h;
  }
  function permHtml(p) {
    const body = p.st === 'ask' ? `<div class="pc-b"><button class="btn primary" data-perm="allow" data-req="${esc(p.req)}">Permitir</button>${p.sugg.length ? `<button class="btn ghost" data-perm="always" data-req="${esc(p.req)}">Permitir nesta sessão</button>` : ''}<button class="btn ghost" data-perm="deny" data-req="${esc(p.req)}">Negar</button></div>`
      : `<div class="pc-s ${p.st}">${p.st === 'allow' ? 'Permitido' : p.st === 'deny' ? 'Negado' : 'Cancelado'}</div>`;
    return `<div class="permcard ${p.st}"><div class="pc-h">${icon('shield', 16)}<b>Pedido de permissão</b><span>${esc(p.tool)}</span></div>
      <div class="pc-i">${esc(tsum(p.tool, p.input))}</div>${p.desc ? `<div class="pc-d">${esc(clip(p.desc, 220))}</div>` : ''}
      <details><summary>detalhes</summary><pre>${esc(JSON.stringify(p.input, null, 2).slice(0, 2400))}</pre></details>${body}</div>`;
  }

  function paint(forceBottom) {
    const live = $('#live');
    const th = $('.thread');
    if (live) {
      const near = !th || th.scrollHeight - th.scrollTop - th.clientHeight < 120;
      live.innerHTML = liveHtml(cur());
      if (th && (forceBottom || near)) th.scrollTop = th.scrollHeight;
    }
    const s = cur();
    const busy = !!(s && s.busy);
    const go = $('.composer.chat .go'), st = $('.composer.chat .stop');
    if (go) go.hidden = busy;
    if (st) st.hidden = !busy;
    const ci = $('#cinfo');
    if (ci) ci.textContent = busy ? (s.thinking ? 'pensando…' : 'trabalhando…') : (s && !s.dead ? `${(s.model || prefs.model || 'padrão').replace(/^claude-/, '')} · sessão ativa` : (info && info.version ? `Claude Code ${info.version.split(' ')[0]}` : ''));
    if (typeof updateJump === 'function') updateJump();
  }
  function mount() {
    const live = $('#live');
    if (live) live.innerHTML = liveHtml(cur());
    paint();
    if (!info) ensureInfo().then(paint);
  }

  // ---------- menu de comandos "/" ----------
  let menu = { items: [], idx: 0 };
  function slashList(q) {
    const s = cur();
    const names = new Map(cmds.map((c) => [c.name, c]));
    ((s && s.slash) || []).forEach((n) => { if (!names.has(n)) names.set(n, { name: n, desc: '', kind: 'comando' }); });
    const f = norm(q);
    return [...names.values()].filter((c) => !f || norm(c.name).includes(f)).sort((a, b) => (norm(a.name).startsWith(f) ? 0 : 1) - (norm(b.name).startsWith(f) ? 0 : 1) || a.name.localeCompare(b.name)).slice(0, 8);
  }
  function showMenu() {
    const ta = $('#cmp'), el = $('#slashmenu');
    if (!ta || !el) return;
    const m = ta.value.match(/^\/(\S*)$/);
    if (!m) { el.hidden = true; return; }
    menu.items = slashList(m[1]); menu.idx = Math.min(menu.idx, Math.max(0, menu.items.length - 1));
    if (!menu.items.length) { el.hidden = true; return; }
    el.innerHTML = menu.items.map((c, i) => `<button class="sm-i ${i === menu.idx ? 'on' : ''}" data-slash="${esc(c.name)}"><b>/${esc(c.name)}</b><span>${esc(c.desc || c.kind)}</span></button>`).join('');
    el.hidden = false;
  }
  function pickSlash(name) {
    const ta = $('#cmp');
    ta.value = '/' + name + ' '; $('#slashmenu').hidden = true; ta.focus();
  }
  function grow() { const ta = $('#cmp'); if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(180, ta.scrollHeight) + 'px'; } }

  document.addEventListener('input', (e) => { if (e.target.id === 'cmp') { grow(); showMenu(); } });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'c-mode') setMode(e.target.value);
    else if (e.target.id === 'c-model') setModel(e.target.value);
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.id !== 'cmp') return;
    const sm = $('#slashmenu');
    const open = sm && !sm.hidden;
    if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); menu.idx = (menu.idx + (e.key === 'ArrowDown' ? 1 : -1) + menu.items.length) % menu.items.length; showMenu(); return; }
    if (open && (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey))) { e.preventDefault(); const c = menu.items[menu.idx]; if (c) pickSlash(c.name); return; }
    if (e.key === 'Escape') { e.stopPropagation(); if (open) { sm.hidden = true; return; } const s = cur(); if (s && s.busy) stop(); else e.target.blur(); return; }
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      const v = e.target.value; e.target.value = ''; grow(); sm && (sm.hidden = true);
      send(v);
    }
  }, true);
  // Esc para a resposta mesmo com o foco fora da caixa de texto (sem atropelar paleta/diálogos)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.target.id === 'cmp' || state.view !== 'broker') return;
    if (document.querySelector('.confirm-ov, #pal:not([hidden]), #help:not([hidden])')) return;
    const s = cur();
    if (s && s.busy) stop();
  });
  document.addEventListener('click', (e) => {
    const sl = e.target.closest('[data-slash]'); if (sl) { pickSlash(sl.dataset.slash); return; }
    const p = e.target.closest('[data-perm]'); if (p) { answer(p.dataset.req, p.dataset.perm); return; }
    const a = e.target.closest('[data-act]'); if (!a) return;
    if (a.dataset.act === 'chat-send') { const ta = $('#cmp'); const v = ta.value; ta.value = ''; grow(); send(v); }
    else if (a.dataset.act === 'chat-stop') stop();
    else if (a.dataset.act === 'chat-dir') pickDir(true);
    else if (a.dataset.act === 'chat-new') { newChat((curProj() && curProj().path) || target().cwd || (state.broker[0] || {}).cwd || ''); }
  });

  window.desk.onCli(onEvent);
  return { confirmBox, isLiveOnly: () => !state.newChat && !state.broker.find((x) => x.id === state.bSel) && sessions.has(state.bSel), composerHtml, liveHtml, mount, paint, newChat, send, target, cur, _sessions: sessions, ensureInfo };
})();
