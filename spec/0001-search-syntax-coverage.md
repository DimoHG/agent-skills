# Spec 0001 — Search & Vector Syntax Coverage for Redis Query Engine Skill

| Field | Value |
|-------|-------|
| Status | Draft |
| Author | Adriano Amaral |
| Created | 2026-05-15 |
| Skill | `skills/redis-development` |
| Scope | `rules/search-*.md`, `rules/vector-*.md` |
| Goal | Provide clear, complete Redis Query Engine syntax support for every developer using the skill |

---

## 1. Problem Statement

The current `search-*` (6 files) and `vector-*` (4 files) rule set inside the `redis-development` skill reads as a best-practices checklist rather than a syntax reference. A developer writing their first `FT.SEARCH` or KNN vector query lands on `search-query-optimization.md` and finds only two example queries and no explanation of operators, escaping, or query DSL grammar.

When agents (Claude Code, Cursor, Copilot) consult these rules to help a developer, they cannot reliably answer concrete syntax questions such as:

- How do I match a TAG value that contains a hyphen?
- How do I run a KNN query that pre-filters by category?
- How do I write an `FT.AGGREGATE` pipeline with `GROUPBY` + `APPLY`?
- How do I index a nested JSON path?
- Why is my query returning empty results — is it tokenization or escaping?

The skill therefore underdelivers on its stated audience: **every developer using Redis Search/Query Engine**.

## 2. Goals

1. Cover Redis Query Engine **query syntax** end-to-end so an agent can answer any reasonable syntax question by reading one rule file.
2. Cover **vector query syntax** (KNN, range, hybrid pre-filter, PARAMS) with the same depth as vector index creation.
3. Cover the full `FT.AGGREGATE` pipeline as a first-class topic.
4. Cover **JSON indexing syntax** (`$.path AS alias`, `[*]`, JSON + vector).
5. Cover **result-shaping** commands (`RETURN`, `LIMIT`, `SORTBY`, `HIGHLIGHT`, `SUMMARIZE`, `NOCONTENT`).
6. Cover **debugging tools** (`FT.EXPLAIN`, `FT.PROFILE`, `FT.INFO`) with worked examples.
7. Standardize language coverage across all rules: CLI + Python (redis-py) + Java (Jedis) + Node (node-redis). Optional fifth: Go (go-redis).
8. Align on canonical naming: title = "Redis Query Engine" (Redis 8 GA name), verb = "search," with a brief note that "Redis Search" is the legacy module name.

## 3. Non-Goals

- Rewriting the existing high-quality rules (`search-field-types`, `vector-index-creation`, `vector-algorithm-choice`) — only minor naming/terminology alignment.
- Adding rules outside the `search-*` and `vector-*` prefixes.
- Changing the skill's build system or the SKILL.md scaffolding beyond adding new rule entries.
- Producing tutorial/long-form content — rules stay as focused, agent-consumable references.

## 4. Current State Inventory

### `search-*` (existing, 6 files)
| File | Quality | Action |
|------|---------|--------|
| `search-dialect.md` | Good | Keep; add note that DIALECT 2 is the only supported value from Redis 8 |
| `search-field-types.md` | Strong | Keep; add NODE.js example for parity |
| `search-index-creation.md` | Good | Keep; add cross-link to new `search-json-indexing.md` |
| `search-index-management.md` | Good | Keep; expand to mention `FT.ALTER` limitations |
| `search-query-optimization.md` | Thin | Keep but reposition as "performance" — split syntax content out into new files |
| `search-skip-initial-scan.md` | Niche | **Delete** — content merged into `search-ft-create-options.md` (§5.10). Open Question #1 resolved 2026-05-15. |

### `vector-*` (existing, 4 files)
| File | Quality | Action |
|------|---------|--------|
| `vector-index-creation.md` | Strong content, **RedisVL-heavy** | **Revise** — under §7 CLI-first directive: lead with CLI `FT.CREATE ... VECTOR HNSW ...`, mirror upstream `search_vss.py` and `VectorSetExample.java`, keep redis-py snippet. Existing RedisVL `IndexSchema.from_dict` example migrates to spec 0004 §6 (consolidation destination: `python-redisvl.md` §5.4 + §5.7). |
| `vector-algorithm-choice.md` | Strong content, **RedisVL-heavy** | **Revise** — same treatment: CLI-first, mirror upstream, redis-py + Jedis L2 snippets. Existing RedisVL HNSW + FLAT schema dicts migrate to spec 0004 §6 (destination: `python-redisvl.md` §5.4). |
| `vector-hybrid-search.md` | **Outdated + RedisVL-heavy** | **Revise** — currently shows pre-filter-then-KNN via FT.SEARCH only and uses RedisVL. With `FT.HYBRID` as a dedicated command (see §5.0a), this rule should: (a) clarify pre-filter-then-KNN via FT.SEARCH for *filter-narrowed vector search* (Redis < 8.4.0), and (b) point to `FT.HYBRID` for genuine *blended lexical + vector ranking* (Redis ≥ 8.4.0). Convert to CLI-first per §7; mirror upstream `query_combined.py`. Existing RedisVL `VectorQuery` examples (filtered + unfiltered) migrate to spec 0004 §6 (destination: `python-redisvl.md` §5.8 + §5.11). Remove `redisvl` from the rule's frontmatter tags. |
| `vector-rag-pattern.md` | OK, **RedisVL-heavy** | **Revise** — RAG is a pattern, not a syntax topic; CLI-first reframing means showing the `FT.SEARCH ... =>[KNN ...]` step in CLI then short redis-py + Jedis snippets for end-to-end pipeline. Cross-link to `search-vector-query.md`. Existing RedisVL full-pipeline example migrates to spec 0004 §6 (destination: `python-redisvl.md` §5.7 + §5.9, plus an upstream `use_cases/` pointer). |

