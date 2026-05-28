# Spec 0005 — Close the FT.SEARCH/FT.AGGREGATE Failure-Catalog Gaps

| Field | Value |
|-------|-------|
| Status | Draft |
| Author | Adriano Amaral |
| Created | 2026-05-26 |
| Skill | `skills/redis-development` |
| Scope | `rules/search-*.md`, `rules/vector-*.md`, `references/search-syntax-primitives.md` |
| Supersedes | None |
| Extends | [`0001-search-syntax-coverage.md`](0001-search-syntax-coverage.md) |
| Source data | [`redis-search-syntax-issues.md`](../redis-search-syntax-issues.md) — 1702 F1=0 cases across haiku/sonnet/opus, May 2026 |

---

## 1. Problem Statement

A 2805-case empirical run against `claude-code:{haiku,sonnet,opus}` produced 1702 F1=0 failures generating `FT.SEARCH` / `FT.AGGREGATE`. The findings are catalogued in `redis-search-syntax-issues.md` and split into **Part A** (Redis rejected the command — 844 cases) and **Part B** (executed but wrong rows — 858 cases).

Spec 0001 delivered broad syntax coverage but the gap analysis (conversation dated 2026-05-26) shows that several of the highest-frequency failure modes are either absent or only implicitly addressed in the current `search-*` / `vector-*` rules. The single biggest individual bug — RETURN+AS nargs miscount (147 cases) — has no rule, no example, and no warning anywhere in the corpus today.

The skill is therefore underperforming on the failure classes that are easiest to fix: deterministic syntax rules the model just doesn't know.

## 2. Goals

1. Close every "trivial-fix" failure class in the catalog (A1, A2, A3, A4, A5, A7, B7) with explicit rule text and at least one Correct/Incorrect pair drawn from a recognizable failure example.
2. Extend the TAG and TEXT escaping coverage to include FHIR-style `urn:uuid:…` patterns and date-as-TEXT idioms (A6, B3a, B3b).
3. Add an `APPLY`-function reference (allowlist + `substr(s, start, length)` cheatsheet) — currently absent from the entire skill (A11, B5).
4. Add a reducer-by-intent cheatsheet ("list distinct" → `TOLIST`, "how many distinct" → two-step `GROUPBY`, etc.) (B6).
5. Add the `SORTBY … MAX N` form alongside `LIMIT 0 N` so agents know both exist and when to prefer each (B7).
6. Add a question-phrase → command cheatsheet to `search-command-selection.md` so the AGG-vs-SEARCH routing is explicit at the phrase level, not just the table level (B1).
7. Preserve the CLI-first layering from spec 0001 §7: every new example leads with the RESP/`redis-cli` form, with optional ≤15-line `redis-py` / Jedis mirrors only when meaningful.

## 3. Non-Goals

- New rule files. All changes are incremental edits to the existing `search-*` / `vector-*` rules and `references/search-syntax-primitives.md`. No new prefix, no new always-loaded content.
- Semantic-routing failure classes (B4 "wrong GROUPBY dimension," parts of B6 that depend on dataset semantics) — these need few-shot examples in domain corpora, not new syntax rules. Tracked as out-of-scope follow-ups in §9.
- Provider-refusal handling (A12) — prompt-steering concern, not a syntax-skill concern.
- Output-format harness rules (C1) — not a skill issue.
- Any work on rule prefixes other than `search-*` and `vector-*`.

## 4. Current-State Inventory (rule-by-rule, against the catalog)

Mapping each failure class to the existing file(s) and what is missing.

