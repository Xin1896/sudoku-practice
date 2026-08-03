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

function relativeLuminance(hex) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground, background) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

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

test("产品脚本以九个 ARIA 行建立 81 个可聚焦网格按钮", () => {
  assert.match(
    html,
    /<script[^>]+type=["']module["'][^>]+src=["']\.\/js\/app\.js["']/i,
  );
  assert.match(html, /<link[^>]+href=["']\.\/styles\.css["'][^>]*>/i);

  assert.match(app, /Array\.from\(\{\s*length:\s*81\s*\}/);
  assert.match(app, /Array\.from\(\{\s*length:\s*9\s*\}/);
  assert.match(app, /createElement\(["']button["']\)/);
  assert.match(app, /createElement\(["']div["']\)/);
  assert.match(app, /setAttribute\(["']role["'],\s*["']row["']\)/);
  assert.match(app, /setAttribute\(["']role["'],\s*["']gridcell["']\)/);
  assert.match(app, /row\.append\(\.\.\.cellButtons\.slice\(/);
  assert.doesNotMatch(app, /grid\.append\(\.\.\.cellButtons\)/);
  assert.match(app, /tabIndex\s*=/);

  for (const moduleName of ["sudoku", "puzzles", "storage"]) {
    assert.match(app, new RegExp(`from ["']\\.\\/${moduleName}\\.js["']`));
  }
});

test("擦除动作委托规则引擎清理当前格", () => {
  assert.match(
    app,
    /function eraseSelected\(\)[\s\S]*?game\s*=\s*setValue\(game,\s*index,\s*0\)/,
  );
});

test("难度单选使用 roving tabindex 并响应方向键", () => {
  assert.match(html, /data-difficulty=["']easy["'][^>]*tabindex=["']0["']/i);
  assert.equal((html.match(/data-difficulty=["'](?:medium|hard)["'][^>]*tabindex=["']-1["']/gi) ?? []).length, 2);
  assert.match(app, /function handleDifficultyKeydown\(/);
  for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]) {
    assert.match(app, new RegExp(`case ["']${key}["']`));
  }
  assert.match(app, /button\.tabIndex\s*=\s*isSelected\s*\?\s*0\s*:\s*-1/);
});

test("品牌链接的可访问名称来自可见文字", () => {
  const brandTag = html.match(/<a\b[^>]*class=["']brand["'][^>]*>/i)?.[0] ?? "";
  assert.notEqual(brandTag, "");
  assert.doesNotMatch(brandTag, /aria-label=/i);
});

test("辅助文字颜色在所有浅色纸面上保持舒适对比度", () => {
  const muted = css.match(/--muted\s*:\s*(#[0-9a-f]{6})/i)?.[1];
  assert.ok(muted, "必须声明 --muted 颜色");

  for (const background of [
    "#f4efe4",
    "#e9dfce",
    "#fbf8f1",
    "#e7e2d6",
    "#faf7ef",
    "#ded5c5",
    "#d8cebd",
    "#eee3cd",
    "#f4ddd5",
  ]) {
    assert.ok(
      contrastRatio(muted, background) >= 4.8,
      `${muted} 在 ${background} 上的对比度必须至少为 4.8:1`,
    );
  }
});

test("样式满足触控、安全区、窄屏与减少动态效果约束", () => {
  const cellRule = css.match(/\.sudoku-cell\s*\{(?<body>[^}]*)\}/i)?.groups?.body ?? "";
  const boardRule = css.match(/#sudoku-grid\s*\{(?<body>[^}]*)\}/i)?.groups?.body ?? "";
  const viewportRule = css.match(/\.board-frame\s*\{(?<body>[^}]*)\}/i)?.groups?.body ?? "";

  assert.match(cellRule, /min-(?:width|inline-size)\s*:\s*32px/i);
  assert.match(cellRule, /min-(?:height|block-size)\s*:\s*32px/i);
  assert.match(boardRule, /min-width\s*:\s*0/i);
  assert.match(viewportRule, /overflow-x\s*:\s*(?:clip|hidden)/i);
  assert.doesNotMatch(viewportRule, /overflow-x\s*:\s*(?:auto|scroll)/i);
  assert.doesNotMatch(html, /左右滑动|横向滚动/);

  for (const selector of [
    "difficulty-picker button",
    "paper-button",
    "number-pad button",
    "tool-row button",
  ]) {
    const rule = css.match(
      new RegExp(`\\.${selector.replaceAll(" ", "\\s+")}\\s*\\{(?<body>[^}]*)\\}`, "i"),
    )?.groups?.body ?? "";
    assert.match(rule, /min-width\s*:\s*44px/i, `${selector} 宽度必须至少 44px`);
    assert.match(
      rule,
      /min-height\s*:\s*(?:4[4-9]|[5-9]\d)px/i,
      `${selector} 高度必须至少 44px`,
    );
  }

  assert.match(css, /@media\s*\(max-width:\s*360px\)/i);
  assert.match(css, /padding-inline\s*:\s*0/i);
  assert.match(css, /\.practice-layout\s*\{[^}]*padding-inline\s*:\s*4px/is);
  assert.match(css, /env\(safe-area-inset-(?:top|bottom|left|right)\)/i);
  assert.match(css, /overflow-x\s*:\s*hidden/i);
  assert.match(css, /@media\s*\([^)]*min-width\s*:/i);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/i);
});

test("完成面板使用原生模态对话框并覆盖完整开关生命周期", () => {
  assert.match(html, /<dialog\b[^>]*id=["']completion-panel["'][^>]*>/i);
  assert.doesNotMatch(html, /<dialog\b[^>]*id=["']completion-panel["'][^>]*\bhidden\b/i);
  assert.match(app, /completionPanel\.showModal\(\)/);
  assert.match(app, /completionPanel\.close\(\)/);
  assert.doesNotMatch(app, /completionPanel\.hidden\s*=/);
  assert.match(
    app,
    /completionPanel\.addEventListener\(["']cancel["'],[\s\S]*?preventDefault\(\)/,
  );

  const closeLifecycleCalls = app.match(/closeCompletionPanel\(\)/g) ?? [];
  assert.ok(closeLifecycleCalls.length >= 4, "新局、恢复、重开与同难度流程都应关闭模态框");
});

test("核心页面不引用外部资源，也不包含运行时网络请求", () => {
  const productSource = `${html}\n${css}\n${app}`;

  assert.doesNotMatch(productSource, /https?:\/\//i);
  assert.doesNotMatch(
    app,
    /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon\s*\(/i,
  );
});