## 5. Proposed New Rules

Each rule follows the established template (frontmatter + Correct/Incorrect or When-to-use sections + cross-language examples + reference link).

### 5.0a `search-command-selection.md` — **FOUNDATIONAL (action rule)**

The first decision before any syntax is *which command to run*. Redis Search exposes three query commands with different design intents:

| Command | When to use | Mental model | Minimum Redis |
|---------|-------------|--------------|---------------|
| **FT.SEARCH** | Straightforward document retrieval. Best default when the agent simply needs relevant results back. | **Ready-to-use** — most implicit retrieval behavior, returns matching docs directly. | 2.0 (RediSearch module) / 8.0 (built-in) |
| **FT.AGGREGATE** | Faceting, analytics, computed fields, custom output structures. | **Declarative result shaping** — agent must explicitly specify `LOAD`, `APPLY`, `GROUPBY`, `REDUCE`, `SORTBY`, output. | 2.0 (RediSearch module) / 8.0 (built-in) |
| **FT.HYBRID** | Relevance must blend lexical (text) matching with semantic/vector similarity, with configurable fusion. | **Declarative hybrid retrieval** — pipeline with explicit `SEARCH` + `VSIM` legs and a `COMBINE` fusion stage (`RRF` or `LINEAR`). | **8.4.0** (verified 2026-05-15 against redis.io docs) |

**Verified FT.HYBRID syntax** (from `https://redis.io/docs/latest/commands/ft.hybrid/`, retrieved 2026-05-15):

```
FT.HYBRID index
  SEARCH query
    [SCORER scorer]
    [YIELD_SCORE_AS name]
  VSIM vector_field $vector_param
    [KNN count K k [EF_RUNTIME ef_runtime]]
    [RANGE count RADIUS radius [EPSILON epsilon]]
    [YIELD_SCORE_AS name]
    [FILTER filter]
  [COMBINE RRF count [CONSTANT constant] [WINDOW window] [YIELD_SCORE_AS name]]
  [COMBINE LINEAR count [[ALPHA alpha] [BETA beta]] [WINDOW window] [YIELD_SCORE_AS name]]
  [LIMIT offset num]
  [SORTBY count sortby [ASC | DESC]]
  [NOSORT]
  [LOAD count field [...]]
  [PARAMS nargs vector_param vector_blob [name value ...]]
  [TIMEOUT timeout]
```

Time complexity: **O(N+M)** where N is text-search complexity and M is vector-search complexity.

Canonical worked example (from official docs):

```
FT.HYBRID products-idx
  SEARCH "laptop"
  VSIM @description_vector $query_vec
  KNN 2 K 10
  PARAMS 2 query_vec <vector_blob>
```

**Rule placement:** This is the first rule an agent should encounter when generating a query — before consulting `search-query-syntax`, `search-vector-query`, or `search-aggregate-pipeline`. It cross-links to all three.

**Content outline:**
- The decision table above.
- Worked example per command: same dataset (`product:*`), same conceptual question ("find me electronics under $500 matching 'wireless headphones'"), solved three ways.
- Decision tree: "Do I need computed/grouped output?" → AGGREGATE. "Do I need text+vector blended ranking with explicit fusion?" → HYBRID. "Else?" → SEARCH.
- For FT.HYBRID: explain `COMBINE RRF` (Reciprocal Rank Fusion — rank-based, robust default) vs `COMBINE LINEAR` (weighted score blend — needs `ALPHA`/`BETA` tuning).
- **Version gate note:** FT.HYBRID requires Redis ≥ 8.4.0. For older Redis versions, fall back to the pre-filter + KNN pattern via FT.SEARCH (see `search-vector-query.md` and revised `vector-hybrid-search.md`).
- CLI canonical + redis-py + Jedis mirrors (per §7).

**Why this is a rule (not a reference):** it tells the agent *what to do*, not just defines vocabulary. Action-shaped, lives in `rules/`.

### 5.0 `references/search-syntax-primitives.md` — **FOUNDATIONAL (reference doc)**

Decision: introduce a new `skills/redis-development/references/` folder, following the skill-creator progressive-disclosure pattern (`references/` = docs loaded as needed, distinct from `rules/` = always-loaded behavior).

This file is the canonical Redis Search query vocabulary. Every action-oriented rule below (§5.1–§5.10) links to it by anchor rather than redefining terms. The agent reads it once to anchor terminology, then uses the action rules for "how to do X."

**Sections (anchor names in parentheses):**

1. **Query Expression** (`#query-expression`) — the complete text submitted to RQE: terms + fields + operators + modifiers. Example: `"hello world @category:{electronics} @price:[100 500]"`
2. **Query Term** (`#query-term`) — a single discrete unit: a word, phrase, prefix, or wildcard. Preferred shape: *field identifier → delimiter → term*. Examples: `smartphone`, `@description:wireless`, `@category:{ele*}`.
3. **Field Identifier** (`#field-identifier`) — `@fieldname:` prefix scoping the term to a specific indexed field. Without it, RQE searches all TEXT fields.
4. **Query Delimiters** (`#query-delimiters`) — the bracket type tells RQE what kind of match to perform:
   | Delimiter | Use | Example |
   |-----------|-----|---------|
   | `( )` | TEXT phrase grouping / boolean grouping | `(@type:{product} \| @type:{post})` |
   | `{ }` | TAG exact-match (with `\|` for alternatives) | `@category:{electronics\|books}` |
   | `[ ]` | NUMERIC range, GEO, GEOSHAPE, VECTOR_RANGE | `@price:[100 500]`, `@price:[-inf 200]` |
   | `" "` | exact phrase match in TEXT | `"red shoes"` |
