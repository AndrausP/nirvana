# Contributing to Nirvana

Thanks for helping! Bug reports, docs fixes and new ideas are all welcome.

- **Found a bug?** [Open an issue](https://github.com/AndrausP/nirvana/issues/new/choose) with
  your OS, shell and Nirvana version (`~/.claude/nirvana-templates/.nirvana-version`).
- **Have an idea?** Open a feature request first, so we can agree on the shape before you code.
- **Sending a pull request?** Read the rules below and run the tests — CI runs the same ones.

## How the repo is laid out

```
nirvana/
├── install.ps1 / install.sh    ← installers (Windows / macOS + Linux)
├── update.ps1 / update.sh      ← updaters
├── skills/<name>/SKILL.md      ← the 7 slash commands, installed to ~/.claude/skills/
├── templates/                  ← what /light copies into a project, installed to ~/.claude/nirvana-templates/
│   ├── BEHAVIOR.md             ← source of the NIRVANA:START/END block merged into CLAUDE.md
│   ├── state.json
│   ├── agents/                 ← one spec per role
│   ├── docs/                   ← docs/ skeleton (knowledge, sprints, tasks)
│   └── hooks/                  ← SessionStart banner hook (.ps1 and .sh)
├── tests/                      ← lint, hook and installer tests
├── .github/workflows/ci.yml    ← runs tests/ on Ubuntu, macOS and Windows
├── docs/guide/                 ← user documentation
└── CLAUDE.md, docs/, .claude/  ← Nirvana running on its own repo (dogfood)
```

`/light` runs inside the user's project, not inside this repo, so it reads templates from
`~/.claude/nirvana-templates/` — that's why the installers mirror the whole `templates/` tree.

## Running the tests

```bash
bash tests/lint.sh      # JSON, ASCII-only .ps1, LF .sh, shellcheck, installer lists, version
bash tests/hook.sh      # SessionStart hook: banner, session counter, compaction notice
bash tests/install.sh   # install.sh + update.sh into a throwaway HOME
```

```powershell
powershell -ExecutionPolicy Bypass -File tests\hook.ps1
powershell -ExecutionPolicy Bypass -File tests\install.ps1
```

The install tests never touch your real `~/.claude`: they serve this checkout over a local HTTP
server (`tests/serve.py`, same `charset=utf-8` as GitHub raw) and point the installers at it with
`NIRVANA_REPO_RAW`. You need Python 3 for them; shellcheck is optional locally but required in CI.

## Rules the tests enforce

- **`.ps1` files are ASCII-only.** Windows PowerShell 5.1 reads a BOM-less `.ps1` as ANSI, so a
  single em dash breaks parsing.
- **`.sh` files use LF line endings** (`.gitattributes` handles it on checkout).
- **Adding a skill or template?** Add it to the `SKILLS` / `TEMPLATE_FILES` lists in all four
  installers (`install.ps1`, `install.sh`, `update.ps1`, `update.sh`).
- **Changing the hook?** Edit `templates/hooks/` and copy the file over `.claude/hooks/` (the
  dogfood copy must match).
- **Changing the hook command?** Keep `.claude/settings.json` and `skills/light/SKILL.md` in sync.
- **Bumping the version?** Change it in the four installers and `templates/state.json` (plus
  `.claude/state.json` and `docs/guide/configuration.md`), and add an entry to `CHANGELOG.md`.

## Commits and pull requests

- [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`,
  `refactor:`, `test:`, `ci:`, `chore:`.
- One topic per pull request. Describe what changed, why, and how you tested it.
- If you change user-facing behavior, update the docs in `docs/guide/` and `CHANGELOG.md` in the
  same pull request.

## Language

User-facing docs are in English. Part of the agent protocol and the dogfood `docs/knowledge/`
are in Portuguese; Nirvana answers in whatever language the user writes in.

## License

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
