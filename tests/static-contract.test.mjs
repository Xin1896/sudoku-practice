import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function readSource(path) {
  try {
    return await readFile(new URL(path, projectRoot), "utf8");
  } catch {
    return "";
  }
}

const [html, css, app] = await Promise.all([
  readSource("site/index.html"),
  readSource("site/styles.css"),
  readSource("site/js/app.js"),
]);

test("页面声明中文产品标题和可缩放的移动端视口", () => {
  assert.match(html, /<html[^>]+lang=["']zh-CN["']/i);
  assert.match(html, /<title>[^<]*数独[^<]*<\/title>/i);
  assert.match(
    html,
    /<meta[^>]+name=["']viewport["'][^>]+content=["'][^"']*width=device-width[^"']*initial-scale=1[^"']*["']/i,
  );
  assert.doesNotMatch(html, /user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i);
});

test("页面提供数独网格、三档难度和一局练习所需的主要控件", () => {
  assert.match(html, /id=["']sudoku-grid["'][^>]+role=["']grid["']/i);

  for (const difficulty of ["easy", "medium", "hard"]) {
    assert.match(html, new RegExp(`data-difficulty=["']${difficulty}["']`, "i"));
  }

  for (const action of [
    "continue",
    "new-game",
    "restart",
    "note",
    "erase",
    "undo",
    "hint",
  ]) {
    assert.match(html, new RegExp(`data-action=["']${action}["']`, "i"));
  }

  for (let number = 1; number <= 9; number += 1) {
    assert.match(html, new RegExp(`data-number=["']${number}["']`, "i"));
  }

  assert.match(html, /id=["']timer["']/i);
  assert.match(html, /id=["']mistake-count["']/i);
  assert.match(html, /id=["']hint-count["']/i);
  assert.match(html, /id=["']completion-panel["']/i);
  assert.match(html, /aria-live=["']polite["']/i);
});

test("产品脚本以模块加载并动态建立 81 个可聚焦网格按钮", () => {
  assert.match(
    html,
    /<script[^>]+type=["']module["'][^>]+src=["']\.\/js\/app\.js["']/i,
  );
  assert.match(html, /<link[^>]+href=["']\.\/styles\.css["'][^>]*>/i);

  assert.match(app, /Array\.from\(\{\s*length:\s*81\s*\}/);
  assert.match(app, /createElement\(["']button["']\)/);
  assert.match(app, /setAttribute\(["']role["'],\s*["']gridcell["']\)/);
  assert.match(app, /tabIndex\s*=/);

  for (const moduleName of ["sudoku", "puzzles", "storage"]) {
    assert.match(app, new RegExp(`from ["']\\.\\/${moduleName}\\.js["']`));
  }
});

test("样式满足触控、安全区、窄屏与减少动态效果约束", () => {
  assert.match(css, /min-(?:height|block-size)\s*:\s*(?:4[4-9]|[5-9]\d)px/i);
  assert.match(css, /min-(?:width|inline-size)\s*:\s*(?:4[4-9]|[5-9]\d)px/i);
  assert.match(css, /env\(safe-area-inset-(?:top|bottom|left|right)\)/i);
  assert.match(css, /overflow-x\s*:\s*hidden/i);
  assert.match(css, /@media\s*\([^)]*min-width\s*:/i);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/i);
});

test("核心页面不引用外部资源，也不包含运行时网络请求", () => {
  const productSource = `${html}\n${css}\n${app}`;

  assert.doesNotMatch(productSource, /https?:\/\//i);
  assert.doesNotMatch(
    app,
    /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon\s*\(/i,
  );
});