5. **Query Attributes** (`#query-attributes`) — `=> { $key: value; ... }` modifiers attached to a term or group. Includes `$weight`, `$slop`, `$inorder`, and the vector-query attribute form `=>[KNN k @field $vec AS score]`.
6. **Weight** (`#weight`) — multiplier boosting a term/group's contribution to scoring. `(foo bar) => { $weight: 2.0 }`.
7. **Scoring** (`#scoring`) — numerical relevance value per document, combining TF/IDF or BM25, field weights, and explicit boosts.
8. **Ranking** (`#ranking`) — ordering documents by score (the *application* of scoring).
9. **Sorting** (`#sorting`) — explicit ordering by a field value via `SORTBY`, bypassing relevance ranking.
10. **Grouping** (`#grouping`) — collecting documents by shared field values via `GROUPBY` (FT.AGGREGATE only).
11. **Similarity** (`#similarity`) — approximate-match degree: fuzzy (`%term%`, Levenshtein), phonetic, or vector distance under a metric (COSINE/L2/IP).
12. **Filtering** (`#filtering`) — narrowing results by NUMERIC/TAG/GEO criteria rather than text relevance.
13. **Operators** (`#operators`) — combine terms in a query expression:
    | Operator | Symbol | Meaning |
    |----------|--------|---------|
    | AND | space (implicit) | all terms must match |
    | OR | `\|` | any term matches |
    | NOT | `-` (prefix) | exclude documents containing the term |
    | OPTIONAL | `~` (prefix) | optional but contributes to score when present |

**Source material:** the glossary content authored by Adriano Amaral on 2026-05-15 (preserved verbatim in §12 below) is the working draft for this file.

**How action rules reference it:**

> See `references/search-syntax-primitives.md#query-delimiters` for the full table.

This keeps action rules focused on **what to do** while the reference owns **what these words mean**.


### 5.1 `search-query-syntax.md` — **HIGH priority**
Comprehensive operator + escaping reference. Sections:
- Field-scoped queries: `@field:value`
- TAG syntax: `@tag:{val1|val2}`, escaping rules table (hyphen, dot, comma, `@`, `:`, space)
- TEXT syntax: phrase `"..."`, prefix `pre*`, suffix `*fix`, infix `*mid*`, fuzzy `%term%`, optional `~term`
- NUMERIC ranges: `[min max]`, `[(min (max]` (exclusive), `[-inf +inf]`
- GEO/GEOSHAPE filters: `@loc:[lon lat radius unit]`, `@area:[WITHIN $poly]`
- Boolean: implicit AND (space), `|` OR, `-` NOT, `()` grouping
- Wildcards and global `*`
- Escaping special characters in TEXT vs TAG (different rules — common pitfall)

### 5.2 `search-vector-query.md` — **HIGH priority**
- KNN: `*=>[KNN 10 @embedding $vec AS score]`
- Range: `@embedding:[VECTOR_RANGE 0.5 $vec]`
- Hybrid pre-filter: `(@category:{tech} @price:[100 500])=>[KNN 10 @embedding $vec]`
- PARAMS binding (must use DIALECT 2)
- Returning + sorting by score; aliasing the score field
- EF_RUNTIME at query time

### 5.3 `search-aggregate-pipeline.md` — **HIGH priority**
- Pipeline stages in order: `LOAD` → `APPLY` → `FILTER` → `GROUPBY`/`REDUCE` → `SORTBY` → `LIMIT`
- Common reducers: `COUNT`, `SUM`, `AVG`, `TOLIST`, `FIRST_VALUE`, `RANDOM_SAMPLE`
- `APPLY` for computed fields
- Cross-link forward to `search-aggregate-cursors.md` (§5.3a) for pagination of large result sets
- Cross-language examples

### 5.3a `search-aggregate-cursors.md` — **MEDIUM priority**
Pagination for large FT.AGGREGATE result sets that won't fit in a single response.
- `WITHCURSOR [COUNT n] [MAXIDLE ms]` flag on FT.AGGREGATE
- `FT.CURSOR READ <index> <cursor_id> [COUNT n]` to fetch next batch
- `FT.CURSOR DEL <index> <cursor_id>` to release before idle timeout
- Cursor lifecycle: when cursors are auto-reaped, default MAXIDLE
- Worked example: paginating a 1M-row aggregation
- Cross-link back to `search-aggregate-pipeline.md`

### 5.4 `search-json-indexing.md` — **MEDIUM priority**
- `ON JSON` vs `ON HASH`
- Path syntax: `$.field AS alias`
- Array indexing: `$.tags[*] AS tags`
- Nested objects: `$.address.city AS city`
- JSON + vector field example
- Gotcha: paths without `AS` produce auto-generated names

### 5.5 `search-result-shaping.md` — **MEDIUM priority**
- `RETURN n field1 field2 ...` and `RETURN 0` / `NOCONTENT`
- `LIMIT 0 0` for count-only queries
- `SORTBY field [ASC|DESC]` — and the SORTABLE requirement
- `HIGHLIGHT FIELDS n field ... TAGS open close`
- `SUMMARIZE FIELDS ... FRAGS n LEN n SEPARATOR sep`
- Pagination patterns + offset performance considerations

### 5.6 `search-debugging.md` — **MEDIUM priority**
- `FT.EXPLAIN` — read the parse tree, common surprises (token splits, stemming)
- `FT.PROFILE` — query vs aggregate, reading the timing breakdown
- `FT.INFO` — index size, doc count, indexing state, hash_indexing_failures
- Common error messages and what they mean

### 5.7 `search-text-tokenization.md` — **MEDIUM priority**
- Stemming, `NOSTEM`, `LANGUAGE` option
- Stop words and `STOPWORDS` override
- `PHONETIC` matchers
- `WEIGHT` and per-field score boosting
- When TEXT vs TAG decisions hinge on tokenization

### 5.8 `search-scoring.md` — **DEFERRED to follow-up spec** (Open Question #6, 2026-05-15)
*Scope sketch kept here for the follow-up spec:*
- Default scorer (BM25 in Redis 8, TFIDF historically)
- `SCORER` clause
- `WITHSCORES`, `EXPLAINSCORE`
- Re-ranking patterns

