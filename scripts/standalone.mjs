import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
let html = await readFile(resolve(dist, "index.html"), "utf8");
const js = html.match(/<script[^>]+src="([^"]+)"[^>]*><\/script>/);
const css = html.match(/<link[^>]+href="([^"]+\.css)"[^>]*>/);
if (!js || !css) throw Error("Expected one bundled JS entry and stylesheet");

const code = (await readFile(resolve(dist, js[1]), "utf8")).replace(/<\/script/gi, "<\\/script");
const styles = (await readFile(resolve(dist, css[1]), "utf8")).replace(/<\/style/gi, "<\\/style");
html = html
  .replace(js[0], () => "")
  .replace(css[0], () => `<style>${styles}</style>`)
  .replace(
    /<\/body>\s*<\/html>\s*$/,
    () => `<script type="module">${code}</script></body>\n</html>`,
  );
html = html.split("\n").map((line) => line.trimEnd()).join("\n");
await writeFile(resolve(root, "lastshot.html"), html);
console.log(`Standalone game: ${resolve(root, "lastshot.html")}`);
