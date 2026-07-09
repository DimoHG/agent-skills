# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Cursor, Copilot, etc.) when working with code in this repository.

## Repository Overview

A collection of agentskills.io-compliant skills for AI coding agents working with Redis. Each skill is a focused, spec-compliant directory under [skills/](skills/):

- [redis-core](skills/redis-core/) — data structures, key naming, memory/TTL, atomic primitives, JSON vs Hash, Streams vs Pub/Sub
- [redis-connections](skills/redis-connections/) — pooling, multiplexing, pipelining, client-side caching, timeouts
- [redis-search](skills/redis-search/) — FT.CREATE / FT.SEARCH / FT.AGGREGATE / FT.HYBRID, schema design, HNSW vs FLAT, hybrid retrieval, RAG
- [redis-semantic-cache](skills/redis-semantic-cache/) — LangCache for LLM response caching
- [redis-clustering](skills/redis-clustering/) — hash tags, multi-key ops, read replicas
- [redis-security](skills/redis-security/) — AUTH, TLS, ACLs, network exposure, command renaming
- [redis-observability](skills/redis-observability/) — INFO, SLOWLOG, MEMORY DOCTOR, FT.PROFILE, Redis Insight

## Skill Format

All skills follow the [agentskills.io specification](https://agentskills.io/specification):

```
skills/<skill-name>/
├── SKILL.md          # Required: YAML frontmatter (name, description, license, metadata) + agent-facing instructions
├── references/       # Optional: long-form content loaded on demand (one file per topic)
├── scripts/          # Optional: executable code agents may invoke
├── assets/           # Optional: static resources (templates, schemas, images)
├── evals/            # Internal: eval suites used by this repo's tooling, not by agents at runtime
└── .cursor-plugin/   # Per-skill Cursor plugin manifest (so the skill can be published as a Cursor plugin)
```

Use [skills/redis-core/](skills/redis-core/) as the reference layout. Editorial convention across this repo: keep `SKILL.md` under ~150 lines with summary tables and key principles inline; move full Python/Java code samples into `references/<topic>.md` (one file per source rule). The agent loads `SKILL.md` once on activation; reference files are loaded only when the task requires them.

## Adding a New Skill

1. Create `skills/<skill-name>/SKILL.md` with the required frontmatter:
   ```yaml
   ---
   name: <skill-name>
   description: <one paragraph that includes the trigger phrases agents should match on>
   license: MIT
   metadata:
     author: <organization>
     version: "0.1.0"
   ---
   ```
2. Add long-form examples under `references/`.
3. If the skill needs internal eval coverage, add `evals/<suite-name>/{evals.json, model-matrix.json}`.
4. Create `.cursor-plugin/plugin.json` (`name`, `version`, `description`, `license`, `keywords` — see any existing skill).
5. To publish via the marketplaces:
   - Claude Code: symlink the new skill into `plugins/redis-development/skills/`.
   - Cursor: add an entry to `.cursor-plugin/marketplace.json` pointing at `<skill-name>`.
6. Validate: `npm run validate` (covers plugin manifests + agentskills.io spec).

## Versioning (every content change)

**If you change what a skill ships, bump its version in the same PR.** This is
what tells the Cursor and Claude Code marketplaces there is a new release —
without it, existing users stay pinned to the old copy. CI enforces this: a PR
that edits shipped skill content without a version bump fails
`npm run check:version-bump`.

Don't hand-edit the version fields — a version lives in several files and they
must stay in sync. Use the helper, which updates all of them at once:

```bash
npm run bump -- <skill-name> [patch|minor|major]   # default: patch
```

It bumps, for `<skill-name>`:
- `skills/<skill-name>/SKILL.md` frontmatter `metadata.version`
- `skills/<skill-name>/.cursor-plugin/plugin.json` `version`
- the `<skill-name>` entry in `.cursor-plugin/marketplace.json`
- both bundle versions: `.cursor-plugin/marketplace.json` and
  `.claude-plugin/marketplace.json` `metadata.version` (+ the
  `redis-development` entry — the only update signal Claude Code has, since it
  ships every skill as one plugin).

Pick the level by impact: `patch` for fixes/wording, `minor` for new
guidance/references, `major` for breaking reorganizations. Editing only
`evals/` does **not** require a bump (evals are internal tooling, not shipped).

After the PR merges, publishing differs per marketplace:
- **Claude Code** pulls from git — users get it via `/plugin marketplace update`.
- **Cursor's public listing** does *not* auto-pull. The listing owner must
  re-submit the repo at [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish);
  Cursor manually reviews each update.

## Running Validators

```bash
npm run validate                   # plugin manifests + agentskills.io spec validation
npm run validate:skill-structure   # spec validation only (across all skills)
npm run validate:plugins           # claude + cursor plugin manifests only
```

`validate` is wired into the husky pre-commit hook and runs in CI on every PR.

## Running Evals

```bash
# Run the eval suite for a single skill
npm run eval -- --skill <skill-name> --suite <suite-name>

# Re-aggregate an existing iteration
npm run eval:aggregate -- --skill <skill-name> --suite <suite-name>

# Promote an iteration as the committed baseline
npm run eval:baseline -- --skill <skill-name> --suite <suite-name> --iteration iteration-1
```

Per-skill eval suites live under `skills/<skill-name>/evals/<suite-name>/`. The eval workspace output is written to `eval-workspaces/` (gitignored).
