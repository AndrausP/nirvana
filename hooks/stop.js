#!/usr/bin/env node
// stop.js — learning-agent Stop hook
// Detects task completion signals (PT-BR + EN), suggests /la flush
// Throttled: max 1 suggestion per 5 minutes, per project (cwd-scoped)

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const crypto = require('crypto');

let input = '';

// FIX CRITICAL: own stdin timeout — don't rely solely on harness timeout
const stdinTimeout = setTimeout(() => { process.stdin.destroy(); }, 4500);

process.stdin.on('data', d => { input += d; });
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    // FIX MEDIUM: guard against null from JSON.parse
    const data = JSON.parse(input || '{}') || {};
    const lastOutput = data.response || data.output || data.message || data.text || '';

    if (!lastOutput || lastOutput.length < 100) {
      process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
      process.exit(0);
    }

    // FIX HIGH: remove own plugin output to prevent loop detection
    const stripped = lastOutput
      .replace(/LEARNING-AGENT:[^\n]*/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`\n]+`/g, '')
      .toLowerCase();

    const completionSignals = [
      'implementado', 'concluído', 'concluido', 'feito', 'finalizado',
      'pronto', 'entregue', '## conclusão', '## conclusao', 'checklist da sessão',
      'completed', 'done', 'implemented', 'finished', 'delivered',
      'checklist', '## conclusion', 'task complete'
    ];

    const matches = completionSignals.filter(s => stripped.includes(s));
    if (matches.length < 2) {
      process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
      process.exit(0);
    }

    // FIX MEDIUM: throttle is per-project (cwd hash) not global
    const cwd = process.env.CLAUDE_WORKING_DIR || process.cwd();
    const cwdHash = crypto.createHash('md5').update(cwd).digest('hex').slice(0, 8);

    const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
    const stateDir  = path.join(claudeDir, 'plugins', 'state');
    const stateFile = path.join(stateDir, `la-flush-${cwdHash}.json`);

    // FIX HIGH: isolated state ops — corrupted file = skip throttle, still suggest
    let shouldThrottle = false;
    try {
      if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });

      let lastTs = 0;
      try {
        if (fs.existsSync(stateFile)) {
          lastTs = (JSON.parse(fs.readFileSync(stateFile, 'utf8')) || {}).ts || 0;
        }
      } catch (_) { /* corrupted state — lastTs=0, throttle skipped */ }

      const now = Date.now();
      if (now - lastTs < 5 * 60 * 1000) {
        shouldThrottle = true;
      } else {
        // FIX HIGH: write before suggesting — reduces race window in multi-session
        fs.writeFileSync(stateFile, JSON.stringify({ ts: now, cwd }), 'utf8');
      }
    } catch (e) { /* state dir error — skip throttle, still suggest */ }

    if (shouldThrottle) {
      process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
      process.exit(0);
    }

    // suppressOutput: false — intentional, user must see this suggestion
    process.stdout.write(JSON.stringify({
      continue: true,
      suppressOutput: false,
      context: 'LEARNING-AGENT: Tarefa parece concluída. Execute /la flush para preservar conhecimento dos agentes antes de /compact.'
    }));

  } catch (e) {
    process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
  }
  process.exit(0);
});
