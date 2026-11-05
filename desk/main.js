const { app, BrowserWindow, ipcMain, shell, Menu, dialog, clipboard, screen } = require('electron');
const path = require('path');
const fs = require('fs');

// Modo de teste/isolamento: pasta de dados própria (não mistura com a instalação real).
if (process.env.NIRVANA_DESK_USERDATA) app.setPath('userData', process.env.NIRVANA_DESK_USERDATA);

const scan = require('./lib/scan');
const cli = require('./lib/cli');
const TESTING = !!process.env.NIRVANA_DESK_TEST;

// Uma janela só: abrir de novo traz a existente para a frente (convenção de apps desktop).
if (!TESTING && !app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
let win = null;
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

let runsById = new Map();
let defs = [];
let allowed = new Set(); // só arquivos listados como memória podem ser lidos/gravados
const norm = (s) => String(s || '').trim().toLowerCase();
const backups = () => path.join(app.getPath('userData'), 'backups');
const aliasFile = () => path.join(app.getPath('userData'), 'aliases.json');
const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');
const readAliases = () => { try { return JSON.parse(fs.readFileSync(aliasFile(), 'utf8')); } catch { return {}; } };
const withAliases = (list) => { const al = readAliases(); return list.map((d) => ({ ...d, aliases: al[d.slug] || [] })); };

async function refresh() {
  defs = withAliases(await scan.loadAgentDefs());
  const runs = await scan.indexRuns();
  runsById = new Map(runs.map((r) => [r.id, r]));
  return { defs, runs: runs.map(({ file, ...r }) => r) };
}

ipcMain.handle('data:defs', async () => { defs = withAliases(await scan.loadAgentDefs()); return defs; });
ipcMain.handle('data:refresh', refresh);
ipcMain.handle('run:messages', async (_e, id) => {
  const r = runsById.get(id);
  return r ? scan.runMessages(r) : { msgs: [], tokens: 0, model: '' };
});
ipcMain.handle('memory:list', async () => scan.memoryList(defs.length ? defs : await scan.loadAgentDefs()));
ipcMain.handle('memory:read', async (_e, slug) => {
  const d = (defs.length ? defs : await scan.loadAgentDefs()).find((x) => x.slug === slug);
  return d ? scan.memoryRead(d) : null;
});
ipcMain.handle('agent:raw', (_e, slug) => scan.agentRaw(slug));
ipcMain.handle('agent:save', async (_e, slug, payload) => {
  const before = await scan.agentRaw(slug);
  const res = await scan.saveAgent(slug, payload, backups());
  if (norm(before.name) !== norm(payload.name)) {
    const al = readAliases();
    al[slug] = [...new Set([...(al[slug] || []), before.name])];
    fs.writeFileSync(aliasFile(), JSON.stringify(al));
  }
  return res;
});
ipcMain.handle('gmem:list', async () => {
  const cwds = [...new Set([...runsById.values()].map((r) => r.cwd).filter(Boolean))];
  const items = await scan.generalMemory(cwds);
  allowed = new Set(items.map((i) => i.path));
  return items;
});
ipcMain.handle('file:read', async (_e, p) => {
  if (!allowed.has(p)) throw new Error('Arquivo não permitido');
  return fs.promises.readFile(p, 'utf8');
});
ipcMain.handle('file:write', async (_e, p, text) => {
  if (!allowed.has(p)) throw new Error('Arquivo não permitido');
  return scan.writeTextFile(p, String(text), backups());
});
ipcMain.handle('broker:list', () => scan.brokerIndex());
ipcMain.handle('broker:messages', (_e, id) => scan.brokerMessages(String(id)));
ipcMain.handle('brain:data', async (_e, projPath) => {
  const pp = projPath ? String(projPath).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase() : '';
  const ds = defs.length ? defs : await scan.loadAgentDefs();
  const out = await scan.brainNeurons(ds);
  // cada briefing recebido vira um neurônio do agente (é tudo o que ele sabe da tarefa)
  const owner = new Map();
  for (const d of ds) for (const k of [d.name, d.slug, ...(d.aliases || [])]) owner.set(norm(k), d.slug);
  const per = new Map();
  for (const r of [...runsById.values()].sort((a, b) => Date.parse(b.start || 0) - Date.parse(a.start || 0))) {
    const slug = owner.get(norm(r.agentType));
    if (!slug) continue;
    if (pp) { const rc = String(r.cwd || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase(); if (rc !== pp && !rc.startsWith(pp + '/')) continue; }
    const list = per.get(slug) || [];
    if (list.length >= 14) continue;
    const text = scan.runBrief(r);
    if (!text) continue;
    list.push({ id: 'b' + r.id.slice(-8), sec: 'Briefing recebido', kind: 'brief', title: text.replace(/\s+/g, ' ').slice(0, 69), text, mtime: Date.parse(r.start || 0) || r.mtime });
    per.set(slug, list);
  }
  for (const o of out) o.neurons = [...o.neurons, ...(per.get(o.slug) || [])];
  return out;
});
// ---------- projetos: pastas registradas para separar o contexto ----------
const projFile = () => path.join(app.getPath('userData'), 'projects.json');
const readProj = () => { try { const j = JSON.parse(fs.readFileSync(projFile(), 'utf8')); return Array.isArray(j) ? j : []; } catch { return []; } };
const writeProj = (l) => { fs.mkdirSync(path.dirname(projFile()), { recursive: true }); fs.writeFileSync(projFile(), JSON.stringify(l, null, 1)); };
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
ipcMain.handle('proj:list', () => readProj().map((p) => ({ ...p, exists: isDir(p.path) })));
ipcMain.handle('proj:add', async (_e, dir) => {
  let p = dir ? String(dir) : '';
  if (!p) {
    if (process.env.NIRVANA_DESK_PICKDIR) p = process.env.NIRVANA_DESK_PICKDIR;
    else { const r = await dialog.showOpenDialog(win, { title: 'Adicionar pasta de projeto', properties: ['openDirectory'] }); p = r.canceled || !r.filePaths[0] ? '' : r.filePaths[0]; }
  }
  if (!p) return { ok: false, canceled: true };
  if (!isDir(p)) return { ok: false, error: 'Pasta inválida' };
  const list = readProj();
  const key = (x) => path.resolve(x).toLowerCase();
  const ex = list.find((q) => key(q.path) === key(p));
  if (ex) return { ok: true, id: ex.id, existed: true };
  const id = 'p' + Date.now().toString(36);
  list.push({ id, name: path.basename(path.resolve(p)) || p, path: path.resolve(p) });
  writeProj(list);
  return { ok: true, id };
});
ipcMain.handle('proj:remove', (_e, id) => { writeProj(readProj().filter((p) => p.id !== String(id))); return true; });
ipcMain.handle('proj:rename', (_e, id, name) => { const l = readProj(); const p = l.find((q) => q.id === String(id)); if (p && String(name).trim()) { p.name = String(name).trim().slice(0, 60); writeProj(l); } return true; });
ipcMain.handle('app:paths', () => ({ claude: scan.CLAUDE, agents: scan.AGENTS_DIR, memory: scan.MEMORY_DIR, version: app.getVersion(), backups: backups() }));
ipcMain.handle('app:open', (_e, p) => shell.showItemInFolder(p));

// ---------- falar com o Claude Code (CLI de verdade) ----------
const sessions = new cli.Sessions((id, ev) => { if (win && !win.isDestroyed()) win.webContents.send('cli:event', { id, ev }); });
const cliGuard = (fn) => async (_e, ...a) => { try { return { ok: true, v: await fn(...a) }; } catch (e) { return { ok: false, error: String((e && e.message) || e) }; } };
ipcMain.handle('cli:info', cliGuard(() => { const bin = cli.findBin(); return { bin, version: bin ? cli.version(bin) : '', modes: cli.MODES }; }));
ipcMain.handle('cli:open', cliGuard((o) => sessions.open({ cwd: String(o.cwd || ''), resume: o.resume ? String(o.resume) : '', model: o.model ? String(o.model) : '', mode: String(o.mode || 'manual') })));
ipcMain.handle('cli:send', cliGuard((id, text) => { sessions.send(String(id), String(text)); return true; }));
ipcMain.handle('cli:answer', cliGuard((id, req, d) => { sessions.answer(String(id), String(req), d || {}); return true; }));
ipcMain.handle('cli:interrupt', cliGuard((id) => { sessions.interrupt(String(id)); return true; }));
ipcMain.handle('cli:setMode', cliGuard((id, m) => { sessions.setMode(String(id), String(m)); return true; }));
ipcMain.handle('cli:setModel', cliGuard((id, m) => { sessions.setModel(String(id), String(m || '')); return true; }));
ipcMain.handle('cli:close', cliGuard((id) => { sessions.close(String(id)); return true; }));
ipcMain.handle('cli:pickDir', async () => {
  if (process.env.NIRVANA_DESK_PICKDIR) return process.env.NIRVANA_DESK_PICKDIR;
  const r = await dialog.showOpenDialog(win, { title: 'Escolha a pasta do projeto', properties: ['openDirectory'] });
  return r.canceled || !r.filePaths[0] ? '' : r.filePaths[0];
});
// comandos que existem antes de a sessão iniciar (a lista completa vem no evento init do CLI)
ipcMain.handle('cli:commands', async () => scan.listCommands());
app.on('before-quit', () => sessions.closeAll());

// ---------- convenções de app ----------
ipcMain.handle('clipboard:write', (_e, text) => { clipboard.writeText(String(text)); return true; });

ipcMain.on('find:run', (e, text, opts) => {
  if (!text) return;
  e.sender.findInPage(String(text), { forward: opts.forward !== false, findNext: !!opts.findNext });
});
ipcMain.on('find:stop', (e) => e.sender.stopFindInPage('clearSelection'));

ipcMain.handle('export:save', async (_e, name, text) => {
  const safe = String(name || 'conversa.md').replace(/[\\/:*?"<>|]+/g, '-');
  let target = process.env.NIRVANA_DESK_EXPORT || '';
  if (!target) {
    const r = await dialog.showSaveDialog(win, { title: 'Exportar conversa', defaultPath: path.join(app.getPath('documents'), safe), filters: [{ name: 'Markdown', extensions: ['md'] }] });
    if (r.canceled || !r.filePath) return { saved: false };
    target = r.filePath;
  }
  fs.writeFileSync(target, String(text), 'utf8');
  return { saved: true, path: target };
});

// ---------- janela: lembra posição e tamanho ----------
function loadBounds() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    const visible = screen.getAllDisplays().some((d) => {
      const b = d.workArea;
      return s.x < b.x + b.width - 80 && s.x + s.width > b.x + 80 && s.y < b.y + b.height - 80 && s.y + s.height > b.y + 40;
    });
    return visible ? s : { width: s.width, height: s.height, maximized: s.maximized };
  } catch { return {}; }
}
function saveBounds() {
  if (!win || win.isDestroyed() || win.isMinimized()) return;
  const maximized = win.isMaximized();
  const b = maximized ? (win.__normal || win.getNormalBounds()) : win.getBounds();
  try { fs.writeFileSync(stateFile(), JSON.stringify({ ...b, maximized })); } catch { /* sem permissão: ignora */ }
}

function buildMenu() {
  const send = (cmd) => () => win && win.webContents.send('cmd', cmd);
  const tpl = [
    { label: 'Arquivo', submenu: [{ label: 'Exportar conversa\tCtrl+Shift+E', click: send('export') }, { type: 'separator' }, { role: 'quit', label: 'Sair' }] },
    { label: 'Editar', submenu: [{ role: 'undo', label: 'Desfazer' }, { role: 'redo', label: 'Refazer' }, { type: 'separator' }, { role: 'cut', label: 'Recortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Colar' }, { role: 'selectAll', label: 'Selecionar tudo' }] },
    { label: 'Exibir', submenu: [{ label: 'Paleta de comandos\tCtrl+K', click: send('palette') }, { label: 'Atualizar\tF5', click: send('refresh') }, { type: 'separator' }, { role: 'zoomIn', label: 'Aumentar zoom' }, { role: 'zoomOut', label: 'Diminuir zoom' }, { role: 'resetZoom', label: 'Zoom padrão' }, { type: 'separator' }, { role: 'togglefullscreen', label: 'Tela cheia' }, ...(process.env.NIRVANA_DESK_DEV ? [{ role: 'toggleDevTools' }] : [])] },
    { label: 'Ajuda', submenu: [{ label: 'Atalhos de teclado\tF1', click: send('help') }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

function createWindow() {
  const b = loadBounds();
  win = new BrowserWindow({
    width: b.width || 1360, height: b.height || 820, x: b.x, y: b.y, minWidth: 1000, minHeight: 640,
    backgroundColor: '#07060d', title: 'Nirvana Desk', show: !TESTING,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#07060d', symbolColor: '#a78bfa', height: 38 },
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false, backgroundThrottling: false },
  });
  if (b.maximized) win.maximize();
  buildMenu();
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) e.preventDefault(); });

  win.on('resize', () => { if (!win.isMaximized()) win.__normal = win.getBounds(); clearTimeout(win.__t); win.__t = setTimeout(saveBounds, 400); });
  win.on('move', () => { if (!win.isMaximized()) win.__normal = win.getBounds(); clearTimeout(win.__t); win.__t = setTimeout(saveBounds, 400); });
  win.on('close', saveBounds);

  // menu de contexto: copiar/colar onde faz sentido
  win.webContents.on('context-menu', (_e, p) => {
    const items = [];
    if (p.isEditable) items.push({ role: 'undo', label: 'Desfazer' }, { role: 'redo', label: 'Refazer' }, { type: 'separator' }, { role: 'cut', label: 'Recortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Colar' }, { type: 'separator' }, { role: 'selectAll', label: 'Selecionar tudo' });
    else if (p.selectionText) items.push({ role: 'copy', label: 'Copiar' }, { role: 'selectAll', label: 'Selecionar tudo' });
    if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
  });

  // resultado da busca na página -> interface
  win.webContents.on('found-in-page', (_e, r) => win.webContents.send('find:result', { active: r.activeMatchOrdinal, matches: r.matches }));

  // modo captura para validar o visual: NIRVANA_DESK_SHOT=arquivo.png [NIRVANA_DESK_SCRIPT=js]
  if (process.env.NIRVANA_DESK_SHOT) {
    win.webContents.on('did-finish-load', async () => {
      await new Promise((r) => setTimeout(r, +process.env.NIRVANA_DESK_WAIT || 2500));
      if (process.env.NIRVANA_DESK_SCRIPT) {
        try { await win.webContents.executeJavaScript(process.env.NIRVANA_DESK_SCRIPT); } catch (e) { console.error(e); }
        await new Promise((r) => setTimeout(r, 1500));
      }
      const img = await win.webContents.capturePage();
      fs.writeFileSync(process.env.NIRVANA_DESK_SHOT, img.toPNG());
      app.quit();
    });
  }
  return win;
}

app.whenReady().then(() => {
  scan.useCacheFile(path.join(app.getPath('userData'), 'index-cache.json'));
  createWindow();
});
app.on('window-all-closed', () => { if (!TESTING) app.quit(); });
module.exports = { getWindow: () => win };
