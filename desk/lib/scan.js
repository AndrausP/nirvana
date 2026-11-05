// Lê os dados reais do Claude Code: definições de agentes, memória e transcripts.
// Somente leitura. Nada é escrito em ~/.claude.
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');

// NIRVANA_DESK_CLAUDE permite apontar para uma pasta de teste (nunca toca o ~/.claude real nos testes).
const CLAUDE = process.env.NIRVANA_DESK_CLAUDE || path.join(os.homedir(), '.claude');
const AGENTS_DIR = path.join(CLAUDE, 'agents');
const MEMORY_DIR = path.join(CLAUDE, 'agents-memory');
const PROJECTS_DIR = path.join(CLAUDE, 'projects');

const norm = (s) => String(s || '').trim().toLowerCase();

// ---------- agentes (definições) ----------
function parseFrontmatter(txt) {
  const m = txt.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: txt };
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const k = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (k) fm[k[1]] = unq(k[2]);
  }
  return { fm, body: m[2] };
}

async function loadAgentDefs() {
  const out = [];
  let files = [];
  try { files = await fsp.readdir(AGENTS_DIR); } catch { return out; }
  for (const f of files) {
    if (!f.endsWith('.md')) continue;
    try {
      const txt = await fsp.readFile(path.join(AGENTS_DIR, f), 'utf8');
      const { fm, body } = parseFrontmatter(txt);
      const h1 = (body.match(/^#\s+(.+)$/m) || [])[1] || '';
      // "# Argos — Reader (mapeamento read-only)" -> "Reader (mapeamento read-only)"
      const role = h1.includes('—') ? h1.split('—').slice(1).join('—').trim()
        : h1.includes(' - ') ? h1.split(' - ').slice(1).join(' - ').trim() : '';
      const slug = f.replace(/\.md$/, '');
      out.push({
        slug,
        name: fm.name || slug,
        role,
        description: fm.description || '',
        model: fm.model || '',
        tools: (fm.tools || '').split(',').map((t) => t.trim()).filter(Boolean),
        personality: splitPersonality(body).personality,
        defined: true,
      });
    } catch { /* ignora arquivo ilegível */ }
  }
  return out;
}

// ---------- memória ----------
async function memoryInfo(def) {
  const cands = [def.slug, def.name, norm(def.name).replace(/\s+/g, '')];
  for (const c of cands) {
    const p = path.join(MEMORY_DIR, `${c}.md`);
    try {
      const txt = await fsp.readFile(p, 'utf8');
      const st = await fsp.stat(p);
      const records = (txt.match(/^(#{2,3}\s|[-*]\s|\d+\.\s)/gm) || []).length;
      return { file: p, records, bytes: st.size, mtime: st.mtimeMs, text: txt };
    } catch { /* tenta próximo */ }
  }
  return null;
}

async function memoryList(defs) {
  const rows = [];
  for (const d of defs) {
    const m = await memoryInfo(d);
    if (m) rows.push({ name: d.name, slug: d.slug, records: m.records, bytes: m.bytes, mtime: m.mtime });
  }
  return rows;
}

async function memoryRead(def) {
  const m = await memoryInfo(def);
  return m ? { text: m.text, records: m.records, mtime: m.mtime, file: m.file } : null;
}

// ---------- runs (execuções de agentes) ----------
const cache = new Map(); // file -> { sig, data }
let CACHE_FILE = null;
let dirty = false;
// Cache em disco (fora de ~/.claude) para o primeiro scan não reler centenas de MB a cada abertura.
function useCacheFile(p) {
  CACHE_FILE = p;
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const [k, v] of Object.entries(j)) cache.set(k, v);
  } catch { /* sem cache ainda */ }
}
function saveCache() {
  if (!CACHE_FILE || !dirty) return;
  const o = {};
  for (const [k, v] of cache) if (v && v.calls !== undefined) o[k] = v;
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(o)); dirty = false; } catch { /* ignora */ }
}

function blocksText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n');
}

function toolSummary(name, input) {
  input = input || {};
  const pick = input.file_path || input.path || input.pattern || input.command ||
    input.description || input.query || input.url || input.prompt || '';
  let s = String(pick).replace(/\s+/g, ' ').trim();
  if (s.length > 110) s = s.slice(0, 107) + '…';
  return s;
}

const isNoise = (t) => !t || /^\s*<(system-reminder|local-command|command-name|task-notification)/.test(t);

