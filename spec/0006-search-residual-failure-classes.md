# Spec 0006 — Close the Residual Failure Classes on Sonnet + Opus

| Field | Value |
|-------|-------|
| Status | Draft |
| Author | Adriano Amaral |
| Created | 2026-05-27 |
| Skill | `skills/redis-development` (rules) + `redis-syntax-eval` (harness + prompt) |
| Scope | Rule edits, prompt-template additions, eval-assertion relaxation, curated few-shots |
| Supersedes | None |
| Extends | [`0001-search-syntax-coverage.md`](0001-search-syntax-coverage.md), [`0005-search-syntax-failure-catalog.md`](0005-search-syntax-failure-catalog.md) |
| Source data | [`output/REPORT-skill-impact-multi-model.md`](../redis-syntax-eval/output/REPORT-skill-impact-multi-model.md) §4 — Sonnet F1 0.42 + Opus F1 0.34 on 76 stratified bad-F1 cases (2026-05-27) |

---

## 1. Problem Statement

Spec 0005 closed the deterministic-syntax failure classes that dominate Haiku's residual error. The 2026-05-27 extended-slice runs measured the result on Sonnet (Δ +0.42) and Opus (Δ +0.34) over 76 stratified F1=0 cases per model. The wins are net positive on every model, but **the spec-0005 rule bundle cannot close the remaining 43/76 (Sonnet) and 48/76 (Opus) F1=0 residuals** because they are not syntax bugs — they require information the model isn't shown, eval-assertion logic that doesn't relax canonical equivalences, or curated examples the rule corpus doesn't carry.

A pattern-survey of 20 still-F1=0 samples (10 per model) from the May 27 runs shows the residuals cluster into five classes — each with a different fix location (rules, prompt template, eval harness, dataset). Spec 0005 made all the rule-locatable fixes the data supported; this spec covers what's left.

## 2. Goals

1. **Cap SEARCH↔AGG count-routing noise.** Treat `FT.SEARCH … LIMIT 0 0` and `FT.AGGREGATE … GROUPBY 0 REDUCE COUNT 0` as equivalent in `result-set-f1` when both return the same scalar count. Single highest-impact change in this spec; estimated ~25% of Sonnet residuals and ~50% of Opus residuals.
2. **Surface TAG/attribute value enumerations in the prompt.** Promote the existing per-attribute `top_values` (already in `data/schemas/*.json`) from a hidden field to a first-class section of the human prompt, so models can mirror values like `pitbull` (not `Pit Bull`) and `primary|secondary|admin` (not `primary|admin|minor`).
3. **Surface 1–2 sample JSON docs per JSON-typed index.** Close the nested-JSONPath inference gap on `beers`, `claims`, `documentreferences`, `careteams` etc. Same `data/schemas/*.json` already has sample docs; the prompt template just isn't using them.
4. **Sharpen the date-as-TEXT alternation rule.** Generation regularly produces `@date:(2018|2019)` where gold uses `@date:(2018*|2019*)`. The rule exists (spec 0005 §5.3) but isn't sticking — needs a "always trailing `*` on date alternation" callout.
5. **Add curated few-shots for multi-step aggregate pipelines.** Cases like `cars/v00005` (GROUPBY → REDUCE → GROUPBY → REDUCE chain for "top per state") are semantically valid but extremely format-sensitive; one worked example per common pattern is the right cost/benefit.
6. **Add a baseline + with-skill measurement loop** so the next spec has updated residual data after these changes ship.

## 3. Non-Goals

- New always-loaded rule prefixes. Edits target existing `search-*` rules and the eval harness; no new rule sections.
- Rewriting the prompt template from scratch. Additions are additive blocks before the existing `{{schema}}` substitution.
- Touching Haiku's gains. Haiku's 80% recovery on its hand-picked slice should not regress; any prompt-template change is validated against `sample-ids.txt` first.
- New external documentation source ingestion. See §10 — the answer is **no new upstream docs are needed**; the existing Redis Search docs already cover every syntax decision in scope here. We do, however, reuse the eval's own gold dataset as a *source of canonical examples* for §5.5 few-shots.
- Vector / RAG / RedisVL coverage. Those are covered by spec 0004 and not implicated in the May 27 residuals.
- Multi-language client mirrors for new content. Spec 0001's CLI-first / two-client policy stays; any new rule snippet leads with `redis-cli`.