| Catalog item | Cases | Existing file(s) | Current state | Action |
|---|---:|---|---|---|
| **A1** RETURN+AS nargs counted as paths not tokens | 147 | `search-result-shaping.md` | Example uses `RETURN 3 model brand price` (no `AS`); no token-count rule | **Add** rule + Correct/Incorrect pair |
| **A2** REDUCE without `GROUPBY 0` for total aggregates | 83 | `search-aggregate-pipeline.md` | Stage table mentions `GROUPBY`, but no `GROUPBY 0` example and no "every REDUCE needs a GROUPBY" rule | **Add** explicit rule + `GROUPBY 0 REDUCE …` example |
| **A3** SORTBY nargs as fields | 97 | `search-aggregate-pipeline.md` | "n is the count of (field, direction) tokens" in stage table only | **Add** worked example + "always specify ASC/DESC" warning |
| **A4** Missing `@` in GROUPBY/SORTBY/APPLY/FILTER | 140 | `search-aggregate-pipeline.md` | All examples are correct but rule is implicit | **Add** explicit rule text + Incorrect example |
| **A5** `REDUCE COUNT` missing the `0` | 40 | `search-aggregate-pipeline.md` | Cheatsheet has `REDUCE COUNT 0 AS n` | **Add** explicit "the 0 is mandatory" warning |
| **A6** Unescaped `:` and `-` in TAG (FHIR URN) | 57 | `search-query-syntax.md` | Mentions `:` in prose; no `urn:uuid:…` example | **Add** FHIR-style example to TAG escaping block |
| **A7** Numeric range `(0.08 +inf]` parens unbalanced | 74 | `search-query-syntax.md` | Correct forms shown; no Incorrect counter-example | **Add** `**Incorrect:**` example |
| **A8** FILTER references unloaded column | 23 | `search-aggregate-pipeline.md` | "Only loaded fields are visible" noted | **Add** explicit "prefer query-string filters" guidance + Incorrect example |
| **A9** LOAD path mismatched with downstream alias | 30 | `search-aggregate-pipeline.md` | Implicit | **Add** Correct/Incorrect pair |
| **A11** Invented APPLY functions (`round`, `now`) | 5 | none | No function allowlist exists | **Add** APPLY-function reference block |
| **B1** Question → AGG vs SEARCH routing | 223 | `search-command-selection.md` | Table-level routing covered | **Add** phrase-level cheatsheet ("how many", "list distinct", "average per", "top N by") |
| **B3a/B3b** Date-as-TEXT, multi-pattern alternation | ~150 (subset of 258) | `search-query-syntax.md` | TAG escapes covered; no date-as-TEXT idioms | **Add** `@date:YYYY\-MM\-DD*` and `@date:(2022\-01*\|2022\-02*)` examples |
| **B5** `APPLY substr` offsets | 60 | none | substr not in any rule | **Add** to APPLY-function reference (see A11) — ISO offsets cheatsheet |
| **B6** Wrong REDUCE operator | 100 | `search-aggregate-pipeline.md` | Reducer code cheatsheet present | **Add** question-phrase → reducer mapping |
| **B7** `MAX N` vs `LIMIT 0 N` | 50 | none | Neither rule shows `SORTBY … MAX N` | **Add** to `search-aggregate-pipeline.md` |
| **B8** Nested JSON LOAD predicate | 25 | `search-json-indexing.md` (indexing only) | Pipeline pattern absent | **Add** `LOAD <n> $.children[?(predicate)] AS match  FILTER "exists(@match)"` example |
| **B9** TAG casing | 30 | `search-query-syntax.md` | Not noted | **Add** one-line "TAG is case-sensitive — mirror the data" note |
| **C3** Schema attribute vs JSONPath alias | many | `search-json-indexing.md` | `AS alias` covered | **Add** explicit `@author` vs `LOAD 1 $.author AS Author` clarification |

**Already covered, no action needed:** B2 (LIMIT 0 0 idiom), B10 (extra DIALECT 3), and the spec-0001 deliverables (command selection, dialect, hybrid).

## 5. Proposed Changes

Organized by destination file so reviewers can scan the blast radius per rule.

### 5.1 `rules/search-aggregate-pipeline.md` — largest set of edits

Add a new subsection titled **"Counting tokens, not fields"** between the existing stage table and the reducer cheatsheet. It collects A1, A2, A3, A4, A5 in a single block because they all share the same root cause (counting nargs as semantic fields rather than as token slots). Per §8 Q1, the existing stage table also gets a final "Common errors" column that points to this subsection for the rows that need it (`GROUPBY`, `SORTBY`, `APPLY`, `FILTER`, `LOAD`).

Specific additions:

