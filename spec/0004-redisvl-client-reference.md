# Spec 0004 — `references/clients/python-redisvl.md`

| Field | Value |
|-------|-------|
| Status | Draft |
| Author | Adriano Amaral |
| Created | 2026-05-15 |
| Parent spec | [`0001-search-syntax-coverage.md`](./0001-search-syntax-coverage.md) |
| Skill | `skills/redis-development` |
| Target file | `skills/redis-development/references/clients/python-redisvl.md` |
| Companion specs | [`0002-redis-py-client-reference.md`](./0002-redis-py-client-reference.md), [`0003-jedis-client-reference.md`](./0003-jedis-client-reference.md) |

---

## 1. Problem Statement

RedisVL ("Redis Vector Library") is **not just another Python wrapper around Redis Search**. It is a higher-level, schema-first, AI-native Python SDK that builds on `redis-py` and adds:

- Declarative `IndexSchema` / YAML schema for index definition
- Object-oriented `SearchIndex` lifecycle management
- A dedicated query class hierarchy (`VectorQuery`, `FilterQuery`, `RangeQuery`, `CountQuery`, `TextQuery`, `AggregationQuery`)
- A `FilterExpression` DSL that produces Redis Search filter strings from Python operators
- Integrated **vectorizers** (OpenAI, HuggingFace, Vertex, Cohere, Azure OpenAI, Bedrock, custom)
- **Rerankers** (HuggingFace, Cohere, VoyageAI cross-encoders)
- AI primitives: `SemanticCache`, `MessageHistory`, `SemanticRouter`, `EmbeddingsCache`
- An `rvl` CLI utility for index/schema management

The four existing `vector-*` rules in the `redis-development` skill already use RedisVL heavily, so a developer using RedisVL is a real audience. Spec 0001 §7.5 deferred RedisVL coverage as out-of-scope for v1 (which narrowed to `redis-py` + Jedis); this spec restores RedisVL as a dedicated reference, on the same conditional-loading footing as the other two clients.

The reference exists because RedisVL's idioms diverge significantly from raw `redis-py` — agents asked to generate RedisVL code must use the right schema shape, the right query class, and the right vectorizer wiring. Showing those idioms requires meaningful space that doesn't belong in `rules/`.

## 2. Goals

