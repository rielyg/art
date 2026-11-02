// Render the mosaic page in headless Chromium and save PNGs.
// Usage: node scripts/render.mjs [--demo] [--size 2000] [--out site/images]
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const size = +val("--size", 2000);
const outDir = val("--out", "site/images");
const siteDir = path.resolve("site");

// Minimal static server so fetch("data/papers.json") works
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const p = path.join(siteDir, decodeURIComponent(new URL(req.url, "http://x").pathname));
  fs.readFile(p.endsWith("/") ? p + "index.html" : p, (err, buf) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": types[path.extname(p)] || "application/octet-stream" });
    res.end(buf);
  });
}).listen(0);
const port = server.address().port;

const data = JSON.parse(fs.readFileSync(path.join(siteDir, "data/papers.json"), "utf8"));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: size, height: size } });
const query = `render=1&size=${size}` + (flag("--demo") ? "&demo=1" : "");
await page.goto(`http://localhost:${port}/index.html?${query}`);
await page.waitForFunction(() => window.__mosaicDone === true, null, { timeout: 120000 });

fs.mkdirSync(outDir, { recursive: true });
const name = flag("--demo") ? `demo-${data.snapshot_date}.png` : `${data.snapshot_date}.png`;
await page.locator("#c").screenshot({ path: path.join(outDir, name) });
if (!flag("--demo")) {
  fs.copyFileSync(path.join(outDir, name), path.join(outDir, "latest.png"));
  const idxPath = path.join(outDir, "index.json");
  const idx = fs.existsSync(idxPath) ? JSON.parse(fs.readFileSync(idxPath, "utf8")) : [];
  if (!idx.includes(data.snapshot_date)) idx.push(data.snapshot_date);
  fs.writeFileSync(idxPath, JSON.stringify(idx.sort()));
}
console.log("wrote", path.join(outDir, name));

await browser.close();
server.close();
