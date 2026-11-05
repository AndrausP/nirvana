// Ponte com o Claude Code de verdade: cada conversa é um processo `claude -p` em modo stream-json.
// O app não reimplementa nada: comandos (/skills, /compact…), ferramentas, hooks, plugins, memória e
// permissões são os do CLI instalado, com o mesmo ~/.claude. Aqui só há spawn + protocolo.
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MODES = ['manual', 'acceptEdits', 'plan', 'bypassPermissions'];
const MODEL_RE = /^[A-Za-z0-9._\-\[\]]{1,60}$/;
const IMG_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const ID_RE = /^[0-9a-fA-F-]{8,64}$/;

function findBin() {
  if (process.env.NIRVANA_DESK_CLAUDE_BIN) return process.env.NIRVANA_DESK_CLAUDE_BIN;
  const names = process.platform === 'win32' ? ['claude.exe', 'claude.cmd'] : ['claude'];
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  dirs.push(path.join(os.homedir(), '.local', 'bin'), path.join(os.homedir(), '.claude', 'local'));
  for (const d of dirs) for (const n of names) { const p = path.join(d, n); try { if (fs.statSync(p).isFile()) return p; } catch { /* próximo */ } }
  return '';
}

function version(bin) {
  try {
    const isJs = /\.(c|m)?js$/.test(bin);
    return execFileSync(isJs ? process.execPath : bin, isJs ? [bin, '--version'] : ['--version'], { timeout: 8000, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }).toString().trim();
  } catch { return ''; }
}

class Sessions {
  constructor(emit) { this.emit = emit; this.map = new Map(); this.n = 0; }

  open({ cwd, resume, model, mode }) {
    const bin = findBin();
    if (!bin) throw new Error('Claude Code (claude) não encontrado. Instale o CLI e tente de novo.');
    let st; try { st = fs.statSync(cwd); } catch { st = null; }
    if (!st || !st.isDirectory()) throw new Error('Pasta do projeto inválida: ' + cwd);
    if (!MODES.includes(mode)) throw new Error('Modo de permissão inválido');
    if (model && !MODEL_RE.test(model)) throw new Error('Modelo inválido');
    if (resume && !ID_RE.test(resume)) throw new Error('Sessão inválida');

    const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
      '--permission-prompts', 'host', '--permission-prompt-tool', 'stdio', '--permission-mode', mode, '--no-chrome'];
    if (model) args.push('--model', model);
    if (resume) args.push('--resume', resume);
    const isJs = /\.(c|m)?js$/.test(bin);
    const id = 'c' + (++this.n);
    const proc = spawn(isJs ? process.execPath : bin, isJs ? [bin, ...args] : args, {
      cwd, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, ...(isJs ? { ELECTRON_RUN_AS_NODE: '1' } : {}) },
    });
    const s = { id, proc, buf: '', err: '', closed: false, ctl: 0 };
    this.map.set(id, s);
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (d) => {
      s.buf += d;
      let i;
      while ((i = s.buf.indexOf('\n')) >= 0) {
        const line = s.buf.slice(0, i).trim(); s.buf = s.buf.slice(i + 1);
        if (!line) continue;
        let ev; try { ev = JSON.parse(line); } catch { continue; }
        if (ev.type === 'system' && /^hook_/.test(ev.subtype || '')) continue; // ruído de hooks
        if (ev.type === 'rate_limit_event') continue;
        this.emit(id, ev);
      }
    });
    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', (d) => { s.err = (s.err + d).slice(-2000); });
    proc.on('error', (e) => { s.closed = true; this.emit(id, { type: 'desk_exit', code: -1, error: String(e.message || e) }); });
    proc.on('exit', (code) => { s.closed = true; this.emit(id, { type: 'desk_exit', code, error: code ? s.err.trim().split('\n').slice(-3).join(' | ') : '' }); this.map.delete(id); });
    return { id };
  }

  _w(id, obj) {
    const s = this.map.get(id);
    if (!s || s.closed || !s.proc.stdin.writable) throw new Error('Sessão encerrada');
    s.proc.stdin.write(JSON.stringify(obj) + '\n');
  }
  // payload: texto, ou { text, images: [{ media, data(base64) }] }
  send(id, p) {
    let content;
    if (typeof p === 'string') content = p;
    else {
      const imgs = Array.isArray(p && p.images) ? p.images : [];
      if (imgs.length > 5) throw new Error('Máximo de 5 imagens por mensagem');
      content = [];
      for (const i of imgs) {
        if (!IMG_TYPES.includes(i.media) || typeof i.data !== 'string' || !/^[A-Za-z0-9+/]+=*$/.test(i.data) || i.data.length > 7000000) throw new Error('Imagem inválida ou grande demais');
        content.push({ type: 'image', source: { type: 'base64', media_type: i.media, data: i.data } });
      }
      if (p && p.text && String(p.text).trim()) content.push({ type: 'text', text: String(p.text) });
      if (!content.length) throw new Error('Mensagem vazia');
    }
    this._w(id, { type: 'user', message: { role: 'user', content } });
  }
  answer(id, requestId, d) {
    const response = d.allow
      ? { behavior: 'allow', updatedInput: d.input || {}, ...(d.remember && d.suggestions ? { updatedPermissions: d.suggestions } : {}) }
      : { behavior: 'deny', message: d.message || 'Negado pelo usuário no Nirvana Desk' };
    this._w(id, { type: 'control_response', response: { subtype: 'success', request_id: requestId, response } });
  }
  _ctl(id, request) { const s = this.map.get(id); this._w(id, { type: 'control_request', request_id: `desk-${++s.ctl}`, request }); }
  interrupt(id) { this._ctl(id, { subtype: 'interrupt' }); }
  setMode(id, mode) { if (!MODES.includes(mode)) throw new Error('Modo inválido'); this._ctl(id, { subtype: 'set_permission_mode', mode }); }
  setModel(id, model) { if (model && !MODEL_RE.test(model)) throw new Error('Modelo inválido'); this._ctl(id, { subtype: 'set_model', model: model || null }); }
  close(id) {
    const s = this.map.get(id);
    if (!s) return;
    try { s.proc.stdin.end(); } catch { /* já fechado */ }
    setTimeout(() => { try { if (!s.closed) s.proc.kill(); } catch { /* ok */ } }, 1500);
  }
  closeAll() { for (const id of [...this.map.keys()]) this.close(id); }
}

module.exports = { Sessions, findBin, version, MODES };
