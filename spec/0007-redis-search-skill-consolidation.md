# Spec 0007 — Consolidate Redis Search into a single `redis-search` skill

| Field | Value |
|-------|-------|
| Status | Draft |
| Author | Adriano Amaral |
| Created | 2026-05-28 |
| Skill | `skills/redis-search` (new, proposed) |
| Scope | New skill directory + retirement of `skills/redis-query-engine/` and `skills/redis-vector-search/`. Marketplace updates. Migration of all spec 0001–0006 work into the new skill. |
| Supersedes | The "Redis Search Skill — Specific Directives" section of repo `CLAUDE.md` (rule-template workflow). Layout/format portions of [`0001-search-syntax-coverage.md`](0001-search-syntax-coverage.md), [`0002-redis-py-client-reference.md`](0002-redis-py-client-reference.md), [`0003-jedis-client-reference.md`](0003-jedis-client-reference.md), [`0004-redisvl-client-reference.md`](0004-redisvl-client-reference.md). **Content** in those specs is preserved; only the **target structure** is updated. |
| Extends | [`0005-search-syntax-failure-catalog.md`](0005-search-syntax-failure-catalog.md), [`0006-search-residual-failure-classes.md`](0006-search-residual-failure-classes.md) — both target rules that this spec relocates. |
| Source data | Upstream `skills/redis-query-engine/` and `skills/redis-vector-search/` as of `origin/main@5ca2e1a`. Work-in-progress branch `adriano-search-new-skills-set` at `1cda0b7`. |

---

## 1. Problem Statement

Between specs 0001–0006 and the upstream repo's recent restructure (commit `18da4e4`, "Retire legacy redis-development skill and compiler"), Redis Search content now lives in three uncoordinated places:

1. **Upstream `skills/redis-query-engine/`** — 1 SKILL.md + 6 references covering `FT.CREATE`, field types, dialect, index management, query optimization, `SKIPINITIALSCAN`. Built by the maintainers.
2. **Upstream `skills/redis-vector-search/`** — 1 SKILL.md + 4 references covering HNSW/FLAT, vector index creation, hybrid search, RAG. Built by the maintainers. Already includes a "this skill builds on `redis-query-engine`" cross-link, indicating the split is artificial.
3. **Branch `adriano-search-new-skills-set`** — 13 new `search-*` rules + edits to 4 `vector-*` rules + 3 client references (`python-redis-py.md`, `java-jedis.md`, `python-redisvl.md`) authored against the now-retired `skills/redis-development/` layout.

The three sets overlap (e.g. all three have an "index creation" doc; both vector locations have a "hybrid search" doc), use different naming conventions ("Redis Query Engine" vs "Redis Search"), and live in different file formats (rule template with frontmatter + directive blocks vs plain-markdown references).

A developer or agent looking for Redis Search guidance currently has to know which of two skills to load, and the cross-skill split exists for organizational reasons that don't match the product. The official product is **Redis Search**, a single retrieval surface that spans lexical, numeric, geo, JSON-path, and vector queries. Splitting it across two skills mirrors an implementation detail (RQE indexes happen to also hold vector fields), not a user-facing boundary.

## 2. Goals

1. **One discoverable skill** — `skills/redis-search/` is the single answer to "where does Redis Search guidance live?"
2. **Preserve all in-flight work** — the 13 new search rules, 4 revised vector rules, and 3 client references from specs 0001–0006 land in the new skill without content loss.
3. **Match the upstream layout convention** — plain-markdown `references/*.md` files (no rule-template frontmatter, no `**Correct:**`/`**Incorrect:**` requirement, no conditional-loading directive blocks). Match the style already established by `skills/redis-query-engine/references/dialect.md` et al.
4. **Drop the retired build dependency** — no `packages/redis-development-build/`, no compiled `AGENTS.md`. The new validator (`scripts/validate-skill-structure.mjs`) is the canonical check.
5. **Update the marketplace** so end users see one `redis-search` skill, not `redis-query-engine` + `redis-vector-search`.
6. **Align repo `CLAUDE.md`** with the new layout — the current "Redis Search Skill — Specific Directives" section describes a structure that no longer exists.

## 3. Non-Goals