1. **`@` prefix rule (A4)** — one-liner: *"every field reference inside `LOAD`, `GROUPBY`, `SORTBY`, `APPLY`, `FILTER` must start with `@`. The `@` is part of the field token."* Pair with one Incorrect example (`GROUPBY 1 category`) and the Correct form (`GROUPBY 1 @category`).
2. **`GROUPBY 0` for whole-result aggregates (A2)** — explicit example:
   ```
   FT.AGGREGATE idx:bicycle "@type:{mountain}" GROUPBY 0 REDUCE AVG 1 @price AS avg_price DIALECT 2
   ```
   With note: "every `REDUCE` must follow a `GROUPBY`. To aggregate across all matched docs into a single row, use `GROUPBY 0`."
3. **`REDUCE COUNT 0` (A5)** — explicit warning that the `0` is mandatory even when `COUNT` takes no args; show the failure mode.
4. **`SORTBY` token counting (A3)** — Correct/Incorrect pair:
   ```
   # Bad: SORTBY 1 @count DESC  (Redis stops after consuming 1 token → "Unknown argument 'DESC'")
   # Good: SORTBY 2 @count DESC
   # Good: SORTBY 4 @count DESC @brand ASC
   ```
   Plus the rule: *"`SORTBY <n>` counts tokens. Each entry is `@field ASC|DESC` = 2 tokens. Always supply `ASC` or `DESC`."*
5. **`SORTBY … MAX N` form (B7)** — add alongside step 4:
   ```
   SORTBY 2 @count DESC MAX 5    # top-5, in-sort limit (preferred for top-N)
   ```
   Note: "for top-N use `MAX N`; don't also add `LIMIT 0 N`."

Then add a new **"FILTER and LOAD discipline"** subsection covering A8 and A9:

6. **Prefer query-string filters over pipeline FILTER (A8)** — Correct/Incorrect pair showing `@date:2023*` in the query string vs. `FILTER "@date >= '2023-01-01'"` failing because `date` isn't projected. Then the recovery: `LOAD 1 @date` before the FILTER.
7. **LOAD alias must match downstream reference (A9)** — Incorrect: `LOAD 1 $.subject  SORTBY 2 @timestamp DESC` ("Property '@timestamp' not loaded"). Correct: `LOAD 2 @date @subject  SORTBY 2 @date DESC`.

Then extend the **reducer cheatsheet** with a question-phrase → reducer mapping (B6):

```
# "how many"            → GROUPBY 0 REDUCE COUNT 0 AS n
# "how many distinct"   → two-step: GROUPBY 1 @x  then  GROUPBY 0 REDUCE COUNT 0
#                         (or single-step REDUCE COUNT_DISTINCT 1 @x AS n)
# "list distinct X"     → GROUPBY 0 REDUCE TOLIST 1 @x AS list
# "sum / total"         → REDUCE SUM 1 @field
# "average per Y"       → GROUPBY 1 @y REDUCE AVG 1 @field
# "top row by stat"     → REDUCE FIRST_VALUE 4 @other BY @field DESC
# "p95 / quantile"      → REDUCE QUANTILE 2 @field 0.95 AS p95
```

Finally, add a new **"APPLY functions"** subsection covering A11 and B5:

8. **Allowlist** — enumerate the documented APPLY functions verbatim (ceil/floor/abs/log/exp/sqrt/pow/mod/substr/format/upper/lower/matched_terms/contains/startswith/strlen/parse_time/day/month/year/monthofyear/dayofweek/dayofmonth/dayofyear/hour/minute/timefmt/geodistance). Note explicitly: *"no `round`, no `now()`, no `date()`. To round, use `floor(x*100)/100`."*
9. **`substr` cheatsheet** — `substr(s, start, length)` is 0-indexed; length is **chars to take, not end position**. ISO date `YYYY-MM-DD`:
   ```
   substr(@date, 0, 4)   → YYYY  (year)
   substr(@date, 5, 2)   → MM    (month)
   substr(@date, 8, 2)   → DD    (day)
   substr(@date, 0, 7)   → YYYY-MM
   ```
10. **`contains` for TEXT substring negation (B3e)** — the query DSL can't express `NOT-contains-substring` against TEXT (`-@city:ile` doesn't filter substrings). Canonical pattern in the pipeline:
    ```
    # "Cities NOT containing 'ile'"
    FT.AGGREGATE idx:cities "*"
        LOAD 1 @city
        FILTER "!contains(@city, 'ile')"
        DIALECT 2
    ```

