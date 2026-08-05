import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { activeProfile, launchInstructions, loadRegistry, profilePath, profilesRoot, validateName } from "../scripts/profile-manager.mjs";

test("accepts safe profile names", () => {
  for (const name of ["work", "personal-2", "a", "a1-b2"]) assert.equal(validateName(name), name);
});

test("rejects unsafe and reserved profile names", () => {
  for (const name of ["", "../work", "work/user", "Work", "work_user", "con", "LPT1", `a${"b".repeat(64)}`]) {
    assert.throws(() => validateName(name));
  }
});

test("profile paths stay directly under the profiles root", () => {
  const root = resolve(join(tmpdir(), "profiles-root"));
  assert.equal(profilePath(root, "work"), join(root, "work"));
});

test("resolves an explicit dedicated profiles home", () => {
  const root = resolve(join(tmpdir(), "explicit-profiles-root"));
  assert.equal(profilesRoot({ CLAUDE_PROFILES_HOME: root }), root);
});

test("detects the active registered profile by config directory", () => {
  const root = resolve(join(tmpdir(), "profiles-root"));
  const registry = { profiles: { work: { configDir: join(root, "work") } } };
  assert.equal(activeProfile(root, registry, { CLAUDE_CONFIG_DIR: join(root, "work") }), "work");
  assert.equal(activeProfile(root, registry, { CLAUDE_CONFIG_DIR: join(root, "other") }), null);
});

test("launch instructions include both supported shell forms", () => {
  const output = launchInstructions("C:\\Profiles\\work");
  assert.match(output, /PowerShell:/);
  assert.match(output, /CLAUDE_CONFIG_DIR/);
  assert.match(output, /macOS\/Linux:/);
});

test("loads a valid registry and rejects malformed registries", () => {
  const root = mkdtempSync(join(tmpdir(), "account-profiles-test-"));
  try {
    assert.deepEqual(loadRegistry(root), { version: 1, profiles: {} });
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, "profiles.json"), JSON.stringify({ version: 1, profiles: { work: { configDir: join(root, "work") } } }));
    assert.ok(loadRegistry(root).profiles.work);
    writeFileSync(join(root, "profiles.json"), JSON.stringify({ version: 2, profiles: {} }));
    assert.throws(() => loadRegistry(root), /Invalid profile registry/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("creates, lists, diagnoses, and safely removes profiles", () => {
  const root = mkdtempSync(join(tmpdir(), "account-profiles-e2e-"));
  const script = fileURLToPath(new URL("../scripts/profile-manager.mjs", import.meta.url));
  const run = (...args) => spawnSync(process.execPath, [script, ...args], {
    env: { ...process.env, CLAUDE_PROFILES_HOME: root },
    encoding: "utf8",
  });
  try {
    assert.equal(run("add", "work").status, 0);
    assert.match(run("list").stdout, /work\s+ready/);
    assert.equal(run("doctor").status, 0);
    assert.notEqual(run("remove", "work").status, 0);
    assert.equal(run("remove", "work", "--confirm").status, 0);
    assert.match(run("list").stdout, /No account profiles configured/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
