#!/usr/bin/env tsx
/**
 * Paired A/B evaluation runner for agent skills.
 *
 * Runs each case in <skill>/evals/evals.json twice against cursor-agent:
 *   1. without_skill: the prompt alone
 *   2. with_skill:    the prompt prefixed with the skill body
 * Both outputs are then graded by a second cursor-agent call using
 * scripts/eval/grader.md, which returns per-assertion PASS/FAIL JSON.
 *
 * All artifacts (prompts, raw outputs, grading JSON, summary) are
 * written under runs/<ISO-timestamp>/ so a run can be inspected or
 * re-graded after the fact. See scripts/eval/README.md for usage.
 */

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  Config,
  ConfigSummary,
  EvalCase,
  Grading,
  PerEvalEntry,
  RunResult,
  Summary,
} from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");

const MODEL = process.env.EVAL_MODEL ?? "sonnet-4";
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY ?? "4");
const AGENT_TIMEOUT_MS = Number(process.env.EVAL_TIMEOUT_MS ?? String(3 * 60_000));

const CONFIGS: readonly Config[] = ["without_skill", "with_skill"] as const;

// ---------------------------------------------------------------------------
// cursor-agent invocation
// ---------------------------------------------------------------------------

/**
 * Spawn `cursor-agent -p` with the prompt on stdin and collect stdout.
 * `--mode ask` keeps the agent read-only (no file edits, no shell), which
 * is what we want for answer-quality evals.
 */
async function runAgent(prompt: string, label: string): Promise<string> {
  const args = [
    "-p",
    "--mode",
    "ask",
    "--model",
    MODEL,
    "--output-format",
    "text",
    "--trust",
  ];

  return await new Promise<string>((resolvePromise, rejectPromise) => {
    const child = spawn("cursor-agent", args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: REPO_ROOT,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout.on("data", (c: Buffer) => stdoutChunks.push(c));
    child.stderr.on("data", (c: Buffer) => stderrChunks.push(c));

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      rejectPromise(
        new Error(`[${label}] cursor-agent timed out after ${AGENT_TIMEOUT_MS}ms`),
      );
    }, AGENT_TIMEOUT_MS);

    child.on("error", (err) => {
      clearTimeout(timeout);
      rejectPromise(err);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      if (code !== 0) {
        rejectPromise(
          new Error(
            `[${label}] cursor-agent exited ${code}\nstderr:\n${stderr}\nstdout:\n${stdout}`,
          ),
        );
        return;
      }
      resolvePromise(stdout);
    });

    child.stdin.end(prompt);
  });
}

// ---------------------------------------------------------------------------
// Concurrency primitive
// ---------------------------------------------------------------------------

/** Tiny promise-pool. Runs `fn(item)` for each item, at most `limit` at once. */
async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!, i);
    }
  };
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker);
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

/**
 * Pull the first top-level JSON object out of a string. cursor-agent sometimes
 * wraps its answer in a ```json fence or adds prose, even when told not to.
 */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]! : raw;
  const start = candidate.indexOf("{");
  if (start === -1) throw new Error(`No JSON object found in grader output:\n${raw}`);
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i]!;
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  throw new Error(`Unterminated JSON object in grader output:\n${raw}`);
}

