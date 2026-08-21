#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";

const PROFILE_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

function profilesRoot(env = process.env) {
  return resolve(env.CLAUDE_PROFILES_HOME || join(homedir(), ".claude-profiles"));
}

function registryPath(root) {
  return join(root, "profiles.json");
}

function markerPath(root) {
  return join(root, ".account-profiles-root");
}

function ensureSafeRoot(root) {
  if (root === dirname(root) || root === resolve(homedir())) {
    throw new Error("CLAUDE_PROFILES_HOME must be a dedicated subdirectory, not a filesystem root or home directory.");
  }
}

function loadRegistry(root) {
  const path = registryPath(root);
  if (!existsSync(path)) return { version: 1, profiles: {} };
  const registry = JSON.parse(readFileSync(path, "utf8"));
  if (registry.version !== 1 || !registry.profiles || Array.isArray(registry.profiles)) {
    throw new Error(`Invalid profile registry: ${path}`);
  }
  return registry;
}

function saveRegistry(root, registry) {
  ensureSafeRoot(root);
  mkdirSync(root, { recursive: true });
  if (!existsSync(markerPath(root))) writeFileSync(markerPath(root), "Managed by the Claude Code account-profiles plugin.\n", { mode: 0o600 });
  const path = registryPath(root);
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(registry, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

function validateName(name) {
  if (!name || !PROFILE_RE.test(name) || RESERVED_WINDOWS_NAMES.test(name)) {
    throw new Error("Profile names must be 1-64 lowercase letters, numbers, or hyphens; reserved device names are not allowed.");
  }
  return name;
}

function profilePath(root, name) {
  const path = resolve(root, name);
  if (dirname(path) !== root) throw new Error("Profile path escaped the profiles directory.");
  return path;
}

function quotePowerShell(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function quotePosix(value) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function launchInstructions(path) {
  return [
    "PowerShell:",
    `  $env:CLAUDE_CONFIG_DIR=${quotePowerShell(path)}; claude`,
    "",
    "macOS/Linux:",
    `  CLAUDE_CONFIG_DIR=${quotePosix(path)} claude`,
  ].join("\n");
}

function activeProfile(root, registry, env = process.env) {
  if (!env.CLAUDE_CONFIG_DIR) return null;
  const activePath = resolve(env.CLAUDE_CONFIG_DIR);
  return Object.entries(registry.profiles).find(([, profile]) => resolve(profile.configDir) === activePath)?.[0] || null;
}

function commandAdd(root, name) {
  ensureSafeRoot(root);
  validateName(name);
  const registry = loadRegistry(root);
  if (registry.profiles[name]) throw new Error(`Profile already exists: ${name}`);
  const configDir = profilePath(root, name);
  mkdirSync(root, { recursive: true });
  mkdirSync(configDir, { recursive: false });
  registry.profiles[name] = { configDir, createdAt: new Date().toISOString() };
  saveRegistry(root, registry);
  console.log(`Created profile: ${name}\nConfig directory: ${configDir}\n\n${launchInstructions(configDir)}\n\nAuthenticate once with /login after launching this profile.`);
}

function commandList(root) {
  const registry = loadRegistry(root);
  const active = activeProfile(root, registry);
  const names = Object.keys(registry.profiles).sort();
  if (!names.length) return console.log("No account profiles configured.");
  for (const name of names) {
    const marker = name === active ? "*" : " ";
    const present = existsSync(registry.profiles[name].configDir) ? "ready" : "missing directory";
    console.log(`${marker} ${name.padEnd(20)} ${present.padEnd(18)} ${registry.profiles[name].configDir}`);
  }
}

function commandStatus(root) {
  const registry = loadRegistry(root);
  const active = activeProfile(root, registry);
  if (!process.env.CLAUDE_CONFIG_DIR) {
    console.log("No CLAUDE_CONFIG_DIR is set. Claude Code is using its default profile.");
  } else if (active) {
    console.log(`Active profile: ${active}\nConfig directory: ${resolve(process.env.CLAUDE_CONFIG_DIR)}`);
  } else {
    console.log(`CLAUDE_CONFIG_DIR is not a registered profile: ${resolve(process.env.CLAUDE_CONFIG_DIR)}`);
  }
}

function commandLaunch(root, name) {
  validateName(name);
  const registry = loadRegistry(root);
  const profile = registry.profiles[name];
  if (!profile) throw new Error(`Unknown profile: ${name}`);
  console.log(`Launch ${name} in a new terminal. The current Claude Code process cannot change its own authentication environment.\n\n${launchInstructions(profile.configDir)}`);
}

function commandRemove(root, name, confirmed) {
  ensureSafeRoot(root);
  validateName(name);
  if (!confirmed) throw new Error("Removal requires --confirm. This deletes the profile's local settings and sessions.");
  const registry = loadRegistry(root);
  const profile = registry.profiles[name];
  if (!profile) throw new Error(`Unknown profile: ${name}`);
  if (activeProfile(root, registry) === name) throw new Error("Refusing to remove the active profile.");
  if (!existsSync(markerPath(root))) throw new Error("Refusing to remove files because the profiles-root safety marker is missing.");
  const expected = profilePath(root, name);
  if (resolve(profile.configDir) !== expected) throw new Error("Refusing to remove a profile with an unexpected path.");
  rmSync(expected, { recursive: true, force: true });
  delete registry.profiles[name];
  saveRegistry(root, registry);
  console.log(`Removed profile: ${name}\nOAuth access was not revoked server-side.`);
}

function assignmentPath(cwd = process.cwd()) {
  return join(cwd, ".claude", "account-profile.local.json");
}

function commandAssign(root, name) {
  validateName(name);
  const registry = loadRegistry(root);
  if (!registry.profiles[name]) throw new Error(`Unknown profile: ${name}`);
  const path = assignmentPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ profile: name }, null, 2)}\n`, { flag: "w" });
  console.log(`Assigned this project to profile: ${name}\nSaved: ${path}\nKeep this local file out of version control.`);
}

function projectExpectation() {
  const path = assignmentPath();
  if (!existsSync(path)) return null;
  const assignment = JSON.parse(readFileSync(path, "utf8"));
  validateName(assignment.profile);
  return { ...assignment, path };
}

function commandCheckProject(root, hookMode) {
  const expected = projectExpectation();
  if (!expected) return;
  const registry = loadRegistry(root);
  const active = activeProfile(root, registry);
  if (active === expected.profile) return;
  const message = `Account profile mismatch: this project expects "${expected.profile}", but the active profile is ${active ? `"${active}"` : "the default or an unregistered profile"}. Run /account-profiles:launch ${expected.profile} and restart in the new terminal.`;
  console.log(hookMode ? JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: message } }) : message);
}

function commandDoctor(root) {
  const registry = loadRegistry(root);
  const issues = [];
  for (const [name, profile] of Object.entries(registry.profiles)) {
    try {
      validateName(name);
      if (resolve(profile.configDir) !== profilePath(root, name)) issues.push(`${name}: unexpected config path`);
      else if (!existsSync(profile.configDir)) issues.push(`${name}: config directory is missing`);
    } catch (error) {
      issues.push(`${name}: ${error.message}`);
    }
  }
  const duplicatePaths = Object.values(registry.profiles).map((profile) => resolve(profile.configDir));
  if (new Set(duplicatePaths).size !== duplicatePaths.length) issues.push("Multiple profiles share the same config directory");
  console.log(`Profiles home: ${root}`);
  console.log(`Registered profiles: ${Object.keys(registry.profiles).length}`);
  console.log(process.env.CLAUDE_CONFIG_DIR ? `Current CLAUDE_CONFIG_DIR: ${resolve(process.env.CLAUDE_CONFIG_DIR)}` : "Current CLAUDE_CONFIG_DIR: not set");
  if (issues.length) {
    for (const issue of issues) console.log(`ERROR: ${issue}`);
    process.exitCode = 1;
  } else {
    console.log("Profile directory checks passed. Confirm account identity separately with /status in each launched profile.");
  }
}

function usage() {
  console.log("Usage: profile-manager.mjs <add|list|status|launch|assign|check-project|doctor|remove> [profile] [--confirm|--hook]");
}

export function main(argv = process.argv.slice(2)) {
  const [command, name, ...flags] = argv;
  const root = profilesRoot();
  switch (command) {
    case "add": return commandAdd(root, name);
    case "list": return commandList(root);
    case "status": return commandStatus(root);
    case "launch": return commandLaunch(root, name);
    case "assign": return commandAssign(root, name);
    case "check-project": return commandCheckProject(root, flags.includes("--hook") || name === "--hook");
    case "doctor": return commandDoctor(root);
    case "remove": return commandRemove(root, name, flags.includes("--confirm"));
    default: usage(); process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

export { activeProfile, launchInstructions, loadRegistry, profilePath, profilesRoot, validateName };