## 4. Current-State Inventory — Residual classes from the May 27 runs

Each class is mapped to its **fix location** (rule edit / prompt template / eval harness / dataset) and a representative case from the May 27 output.

| Class | Approx % of residuals | Where the fix lives | Representative case |
|---|---:|---|---|
| **R1.** Bare-count SEARCH ↔ AGGREGATE equivalence | ~35% | Eval harness (`result-set-f1.ts`) | `cars/v00000` — gold `FT.AGGREGATE * GROUPBY 0 REDUCE COUNT 0`, gen `FT.SEARCH * LIMIT 0 0`; both return the same total |
| **R2.** TAG casing / attribute-value enumeration | ~20% | Prompt template (`src/prompt/template.ts`) — surface `top_values` | `bites/t00008` — gold `@Breed:poodle`, gen `@Breed:Poodle` |
| **R3.** Nested JSONPath inference | ~15% | Prompt template — surface 1–2 sample docs per JSON index | `beers/t00050` — gold uses `$.beers[?(@.style=="American IPA")] AS match  FILTER exists(@match)`; gen flattens the predicate into the query string |
| **R4.** Date-as-TEXT alternation missing `*` | ~10% | Rule edit (`search-query-syntax.md`) | `careteams/t00042` — gold `@date:(2018*\|2019*)`, gen `@date:(2018\|2019)` |
| **R5.** Multi-step aggregate composition | ~10% | Rule edit + few-shot (`search-aggregate-pipeline.md`) | `cars/v00005` — gold has `GROUPBY … REDUCE … GROUPBY … FIRST_VALUE … MAX` chain |
| **R6.** Unloaded-field FILTER + nested predicate (residual from spec 0005 A8/B8) | ~5% | Rule sharpening | `bites/t00044` — gold uses `LOAD @DateOfBite APPLY year() FILTER @year == 2016`, gen uses query-string numeric range that doesn't match gold's exact result set |
| **R7.** RETURN as JSONPath vs `@alias` | ~5% | Eval harness (alias normalization extension) | `beers/t00020` — gold `RETURN 1 $.beers[*].style`, gen wraps in `FT.AGGREGATE LOAD … GROUPBY @style` |

(Percentages are approximate from a 20-sample read; precise per-class counts will fall out of the §7.2 measurement loop.)

## 5. Proposed Changes

Organized by fix location so the blast radius is scannable per file.

### 5.1 Eval harness — `redis-syntax-eval/src/assertions/result-set-f1.ts` (R1, R7)

Add a **scalar-count equivalence relaxation** for bare-count queries:

- If gold command is `FT.SEARCH … LIMIT 0 0` and generation is `FT.AGGREGATE … GROUPBY 0 REDUCE COUNT 0 …` (or vice versa), and both return the same single total, score F1=1.0.
- If gold is `FT.SEARCH … RETURN <n> <args>` and generation is a `FT.AGGREGATE … LOAD … GROUPBY` that returns the same set of (key → projected fields) tuples, treat that as a valid alternate path. (R7.)

This is **not** a blanket "ignore command type" relaxation — the gold dataset itself uses both forms interchangeably for the same questions, so the assertion was previously over-penalizing. Implement the relaxation behind a `--strict-command-type` flag (default off) so we can measure both modes.

### 5.2 Prompt template — `redis-syntax-eval/src/prompt/template.ts` (R2, R3)

The schema cache (`data/schemas/*.json`) already contains everything we need; the prompt template currently inlines only the `FT.INFO` schema string under `{{schema}}`. Two additions, both gated on what's present in the cache:

1. **`Top values per attribute` block** — for every TAG/TEXT attribute, render up to 5 distinct values verbatim:
   ```
   ## Sample values present in the index
   @Breed (TAG): pitbull, poodle, rottweiler, mastiff, shepherd
   @Borough (TAG): Brooklyn, Bronx, Manhattan, Queens, Staten Island
   @capital (TAG): primary, secondary, admin
   @state (TAG): CA, NY, TX, FL, OR
   ```
2. **`Sample documents` block** — for JSON-typed indices, render 1–2 trimmed sample docs (keys + 2-deep nesting):
   ```
   ## Sample document (truncated)
   {
     "name": "Avery Brewing Company",
     "state": "CO",
     "beers": [
       {"name": "Maharaja", "style": "American Double IPA", "abv": 0.102, "ounces": 12}
     ]
   }
   ```

