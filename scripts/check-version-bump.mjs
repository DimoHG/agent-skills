#!/usr/bin/env node

// Fail a PR if a skill's shipped content changed without a version bump.
//
// Rules (checked against the merge-base with the PR's base branch):
//   1. If any non-eval file under skills/<name>/ changed, that skill's version
//      must have INCREASED in all three places it lives:
//        - skills/<name>/.cursor-plugin/plugin.json
//        - skills/<name>/SKILL.md            (metadata.version)
//        - .cursor-plugin/marketplace.json   (the <name> entry)
//      and those three must agree with each other.
//   2. When any skill changed, the Claude bundle version must also have
//      increased (.claude-plugin/marketplace.json metadata.version) — it is the
//      only update signal Claude Code has, since it ships all skills as one plugin.
//   3. A brand-new skill (no version at the base) is exempt from rule 1.
//
// Base ref: $GITHUB_BASE_REF (CI) -> origin/<ref>, else --base <ref>, else origin/main.

import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const errors = [];
const CLAUDE_MARKETPLACE = ".claude-plugin/marketplace.json";
const CURSOR_MARKETPLACE = ".cursor-plugin/marketplace.json";

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function tryGit(args) {
  try {
    return git(args);
  } catch {
    return null;
  }
}

// Contents of a repo-relative path at a given ref, or null if absent there.
function showAtRef(ref, relPath) {
  return tryGit(["show", `${ref}:${relPath}`]);
}

function parseSemver(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(value ?? "").trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function isGreater(next, prev) {
  const a = parseSemver(next);
  const b = parseSemver(prev);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}

function pluginJsonVersion(content) {
  if (content == null) return null;
  const match = /"version":\s*"([^"]*)"/.exec(content);
  return match ? match[1] : null;
}

function skillMdVersion(content) {
  if (content == null) return null;
  const fmEnd = content.indexOf("\n---", 3);
  const frontmatter = content.startsWith("---") && fmEnd !== -1
    ? content.slice(0, fmEnd)
    : content;
  const match = /(?:^|\n)\s*version:\s*"?([0-9]+\.[0-9]+\.[0-9]+)"?/.exec(frontmatter);
  return match ? match[1] : null;
}

function marketplaceEntryVersion(content, name) {
  if (content == null) return null;
  const pattern = new RegExp(
    `"name":\\s*"${name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}"[\\s\\S]*?"version":\\s*"([^"]*)"`,
  );
  const match = pattern.exec(content);
  return match ? match[1] : null;
}

function metadataVersion(content) {
  if (content == null) return null;
  const match = /"metadata":\s*\{[\s\S]*?"version":\s*"([^"]*)"/.exec(content);
  return match ? match[1] : null;
}

function resolveBaseRef() {
  const flagIndex = process.argv.indexOf("--base");
  if (flagIndex !== -1 && process.argv[flagIndex + 1]) {
    return process.argv[flagIndex + 1];
  }
  if (process.env.GITHUB_BASE_REF) {
    return `origin/${process.env.GITHUB_BASE_REF}`;
  }
  return "origin/main";
}

async function readWorkingTree(relPath) {
  try {
    return await fs.readFile(path.join(repoRoot, relPath), "utf8");
  } catch {
    return null;
  }
}

