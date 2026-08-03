import { access, cp, rm } from "node:fs/promises";

const projectRoot = new URL("../", import.meta.url);
const sourceRoot = new URL("site/", projectRoot);
const outputRoot = new URL("dist/", projectRoot);
const requiredFiles = ["index.html", "js/sudoku.js"];

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
