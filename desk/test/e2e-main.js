// Teste de ponta a ponta do Nirvana Desk. Roda o app de verdade (Electron oculto) com uma pasta de
// fixture no lugar do ~/.claude: NUNCA toca seus agentes reais.   Uso: npx electron test/e2e-main.js
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'desk-e2e-'));
const claude = path.join(tmp, '.claude');
process.env.NIRVANA_DESK_CLAUDE = claude;
process.env.NIRVANA_DESK_USERDATA = path.join(tmp, 'userdata');
process.env.NIRVANA_DESK_EXPORT = path.join(tmp, 'export.md');
process.env.NIRVANA_DESK_TEST = '1';
const MAIN_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const projDir = path.join(tmp, 'proj'); fs.mkdirSync(projDir, { recursive: true });
const otherDir = path.join(tmp, 'elsewhere'); fs.mkdirSync(otherDir, { recursive: true });
const fakeLog = path.join(tmp, 'fake.log');
const mainFile = path.join(claude, 'projects', '-fx-proj', MAIN_ID + '.jsonl');
process.env.NIRVANA_DESK_CLAUDE_BIN = path.join(__dirname, 'fake-claude.js');
process.env.FAKE_LOG = fakeLog; process.env.FAKE_TRANSCRIPT = mainFile; process.env.FAKE_TRANSCRIPT_SID = MAIN_ID;
process.env.NIRVANA_DESK_PICKDIR = projDir;
process.env.NIRVANA_DESK_DESKTOP = otherDir;

