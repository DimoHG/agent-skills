# Spec 0003 — `references/clients/java-jedis.md`

| Field | Value |
|-------|-------|
| Status | Draft |
| Author | Adriano Amaral |
| Created | 2026-05-15 |
| Parent spec | [`0001-search-syntax-coverage.md`](./0001-search-syntax-coverage.md) |
| Skill | `skills/redis-development` |
| Target file | `skills/redis-development/references/clients/java-jedis.md` |
| Companion spec | [`0002-redis-py-client-reference.md`](./0002-redis-py-client-reference.md) |

---

## 1. Problem Statement

Spec 0001 establishes a CLI-first rule set with two client extensions: `redis-py` and Jedis. Per §7.4 of spec 0001, `references/clients/java-jedis.md` is the comprehensive reference doc for the Java client. This spec defines what that file contains, how it sources content from the upstream Jedis examples suite, and how it is loaded conditionally per spec 0001 §7.8.

Like spec 0002, the rule files only carry short L2 mirrors. Agents generating real Jedis code need: client construction (`RedisClient` vs `UnifiedJedis` vs `JedisPooled` — see Open Question #1), the full `SchemaField` / `FTCreateParams` API, query builder shapes for `FT.SEARCH` / `FT.AGGREGATE` / `FT.HYBRID`, vector encoding (`float[]` → byte buffer), and version-specific gotchas across Jedis 5.x → 6.x.

## 2. Goals

1. Produce a single Java-only reference that an agent generating Jedis code can fully rely on.
2. Mirror the upstream Jedis examples — do not invent code shapes that disagree with what Redis publishes.
3. Cover every Redis Search command the v1 rules cover (`FT.CREATE`, `FT.SEARCH`, `FT.AGGREGATE`, `FT.HYBRID`, `FT.CURSOR *`, `FT.EXPLAIN`, `FT.PROFILE`, `FT.INFO`, `FT.ALIASADD/UPDATE/DEL`, `FT.DROPINDEX`).
4. Make the reference loadable conditionally (per spec 0001 §7.8) with frontmatter declaring scope and applicability.
5. Surface client-specific gotchas: Jedis client-class evolution (`Jedis` → `UnifiedJedis` → `JedisPooled` → `RedisClient`), deprecated `Schema` class vs current `SchemaField[]`, fluent-builder patterns (`TextField.of("$.brand").as("brand")`), JSON path indexing via `Path2`.

## 3. Non-Goals

- **Not** a Jedis tutorial. The reader is assumed to know Java and basic Redis.
- **Not** Lettuce. Lettuce is its own client and gets a separate spec (see spec 0001 §10).
- **Not** Spring Data Redis. Distinct abstraction layer; out of scope.
- **Not** repeating the query DSL grammar — that lives in `references/search-syntax-primitives.md` and is linked, not duplicated.
- **Not** a comprehensive Jedis client reference — only the FT.* (Redis Search) surface.

## 4. Source Material

Primary source: https://github.com/redis/jedis/tree/master/src/test/java/io/redis/examples

| Upstream file | Informs section |
|---------------|-----------------|
| `SearchQuickstartExample.java` | Connection, JSON index creation, end-to-end pipeline |
| `QueryFtExample.java` | Full-text query idioms via `Query` |
| `QueryEmExample.java` | Exact-match queries (TAG, NUMERIC) |
| `QueryRangeExample.java` | Numeric range queries |
| `QueryGeoExample.java` | Geo queries (radius, polygon) |
| `QueryAggExample.java` | `AggregationBuilder`, `Reducers`, `SortedField`, GroupBy chain |
| `VectorSetExample.java` | Vector indexing and KNN/range queries *(verify file name is current)* |
| `HomeJsonExample.java`, `JsonExample.java` | JSON indexing via `Path2` and `IndexDataType.JSON` |
| `GeoIndexExample.java` | Geo index creation patterns |

**Upstream conventions to preserve:**
- `// STEP_START <label>` / `// STEP_END` markers parallel redis-py's Python comments. Same step labels across the two clients enable cross-language anchoring.
- The shared **Bicycle dataset** appears in both Jedis and redis-py examples. Reuse it; do not invent fresh data.
- Imports always come from `redis.clients.jedis.search.*`, `redis.clients.jedis.search.schemafields.*`, `redis.clients.jedis.search.aggr.*`.
- Latest examples use `RedisClient.create("localhost", 6379)`. This is newer than the `UnifiedJedis` / `JedisPooled` patterns shown in older docs and many community blog posts — flag this divergence explicitly (see Open Question #1).

## 5. Target File Structure

Frontmatter (per spec 0001 §7.8):

```yaml
---
title: Jedis — Redis Search quick reference
scope: client-idioms
triggerWhen: generating-java-code
appliesTo:
  client: jedis
  language: java
minimumVersion:
  client: "5.0"
  redis: "7.4"
  redis_for_ft_hybrid: "8.4.0"
sourceUpstream: https://github.com/redis/jedis/tree/master/src/test/java/io/redis/examples
---
```

Body sections (fixed TOC):

1. **Minimum supported versions** — table: Jedis version × Redis version × FT.* feature availability. Note FT.HYBRID requires Redis 8.4.0.
2. **Client class choice** — `RedisClient` (current upstream examples) vs `UnifiedJedis` vs `JedisPooled` vs legacy `Jedis`. When to use which; what the migration path looks like.
3. **Connection setup** — `RedisClient.create("redis://localhost:6379")`. Try-with-resources pattern. Connection pool when needed.
4. **Schema imports** — the canonical import block: `redis.clients.jedis.search.schemafields.*` for `TextField`, `TagField`, `NumericField`, `GeoField`, `GeoShapeField`, `VectorField`; `redis.clients.jedis.search.FTCreateParams`, `IndexDataType`.
5. **Create index — HASH** — `FTCreateParams.createParams().on(IndexDataType.HASH).addPrefix("...")` + `SchemaField[]` worked example.
6. **Create index — JSON** — same pattern with `IndexDataType.JSON` and `TextField.of("$.brand").as("brand")` fluent path-with-alias. Mirror `SearchQuickstartExample.java`.
7. **FT.SEARCH idioms** — `Query` builder: `.setSortBy`, `.returnFields`, `.setWithScores`, `.setNoContent`, `.setVerbatim`, `.dialect`, `.addParam`. Result reading: `SearchResult.getDocuments()`, per-doc field access.
8. **FT.AGGREGATE idioms** — `AggregationBuilder` chain: `.groupBy(...)`, `.reduce(Reducers.count().as(...))`, `.apply(...)`, `.filter(...)`, `.sortBy(...)`, `.limit(...)`. Mirror `QueryAggExample.java`.
9. **Cursors** — `AggregationBuilder.cursor(count, maxIdle)`, `ftCursorRead`, `ftCursorDel`.
10. **Vector queries** — building the KNN/RANGE query string, vector encoding (`float[]` → `byte[]` via `ByteBuffer.allocate(...).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer().put(...)`), score retrieval via aliased return field. Mirror `VectorSetExample.java`.
11. **FT.HYBRID** — Jedis calling shape. If a high-level wrapper exists, document it; otherwise show how to issue via `sendCommand(...)` and warn that the high-level API may not yet exist (see Open Question #2).
12. **Debugging** — `ftExplain()`, `ftProfile()`, `ftInfo()` calling shapes and output parsing.
13. **Index management** — `ftAlter`, `ftAliasAdd/Update/Del`, `ftDropIndex`.
14. **Common errors & version gotchas** — `Schema` class deprecation (don't use; use `SchemaField[]`), client-class migration, JSON serialization via `Path2` not `Path`, `JedisDataException` patterns, DIALECT defaults, FT.HYBRID version gate.
15. **Upstream examples index** — curated table of `STEP_START` labels in upstream examples mapped to the operation they demonstrate.

## 6. Cross-References

- The reference does **not** duplicate the query DSL grammar. It links to `references/search-syntax-primitives.md` at the top, then shows only how Jedis *expresses* that grammar.
- The reference does **not** duplicate rule content. It links forward to rules in `rules/search-*.md` for "what to do" and shows only "how to express it in Jedis."
- Cross-link from every section to the corresponding section of `references/clients/python-redis-py.md` for cross-client verification.

## 7. Acceptance Criteria

- An agent given the task *"write Jedis code to create a JSON-indexed search index for bicycles and run a numeric range query for price between 100 and 500"* produces code that:
  - Matches the upstream `SearchQuickstartExample.java` + `QueryRangeExample.java` patterns.
  - Uses `IndexDataType.JSON` (not HASH).
  - Uses `Query("@price:[100 500]")` or the appropriate fluent equivalent.
  - Uses `SchemaField[]` (not the deprecated `Schema` class).
  - Does not invent imports or call shapes that don't exist in the actual Jedis API.
- The reference file passes the build-time validator: it has the required frontmatter scope/triggerWhen/appliesTo fields.
- All section examples are traceable to a specific upstream example file (cited inline or in the §15 examples index).
- An agent generating Python code does NOT load this file (verified by the conditional-loading mechanism in spec 0001 §7.8).

## 8. Open Questions

1. **Canonical client class** — upstream examples use `RedisClient.create(...)`, which is newer than the widely documented `UnifiedJedis` / `JedisPooled` patterns. Which is the recommended class for new code as of 2026? Verify against the Jedis README and recent release notes before writing §2 of the reference. If `RedisClient` is the current recommendation but most existing internet docs still show `UnifiedJedis`, the reference must call out the divergence explicitly.
2. **FT.HYBRID wrapper status in Jedis** — does current Jedis ship a high-level `FT.HYBRID` method, or is `sendCommand(...)` the only path? Verify against Jedis source before writing §11 of the reference.
3. **`VectorSetExample.java` naming** — the file listed is `VectorSetExample.java`; this may or may not be the canonical vector-search example (the name suggests Redis "Vector Set" data type, which is distinct from FT.* vector indexing). Confirm before mapping it as the vector source. If it covers Vector Set rather than FT.* vector queries, find the correct file (search for `VECTOR` in `FTCreateParams` usage across the examples folder).
4. **`SchemaField` vs `Schema`** — the older `Schema` class (used in some existing rule files like `search-field-types.md`) is being phased out in favor of `SchemaField[]`. Confirm `Schema` is fully deprecated and write the reference using `SchemaField[]` only. Note in the migration section how to move from `Schema` to `SchemaField[]`.
5. **`Path` vs `Path2`** — both exist for JSON path expressions. Confirm which is current and use exclusively.
6. **Async / reactive coverage** — Jedis is sync-only by design; reactive callers typically use Lettuce. Confirm there is no reactive Jedis story to document, and add a note pointing to Lettuce (when its spec lands).

## 9. Out-of-Scope Follow-ups

- **Lettuce reference** — separate spec when prioritized.
- **Spring Data Redis** — separate spec when prioritized; depends on community demand.
- **Cluster-aware patterns** — handled in `cluster-*` rules of the broader `redis-development` skill, not here.

## 10. Iteration Log

| Date | Change |
|------|--------|
| 2026-05-15 | Initial draft. Anchored to upstream Jedis examples with file-by-section mapping. Adopted upstream `STEP_START`/`STEP_END` convention and Bicycle dataset. Flagged the `RedisClient` vs `UnifiedJedis` divergence as Open Question #1. |
