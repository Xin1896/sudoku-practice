import { access, cp, rm } from "node:fs/promises";

const projectRoot = new URL("../", import.meta.url);
const sourceRoot = new URL("site/", projectRoot);
const outputRoot = new URL("dist/", projectRoot);
const requiredFiles = [
  "404.html",
  "_headers",
  "chess/index.html",
  "games.css",
  "go/index.html",
  "home.css",
  "icon-192.png",
  "icon-512.png",
  "index.html",
  "js/ai-worker.js",
  "js/app.js",
  "js/chess-app.js",
  "js/chess.js",
  "js/game-kit.js",
  "js/go-app.js",
  "js/go.js",
  "js/home.js",
  "js/puzzles.js",
  "js/pwa.js",
  "js/storage.js",
  "js/sudoku.js",
  "js/xiangqi-app.js",
  "js/xiangqi.js",
  "manifest.webmanifest",
  "og-home.png",
  "og.png",
  "styles.css",
  "sudoku/index.html",
  "sw.js",
  "xiangqi/index.html",
];

await rm(outputRoot, { recursive: true, force: true });
await cp(sourceRoot, outputRoot, { recursive: true });

for (const file of requiredFiles) {
  try {
    await access(new URL(file, outputRoot));
  } catch {
    throw new Error(`构建缺少核心文件：dist/${file}`);
  }
}

console.log(`静态站点已构建：dist/（${requiredFiles.length} 个核心文件已验证）`);
