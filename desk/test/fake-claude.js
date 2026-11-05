#!/usr/bin/env node
// CLI falso que fala o mesmo protocolo stream-json do Claude Code. Só para os testes: sem rede, sem tokens.
// Registra em FAKE_LOG o que recebeu e, se FAKE_TRANSCRIPT existir, grava a conversa como o CLI de verdade faz.
const fs = require('fs');
const args = process.argv.slice(2);
if (args.includes('--version')) { console.log('9.9.9 (Fake Claude)'); process.exit(0); }
const log = (o) => { if (process.env.FAKE_LOG) fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify(o) + '\n'); };
log({ args, cwd: process.cwd() });
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : ''; };
const SID = arg('--resume') || 'bbbbbbbb-0000-0000-0000-000000000002';
let mode = arg('--permission-mode') || 'manual';
const out = (o) => process.stdout.write(JSON.stringify({ session_id: SID, ...o }) + '\n');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tx = (o) => { if (process.env.FAKE_TRANSCRIPT && SID === (process.env.FAKE_TRANSCRIPT_SID || SID)) fs.appendFileSync(process.env.FAKE_TRANSCRIPT, JSON.stringify({ sessionId: SID, cwd: process.cwd(), timestamp: new Date().toISOString(), ...o }) + '\n'); };
let inited = false, n = 0, interrupted = false;
const waiting = new Map();

function init() {
  if (inited) return; inited = true;
  out({ type: 'system', subtype: 'init', cwd: process.cwd(), model: 'claude-fake-1', permissionMode: mode, slash_commands: ['karma', 'compact', 'clear', 'reflect'], skills: ['karma', 'reflect'], agents: [] });
}
async function say(text) {
  const mid = 'msg_' + (++n);
  out({ type: 'stream_event', event: { type: 'message_start', message: { id: mid } } });
  out({ type: 'stream_event', event: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } } });
  const half = Math.ceil(text.length / 2);
  for (const part of [text.slice(0, half), text.slice(half)]) { out({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: part } } }); await sleep(40); }
  out({ type: 'stream_event', event: { type: 'content_block_stop', index: 0 } });
  out({ type: 'assistant', message: { id: mid, role: 'assistant', model: 'claude-fake-1', content: [{ type: 'text', text }] } });
  tx({ type: 'assistant', message: { role: 'assistant', model: 'claude-fake-1', content: [{ type: 'text', text }] } });
}
const result = (o = {}) => out({ type: 'result', subtype: 'success', is_error: false, duration_ms: 1234, total_cost_usd: 0.0123, result: '', ...o });

async function turn(text) {
  init();
  tx({ type: 'user', message: { role: 'user', content: text } });
  interrupted = false;
  if (/^\/karma/.test(text)) { await say('comando karma recebido'); return result(); }
  if (text.includes('demorar')) {
    out({ type: 'stream_event', event: { type: 'message_start', message: { id: 'msg_slow' } } });
    out({ type: 'stream_event', event: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } } });
    out({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'pensando devagar' } } });
    for (let i = 0; i < 200 && !interrupted; i++) await sleep(50);
    return result({ subtype: 'error_during_execution', is_error: true, result: 'interrompido' });
  }
  if (text.includes('escrever')) {
    const id = 'toolu_' + (++n), input = { file_path: '/fx/a.txt', content: 'hello' };
    out({ type: 'stream_event', event: { type: 'message_start', message: { id: 'msg_t' + n } } });
    out({ type: 'stream_event', event: { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id, name: 'Write', input: {} } } });
    out({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(input) } } });
    out({ type: 'stream_event', event: { type: 'content_block_stop', index: 0 } });
    out({ type: 'assistant', message: { id: 'msg_t' + n, role: 'assistant', content: [{ type: 'tool_use', id, name: 'Write', input }] } });
    const rid = 'req_' + n;
    const decided = new Promise((res) => waiting.set(rid, res));
    out({ type: 'control_request', request_id: rid, request: { subtype: 'can_use_tool', tool_name: 'Write', input, description: 'a.txt', decision_reason: 'Claude pediu para escrever em a.txt', permission_suggestions: [{ type: 'setMode', mode: 'acceptEdits', destination: 'session' }] } });
    const d = await decided;
    if (d.behavior === 'allow') { out({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'File created', is_error: false }] } }); await say('arquivo criado'); }
    else { out({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'negado', is_error: true }] } }); await say('ok, não escrevi'); }
    return result();
  }
  await say('Olá do fake: ' + text);
  return result();
}

let buf = '';
let chain = Promise.resolve();
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => {
  buf += d; let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    let m; try { m = JSON.parse(line); } catch { continue; }
    if (m.type === 'user') {
      const ct = m.message.content;
      const txt = Array.isArray(ct) ? ct.filter((b) => b.type === 'text').map((b) => b.text).join(' ') : String(ct);
      const nimg = Array.isArray(ct) ? ct.filter((b) => b.type === 'image' && b.source && b.source.type === 'base64').length : 0;
      log({ user: txt, images: nimg });
      chain = chain.then(() => turn(nimg ? `${txt} [imagens: ${nimg}]` : txt));
    }
    else if (m.type === 'control_response') { const r = m.response.response; log({ ctl: r.behavior, upd: !!r.updatedPermissions }); const w = waiting.get(m.response.request_id); if (w) { waiting.delete(m.response.request_id); w(r); } }
    else if (m.type === 'control_request') {
      const sub = m.request.subtype; log({ ctlreq: sub, mode: m.request.mode, model: m.request.model });
      if (sub === 'interrupt') interrupted = true;
      if (sub === 'set_permission_mode') mode = m.request.mode;
      out({ type: 'control_response', response: { subtype: 'success', request_id: m.request_id, response: {} } });
    }
  }
});
process.stdin.on('end', () => process.exit(0));
