# Repository guidance

- Maintain Ideas as a dual-client plugin for Claude Code and Codex.
- Keep `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, `package.json`, the changelog,
  and the contract-test version pin on the same semantic version.
- Keep skill frontmatter compatible with Codex: only supported fields, and each skill name must
  match its folder name.
- Use host-neutral procedure wording. Document Claude slash commands and Codex `$` skill mentions
  at user-facing invocation points.
- Resolve bundled agent and cross-skill references relative to the active `SKILL.md`; Codex does
  not register files under `agents/` as named agents automatically.
- Run `node --test tests/*.test.js`, both plugin validators, and the Codex skill validator before
  releasing.
- Release with an immutable plain `v<version>` tag, then update both catalogs in
  `qa-claude-market` to that tag and commit SHA.