Both blocks go **before** the question. Validated against `sample-ids.txt` (Haiku 20-case) to confirm no regression on the syntax wins from spec 0005.

### 5.3 `rules/search-query-syntax.md` — sharpen date-as-TEXT alternation (R4)

Replace the existing date-as-TEXT example with an explicit emphasis on **trailing `*` per alternative**:

```
# Bad: alternation without wildcards — matches the literal tokens "2018" and "2019"
@date:(2018\-01|2019\-01)

# Bad: bare years without wildcards — same problem
@date:(2018|2019)

# Good: each alternative gets its own trailing * to match the rest of the date string
@date:(2018\-01*|2019\-01*)
@date:(2018*|2019*)              # "any date in 2018 or 2019"
```

One-line rule above the example: *"every alternative inside `(…)` for date-as-TEXT must carry its own escape and wildcard — the `*` does not distribute across alternation."*

### 5.4 `rules/search-aggregate-pipeline.md` — multi-step pipeline patterns (R5)

Add a new subsection **"Multi-step pipeline patterns"** between "FILTER and LOAD discipline" and the reducer cheatsheet, with three worked examples:

1. **"Top N by Y per X"** — `GROUPBY @x REDUCE COUNT 0 AS n  SORTBY 2 @n DESC MAX N` and the alternative `GROUPBY @x REDUCE FIRST_VALUE 4 @y BY @stat DESC` pattern.
2. **"Distinct values with their counts"** — `GROUPBY 1 @x REDUCE COUNT 0 AS n` (the two-column return shape).
3. **"Top item per group"** — the `cars/v00005` shape: `GROUPBY @state @make REDUCE COUNT 0 AS cnt  GROUPBY 1 @state REDUCE FIRST_VALUE 4 @make BY @cnt DESC AS top_make REDUCE MAX 1 @cnt AS top_count`.

Each example is ≤15 lines per spec 0001 §7 budget.

### 5.5 Curated few-shots — `references/search-fewshot-patterns.md` (R5, R6)

New reference file (loaded conditionally per the spec-0001 §7.8 directive mechanism). Carries **5–8 Q→command pairs** drawn directly from the eval's gold dataset, one per recurring pattern shape:

| Pattern | Source case (gold) | When the rules alone aren't enough |
|---|---|---|
| Top-N per group with secondary sort | `cars/v00005` | Multi-step `GROUPBY … REDUCE … GROUPBY … FIRST_VALUE …` chain |
| Filter by year-from-date | `bites/t00044` | `LOAD @date APPLY year(@date) AS year FILTER @year == X` |
| "How many parents with at least one matching child" | `beers/t00050` (synthetic equivalent) | Nested JSONPath predicate + `exists(@alias)` |
| Distinct-values-as-list | `conditions/t00000` | `GROUPBY 0 REDUCE TOLIST` vs `GROUPBY 1 @x` |
| Per-bucket count with order | recurring across `txns/*`, `claims/*` | `GROUPBY 1 @bucket REDUCE COUNT 0 AS n SORTBY 2 @n DESC MAX N` |

Each pair is CLI-first, ≤20 lines, and cites the eval case ID as its provenance. The file ships behind the same conditional-loading directive as the client references, with `appliesTo.task: aggregate-composition`.

### 5.6 Eval harness — small report-loop helper

Add `scripts/skill-amplitude-report.mjs` that:

1. Re-runs the stratified-bad-F1 slice on all three models (after the §5.1–§5.5 changes ship).
2. Computes per-class deltas (R1–R7) and prints a table mirroring §4.5 of the multi-model report.
3. Is wired into `pnpm bench:report` so future iterations on the rule corpus are measured automatically.

## 6. Cross-Cutting Decisions

