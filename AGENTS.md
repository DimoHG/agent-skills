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

## Spec-Driven Workflow

For non-trivial changes — new skills, restructuring, multi-file edits, new client references — write a numbered spec in [`/spec/`](spec/) first, iterate with reviewers, then implement. Trivial changes (typo fixes, single-line edits, renames) can go straight to code.

Conventions:

- **Filename:** `NNNN-kebab-topic.md` (zero-padded, sequential).
- **Sections expected:** problem, goals, non-goals, current-state inventory, proposed changes, cross-cutting decisions, acceptance criteria, open questions, follow-ups, iteration log.
- **Iteration log:** each meaningful revision logged with a date and one-line summary, so design history is traceable in-file.
- **Cross-references:** specs that depend on or supersede earlier specs cite them by number.

The `redis-search` skill is the product of specs 0001–0007; [`spec/0007-redis-search-skill-consolidation.md`](spec/0007-redis-search-skill-consolidation.md) is the layout authority for that skill.

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