Also add a **nested JSON LOAD predicate** example (B8) in the LOAD discipline subsection:

11. *"How many parents have at least one child matching X?"* — show `LOAD 3 $.beers[?(@.abv >= 0.07)] AS match  FILTER "exists(@match)"`.

### 5.2 `rules/search-result-shaping.md`

Add an explicit **RETURN token-counting** rule (A1, biggest single bug):

1. **Rule text**: *"`RETURN <nargs> <args>` — `<nargs>` counts the literal token slots that follow, not the number of fields. An aliased path occupies 3 slots: `<path> AS <alias>`."*
2. **Correct/Incorrect pair**:
   ```
   # Bad: RETURN 1 $.beers[*].name AS beer_names      → "Unknown argument 'AS'"
   # Good: RETURN 1 $.beers[*].name                   (no alias, 1 slot)
   # Good: RETURN 3 $.beers[*].name AS beer_names     (path + AS + alias = 3 slots)
   # Good: RETURN 6 $.status AS status $.reason AS reason   (two aliased paths = 6 slots)
   ```
3. **Formula** in one line: *"`nargs = 3·(aliased paths) + 1·(unaliased paths)`."*

### 5.3 `rules/search-query-syntax.md`

Three additions to the existing TAG/TEXT escaping content:

1. **TAG colon escaping for FHIR-style URN (A6)** — add to the TAG escaping block:
   ```
   # TAG with embedded colons (FHIR urn:uuid:...) — escape each : and -
   FT.SEARCH idx:obs "@subject:{urn\:uuid\:fa70e7dd\-03aa\-6885\-ca29\-c65c38dab633}" DIALECT 2
   ```
2. **Date-as-TEXT idiom (B3a, B3b)** — add a new subsection **"Dates indexed as TEXT"**:
   ```
   # Hyphens are token breaks in TEXT — escape and use prefix wildcard
   @date:2022\-07*                       # all dates in July 2022
   @date:(2022\-01*|2022\-02*|2022\-03*) # Q1 2022 (alternation inside parens)
   ```
   With Incorrect counter-examples: `@date:2022-07` (parses as `2022 AND -07`), `@date:2010 | @date:2011` (becomes three separate field unions).
3. **Numeric-range `**Incorrect:**` example (A7)** — extend the existing Incorrect block with:
   ```
   # Bad: parens unbalanced — "Syntax error near +inf"
   @abv:(0.08 +inf]
   # Good: outer brackets are always [ ]; ( prefixes the *value* for exclusive
   @abv:[(0.08 +inf]
   ```
4. **TAG casing one-liner (B9)** — append to the TAG escaping rules: *"TAG comparisons are case-sensitive. Mirror the casing of values as they appear in the data — Redis Search does not auto-fold TAG case."*
5. **Multi-word TEXT — phrase vs AND-of-words (B3c, §8 Q4)** — extend the existing phrase example with an explicit triple:
   ```
   # Bad: unquoted multi-word TEXT — parses as @reason:sleep AND apnea
   @reason:sleep apnea

   # Good: exact phrase match (words in order, adjacent)
   @reason:"sleep apnea"

   # Good: both words required, any order, no adjacency constraint
   @reason:(sleep apnea)
   ```
   One-line rule: *"unquoted multi-word values in a `@field:` clause split on whitespace and AND the terms across the index, not within the field. Use `"…"` for a phrase or `(…)` for word-AND scoped to the field."*

### 5.4 `rules/search-command-selection.md`

Append a **question-phrase → command** cheatsheet under the existing table (B1):

```
Use FT.AGGREGATE when the question contains:
  "how many" / "number of" / "total count"       → REDUCE COUNT 0
  "list unique" / "what are the distinct"        → REDUCE TOLIST  or  GROUPBY 1 @x
  "average per" / "min/max per" / "sum per"      → GROUPBY 1 @y REDUCE …
  "top N by"                                     → SORTBY 2 @stat DESC MAX N
  "breakdown by" / "per month" / "per state"     → GROUPBY 1 @bucket
Use FT.SEARCH when the question asks for raw documents or specific fields of matched docs.
Bare "how many X match Y" with no grouping → FT.SEARCH idx q LIMIT 0 0 (read total from header).
```

