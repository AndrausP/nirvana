/* Nirvana Desk — renderer. Somente leitura sobre ~/.claude. */
const $ = (s) => document.querySelector(s);
const norm = (s) => String(s || '').trim().toLowerCase();
// Só mexe no DOM se o HTML mudou: evita piscar, perder foco/seleção/rolagem a cada atualização.
function setHtml(el, html) { if (el.__h === html) return false; el.__h = html; el.innerHTML = html; return true; }

const COLORS = ['#a78bfa', '#2dd4bf', '#f472b6', '#fbbf24', '#60a5fa', '#34d399', '#fb923c', '#c084fc', '#22d3ee', '#f87171'];
const ICON_BY_SLUG = {
  argos: 'eye', clio: 'pen', aurora: 'star', architect: 'compass', edmundo: 'hex', heitor: 'shield',
  jhalim: 'flame', jubileu: 'check', thomas: 'moon', designer: 'star', 'business-analyst': 'compass',
  'backend-dev': 'hex', 'frontend-dev': 'inf', explore: 'compass', plan: 'compass', 'general-purpose': 'bot',
};
const ICON_FALLBACK = ['star', 'moon', 'inf', 'bot', 'hex'];

const state = {
  view: 'agents', projects: [], proj: null, gmemAll: [], newChat: null, broker: [], bSel: null, brain: null, brainPick: null, defs: [], runs: [], agents: [], sessions: [],
  sel: null, selSession: null, q: '', shown: {}, shownChain: 8,
  msgCache: new Map(), memory: [], memSel: null, paths: null, edit: null, gmem: [], gSel: null,
  loaded: false, tok: 0, sig: '', refreshedAt: 0, highlightTools: false, firstPaint: true, busy: false,
};

// ---------- persistência da interface (view, seleção) e "novidade" por agente ----------
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem storage: segue sem lembrar */ } },
};
const UI_KEY = 'nirvana-desk.ui', SEEN_KEY = 'nirvana-desk.seen';
function loadUi() {
  const u = store.get(UI_KEY, {});
  for (const k of ['view', 'sel', 'selSession', 'memSel', 'gSel', 'bSel', 'proj']) if (u[k]) state[k] = u[k];
  if (u.shown && typeof u.shown === 'object') state.shown = u.shown;
  if (u.userPicked) state.userPicked = true;
}
let saveT = null;
function saveUi() {
  clearTimeout(saveT);
  saveT = setTimeout(() => store.set(UI_KEY, { view: state.view, sel: state.sel, selSession: state.selSession, memSel: state.memSel, gSel: state.gSel, bSel: state.bSel, proj: state.proj, shown: state.shown, userPicked: !!state.userPicked }), 120);
}
let seen = store.get(SEEN_KEY, null); // agente -> última atividade já vista
const unread = (a) => !!seen && a.lastAt > (seen[a.key] || 0);
function touchSeen() {
  const a = state.view === 'agents' && state.byKey ? state.byKey.get(state.sel) : null;
  if (a && seen && (seen[a.key] || 0) < a.lastAt) { seen[a.key] = a.lastAt; store.set(SEEN_KEY, seen); }
}
let COPY = [];
const cp = (t) => COPY.push(t) - 1;
const copyBtn = (t) => `<button class="copy" data-copy="${cp(t)}" title="Copiar mensagem" aria-label="Copiar mensagem">${icon('copy', 14)}</button>`;

