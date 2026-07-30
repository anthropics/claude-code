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
// Tarayıcı: playwright'ın kendi Chromium'u varsa o, yoksa sistemde kurulu
// Chrome. İkincisi sayesinde 140MB'lık indirme zorunlu değil.

import { execSync } from "node:child_process";
import { mkdir, readdir, rm } from "node:fs/promises";
import { basename, extname, resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const INSTALL_HINT = `
playwright kurulu değil. Tek seferlik kurulum:

    npm i -g playwright

Bu kadarı yeterli — script sistemdeki Google Chrome'u kullanıyor.
Chrome yoksa playwright'ın kendi tarayıcısını da indirebilirsin:

    npx playwright install chromium
`;

// playwright genelde bu dizinin bağımlılığı değil, global kurulu oluyor; ESM de
// NODE_PATH'i yok sayıyor. Bu yüzden global köke elle bakıyoruz.
async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
  }
  try {
    const root = execSync("npm root -g", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return await import(pathToFileURL(join(root, "playwright", "index.mjs")).href);
  } catch {
    // Yığın izi burada işe yaramıyor; kullanıcının ihtiyacı olan tek şey
    // hangi komutu çalıştıracağı.
    console.error(INSTALL_HINT);
    process.exit(1);
  }
}

const { chromium } = await loadPlaywright();

/**
 * Tarayıcıyı başlat: önce playwright'ın kendi Chromium'u, o indirilmemişse
 * sistemde kurulu Chrome.
 *
 * `npm i -g playwright` tarayıcıyı beraberinde getirmiyor, dolayısıyla temiz
 * bir kurulumda ilk deneme "Executable doesn't exist" ile düşüyor. Chrome
 * zaten kuruluysa o hatayı kullanıcıya göstermenin anlamı yok.
 */
async function launchBrowser() {
  try {
    return await chromium.launch();
  } catch (error) {
    if (!/Executable doesn't exist|Failed to launch/i.test(String(error.message))) throw error;
    try {
      const browser = await chromium.launch({ channel: "chrome" });
      console.error("(playwright'ın Chromium'u yok, sistemdeki Chrome kullanılıyor)");
      return browser;
    } catch {
      console.error(
        "\nNe playwright'ın Chromium'u ne de sistemde Chrome bulundu. Biri gerekiyor:\n\n" +
          "    npx playwright install chromium\n",
      );
      process.exit(1);
    }
  }
}

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

const browser = await launchBrowser();
const page = await browser.newPage({ deviceScaleFactor: scale });
await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);

// Font yüklenmezse tarayıcı sessizce sistem fontuna düşüyor: görsel çıkıyor,
// "hata" yok, ama tipografi ve satır sonları benim ölçtüğüm yerde değil. Bu tam
// olarak macOS'ta bir kez başımıza geldi, o yüzden artık denetleniyor.
const fontProblems = await page.evaluate(() => {
  const bad = [];
  for (const face of document.fonts) {
    if (face.status === "error") bad.push(`${face.family} ${face.weight}: yüklenemedi`);
  }
  // Beyan edilmiş bir aile hiç yüklenmemişse ya kullanılmıyor ya da yolu yanlış;
  // ikisi de bilinmeye değer.
  const declared = new Set([...document.fonts].map((f) => f.family));
  for (const family of declared) {
    const faces = [...document.fonts].filter((f) => f.family === family);
    if (faces.every((f) => f.status === "unloaded")) {
      bad.push(`${family}: beyan edilmiş ama hiç kullanılmamış`);
    }
  }
  return bad;
});

if (fontProblems.length) {
  console.error(`UYARI — font sorunu:\n  ${fontProblems.join("\n  ")}\n`);
}

// Eksik görsel de sessiz düşüyor: portre yuvası boş çerçeveye dönüyor, render
// başarılı görünüyor ve kart yer tutucuyla paylaşılabiliyor. Fontla aynı sınıf.
const missingImages = await page.evaluate(() =>
  [...document.images]
    .filter((img) => !img.complete || img.naturalWidth === 0)
    .map((img) => img.getAttribute("src")),
);

if (missingImages.length) {
  console.error(
    `UYARI — ${missingImages.length} görsel yüklenmedi, yerine yer tutucu çizildi:\n` +
      missingImages.map((src) => `  ${src}`).join("\n") +
      "\n",
  );
}

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