async function main() {
  const baseRef = resolveBaseRef();

  // Verify the base ref is reachable; if not, skip rather than false-fail
  // (e.g. running locally with no matching remote-tracking branch).
  if (!tryGit(["rev-parse", "--verify", "--quiet", baseRef])) {
    console.log(`check-version-bump: base ref "${baseRef}" not found; skipping.`);
    return;
  }

  const mergeBase = tryGit(["merge-base", baseRef, "HEAD"]);
  if (!mergeBase) {
    console.log(`check-version-bump: no merge-base with "${baseRef}"; skipping.`);
    return;
  }

  const diff = git(["diff", "--name-only", mergeBase, "HEAD"]);
  const changedFiles = diff ? diff.split("\n").filter(Boolean) : [];
  if (changedFiles.length === 0) {
    console.log("check-version-bump: no changes vs base; nothing to check.");
    return;
  }

  // Which skills had shipped (non-eval) content change?
  const changedSkills = new Set();
  for (const file of changedFiles) {
    const match = /^skills\/([^/]+)\//.exec(file);
    if (!match) continue;
    const rest = file.slice(`skills/${match[1]}/`.length);
    if (rest.startsWith("evals/")) continue; // internal tooling, not shipped
    changedSkills.add(match[1]);
  }

  if (changedSkills.size === 0) {
    console.log("check-version-bump: no shipped skill content changed; OK.");
    return;
  }

  const cursorMarketplaceNew = await readWorkingTree(CURSOR_MARKETPLACE);
  const cursorMarketplaceOld = showAtRef(mergeBase, CURSOR_MARKETPLACE);

  for (const skill of [...changedSkills].sort()) {
    const pluginRel = `skills/${skill}/.cursor-plugin/plugin.json`;
    const skillMdRel = `skills/${skill}/SKILL.md`;

    const oldPlugin = pluginJsonVersion(showAtRef(mergeBase, pluginRel));
    if (oldPlugin == null) {
      // No version at base -> treat as a brand-new skill, exempt from rule 1.
      console.log(`check-version-bump: "${skill}" looks new (no base version); skipping bump rule.`);
      continue;
    }

    const newPlugin = pluginJsonVersion(await readWorkingTree(pluginRel));
    const newSkillMd = skillMdVersion(await readWorkingTree(skillMdRel));
    const newEntry = marketplaceEntryVersion(cursorMarketplaceNew, skill);

    if (!isGreater(newPlugin, oldPlugin)) {
      errors.push(
        `"${skill}" changed but its version did not increase (${oldPlugin} -> ${newPlugin ?? "?"}). ` +
          `Run: npm run bump -- ${skill} <patch|minor|major>`,
      );
      continue;
    }
    if (newSkillMd !== newPlugin) {
      errors.push(
        `"${skill}" version mismatch: SKILL.md=${newSkillMd ?? "?"} but plugin.json=${newPlugin}. ` +
          `Use npm run bump to keep them in sync.`,
      );
    }
    if (newEntry !== newPlugin) {
      errors.push(
        `"${skill}" version mismatch: ${CURSOR_MARKETPLACE} entry=${newEntry ?? "?"} but plugin.json=${newPlugin}.`,
      );
    }
  }

  // Rule 2: the Claude bundle must move whenever any skill changed.
  const claudeOld = metadataVersion(showAtRef(mergeBase, CLAUDE_MARKETPLACE));
  const claudeNew = metadataVersion(await readWorkingTree(CLAUDE_MARKETPLACE));
  if (claudeOld != null && !isGreater(claudeNew, claudeOld)) {
    errors.push(
      `Skill content changed but the Claude bundle version did not increase ` +
        `(${CLAUDE_MARKETPLACE} metadata.version ${claudeOld} -> ${claudeNew ?? "?"}). ` +
        `npm run bump does this for you.`,
    );
  }

  // Cursor bundle mismatch is a soft warning (per-skill version is Cursor's real signal).
  const cursorBundleOld = metadataVersion(cursorMarketplaceOld);
  const cursorBundleNew = metadataVersion(cursorMarketplaceNew);
  if (cursorBundleOld != null && !isGreater(cursorBundleNew, cursorBundleOld)) {
    console.log(
      `check-version-bump: note — ${CURSOR_MARKETPLACE} metadata.version was not bumped ` +
        `(${cursorBundleOld}); this is allowed but keeping the bundles in lock-step is tidier.`,
    );
  }

  if (errors.length > 0) {
    console.error("check-version-bump: FAILED");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`check-version-bump: OK (${changedSkills.size} changed skill(s) properly bumped).`);
}

main().catch((error) => {
  console.error(`check-version-bump: ${error.message}`);
  process.exit(1);
});