// ---------- helpers ----------
const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const colorFor = (name) => COLORS[hash(norm(name)) % COLORS.length];
function iconFor(slug, name) {
  const s = norm(slug || name);
  for (const k of Object.keys(ICON_BY_SLUG)) if (s === k || s.startsWith(k)) return ICON_BY_SLUG[k];
  return ICON_FALLBACK[hash(s) % ICON_FALLBACK.length];
}
const avatar = (a, cls = '') => `<div class="avatar ${cls}" style="--c:${a.color}">${icon(a.icon, cls === 'sm' ? 16 : cls === 'lg' ? 22 : 21)}</div>`;
const ts = (iso) => { const t = Date.parse(iso); return Number.isNaN(t) ? 0 : t; };
const pad = (n) => String(n).padStart(2, '0');
const fmtTime = (iso) => { const d = new Date(ts(iso)); return ts(iso) ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : ''; };
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function fmtDay(iso) {
  const t = ts(iso); if (!t) return '';
  const d = new Date(t), n = new Date();
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, n)) return 'Hoje';
  const y = new Date(n); y.setDate(n.getDate() - 1);
  if (same(d, y)) return 'Ontem';
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]}${d.getFullYear() !== n.getFullYear() ? ' ' + d.getFullYear() : ''}`;
}
function rel(t) {
  if (!t) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 172800) return 'ontem';
  return fmtDay(new Date(t).toISOString());
}
function dur(ms) {
  if (!ms || ms < 1000) return '—';
  const m = Math.round(ms / 60000);
  if (m < 1) return `${Math.round(ms / 1000)} s`;
  if (m < 90) return `${m} min`;
  return `${(m / 60).toFixed(1).replace('.', ',')} h`;
}
const num = (n) => new Intl.NumberFormat('pt-BR').format(n);
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const ACTIVE_MS = 120000;

// ---------- projetos: cada pasta é um contexto separado ----------
const normP = (p) => String(p || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
const curProj = () => state.projects.find((p) => p.id === state.proj) || null;
const underP = (p, cwd) => { const a = normP(p && p.path), b = normP(cwd); return !!a && !!b && (b === a || b.startsWith(a + '/')); };
const inProj = (cwd) => { const p = curProj(); return !p || underP(p, cwd); };
const encP = (p) => String(p || '').replace(/[^A-Za-z0-9]/g, '-');
function gmemInProj(m, p) {
  if (!p) return true;
  return m.group === 'Global' || underP(p, m.path) || String(m.path).includes(encP(p.path) + '\\') || String(m.path).includes(encP(p.path) + '/');
}
function projStats(p) {
  const convs = state.broker.filter((b) => underP(p, b.cwd));
  const runs = state.runs.filter((r) => underP(p, r.cwd));
  const agents = new Set(runs.map((r) => norm(r.agentType)));
  const mem = (state.gmemAll || []).filter((m) => m.group !== 'Global' && gmemInProj(m, p));
  return { convs, runs, agents, mem, last: Math.max(0, ...convs.map((b) => b.mtime), ...runs.map((r) => r.mtime || 0)) };
}

// ---------- modelo de dados ----------
function build() {
  const RUNS = state.runs.filter((r) => inProj(r.cwd));
  const map = new Map();
  const agents = [];
  state.defs.forEach((d, i) => {
    const a = {
      key: norm(d.name), name: d.name, slug: d.slug, role: d.role, description: d.description, model: d.model,
      tools: d.tools, personality: d.personality || '', defined: true, color: colorFor(d.name), icon: iconFor(d.slug, d.name), runs: [],
    };
    agents.push(a); map.set(a.key, a); map.set(norm(d.slug), a);
    (d.aliases || []).forEach((al) => map.set(norm(al), a));
  });
  for (const r of RUNS) {
    let a = map.get(norm(r.agentType));
    if (!a) {
      a = {
        key: norm(r.agentType), name: r.agentType, slug: norm(r.agentType), role: 'Agente embutido', description: '',
        model: '', tools: [], defined: false, color: colorFor(r.agentType), icon: iconFor(r.agentType, r.agentType), runs: [],
      };
      agents.push(a); map.set(a.key, a);
    }
    a.runs.push(r);
    r._agent = a;
  }
  for (const a of agents) {
    a.runs.sort((x, y) => ts(y.start) - ts(x.start));
    const last = a.runs[0];
    a.lastAt = last ? Math.max(ts(last.end), ts(last.start), last.mtime || 0) : 0;
    a.active = !!last && Date.now() - a.lastAt < ACTIVE_MS;
    if (!a.model && last && last.model) a.model = last.model;
  }
  agents.sort((x, y) => (y.lastAt - x.lastAt) || x.name.localeCompare(y.name));
  if (seen === null && state.loaded) { seen = {}; agents.forEach((a) => { seen[a.key] = a.lastAt; }); store.set(SEEN_KEY, seen); }
  state.agents = agents;
  state.byKey = new Map([...map, ...agents.map((a) => [a.key, a])]); // inclui apelidos (nome antigo, slug)

  const sess = new Map();
  for (const r of RUNS) {
    const k = r.sessionId;
    if (!sess.has(k)) sess.set(k, { id: k, project: r.project, runs: [], agents: new Map() });
    const s = sess.get(k);
    s.runs.push(r);
    if (r._agent) s.agents.set(r._agent.key, r._agent);
  }
  state.sessions = [...sess.values()].map((s) => {
    s.runs.sort((x, y) => ts(x.start) - ts(y.start));
    s.start = ts(s.runs[0].start);
    s.lastAt = Math.max(...s.runs.map((r) => Math.max(ts(r.end), ts(r.start), r.mtime || 0)));
    s.active = Date.now() - s.lastAt < ACTIVE_MS;
    return s;
  }).sort((a, b) => b.lastAt - a.lastAt);

  if (!state.sel || !state.byKey.has(state.sel) || !state.userPicked) state.sel = (agents.find((a) => a.runs.length) || agents[0] || {}).key || null;
  if (!state.selSession || !state.sessions.find((s) => s.id === state.selSession)) state.selSession = (state.sessions[0] || {}).id || null;
}
const curAgent = () => state.byKey && state.byKey.get(state.sel);
const curSession = () => state.sessions.find((s) => s.id === state.selSession);

// ---------- memória geral: helpers ----------
const gIcon = (g) => (g === 'Global' ? 'shield' : g.startsWith('Projeto') ? 'folder' : 'db');
const gColor = (g) => (g === 'Global' ? '#a78bfa' : g.startsWith('Projeto') ? '#fbbf24' : '#2dd4bf');
const kb = (b) => (b / 1024).toFixed(1).replace('.', ',') + ' KB';
function toast(msg, bad) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.className = 'toast show' + (bad ? ' bad' : '');
  el.textContent = msg;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 4200);
}
const field = (id, label, hint, inner) => `<div class="field"><label for="${id}">${label}</label>${hint ? `<div class="hint">${hint}</div>` : ''}${inner}</div>`;

// ---------- rail ----------
function renderRail() {
  const anyActive = state.agents.some((a) => a.active);
  const nav = (v, ic, tip, extra = '') => `<button class="nav ${state.view === v ? 'on' : ''}" data-view="${v}" data-tip="${tip}" aria-label="${tip}">${icon(ic, 22)}${extra}</button>`;
  setHtml($('#rail'), `<div class="logo">${LOGO}</div>` +
    nav('broker', 'crown', 'Broker') + nav('agents', 'users', 'Agentes') + nav('chain', 'chat', 'Cadeia', anyActive ? '<i class="dot"></i>' : '') +
    nav('brain', 'net', 'Organograma') + nav('memory', 'db', 'Memória') + nav('general', 'layers', 'Memória geral') + nav('projects', 'folder', 'Projetos') + '<div class="grow"></div>' + nav('settings', 'gear', 'Configurações'));
}

// ---------- lista (coluna 2) ----------
function agentItem(a) {
  const last = a.runs[0];
  const sub = last ? (last.description || a.role || 'Sem descrição') : (a.role || (a.defined ? 'Sem execuções ainda' : ''));
  const fresh = unread(a) && state.sel !== a.key;
  return `<button class="item ${state.sel === a.key ? 'on' : ''} ${fresh ? 'has-new' : ''}" data-agent="${esc(a.key)}" style="${a.runs.length ? '' : 'opacity:.62'}">
    ${avatar(a)}
    <div class="meta"><div class="nm">${esc(a.name)}${a.active ? '<i class="live" title="Ativa"></i>' : ''}${fresh ? '<i class="unread" title="Nova atividade"></i>' : ''}<span class="t">${a.lastAt ? rel(a.lastAt) : ''}</span></div>
    <div class="sub">${esc(sub)}</div></div>
  </button>`;
}
function renderList() {
  const el = $('#list');
  const keep = el.querySelector('.items');
  const top = keep ? keep.scrollTop : 0;
  const hadFocus = document.activeElement && document.activeElement.id === 'q';
  let title = 'Agentes', body = '', ph = 'Buscar agente…';
  const q = norm(state.q);
  if (state.view === 'projects') {
    title = 'Projetos'; ph = 'Buscar projeto…';
    const list = state.projects.filter((p) => !q || norm(p.name + ' ' + p.path).includes(q));
    body = `<button class="btn primary newchat" data-act="proj-add">${icon('folder', 15)}Adicionar pasta</button>` +
      `<button class="item ${!state.proj ? 'on' : ''}" data-proj="">${avatar({ color: '#8d8aa6', icon: 'layers' })}<div class="meta"><div class="nm">Todos os projetos</div><div class="sub">sem filtro · contexto misturado</div></div></button>` +
      list.map((p) => { const st = projStats(p); return `<button class="item ${state.proj === p.id ? 'on' : ''}" data-proj="${esc(p.id)}" style="${p.exists === false ? 'opacity:.55' : ''}">${avatar({ color: colorFor(p.name), icon: 'folder' })}
        <div class="meta"><div class="nm"><span class="tt">${esc(p.name)}</span>${st.last ? `<span class="t">${rel(st.last)}</span>` : ''}</div>
        <div class="sub">${st.convs.length} conversas · ${st.runs.length} execuções</div></div></button>`; }).join('');
  } else if (state.view === 'broker') {
    title = 'Broker'; ph = 'Buscar conversa…';
    const list = state.broker.filter((b) => inProj(b.cwd) && (!q || norm(b.project + ' ' + b.title).includes(q)));
    body = `<button class="btn primary newchat" data-act="chat-new">${icon('send', 15)}Nova conversa</button><button class="btn ghost newchat" data-act="chat-noproj-new" title="Conversa limpa na Área de Trabalho, sem projeto">${icon('layers', 15)}Sem projeto</button>` + ((state.newChat || Chat.isLiveOnly()) ? `<button class="item on" data-act="chat-new">${avatar({ color: '#2dd4bf', icon: 'crown' })}<div class="meta"><div class="nm"><span class="tt">Nova conversa</span></div><div class="sub">${esc(Chat.target().cwd || 'escolha a pasta')}</div></div></button>` : '') + list.map((b) => `<button class="item ${state.bSel === b.id && !state.newChat && !Chat.isLiveOnly() ? 'on' : ''}" data-broker="${esc(b.id)}">${avatar({ color: '#e9d5ff', icon: 'crown' })}
      <div class="meta"><div class="nm"><span class="tt">${esc(b.project || 'sessão')}</span>${Date.now() - b.mtime < ACTIVE_MS ? '<i class="live"></i>' : ''}<span class="t">${rel(b.mtime)}</span></div>
      <div class="sub">${esc(b.title)}</div></div></button>`).join('') || '<div class="empty-list">Nenhuma conversa com o broker encontrada.</div>';
  } else if (state.view === 'brain') {
    title = 'Organograma'; ph = 'Buscar agente…';
    const bn = brainBySlug();
    const list = state.agents.filter((a) => a.defined && (!q || norm(a.name + ' ' + a.role).includes(q)));
    body = list.map((a) => `<button class="item ${state.brainKey === a.key ? 'on' : ''}" data-brain="${esc(a.key)}">${avatar(a)}
      <div class="meta"><div class="nm">${esc(a.name)}${a.active ? '<i class="live"></i>' : ''}</div>
      <div class="sub">${(bn[a.slug] || []).length} neurônios · ${esc(a.role || '')}</div></div></button>`).join('') +
      `<div class="group-label">Memória compartilhada</div><div class="empty-list">${state.gmem.length} arquivos na nuvem inferior. Clique num ponto para ler.</div>`;
  } else if (state.view === 'agents') {
    const list = state.agents.filter((a) => !q || norm(a.name + ' ' + a.role + ' ' + a.description).includes(q));
    const own = list.filter((a) => a.defined), ext = list.filter((a) => !a.defined);
    body = own.map(agentItem).join('');
    if (ext.length) body += '<div class="group-label">Embutidos</div>' + ext.map(agentItem).join('');
    if (!list.length) body = `<div class="empty-list">${state.agents.length ? 'Nenhum agente encontrado.' : 'Nenhum agente em <span class="path">~/.claude/agents</span>'}</div>`;
  } else if (state.view === 'chain') {
    title = 'Cadeia'; ph = 'Buscar sessão…';
    const list = state.sessions.filter((s) => !q || norm(s.project + ' ' + s.runs.map((r) => r.description + r.agentType).join(' ')).includes(q));
    body = list.map((s) => {
      const ags = [...s.agents.values()].slice(0, 3);
      const first = s.runs[s.runs.length - 1];
      return `<button class="item ${state.selSession === s.id ? 'on' : ''}" data-session="${esc(s.id)}">
        <div class="avatar-stack">${ags.map((a) => avatar(a, 'sm')).join('')}</div>
        <div class="meta"><div class="nm">${esc(s.project || 'sessão')}${s.active ? '<i class="live"></i>' : ''}<span class="t">${rel(s.lastAt)}</span></div>
        <div class="sub">${s.runs.length} execuç${s.runs.length === 1 ? 'ão' : 'ões'} · ${esc(first.description || first.agentType)}</div></div></button>`;
    }).join('') || '<div class="empty-list">Nenhuma sessão com agentes ainda.</div>';
  } else if (state.view === 'memory') {
    title = 'Memória'; ph = 'Buscar memória…';
    const list = state.memory.filter((m) => !q || norm(m.name).includes(q));
    body = list.map((m) => {
      const a = state.agents.find((x) => x.slug === m.slug) || { color: colorFor(m.name), icon: 'db' };
      return `<button class="item ${state.memSel === m.slug ? 'on' : ''}" data-mem="${esc(m.slug)}">${avatar(a)}
        <div class="meta"><div class="nm">${esc(m.name)}<span class="t">${rel(m.mtime)}</span></div>
        <div class="sub">${m.records} registros · ${(m.bytes / 1024).toFixed(1).replace('.', ',')} KB</div></div></button>`;
    }).join('') || `<div class="empty-list">Sem arquivos em <span class="path">~/.claude/agents-memory</span></div>`;
  } else if (state.view === 'general') {
    title = 'Memória geral'; ph = 'Buscar memória…';
    const list = state.gmem.filter((m) => !q || norm(m.title + ' ' + m.sub + ' ' + m.group).includes(q));
    const order = (g) => (g === 'Global' ? 0 : g.startsWith('Projeto') ? 1 : 2);
    const groups = [...new Set(list.map((m) => m.group))].sort((a, b) => order(a) - order(b) || a.localeCompare(b));
    body = groups.map((g) => `<div class="group-label">${esc(g)}</div>` + list.filter((m) => m.group === g).map((m) =>
      `<button class="item ${state.gSel === m.path ? 'on' : ''}" data-gmem="${esc(m.path)}">${avatar({ color: gColor(m.group), icon: gIcon(m.group) })}
      <div class="meta"><div class="nm"><span class="tt">${esc(m.title)}</span><span class="t">${rel(m.mtime)}</span></div>
      <div class="sub">${esc(m.sub)} · ${kb(m.bytes)}</div></div></button>`).join('')).join('') || '<div class="empty-list">Nenhuma memória encontrada.</div>';
  } else {
    title = 'Configurações';
    body = '<div class="empty-list">Fonte de dados, atualização e sobre.</div>';
  }
  const pj = curProj();
  const listHtml = `<h2>${title}</h2>` + (pj && state.view !== 'projects' ? `<div class="projbar" title="${esc(pj.path)}">${icon('folder', 14)}<span>${esc(pj.name)}</span><button data-proj="" aria-label="Ver todos os projetos" title="Ver todos">${icon('x', 13)}</button></div>` : '') +
    (state.view === 'settings' ? '' : `<label class="search">${icon('search', 18)}<input id="q" placeholder="${ph}" value="${esc(state.q)}" autocomplete="off"></label>`) +
    `<div class="items">${body}</div>`;
  setHtml(el, listHtml);
  const items = el.querySelector('.items');
  if (items) items.scrollTop = top;
  if (hadFocus) { const i = $('#q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}

// ---------- mensagens ----------
async function loadRun(run) {
  const key = run.id + ':' + (run.mtime || 0);
  if (!state.msgCache.has(key)) state.msgCache.set(key, window.desk.messages(run.id));
  return state.msgCache.get(key);
}
function bodyHtml(text) {
  const long = text.length > 900 || text.split('\n').length > 16;
  return `<div class="body ${long ? 'clamp' : ''}">${md(text)}</div>${long ? '<button class="expand" data-expand>Ver mais</button>' : ''}`;
}
function toolsHtml(items) {
  const chips = items.map((t, i) => `<span class="tool ${i >= 4 ? 'x' : ''}" title="${esc(t.s)}">${icon('wrench', 12)}<b>${esc(t.name)}</b>${t.s ? `<span>${esc(t.s)}</span>` : ''}</span>`).join('');
  const more = items.length > 4 ? `<button class="tool more-t" data-tools>+${items.length - 4} ferramentas</button>` : '';
  return `<div class="tools">${chips}${more}</div>`;
}
function runHtml(run, data) {
  const a = run._agent || { name: run.agentType, color: '#a78bfa', icon: 'bot' };
  let html = `<div class="runsep"><span class="d">${fmtDay(run.start)} · ${fmtTime(run.start)}</span>
    <div class="ds"><b>${esc(a.name)}</b>${run.project ? ' · ' + esc(run.project) : ''}${run.description ? ' · ' + esc(clip(run.description, 90)) : ''}</div></div>`;
  for (const m of data.msgs) {
    if (m.k === 'brief' || m.k === 'user') {
      html += `<div class="row me"><div class="bubble brief">${copyBtn(m.t)}<div class="who">Broker <i>→ ${esc(a.name)}</i></div>${bodyHtml(m.t)}<div class="time">${fmtTime(m.ts)}</div></div></div>`;
    } else if (m.k === 'agent') {
      html += `<div class="row">${avatar(a, 'sm')}<div class="bubble agent" style="--c:${a.color}">${copyBtn(m.t)}<div class="who">${esc(a.name)}${data.model ? `<i>${esc(data.model.replace(/^claude-/, ''))}</i>` : ''}</div>${bodyHtml(m.t)}<div class="time">${fmtTime(m.ts)}</div></div></div>`;
    } else if (m.k === 'tools') {
      html += toolsHtml(m.items);
    } else if (m.k === 'note') {
      html += `<div class="note">${esc(m.t)}</div>`;
    }
  }
  return html;
}

// ---------- centro ----------
function headHtml(a, extra = '') {
  return `<div class="head">${avatar(a, 'lg')}<h1>${esc(a.name)}</h1><span class="sep"></span>
    <span class="pill ${a.active ? '' : 'off'}">${a.active ? 'Ativa' : 'Em espera'}</span>
    ${a.model ? `<span class="chip">${esc(a.model.replace(/^claude-/, ''))}</span>` : ''}${extra}
    <span class="spacer"></span><button class="icon-btn" data-act="export" title="Exportar conversa em Markdown (Ctrl+Shift+E)" aria-label="Exportar conversa">${icon('download', 18)}</button>${a.defined ? `<button class="icon-btn" data-act="edit-agent" title="Editar nome, personalidade e comportamento" aria-label="Editar agente">${icon('pen', 18)}</button>` : ''}<button class="icon-btn" data-act="refresh" title="Atualizar" aria-label="Atualizar">${icon('refresh', 18)}</button></div>`;
}
const composerHtml = (name) => `<div class="composer"><input disabled placeholder="Enviar instrução para ${esc(name)}…" aria-label="Enviar instrução"><span class="ro">Modo leitura · ao vivo</span><span class="send" title="Envio disponível numa próxima versão">${icon('send', 17)}</span></div>`;

function heroHtml(title, sub, withChips = true) {
  return `<div class="hero"><canvas id="wave"></canvas><h2>${esc(title)}</h2><p>${esc(sub)}</p>
  ${withChips ? `<div class="chips"><button class="cta" data-act="refresh">${icon('refresh', 19)}Atualizar</button>
  <button class="cta" data-act="memory">${icon('db', 19)}Memória</button><button class="cta" data-act="tools">${icon('zap', 19)}Ferramentas</button></div>` : ''}</div>`;
}

async function renderCenter(keep) {
  const el = $('#center');
  const token = ++state.tok;
  COPY = [];
  const prev = el.querySelector('.thread');
  const atBottom = !prev || prev.scrollHeight - prev.scrollTop - prev.clientHeight < 80;
  const prevTop = prev ? prev.scrollTop : 0;
  Wave.stop();
  if (state.view !== 'brain') Brain.stop();

  if (state.view === 'broker') {
    await renderBroker(el, token);
  } else if (state.view === 'brain') {
    await renderBrain(el, token);
  } else if (state.view === 'projects') {
    renderProjects(el);
  } else if (state.view === 'agents') {
    const a = curAgent();
    if (!a) { el.innerHTML = heroHtml('Coordene sua IA', 'Nenhum agente encontrado em ~/.claude/agents.', false) + composerHtml('o time'); Wave.start($('#wave')); return; }
    if (state.edit && state.edit.kind === 'agent') { await renderAgentEditor(a, token); return; }
    if (!a.runs.length) {
      el.innerHTML = headHtml(a) + heroHtml(a.name, !state.loaded ? 'Lendo transcripts do Claude Code…' : a.defined ? 'Nenhuma execução registrada ainda. Quando a cadeia acionar este agente, a conversa aparece aqui ao vivo.' : 'Sem execuções.') + composerHtml(a.name);
      Wave.start($('#wave')); return;
    }
    const n = state.shown[a.key] || 4;
    const runs = a.runs.slice(0, n).reverse();
    if (!keep) el.innerHTML = headHtml(a, `<span class="chip">${a.runs.length} execuç${a.runs.length === 1 ? 'ão' : 'ões'}</span>`) + '<div class="thread"><div class="loading">Carregando conversa…</div></div>' + composerHtml(a.name);
    const datas = await Promise.all(runs.map(loadRun));
    if (token !== state.tok) return;
    state.tokens = datas.reduce((s, d) => s + (d.tokens || 0), 0);
    state.lastThread = runs.map((r, i) => ({ run: r, data: datas[i] }));
    let html = a.runs.length > n ? '<button class="more" data-act="older">Carregar execuções anteriores</button>' : '';
    runs.forEach((r, i) => { html += runHtml(r, datas[i]); });
    el.innerHTML = headHtml(a, `<span class="chip">${a.runs.length} execuç${a.runs.length === 1 ? 'ão' : 'ões'}</span>`) + `<div class="thread">${html}</div>` + composerHtml(a.name);
  } else if (state.view === 'chain') {
    const s = curSession();
    if (!s) { el.innerHTML = heroHtml('Cadeia', 'Nenhuma sessão com agentes ainda.', false) + composerHtml('a cadeia'); Wave.start($('#wave')); return; }
    const runs = s.runs.slice(-state.shownChain);
    const datas = await Promise.all(runs.map(loadRun));
    if (token !== state.tok) return;
    state.tokens = datas.reduce((t, d) => t + (d.tokens || 0), 0);
    state.lastThread = runs.map((r, i) => ({ run: r, data: datas[i] }));
    let html = s.runs.length > runs.length ? '<button class="more" data-act="older">Carregar execuções anteriores</button>' : '';
    runs.forEach((r, i) => { html += runHtml(r, datas[i]); });
    const head = `<div class="head"><div class="avatar lg" style="--c:#a78bfa">${icon('branch', 22)}</div><h1>${esc(s.project || 'Sessão')}</h1><span class="sep"></span>
      <span class="pill ${s.active ? '' : 'off'}">${s.active ? 'Ao vivo' : 'Encerrada'}</span><span class="chip">${s.runs.length} execuç${s.runs.length === 1 ? 'ão' : 'ões'}</span>
      <span class="spacer"></span><button class="icon-btn" data-act="refresh" title="Atualizar" aria-label="Atualizar">${icon('refresh', 18)}</button></div>`;
    el.innerHTML = head + `<div class="thread">${html}</div>` + composerHtml('a cadeia');
  } else if (state.view === 'memory') {
    const m = state.memory.find((x) => x.slug === state.memSel);
    if (!m) { el.innerHTML = heroHtml('Memória', 'Selecione um agente para ler o que ele guardou.', false) + composerHtml('a memória'); Wave.start($('#wave')); return; }
    const data = await window.desk.memoryRead(m.slug);
    if (token !== state.tok) return;
    const a = state.agents.find((x) => x.slug === m.slug) || { name: m.name, color: colorFor(m.name), icon: 'db', active: false, model: '' };
    el.innerHTML = `<div class="head">${avatar(a, 'lg')}<h1>${esc(m.name)}</h1><span class="sep"></span><span class="chip">${m.records} registros</span><span class="spacer"></span>
      <button class="icon-btn" data-act="reveal" data-path="${esc((data && data.file) || '')}" title="Mostrar arquivo" aria-label="Mostrar arquivo">${icon('folder', 18)}</button></div>
      <div class="mem"><div class="body">${data ? md(data.text) : '<p>Arquivo indisponível.</p>'}</div></div>`;
  } else if (state.view === 'general') {
    const m = state.gmem.find((x) => x.path === state.gSel);
    if (!m) { el.innerHTML = heroHtml('Memória geral', 'Nenhum arquivo de memória encontrado.', false) + composerHtml('a memória'); Wave.start($('#wave')); return; }
    let text = null;
    try { text = await window.desk.fileRead(m.path); } catch { text = null; }
    if (token !== state.tok) return;
    const ga = { color: gColor(m.group), icon: gIcon(m.group) };
    if (state.edit && state.edit.kind === 'file' && state.edit.path === m.path) {
      el.innerHTML = `<div class="head">${avatar(ga, 'lg')}<h1>Editar ${esc(m.title)}</h1><span class="sep"></span><span class="chip">${esc(m.group)}</span><span class="spacer"></span>
        <button class="btn ghost" data-act="cancel-edit">Cancelar</button><button class="btn primary" data-act="save-file">${icon('save', 16)}Salvar</button></div>
        <div class="page editor"><textarea id="f-file" class="mono tall" spellcheck="false">${esc(text || '')}</textarea>
        <div class="notice">${icon('shield', 16)}<span>Cada salvamento cria um backup em <span class="path">${esc((state.paths || {}).backups || '')}</span>.</span></div></div>`;
      $('#f-file').focus();
    } else {
      el.innerHTML = `<div class="head">${avatar(ga, 'lg')}<h1>${esc(m.title)}</h1><span class="sep"></span><span class="chip">${esc(m.group)}</span><span class="spacer"></span>
        <button class="icon-btn" data-act="edit-file" title="Editar" aria-label="Editar">${icon('pen', 18)}</button>
        <button class="icon-btn" data-act="reveal" data-path="${esc(m.path)}" title="Mostrar arquivo" aria-label="Mostrar arquivo">${icon('folder', 18)}</button></div>
        <div class="mem"><div class="body">${text !== null ? md(text) : '<p>Arquivo indisponível.</p>'}</div></div>`;
    }
  } else {
    const p = state.paths || {};
    el.innerHTML = `<div class="head"><h1>Configurações</h1><span class="spacer"></span></div><div class="page">
      <div class="card"><h3>Fonte de dados</h3><p>O Nirvana Desk só <b>lê</b> arquivos do Claude Code. Nada é escrito nem enviado.</p><br>
      <p>Agentes: <span class="path">${esc(p.agents || '')}</span></p><br><p>Memória: <span class="path">${esc(p.memory || '')}</span></p><br>
      <p>Transcripts: <span class="path">${esc((p.claude || '') + '\\projects')}</span></p></div>
      <div class="card"><h3>Atualização</h3><p>Automática a cada 4 s. Última leitura: ${state.refreshedAt ? fmtTime(new Date(state.refreshedAt).toISOString()) : '—'}. ${num(state.runs.length)} execuções em ${num(state.sessions.length)} sessões.</p><br>
      <button class="cta" data-act="refresh">${icon('refresh', 18)}Atualizar agora</button></div>
      <div class="card"><h3>Como os agentes aparecem</h3><p>Cada arquivo em <span class="path">agents/*.md</span> vira um contato. As conversas vêm dos subagentes registrados nos transcripts: o briefing do broker (roxo) e as respostas do agente (cinza), com as ferramentas usadas entre elas.</p></div>
      <div class="card"><h3>Sobre</h3><p>Nirvana Desk v${esc(p.version || '')}</p></div></div>`;
  }
  const th = el.querySelector('.thread');
  if (th) { if (state.firstPaint || atBottom || !keep) th.scrollTop = th.scrollHeight; else th.scrollTop = prevTop; }
  state.firstPaint = false;
}

// ---------- broker: o chat com o mestre ----------
// Só a conversa principal. Cada agente tem o próprio chat, que só existe se o broker o chamou:
// ele recebe o briefing + a memória dele, nunca esta conversa inteira (economia de tokens).
async function loadBroker(b) {
  const key = b.id + ':' + b.mtime;
  if (!state.bCache) state.bCache = new Map();
  if (!state.bCache.has(key)) state.bCache.set(key, window.desk.brokerMessages(b.id));
  return state.bCache.get(key);
}
function callHtml(m) {
  const a = state.byKey && state.byKey.get(norm(m.agent));
  const name = a ? a.name : m.agent;
  const col = a ? a.color : '#a78bfa';
  const tag = a ? `data-agent="${esc(a.key)}"` : '';
  return `<button class="callcard" ${tag} style="--c:${col}" ${a ? '' : 'disabled'}>
    <span class="cc-ic">${icon('branch', 15)}</span>
    <span class="cc-t">Chamou <b>${esc(name)}</b>${m.desc ? ' · ' + esc(clip(m.desc, 80)) : ''}</span>
    <span class="cc-s">briefing de ${num(m.chars)} caracteres — só isso + a memória dele</span></button>`;
}
async function renderBroker(el, token) {
  // Atualização incremental: cabeçalho e histórico só mudam se o conteúdo mudou; o compositor (texto, cursor,
  // anexos) nunca é recriado. Assim cada comando do Claude não "recarrega" a tela nem tira o cursor.
  const present = (headH, histH) => {
    const keepC = el.querySelector('.composer.chat');
    const th = el.querySelector('.thread');
    if (keepC && keepC.dataset.key === Chat.target().key && th && th.querySelector('#hist') && th.querySelector('#live') && el.querySelector('.head')) {
      const hd = el.querySelector('.head');
      if (hd.__h !== headH) { hd.outerHTML = headH; el.querySelector('.head').__h = headH; }
      const hi = th.querySelector('#hist');
      if (hi.__h !== histH) { hi.innerHTML = histH; hi.__h = histH; }
    } else {
      el.innerHTML = headH + `<div class="thread"><div id="hist">${histH}</div><div id="live"></div></div>` + Chat.composerHtml();
      el.querySelector('.head').__h = headH; el.querySelector('#hist').__h = histH;
    }
    Chat.mount();
  };
  const bk = { color: '#e9d5ff', icon: 'crown' };
  if (state.newChat || Chat.isLiveOnly()) {
    present(`<div class="head">${avatar(bk, 'lg')}<h1>Nova conversa</h1><span class="sep"></span><span class="chip">${esc(Chat.target().cwd || 'sem pasta')}</span><span class="spacer"></span></div>`,
      '<div class="note">Escolha a pasta do projeto (botão abaixo) e escreva. É o Claude Code de verdade: mesmos comandos, skills, hooks e memória.</div>');
    return;
  }
  const b = state.broker.find((x) => x.id === state.bSel);
  if (!b) { el.innerHTML = heroHtml('Broker', 'Nenhuma conversa ainda. Clique em “Nova conversa” para falar com o Claude Code.', false) + brokerComposer(); Wave.start($('#wave')); return; }
  const data = await loadBroker(b);
  if (token !== state.tok) return;
  state.brokerStats = data.stats;
  renderCtx();
  let html = data.total > data.msgs.length ? `<div class="note">Mostrando as últimas ${data.msgs.length} de ${data.total} mensagens.</div>` : '';
  html += `<div class="runsep"><span class="d">${fmtDay(b.start)} · ${fmtTime(b.start)}</span><div class="ds"><b>Conversa com o broker</b> · ${esc(b.project)}</div></div>`;
  for (const m of data.msgs) {
    if (m.k === 'master') html += `<div class="row me"><div class="bubble brief">${copyBtn(m.t)}<div class="who">Você <i>→ Broker</i></div>${bodyHtml(m.t)}<div class="time">${fmtTime(m.ts)}</div></div></div>`;
    else if (m.k === 'broker') html += `<div class="row">${avatar(bk, 'sm')}<div class="bubble agent" style="--c:#e9d5ff">${copyBtn(m.t)}<div class="who">Broker${m.model ? `<i>${esc(m.model.replace(/^claude-/, ''))}</i>` : ''}</div>${bodyHtml(m.t)}<div class="time">${fmtTime(m.ts)}</div></div></div>`;
    else if (m.k === 'call') html += callHtml(m);
    else if (m.k === 'tools') html += toolsHtml(m.items);
    else if (m.k === 'note') html += `<div class="note">${esc(m.t)}</div>`;
  }
  state.lastThread = null;
  const live = Date.now() - b.mtime < ACTIVE_MS;
  present(`<div class="head">${avatar(bk, 'lg')}<h1>Broker</h1><span class="sep"></span><span class="pill ${live ? '' : 'off'}">${live ? 'Ao vivo' : 'Encerrada'}</span>
    <span class="chip">${esc(b.project)}</span><span class="chip">${num(data.total)} mensagens</span><span class="spacer"></span>
    <button class="icon-btn" data-act="refresh" title="Atualizar" aria-label="Atualizar">${icon('refresh', 18)}</button></div>`, html);
}
const brokerComposer = () => Chat.composerHtml();
const brokerComposerOld = () => `<div class="composer"><input disabled placeholder="Fale com o broker no terminal do Claude Code — aqui você acompanha ao vivo" aria-label="Mensagem"><span class="ro">Modo leitura · ao vivo</span><span class="send" title="Envio disponível numa próxima versão">${icon('send', 17)}</span></div>`;
function brokerCtx() {
  if (state.newChat) return kv('folder', 'Pasta', esc(state.newChat.cwd || 'não escolhida')) + '<h4>Claude Code</h4><p class="desc">Conversa nova, iniciada pelo app. Usa o mesmo CLI instalado: comandos <b>/</b>, skills, hooks, plugins e memória.</p>';
  const b = state.broker.find((x) => x.id === state.bSel);
  if (!b) return '';
  const st = state.brokerStats;
  let h = kv('folder', 'Projeto', esc(b.project)) + kv('clock', 'Última msg', rel(b.mtime));
  if (st) {
    h += kv('branch', 'Agentes chamados', num(st.calls));
    h += kv('chat', 'Conversa', `${num(st.chars)} car.`);
    if (st.calls) h += kv('zap', 'Briefings enviados', `${num(st.briefChars)} car.`);
    const ag = Object.entries(st.agents);
    if (ag.length) h += `<h4>Quem foi chamado</h4><div class="mini">${ag.map(([k, n]) => `<div class="r"><span>${esc((state.byKey.get(norm(k)) || { name: k }).name)}</span><b>${n}×</b></div>`).join('')}</div>`;
  }
  h += '<h4>Isolamento</h4><p class="desc">Os agentes não leem este chat. Cada um recebe só o briefing do broker e a própria memória — por isso o custo de tokens não cresce com a conversa. Eles só têm chat aqui se o broker os chamou (clique no cartão para abrir).</p>';
  return h;
}

// ---------- organograma + neurônios ----------
const brainBySlug = () => Object.fromEntries(((state.brain || {}).list || []).map((x) => [x.slug, x.neurons]));
async function renderBrain(el, token) {
  const sig = state.sig + '|' + state.agents.map((a) => a.key + a.active).join(',');
  if (el.querySelector('#brain') && state.brainSig === sig) return; // mantém câmera/zoom
  let list;
  try { list = await window.desk.brainData(curProj() ? curProj().path : ''); } catch { list = []; }
  if (token !== state.tok) return;
  state.brain = { list };
  state.brainSig = sig;
  const bn = brainBySlug();
  const agents = state.agents.filter((a) => a.defined).map((a) => ({ key: a.key, slug: a.slug, name: a.name, role: a.role, color: a.color, active: a.active, neurons: bn[a.slug] || [] }));
  const total = agents.reduce((s, a) => s + a.neurons.length, 0);
  el.innerHTML = `<div class="head"><div class="avatar lg" style="--c:#2dd4bf">${icon('net', 22)}</div><h1>Organograma</h1><span class="sep"></span>
    <span class="chip">${agents.length} agentes</span><span class="chip">${num(total)} neurônios próprios</span><span class="chip">${num(state.gmem.length)} compartilhados</span><span class="spacer"></span>
    <button class="btn ghost" data-act="brain-fit">Ajustar</button><button class="icon-btn" data-act="refresh" title="Atualizar" aria-label="Atualizar">${icon('refresh', 18)}</button></div>
    <div class="brainwrap"><canvas id="brain"></canvas><div id="btip"></div>
    <div class="blegend"><span><i style="background:#a78bfa"></i>agente</span><span><i class="sm" style="background:#a78bfa"></i>memória do agente</span><span><i class="sm" style="background:#2dd4bf"></i>memória compartilhada</span><span class="hint2">arraste · scroll = zoom · clique = detalhes</span></div></div>`;
  Brain.start($('#brain'), { agents, shared: state.gmem, sharedColor: gColor }, {
    onPick: (o) => { state.brainPick = o; if (o && o.type === 'agent') state.brainKey = o.key; renderList(); renderCtx(); },
  });
}
function brainCtx() {
  const p = state.brainPick;
  if (!p) return '<p class="desc">Os agentes aparecem na hierarquia da cadeia. Cada ponto ao redor é um item da memória dele; a nuvem de baixo é a memória compartilhada que a Writer escreve e todos consultam. Pontos mais claros foram atualizados há menos tempo.</p>';
  if (p.type === 'neuron') {
    return kv('users', 'Agente', esc(p.own.name)) + (p.m.sec ? kv('layers', 'Seção', esc(p.m.sec)) : '') + kv('clock', 'Atualizada', rel(p.m.mtime)) +
      `<h4>Memória</h4><p class="desc">${esc(clip(p.m.text, 900))}</p>`;
  }
  if (p.type === 'shared') {
    return kv('layers', 'Grupo', esc(p.m.group)) + kv('file', 'Arquivo', esc(p.m.sub)) + kv('db', 'Tamanho', kb(p.m.bytes)) + kv('clock', 'Atualizada', rel(p.m.mtime)) +
      `<h4>Abrir</h4><button class="cta" data-gmem="${esc(p.m.path)}" data-act="brain-open-g">${icon('file', 17)}Ler na Memória geral</button>`;
  }
  if (p.type === 'broker') return '<h4>Broker</h4><p class="desc">Ponto de entrada: você fala com ele, ele abre a cadeia e fecha com a conclusão. Os agentes não veem esta conversa.</p>';
  const a = state.byKey.get(p.key);
  if (!a) return '';
  const n = (brainBySlug()[a.slug] || []).length;
  return kv('users', 'Papel', esc(a.role || '—')) + kv('db', 'Neurônios', num(n)) + kv('zap', 'Modelo', esc((a.model || '—').replace(/^claude-/, ''))) + kv('branch', 'Execuções', num(a.runs.length)) +
    (a.personality ? `<h4>Personalidade</h4><p class="desc">${esc(clip(a.personality, 260))}</p>` : '') +
    `<h4>Abrir</h4><button class="cta" data-agent="${esc(a.key)}">${icon('chat', 17)}Ver conversa</button>`;
}

// ---------- aba de projetos ----------
function setProject(id) {
  if (state.edit) { if (state.edit.dirty) { toast('Salve ou cancele a edição antes de trocar de projeto.', true); return; } state.edit = null; }
  state.proj = id || null;
  state.newChat = null; state.userPicked = false; state.brain = null; state.brainSig = '';
  state.gmem = state.gmemAll.filter((m) => gmemInProj(m, curProj()));
  const first = state.broker.find((b) => inProj(b.cwd));
  state.bSel = first ? first.id : null;
  build();
  paintAll(false);
}
async function addProject() {
  const r = await window.desk.projAdd();
  if (r.canceled) return;
  if (!r.ok) { toast(r.error || 'Não consegui adicionar a pasta.', true); return; }
  state.projects = await window.desk.projList();
  toast(r.existed ? 'Essa pasta já é um projeto.' : 'Projeto adicionado.');
  setProject(r.id);
}
async function removeProject() {
  const p = curProj();
  if (!p) return;
  const ok = await Chat.confirmBox(`Remover <b>${esc(p.name)}</b> da lista? A pasta e as conversas <b>não</b> são apagadas.`, 'Remover');
  if (!ok) return;
  await window.desk.projRemove(p.id);
  state.projects = await window.desk.projList();
  setProject(null);
}
function renderProjects(el) {
  const p = curProj();
  if (!p) {
    el.innerHTML = heroHtml('Projetos', state.projects.length ? 'Escolha um projeto na lista para ver só o contexto dele: conversas, agentes e memória não se misturam.' : 'Adicione as pastas dos seus projetos. Cada um fica separado: conversas, execuções dos agentes e memória só aparecem dentro do projeto escolhido.', false) +
      `<div class="composer" style="justify-content:center;height:auto;padding:14px"><button class="btn primary" data-act="proj-add">${icon('folder', 16)}Adicionar pasta</button></div>`;
    Wave.start($('#wave')); return;
  }
  const st = projStats(p);
  const ag = [...st.agents].map((k) => (state.byKey.get(k) || { name: k, color: colorFor(k) }));
  const recent = st.convs.slice(0, 6).map((b) => `<div class="r"><span>${esc(clip(b.title, 60))}</span><b>${rel(b.mtime)}</b></div>`).join('') || '<div class="r"><span>Nenhuma conversa ainda</span></div>';
  el.innerHTML = `<div class="head">${avatar({ color: colorFor(p.name), icon: 'folder' }, 'lg')}<h1>${esc(p.name)}</h1><span class="sep"></span><span class="pill">Filtro ativo</span><span class="spacer"></span>
    <button class="btn ghost" data-act="proj-del">Remover</button></div>
    <div class="page"><div class="card"><h3>Pasta</h3><p><span class="path">${esc(p.path)}</span>${p.exists === false ? ' <b style="color:#f87171">(não encontrada)</b>' : ''}</p>
    <br><p>Enquanto este projeto está ativo, <b>Broker, Agentes, Cadeia, Organograma e Memória</b> mostram só o que pertence a esta pasta. Para ver tudo de novo, clique em “Todos os projetos”.</p></div>
    <div class="card"><h3>Neste projeto</h3><div class="mini">
      <div class="r"><span>Conversas com o broker</span><b>${st.convs.length}</b></div><div class="r"><span>Execuções de agentes</span><b>${st.runs.length}</b></div>
      <div class="r"><span>Agentes usados</span><b>${st.agents.size}</b></div><div class="r"><span>Arquivos de memória do projeto</span><b>${st.mem.length}</b></div></div>
      ${ag.length ? `<br><div class="tagcloud">${ag.map((a) => `<span class="tag" style="color:${a.color}">${esc(a.name)}</span>`).join('')}</div>` : ''}</div>
    <div class="card"><h3>Conversas recentes</h3><div class="mini">${recent}</div><br>
      <button class="cta" data-act="proj-chat">${icon('send', 17)}Nova conversa aqui</button> <button class="cta" data-act="proj-open">${icon('crown', 17)}Abrir conversas</button></div></div>`;
}
function projectsCtx() {
  const p = curProj();
  if (!p) return `<div class="mini">${state.projects.map((q) => `<div class="r"><span>${esc(q.name)}</span><b>${projStats(q).convs.length}</b></div>`).join('')}</div><h4>Sobre</h4><p class="desc">Registre as pastas dos seus projetos. Ao escolher um, todas as telas passam a mostrar só o contexto dele.</p>`;
  const st = projStats(p);
  return kv('folder', 'Pasta', esc(p.path)) + kv('chat', 'Conversas', num(st.convs.length)) + kv('branch', 'Execuções', num(st.runs.length)) + kv('users', 'Agentes', num(st.agents.size)) + kv('layers', 'Memória', num(st.mem.length));
}

// ---------- contexto (direita) ----------
const kv = (ic, label, val) => `<div class="kv">${icon(ic, 21)}<div class="t"><b>${label}:</b> <span>${val}</span></div></div>`;
function renderCtx() {
  const el = $('#ctx');
  let html = '<h3>Contexto</h3>';
  if (state.view === 'broker') { html += brokerCtx(); }
  else if (state.view === 'brain') { html += brainCtx(); }
  else if (state.view === 'projects') { html += projectsCtx(); }
  else if (state.view === 'agents') {
    const a = curAgent();
    if (!a) { el.innerHTML = html; return; }
    const mem = state.memory.find((m) => m.slug === a.slug);
    const last = a.runs[0];
    const today = a.runs.filter((r) => new Date(ts(r.start)).toDateString() === new Date().toDateString()).length;
    html += kv('db', 'Memória', mem ? `${num(mem.records)} registros` : 'sem arquivo');
    html += kv('zap', 'Ferramentas', a.defined ? (a.tools.length ? `${a.tools.length} ativas` : 'todas') : 'padrão');
    html += kv('clock', 'Última ação', last ? esc(clip(last.description || last.agentType, 46)) : '—');
    html += kv('branch', 'Execuções', `${num(a.runs.length)}${today ? ` · ${today} hoje` : ''}`);
    if (state.tokens) html += kv('chat', 'Tokens (visíveis)', num(state.tokens));
    if (last && last.project) html += kv('folder', 'Projeto recente', esc(last.project));
    if (a.tools.length) html += `<h4>Ferramentas</h4><div class="tagcloud">${a.tools.map((t) => `<span class="tag ${state.highlightTools ? 'hl' : ''}">${esc(t)}</span>`).join('')}</div>`;
    if (a.personality) html += `<h4>Personalidade</h4><p class="desc">${esc(clip(a.personality, 240))}</p>`;
    if (a.description) html += `<h4>Sobre</h4><p class="desc">${esc(clip(a.description, 320))}</p>`;
  } else if (state.view === 'chain') {
    const s = curSession();
    if (s) {
      const end = Math.max(...s.runs.map((r) => Math.max(ts(r.end), ts(r.start))));
      html += kv('folder', 'Projeto', esc(s.project || '—'));
      html += kv('users', 'Agentes', `${s.agents.size} envolvidos`);
      html += kv('branch', 'Execuções', num(s.runs.length));
      html += kv('clock', 'Duração', dur(end - s.start));
      if (state.tokens) html += kv('chat', 'Tokens (visíveis)', num(state.tokens));
      html += `<h4>Participantes</h4><div class="tagcloud">${[...s.agents.values()].map((a) => `<span class="tag" style="color:${a.color}">${esc(a.name)}</span>`).join('')}</div>`;
      html += `<h4>Ordem</h4><div class="mini">${s.runs.map((r) => `<div class="r"><span>${esc(r._agent ? r._agent.name : r.agentType)}</span><b>${fmtTime(r.start)}</b></div>`).join('')}</div>`;
    }
  } else if (state.view === 'memory') {
    const m = state.memory.find((x) => x.slug === state.memSel);
    if (m) {
      html += kv('db', 'Registros', num(m.records));
      html += kv('file', 'Tamanho', `${(m.bytes / 1024).toFixed(1).replace('.', ',')} KB`);
      html += kv('clock', 'Atualizada', `${fmtDay(new Date(m.mtime).toISOString())} ${fmtTime(new Date(m.mtime).toISOString())}`);
    }
    html += '<h4>Sobre</h4><p class="desc">Memória que o agente grava durante a sessão em ~/.claude/agents-memory. O broker injeta um resumo dela no início de cada sessão.</p>';
  } else if (state.view === 'general') {
    const m = state.gmem.find((x) => x.path === state.gSel);
    if (m) {
      html += kv('layers', 'Grupo', esc(m.group));
      html += kv('file', 'Arquivo', esc(m.sub));
      html += kv('db', 'Tamanho', kb(m.bytes));
      html += kv('clock', 'Atualizada', `${fmtDay(new Date(m.mtime).toISOString())} ${fmtTime(new Date(m.mtime).toISOString())}`);
    }
    const counts = {};
    state.gmem.forEach((x) => { counts[x.group] = (counts[x.group] || 0) + 1; });
    html += `<h4>Visão geral</h4><div class="mini">${Object.entries(counts).map(([g, n]) => `<div class="r"><span>${esc(g)}</span><b>${n}</b></div>`).join('')}</div>`;
    html += '<h4>Sobre</h4><p class="desc">Tudo o que os agentes e o Claude lembram: instruções globais, memória automática por projeto e o conhecimento compartilhado em docs/ dos projetos.</p>';
  } else {
    html += kv('users', 'Agentes', num(state.agents.length));
    html += kv('branch', 'Execuções', num(state.runs.length));
    html += kv('chat', 'Sessões', num(state.sessions.length));
  }
  setHtml(el, html);
}

// ---------- ciclo ----------
function paintAll(keep) { touchSeen(); saveUi(); renderRail(); renderList(); renderCenter(keep); renderCtx(); }

async function refresh(manual) {
  if (state.busy) return;
  state.busy = true;
  try {
    const data = await window.desk.refresh();
    state.memory = await window.desk.memoryList();
    state.projects = await window.desk.projList();
    if (state.proj && !state.projects.find((p) => p.id === state.proj)) state.proj = null;
    state.gmemAll = await window.desk.gmemList();
    state.gmem = state.gmemAll.filter((m) => gmemInProj(m, curProj()));
    state.broker = await window.desk.brokerList();
    state.defs = data.defs; state.runs = data.runs; state.refreshedAt = Date.now(); state.loaded = true;
    const sig = [state.runs.length, Math.max(0, ...state.runs.map((r) => r.mtime || 0)), state.defs.length, state.memory.map((m) => m.mtime).join(','), state.gmem.map((m) => m.mtime).join(','), state.broker.length, Math.max(0, ...state.broker.map((b) => b.mtime))].join('|');
    const changed = sig !== state.sig;
    state.sig = sig;
    build();
    if (typeof notifyChanges === 'function') notifyChanges();
    if (!state.memSel || !state.memory.find((m) => m.slug === state.memSel)) state.memSel = (state.memory[0] || {}).slug || null;
    if ((!state.bSel || !state.broker.find((b) => b.id === state.bSel)) && !Chat._sessions.has(state.bSel)) state.bSel = (state.broker.find((b) => inProj(b.cwd)) || {}).id || null;
    if (!state.gSel || !state.gmem.find((m) => m.path === state.gSel)) state.gSel = (state.gmem[0] || {}).path || null;
    if (state.edit && !manual) { renderRail(); renderList(); renderCtx(); }
    else if (changed || manual || state.first === undefined) { state.first = true; paintAll(!manual && !state.justSwitched); }
    else { touchSeen(); renderRail(); renderList(); renderCtx(); }
  } catch (e) {
    console.error(e);
  } finally { state.busy = false; state.justSwitched = false; }
}

// ---------- eventos ----------
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-view],[data-agent],[data-session],[data-mem],[data-gmem],[data-broker],[data-brain],[data-proj],[data-act],[data-expand],[data-tools],[data-copy]');
  if (!t) return;
  if (t.dataset.copy != null) { copyText(COPY[+t.dataset.copy]); return; }
  const nav = t.dataset.view || t.dataset.agent || t.dataset.session || t.dataset.mem || t.dataset.gmem || t.dataset.broker || t.dataset.brain;
  if (nav && state.edit) {
    if (state.edit.dirty) { toast('Salve ou cancele a edição antes de sair.', true); return; }
    state.edit = null;
  }
  if (t.dataset.proj !== undefined) { setProject(t.dataset.proj || null); return; }
  if (t.dataset.gmem) { state.gSel = t.dataset.gmem; if (t.dataset.act === 'brain-open-g') state.view = 'general'; paintAll(false); return; }
  if (t.dataset.broker) { state.bSel = t.dataset.broker; state.newChat = null; state.brokerStats = null; paintAll(false); return; }
  if (t.dataset.brain) { state.brainKey = t.dataset.brain; Brain.focusAgent(t.dataset.brain); const a = state.byKey.get(t.dataset.brain); state.brainPick = a ? { type: 'agent', key: a.key, name: a.name } : null; renderList(); renderCtx(); return; }
  if (t.dataset.view) { state.view = t.dataset.view; state.q = ''; state.justSwitched = true; state.highlightTools = false; paintAll(false); return; }
  if (t.dataset.agent) { if (state.view !== 'agents') { state.view = 'agents'; state.q = ''; } state.sel = t.dataset.agent; state.userPicked = true; state.tokens = 0; state.highlightTools = false; paintAll(false); return; }
  if (t.dataset.session) { state.selSession = t.dataset.session; state.shownChain = 8; state.tokens = 0; paintAll(false); return; }
  if (t.dataset.mem) { state.memSel = t.dataset.mem; paintAll(false); return; }
  if (t.hasAttribute('data-expand')) {
    const body = t.previousElementSibling; const open = body.classList.toggle('clamp');
    t.textContent = open ? 'Ver mais' : 'Ver menos'; return;
  }
  if (t.hasAttribute('data-tools')) { const box = t.closest('.tools'); box.classList.add('open'); t.remove(); return; }
  const act = t.dataset.act;
  if (act === 'refresh') {
    const b = t.closest('.icon-btn'); if (b) { b.classList.remove('spin'); void b.offsetWidth; b.classList.add('spin'); }
    refresh(true);
  } else if (act === 'older') {
    if (state.view === 'agents') { const a = curAgent(); state.shown[a.key] = (state.shown[a.key] || 4) + 6; } else state.shownChain += 6;
    renderCenter(true);
  } else if (act === 'memory') {
    const a = curAgent(); if (a && state.memory.find((m) => m.slug === a.slug)) state.memSel = a.slug;
    state.view = 'memory'; state.q = ''; paintAll(false);
  } else if (act === 'proj-add') { addProject();
  } else if (act === 'proj-chat') { const p = curProj(); if (p) { state.view = 'broker'; state.q = ''; Chat.newChat(p.path); }
  } else if (act === 'proj-open') { state.view = 'broker'; state.q = ''; state.bSel = (state.broker.find((b) => inProj(b.cwd)) || {}).id || state.bSel; paintAll(false);
  } else if (act === 'proj-del') { removeProject();
  } else if (act === 'brain-fit') { Brain.fit();
  } else if (act === 'export') {
    exportMarkdown();
  } else if (act === 'edit-agent') {
    state.edit = { kind: 'agent', dirty: false }; renderCenter(false);
  } else if (act === 'edit-file') {
    state.edit = { kind: 'file', path: state.gSel, dirty: false }; renderCenter(false);
  } else if (act === 'cancel-edit') {
    state.edit = null; renderCenter(false);
  } else if (act === 'save-agent') { saveAgentEdit();
  } else if (act === 'save-file') { saveFileEdit();
  } else if (act === 'tools') {
    state.highlightTools = true; renderCtx();
  } else if (act === 'reveal') { if (t.dataset.path) window.desk.reveal(t.dataset.path); }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'q') { state.q = e.target.value; renderList(); }
  else if (state.edit && e.target.closest('.editor')) state.edit.dirty = true;
});
document.addEventListener('keydown', (e) => {
  if (!state.edit) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (state.edit.kind === 'agent') saveAgentEdit(); else saveFileEdit(); }
  else if (e.key === 'Escape' && !state.edit.dirty) { state.edit = null; renderCenter(false); }
});

// ---------- editores ----------
async function renderAgentEditor(a, token) {
  const el = $('#center');
  let raw;
  try { raw = await window.desk.agentRaw(a.slug); } catch { toast('Não consegui ler o arquivo do agente.', true); state.edit = null; renderCenter(false); return; }
  if (token !== state.tok) return;
  el.innerHTML = `<div class="head">${avatar(a, 'lg')}<h1>Editar agente</h1><span class="sep"></span><span class="chip">${esc(raw.slug)}.md</span><span class="spacer"></span>
    <button class="btn ghost" data-act="cancel-edit">Cancelar</button><button class="btn primary" data-act="save-agent">${icon('save', 16)}Salvar</button></div>
    <div class="page editor">
      ${field('f-name', 'Nome', 'Como o agente é chamado e aparece no Claude Code.', `<input id="f-name" value="${esc(raw.name)}" maxlength="80" autocomplete="off">`)}
      ${field('f-pers', 'Personalidade', 'Tom e jeito de ser: direto, didático, cético, bem-humorado… Entra no topo das instruções do agente.', `<textarea id="f-pers" rows="4" placeholder="Ex.: Direto e objetivo. Questiona premissas fracas. Explica o porquê antes do como.">${esc(raw.personality)}</textarea>`)}
      ${field('f-desc', 'Quando usar (descrição)', 'O Claude Code lê isto para decidir quando acionar o agente.', `<textarea id="f-desc" rows="3">${esc(raw.description)}</textarea>`)}
      ${field('f-beh', 'Comportamento', 'Instruções completas do agente: regras, fluxo, formato de resposta.', `<textarea id="f-beh" rows="16" class="mono" spellcheck="false">${esc(raw.behavior)}</textarea>`)}
      <div class="notice">${icon('shield', 16)}<span>Cada salvamento cria um backup em <span class="path">${esc((state.paths || {}).backups || '')}</span>. As mudanças valem para novas sessões do Claude Code (reinicie a sessão para aplicar). Se você mudar o nome, o histórico antigo continua ligado a este agente.</span></div>
    </div>`;
  $('#f-name').focus();
}
const cleanErr = (e) => String((e && e.message) || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
async function saveAgentEdit() {
  const a = curAgent();
  if (!a || !state.edit || state.edit.kind !== 'agent') return;
  const payload = { name: $('#f-name').value.trim(), personality: $('#f-pers').value, description: $('#f-desc').value, behavior: $('#f-beh').value };
  if (!payload.name) { toast('Dê um nome ao agente.', true); return; }
  const btn = document.querySelector('[data-act=save-agent]');
  if (btn) btn.disabled = true;
  try {
    await window.desk.agentSave(a.slug, payload);
    state.edit = null; state.sel = norm(payload.name); state.userPicked = true;
    toast('Agente salvo. Backup criado.');
    await refresh(true);
  } catch (err) { toast('Falhou ao salvar: ' + cleanErr(err), true); if (btn) btn.disabled = false; }
}
async function saveFileEdit() {
  if (!state.edit || state.edit.kind !== 'file') return;
  const ta = $('#f-file');
  if (!ta) return;
  const btn = document.querySelector('[data-act=save-file]');
  if (btn) btn.disabled = true;
  try {
    await window.desk.fileWrite(state.edit.path, ta.value);
    state.edit = null;
    toast('Memória salva. Backup criado.');
    await refresh(true);
  } catch (err) { toast('Falhou ao salvar: ' + cleanErr(err), true); if (btn) btn.disabled = false; }
}

(async function init() {
  state.paths = await window.desk.paths();
  loadUi();
  state.defs = await window.desk.defs();
  build();
  paintAll(false);
  await refresh(true);
  setInterval(() => refresh(false), 4000);
})();
