#!/usr/bin/env node
// Grava uma página HTML animada como MP4, quadro a quadro.
//
// Uso: node render.mjs <pagina.html> <saida.mp4> [--fps 30] [--scale 1]
//                       [--audio musica.mp3 --audio-start 38.34]
//
// A página precisa expor:
//   window.__video = { duration, width, height }   (segundos, pixels)
//   window.__seek(t)                               desenha o quadro do instante t
//   window.__ready (opcional)                      Promise aguardada antes de gravar
// e não deve animar sozinha quando a URL tiver ?render.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  // Playwright instalado globalmente (caso do container da nuvem)
  const { execSync } = await import("node:child_process");
  const globalRoot = execSync("npm root -g").toString().trim();
  ({ chromium } = require(path.join(globalRoot, "playwright")));
}

const args = process.argv.slice(2);
const optStr = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? def : args.splice(i, 2)[1];
};
const opt = (name, def) => Number(optStr(name, def));
const fps = opt("fps", 30);
const scale = opt("scale", 1);
const audio = optStr("audio", null);
const audioStart = opt("audio-start", 0);
const [input, output] = args;
if (!input || !output) {
  console.error("Uso: node render.mjs <pagina.html> <saida.mp4> [--fps 30] [--scale 1]");
  process.exit(1);
}

const url = /^https?:/.test(input) ? input : pathToFileURL(path.resolve(input)).href;
const browser = await chromium.launch();
const probe = await browser.newPage();
await probe.goto(url + (url.includes("?") ? "&" : "?") + "render");
const meta = await probe.evaluate(() => window.__video);
await probe.close();
if (!meta) throw new Error("A página não define window.__video / window.__seek");

const width = Math.round(meta.width * scale);
const height = Math.round(meta.height * scale);
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: 1,
});
await page.goto(url + (url.includes("?") ? "&" : "?") + "render");
await page.evaluate(() => window.__ready);
// Página ocupa a viewport inteira, sem margem
await page.addStyleTag({
  content: "html,body{margin:0!important;overflow:hidden!important} canvas{width:100vw!important;height:100vh!important;max-width:none!important}",
});

// Trilha opcional: recorta a partir de --audio-start e some no último segundo
const audioArgs = audio
  ? ["-ss", String(audioStart), "-i", audio, "-map", "0:v", "-map", "1:a",
     "-af", `afade=t=out:st=${Math.max(0, meta.duration - 1)}:d=1`, "-c:a", "aac", "-b:a", "192k",
     "-t", String(meta.duration)]
  : [];
const ffmpeg = spawn("ffmpeg", [
  "-y", "-loglevel", "error",
  "-f", "image2pipe", "-framerate", String(fps), "-i", "-",
  ...audioArgs,
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium",
  "-movflags", "+faststart", output,
], { stdio: ["pipe", "inherit", "inherit"] });

const total = Math.round(meta.duration * fps);
for (let f = 0; f < total; f++) {
  await page.evaluate((t) => window.__seek(t), f / fps);
  const png = await page.screenshot({ type: "png" });
  if (!ffmpeg.stdin.write(png)) await new Promise((r) => ffmpeg.stdin.once("drain", r));
  if (f % fps === 0) process.stdout.write(`\r${Math.round((f / total) * 100)}%`);
}
ffmpeg.stdin.end();
await new Promise((r, j) => ffmpeg.on("close", (c) => (c === 0 ? r() : j(new Error(`ffmpeg saiu com ${c}`)))));
await browser.close();
console.log(`\rPronto: ${output} (${total} quadros, ${width}x${height} @ ${fps}fps)`);