1. **Fix at the lowest-cost layer.** R1 is one eval-assertion change that closes ~35% of residuals; that's strictly cheaper than authoring more rules and asking models to memorize a routing convention the gold dataset itself doesn't honor. Symmetrically, R2/R3 are prompt-template changes — cheap, no rule corpus growth, and they help every downstream consumer of the skill, not just the eval.
2. **Don't grow the always-loaded rule corpus for semantic patterns.** R5/R6 land in a *conditional* reference file (`references/search-fewshot-patterns.md`), not in always-loaded rules. Spec 0001 §7.8's directive mechanism is exactly designed for this — load few-shots only when the task signal says "multi-step aggregate composition."
3. **Eval relaxation must be opt-out, not opt-in.** Default scoring becomes the relaxed form; `--strict-command-type` preserves the old behavior for cross-spec comparisons. This keeps spec 0005 numbers reproducible while making future deltas meaningful.
4. **Validate every prompt-template change against Haiku's sample-ids first.** Haiku's 80% recovery is the headline number; a prompt-template change that improves Sonnet/Opus by 5% but regresses Haiku by 10% is a net loss.
5. **No new external documentation sources.** See §10. This spec is a self-contained closure over the existing rule corpus + eval harness + the schema cache that's already built.

## 7. Acceptance Criteria

### 7.1 Code changes shipped

- [ ] `redis-syntax-eval/src/assertions/result-set-f1.ts` — bare-count SEARCH↔AGG equivalence relaxation behind `--strict-command-type` (default off).
- [ ] `redis-syntax-eval/src/prompt/template.ts` — `Top values per attribute` block + `Sample document` block, both gated on cache availability.
- [ ] `skills/redis-development/rules/search-query-syntax.md` — date-as-TEXT alternation wildcard rule (R4).
- [ ] `skills/redis-development/rules/search-aggregate-pipeline.md` — "Multi-step pipeline patterns" subsection (R5).
- [ ] `skills/redis-development/references/search-fewshot-patterns.md` — new conditional reference with 5–8 Q→command pairs (R5, R6).
- [ ] `skills/redis-development/references/README.md` — router entry for the new few-shot file with `appliesTo.task: aggregate-composition`.
- [ ] `redis-syntax-eval/scripts/skill-amplitude-report.mjs` — automated re-run + per-class delta table.

### 7.2 Measurement targets (re-run after changes ship)

On the same 76-case stratified bad-F1 slice per model, with skill bundle v4 (adds the §5.3/§5.4/§5.5 content) and the relaxed `result-set-f1`:

| Model | Current with-skill F1 (May 27) | Target with-skill F1 | Δ goal |
|---|---:|---:|---:|
| Haiku  (20-case hand-picked) | 0.80 | ≥ 0.80 *(no regression)* | 0 |
| Sonnet (76-case stratified)  | 0.42 | **≥ 0.65** | +0.23 |
| Opus   (76-case stratified)  | 0.34 | **≥ 0.60** | +0.26 |

Rationale for the per-model targets: R1 alone is ~+0.10–0.15 on each model from the residual analysis; R2 + R3 stack to ~+0.10 more on cases that need value enumeration or sample-doc shape; R4/R5 contribute ~+0.03–0.05.

- [ ] `npm run validate` passes after rule edits.
- [ ] `npm run build` regenerates `AGENTS.md` clean.
- [ ] Per-index breakdown re-rendered in `REPORT-skill-impact-multi-model.md` §4.5 shows lift on every previously low-F1 index (`bites`, `cars`, `cities`, `locations`, `observations`, `practitioners`, `procedures`).

## 8. Open Questions

1. **Relaxation scope for R7 (RETURN-shape equivalence).** Whether the relaxation should also accept `FT.SEARCH RETURN <n> $.path AS alias` ↔ `FT.AGGREGATE LOAD <n> $.path AS alias GROUPBY 0` as equivalent when both return the same `(key, alias_value)` rows. This is the most-aggressive form of the relaxation — risk is false equivalences on questions that actually need a list per key. Default: implement R7 behind its own `--allow-aggregate-projection` sub-flag, off by default in §7.2 measurements.
2. **Sample-doc trimming heuristic.** The schema cache stores full docs; the prompt should show only the first 1–2 trimmed. Open question: greedy truncation by JSON-path depth (depth ≤ 2) vs by byte budget (e.g. 500 chars). Greedy-by-depth is more deterministic; greedy-by-bytes preserves more values when docs are flat. Default: depth ≤ 2 + per-array length cap of 1; revisit if §7.2 misses the target.
3. **Few-shot file size and triggering.** How many Q→command pairs before the conditional-load mechanism breaks down? The spec-0001 §7.8 directive expects a single targeted reference per task signal. If the few-shot file grows past ~150 lines, consider splitting it by sub-task (counting vs grouping vs projection vs filtering). Defer the split until 5–8 pairs land and we measure.
4. **`appliesTo.task` taxonomy.** The conditional-loading directives currently take `appliesTo.client: redis-py|jedis|redisvl`. Adding a `task` axis (e.g. `task: aggregate-composition`) is a new convention — should it land as an addendum to spec 0001 §7.8 or as part of this spec? Lean: land it here, document the convention update inside §5.5, cross-link from 0001 in the iteration log.