- Touching the other 6 upstream skills (`redis-core`, `redis-connections`, `redis-clustering`, `redis-semantic-cache`, `redis-security`, `redis-observability`). Those keep their boundaries.
- Re-litigating spec 0001–0006 content decisions. Each rule's *content* migrates as-is (modulo format changes); section ordering, naming, and depth questions stay resolved.
- Introducing new client coverage beyond redis-py, Jedis, RedisVL. Lettuce / node-redis / go-redis / .NET stay in the §10 follow-ups list of spec 0001.
- Reviving the `rules/` + AGENTS.md compiler pattern. The new layout is one SKILL.md + plain `references/`.
- LangCache, SemanticCache, and other LLM primitives. Those live in `skills/redis-semantic-cache/` upstream and stay there.

## 4. Current-State Inventory

### 4.1 Upstream `skills/redis-query-engine/` (origin/main)

| File | Lines (approx.) | Migration |
|---|---|---|
| `SKILL.md` | 132 | **Merged** into new `skills/redis-search/SKILL.md` §1–§6 (RQE half of the router). |
| `.cursor-plugin/plugin.json` | 13 | **Recreated** for `redis-search`. |
| `references/dialect.md` | ~30 | **Copied** to `skills/redis-search/references/dialect.md`. |
| `references/field-types.md` | ~110 | **Copied** to `skills/redis-search/references/field-types.md`. |
| `references/index-creation.md` | ~110 | **Merged** with upstream `redis-vector-search/references/index-creation.md` and branch's `search-index-creation.md` → one `skills/redis-search/references/index-creation.md`. |
| `references/index-management.md` | ~120 | **Copied** + extended with branch's `search-index-management.md` content. |
| `references/query-optimization.md` | ~110 | **Merged** with branch's `search-query-optimization.md`. |
| `references/skip-initial-scan.md` | ~90 | **Folded** into `references/ft-create-options.md` per spec 0001 §5.10 (Open Question #1, resolved 2026-05-15). |

### 4.2 Upstream `skills/redis-vector-search/` (origin/main)

| File | Lines (approx.) | Migration |
|---|---|---|
| `SKILL.md` | 140 | **Merged** into new `skills/redis-search/SKILL.md` §7–§10 (vector half of the router). |
| `.cursor-plugin/plugin.json` | 13 | **Discarded** — replaced by the single `redis-search` plugin. |
| `references/algorithm-choice.md` | ~150 | **Merged** with branch's `vector-algorithm-choice.md` → `skills/redis-search/references/algorithm-choice.md`. |
| `references/hybrid-search.md` | ~43 | **Merged** with branch's `vector-hybrid-search.md` (which adds FT.HYBRID coverage per spec 0001 §5.0a). |
| `references/index-creation.md` | ~170 | **Merged** into the unified `index-creation.md` (see 4.1). |
| `references/rag-pattern.md` | ~135 | **Merged** with branch's `vector-rag-pattern.md` → `skills/redis-search/references/rag-pattern.md`. |

### 4.3 Branch `adriano-search-new-skills-set` (work-in-progress)

13 new `search-*` rules + 4 revised `vector-*` rules + 3 client references + 6 specs. Migration mapping in §5.3.

## 5. Proposed Changes

### 5.1 New skill directory

```
skills/redis-search/
├── .cursor-plugin/plugin.json
├── SKILL.md
├── metadata.json
├── README.md
└── references/
    ├── search-syntax-primitives.md       (query DSL vocabulary, from spec 0001 §12)
    ├── command-selection.md              (FT.SEARCH vs FT.AGGREGATE vs FT.HYBRID — spec 0001 §5.0a)
    ├── dialect.md
    ├── field-types.md
    ├── index-creation.md                 (unified: RQE + vector + JSON)
    ├── index-management.md
    ├── ft-create-options.md              (absorbs SKIPINITIALSCAN per spec 0001 §5.10)
    ├── json-indexing.md
    ├── query-syntax.md
    ├── query-optimization.md
    ├── text-tokenization.md
    ├── result-shaping.md
    ├── aggregate-pipeline.md
    ├── aggregate-cursors.md
    ├── debugging.md                      (FT.EXPLAIN, FT.PROFILE, FT.INFO)
    ├── vector-query.md                   (KNN, range, PARAMS)
    ├── algorithm-choice.md               (HNSW vs FLAT)
    ├── hybrid-search.md                  (FT.HYBRID + legacy pre-filter pattern)
    ├── rag-pattern.md
    └── clients/
        ├── python-redis-py.md            (spec 0002)
        ├── java-jedis.md                 (spec 0003)
        └── python-redisvl.md             (spec 0004)
```

### 5.2 `SKILL.md` shape

The new SKILL.md is the single entry point and routes by use case, not by command family. Proposed sections:

- **When to apply** — index design, query authoring, vector similarity, hybrid retrieval, RAG, troubleshooting.
- **§1. Pick the right command** — FT.SEARCH vs FT.AGGREGATE vs FT.HYBRID (CLI examples).
- **§2. Schema basics** — `FT.CREATE`, field types, `PREFIX`, DIALECT 2.
- **§3. Common queries** — text, TAG, NUMERIC range, JSON path.
- **§4. Vector basics** — `VECTOR` field config, HNSW vs FLAT, KNN query.
- **§5. Hybrid retrieval** — FT.HYBRID (Redis ≥ 8.4) and the pre-filter + KNN fallback.
- **§6. Aggregations and shaping** — `FT.AGGREGATE`, `LOAD`, `APPLY`, `GROUPBY`, cursors.
- **§7. Operations** — aliases, zero-downtime swaps, `FT.INFO`, debugging.
- **§8. Client examples** — links to `references/clients/*.md`.

Each numbered section opens with a CLI example, then links to the relevant `references/*.md` for depth. Target length ~250–350 lines — long enough to be self-sufficient for common questions, short enough to load fast.

### 5.3 Migration mapping — branch content into the new skill

| Branch file | New location | Notes |
|---|---|---|
| `rules/search-syntax-primitives.md` (in `references/`) | `references/search-syntax-primitives.md` | Strip rule frontmatter (not directive-block content — it's already a reference). |
| `rules/search-command-selection.md` | `references/command-selection.md` | Strip frontmatter; drop `**Correct:**` template. |
| `rules/search-dialect.md` | merged into upstream `references/dialect.md` | Reconcile content; pick the longer/more-correct sections. |
| `rules/search-field-types.md` | merged into upstream `references/field-types.md` | Same reconciliation. |
| `rules/search-index-creation.md` | merged into unified `references/index-creation.md` | Three-way merge: upstream RQE + upstream vector + branch. |
| `rules/search-index-management.md` | merged into upstream `references/index-management.md` | |
| `rules/search-ft-create-options.md` | `references/ft-create-options.md` | Absorbs `SKIPINITIALSCAN` per spec 0001 §5.10. |
| `rules/search-json-indexing.md` | `references/json-indexing.md` | New file. |
| `rules/search-query-syntax.md` | `references/query-syntax.md` | New file. |
| `rules/search-query-optimization.md` | merged into upstream `references/query-optimization.md` | |
| `rules/search-text-tokenization.md` | `references/text-tokenization.md` | New file. |
| `rules/search-result-shaping.md` | `references/result-shaping.md` | New file. |
| `rules/search-aggregate-pipeline.md` | `references/aggregate-pipeline.md` | New file. |
| `rules/search-aggregate-cursors.md` | `references/aggregate-cursors.md` | New file. |
| `rules/search-debugging.md` | `references/debugging.md` | New file. |
| `rules/search-vector-query.md` | `references/vector-query.md` | New file. |
| `rules/vector-algorithm-choice.md` | merged into upstream `references/algorithm-choice.md` | |
| `rules/vector-hybrid-search.md` | merged into upstream `references/hybrid-search.md` | Branch adds FT.HYBRID coverage per spec 0001 §5.0a; upstream lacks it. |
| `rules/vector-index-creation.md` | merged into unified `references/index-creation.md` | |
| `rules/vector-rag-pattern.md` | merged into upstream `references/rag-pattern.md` | |
| `references/clients/python-redis-py.md` | `references/clients/python-redis-py.md` | Copy as-is (already plain-markdown style). |
| `references/clients/java-jedis.md` | `references/clients/java-jedis.md` | Same. |
| `references/clients/python-redisvl.md` | `references/clients/python-redisvl.md` | Same. |

**Reconciliation rule for merges:** when branch and upstream cover the same topic, the merged file leads with the CLI form (per spec 0001 §7), keeps both client mirrors when they don't conflict, and prefers the branch's content when the topic is one the branch specifically expanded (e.g. FT.HYBRID).

### 5.4 Format changes

Files moving from `rules/*` to `references/*` drop:

- Frontmatter (`title`, `impact`, `impactDescription`, `tags`, `description`, `alwaysApply`). The new layout has no validator for these fields.
- The `**Correct:**` / `**Incorrect:**` template requirement. Use prose + code blocks; bad-example blocks are fine when illustrative but not mandatory.
- The conditional-loading directive block (`Client mirrors — read exactly one:`). The new layout doesn't have a build-time validator that enforces this; the SKILL.md links handle routing instead.
- Cross-reference style stays `[references/foo.md](references/foo.md)` per upstream convention.

CLI-first content discipline (spec 0001 §7) is preserved by author convention, not by validator.

### 5.5 Marketplace updates

- `.claude-plugin/marketplace.json` — replace the `redis-query-engine` and `redis-vector-search` entries with one `redis-search` entry. Bump version (1.1.0 → 1.2.0).
- `.cursor-plugin/marketplace.json` — same: 2 entries removed, 1 added.
- `plugins/redis-development/skills/redis-search` — new symlink; remove `redis-query-engine` and `redis-vector-search` symlinks.

### 5.6 Deletions

- `skills/redis-query-engine/` — removed entirely.
- `skills/redis-vector-search/` — removed entirely.
- `skills/redis-development/` — already removed upstream; branch's edits to it become moot.
- `packages/redis-development-build/src/{build,config,parser,types,validate}.ts` — already removed upstream; branch's edits become moot.
- Branch's `AGENTS.md` edits at repo root — already replaced upstream.

### 5.7 `CLAUDE.md` updates (separate commit in same PR)

Revise the "Redis Search Skill — Specific Directives" section:

- One skill (`redis-search`), not `search-*` and `vector-*` prefixes.
- Plain-markdown references (no frontmatter requirements, no `**Correct:**`/`**Incorrect:**` mandate, no directive block).
- "CLI-first" is now an author convention, not a validator-enforced rule.
- Reference loading is via SKILL.md links, not via the directive-block mechanism described in spec 0001 §7.8.
- Add a pointer to this spec (0007) as the layout authority.

## 6. Cross-Cutting Decisions

### 6.1 Naming

The official product is **Redis Search**. The skill name, directory name, file names, and prose all use "Redis Search." Internal Redis terminology like "Query Engine" / "RQE" appears in upstream docs and is not edited where it's a quoted upstream phrase, but is otherwise replaced. Vector functionality is described as part of Redis Search, not as a separate product.

### 6.2 Single skill vs split

This spec **rejects** the recent upstream split (`redis-query-engine` + `redis-vector-search`) on two grounds:

- The product surface is unified: vector fields live inside the same `FT.CREATE` machinery as TEXT/TAG/NUMERIC fields, and queries can blend lexical, numeric, geo, and vector legs (`FT.HYBRID`). The split asks users to know an implementation detail.
- Upstream's own `redis-vector-search/SKILL.md` opens with *"This skill builds on the `redis-query-engine` skill"* — an acknowledgement that the split is artificial.

This is a real architectural divergence from a decision upstream made a day before this spec. Expect pushback in review and treat the spec as a proposal, not a fait accompli.

### 6.3 Reference loading

Upstream's pattern is: SKILL.md is loaded as the always-present routing doc; `references/*.md` are loaded on demand when SKILL.md links into them. No frontmatter scope, no router file, no directive blocks. This spec adopts that pattern wholesale. Spec 0001 §7.8's conditional-loading mechanism is superseded for this skill.

### 6.4 Client references location

All three (`python-redis-py.md`, `java-jedis.md`, `python-redisvl.md`) live under `skills/redis-search/references/clients/`. No duplication across skills (since there's only one skill). No top-level `skills/redis-clients/` skill (would introduce a new convention; out of scope).

### 6.5 Spec lineage

Specs 0001–0006 stay in `/spec/` untouched. They remain the authority for **content decisions** (which rules exist, what they cover, which upstream sources they cite, the FT.HYBRID version gate, the dataset choices). This spec (0007) is the authority for **layout and packaging** decisions (one skill, plain references, marketplace shape). Where the two conflict in mechanics (rule template, directive blocks, AGENTS.md compiler), this spec wins.

## 7. Acceptance Criteria

- `skills/redis-search/` exists with the structure in §5.1.
- `skills/redis-query-engine/` and `skills/redis-vector-search/` are removed.
- Both `marketplace.json` files publish one `redis-search` entry where there used to be two; version bumped.
- `plugins/redis-development/skills/redis-search` symlink exists; the two old symlinks are removed.
- `scripts/validate-skill-structure.mjs` passes via `npm run validate`.
- Repo `CLAUDE.md` no longer references the retired `rules/` workflow or the AGENTS.md compiler.
- A developer asking "how do I escape a hyphen in a TAG query" finds the answer by following one link from `skills/redis-search/SKILL.md`.
- A developer asking "how do I run a KNN query with a pre-filter" finds the answer the same way.
- No file under `skills/redis-search/` carries the legacy rule-template frontmatter (`impact`, `tags`, `alwaysApply`, etc.).

## 8. Open Questions

1. **Maintainer alignment** — does the upstream team accept re-merging the two skills, or should this ship as a third skill (`redis-search`) that coexists with the existing two? Branching the PR around this decision likely needs an issue discussion before code is written.
2. **Skill name** — `redis-search` is the proposed name. Alternatives: `redis-search-and-query` (verbose), `redis-search-engine` (overloaded). Picking `redis-search` aligns with the §6.1 naming directive.
3. **SKILL.md length budget** — upstream `redis-query-engine/SKILL.md` is 132 lines, `redis-vector-search/SKILL.md` is 140 lines. The combined skill needs ~250–350 lines. Above ~400 it's worth splitting some content into a `references/overview.md`. Decide at draft time, not now.
4. **Evals directory** — `skills/redis-core/evals/` is the only upstream example of per-skill evals. The `redis-syntax-eval` harness (a git submodule at repo root) is the equivalent for search; whether it moves under `skills/redis-search/evals/` or stays as a top-level submodule is a separate decision. Default: leave it where it is.
5. **JSON-indexing scope** — spec 0001 introduced `search-json-indexing.md` as a new file. Should JSON path indexing be a top-level section in SKILL.md or only a reference? Lean toward **reference only** — JSON is a field-type concern, mentioned briefly in `field-types.md` and linked to the detail page.

## 9. Out-of-Scope Follow-ups

- **Additional client references** — Lettuce, node-redis, go-redis, NRedisStack, .NET. Carried forward from spec 0001 §10.
- **`search-scoring.md`** (BM25/TFIDF) — carried forward from spec 0001 §5.8.
- **`search-suggest-spellcheck.md`** — carried forward from spec 0001 §5.9.
- **LLM primitives skill** — SemanticCache, MessageHistory, SemanticRouter, EmbeddingsCache, Rerankers. Lives in or near `skills/redis-semantic-cache/` upstream; not in scope here.
- **Eval suite move** — relocating `redis-syntax-eval/` to `skills/redis-search/evals/`. Open question #4.
- **Cursor-plugin manifest verification** — ensure `.cursor-plugin/plugin.json` for the new skill matches the Cursor validator's expectations (cf. PR #12 path-traversal fix).

## 10. Iteration Log

| Date | Change |
|------|--------|
| 2026-05-28 | Initial draft. Proposes single `redis-search` skill consolidating upstream `redis-query-engine` + `redis-vector-search` + branch work from specs 0001–0006. Documents architectural divergence from upstream's recent split (commit `18da4e4`) and flags maintainer alignment as Open Question #1. |
| 2026-05-29 | Implementation landed on branch `redis-search-skill` in six commits (scaffolding → RQE refs → branch-only refs → vector refs → client refs → cleanup). Maintainer alignment confirmed by the user, so Open Question #1 is resolved as "proceed with consolidation." `metadata.json` and `README.md` were dropped from §5.1 in implementation — upstream skills don't use either, so the new skill matches the prevailing convention. Local `npm run validate` passes with 0 errors and 2 informational warnings on `redis-search` (deep-nested `references/clients/` is deliberate per §6.4; total token volume is inherent to scope). |