// Converte linhas de um transcript de subagente em mensagens de chat.
function messagesFromSidechain(lines) {
  const msgs = [];
  let tokens = 0, model = '';
  let first = true;
  for (const l of lines) {
    if (l.type === 'user' && l.message) {
      const t = blocksText(l.message.content).trim();
      if (!t || l.isMeta) continue;
      if (/^\[Request interrupted/.test(t)) { msgs.push({ k: 'note', t: 'Execução interrompida', ts: l.timestamp }); continue; }
      if (isNoise(t)) continue;
      msgs.push({ k: first ? 'brief' : 'user', t, ts: l.timestamp });
      first = false;
    } else if (l.type === 'assistant' && l.message) {
      const m = l.message;
      if (m.model) model = m.model;
      if (m.usage) tokens += (m.usage.input_tokens || 0) + (m.usage.output_tokens || 0);
      const c = Array.isArray(m.content) ? m.content : [];
      for (const b of c) {
        if (b.type === 'text' && b.text && b.text.trim()) msgs.push({ k: 'agent', t: b.text.trim(), ts: l.timestamp });
        else if (b.type === 'tool_use') {
          const last = msgs[msgs.length - 1];
          const item = { name: b.name, s: toolSummary(b.name, b.input) };
          if (last && last.k === 'tools') last.items.push(item);
          else msgs.push({ k: 'tools', items: [item], ts: l.timestamp });
        }
      }
    }
  }
  return { msgs, tokens, model };
}

function readJsonl(file) {
  const out = [];
  const txt = fs.readFileSync(file, 'utf8');
  for (const line of txt.split('\n')) {
    if (!line) continue;
    try { out.push(JSON.parse(line)); } catch { /* linha truncada */ }
  }
  return out;
}

function toolResultText(block) {
  const c = block.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map((x) => (x && x.text) || '').join('\n');
  return '';
}

// Procura chamadas ao Agent/Task em transcripts de sessão (histórico mais antigo, sem sidechain).
function runsFromSession(file, projectDir) {
  const lines = readJsonl(file);
  const calls = new Map();
  let cwd = '';
  const sessionId = path.basename(file, '.jsonl');
  for (const l of lines) {
    if (l.cwd && !cwd) cwd = l.cwd;
    if (l.type === 'assistant' && l.message && Array.isArray(l.message.content)) {
      for (const b of l.message.content) {
        if (b.type === 'tool_use' && b.input && b.input.subagent_type && (b.name === 'Agent' || b.name === 'Task')) {
          calls.set(b.id, {
            toolUseId: b.id, agentType: b.input.subagent_type, description: b.input.description || '',
            prompt: b.input.prompt || '', start: l.timestamp, end: null, result: '', model: l.message.model || '',
          });
        }
      }
    } else if (l.type === 'user' && l.message && Array.isArray(l.message.content)) {
      for (const b of l.message.content) {
        if (b.type === 'tool_result' && calls.has(b.tool_use_id)) {
          const c = calls.get(b.tool_use_id);
          c.end = l.timestamp;
          c.result = toolResultText(b).trim();
        }
      }
    }
  }
  return [...calls.values()].map((c) => ({ ...c, sessionId, cwd, projectDir, source: 'session' }));
}

async function sigOf(file) {
  const st = await fsp.stat(file);
  return `${st.mtimeMs}:${st.size}`;
}

async function listSidechains(sessionDir) {
  const dir = path.join(sessionDir, 'subagents');
  let files = [];
  try { files = await fsp.readdir(dir); } catch { return []; }
  return files.filter((f) => f.endsWith('.meta.json')).map((f) => ({
    meta: path.join(dir, f), jsonl: path.join(dir, f.replace('.meta.json', '.jsonl')),
  }));
}

function projectLabel(cwd, dirName) {
  if (cwd) return path.basename(cwd.replace(/[\\/]+$/, '')) || cwd;
  return dirName.replace(/^[A-Za-z]--Users-[^-]+-?/, '').replace(/^-+/, '') || dirName;
}

let lastIndex = { runs: [], at: 0 };

// Indexa todos os runs (sem as mensagens completas — essas vêm sob demanda).
async function indexRuns() {
  const runs = [];
  let projects = [];
  try { projects = await fsp.readdir(PROJECTS_DIR); } catch { return runs; }
  for (const pd of projects) {
    const pdir = path.join(PROJECTS_DIR, pd);
    let entries = [];
    try { entries = await fsp.readdir(pdir, { withFileTypes: true }); } catch { continue; }
    const sidechainToolIds = new Set();
    // 1) transcripts completos de subagentes
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const sdir = path.join(pdir, e.name);
      for (const sc of await listSidechains(sdir)) {
        try {
          const meta = JSON.parse(await fsp.readFile(sc.meta, 'utf8'));
          const st = await fsp.stat(sc.jsonl);
          const key = sc.jsonl;
          const sig = `${st.mtimeMs}:${st.size}`;
          let data = cache.get(key);
          if (!data || data.sig !== sig) {
            const lines = readJsonl(sc.jsonl);
            const first = lines.find((x) => x.timestamp) || {};
            const lastL = [...lines].reverse().find((x) => x.timestamp) || {};
            data = { sig, first: first.timestamp, last: lastL.timestamp, cwd: first.cwd || '', n: lines.length };
            cache.set(key, data);
          }
          if (meta.toolUseId) sidechainToolIds.add(meta.toolUseId);
          runs.push({
            id: path.basename(sc.jsonl, '.jsonl'), agentType: meta.agentType || 'desconhecido',
            description: meta.description || '', toolUseId: meta.toolUseId || '',
            sessionId: e.name, project: projectLabel(data.cwd, pd), cwd: data.cwd,
            start: data.first, end: data.last, mtime: st.mtimeMs, source: 'sidechain', file: sc.jsonl,
            model: meta.pickedEffortModel || '',
          });
        } catch { /* meta/jsonl ausente */ }
      }
    }
    // 2) chamadas Agent dentro das sessões (só arquivos que citam subagent_type)
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith('.jsonl')) continue;
      const file = path.join(pdir, e.name);
      let st;
      try { st = await fsp.stat(file); } catch { continue; }
      const sig = `${st.mtimeMs}:${st.size}`;
      let data = cache.get(file);
      if (!data || data.sig !== sig) {
        let has = false;
        try {
          const buf = await fsp.readFile(file);
          has = buf.includes('"subagent_type"');
          data = { sig, has, calls: has ? runsFromSession(file, pd) : [] };
        } catch { data = { sig, has: false, calls: [] }; }
        cache.set(file, data);
        dirty = true;
      }
      for (const c of data.calls) {
        if (sidechainToolIds.has(c.toolUseId)) continue; // já coberto pelo transcript completo
        runs.push({
          id: c.toolUseId, agentType: c.agentType, description: c.description, toolUseId: c.toolUseId,
          sessionId: c.sessionId, project: projectLabel(c.cwd, pd), cwd: c.cwd,
          start: c.start, end: c.end, mtime: st.mtimeMs, source: 'session', file,
          model: c.model,
        });
      }
    }
  }
  runs.sort((a, b) => Date.parse(b.start || 0) - Date.parse(a.start || 0));
  lastIndex = { runs, at: Date.now() };
  saveCache();
  return runs;
}