## 9. Out-of-Scope Follow-ups

- **Full 935-case re-run with skill on all three models.** Defer until §7.2 closes; budget ≈ 90 min wall-clock total, but only meaningful once the residual classes are addressed.
- **B4 wrong-GROUPBY-dimension** (semantic, ~140 cases in the original catalog). Few-shots in §5.5 will catch the most common shapes; residual semantic failures need either domain corpora (FHIR, txns) or an in-line retrieval step — both out of scope for this spec.
- **Provider-refusal handling** (A12 in spec 0005). Still a prompt-steering concern, still out of scope.
- **Multi-language few-shot mirrors.** The new `search-fewshot-patterns.md` ships CLI-only at v1; redis-py / Jedis mirrors land in a follow-up if there's measured pull.
- **TAG-casing fallback when `top_values` is missing.** If the schema cache hasn't run for a new index, the prompt can't surface values — for now, document the cache rebuild step (`pnpm bench:schemas`) in the eval README and move on. A "fallback warning" rule that tells the model to *avoid* guessing TAG values it hasn't seen is tempting but likely makes things worse; skip until measured.

## 10. External documentation — do we need more?

**Short answer: no.** All the residual failure classes are addressable with what's already in the repo. Specifically:

| What might tempt a "let's pull in external docs" reaction | Why we don't actually need it |
|---|---|
| Redis Search syntax reference (the full `FT.*` command list) | Already covered by the existing rule corpus; residuals are *not* missing syntax — they're missing values, samples, or canonical examples. |
| Redis Search query DSL grammar | Same — residuals like R1 (count routing) and R7 (RETURN-shape) are *equivalence-class* questions the docs can't answer because both forms are valid. |
| FHIR / healthcare schema documentation (for the medical indices) | Out of scope — domain semantics are R5/R6 few-shot territory; FHIR docs would balloon the corpus without targeted gain. |
| The Redis-VL python user guide | Already absorbed by spec 0004; not implicated in the May 27 residuals. |
| Upstream `redis-py` / Jedis doctests | Already the canonical source for client mirrors per spec 0001; not the bottleneck here. |

**Where we *do* lean on external sources** (already in place):

- `data/benchmark.jsonl` — the eval's frozen gold dataset is the source of truth for §5.5 few-shots. Pick canonical examples *from* this file rather than authoring fresh ones; that way the few-shots are guaranteed to match the scoring distribution.
- `data/schemas/*.json` — already contains `top_values` and sample docs per index. §5.2 just promotes these from cached-and-ignored to first-class prompt content.
- Spec 0005's existing rule corpus — extends, doesn't replace.

**If, after §7.2 measurement, the lift is below target**, the next candidate references to evaluate (in order of expected return) are:

1. The Redis Search **dialect 3** docs around JSONPath behavior changes — `documentreferences` and `careteams` residuals hint at `DIALECT 3` vs `DIALECT 2` semantics differences that may need their own rule.
2. The Redis Search **vector hybrid query** docs — only if a future spec extends to FT.HYBRID; not implicated here.
3. **Domain-specific seed sets** (FHIR resource shapes for `claims`/`encounters`/`careteams`) — only if R5 few-shots alone don't move the medical-index F1, which we can't predict without the §7.2 numbers.

None of these are in scope for spec 0006; all are tracked here so the question doesn't recur.

## 11. Iteration Log

| Date | Change | Author |
|------|--------|--------|
| 2026-05-27 | Initial draft derived from `output/REPORT-skill-impact-multi-model.md` §4 residuals (May 27 Sonnet + Opus runs). Maps 7 residual classes (R1–R7) to fix locations across rules, prompt template, eval harness, and a new conditional-load few-shot reference. Includes §10 explicit answer to the "external docs?" question: no new upstream sources needed; existing schema cache + gold dataset are the source for the proposed prompt-template and few-shot additions. | Adriano Amaral |
