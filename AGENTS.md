# Agent instructions (cheddr-tic-tac-toe)

This project vendors **[addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)** for Cursor. Upstream docs: [docs/cursor-setup.md](https://github.com/addyosmani/agent-skills/blob/main/docs/cursor-setup.md).

## Always-on rules

These files live in [`.cursor/rules/`](.cursor/rules/) so Cursor can load them without pulling the entire skill pack into context:

- [`test-driven-development.md`](.cursor/rules/test-driven-development.md)
- [`incremental-implementation.md`](.cursor/rules/incremental-implementation.md)
- [`code-review-and-quality.md`](.cursor/rules/code-review-and-quality.md)

## On-demand skills

The rest of the pack is in [`.cursor/skills/`](.cursor/skills/) as `<skill-name>.md`. Attach the relevant file when the task fits (for example `spec-driven-development` before coding a feature, `frontend-ui-engineering` for UI work, `shipping-and-launch` before production).

## Personas and references

- [`.cursor/agents/`](.cursor/agents/) — `code-reviewer`, `test-engineer`, `security-auditor` for structured reviews.
- [`.cursor/references/`](.cursor/references/) — testing, security, performance, and accessibility checklists.

## Lifecycle map

Upstream maps work to phases (Define → Plan → Build → Verify → Review → Ship). In Cursor, mirror that by attaching skills from `.cursor/skills/` when needed. Slash commands such as `/spec` and `/plan` are **Claude Code** entry points; here, open or `@`-mention the matching skill file instead.