// Mensagens completas de um run.
async function runMessages(run) {
  if (run.source === 'sidechain') {
    const { msgs, tokens, model } = messagesFromSidechain(readJsonl(run.file));
    return { msgs, tokens, model: model || run.model };
  }
  const c = (cache.get(run.file) || { calls: [] }).calls.find((x) => x.toolUseId === run.toolUseId);
  const msgs = [];
  if (c) {
    if (c.prompt) msgs.push({ k: 'brief', t: c.prompt, ts: c.start });
    if (c.result) msgs.push({ k: 'agent', t: c.result, ts: c.end });
    else msgs.push({ k: 'note', t: 'Sem retorno registrado (execução em andamento ou interrompida)', ts: c.start });
  }
  return { msgs, tokens: 0, model: (c && c.model) || run.model };
}

// ---------- edição de agentes (com backup) ----------
const PS = '<!-- nirvana-desk:personality -->';
const PE = '<!-- /nirvana-desk:personality -->';
function unq(v) {
  v = String(v).trim();
  if (/^".*"$/.test(v)) { try { return JSON.parse(v); } catch { /* cai no strip */ } }
  return v.replace(/^["']|["']$/g, '');
}
function splitRaw(txt) {
  const m = txt.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  return m ? { fm: m[1].split(/\r?\n/), body: m[2] } : { fm: [], body: txt };
}
function splitPersonality(body) {
  const a = body.indexOf(PS), b = body.indexOf(PE);
  if (a >= 0 && b > a) {
    return {
      personality: body.slice(a + PS.length, b).replace(/^\s*##\s*Personalidade\s*/i, '').trim(),
      behavior: (body.slice(0, a) + body.slice(b + PE.length)).replace(/^\s+/, ''),
    };
  }
  return { personality: '', behavior: body };
}
function yamlVal(v) {
  v = String(v).replace(/\s*\n\s*/g, ' ').trim();
  return /[:#"'{}\[\]&*!|>%@`,]|^[-?]|^\s|\s$/.test(v) ? JSON.stringify(v) : v;
}
const stampNow = () => new Date().toISOString().replace(/[:.]/g, '-');

async function agentRaw(slug) {
  if (!/^[\w.-]+$/.test(slug)) throw new Error('slug inválido');
  const file = path.join(AGENTS_DIR, slug + '.md');
  const { fm, body } = splitRaw(await fsp.readFile(file, 'utf8'));
  const get = (k) => { const l = fm.find((x) => x.startsWith(k + ':')); return l ? unq(l.slice(k.length + 1)) : ''; };
  const sp = splitPersonality(body);
  return { file, slug, name: get('name') || slug, description: get('description'), personality: sp.personality, behavior: sp.behavior.trimEnd() };
}

async function saveAgent(slug, p, backupDir) {
  if (!/^[\w.-]+$/.test(slug)) throw new Error('slug inválido');
  const name = String(p.name || '').trim();
  if (!name) throw new Error('O nome não pode ficar vazio');
  const file = path.join(AGENTS_DIR, slug + '.md');
  const orig = await fsp.readFile(file, 'utf8');
  await fsp.mkdir(backupDir, { recursive: true });
  const backup = path.join(backupDir, `${slug}.${stampNow()}.md`);
  await fsp.writeFile(backup, orig);
  const { fm } = splitRaw(orig);
  const setLine = (k, v) => {
    const i = fm.findIndex((x) => x.startsWith(k + ':'));
    const line = `${k}: ${yamlVal(v)}`;
    if (i >= 0) { fm[i] = line; while (fm[i + 1] !== undefined && /^\s/.test(fm[i + 1])) fm.splice(i + 1, 1); }
    else fm.push(line);
  };
  setLine('name', name);
  if (p.description != null) setLine('description', p.description);
  const pers = String(p.personality || '').trim();
  let body = pers ? `${PS}\n## Personalidade\n${pers}\n${PE}\n\n` : '';
  body += String(p.behavior || '').trim() + '\n';
  const tmp = file + '.tmp';
  await fsp.writeFile(tmp, `---\n${fm.join('\n')}\n---\n\n${body}`, 'utf8');
  await fsp.rename(tmp, file);
  return { backup };
}

// ---------- memória geral ----------
const exists = async (p) => { try { await fsp.access(p); return true; } catch { return false; } };
async function listMd(dir) {
  try { return (await fsp.readdir(dir)).filter((f) => f.endsWith('.md')).map((f) => path.join(dir, f)); } catch { return []; }
}
async function item(p, group, title, sub) {
  const st = await fsp.stat(p);
  return { path: p, group, title, sub, mtime: st.mtimeMs, bytes: st.size };
}
async function generalMemory(cwds) {
  const items = [];
  const seen = new Set();
  const add = async (p, group, title, sub) => { if (seen.has(p)) return; seen.add(p); try { items.push(await item(p, group, title, sub)); } catch { /* sumiu */ } };
  const gp = path.join(CLAUDE, 'CLAUDE.md');
  if (await exists(gp)) await add(gp, 'Global', 'Instruções globais', 'CLAUDE.md');
  for (const cwd of cwds) {
    const label = projectLabel(cwd, '');
    const cands = [path.join(cwd, 'CLAUDE.md'), path.join(cwd, 'docs', 'decisions.md'), ...(await listMd(path.join(cwd, 'docs', 'knowledge')))];
    for (const f of cands) if (await exists(f)) await add(f, `Projeto · ${label}`, path.basename(f, '.md'), path.relative(cwd, f));
  }
  let pds = [];
  try { pds = await fsp.readdir(PROJECTS_DIR); } catch { /* sem projetos */ }
  for (const pd of pds) {
    const files = (await listMd(path.join(PROJECTS_DIR, pd, 'memory')))
      .sort((a, b) => (path.basename(b) === 'MEMORY.md') - (path.basename(a) === 'MEMORY.md') || a.localeCompare(b));
    for (const f of files) await add(f, 'Memória do Claude', path.basename(f, '.md'), projectLabel('', pd));
  }
  return items;
}
async function writeTextFile(p, text, backupDir) {
  let orig = null;
  try { orig = await fsp.readFile(p, 'utf8'); } catch { /* novo */ }
  let backup = '';
  if (orig !== null) {
    await fsp.mkdir(backupDir, { recursive: true });
    backup = path.join(backupDir, `${path.basename(p, '.md')}.${stampNow()}.md`);
    await fsp.writeFile(backup, orig);
  }
  const tmp = p + '.tmp';
  await fsp.writeFile(tmp, text, 'utf8');
  await fsp.rename(tmp, p);
  return { backup };
}

// ---------- chat do broker (sessão principal: você <-> broker) ----------
const brokerFiles = new Map(); // id -> { file, mtime }
const brokerHead = new Map();  // file -> { size, cwd, start, title } (só o começo do arquivo: barato)

function headOf(file, size) {
  const fd = fs.openSync(file, 'r');
  try {
    const len = Math.min(size, 131072);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, 0);
    return buf.toString('utf8');
  } finally { fs.closeSync(fd); }
}

async function brokerIndex() {
  const out = [];
  let projects = [];
  try { projects = await fsp.readdir(PROJECTS_DIR); } catch { return out; }
  for (const pd of projects) {
    const pdir = path.join(PROJECTS_DIR, pd);
    let entries = [];
    try { entries = await fsp.readdir(pdir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith('.jsonl')) continue;
      const file = path.join(pdir, e.name);
      let st;
      try { st = await fsp.stat(file); } catch { continue; }
      const id = path.basename(e.name, '.jsonl');
      let h = brokerHead.get(file);
      if (!h || (!h.title && h.size !== st.size)) {
        const lines = [];
        try {
          for (const ln of headOf(file, st.size).split('\n')) {
            if (!ln) continue;
            try { lines.push(JSON.parse(ln)); } catch { /* linha truncada */ }
          }
        } catch { /* ilegível */ }
        const cwd = (lines.find((x) => x.cwd) || {}).cwd || '';
        const start = (lines.find((x) => x.timestamp) || {}).timestamp || '';
        let title = '';
        for (const l of lines) {
          if (l.type === 'user' && l.message && !l.isMeta && !l.isSidechain) {
            const t = blocksText(l.message.content).trim();
            if (t && !isNoise(t) && !/^\[Request interrupted/.test(t)) { title = t.replace(/\s+/g, ' ').slice(0, 120); break; }
          }
        }
        h = { size: st.size, cwd, start, title };
        brokerHead.set(file, h);
      }
      if (!h.title) continue; // arquivo sem conversa (só metadados)
      brokerFiles.set(id, { file, mtime: st.mtimeMs });
      out.push({ id, project: projectLabel(h.cwd, pd), cwd: h.cwd, start: h.start, mtime: st.mtimeMs, title: h.title });
    }
  }
  out.sort((a, b) => b.mtime - a.mtime);
  return out;
}

// Mensagens da conversa principal. Resultados de ferramentas e ruído de sistema ficam de fora.
async function brokerMessages(id, limit = 400) {
  const ref = brokerFiles.get(id);
  const stats = { chars: 0, briefChars: 0, calls: 0, agents: {} };
  if (!ref) return { msgs: [], total: 0, stats };
  const lines = readJsonl(ref.file);
  const msgs = [];
  for (const l of lines) {
    if (l.isSidechain) continue;
    if (l.type === 'user' && l.message && !l.isMeta) {
      const t = blocksText(l.message.content).trim();
      if (!t || isNoise(t)) continue;
      if (/^\[Request interrupted/.test(t)) { msgs.push({ k: 'note', t: 'Resposta interrompida', ts: l.timestamp }); continue; }
      stats.chars += t.length;
      msgs.push({ k: 'master', t, ts: l.timestamp });
    } else if (l.type === 'assistant' && l.message && Array.isArray(l.message.content)) {
      for (const b of l.message.content) {
        if (b.type === 'text' && b.text && b.text.trim()) {
          stats.chars += b.text.length;
          msgs.push({ k: 'broker', t: b.text.trim(), ts: l.timestamp, model: l.message.model || '' });
        } else if (b.type === 'tool_use') {
          if (b.input && b.input.subagent_type && (b.name === 'Agent' || b.name === 'Task')) {
            const n = String(b.input.prompt || '').length;
            stats.calls++; stats.briefChars += n;
            stats.agents[b.input.subagent_type] = (stats.agents[b.input.subagent_type] || 0) + 1;
            msgs.push({ k: 'call', agent: b.input.subagent_type, desc: b.input.description || '', chars: n, ts: l.timestamp });
          } else {
            const item = { name: b.name, s: toolSummary(b.name, b.input) };
            const last = msgs[msgs.length - 1];
            if (last && last.k === 'tools') last.items.push(item); else msgs.push({ k: 'tools', items: [item], ts: l.timestamp });
          }
        }
      }
    }
  }
  return { msgs: msgs.slice(-limit), total: msgs.length, stats };
}

// ---------- cérebro: memórias como neurônios ----------
// Cada item de lista / parágrafo sob um título vira um neurônio.
function neuronsFromText(txt, max = 40) {
  const out = [];
  let sec = '';
  let cur = null;
  const push = () => { if (cur && cur.text.trim().length > 3) out.push(cur); cur = null; };
  for (const raw of String(txt).split(/\r?\n/)) {
    const h = raw.match(/^#{1,4}\s+(.*)$/);
    if (h) { push(); sec = h[1].trim(); continue; }
    const b = raw.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
    if (b) { push(); cur = { sec, text: b[1].trim() }; continue; }
    if (cur && /^\s+\S/.test(raw)) { cur.text += ' ' + raw.trim(); continue; }
    if (!raw.trim()) { push(); continue; }
    if (!cur) cur = { sec, text: raw.trim() }; else cur.text += ' ' + raw.trim();
  }
  push();
  return out.slice(0, max).map((n, i) => ({ id: `n${i}`, sec: n.sec, title: n.text.length > 70 ? n.text.slice(0, 69).trimEnd() + '…' : n.text, text: n.text }));
}

// Briefing que o agente recebeu: é literalmente tudo o que ele sabe daquela tarefa.
function runBrief(run) {
  try {
    if (run.source === 'sidechain') {
      for (const ln of headOf(run.file, fs.statSync(run.file).size).split('\n')) {
        if (!ln) continue;
        let l; try { l = JSON.parse(ln); } catch { continue; }
        if (l.type === 'user' && l.message && !l.isMeta) { const t = blocksText(l.message.content).trim(); if (t && !isNoise(t)) return t; }
      }
      return '';
    }
    const k = (cache.get(run.file) || { calls: [] }).calls.find((x) => x.toolUseId === run.toolUseId);
    return (k && k.prompt) || '';
  } catch { return ''; }
}

async function brainNeurons(defs) {
  const out = [];
  for (const d of defs) {
    const m = await memoryInfo(d);
    out.push({ slug: d.slug, file: m ? m.file : '', neurons: m ? neuronsFromText(m.text).map((n) => ({ ...n, mtime: m.mtime })) : [] });
  }
  return out;
}

// Comandos/skills conhecidos no disco (autocomplete antes do CLI iniciar). Vale o init do CLI depois.
async function listCommands() {
  const out = new Map();
  const add = (name, desc, kind) => { if (name && !out.has(name)) out.set(name, { name, desc: desc || '', kind }); };
  const fmDesc = (txt) => { const m = txt.match(/^---\r?\n([\s\S]*?)\r?\n---/); const d = m && m[1].match(/^description:\s*(.*)$/m); return d ? d[1].replace(/^["']|["']$/g, '').slice(0, 140) : ''; };
  try {
    for (const d of await fsp.readdir(path.join(CLAUDE, 'skills'), { withFileTypes: true })) {
      if (!d.isDirectory() || d.name === 'synced') continue;
      try { add(d.name, fmDesc(await fsp.readFile(path.join(CLAUDE, 'skills', d.name, 'SKILL.md'), 'utf8')), 'skill'); } catch { /* sem SKILL.md */ }
    }
  } catch { /* sem skills */ }
  try {
    for (const f of await fsp.readdir(path.join(CLAUDE, 'commands'))) if (f.endsWith('.md')) add(f.replace(/\.md$/, ''), fmDesc(await fsp.readFile(path.join(CLAUDE, 'commands', f), 'utf8')), 'comando');
  } catch { /* sem commands */ }
  for (const n of ['compact', 'clear', 'model', 'context', 'init', 'review']) add(n, '', 'built-in');
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = { listCommands, runBrief, brokerIndex, brokerMessages, brainNeurons, neuronsFromText, agentRaw, saveAgent, generalMemory, writeTextFile, useCacheFile, loadAgentDefs, memoryList, memoryRead, indexRuns, runMessages, norm, CLAUDE, AGENTS_DIR, MEMORY_DIR };
