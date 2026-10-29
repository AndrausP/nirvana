# Changelog

All notable changes to Nirvana. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project uses [Semantic Versioning](https://semver.org/).

## [2.2.0] - 2026-10-29

### Added
- Claude Code plugin: install with `/plugin marketplace add AndrausP/nirvana` and
  `/plugin install nirvana@nirvana`. The repo root is both the marketplace and the plugin;
  commands become `/nirvana:light`, `/nirvana:bigtask`, and so on. The install scripts keep
  working.
- `tests/plugin.sh` and a CI job that validate the plugin and install it into a throwaway config.
- MIT `LICENSE` file (the README already declared MIT).
- `CONTRIBUTING.md`, issue forms and a pull request template.
- User guide in `docs/guide/`: how it works, commands, configuration (including manual uninstall).

### Changed
- README rewritten as a short landing page; the detailed reference moved to `docs/guide/`.
- `/light` reads templates from the plugin folder when installed as a plugin, and from
  `~/.claude/nirvana-templates/` otherwise.

## [2.1.0] - 2026-10-23

### Added
- Session counter in `.claude/state.local.json` (per machine, gitignored): the banner hook asks
  Claude to run `/reflect` every `sync.every` sessions, and `/reflect` resets it.
- Auto-compact threshold applied for real: `/light` writes `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` (or
  `DISABLE_AUTO_COMPACT`) to the `env` block of `.claude/settings.json`.
- After a compaction, the hook tells the Writer to record what the session learned and reindex
  graphify.
- Tests (`tests/`) and GitHub Actions CI on Ubuntu, macOS and Windows PowerShell 5.1.

## [2.0.1] - 2026-10-23

### Added
- `update.ps1` / `update.sh` and a version marker (`~/.claude/nirvana-templates/.nirvana-version`).

### Fixed
- SessionStart hook errored when the banner script was missing or Claude Code started in a
  subfolder; it now resolves paths from `CLAUDE_PROJECT_DIR` and skips quietly.
- Banner picked the latest sprint by name instead of by number (`sprint-10` vs `sprint-2`).
- Windows installer wrote files with a BOM, breaking `.sh` shebangs and `.md` frontmatter.
- `.ps1` scripts failed to parse when run with `-File` on Windows PowerShell 5.1; they are now
  ASCII-only.

## [2.0.0] - 2026-07-14

### Changed
- Replaced the 4-agent hub with a sequential 9-role chain: Product Owner, Tech Lead, Architect,
  Dev Backend, Dev Frontend, Designer, QA, Reader, Writer.
- Memory moved from per-agent files to a shared, graphify-indexed `docs/knowledge/`.
- `/light` merges its protocol into the project's own `CLAUDE.md` instead of a separate
  `BEHAVIOR.md`.

### Added
- Sprints and tasks as files in `docs/sprints/` and `docs/tasks/`.
- SessionStart banner hook and opt-in live chain view (`/chat`).

### Fixed
- Installers now ship `templates/` too, so `/light` works outside this repo.

## [1.0.0] - 2026-05-18

### Added
- First release: `/light`, `/bigtask`, `/smalltask`, `/reflect`, `/law`, `/path`, `/karma`,
  installers for Windows and macOS/Linux, and replies in the user's language.

[2.2.0]: https://github.com/AndrausP/nirvana/releases/tag/v2.2.0