// ---------- fixture ----------
const w = (rel, text) => { const f = path.join(claude, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
const agentMd = (name, model, body) => `---\nname: ${name}\ndescription: Agente ${name} para testes\ntools: Read, Grep\nmodel: ${model}\n---\n\n# ${name} — Tester\n\n${body}\n`;
w('agents/alpha.md', agentMd('Alpha', 'opus', 'Regra 1 do Alpha.'));
w('agents/beta.md', agentMd('Beta', 'haiku', 'Regra 1 do Beta.'));
w('agents-memory/alpha.md', '# Memória\n- item um\n- item dois\n');
w('CLAUDE.md', '# Global\nTexto das instruções globais.\n');
function sidechain(id, type, desc, startMs, n) {
  const dir = 'projects/-fx-proj/sess1/subagents';
  const at = (i) => new Date(startMs + i * 1000).toISOString();
  const lines = [{ type: 'user', isSidechain: true, sessionId: 'sess1', cwd: '/fx/proj', timestamp: at(0), message: { role: 'user', content: `Briefing para o ${type}: fazer ${desc}` } }];
  for (let i = 1; i <= n; i++) {
    lines.push({ type: 'assistant', timestamp: at(i), message: { role: 'assistant', model: 'claude-opus-5-5', usage: { input_tokens: 10, output_tokens: 20 }, content: [{ type: 'text', text: `Resposta numero ${i} do ${type} com bastante texto para ocupar espaco na conversa e permitir rolagem.` }, { type: 'tool_use', name: 'Read', input: { file_path: `/fx/file${i}.txt` } }] } });
  }
  w(`${dir}/${id}.jsonl`, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  w(`${dir}/${id}.meta.json`, JSON.stringify({ agentType: type, description: desc, toolUseId: `tu_${id}` }));
  // como num transcript real, a data do arquivo acompanha o fim da execução
  const end = new Date(startMs + n * 1000);
  fs.utimesSync(path.join(claude, dir, `${id}.jsonl`), end, end);
}
const now = Date.now();
// conversa principal (você <-> broker): o agente Alpha é chamado com um briefing
{
  const at = (ms) => new Date(now - 4 * 3600e3 + ms).toISOString();
  const main = [
    { type: 'user', sessionId: MAIN_ID, cwd: projDir, timestamp: at(0), message: { role: 'user', content: 'faz a feature X do mestre' } },
    { type: 'assistant', timestamp: at(1000), message: { role: 'assistant', model: 'claude-sonnet-5-5', content: [{ type: 'text', text: 'Abrindo a cadeia, chamando o Alpha.' }, { type: 'tool_use', id: 'tu_agent-a1', name: 'Agent', input: { subagent_type: 'Alpha', description: 'Tarefa um', prompt: 'Briefing curto para o Alpha' } }] } },
    { type: 'user', timestamp: at(2000), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_agent-a1', content: 'ok' }] } },
    { type: 'assistant', timestamp: at(3000), message: { role: 'assistant', model: 'claude-sonnet-5-5', content: [{ type: 'text', text: 'Feito, mestre.' }] } },
  ];
  w('projects/-fx-proj/' + MAIN_ID + '.jsonl', main.map((l) => JSON.stringify(l)).join('\n') + '\n');
}
sidechain('agent-a1', 'Alpha', 'Tarefa um', now - 3 * 3600e3, 30);
sidechain('agent-b1', 'Beta', 'Tarefa beta', now - 2 * 3600e3, 2);

{
  const f = 'projects/-fx-other/cccccccc-0000-0000-0000-000000000003.jsonl';
  w(f, JSON.stringify({ type: 'user', sessionId: 'cccccccc-0000-0000-0000-000000000003', cwd: otherDir, timestamp: new Date(now - 9 * 3600e3).toISOString(), message: { role: 'user', content: 'conversa alheia' } }) + '\n');
  const old = new Date(now - 9 * 3600e3); fs.utimesSync(path.join(claude, f), old, old);
}

// ---------- harness ----------
const { app, BrowserWindow, clipboard, Menu } = require('electron');
app.disableHardwareAcceleration();
const desk = require('../main.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (name, ok, extra) => { if (ok) { pass++; console.log(`ok   - ${name}`); } else { fail++; console.log(`FAIL - ${name}${extra ? ` (${extra})` : ''}`); } };
let win;
const ev = (code) => win.webContents.executeJavaScript(code, true);
const until = async (code, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await ev(code)) return true; } catch { /* página recarregando */ } await sleep(60); } return false; };
const setup = () => ev(`window.__k = (key, o = {}) => (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...o }));
  window.__type = (sel, v) => { const el = document.querySelector(sel); el.focus(); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  window.__blur = () => document.activeElement && document.activeElement.blur();
  window.__txt = (sel) => (document.querySelector(sel) || {}).textContent || '';
  window.__vis = (sel) => { const e = document.querySelector(sel); return !!e && !e.hidden; };
  true`);
const names = () => ev(`[...document.querySelectorAll('#list .item .nm')].map((n) => n.firstChild.textContent.trim()).join('|')`);
const selected = () => ev(`(document.querySelector('#list .item.on .nm') || {}).firstChild?.textContent?.trim() || ''`);
const head = () => ev(`__txt('.head h1')`);

async function run() {
  win = await (async () => { for (let i = 0; i < 100; i++) { const x = desk.getWindow(); if (x) return x; await sleep(50); } })();
  await until('document.readyState === "complete"');
  await setup();

  // 1 — carrega agentes e conversas reais da fixture
  check('carrega os agentes da pasta de teste', await until(`document.querySelectorAll('#list .item').length === 2`), await names());
  check('mais recente primeiro (Beta, Alpha)', await until(`[...document.querySelectorAll('#list .item .nm')].map((n) => n.firstChild.textContent.trim()).join('|') === 'Beta|Alpha'`), await names());
  check('na primeira abertura nada aparece como "novo"', !(await ev(`!!document.querySelector('#list .item.has-new, #list .unread')`)));
  check('abre direto no agente mais recente', await until(`__txt('.head h1') === 'Beta'`));

  // 2 — paleta de comandos
  await ev(`__blur(); __k('k', { ctrlKey: true })`);
  check('Ctrl+K abre a paleta', await ev(`__vis('#pal')`));
  await ev(`__type('#pal-q', 'alp')`);
  check('paleta filtra (busca aproximada)', (await ev(`__txt('#pal-list .pal-item.on .tt')`)).includes('Alpha'), await ev(`__txt('#pal-list')`));
  await ev(`__k('Enter')`);
  check('Enter executa e fecha a paleta', !(await ev(`__vis('#pal')`)) && (await until(`__txt('.head h1') === 'Alpha'`)));
  await ev(`__k('k', { ctrlKey: true })`); await ev(`__k('Escape')`);
  check('Esc fecha a paleta', !(await ev(`__vis('#pal')`)));
  await ev(`__blur(); __k('k', { ctrlKey: true })`); await ev(`__type('#pal-q', 'xyzxyz')`);
  check('paleta mostra "nada encontrado"', (await ev(`__txt('#pal-list')`)).includes('Nada encontrado'));
  await ev(`__k('Escape'); __blur()`);

  // 3 — trocar de tela com Ctrl+1..4 e Ctrl+,
  const view = async (k, o, title) => { await ev(`__blur(); __k('${k}', ${JSON.stringify(o)})`); return until(`__txt('#list h2') === ${JSON.stringify(title)}`); };
  check('Ctrl+3 abre a Cadeia', await view('3', { ctrlKey: true }, 'Cadeia'));
  check('Ctrl+5 abre a Memória', await view('5', { ctrlKey: true }, 'Memória'));
  check('Ctrl+6 abre a Memória geral', await view('6', { ctrlKey: true }, 'Memória geral'));
  check('Ctrl+, abre as Configurações', await view(',', { ctrlKey: true }, 'Configurações'));
  check('Ctrl+2 volta aos Agentes', await view('2', { ctrlKey: true }, 'Agentes'));

  // 4 — setas navegam a lista
  await ev(`__blur()`);
  await ev(`document.querySelectorAll('#list .item')[0].click()`);
  check('clique seleciona o agente', await until(`__txt('.head h1') === 'Beta'`));
  await ev(`__blur(); __k('ArrowDown')`);
  check('↓ seleciona o próximo agente', await until(`__txt('.head h1') === 'Alpha'`), await head());
  await ev(`__k('ArrowUp')`);
  check('↑ volta ao anterior', await until(`__txt('.head h1') === 'Beta'`), await head());

  // 5 — "/" foca a busca; Esc limpa
  await ev(`__blur(); __k('/')`);
  check('"/" foca a busca', await ev(`document.activeElement && document.activeElement.id === 'q'`));
  await ev(`__type('#q', 'alp')`);
  check('busca filtra a lista', (await names()) === 'Alpha', await names());
  await ev(`__k('Escape')`);
  check('Esc limpa e sai da busca', (await names()) === 'Beta|Alpha' && (await ev(`document.activeElement.id !== 'q' && document.querySelector('#q').value === ''`)));

  // 6 — ajuda
  await ev(`__blur(); __k('?', { shiftKey: true })`);
  check('"?" abre a lista de atalhos', await ev(`__vis('#help')`) && (await ev(`__txt('#help')`)).includes('Paleta de comandos'));
  await ev(`__k('Escape')`);
  check('Esc fecha a ajuda', !(await ev(`__vis('#help')`)));

  // 7 — copiar mensagem
  await ev(`document.querySelectorAll('#list .item')[1].click()`);
  check('seleciona o Alpha (30 mensagens)', await until(`__txt('.head h1') === 'Alpha' && document.querySelectorAll('.bubble.agent').length >= 30`));
  await Promise.resolve(clipboard.writeText('vazio'));
  await ev(`document.querySelector('.bubble.agent .copy').click()`);
  await sleep(300);
  const clip = String(await Promise.resolve(clipboard.readText()));
  check('botão copiar coloca o texto na área de transferência', clip.startsWith('Resposta numero'), clip);
  check('mostra aviso "Copiado."', (await ev(`__txt('#toast')`)).includes('Copiado'));

  // 8 — ir ao fim / início
  check('thread começa no fim', await until(`(() => { const t = document.querySelector('.thread'); return t.scrollHeight - t.scrollTop - t.clientHeight < 40; })()`));
  await ev(`__blur(); __k('Home')`);
  check('Home vai ao início', await until(`document.querySelector('.thread').scrollTop < 5`));
  check('botão "Ir para o fim" aparece ao rolar para cima', await until(`__vis('#jump')`));
  await ev(`document.querySelector('#jump').click()`);
  check('clicar no botão leva ao fim e ele some', await until(`(() => { const t = document.querySelector('.thread'); return t.scrollHeight - t.scrollTop - t.clientHeight < 40 && document.querySelector('#jump').hidden; })()`));
  await ev(`__k('Home')`); await sleep(200); await ev(`__k('End')`);
  check('End vai ao fim', await until(`(() => { const t = document.querySelector('.thread'); return t.scrollHeight - t.scrollTop - t.clientHeight < 40; })()`));

  // 9 — buscar na conversa
  await ev(`__blur(); __k('f', { ctrlKey: true })`);
  check('Ctrl+F abre a busca na conversa', await ev(`__vis('#findbar') && document.activeElement.id === 'find-q'`));
  await ev(`__type('#find-q', 'Resposta numero 7 ')`);
  check('busca encontra e conta resultados', await until(`/^\\d+\\/\\d+$/.test(__txt('#find-n'))`, 4000), await ev(`__txt('#find-n')`));
  check('o foco continua no campo de busca', await ev(`document.activeElement.id === 'find-q'`));
  await ev(`__k('Escape')`);
  check('Esc fecha a busca', !(await ev(`__vis('#findbar')`)));

  // 10 — exportar conversa
  await ev(`__blur(); __k('E', { ctrlKey: true, shiftKey: true })`);
  check('Ctrl+Shift+E exporta o Markdown', await until(`__txt('#toast').includes('exportada')`, 4000));
  const md = fs.existsSync(process.env.NIRVANA_DESK_EXPORT) ? fs.readFileSync(process.env.NIRVANA_DESK_EXPORT, 'utf8') : '';
  check('Markdown tem título, briefing e respostas', md.includes('# Conversa: Alpha') && md.includes('**Broker → Alpha**') && md.includes('Resposta numero 3 do Alpha') && md.includes('_Ferramentas:_ Read'));

  // 11 — menu nativo conversa com a interface
  const menu = Menu.getApplicationMenu();
  const labels = menu.items.map((i) => i.label);
  check('menu tem Arquivo, Editar, Exibir e Ajuda', ['Arquivo', 'Editar', 'Exibir', 'Ajuda'].every((l) => labels.includes(l)), labels.join(','));
  const helpItem = menu.items.find((i) => i.label === 'Ajuda').submenu.items[0];
  helpItem.click();
  check('menu Ajuda → Atalhos abre o painel', await until(`__vis('#help')`));
  await ev(`__k('Escape')`);

  // 12 — editar agente: guarda de edição, salvar com Ctrl+S, backup e histórico preservado
  await ev(`__blur(); __k('e', { ctrlKey: true })`);
  check('Ctrl+E abre o editor do agente', await until(`!!document.querySelector('.editor') && document.querySelector('#f-name').value === 'Alpha'`));
  await ev(`__type('#f-name', 'Alpha Prime'); __type('#f-pers', 'Direto e cético.')`);
  await ev(`__k('3', { ctrlKey: true })`);
  check('com edição não salva, trocar de tela é bloqueado', (await ev(`__txt('#list h2')`)) === 'Agentes' && (await ev(`__txt('#toast')`)).includes('Salve ou cancele'));
  await ev(`__k('s', { ctrlKey: true })`);
  check('Ctrl+S salva e fecha o editor', await until(`!document.querySelector('.editor') && __txt('.head h1') === 'Alpha Prime'`, 8000), await head());
  const file = fs.readFileSync(path.join(claude, 'agents/alpha.md'), 'utf8');
  check('arquivo do agente atualizado, tools e model preservados', file.includes('name: Alpha Prime') && file.includes('Direto e cético.') && file.includes('tools: Read, Grep') && file.includes('model: opus'));
  const bk = path.join(tmp, 'userdata', 'backups');
  check('backup do original foi criado', fs.existsSync(bk) && fs.readdirSync(bk).some((f) => f.startsWith('alpha.')));
  check('histórico antigo continua ligado ao agente renomeado', (await ev(`__txt('.head .chip:last-of-type')`)).includes('1 execu') || (await ev(`document.querySelectorAll('.bubble.agent').length`)) >= 30);
  await ev(`__blur(); __k('e', { ctrlKey: true })`);
  await until(`!!document.querySelector('.editor')`);
  await ev(`__k('Escape')`);
  check('Esc cancela a edição sem alterações', await until(`!document.querySelector('.editor')`));

  // 13 — novidade: bolinha, destaque e notificação para agente que passou a trabalhar
  await ev(`window.__notes = []; window.Notification = function (t, o) { window.__notes.push(t + ' | ' + (o && o.body)); }; true`);
  sidechain('agent-b2', 'Beta', 'Nova tarefa urgente', Date.now() - 5000, 3);
  await ev(`__blur(); __k('F5')`);
  check('agente com atividade nova ganha bolinha e destaque', await until(`!!document.querySelector('#list .item.has-new .unread')`, 8000));
  check('agente ativo aparece como ativo', await ev(`!!document.querySelector('#list .item .live')`));
  const notes = await ev(`window.__notes.join(' ; ')`);
  check('notificação avisa que o agente começou a trabalhar', notes.includes('Beta está trabalhando') && notes.includes('Nova tarefa urgente'), notes);
  await ev(`[...document.querySelectorAll('#list .item')].find((i) => i.textContent.includes('Beta')).click()`);
  check('abrir o agente remove o destaque de novo', await until(`!document.querySelector('#list .item.has-new')`));

  // 14 — paleta chega em memória e sessões; F5 atualiza
  await ev(`__blur(); __k('k', { ctrlKey: true })`);
  await ev(`__type('#pal-q', 'memoria globais')`);
  check('paleta encontra arquivos de memória', (await ev(`__txt('#pal-list .pal-item.on')`)).includes('Instruções globais'), await ev(`__txt('#pal-list')`));
  await ev(`__k('Enter')`);
  check('Enter abre a memória escolhida', await until(`__txt('#list h2') === 'Memória geral' && __txt('.head h1') === 'Instruções globais'`));

  // 14b — chat do broker: só a conversa principal; agentes aparecem como cartões de chamada
  await ev(`__blur(); __k('1', { ctrlKey: true })`);
  check('Ctrl+1 abre o chat do Broker', await until(`__txt('#list h2') === 'Broker' && __txt('.head h1') === 'Broker'`));
  check('mostra a fala do mestre e a resposta do broker', await until(`__txt('.thread').includes('faz a feature X do mestre') && __txt('.thread').includes('Feito, mestre.')`));
  check('chamada de agente vira cartão com o tamanho do briefing', await ev(`__txt('.callcard').includes('Alpha') && __txt('.callcard').includes('briefing de 27 caracteres')`), await ev(`__txt('.callcard')`));
  check('chat do broker não mistura mensagens de agente', !(await ev(`__txt('.thread')`)).includes('Resposta numero'));
  check('painel explica o isolamento e conta briefings', (await ev(`__txt('#ctx')`)).includes('Os agentes não leem este chat') && (await ev(`__txt('#ctx')`)).includes('27 car.'));
  await ev(`document.querySelector('.callcard').click()`);
  check('clicar no cartão abre a conversa daquele agente', await until(`__txt('#list h2') === 'Agentes' && __txt('.head h1').includes('Alpha')`));

  // 14b2 — falar pelo app: o CLI de verdade (aqui, um CLI falso com o mesmo protocolo) em vez de só ler
  const logLines = () => (fs.existsSync(fakeLog) ? fs.readFileSync(fakeLog, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : []);
  const say = async (text) => { await ev(`__type('#cmp', ${JSON.stringify(text)})`); await ev(`__k('Enter')`); };
  await ev(`__blur(); __k('1', { ctrlKey: true })`);
  await until(`__txt('.head h1') === 'Broker' && !!document.querySelector('#cmp')`);
  check('compositor está habilitado (não é mais só leitura)', await ev(`!document.querySelector('#cmp').disabled && !!document.querySelector('.composer.chat select#c-mode')`));
  await say('oi broker');
  check('Enter envia e a resposta aparece em streaming', await until(`__txt('#live').includes('Olá do fake: oi broker') || __txt('.thread').includes('Olá do fake: oi broker')`, 8000), await ev(`__txt('.thread')`));
  check('depois de concluir, aparece uma vez só (transcript assume o lugar do ao vivo)', await until(`!document.querySelector('.composer.chat .stop:not([hidden])') && (__txt('.thread').match(/Olá do fake: oi broker/g) || []).length === 1`, 8000), await ev(`(__txt('.thread').match(/Olá do fake: oi broker/g) || []).length`));
  check('retoma a sessão existente (--resume) com as flags do protocolo', (() => { const a = logLines()[0].args; return a.includes('--resume') && a.includes(MAIN_ID) && a.includes('--permission-prompt-tool') && a.includes('stream-json') && a.includes('--permission-mode'); })(), JSON.stringify(logLines()[0]));

  await say('escrever arquivo');
  check('pedido de permissão aparece como cartão com a ferramenta e o alvo', await until(`!!document.querySelector('.permcard.ask') && __txt('.permcard').includes('Write') && __txt('.permcard').includes('/fx/a.txt')`, 8000), await ev(`__txt('#live')`));
  await ev(`document.querySelector('[data-perm=allow]').click()`);
  check('Permitir libera a ferramenta e o CLI continua', await until(`__txt('.thread').includes('arquivo criado') || __txt('#live').includes('arquivo criado')`, 8000));
  check('o CLI recebeu allow', logLines().some((l) => l.ctl === 'allow'));
  await until(`!document.querySelector('.composer.chat .stop:not([hidden])')`, 8000);
  await say('escrever de novo');
  await until(`!!document.querySelector('.permcard.ask')`, 8000);
  await ev(`document.querySelector('[data-perm=deny]').click()`);
  check('Negar chega ao CLI como deny', await until(`true`) && (await (async () => { for (let i = 0; i < 60; i++) { if (logLines().some((l) => l.ctl === 'deny')) return true; await sleep(100); } return false; })()));
  await until(`!document.querySelector('.composer.chat .stop:not([hidden])')`, 8000);

  await ev(`__type('#cmp', '/ka'); document.querySelector('#cmp').dispatchEvent(new Event('input', { bubbles: true }))`);
  check('"/" abre o menu de comandos com os do CLI', await until(`!document.querySelector('#slashmenu').hidden && __txt('#slashmenu').includes('/karma')`), await ev(`__txt('#slashmenu')`));
  await ev(`__k('Tab')`);
  check('Tab completa o comando', (await ev(`document.querySelector('#cmp').value`)) === '/karma ');
  await ev(`__k('Enter')`);
  check('comando vai para o CLI como texto (/karma)', await until(`__txt('.thread').includes('comando karma recebido') || __txt('#live').includes('comando karma recebido')`, 8000) && logLines().some((l) => typeof l.user === 'string' && l.user.startsWith('/karma')));
  await until(`!document.querySelector('.composer.chat .stop:not([hidden])')`, 8000);

  await say('demorar muito');
  check('durante a resposta aparece o botão Parar', await until(`!!document.querySelector('.composer.chat .stop:not([hidden])')`, 8000), await ev(`document.querySelector('#live').innerText.slice(-200) + ' | ' + document.querySelector('.composer.chat .crow').outerHTML.slice(0, 400)`));
  await ev(`__k('Escape')`);
  check('Esc interrompe e volta ao normal', await until(`!document.querySelector('.composer.chat .stop:not([hidden])') && __txt('#live').includes('Interrompido')`, 8000) && logLines().some((l) => l.ctlreq === 'interrupt'));

  await ev(`(() => { const s = document.querySelector('#c-mode'); s.value = 'acceptEdits'; s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  check('trocar o modo de permissão chega ao CLI sem reiniciar', await (async () => { for (let i = 0; i < 60; i++) { if (logLines().some((l) => l.ctlreq === 'set_permission_mode' && l.mode === 'acceptEdits')) return true; await sleep(100); } return false; })());
  await ev(`(() => { const s = document.querySelector('#c-mode'); s.value = 'bypassPermissions'; s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  check('"Pular permissões" exige confirmação', await until(`!!document.querySelector('.confirm-ov')`));
  await ev(`document.querySelector('.confirm [data-r="0"]').click()`);
  check('cancelar a confirmação mantém o modo seguro', await until(`!document.querySelector('.confirm-ov')`) && !logLines().some((l) => l.mode === 'bypassPermissions'));

  await ev(`document.querySelector('[data-act=chat-new]').click()`);
  check('Nova conversa abre um chat vazio na pasta escolhida', await until(`__txt('.head h1') === 'Nova conversa' && !!document.querySelector('#cmp')`));
  const before = logLines().length;
  await say('primeira mensagem nova');
  check('conversa nova sobe o CLI sem --resume', await (async () => { for (let i = 0; i < 80; i++) { const a = logLines().slice(before).find((l) => l.args); if (a) return !a.args.includes('--resume') && a.args.includes('--include-partial-messages'); await sleep(100); } return false; })());
  check('e responde ao vivo', await until(`__txt('#live').includes('Olá do fake: primeira mensagem nova') || __txt('.thread').includes('Olá do fake: primeira mensagem nova')`, 8000));
  await until(`!document.querySelector('.composer.chat .stop:not([hidden])')`, 8000);
  await ev(`[...document.querySelectorAll('#list .item')].find((i) => i.textContent.includes('proj')).click()`);
  await until(`__txt('.head h1') === 'Broker'`);

  // 14c — organograma: agentes + neurônios (memória própria, briefings recebidos) + memória compartilhada
  await ev(`__blur(); __k('4', { ctrlKey: true })`);
  check('Ctrl+4 abre o organograma com canvas', await until(`__txt('#list h2') === 'Organograma' && !!document.querySelector('#brain')`));
  await sleep(500);
  const st = await ev(`Brain._stats()`);
  check('organograma tem os 2 agentes e a hierarquia', st.agents === 2 && st.edges >= 1, JSON.stringify(st));
  check('neurônios = itens de memória + briefings reais', st.neurons >= 4, JSON.stringify(st));
  check('memória compartilhada aparece como nuvem', st.shared >= 1, JSON.stringify(st));
  const hit = await ev(`(() => { const n = Brain._neurons().find((q) => q.m.text.includes('item um')); const p = Brain._toScreen(n); const r = document.querySelector('#brain').getBoundingClientRect(); return { x: r.left + p.x, y: r.top + p.y }; })()`);
  await ev(`(() => { const c = document.querySelector('#brain'); const o = { clientX: ${hit.x}, clientY: ${hit.y}, bubbles: true }; c.dispatchEvent(new MouseEvent('mousedown', o)); window.dispatchEvent(new MouseEvent('mouseup', o)); return true; })()`);
  check('clicar num neurônio mostra o texto da memória', await until(`__txt('#ctx').includes('item um')`), await ev(`__txt('#ctx')`));
  await ev(`__blur(); __k('2', { ctrlKey: true })`);
  check('sair do organograma para o canvas parar', await until(`!document.querySelector('#brain')`));
  await ev(`[...document.querySelectorAll('#list .item')].find((i) => i.textContent.includes('Beta')).click()`);
  await ev(`__blur(); __k('6', { ctrlKey: true })`);
  await until(`__txt('#list h2') === 'Memória geral'`);

  // 14c2 — conversa limpa sem projeto vai para a Área de Trabalho
  await ev(`__blur(); __k('1', { ctrlKey: true })`);
  await until(`!!document.querySelector('[data-act=chat-noproj-new]')`);
  await ev(`document.querySelector('[data-act=chat-new]').click()`);
  check('em conversa nova com pasta de projeto aparece "sem projeto"', await until(`!!document.querySelector('[data-act=chat-noproj]')`));
  await ev(`document.querySelector('[data-act=chat-noproj]').click()`);
  check('tirar o projeto troca a pasta para a Área de Trabalho', await until(`__txt('.dirchip').includes('Área de Trabalho') && !document.querySelector('[data-act=chat-noproj]')`), await ev(`__txt('.composer.chat .cbar')`));
  const nb = logLines().length;
  await say('conversa limpa');
  check('o CLI sobe com a Área de Trabalho como pasta (sem --resume)', await (async () => { for (let i = 0; i < 80; i++) { const a = logLines().slice(nb).find((l) => l.args); if (a) return !a.args.includes('--resume') && path.resolve(a.cwd).toLowerCase() === path.resolve(otherDir).toLowerCase(); await sleep(100); } return false; })(), JSON.stringify(logLines().slice(nb)));
  await until(`!document.querySelector('.composer.chat .stop:not([hidden])')`, 8000);
  await ev(`[...document.querySelectorAll('#list .item')].find((i) => i.textContent.includes('faz a feature')) && [...document.querySelectorAll('#list .item')].find((i) => i.textContent.includes('faz a feature')).click()`);
  await until(`__txt('.head h1') === 'Broker'`);

  // 14c3 — colar imagem; atualização do transcript não recarrega a tela nem tira o cursor
  await ev(`__blur(); __k('1', { ctrlKey: true })`);
  await until(`__txt('.head h1') === 'Broker' && !!document.querySelector('#cmp')`);
  await ev(`(() => { const dt = new DataTransfer(); const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0)); dt.items.add(new File([bytes], 'x.png', { type: 'image/png' })); const ta = document.querySelector('#cmp'); ta.focus(); ta.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); return true; })()`);
  check('colar imagem (Ctrl+V) anexa uma miniatura', await until(`document.querySelectorAll('#attach .thumb').length === 1 && !document.querySelector('#attach').hidden`));
  await say('veja esta imagem');
  check('a imagem aparece na mensagem enviada e o anexo é limpo', await until(`!!document.querySelector('.mimg') && document.querySelectorAll('#attach .thumb').length === 0`, 4000));
  check('o CLI recebe a imagem como bloco base64', await (async () => { for (let i = 0; i < 80; i++) { if (logLines().some((l) => l.images === 1 && l.user === 'veja esta imagem')) return true; await sleep(100); } return false; })(), JSON.stringify(logLines().slice(-3)));
  await until(`!document.querySelector('.composer.chat .stop:not([hidden])')`, 8000);

  await ev(`(() => { const ta = document.querySelector('#cmp'); ta.focus(); ta.value = 'rascunho em andamento'; ta.setSelectionRange(5, 5); ta.dispatchEvent(new Event('input', { bubbles: true })); const th = document.querySelector('.thread'); th.__m = 't'; document.querySelector('.composer.chat').__m = 'c'; th.scrollTop = 30; window.__st = th.scrollTop; return true; })()`);
  fs.appendFileSync(mainFile, JSON.stringify({ type: 'assistant', timestamp: new Date().toISOString(), message: { role: 'assistant', model: 'claude-x', content: [{ type: 'text', text: 'novidade vinda do transcript' }] } }) + '\n');
  check('conteúdo novo do transcript aparece sozinho', await until(`__txt('.thread').includes('novidade vinda do transcript')`, 10000));
  check('compositor mantém foco, texto e posição do cursor', await ev(`document.activeElement.id === 'cmp' && document.querySelector('#cmp').value === 'rascunho em andamento' && document.querySelector('#cmp').selectionStart === 5 && document.querySelector('.composer.chat').__m === 'c'`));
  check('a tela não é recriada e a rolagem é mantida', await ev(`document.querySelector('.thread').__m === 't' && (document.querySelector('.thread').scrollTop === window.__st || document.querySelector('.thread').scrollHeight <= document.querySelector('.thread').clientHeight)`));
  await ev(`document.querySelector('#cmp').value = ''; document.querySelector('#cmp').blur(); true`);

  // 14d — projetos: pastas registradas separam o contexto
  await ev(`__blur(); __k('7', { ctrlKey: true })`);
  check('Ctrl+7 abre Projetos', await until(`__txt('#list h2') === 'Projetos'`));
  await ev(`document.querySelector('[data-act=proj-add]').click()`);
  check('adicionar pasta cria o projeto e ativa o filtro', await until(`__txt('.head h1') === 'proj' && !!document.querySelector('#list .item.on[data-proj]:not([data-proj=""])')`, 8000), await ev(`__txt('.head h1')`));
  check('projeto fica salvo em disco', fs.existsSync(path.join(tmp, 'userdata', 'projects.json')) && fs.readFileSync(path.join(tmp, 'userdata', 'projects.json'), 'utf8').includes('proj'));
  await ev(`__blur(); __k('1', { ctrlKey: true })`);
  await until(`__txt('#list h2') === 'Broker'`);
  check('com projeto ativo, o Broker mostra só as conversas dele', await until(`!!document.querySelector('.projbar') && !__txt('#list').includes('conversa alheia') && __txt('#list').includes('faz a feature')`), await ev(`__txt('#list')`));
  await ev(`__blur(); __k('3', { ctrlKey: true })`);
  check('execuções de outras pastas somem da Cadeia', await until(`__txt('#list h2') === 'Cadeia' && document.querySelectorAll('#list .item').length === 0`), await ev(`document.querySelectorAll('#list .item').length`));
  await ev(`document.querySelector('.projbar [data-proj]').click()`);
  check('"Todos os projetos" devolve o contexto completo', await until(`!document.querySelector('.projbar') && document.querySelectorAll('#list .item').length >= 1`));
  await ev(`__blur(); __k('1', { ctrlKey: true })`);
  check('e o Broker volta a listar as duas conversas', await until(`__txt('#list').includes('conversa alheia') && __txt('#list').includes('faz a feature')`));
  await ev(`__blur(); __k('7', { ctrlKey: true })`);
  await ev(`document.querySelector('#list .item[data-proj]:not([data-proj=""])').click()`);
  await until(`!!document.querySelector('[data-act=proj-chat]')`);
  await ev(`document.querySelector('[data-act=proj-chat]').click()`);
  check('"Nova conversa aqui" abre chat na pasta do projeto', await until(`__txt('.head h1') === 'Nova conversa' && __txt('.head .chip').includes('proj')`), await ev(`__txt('.head')`));
  await ev(`__blur(); __k('7', { ctrlKey: true })`);
  await until(`!!document.querySelector('[data-act=proj-del]')`);
  await ev(`document.querySelector('[data-act=proj-del]').click()`);
  await until(`!!document.querySelector('.confirm-ov')`);
  await ev(`document.querySelector('.confirm [data-r="1"]').click()`);
  check('remover o projeto não apaga nada e limpa o filtro', await until(`!document.querySelector('#list .item[data-proj]:not([data-proj=""])')`) && fs.existsSync(projDir));
  await ev(`__blur(); __k('2', { ctrlKey: true })`);
  await ev(`[...document.querySelectorAll('#list .item')].find((i) => i.textContent.includes('Beta')).click()`);
  await ev(`__blur(); __k('6', { ctrlKey: true })`);
  await until(`__txt('#list h2') === 'Memória geral'`);

  // 15 — lembra onde você estava ao reabrir
  await sleep(400);
  await ev(`location.reload()`);
  await until(`document.readyState === 'complete' && !!window.desk`);
  await setup();
  check('ao reabrir, volta para a última tela', await until(`__txt('#list h2') === 'Memória geral'`, 8000));
  await ev(`__blur(); __k('2', { ctrlKey: true })`);
  check('e para o último agente escolhido', await until(`__txt('.head h1') === 'Beta'`, 8000), await head());

  // 16 — posição/tamanho da janela são gravados
  win.setBounds({ x: 120, y: 90, width: 1180, height: 760 });
  await sleep(700);
  win.close();
  await sleep(300);
  const ws = path.join(tmp, 'userdata', 'window-state.json');
  const saved = fs.existsSync(ws) ? JSON.parse(fs.readFileSync(ws, 'utf8')) : {};
  check('tamanho e posição da janela são lembrados', saved.width === 1180 && saved.height === 760, JSON.stringify(saved));
}

app.whenReady().then(async () => {
  try { await run(); } catch (e) { fail++; console.log(`FAIL - erro inesperado: ${e.stack || e}`); }
  console.log(`\n${fail === 0 ? 'e2e: all checks passed' : 'e2e: FAILED'} (${pass} ok, ${fail} falhas)`);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
  app.exit(fail === 0 ? 0 : 1);
});