### 5.5 `rules/search-json-indexing.md`

Add a short **"Schema attribute vs raw JSONPath alias"** note (C3):

> If the schema declared `name AS author`, query with `@author`. If you reference `$.author` directly (no `AS` alias and not in the schema), you must `LOAD 1 $.author AS Author` in `FT.AGGREGATE` before referencing `@Author` downstream. `FT.SEARCH ... SORTBY @author` requires `author` to be in the schema as `SORTABLE`.

### 5.6 `references/search-syntax-primitives.md` — minor

Extend the **Operators** table footnote (lines 122–139) to flag that the `@` prefix is **also required after operators in aggregate-pipeline stages** (today the reference describes it only as a query-expression construct).

### 5.7 No new files

Per §2 non-goal and §8 Q2: every change is inside an existing file. The APPLY-function block lives inside `search-aggregate-pipeline.md` (estimated ~14 lines once allowlist + warning + `substr` + `contains` are inlined) rather than as a separate reference because (a) the corpus says it co-occurs with the other aggregate failures, (b) it's short enough to inline well under the 40-line escape hatch, and (c) a new reference file would need its own conditional-loading directive per spec 0001 §7.8.

## 6. Cross-Cutting Decisions

1. **CLI-first stays absolute.** Every new example leads with the RESP/`redis-cli` form. Client mirrors are optional and only added where they meaningfully change (e.g., the Python `Query.return_fields("a", "b")` builder hides the nargs problem entirely — worth noting).
2. **No new directive block needed.** All additions sit inside rules that already carry the spec-0001 "Client mirrors — read exactly one" block. The build validator will continue to pass.
3. **Examples must trace to real failures.** Each Correct/Incorrect pair should be recognizable as one of the wrong/right snippets in `redis-search-syntax-issues.md`. If the catalog doesn't have a concrete example, we don't invent one — we cite the rule and skip the example.
4. **Bicycle dataset stays canonical.** Where the catalog uses other datasets (beers, bites, FHIR observations), we either adapt the example to bicycles **or** keep the catalog form when the dataset choice is essential to the pattern (FHIR URN-as-TAG is the clearest case).
5. **No client-reference edits.** Spec-0002/0003/0004 deliverables stay as-is. Token-counting and APPLY-function rules apply to the CLI form; the redis-py and Jedis builder APIs already encapsulate most of them.

## 7. Acceptance Criteria

- [ ] `search-aggregate-pipeline.md` contains explicit text covering A1's sibling rules (A2, A3, A4, A5) in a labeled "Counting tokens, not fields" subsection, with the existing stage table extended by a "Common errors" pointer column (Q1). Plus the FILTER/LOAD discipline subsection (A8, A9), the question→reducer cheatsheet (B6), the APPLY-function allowlist + `substr` cheatsheet + `contains` substring-negation example (A11, B5, B3e), the `SORTBY … MAX N` form (B7), and the nested JSON LOAD predicate example (B8).
- [ ] `search-result-shaping.md` contains the `RETURN` token-counting rule and the `3·aliased + 1·unaliased` formula (A1).
- [ ] `search-query-syntax.md` contains: FHIR URN TAG example (A6), date-as-TEXT idiom subsection (B3a/B3b), numeric-range `**Incorrect:**` example (A7), TAG case-sensitivity one-liner (B9), and the phrase-vs-AND-of-words triple for multi-word TEXT (B3c).
- [ ] `search-command-selection.md` contains the question-phrase → command cheatsheet (B1).
- [ ] `search-json-indexing.md` contains the schema-attribute-vs-JSONPath-alias clarification (C3).
- [ ] `references/search-syntax-primitives.md` Operators section notes the `@` prefix applies in pipeline stages too.
- [ ] `npm run validate` passes — no directive-block or frontmatter regressions.
- [ ] `npm run build` regenerates `AGENTS.md` with no warnings.
- [ ] A spot-check of 5 random Correct examples in the new content executes successfully against a local Redis 8 instance with the Bicycle dataset (or the documented adapted dataset for FHIR URN).

## 8. Resolved Questions

All four questions from the initial draft were resolved on 2026-05-26 before implementation. The resolutions are folded into §5; this section preserves the reasoning.