1. Produce a single Python-only reference covering the **search/index/query surface** of RedisVL.
2. Mirror the upstream RedisVL user-guide notebooks — do not invent code shapes that disagree with what Redis publishes.
3. Cover the schema-first lifecycle: `IndexSchema.from_dict`, `IndexSchema.from_yaml`, `SearchIndex(schema)`, `SearchIndex.create`, `.exists`, `.delete`, `.load`, `.fetch`, `.query`, `.search`.
4. Cover every query class: `VectorQuery`, `FilterQuery`, `RangeQuery`, `CountQuery`, `TextQuery`, `AggregationQuery`, and `HybridQuery` (when present — see Open Question #1).
5. Cover the `FilterExpression` DSL (Tag, Text, Num, Geo, and boolean compositions).
6. Cover **vectorizers** as a category (one canonical example, pointers to the rest) so agents can wire embeddings without reinventing the pattern.
7. Surface AI-primitive sections at a *summary* level (SemanticCache, MessageHistory, SemanticRouter) — each linking to its own future spec/section for deep coverage.
8. Make the reference loadable conditionally (per spec 0001 §7.8) with frontmatter declaring scope, applicability, and the `redisvl` trigger.

## 3. Non-Goals

- **Not** a RedisVL tutorial. The reader is assumed to know Python and basic Redis Search.
- **Not** a re-explanation of the query DSL — that lives in `references/search-syntax-primitives.md`.
- **Not** deep coverage of LLM primitives (`SemanticCache`, `MessageHistory`, `SemanticRouter`, `EmbeddingsCache`) — they get summary sections only; full coverage deferred to its own spec when prioritized (see §9 follow-ups).
- **Not** a vendor-by-vendor vectorizer catalog — show one canonical example (likely OpenAI), then list the others by class name with one-line summaries.
- **Not** raw `redis-py` coverage — that is spec 0002. The RedisVL reference assumes the agent has chosen RedisVL and explicitly does not duplicate `redis-py` content.
- **Not** the `rvl` CLI tool in v1 — defer to a follow-up sub-section.

## 4. Source Material

Primary source: https://github.com/redis/redis-vl-python (default branch: `main`)

Upstream user-guide notebooks: https://github.com/redis/redis-vl-python/tree/main/docs/user_guide

| Upstream file | Informs section |
|---------------|-----------------|
| `01_getting_started.ipynb` | Schema definition, `SearchIndex` lifecycle, basic load + query |
| `02_complex_filtering.ipynb` | `FilterExpression` DSL: Tag, Text, Num, Geo, boolean composition |
| `04_vectorizers.ipynb` | Vectorizers — the canonical example + provider table |
| `05_hash_vs_json.ipynb` | Storage type choice and indexed-field implications |
| `11_advanced_queries.ipynb` | All query classes, hybrid patterns, aggregations |
| `12_sql_to_redis_queries.ipynb` | Translating SQL-shaped intent to RedisVL queries (useful agent-side mental model) |
| `schema.yaml` | The canonical YAML schema example |
| `03_llmcache.ipynb` | Summary-only: SemanticCache section |
| `07_message_history.ipynb` | Summary-only: MessageHistory section |
| `08_semantic_router.ipynb` | Summary-only: SemanticRouter section |
| `06_rerankers.ipynb` | Summary-only: Rerankers section |
| `09_svs_vamana.ipynb` | Advanced vector algorithm coverage (mention; defer if pre-GA) |
| `10_embeddings_cache.ipynb` | Summary-only: EmbeddingsCache section |
| `13_langcache_semantic_cache.ipynb` | Cross-link only — LangCache is a separate skill area in the broader `redis-development` skill |

**Upstream conventions to preserve:**
- Notebooks are heavily prose-narrated. **The reference distills minimum running code from each cell**, not the prose. Each section in the reference cites the originating notebook by name.
- RedisVL examples typically use a small documents/sentences dataset (varies by notebook). The reference should adopt a single consistent dataset across its examples — recommend reusing the **Bicycle dataset** from specs 0002/0003 where it fits, for cross-client parity. Where Bicycle doesn't fit (vectorizer demos that need text-embedding-friendly content), adopt the upstream notebook's dataset for that section verbatim.
- Imports always come from `redisvl.index`, `redisvl.schema`, `redisvl.query`, `redisvl.query.filter`, `redisvl.utils.vectorize`, `redisvl.extensions.*`.

## 5. Target File Structure

Frontmatter (per spec 0001 §7.8):

```yaml
---
title: RedisVL — Redis Search quick reference
scope: client-idioms
triggerWhen: generating-python-code AND library=redisvl
appliesTo:
  client: redisvl
  language: python
minimumVersion:
  client: "0.5"           # confirm against latest release
  redis: "7.4"
  redis_for_ft_hybrid: "8.4.0"
sourceUpstream: https://github.com/redis/redis-vl-python
relatedReferences:
  - python-redis-py.md    # RedisVL is built on redis-py; agents may need both for low-level ops
---
```

Body sections (fixed TOC):

1. **When to choose RedisVL over raw `redis-py`** — a short opening that helps an agent decide. RedisVL when: schema-first authoring, vectorizer integration, LLM primitives, async-friendly. `redis-py` when: low-level control, minimal dependencies, non-AI Redis usage.
2. **Minimum supported versions** — RedisVL client version × `redis-py` version × Redis version × feature availability (notably the FT.HYBRID 8.4.0 gate and any RedisVL methods that need it).
3. **Connection** — `SearchIndex.from_existing(...)`, `SearchIndex(schema, redis_url=...)`, `redis_client=` injection (when sharing a `redis-py` client).
4. **Schema definition — Python dict** — `IndexSchema.from_dict({...})` worked example. Mirror notebook `01_getting_started.ipynb`.
5. **Schema definition — YAML** — `IndexSchema.from_yaml(path)` and the canonical `schema.yaml` shape. Mirror `schema.yaml` upstream.
6. **Storage type: HASH vs JSON** — mirror `05_hash_vs_json.ipynb`. Trade-offs and indexing implications.
7. **Index lifecycle** — `index.create(overwrite=...)`, `.exists()`, `.delete(drop=...)`, `.load(...)`, `.fetch(...)`, `.update_load(...)`.
8. **`FilterExpression` DSL** — Tag, Text, Num, Geo classes; operator overloads (`&`, `|`, `~`); how it compiles to the canonical query syntax (`@field:{value}`, `@field:[min max]`). Mirror `02_complex_filtering.ipynb`.
9. **Query classes** — table + worked example for each: `VectorQuery`, `FilterQuery`, `RangeQuery` (vector range), `CountQuery`, `TextQuery`, `AggregationQuery`. Mirror `11_advanced_queries.ipynb`.
10. **Vectorizers** — one canonical example (likely `OpenAITextVectorizer`) plus a provider table (`HFTextVectorizer`, `VertexAITextVectorizer`, `CohereTextVectorizer`, `AzureOpenAITextVectorizer`, `BedrockTextVectorizer`, `CustomTextVectorizer`). Mirror `04_vectorizers.ipynb`.
11. **Hybrid retrieval** — RedisVL's pattern for combining text + vector. If `HybridQuery` exists and wraps `FT.HYBRID`, document it. Otherwise show the pre-filter+KNN pattern via `VectorQuery` with a `filter_expression`. See Open Question #1.
12. **Async** — `AsyncSearchIndex` parallels sync; brief section showing the call shapes that differ.
13. **LLM primitives (summary level)** — three short subsections:
    - **SemanticCache** — what it is, one-liner constructor, link to `03_llmcache.ipynb`.
    - **MessageHistory** — same shape.
    - **SemanticRouter** — same shape.
    Each notes that full coverage lives in a future dedicated spec/reference.
14. **Common errors & version gotchas** — schema version mismatch, vector dim/dtype errors, vectorizer auth setup, RedisVL/redis-py version skew, FT.HYBRID version gate.
15. **Upstream examples index** — curated table mapping operations to the notebook + cell that demonstrates them.

## 6. Consolidation from Existing `vector-*` Rules

This spec absorbs all RedisVL code currently living in `skills/redis-development/rules/vector-*.md`. After implementation, **no RedisVL code remains in `rules/`** — every RedisVL example migrates into `references/clients/python-redisvl.md`. The vector rules are then reframed CLI-first per spec 0001 §7, with `redis-py` and Jedis as the two short L2 client mirrors. This preserves the CLI-first convention from spec 0001 unchanged: rules teach *what to do* in CLI form; the reference teaches *how RedisVL expresses it*.

### 6.1 Inventory of existing RedisVL examples (audited 2026-05-15)

| Source rule | Lines | Existing RedisVL content |
|-------------|-------|--------------------------|
| `vector-index-creation.md` | 51–71 | `IndexSchema.from_dict({...})` with text + vector fields; `SearchIndex(schema).create(overwrite=True)` |
| `vector-algorithm-choice.md` | 22–37 | RedisVL HNSW schema with `M`, `EF_CONSTRUCTION` attrs |
| `vector-algorithm-choice.md` | 40–53 | RedisVL FLAT schema (paired with HNSW for comparison) |
| `vector-hybrid-search.md` | 17–28 | `VectorQuery` with `filter_expression="@category:{technology} @date:[2024 2025]"` |
| `vector-hybrid-search.md` | 32–41 | `VectorQuery` without filter (current "Incorrect" example) |
| `vector-rag-pattern.md` | 17–40 | Full RAG pipeline: `index.load()` → `VectorQuery` → context build → LLM call |
| `vector-hybrid-search.md` frontmatter | tags line | `redisvl` listed as a tag — remove on rule reframe |

### 6.2 Migration mapping (source → destination)

| Source rule + content | Destination section in `python-redisvl.md` |
|------------------------|--------------------------------------------|
| `vector-index-creation.md` schema dict + `.create()` call | §5.4 Schema definition — Python dict; §5.7 Index lifecycle |
| `vector-algorithm-choice.md` HNSW dict | §5.4 (with algorithm attrs nested under the vector field) |
| `vector-algorithm-choice.md` FLAT dict | §5.4 (paired with HNSW for comparison) |
| `vector-hybrid-search.md` filtered `VectorQuery` | §5.8 `FilterExpression` DSL; §5.11 Hybrid retrieval (pre-filter pattern for Redis < 8.4.0) |
| `vector-hybrid-search.md` unfiltered anti-pattern | §5.11 "Anti-pattern: searching entire vector space when filters apply" callout |
| `vector-rag-pattern.md` full pipeline | §5.7 + §5.9; also referenced from a use-case pointer mirroring upstream `docs/user_guide/use_cases/` |

### 6.3 What stays in `rules/` after migration

The four `vector-*` rules are reframed per spec 0001 §4 (inventory) and §7 (multi-client strategy):

- **L1 (always):** CLI canonical form — `FT.CREATE ... VECTOR HNSW ...`, `FT.SEARCH '*=>[KNN ...]'`, `(@filter)=>[KNN ...]`. The rule's *primary* content.
- **L2 (short mirrors, ≤15 lines each):** `redis-py` snippet via `redis.Redis().ft(...)`; Jedis snippet via `RedisClient` + `FTCreateParams` / `Query`.
- **No RedisVL inline.** Rules point to the reference via the spec 0001 §7.8(b) directive block:

  ```markdown
  **Client mirrors — read exactly one:**
  - For raw redis-py targets, read `references/clients/python-redis-py.md`.
  - For Jedis (Java) targets, read `references/clients/java-jedis.md`.
  - For RedisVL targets, read `references/clients/python-redisvl.md`.
  - Do not read more than one client reference.
  ```

### 6.4 Rule-side migration checklist (for the implementer)

For each `vector-*` rule:

1. Promote the CLI example to the top of the rule. If the rule currently leads with Python/RedisVL, swap.
2. Move all RedisVL code blocks out — append them to the destination sections of the RedisVL reference file (per §6.2 mapping).
3. Replace the removed RedisVL blocks with short `redis-py` and Jedis mirrors (≤15 lines each), distilled from the upstream sources per specs 0002 and 0003.
4. Remove `redisvl` from the rule's `tags:` frontmatter.
5. Add the §6.3 directive block to the rule's "Client mirrors" section.
6. Verify the rule's `description:` field still triggers correctly without the RedisVL signal.

### 6.5 Why this preserves the CLI-first convention

Spec 0001 §7 commits to: CLI canonical inside every rule (L1, always); short client mirrors inline (L2, ≤15 lines each); deep client coverage in `references/clients/*.md` (L3). Today the `vector-*` rules drift from this — RedisVL idioms appear inline alongside (sometimes instead of) the CLI form, and the RedisVL block is often longer than the CLI block. This spec corrects the drift:

- Rules become CLI-first and stay that way.
- RedisVL's distinctive value (schema-first authoring, vectorizers, `FilterExpression` DSL) is preserved and *expanded* in the reference, not deleted.
- An agent that doesn't need RedisVL never loads it (per spec 0001 §7.8 conditional loading).
- An agent that needs RedisVL gets the full picture in one place, not fragmented across rule files.

## 7. Cross-References

- Top of file links to `references/search-syntax-primitives.md` for query DSL grammar.
- Cross-link to `references/clients/python-redis-py.md` because RedisVL is built on `redis-py`. When an agent needs an FT.* command not exposed at the RedisVL level, it should fall through to raw `redis-py`. The reference explicitly flags this fallthrough pattern.
- Cross-link to `references/clients/java-jedis.md` only via the shared upstream Bicycle dataset note — there is no direct functional parity since RedisVL is Python-only.

## 8. Acceptance Criteria

- An agent given the task *"using RedisVL, define a JSON-indexed schema for bicycles and run a KNN vector query that filters by price range"* produces code that:
  - Uses `IndexSchema.from_dict` (or `from_yaml`) with a correct nested fields structure.
  - Uses `VectorQuery` with a `filter_expression=Num("price") < 500` (or equivalent).
  - Uses `index.create(overwrite=True)` then `index.load(...)` then `index.query(query)`.
  - Does not invent class names or kwargs that don't exist in the actual RedisVL API.
- The reference file passes the build-time validator: it has the required frontmatter scope/triggerWhen/appliesTo fields, with `appliesTo.client: redisvl` and `appliesTo.language: python`.
- All section examples are traceable to a specific upstream notebook (cited inline or in the §15 examples index).
- An agent generating raw `redis-py` code does NOT load this file unless RedisVL is explicitly named in the task. The conditional-loading mechanism in spec 0001 §7.8 must use the `library=redisvl` trigger to disambiguate.
- An agent generating Java/Jedis code never loads this file.

## 9. Decision Points

### 9.1 Scope of LLM primitives in this spec

Recommendation: **summary-only** in v1 (§13 of the reference). Each primitive gets ~10 lines: what it does, the minimal constructor, the upstream notebook reference. Full coverage of SemanticCache + MessageHistory + SemanticRouter is deferred to a follow-up spec (likely a dedicated `redis-ai-primitives` skill rather than living inside `redis-development`). This keeps the v1 RedisVL reference focused on the search/index/query surface that parallels specs 0002 and 0003.

### 9.2 Vectorizer coverage depth

Recommendation: **one canonical example + provider table**. Showing all 7+ providers in detail bloats the reference and most of the API surface is identical (`vectorizer.embed(text)`, `vectorizer.embed_many(texts)`). The provider table lists class names, auth requirements, and dimensions — enough for an agent to pick one and look up provider-specific docs.

### 9.3 Where RedisVL sits in the conditional-loading mechanism

The trigger `triggerWhen: generating-python-code` alone is too broad — it would also fire for raw `redis-py`. The frontmatter introduces a compound trigger: `generating-python-code AND library=redisvl`. The router file (`references/README.md`, per spec 0001 §7.8) needs to distinguish:

| Task signal | Reference |
|-------------|-----------|
| "use redis-py", no library mention | `clients/python-redis-py.md` |
| "use redisvl", "use Redis Vector Library", any RedisVL class name | `clients/python-redisvl.md` |
| Both signals present | Read both; RedisVL builds on `redis-py` |

This adds a small disambiguation requirement to the router — call it out explicitly there.

## 10. Open Questions

1. **`HybridQuery` / FT.HYBRID wrapper in RedisVL** — does the current RedisVL release expose a high-level wrapper around FT.HYBRID (now GA in Redis 8.4.0 per spec 0001 §5.0a)? Verify against the RedisVL repo before writing §11 of the reference. If no wrapper exists yet, document the pre-filter + `VectorQuery` pattern as the current path and note the gap for future revision.
2. **Minimum RedisVL version** — RedisVL has evolved rapidly. Pin a specific version in the frontmatter (current latest as of 2026-05) and call out any methods that changed signature in recent releases.
3. **Async parity** — confirm `AsyncSearchIndex` is at full parity with sync `SearchIndex`. If there are missing methods or differences in signatures, document them.
4. **Bicycle dataset fit** — the Bicycle dataset works well for filter/range queries (its native habitat in upstream specs 0002 and 0003) but is awkward for vectorizer demos (the descriptions are real prose but very domain-specific). Decide whether to reuse Bicycle everywhere or adopt RedisVL's upstream sentence/document datasets for the vectorizer + AI-primitive sections.
5. **`rvl` CLI tool** — include a brief section in v1 or defer entirely? Recommendation: defer. The CLI is a productivity tool; agents generating Python code rarely need it.
6. **SVS Vamana coverage** — notebook `09_svs_vamana.ipynb` covers SVS Vamana (Intel's vector algorithm). Is this GA in Redis? If pre-GA or platform-specific (Intel CPU optimization), mention it as "advanced/optional" with a version note rather than treating it as first-class alongside HNSW/FLAT.
7. **LangCache** — notebook `13_langcache_semantic_cache.ipynb` references "LangCache" which is a Redis-hosted semantic cache product, distinct from the in-process `SemanticCache` class. Confirm this is the right interpretation and link to the appropriate skill area (the broader `redis-development` skill has a `semantic-cache-*` rule prefix that may already cover LangCache).

## 11. Out-of-Scope Follow-ups

- **Dedicated AI-primitives spec** covering `SemanticCache`, `MessageHistory`, `SemanticRouter`, `EmbeddingsCache`, and Rerankers in depth. Likely a new top-level skill rather than living inside `redis-development`.
- **`rvl` CLI reference** — covered in a follow-up if/when agents need command-line guidance.
- **Vectorizer-specific deep dives** — provider-by-provider auth, batching, rate-limiting, cost considerations. Each is its own potential follow-up.
- **RedisVL custom-vectorizer authoring** — how to subclass and contribute a new vectorizer.
- **SVS Vamana** dedicated coverage when/if it becomes broadly available.

## 12. Update to Spec 0001

This spec **un-defers** a §10 follow-up in spec 0001:

> ~~**RedisVL dedicated coverage** — RedisVL is a higher-level schema-first Python SDK with semantic caching, message history, and routing. It deserves its own spec covering both how it wraps RQE and its unique features. Existing RedisVL content in `vector-*` rules is reduced (not deleted) pending that spec.~~

Replaced by: the **search/index/query surface** of RedisVL is now covered by this spec (0004). The LLM-primitive surface (SemanticCache, MessageHistory, SemanticRouter, EmbeddingsCache, Rerankers) remains deferred to a future dedicated spec — likely outside `redis-development`.

When this spec is implemented, the four existing `vector-*` rules can keep their short RedisVL snippets (relocated to L2 client-mirror sections per spec 0001 §7.2 with the deeper coverage living here in the reference). The "RedisVL content reduced pending spec" framing in spec 0001 §7.5 becomes obsolete.

## 13. Iteration Log

| Date | Change |
|------|--------|
| 2026-05-15 | Initial draft. Anchored to upstream `redis/redis-vl-python` user-guide notebooks. Adopted the conditional-loading mechanism from spec 0001 §7.8 with a compound trigger (`generating-python-code AND library=redisvl`) and a router disambiguation note. Decided summary-only treatment of LLM primitives in v1 — full coverage deferred to a separate spec. |
| 2026-05-15 | Added §6 (Consolidation from Existing `vector-*` Rules) with: (a) audited inventory of all RedisVL code currently in `rules/vector-*.md`; (b) explicit migration mapping from source rule + lines to destination section in the new reference; (c) statement of what stays in `rules/` after migration (CLI L1 + redis-py + Jedis L2 only, no RedisVL inline); (d) rule-side migration checklist for the implementer; (e) explanation of how this preserves the CLI-first convention from spec 0001 §7. Renumbered sections §7→§13. |
