# Spec 0002 — `references/clients/python-redis-py.md`

| Field | Value |
|-------|-------|
| Status | Draft |
| Author | Adriano Amaral |
| Created | 2026-05-15 |
| Parent spec | [`0001-search-syntax-coverage.md`](./0001-search-syntax-coverage.md) |
| Skill | `skills/redis-development` |
| Target file | `skills/redis-development/references/clients/python-redis-py.md` |
| Companion spec | [`0003-jedis-client-reference.md`](./0003-jedis-client-reference.md) |

---

## 1. Problem Statement

Spec 0001 establishes a CLI-first rule set with two client extensions: `redis-py` and Jedis. Per §7.4 of spec 0001, `references/clients/python-redis-py.md` is the comprehensive reference doc for the Python client. This spec defines what that file contains, how it sources content from the upstream redis-py doctest suite, and how it is loaded conditionally per spec 0001 §7.8.

The reference exists because **rule files only carry short L2 mirrors** (≤15 lines per spec 0001 §7.2). Agents generating real `redis-py` code need: connection patterns, full schema API, all query commands with idiomatic call shapes, version-specific gotchas, and links into the upstream doctests for end-to-end runnable examples. That depth belongs in a reference, not stuffed into every rule.

## 2. Goals

1. Produce a single Python-only reference that an agent generating `redis-py` code can fully rely on.
2. Mirror the upstream `redis-py` doctest suite — do not invent code shapes that disagree with what Redis publishes.
3. Cover every Redis Search command the v1 rules cover (`FT.CREATE`, `FT.SEARCH`, `FT.AGGREGATE`, `FT.HYBRID`, `FT.CURSOR *`, `FT.EXPLAIN`, `FT.PROFILE`, `FT.INFO`, `FT.ALIASADD/UPDATE/DEL`, `FT.DROPINDEX`).
4. Make the reference loadable conditionally (per spec 0001 §7.8) with frontmatter declaring scope and applicability.
5. Surface client-specific gotchas: DIALECT defaults across redis-py versions, `decode_responses=True`, `Query()` vs raw string, `IndexDefinition`, JSON vs HASH idioms, vector parameter encoding (`np.array(...).tobytes()`).

## 3. Non-Goals

- **Not** a `redis-py` tutorial. The reader is assumed to know Python and basic Redis.
- **Not** RedisVL. RedisVL is its own SDK and gets a separate spec (see spec 0001 §10).
- **Not** async (`redis.asyncio`). Sync only in v1; async is a follow-up sub-section if demand emerges.
- **Not** repeating the query DSL grammar — that lives in `references/search-syntax-primitives.md` and is linked, not duplicated.
- **Not** a comprehensive `redis-py` client reference — only the FT.* (Redis Search) surface.

## 4. Source Material

Primary source: https://github.com/redis/redis-py/tree/master/doctests

| Upstream file | Informs section |
|---------------|-----------------|
| `search_quickstart.py` | Connection, index creation, end-to-end pipeline |
| `query_ft.py` | Full-text query idioms (`Query("@field:value")`, wildcards, fuzzy) |
| `query_em.py` | Exact-match queries (TAG, NUMERIC) |
| `query_range.py` | Numeric range queries, inclusive/exclusive bounds |
| `query_geo.py` | Geo queries (radius, polygon) |
| `query_agg.py` | `AggregateRequest`, `GROUPBY`, `REDUCE`, `APPLY`, `FILTER`, `SORTBY`, `LIMIT` |
| `query_combined.py` | Combined filter + vector queries (pre-filter + KNN) |
| `search_vss.py` | Vector indexing and KNN/range queries |
| `home_json.py`, `dt_json.py` | JSON indexing via `IndexType.JSON` and `Path` |
| `geo_index.py` | Geo index creation patterns |

**Upstream conventions to preserve:**
- `# STEP_START <label>` / `# STEP_END` markers delimit teachable steps. The reference file uses the same step labels as upstream so an agent can cross-reference.
- The shared **Bicycle dataset** is the canonical example dataset across `query_*.py`. Reuse it; do not invent a fresh dataset.
- Imports always come from `redis.commands.search.*` submodules (`field`, `index_definition`, `query`, `aggregation`, `reducers`).

## 5. Target File Structure

Frontmatter (per spec 0001 §7.8):

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
  redis: "7.4"
  redis_for_ft_hybrid: "8.4.0"
