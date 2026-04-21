# Skill evals

A minimal paired A/B harness that measures whether a skill actually helps
`cursor-agent` answer a fixed set of questions better than the same agent
without the skill.

The answer to "does this skill help?" is a single number: the delta in
pass rate between `with_skill` and `without_skill` across every eval in
the skill's `evals/evals.json`.

## Quick start

```bash
npm install
npm run eval:redis
```

Pre-requisites:
- `cursor-agent` on `$PATH` and logged in (`cursor-agent status`).
- `node >= 20` (the repo already pins `tsx` as a dev dependency).

On a clean run you should see, roughly:

```
Running 6 tasks (3 cases × 2 configs) against sonnet-4
Output: /…/runs/2026-04-21T…

  pubsub-vs-streams/without_skill          FAIL  (…s)
  pubsub-vs-streams/with_skill             PASS  (…s)
  …

# Skill eval: redis-development

| config         | pass | total | pass rate |
|----------------|-----:|------:|----------:|
| without_skill  |    1 |     3 |    33.3 % |
| with_skill     |    3 |     3 |   100.0 % |

**delta (with − without): +66.7 pp**
```

## What it does

For each case in `skills/<skill>/evals/evals.json`:

1. Sends the prompt alone → `without_skill` answer.
2. Sends the prompt prefixed with `SKILL.md` + `AGENTS.md` wrapped in a
   `<skill name="…">…</skill>` block → `with_skill` answer.
3. Sends each answer back to `cursor-agent` together with the
   assertions from `evals.json` and the grader prompt
   (`scripts/eval/grader.md`). The grader returns per-assertion
   `PASS` / `FAIL` as JSON.
4. Aggregates a pass-rate delta and writes it to stdout and to
   `runs/<timestamp>/summary.md`.

All generation calls use `cursor-agent -p --mode ask`, so the agent
under test is read-only (no shell, no file edits) during the eval.

## Layout of a run

```
runs/<ISO-timestamp>/
  <eval-id>/
    without_skill/
      prompt.txt     # exactly what was sent to the agent
      output.txt     # raw model answer
      grading.json   # per-assertion PASS/FAIL + short evidence
    with_skill/
      prompt.txt
      output.txt
      grading.json
  summary.json       # machine-readable aggregate
  summary.md         # the markdown table printed to stdout
```

The `runs/` directory is gitignored. Every file in a run is plain text
or JSON, so you can `cat`, `diff`, or post-process them with any tool.

## Adding a new eval case

Edit `skills/<skill>/evals/evals.json`:

```json
{
  "id": "my-new-case",
  "prompt": "The developer question, phrased as a user would ask it.",
  "assertions": [
    "Specific, objectively checkable claim the answer must support",
    "Another claim; keep these to 2–4 per case"
  ]
}
```

Guidelines:

- **Prompts** should read like real user questions. Avoid meta-language
  like "following best practices …"; that tips off the model without
  the skill.
- **Assertions** must be verifiable from the answer text alone
  (the grader never executes code). Prefer "Uses XADD" over "Works
  correctly". Specific command names, flags, or anti-patterns the
  answer must avoid make strong assertions.
- Aim for cases where the skill and a generic LLM are likely to
  disagree, otherwise the delta is always zero and the eval teaches
  you nothing.

## Adding a new skill

The runner takes a skill directory as its only argument, so no code
changes are needed — just:

1. Create `skills/<new-skill>/evals/evals.json` following the shape
   above.
2. Add an npm script in the repo root `package.json`:

   ```json
   "eval:newskill": "tsx scripts/eval/run.ts skills/<new-skill>"
   ```

## Configuration

Environment variables (all optional):

| Variable            | Default  | Meaning                                  |
|---------------------|----------|------------------------------------------|
| `EVAL_MODEL`        | `sonnet-4` | `--model` passed to `cursor-agent`.     |
| `EVAL_CONCURRENCY`  | `4`      | Max parallel `cursor-agent` invocations. |
| `EVAL_TIMEOUT_MS`   | `180000` | Per-call timeout; SIGKILL on expiry.     |

Example:

```bash
EVAL_MODEL=gpt-5 EVAL_CONCURRENCY=2 npm run eval:redis
```

## Scope / non-goals

This harness is intentionally small. It does **not** do any of:

- Multi-sample statistics (N = 1 per config; expect ± one flipped
  assertion between runs).
- Blind-comparison style grading.
- Skill description / trigger optimisation.
- A browser viewer for the outputs.
- CI integration.

It answers one question: _does this skill move the pass rate on this
fixed eval set?_ Everything else is out of scope.
