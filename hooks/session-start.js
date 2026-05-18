#!/usr/bin/env node
// session-start.js — learning-agent SessionStart hook
// Reads ~/.claude/agents-memory/*.md, extracts key info, injects as context

const fs = require('fs');
const path = require('path');
const os = require('os');

// ── ASCENSION BANNER ────────────────────────────────────────────────────────
const P  = '\x1b[35m';   // purple
const R  = '\x1b[91m';   // bright red
const B  = '\x1b[1m';    // bold
const D  = '\x1b[2m';    // dim
const RS = '\x1b[0m';    // reset

const banner = [
  '',
  `${B}${P}╔══════════════════════════════════════════════╗${RS}`,
  `${B}${P}║${RS}   ${B}${R}⚔  T H E  A S C E N S I O N  P R O T O C O L  ⚔${RS}   ${B}${P}║${RS}`,
  `${B}${P}║${RS}  ${D}${P}/invoke /inscribe /gaze /forge /chronicle${RS}  ${B}${P}║${RS}`,
  `${B}${P}╚══════════════════════════════════════════════╝${RS}`,
  '',
].join('\n');

process.stderr.write(banner);
// ────────────────────────────────────────────────────────────────────────────

const MAX_AGENTS = 20;
const SECTION_DISPLAY_COUNT = 2; // entries shown per section in context
const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const memDir = path.join(claudeDir, 'agents-memory');

// FIX temporal-drift: sections with PT-BR + EN aliases so renamed sections still match
const SECTION_ALIASES = {
  'Erros conhecidos':       ['Erros conhecidos', 'Known errors', 'Errors'],
  'Decisões tomadas':       ['Decisões tomadas', 'Decisions', 'Decisions made'],
  'Pendências':             ['Pendências', 'Pending', 'Todo']
};

function extractSection(content, sectionName) {
  const aliases = SECTION_ALIASES[sectionName] || [sectionName];

  for (const alias of aliases) {
    const regex = new RegExp(`## ${alias}([\\s\\S]*?)(?=\\n## |$)`, 'i');
    const match = content.match(regex);
    if (!match) continue;

    const entries = match[1]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 5 && !l.startsWith('#'))
      .map(l => l.replace(/^[-*]\s*/, '').substring(0, 100))
      .filter(l => l.length > 0);

    // FIX context-drift: reverse so NEWEST entries (appended last) are shown first
    return entries.reverse().slice(0, SECTION_DISPLAY_COUNT);
  }
  return [];
}

try {
  if (!fs.existsSync(memDir)) {
    process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
    process.exit(0);
  }

  // FIX security: verify each entry is a real file (not dir), cap at MAX_AGENTS
  const files = fs.readdirSync(memDir)
    .filter(f => {
      if (!f.endsWith('.md')) return false;
      try { return fs.statSync(path.join(memDir, f)).isFile(); } catch (_) { return false; }
    })
    .slice(0, MAX_AGENTS);

  if (files.length === 0) {
    process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
    process.exit(0);
  }

  const summaries = [];
  const warnings = [];

  for (const file of files) {
    try {
      const filePath = path.join(memDir, file);
      let raw = fs.readFileSync(filePath, 'utf8');

      // FIX encoding: handle UTF-16 LE BOM from Windows editors
      if (raw.charCodeAt(0) === 0xFFFD || raw.startsWith('﻿')) {
        raw = raw.slice(1);
      }

      if (!raw || raw.trim().length < 50) continue;

      // FIX security: sanitize agentName to prevent prompt injection via filename
      const agentName = file.replace('.md', '').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const parts = [];

      const errors    = extractSection(raw, 'Erros conhecidos');
      const decisions = extractSection(raw, 'Decisões tomadas');
      const pending   = extractSection(raw, 'Pendências');

      if (errors.length)    parts.push(`erros:${errors[0]}`);
      if (decisions.length) parts.push(`decisões:${decisions[0]}`);
      if (pending.length)   parts.push(`pendente:${pending[0]}`);

      if (parts.length > 0) {
        summaries.push(`${agentName} → ${parts.join(' | ')}`);
      }
    } catch (e) {
      // FIX silent-failure: warn user about corrupted files instead of silently skipping
      const agentName = file.replace('.md', '').replace(/[^a-zA-Z0-9_\-]/g, '_');
      warnings.push(`⚠ ${agentName}: arquivo corrompido ou ilegível — execute /la audit`);
    }
  }

  if (summaries.length === 0 && warnings.length === 0) {
    process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
    process.exit(0);
  }

  const lines = ['[AGENT MEMORY — learning-agent]'];
  if (summaries.length) lines.push(...summaries);
  if (warnings.length)  lines.push(...warnings);
  lines.push('Use /la flush to save session knowledge. Use /la audit to review full memory.');

  process.stdout.write(JSON.stringify({
    continue: true,
    suppressOutput: true,
    context: lines.join('\n')
  }));

} catch (e) {
  process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
}

process.exit(0);
