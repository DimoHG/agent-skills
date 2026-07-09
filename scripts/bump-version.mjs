#!/usr/bin/env node

// Bump a skill's version consistently across every place it appears, plus the
// shared marketplace bundle versions. Targeted string replacement is used
// (rather than JSON re-serialization) so the manifests keep their formatting.
//
// Usage:
//   node scripts/bump-version.mjs <skill-name> [patch|minor|major]
//   npm run bump -- <skill-name> [patch|minor|major]   (default: patch)

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const LEVELS = ["patch", "minor", "major"];

const CURSOR_MARKETPLACE = path.join(repoRoot, ".cursor-plugin", "marketplace.json");
const CLAUDE_MARKETPLACE = path.join(repoRoot, ".claude-plugin", "marketplace.json");
const CLAUDE_BUNDLE_PLUGIN = "redis-development";

function fail(message) {
  console.error(`bump-version: ${message}`);
  process.exit(1);
}

function parseSemver(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(value).trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function bumpSemver(value, level) {
  const parts = parseSemver(value);
  if (!parts) throw new Error(`cannot parse semver "${value}"`);
  let [major, minor, patch] = parts;
  if (level === "major") return `${major + 1}.0.0`;
  if (level === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Replace the "version" field that appears within the object whose "name"
// matches `name` (e.g. a marketplace plugin entry). Version must come after
// name in the entry, which is the convention across this repo's manifests.
function replaceEntryVersion(content, name, newVersion, context) {
  const pattern = new RegExp(
    `("name":\\s*"${escapeRegExp(name)}"[\\s\\S]*?"version":\\s*)"[^"]*"`,
  );
  if (!pattern.test(content)) {
    fail(`could not find a "version" field for entry "${name}" in ${context}`);
  }
  return content.replace(pattern, `$1"${newVersion}"`);
}

// Replace the "version" field inside the top-level "metadata" block.
function replaceMetadataVersion(content, newVersion, context) {
  const pattern = /("metadata":\s*\{[\s\S]*?"version":\s*)"[^"]*"/;
  if (!pattern.test(content)) {
    fail(`could not find metadata.version in ${context}`);
  }
  return content.replace(pattern, `$1"${newVersion}"`);
}

async function readFile(filePath, context) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    fail(`missing file: ${filePath} (${context})`);
    return "";
  }
}

// Bump the metadata.version of a marketplace bundle by `level` and return the
// new value, so both bundles can be kept in lock-step.
async function bumpBundle(filePath, level, context) {
  const content = await readFile(filePath, context);
  const current = /"metadata":\s*\{[\s\S]*?"version":\s*"([^"]*)"/.exec(content);
  if (!current) fail(`could not read metadata.version from ${context}`);
  const next = bumpSemver(current[1], level);
  await fs.writeFile(filePath, replaceMetadataVersion(content, next, context));
  return next;
}

async function main() {
  const [skillName, levelArg = "patch"] = process.argv.slice(2);
  if (!skillName) {
    fail("usage: node scripts/bump-version.mjs <skill-name> [patch|minor|major]");
  }
  const level = levelArg.toLowerCase();
  if (!LEVELS.includes(level)) {
    fail(`level must be one of ${LEVELS.join(", ")} (got "${levelArg}")`);
  }

  const skillDir = path.join(repoRoot, "skills", skillName);
  const pluginManifestPath = path.join(skillDir, ".cursor-plugin", "plugin.json");
  const skillMdPath = path.join(skillDir, "SKILL.md");

  // Source of truth for the current per-skill version: the Cursor plugin.json.
  const pluginContent = await readFile(pluginManifestPath, "cursor plugin.json");
  const currentMatch = /"version":\s*"([^"]*)"/.exec(pluginContent);
  if (!currentMatch) fail(`no "version" field in ${pluginManifestPath}`);
  const currentVersion = currentMatch[1];
  const newVersion = bumpSemver(currentVersion, level);

  // 1. Cursor per-skill plugin.json
  await fs.writeFile(
    pluginManifestPath,
    pluginContent.replace(/("version":\s*)"[^"]*"/, `$1"${newVersion}"`),
  );

  // 2. SKILL.md frontmatter metadata.version (only within the leading --- block)
  const skillMd = await readFile(skillMdPath, "SKILL.md");
  const fmEnd = skillMd.indexOf("\n---", 3);
  if (!skillMd.startsWith("---") || fmEnd === -1) {
    fail(`could not locate frontmatter block in ${skillMdPath}`);
  }
  const frontmatter = skillMd.slice(0, fmEnd);
  const rest = skillMd.slice(fmEnd);
  if (!/(^|\n)\s*version:\s*"?[^"\n]*"?/.test(frontmatter)) {
    fail(`no version field in ${skillMdPath} frontmatter`);
  }
  const newFrontmatter = frontmatter.replace(
    /((^|\n)\s*version:\s*)"?[^"\n]*"?/,
    `$1"${newVersion}"`,
  );
  await fs.writeFile(skillMdPath, newFrontmatter + rest);

  // 3. Cursor marketplace entry for this skill + its bundle version
  let cursorMarketplace = await readFile(CURSOR_MARKETPLACE, "cursor marketplace");
  cursorMarketplace = replaceEntryVersion(
    cursorMarketplace,
    skillName,
    newVersion,
    "cursor marketplace.json",
  );
  await fs.writeFile(CURSOR_MARKETPLACE, cursorMarketplace);
  const cursorBundle = await bumpBundle(CURSOR_MARKETPLACE, level, "cursor marketplace.json");

  // 4. Claude bundle: metadata.version + the redis-development entry (the only
  //    update signal Claude Code has, since it ships all skills as one plugin).
  const claudeBundle = await bumpBundle(CLAUDE_MARKETPLACE, level, "claude marketplace.json");
  let claudeMarketplace = await readFile(CLAUDE_MARKETPLACE, "claude marketplace");
  claudeMarketplace = replaceEntryVersion(
    claudeMarketplace,
    CLAUDE_BUNDLE_PLUGIN,
    claudeBundle,
    "claude marketplace.json",
  );
  await fs.writeFile(CLAUDE_MARKETPLACE, claudeMarketplace);

  console.log(`Bumped ${skillName}: ${currentVersion} -> ${newVersion} (${level})`);
  console.log(`  cursor bundle -> ${cursorBundle}, claude bundle -> ${claudeBundle}`);
  console.log("Review the diff, then commit. Remember the Cursor public listing");
  console.log("still needs a manual re-submit at cursor.com/marketplace/publish.");
}

main().catch((error) => fail(error.message));
