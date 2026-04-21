export type Config = "with_skill" | "without_skill";

export interface EvalCase {
  id: string;
  prompt: string;
  assertions: string[];
}

export interface AssertionResult {
  assertion: string;
  result: "PASS" | "FAIL";
  evidence: string;
}

export interface Grading {
  assertions: AssertionResult[];
  overall_pass: boolean;
}

export interface RunResult {
  eval_id: string;
  config: Config;
  output: string;
  grading: Grading;
  duration_ms: number;
}

export interface PerEvalEntry {
  pass: boolean;
  assertions_passed: number;
  assertions_total: number;
}

export interface ConfigSummary {
  pass: number;
  total: number;
  pass_rate: number;
}

export interface Summary {
  timestamp: string;
  skill: string;
  model: string;
  per_eval: Record<string, Record<Config, PerEvalEntry>>;
  configs: Record<Config, ConfigSummary>;
  delta_pct: number;
}