async function grade(
  ec: EvalCase,
  output: string,
  graderTemplate: string,
  label: string,
): Promise<Grading> {
  const prompt = graderTemplate
    .replace("{prompt}", ec.prompt)
    .replace("{output}", output)
    .replace("{assertions}", JSON.stringify(ec.assertions, null, 2));
  const raw = await runAgent(prompt, `grade:${label}`);
  const parsed = JSON.parse(extractJson(raw)) as Grading;
  if (!Array.isArray(parsed.assertions)) {
    throw new Error(`Grader returned invalid shape for ${label}: ${raw}`);
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Per-case run
// ---------------------------------------------------------------------------

interface Task {
  ec: EvalCase;
  config: Config;
}

async function runTask(
  task: Task,
  skillBody: string,
  graderTemplate: string,
  runDir: string,
): Promise<RunResult> {
  const { ec, config } = task;
  const label = `${ec.id}/${config}`;
  const prompt =
    config === "with_skill"
      ? `<skill name="redis-development">\n${skillBody}\n</skill>\n\n${ec.prompt}`
      : ec.prompt;

  const caseDir = join(runDir, ec.id, config);
  await mkdir(caseDir, { recursive: true });
  await writeFile(join(caseDir, "prompt.txt"), prompt);

  const started = Date.now();
  const output = await runAgent(prompt, `gen:${label}`);
  const durationMs = Date.now() - started;
  await writeFile(join(caseDir, "output.txt"), output);

  const grading = await grade(ec, output, graderTemplate, label);
  await writeFile(join(caseDir, "grading.json"), JSON.stringify(grading, null, 2));

  process.stderr.write(
    `  ${label.padEnd(40)} ${grading.overall_pass ? "PASS" : "FAIL"}  (${(durationMs / 1000).toFixed(1)}s)\n`,
  );

  return {
    eval_id: ec.id,
    config,
    output,
    grading,
    duration_ms: durationMs,
  };
}

// ---------------------------------------------------------------------------
// Aggregation + reporting
// ---------------------------------------------------------------------------

function aggregate(
  results: readonly RunResult[],
  skillName: string,
  model: string,
  timestamp: string,
): Summary {
  const perEval: Record<string, Record<Config, PerEvalEntry>> = {};
  for (const r of results) {
    const bucket = (perEval[r.eval_id] ??= {} as Record<Config, PerEvalEntry>);
    bucket[r.config] = {
      pass: r.grading.overall_pass,
      assertions_passed: r.grading.assertions.filter((a) => a.result === "PASS").length,
      assertions_total: r.grading.assertions.length,
    };
  }

  const summarise = (config: Config): ConfigSummary => {
    const rows = results.filter((r) => r.config === config);
    const pass = rows.filter((r) => r.grading.overall_pass).length;
    const total = rows.length;
    return { pass, total, pass_rate: total === 0 ? 0 : pass / total };
  };

  const configs: Record<Config, ConfigSummary> = {
    with_skill: summarise("with_skill"),
    without_skill: summarise("without_skill"),
  };

  const deltaPct = (configs.with_skill.pass_rate - configs.without_skill.pass_rate) * 100;

  return {
    timestamp,
    skill: skillName,
    model,
    per_eval: perEval,
    configs,
    delta_pct: Math.round(deltaPct * 10) / 10,
  };
}

function renderTable(summary: Summary): string {
  const lines: string[] = [];
  lines.push(`# Skill eval: ${summary.skill}`);
  lines.push("");
  lines.push(`- model: \`${summary.model}\``);
  lines.push(`- run:   \`${summary.timestamp}\``);
  lines.push("");
  lines.push("## Pass rate");
  lines.push("");
  lines.push("| config         | pass | total | pass rate |");
  lines.push("|----------------|-----:|------:|----------:|");
  for (const cfg of CONFIGS) {
    const s = summary.configs[cfg];
    lines.push(
      `| ${cfg.padEnd(14)} | ${String(s.pass).padStart(4)} | ${String(s.total).padStart(5)} | ${(s.pass_rate * 100).toFixed(1).padStart(8)}% |`,
    );
  }
  const sign = summary.delta_pct >= 0 ? "+" : "";
  lines.push("");
  lines.push(`**delta (with − without): ${sign}${summary.delta_pct.toFixed(1)} pp**`);
  lines.push("");
  lines.push("## Per-case");
  lines.push("");
  lines.push("| eval id                     | without_skill | with_skill |");
  lines.push("|-----------------------------|:-------------:|:----------:|");
  for (const id of Object.keys(summary.per_eval)) {
    const row = summary.per_eval[id]!;
    const cell = (e: PerEvalEntry | undefined): string => {
      if (!e) return "—";
      const mark = e.pass ? "PASS" : "FAIL";
      return `${mark} (${e.assertions_passed}/${e.assertions_total})`;
    };
    lines.push(
      `| ${id.padEnd(27)} | ${cell(row.without_skill).padEnd(13)} | ${cell(row.with_skill).padEnd(10)} |`,
    );
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const skillArg = process.argv[2];
  if (!skillArg) {
    console.error("usage: tsx scripts/eval/run.ts <path/to/skill-dir>");
    process.exit(64);
  }
  const skillDir = resolve(REPO_ROOT, skillArg);
  const skillName = basename(skillDir);

  const [skillMd, agentsMd, evalsRaw, graderTemplate] = await Promise.all([
    readFile(join(skillDir, "SKILL.md"), "utf8"),
    readFile(join(skillDir, "AGENTS.md"), "utf8"),
    readFile(join(skillDir, "evals", "evals.json"), "utf8"),
    readFile(join(__dirname, "grader.md"), "utf8"),
  ]);
  const skillBody = `${skillMd.trim()}\n\n${agentsMd.trim()}`;
  const cases = JSON.parse(evalsRaw) as EvalCase[];

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = join(REPO_ROOT, "runs", timestamp);
  await mkdir(runDir, { recursive: true });

  const tasks: Task[] = cases.flatMap((ec) =>
    CONFIGS.map((config) => ({ ec, config })),
  );

  process.stderr.write(
    `Running ${tasks.length} tasks (${cases.length} cases × ${CONFIGS.length} configs) against ${MODEL}\n`,
  );
  process.stderr.write(`Output: ${runDir}\n\n`);

  const results = await mapPool(tasks, CONCURRENCY, (t) =>
    runTask(t, skillBody, graderTemplate, runDir),
  );

  const summary = aggregate(results, skillName, MODEL, timestamp);
  await writeFile(join(runDir, "summary.json"), JSON.stringify(summary, null, 2));

  const table = renderTable(summary);
  await writeFile(join(runDir, "summary.md"), table);
  process.stdout.write(`\n${table}\n`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
