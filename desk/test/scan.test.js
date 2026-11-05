// Testa saveAgent/agentRaw/writeTextFile num HOME temporário (nunca toca ~/.claude real).
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'deskhome-'));
process.env.USERPROFILE = home;
process.env.HOME = home;
fs.mkdirSync(path.join(home, '.claude', 'agents'), { recursive: true });
const orig = [
  '---',
  'name: Heitor',
  'description: Use this agent: tech lead, breaks tasks, "viability"',
  'tools: Read, Write',
  'model: opus',
  '---',
  '',
  '# Heitor — Tech Lead',
  '',
  'Regra 1.',
  '',
].join('\n');
fs.writeFileSync(path.join(home, '.claude', 'agents', 'heitor.md'), orig);

const scan = require(path.join(__dirname, '..', 'lib', 'scan.js'));
const backups = path.join(home, 'bk');

(async () => {
  const raw = await scan.agentRaw('heitor');
  assert.strictEqual(raw.name, 'Heitor');
  assert.strictEqual(raw.personality, '');
  assert.ok(raw.behavior.includes('Regra 1.'));

  await scan.saveAgent('heitor', { name: 'Heitor: o Lead', description: 'Quando: usar "isto", ok', personality: 'Direto e cético.', behavior: raw.behavior + '\nRegra 2.' }, backups);

  const after = fs.readFileSync(path.join(home, '.claude', 'agents', 'heitor.md'), 'utf8');
  assert.ok(after.includes('tools: Read, Write'), 'preserva tools');
  assert.ok(after.includes('model: opus'), 'preserva model');
  const raw2 = await scan.agentRaw('heitor');
  assert.strictEqual(raw2.name, 'Heitor: o Lead');
  assert.strictEqual(raw2.description, 'Quando: usar "isto", ok');
  assert.strictEqual(raw2.personality, 'Direto e cético.');
  assert.ok(raw2.behavior.includes('Regra 2.'));

  // defs enxergam a personalidade e o nome novo
  const defs = await scan.loadAgentDefs();
  assert.strictEqual(defs[0].name, 'Heitor: o Lead');
  assert.strictEqual(defs[0].personality, 'Direto e cético.');

  // backup do original existe e é idêntico
  const bks = fs.readdirSync(backups);
  assert.strictEqual(bks.length, 1);
  assert.strictEqual(fs.readFileSync(path.join(backups, bks[0]), 'utf8'), orig);

  // limpar personalidade remove o bloco
  await scan.saveAgent('heitor', { name: 'Heitor', description: raw2.description, personality: '', behavior: raw2.behavior }, backups);
  const raw3 = await scan.agentRaw('heitor');
  assert.strictEqual(raw3.personality, '');
  assert.ok(!fs.readFileSync(path.join(home, '.claude', 'agents', 'heitor.md'), 'utf8').includes('nirvana-desk:personality'));

  // slug malicioso é rejeitado
  await assert.rejects(() => scan.agentRaw('../x'));
  await assert.rejects(() => scan.saveAgent('..\\x', { name: 'a' }, backups));
  // nome vazio é rejeitado
  await assert.rejects(() => scan.saveAgent('heitor', { name: '  ' }, backups));

  // arquivo de memória: backup + escrita
  const f = path.join(home, 'mem.md');
  fs.writeFileSync(f, 'antigo');
  const r = await scan.writeTextFile(f, 'novo', backups);
  assert.strictEqual(fs.readFileSync(f, 'utf8'), 'novo');
  assert.strictEqual(fs.readFileSync(r.backup, 'utf8'), 'antigo');

  console.log('TODOS OS TESTES PASSARAM (8 grupos)');
  fs.rmSync(home, { recursive: true, force: true });
})().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
