// Render each fixed-canvas slide in an HTML file to a PNG.
//
// The HTML is the source of truth: every slide is a root element carrying
// data-canvas-width / data-canvas-height, so this script never has to be told
// the dimensions. That keeps one file usable for both outputs — PNGs for direct
// Instagram upload, and Adobe Express import, which reads the same attributes.
//
//   node render.mjs nobel-2025.html            # -> out/nobel-2025-01.png, -02, ...
//   node render.mjs nobel-2025.html --out dist
//
// Chromium comes from PLAYWRIGHT_BROWSERS_PATH when set, otherwise from
// playwright's own resolution.

import { execSync } from "node:child_process";
import { mkdir, readdir, rm } from "node:fs/promises";
import { basename, extname, resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

// playwright is usually installed globally rather than as a dependency of this
// directory, and ESM ignores NODE_PATH — so fall back to the global root by
// path. Keeps `node render.mjs` working with no local node_modules.
async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
    const root = execSync("npm root -g", { encoding: "utf8" }).trim();
    return import(pathToFileURL(join(root, "playwright", "index.mjs")).href);
  }
}

const { chromium } = await loadPlaywright();

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith("--"));
if (!input) {
  console.error("usage: node render.mjs <file.html> [--out DIR] [--scale N]");
  process.exit(1);
}

const outFlag = args.indexOf("--out");
const outDir = resolve(outFlag === -1 ? "out" : args[outFlag + 1]);
const scaleFlag = args.indexOf("--scale");
const scale = scaleFlag === -1 ? 1 : Number(args[scaleFlag + 1]);

const file = resolve(input);
const stem = basename(file, extname(file));

await mkdir(outDir, { recursive: true });
// Clear this file's previous output only, so rendering one deck does not wipe
// another's PNGs out of the same directory.
for (const name of await readdir(outDir)) {
  if (name.startsWith(`${stem}-`) && name.endsWith(".png")) {
    await rm(join(outDir, name));
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: scale });
await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);

const selector =
  (await page.evaluate(
    () => document.querySelector('meta[name="hz:slide-selector"]')?.content,
  )) ?? ".slide";

const slides = await page.$$(selector);
if (!slides.length) {
  await browser.close();
  console.error(`No slides matched ${selector} in ${input}`);
  process.exit(1);
}

const written = [];
for (const [index, slide] of slides.entries()) {
  const box = await slide.evaluate((el) => ({
    w: Number(el.dataset.canvasWidth) || el.offsetWidth,
    h: Number(el.dataset.canvasHeight) || el.offsetHeight,
  }));
  // Size the viewport to the slide before shooting it. An element screenshot on
  // a viewport smaller than the element still works, but lazy/viewport-relative
  // CSS resolves against the viewport, so matching them keeps vh units honest.
  await page.setViewportSize({ width: box.w, height: box.h });
  const path = join(outDir, `${stem}-${String(index + 1).padStart(2, "0")}.png`);
  await slide.screenshot({ path });
  written.push(`${basename(path)}  ${box.w}x${box.h}${scale === 1 ? "" : ` @${scale}x`}`);
}

await browser.close();
console.log(written.join("\n"));