### Q1 — Grouped counting subsection vs. inline near each stage **(Resolved: do both, asymmetric weight)**

Decision: keep the grouped **"Counting tokens, not fields"** subsection as the primary home (per §5.1), **and** add a single trailing-cell note in the existing stage table linking back to that subsection. The grouped form is what the model reads as a checklist; the in-table note catches the reader who lands on the stage table first.

Reasoning: Part A of the catalog — the 844 deterministic-syntax cases the user re-flagged — show A1–A5 *co-occur* per model. A model that miscounts `SORTBY` nargs almost always also misses the `@` prefix in the same query. A single named subsection is therefore the right cognitive unit. The table cross-link is cheap insurance.

### Q2 — APPLY-function block: inline or new reference **(Resolved: inline)**

Decision: inline in `search-aggregate-pipeline.md` under a labeled **"APPLY functions"** subsection.

Sizing check (drafted estimate before implementation):
- Function allowlist (compact 3–4 line list): ~4 lines
- "No `round`/`now`/`date` — use `floor(x*100)/100`" warning: 2 lines
- `substr(s, start, length)` cheatsheet with ISO offsets: 5 lines
- `contains(@field, '…')` worked example (covers B3e substring negation): 3 lines

Total estimate: ~14 lines — well under the 40-line escape hatch. Re-evaluate only if a future spec needs deeper APPLY coverage (e.g., `parse_time`/`timefmt` worked examples).

### Q3 — Phrase cheatsheet language scope **(Resolved: English-only for v1)**

Decision: ship the question-phrase cheatsheet in English. The empirical data in `redis-search-syntax-issues.md` is entirely English-prompt-shaped (223 B1 cases all phrased "how many," "list," "average," etc.). Adding speculative non-English variants now is unsupported by data and risks misleading the model on patterns we haven't measured. Tracked as a follow-up in §9 only if non-English failure data lands.

### Q4 — B3c (phrase vs AND-of-words) and B3e (substring negation) **(Resolved: both addressed)**

Decision:
- **B3c** is *not* fully covered by the existing `"mountain bicycle"` example — that line shows the phrase form but never contrasts it with the unquoted failure mode (`@reason:sleep apnea` → `@reason:sleep AND apnea`). Add a Correct/Incorrect triple to §5.3: unquoted (bad), `"..."` (phrase), `(...)` (AND-of-words). This is the cheapest fix in the spec.
- **B3e** is genuinely missing. The natural home is the **APPLY functions** block (Q2) — `contains` is on the function allowlist and the canonical pattern is `LOAD 1 @city  FILTER "!contains(@city, 'ile')"`. Adding this also closes the "you can't do TEXT substring negation in the query string" gap in one shot.

## 9. Out-of-Scope Follow-ups

- **B4 wrong GROUPBY dimension** (140 cases) and the **semantic half of B6** (200+ cases) — best addressed by curated few-shot example pairs in domain corpora (FHIR records, bites, txns). Tracked for a future spec **0006-search-domain-fewshots** once the syntax-rule fixes from this spec have a measured impact baseline.
- **A12 provider refusals** (haiku-only, 65 cases) — prompt-steering concern; out of scope for skill content. Mention in skill-creator guidance instead.
- **A13 timeouts on deep nested aggregates** — example-length budget concern; addressed by keeping new examples in this spec lean (≤15 lines per snippet, per spec 0001).
- **Cross-client examples for the new rules** (Lettuce, node-redis, go-redis, NRedisStack, .NET) — remains out of scope per spec 0001 §10.

## 10. Iteration Log

| Date | Change | Author |
|------|--------|--------|
| 2026-05-26 | Initial draft, derived from `redis-search-syntax-issues.md` gap analysis. | Adriano Amaral |
| 2026-05-26 | Resolved §8 Q1–Q4. Q1: grouped subsection + stage-table cross-link. Q2: APPLY block inline (~14 lines, well under 40-line threshold). Q3: English-only phrase cheatsheet for v1. Q4: B3c gets phrase-vs-AND-of-words triple in §5.3; B3e folded into §5.1 APPLY block via `contains` example. Updated §5.1, §5.3, §5.7, and acceptance criteria accordingly. | Adriano Amaral |
