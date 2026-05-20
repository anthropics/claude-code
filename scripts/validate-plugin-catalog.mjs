#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const pluginsRoot = path.join(repoRoot, "plugins");
const pluginsReadmePath = path.join(pluginsRoot, "README.md");
const marketplacePath = path.join(repoRoot, ".claude-plugin", "marketplace.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listPluginDirectories(rootPath) {
  return fs
    .readdirSync(rootPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function parsePluginNamesFromReadme(markdown) {
  const matches = [...markdown.matchAll(/^\|\s+\[([^\]]+)\]\(\.\/([^)]+)\/\)\s+\|/gm)];
  return matches
    .map(([, name, href]) => {
      const normalizedHref = href.replace(/\/$/, "");
      if (name !== normalizedHref) {
        throw new Error(
          `plugins/README.md row name "${name}" does not match linked directory "${normalizedHref}"`
        );
      }
      return name;
    })
    .sort();
}

function compareSets(actual, expected, label, errors) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);

  for (const value of actualSet) {
    if (!expectedSet.has(value)) {
      errors.push(`${label}: unexpected entry "${value}"`);
    }
  }

  for (const value of expectedSet) {
    if (!actualSet.has(value)) {
      errors.push(`${label}: missing entry "${value}"`);
    }
  }
}

function validatePlugin(pluginName, marketplaceEntries, errors) {
  const pluginRoot = path.join(pluginsRoot, pluginName);
  const readmePath = path.join(pluginRoot, "README.md");
  const manifestPath = path.join(pluginRoot, ".claude-plugin", "plugin.json");

  if (!fs.existsSync(readmePath)) {
    errors.push(`plugins/${pluginName}: missing README.md`);
  }

  if (!fs.existsSync(manifestPath)) {
    errors.push(`plugins/${pluginName}: missing .claude-plugin/plugin.json`);
    return;
  }

  const manifest = readJson(manifestPath);
  if (manifest.name !== pluginName) {
    errors.push(
      `plugins/${pluginName}: manifest name "${manifest.name}" does not match directory name`
    );
  }

  const marketplaceEntry = marketplaceEntries.get(pluginName);
  if (!marketplaceEntry) {
    errors.push(`marketplace.json: missing plugin entry for "${pluginName}"`);
    return;
  }

  const expectedSource = `./plugins/${pluginName}`;
  if (marketplaceEntry.source !== expectedSource) {
    errors.push(
      `marketplace.json: plugin "${pluginName}" should use source "${expectedSource}", got "${marketplaceEntry.source}"`
    );
  }
}

function main() {
  const pluginDirectories = listPluginDirectories(pluginsRoot);
  const pluginsReadme = fs.readFileSync(pluginsReadmePath, "utf8");
  const readmePlugins = parsePluginNamesFromReadme(pluginsReadme);
  const marketplace = readJson(marketplacePath);
  const marketplacePlugins = [...marketplace.plugins]
    .map((plugin) => plugin.name)
    .sort();
  const marketplaceEntries = new Map(
    marketplace.plugins.map((plugin) => [plugin.name, plugin])
  );

  const errors = [];

  compareSets(readmePlugins, pluginDirectories, "plugins/README.md", errors);
  compareSets(marketplacePlugins, pluginDirectories, "marketplace.json", errors);

  for (const pluginName of pluginDirectories) {
    validatePlugin(pluginName, marketplaceEntries, errors);
  }

  if (errors.length > 0) {
    console.error("Plugin catalog validation failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`Plugin catalog validation passed for ${pluginDirectories.length} plugins.`);
}

main();