sourceUpstream: https://github.com/redis/redis-py/tree/master/doctests
---
```

Body sections (fixed TOC):

1. **Minimum supported versions** — table: client version × Redis version × FT.* feature availability (especially DIALECT defaults, FT.HYBRID 8.4.0 gate).
2. **Connection setup** — `redis.Redis(host=..., port=..., decode_responses=True)`. Why `decode_responses=True` is the right default for FT.* results. Connection-pool note.
3. **Schema imports** — the canonical import block (`TextField`, `TagField`, `NumericField`, `GeoField`, `GeoShapeField`, `VectorField`, `IndexDefinition`, `IndexType`).
4. **Create index — HASH** — pattern + worked example mirroring `search_quickstart.py`.
5. **Create index — JSON** — pattern + worked example mirroring `home_json.py`. Note the `$.path` syntax + `as_name=` alias.
6. **FT.SEARCH idioms** — `Query()` builder: `paging`, `sort_by`, `return_fields`, `with_scores`, `no_content`, `verbatim`, `dialect`, `params`. NumericFilter usage.
7. **FT.AGGREGATE idioms** — `AggregateRequest` builder: `.group_by()`, `.reduce()`, `.apply()`, `.filter()`, `.sort_by()`, `.limit()`. Worked example from `query_agg.py`.
8. **Cursors** — `AggregateRequest(...).with_cursor()`, `ft.cursor_read()`, `ft.cursor_del()`. Mirror upstream where available.
9. **Vector queries** — building the KNN/RANGE query string with PARAMS, encoding vectors (`np.array(...).astype(np.float32).tobytes()`), reading score back via `RETURN` alias. Mirror `search_vss.py` + `query_combined.py`.
10. **FT.HYBRID** — `redis-py` calling shape for `FT.HYBRID` (raw command via `execute_command` if no high-level wrapper yet — note in §10 open questions).
11. **Debugging** — `ft.explain()`, `ft.profile()`, `ft.info()` calling shapes and output parsing tips.
12. **Index management** — `ft.alter_schema_add()`, `ft.aliasadd/aliasupdate/aliasdel()`, `ft.dropindex()`.
13. **Common errors & version gotchas** — DIALECT defaults across versions, JSON serialization pitfalls, `decode_responses` mismatches, vector dtype/dimension errors, FT.HYBRID version gate.
14. **Upstream examples index** — curated table of `STEP_START` labels in upstream doctests mapped to the operation they demonstrate, so an agent can fetch the runnable example by step name.

## 6. Cross-References

- The reference does **not** duplicate the query DSL grammar. It links to `references/search-syntax-primitives.md` at the top, then shows only how `redis-py` *expresses* that grammar (`Query("@brand:{electronics}")` rather than re-explaining what `{...}` means).
- The reference does **not** duplicate rule content. It links forward to rules in `rules/search-*.md` for "what to do" and shows only "how to express it in redis-py."
- Cross-link from every section to the corresponding section of `references/clients/java-jedis.md` so an agent verifying behavior cross-client has a paired pointer.

## 7. Acceptance Criteria

- An agent given the task *"write redis-py code to create a JSON-indexed search index for bicycles and run a numeric range query for price between 100 and 500"* produces code that:
  - Matches the upstream `search_quickstart.py` + `query_range.py` patterns.
  - Uses `IndexType.JSON` (not HASH).
  - Uses `Query("@price:[100 500]")` or `NumericFilter("price", 100, 500)`.
  - Does not invent imports or call shapes that don't exist in the actual `redis-py` API.
- The reference file passes the build-time validator: it has the required frontmatter scope/triggerWhen/appliesTo fields.
- All section examples are traceable to a specific upstream doctest file (cited inline or in the §14 examples index).
- An agent generating Java code does NOT load this file (verified by the conditional-loading mechanism in spec 0001 §7.8).

## 8. Open Questions

1. **FT.HYBRID wrapper status in redis-py** — does the current `redis-py` ship a high-level `FT.HYBRID` method, or must callers use `execute_command("FT.HYBRID", ...)`? Verify against `redis-py` source before writing §10 of the reference. (If raw `execute_command` is the only path, note that explicitly so agents don't generate code calling a method that doesn't exist.)
2. **Async section** — defer entirely or include a compact note pointing to `redis.asyncio.Redis` and the parallel `asyncio` test files in upstream? Recommendation: brief footer pointing to upstream async examples, no full coverage in v1.
3. **`Query` vs `AggregateRequest` discoverability** — `redis-py` splits the API into two different builders depending on command. The reference should call this out explicitly because it's a common source of confusion for new users.
4. **Vector encoding helper** — does redis-py provide one, or is `numpy.tobytes()` the de facto pattern? Confirm and document the single recommended path; do not show multiple ways.
5. **Dataset hosting** — the Bicycle JSON dataset lives in upstream `doctests/data/`. Do we vendor a copy into the skill or link to upstream? Recommendation: link to upstream, no vendoring — the dataset is large and would inflate the repo without value.

## 9. Out-of-Scope Follow-ups

- **Async coverage** (`redis.asyncio`) — own sub-section in a future spec if/when async patterns diverge meaningfully from sync.
- **Cluster-aware patterns** — Redis Cluster + FT.* behavior, hash-tag co-location for indexed keys. Tracked in `cluster-*` rules of the broader `redis-development` skill, not here.
- **Pipeline + FT.* interactions** — combining `r.pipeline()` with FT.SEARCH responses has quirks; defer.

## 10. Iteration Log

| Date | Change |
|------|--------|
| 2026-05-15 | Initial draft. Anchored to upstream redis-py doctests with file-by-section mapping. Adopted upstream `STEP_START`/`STEP_END` convention and Bicycle dataset. |
