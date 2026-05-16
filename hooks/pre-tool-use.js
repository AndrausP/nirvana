#!/usr/bin/env node
// pre-tool-use.js — learning-agent PreToolUse hook
// Intercepts Agent calls, detects task type, alerts if wrong model selected

let input = '';

// FIX CRITICAL: own stdin timeout — don't rely solely on harness timeout
const stdinTimeout = setTimeout(() => {
  process.stdin.destroy();
}, 4500);

process.stdin.on('data', d => { input += d; });
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    // FIX MEDIUM: guard against JSON.parse("null") returning null
    const data = JSON.parse(input || '{}') || {};
    const toolName = data.tool_name || data.toolName || '';

    if (toolName !== 'Agent') {
      process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
      process.exit(0);
    }

    const toolInput = data.tool_input || data.toolInput || {};
    const prompt = toolInput.prompt || '';

    // Guard: no prompt = skip
    if (!prompt) {
      process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
      process.exit(0);
    }

    const promptLower = prompt.toLowerCase();
    const currentModel = (toolInput.model || '').toLowerCase();

    const haikuKeywords = [
      'summarize', 'summary', 'read', 'classify', 'route', 'list', 'count',
      'check', 'resume', 'verifica', 'lista', 'conta', 'lê', 'le memoria',
      'leia', 'descreva', 'identifique', 'mapeie'
    ];

    const opusKeywords = [
      'architect', 'architecture', 'design pattern', 'tradeoff', 'trade-off',
      'evaluate options', 'arquitetura', 'decisão complexa', 'complex decision'
    ];

    const matchedHaiku = haikuKeywords.filter(k => promptLower.includes(k));
    const matchedOpus = opusKeywords.filter(k => promptLower.includes(k));

    // Simple task with expensive model
    if (matchedHaiku.length >= 2 && !matchedOpus.length && currentModel !== 'haiku') {
      process.stdout.write(JSON.stringify({
        continue: true,
        context: `LEARNING-AGENT: Agent call parece task simples (keywords: ${matchedHaiku.slice(0, 3).join(', ')}). Considere adicionar model:"haiku" — ~20x mais barato que sonnet.`
      }));
      process.exit(0);
    }

    process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));

  } catch (e) {
    process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
  }
  process.exit(0);
});