### 5.9 `search-suggest-spellcheck.md` — **DEFERRED to follow-up spec** (Open Question #6, 2026-05-15)
*Scope sketch kept here for the follow-up spec:*
- `FT.SUGADD`/`FT.SUGGET` for autocomplete
- `FT.SPELLCHECK` for typo correction
- Synonyms via `FT.SYNUPDATE`/`FT.SYNDUMP`

### 5.10 `search-ft-create-options.md` — **LOW priority** (consolidation)
Single rule consolidating all FT.CREATE flag options (replaces the existing standalone `search-skip-initial-scan.md` — Open Question #1 resolved 2026-05-15).
- `SKIPINITIALSCAN` — index only new documents (content migrated verbatim from existing `search-skip-initial-scan.md`)
- `NOOFFSETS`, `NOHL`, `NOFIELDS`, `NOFREQS` — disable optional index features to save memory
- `MAXTEXTFIELDS` — pre-allocate text field slots for FT.ALTER
- `STOPWORDS` — override the default stopword list
- `TEMPORARY` — auto-expire index after idle period
- Memory vs functionality trade-offs per flag
- **Migration note:** when this rule lands, `search-skip-initial-scan.md` is deleted (its content merged here).

## 6. Cross-Cutting Changes

1. **Language parity sweep.** Implemented per the layered strategy in §7. Acceptance: every rule has the canonical CLI form and at least one client idiom inline; deeper per-client coverage lives in `references/clients/`.
2. **Terminology alignment.** Product name is **Redis Search** (confirmed 2026-05-15 by Adriano — "RQE is no longer the product name, but Redis Search"). Title/headings use "Redis Search"; body uses "search" as a verb. Filenames keep the `search-*` prefix (see Open Question #5). The "Redis Query Engine" / "RQE" terms used in the glossary source material (§12) are legacy and get rewritten to "Redis Search" in the published reference doc.
3. **SKILL.md updates.** Add new rule entries under "5. Redis Search" and "6. Vector Search & RedisVL" sections of the quick reference. Bump the rule count. Add a pointer to `references/clients/` index.
4. **Build system.** No structural changes — new rules drop into existing `rules/` and the build picks them up via prefix mapping in `packages/redis-development-build/src/config.ts`. `references/` stays out of the compiled `AGENTS.md` (see open question #8).

## 7. CLI-First Strategy with Two Client Extensions (redis-py, Jedis)

### 7.1 Principle

**All rules are written in CLI form first.** RESP / `redis-cli` is the source of truth — every client library serializes to the same wire commands. CLI examples are universally readable, never drift, and let an agent reason about *what* RQE does without committing to *which* client.

This spec extends rules to exactly **two clients** for v1: **`redis-py`** (Python) and **Jedis** (Java). Other clients (Lettuce, node-redis, go-redis, NRedisStack, RedisVL) are explicitly **out of scope** for this spec and tracked as follow-ups in §10.

### 7.2 The layered approach (narrowed)

| Layer | Location | Contents | Required? |
|-------|----------|----------|-----------|
| **L1 — Canonical CLI** | Inside every rule | RESP / `redis-cli` form of the operation | **Always** |
| **L2 — Client snippets** | Inside every rule, at the bottom | Short `redis-py` and `Jedis` examples mirroring the CLI form | When meaningful (most rules); skip for CLI-only topics like `FT.PROFILE` raw output reading |
| **L3 — Per-client deep references** | `references/clients/python-redis-py.md` and `references/clients/java-jedis.md` | Comprehensive per-client coverage: connection, index ops, all query commands, version gotchas | Two files only |

**Ordering inside a rule:**
1. Concept + canonical CLI example (the heart of the rule).
2. Correct/Incorrect or When-to-use sections — still CLI.
3. At the end, two short client mirrors labeled "redis-py" and "Jedis", each ≤15 lines.
4. Link to the relevant section of each client reference for deeper coverage.

### 7.3 Anchor to upstream examples (mirror, don't invent)

Both Redis-maintained repos publish a parallel set of query examples. Each new rule in §5 maps to upstream files; **rule authors mirror these files rather than invent fresh examples**. This ensures the skill's snippets stay accurate, idiomatic, and aligned with what Redis publishes.

**Sources:**
- redis-py: https://github.com/redis/redis-py/tree/master/doctests
- Jedis: https://github.com/redis/jedis/tree/master/src/test/java/io/redis/examples

**Rule-to-upstream mapping (v1):**

| New rule | redis-py doctest | Jedis example |
|----------|------------------|---------------|
| `search-command-selection` | `search_quickstart.py` | `SearchQuickstartExample.java` |
| `search-query-syntax` | `query_ft.py`, `query_em.py` | `QueryFtExample.java`, `QueryEmExample.java` |
| `search-vector-query` | `search_vss.py`, `query_combined.py` | `VectorSetExample.java` *(verify naming)* |
| `search-aggregate-pipeline` | `query_agg.py` | `QueryAggExample.java` |
| `search-json-indexing` | `home_json.py`, `dt_json.py` | `HomeJsonExample.java`, `JsonExample.java` |
| `search-result-shaping` | covered across `query_*.py` | covered across `Query*.java` |
| `search-debugging` | *(no direct upstream — author from FT.EXPLAIN/PROFILE/INFO docs)* | *(same)* |
| `search-text-tokenization` | *(no direct upstream — author from FT.CREATE docs)* | *(same)* |
| `search-ft-create-options` | `search_quickstart.py` (creation patterns) | `SearchQuickstartExample.java` |
| Geo subsection in `search-query-syntax` | `query_geo.py`, `geo_index.py` | `QueryGeoExample.java`, `GeoIndexExample.java` |
| Range subsection in `search-query-syntax` | `query_range.py` | `QueryRangeExample.java` |

**Process for each rule:**
1. Fetch the listed upstream files (e.g., `gh api repos/redis/redis-py/contents/doctests/query_ft.py`).
2. Extract the CLI form (the underlying `FT.SEARCH ...` command being demonstrated) as the L1 example. Doctest files often inline CLI comments alongside Python code.
3. Distill the redis-py snippet down to ≤15 lines for the L2 mirror.
4. Repeat for Jedis: distill the matching `QueryFtExample.java` to ≤15 lines.
5. Note any version constraints found in the upstream file (Redis version, client version) in the rule.

### 7.4 `references/clients/` structure (v1)

```
skills/redis-development/references/
├── search-syntax-primitives.md          (from §5.0)
└── clients/
    ├── README.md                         (index, selection guide, scope note)
    ├── python-redis-py.md
    └── java-jedis.md
```

**Fixed TOC per client reference:**

```markdown
# <Client name> — Redis Query Engine quick reference

- Minimum supported version (client + Redis)
- Connection / client setup
- Create index (HASH and JSON)
- FT.SEARCH idioms
- FT.AGGREGATE pipeline idioms
- Vector queries (KNN, range, hybrid pre-filter)
- FT.HYBRID (when supported — see open question #9)
- Common errors & version-specific gotchas
- Upstream examples index (links to the relevant files in the source repo)
```

The "Upstream examples index" at the end is a curated table mapping common operations to the exact upstream file/function, so agents can fetch authoritative source on demand.

### 7.5 What about RedisVL?

Deferred. The original draft of this spec treated RedisVL as a peer to `redis-py`, but the user's directive narrows v1 to redis-py and Jedis only. RedisVL becomes a §10 follow-up: it's a higher-level SDK (schema-first, semantic caching, message history) and warrants its own spec when added, not a bolted-on section here.

**Impact on existing rules:** the four existing `vector-*` rules currently lean heavily on RedisVL examples. Under this CLI-first directive, those rules need a content review (see §4 inventory updates below): primary form becomes CLI; redis-py replaces RedisVL as the L2 Python idiom; existing RedisVL content is either moved to a follow-up spec or kept as a brief "RedisVL equivalent" footer pending that spec.

### 7.6 Acceptance test for the strategy

A developer asks an agent: *"Write me a KNN query that filters by category, in Java."*

With this strategy:
1. Agent reads `search-vector-query.md` → finds canonical CLI form and a short Jedis mirror at the bottom.
2. If more depth is needed, agent loads `references/clients/java-jedis.md#vector-queries` for the comprehensive idiomatic Jedis builder calls + version constraints.
3. The Jedis snippet in both places is verified against `VectorSetExample.java` (or its successor) in the upstream repo.

Same flow for redis-py, mirroring `search_vss.py`.

### 7.8 Reference loading mechanism (Open Question #8, resolved 2026-05-15)

References are **conditionally loaded** by the consuming agent, not bulk-included in `AGENTS.md`. Bulk inclusion would either bloat the compiled doc (every developer pays the cost of both client refs even when targeting one language) or leak cross-client API noise into a query the agent is writing. Bulk exclusion would leave references invisible to tools that only consume `AGENTS.md`.

Conditional loading is achieved through three coordinated mechanisms:

#### a) Reference frontmatter declares scope

Each reference file begins with frontmatter the agent (or a router script) can match on:

```yaml
---
title: Redis Search Query Syntax Primitives
scope: query-syntax
triggerWhen: writing-query | reading-query | learning-syntax
appliesTo: all-clients
---
```

```yaml
---
title: redis-py — Redis Search quick reference
scope: client-idioms
triggerWhen: generating-python-code
appliesTo:
  client: redis-py
  language: python
minimumVersion:
  client: "5.0"
  redis: "8.0"
---
```

`scope`, `triggerWhen`, and `appliesTo` are the matchable signals. The agent matches them against the current task ("I'm writing a Python redis-py query" → load `python-redis-py.md` + `search-syntax-primitives.md`; do NOT load `java-jedis.md`).

#### b) Rules emit explicit load directives

Every rule that involves writing query syntax or generating client code emits a directive block like this:

```markdown
**Before writing the query expression**, read `references/search-syntax-primitives.md`
to anchor terminology (Query Term, Field Identifier, Delimiters, Operators).

**Client mirrors — read exactly one:**
- For Python (`redis-py`) targets, read `references/clients/python-redis-py.md`.
- For Java (`Jedis`) targets, read `references/clients/java-jedis.md`.
- Do **not** read both. Their APIs are different shapes and reading both
  wastes context and risks mixing idioms in the output.
```

This is the strongest signal — explicit instruction in the rule the agent is already reading. The directive is short, scannable, and unambiguous about what NOT to load.

#### c) A router file maps intent → reference

`skills/redis-development/references/README.md` is a curated table that an agent landing in the `references/` folder can use to navigate:

```markdown
# Redis Search references — when to read which

| If your task is... | Read this reference |
|--------------------|---------------------|
| Writing any FT.SEARCH/FT.AGGREGATE/FT.HYBRID query expression | `search-syntax-primitives.md` |
| Generating Python (`redis-py`) code | `clients/python-redis-py.md` |
| Generating Java (`Jedis`) code | `clients/java-jedis.md` |
| Unsure which client | Stay with the canonical CLI form in the rule itself; no client reference needed. |

**Mutual exclusion:** the two client references describe different API shapes.
An agent should read at most one per task. Reading both is wasteful and risks
producing hybrid pseudo-code that doesn't compile against either API.
```

#### d) Build behavior

`packages/redis-development-build/src/config.ts` is extended minimally:

- Rule compilation into `AGENTS.md` is unchanged.
- The router table from `references/README.md` is inlined at the top of `AGENTS.md` (so agents that only have `AGENTS.md` see how to find references).
- Reference *bodies* are not inlined — they remain separate files loaded on demand by direct path.
- Validation step: every rule that includes the L2 client mirrors (§7.2) MUST contain the explicit load directive block from §7.8(b), or the build fails. This prevents directives from being silently omitted as new rules are added.

#### e) Why this works

- **No bloat.** `AGENTS.md` only carries rules + router table; reference bodies live where they're loaded by direct path.
- **No cross-client noise.** A Python developer's agent never reads the Jedis reference. A Java developer's never reads the redis-py one.
- **Strong triggering signal.** The explicit "read X, do not read Y" inside the rule is read by the agent as part of the same context that contains the task itself — so it's hard to miss.
- **Validated at build time.** The directive block is required by the validator, so it can't be forgotten as new rules are authored.
- **Testable.** The eval loop (§10 follow-up) can include "agent generated correct redis-py code without contaminating it with Jedis idioms" as a measurable assertion.

### 7.9 Practical rules of thumb

- **CLI first, always.** The canonical example is the rule's anchor.
- **Two client mirrors only — redis-py and Jedis.** No other clients inline in this spec.
- **Mirror upstream, don't invent.** If an example doesn't exist upstream, either author the rule from official command docs and flag it (§7.3), or omit the client mirror and rely on CLI.
- **Keep client snippets ≤15 lines.** Deep coverage lives in `references/clients/`.
- **Mark minimum versions.** Note Redis version + client version when behavior differs (e.g., DIALECT defaults).
- **Don't duplicate `search-syntax-primitives.md` content** in client docs. Link by anchor; the query DSL is the same across clients.

## 8. Acceptance Criteria

- A developer asking "how do I escape a hyphen in a TAG query" finds the answer in one rule (`search-query-syntax.md`).
- A developer asking "how do I run a KNN with pre-filter" finds the answer in one rule (`search-vector-query.md`).
- A developer asking "what does FT.EXPLAIN output mean" finds a worked example.
- Every `search-*` and `vector-*` rule offers at least three language examples (CLI + 2 clients) where applicable.
- Running `npm run validate` and `npm run build` succeeds and `AGENTS.md` regenerates cleanly.
- Skill-creator eval loop (separate exercise) on ~10 developer prompts shows measurable improvement in trigger rate and answer quality over the current baseline.

## 9. Open Questions

1. ~~**`search-skip-initial-scan` fate** — keep standalone or merge into `search-ft-create-options.md`?~~ **RESOLVED 2026-05-15:** merge into `search-ft-create-options.md` (§5.10). SKIPINITIALSCAN is one flag among several FT.CREATE options — consolidation reduces clutter and reflects its actual scope.
2. ~~**Go coverage** — include `go-redis` as a fourth language across all rules, or keep at CLI + Python + Java + Node?~~ **RESOLVED 2026-05-15:** v1 scope is CLI canonical + redis-py + Jedis only. All other clients (Lettuce, node-redis, go-redis, NRedisStack, .NET) are out of scope for this spec; tracked in §10 as follow-ups.
    - **v1 client shortlist sub-question** (raised after §7 narrowing): which clients ship in this spec? **RESOLVED 2026-05-15:** **`python-redis-py` and `java-jedis` only.** Detailed client-reference specs are tracked separately as **spec 0002** (redis-py) and **spec 0003** (Jedis).
3. ~~**RedisVL prominence** — RedisVL is currently shown only in vector rules. Should search-only rules also reference RedisVL where it has a wrapper?~~ **RESOLVED 2026-05-15:** RedisVL is out of scope for v1. Existing RedisVL content in the four `vector-*` rules will be reduced or footnoted pending a dedicated RedisVL spec (see §10).
4. ~~**Aggregate cursors** — own rule or section inside `search-aggregate-pipeline.md`?~~ **RESOLVED 2026-05-15:** dedicated rule `search-aggregate-cursors.md`. Covers `WITHCURSOR`, `FT.CURSOR READ`, `FT.CURSOR DEL`, cursor lifecycle, and idle timeouts. Cross-links back to `search-aggregate-pipeline.md`.
5. ~~**Naming**: do we rename existing files from `search-*` to `rqe-*` to match "Redis Query Engine"?~~ **RESOLVED 2026-05-15:** Keep `search-*`. Adriano confirmed: *"RQE is no longer the product name, but Redis Search."* The official product name is **Redis Search**. Filenames use `search-*`; titles/headings say "Redis Search"; legacy "RQE" / "Redis Query Engine" mentions get rewritten to "Redis Search" in published files (the source-material glossary in §12 is left verbatim for traceability but rewritten when transcribed to `references/search-syntax-primitives.md`).
6. ~~**Priority of LOW-priority new rules** (5.8–5.10) — ship in this spec or defer to a follow-up spec?~~ **RESOLVED 2026-05-15:** Ship §5.10 (`search-ft-create-options.md`) in v1 — required to support deletion of `search-skip-initial-scan.md` per #1. Defer §5.8 (`search-scoring.md`) and §5.9 (`search-suggest-spellcheck.md`) to a follow-up spec to keep v1 focused on the core syntax gap. Added both to §10 follow-ups.
7. ~~**Glossary placement** — standalone rule, distributed across rules, or dedicated reference doc?~~ **RESOLVED 2026-05-15:** dedicated reference doc at `references/search-syntax-primitives.md` (Option C). Introduces a new `references/` folder to the `redis-development` skill, matching the skill-creator progressive-disclosure pattern.
8. ~~**Reference folder build integration** — `packages/redis-development-build/src/config.ts` currently compiles only `rules/` into `AGENTS.md`. Do we (a) leave `references/` out of the compiled `AGENTS.md` and let it be loaded on demand by agents, or (b) extend the build to include references in a separate section?~~ **RESOLVED 2026-05-15 (reframed):** Conditional loading via rule directives + scope frontmatter + router. Reference *bodies* stay out of `AGENTS.md` (no bulk inclusion); rules emit explicit "Before writing X, read Y" and "If client target = Jedis, read java-jedis (not python-redis-py)" directives; references carry scope frontmatter; and a small `references/README.md` router maps task → reference path. The build inlines only the router table at the top of `AGENTS.md`. Full mechanism specified in §7.8 below.
9. ~~**`FT.HYBRID` verification** — confirm canonical command name, syntax, and minimum Redis version against current `redis.io/docs` and the `redis/redis` repo before writing `search-command-selection.md`.~~ **RESOLVED 2026-05-15:** **FT.HYBRID is real and GA, available since Redis Open Source 8.4.0.** Verified syntax retrieved from `https://redis.io/docs/latest/commands/ft.hybrid/`. Full command signature and worked example captured in §5.0a. `vector-hybrid-search.md` revision must include a version gate: FT.HYBRID for Redis ≥ 8.4.0, pre-filter + KNN via FT.SEARCH for older versions.

## 10. Out-of-Scope Follow-ups

- **Additional client references** — Lettuce (Java), node-redis (TypeScript/JS), go-redis (Go), NRedisStack (.NET). Each becomes its own `references/clients/<lang>-<client>.md` in a follow-up spec when prioritized.
- **`search-scoring.md`** (deferred from §5.8): BM25/TFIDF scorers, `SCORER` clause, `WITHSCORES`, `EXPLAINSCORE`, re-ranking patterns.
- **`search-suggest-spellcheck.md`** (deferred from §5.9): `FT.SUGADD`/`FT.SUGGET` autocomplete, `FT.SPELLCHECK` typo correction, synonyms via `FT.SYNUPDATE`/`FT.SYNDUMP`.
- ~~**RedisVL dedicated coverage**~~ **PARTIALLY UN-DEFERRED 2026-05-15:** the search/index/query surface of RedisVL is now covered by [`0004-redisvl-client-reference.md`](./0004-redisvl-client-reference.md). The LLM-primitive surface (SemanticCache, MessageHistory, SemanticRouter, EmbeddingsCache, Rerankers) remains deferred to a future dedicated spec — likely a new top-level skill outside `redis-development`. The "RedisVL content reduced pending spec" framing in §7.5 is obsolete once spec 0004 lands: existing RedisVL content in `vector-*` rules becomes the L2 client-mirror, with deeper coverage in the new reference.
- **Eval suite for skill triggering quality** (skill-creator iteration loop on ~10–20 realistic developer prompts).
- **Cross-skill links** from `redis-development` to hypothetical `redis-data-modeling` or `redis-rag` skills.
- **Localization** (rules currently English-only).

## 11. Iteration Log

| Date | Change |
|------|--------|
| 2026-05-15 | Initial draft. |
| 2026-05-15 | Added §5.0 foundational reference doc decision (Option C). Resolved open question #7. Added open question #8 (build integration of `references/`). Appended §11 with verbatim source-material glossary from Adriano. |
| 2026-05-15 | Added §5.0a `search-command-selection.md` covering FT.SEARCH vs FT.AGGREGATE vs FT.HYBRID. Flagged `vector-hybrid-search.md` as outdated in §4 inventory — needs to distinguish filter-then-KNN (FT.SEARCH) from blended lexical+vector ranking (FT.HYBRID). Added open question #9 (FT.HYBRID command-name verification). |
| 2026-05-15 | Added §7 Multi-Client & Multi-Language Strategy: three-layer approach (L1 canonical CLI inline, L2 primary Python idiom inline, L3 per-client deep refs in `references/clients/`). Treats RedisVL as a peer to redis-py, not a sub-section. Renumbered subsequent sections (§7→§8 … §11→§12) and updated cross-refs. Resolves Open Question #2 framing (Go and all other clients live in `references/clients/`, not as inline examples in every rule). |
| 2026-05-15 | **Narrowed §7 scope per Adriano directive:** v1 ships CLI canonical + exactly two client extensions (redis-py and Jedis). Removed Lettuce / node-redis / go-redis / NRedisStack / RedisVL from inline scope; moved to §10 follow-ups. Added §7.3 anchoring rules to upstream Redis-maintained example sources (https://github.com/redis/redis-py/tree/master/doctests and https://github.com/redis/jedis/tree/master/src/test/java/io/redis/examples) with explicit rule-to-upstream file mapping. Updated §4 inventory: all four existing `vector-*` rules need RedisVL→CLI/redis-py reframing. Resolved open questions #2 and #3. |
| 2026-05-15 | Resolved Open Question #1: `search-skip-initial-scan.md` deleted, content merged into `search-ft-create-options.md` (§5.10). Resolved Open Question #4: aggregate cursors get their own rule `search-aggregate-cursors.md` (new §5.3a) covering WITHCURSOR + FT.CURSOR READ/DEL + lifecycle. Resolved Open Question #5: keep `search-*` filename prefix. Captured product-name correction from Adriano: **Redis Search** is the official name (not "Redis Query Engine" / "RQE"); updated §6.2 terminology alignment and §5.0 description accordingly. The §12 glossary remains verbatim for traceability but its "RQE" mentions get rewritten to "Redis Search" when transcribed to `references/search-syntax-primitives.md`. |
| 2026-05-15 | Resolved Open Question #6: ship `search-ft-create-options.md` (§5.10) in v1 (required to support #1's deletion of `search-skip-initial-scan.md`); defer `search-scoring.md` (§5.8) and `search-suggest-spellcheck.md` (§5.9) to a follow-up spec. Added both to §10 follow-ups with scope sketches retained. |
| 2026-05-15 | Resolved Open Question #8 (reframed by Adriano): conditional reference loading via rule directives + scope frontmatter + router. Added new §7.8 (Reference Loading Mechanism) specifying frontmatter format, rule directive blocks, `references/README.md` router, build integration (inline router table only — not reference bodies), and a build-time validator that requires the directive block in every rule with client mirrors. Renumbered "Practical rules of thumb" from §7.7 to §7.9. |
| 2026-05-15 | Resolved Open Question #9: **FT.HYBRID verified as real and GA in Redis Open Source 8.4.0** via redis.io official command docs. Captured the verified syntax, time complexity, and worked example in §5.0a. Added a version-gate requirement to the spec: FT.HYBRID for Redis ≥ 8.4.0, fall back to pre-filter + KNN via FT.SEARCH for older Redis. `vector-hybrid-search.md` revision (per §4 inventory) must include this version gate. |
| 2026-05-15 | Resolved v1 client-shortlist sub-question of Open Question #2: confirmed `python-redis-py` + `java-jedis` only. Spun off detailed specs: [`0002-redis-py-client-reference.md`](./0002-redis-py-client-reference.md) and [`0003-jedis-client-reference.md`](./0003-jedis-client-reference.md). Both new specs anchor to their respective upstream example suites, preserve the upstream `STEP_START`/`STEP_END` convention, and reuse the shared Bicycle dataset across clients for cross-language consistency. |
| 2026-05-15 | Added [`0004-redisvl-client-reference.md`](./0004-redisvl-client-reference.md) for the RedisVL Python SDK. Anchored to upstream `redis/redis-vl-python` user-guide notebooks. Partially un-defers the §10 RedisVL follow-up: search/index/query surface is now in scope (covered by spec 0004); LLM-primitive surface (SemanticCache, MessageHistory, SemanticRouter, EmbeddingsCache, Rerankers) remains deferred to a future spec outside `redis-development`. Introduces a compound conditional-loading trigger (`generating-python-code AND library=redisvl`) to disambiguate from raw `redis-py` (spec 0002). |
| 2026-05-15 | Spec 0004 §6 added: consolidation plan for migrating all RedisVL code currently in `rules/vector-*.md` into the new RedisVL reference, preserving the CLI-first convention from §7. Updated §4 inventory entries for all four `vector-*` rules to cite spec 0004 §6 as the migration destination (with specific source-line → destination-section mappings). After implementation, no RedisVL code remains in `rules/`; rules stay CLI-first with redis-py + Jedis L2 mirrors only. |

## 12. Source Material — Glossary (verbatim, authored 2026-05-15)

> Preserved here as the canonical working draft for `references/search-syntax-primitives.md`. Do not edit in place; revise via spec iteration.

Also update the cross-reference in §5.0: source material is now in **§12** below (was §11 before §7 multi-client section was inserted).

**Query Expression:** The complete text input submitted to RQE that defines the search criteria, combining terms, fields, operators, and modifiers to retrieve relevant documents.
`"hello world @category:{electronics} @price:[100 500]"`

**Query Term:** A single word or phrase that represents a discrete unit of search. In RQE, terms can be simple words, quoted phrases, or prefixes with wildcards. Query term preferably should contain field identifier → delimiters → term.
`"smartphone"` or `"@description:wireless"` or `@category:{ele*}`

**Field Identifier:** A prefix that specifies which document field to search in, using the syntax `@fieldname:`. Without a field identifier, RQE searches in all text fields.
`@description:` or `@category:`

**Query Delimiters:** each query term should contain a delimiters that identify the type of query. For text is parenthesis `(foo bar)`, for tag matching is curly brackets `{foo}` and for range or intervals square brackets `[-100 20]`. Parenthesis could also be used to delimiters phrases or group of query terms, wrapping them.
`'((@type:{product} @available:{Available} @price:[-inf 200]) | (@type:{post}))'`

**Query Attributes:** Modifiers that alter how a term is matched or scored (`$weight`), slop and inorder and also optional parameters for the vector query:
`(foo bar) => { $weight: 2.0; $slop: 1; $inorder: false; }`
`<primary_filter_query>=>[KNN <top_k> @<vector_field> $<vector_blob_param> $<vector_query_params> AS <distance_field>]`

**Weight:** A multiplier applied (boosting some query terms or query string) to terms to increase their importance in scoring, indicated by `=>{weight: X}` after a term or a group of terms. Higher boost values give the term more influence on the final relevance score.
`(foo bar) => { $weight: 2.0}`

**Scoring:** The numerical calculation that assigns a relevance value to each document based on how well it matches the query. In RQE, scoring combines factors like term frequency, inverse document frequency, field weights, and explicit boosts.

**Ranking:** The process of ordering search results based on their scores. While scoring is the mathematical calculation, ranking is the application of that calculation to determine result order.

**Sorting:** Explicit ordering of results by field values rather than relevance, specified with the SORTBY parameter or implicitly part of the FT.SEARCH results r in RQE.

**Grouping:** The process of collecting similar documents together based on field values, implemented in RQE using the GROUPBY parameter.

**Similarity:** The degree of approximate matching allowed when searching, controlled by fuzzy matching parameters (using `%{number}` for Levenshtein distance) or phonetic matching. Likewise, the vector closeness given an specific distance metric.

**Filtering:** Restricting search results based on numeric, tag, or geo criteria rather than text relevance, implemented via dedicated matching or range.

**Operators:** allow combine multiple query terms in a query string.
- **AND** (space): The default operator in RQE that requires all terms to appear (implicit between terms).
- **OR** (`|`): Specified by a pipe symbol (`|`) between terms, retrieving documents matching any of the terms.
- **Negation** (`-`): Marked by a minus sign (`-`) before a term, excluding documents containing that term.
- **Optional** (tilde `~`): Terms preceded by `~` are optional but contribute to the relevance score when present, unlike strict Boolean operators.

---

**Next step:** review and refine this spec. No code or rule files will be written until this spec is explicitly approved.
