import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const siteRoot = new URL("../site/", import.meta.url);
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const GAME_PAGES = Object.freeze([
  { path: "sudoku/index.html", title: "数独", script: "/js/app.js" },
  { path: "xiangqi/index.html", title: "象棋", script: "/js/xiangqi-app.js" },
  { path: "chess/index.html", title: "国际象棋", script: "/js/chess-app.js" },
  { path: "go/index.html", title: "围棋", script: "/js/go-app.js" },
]);

async function read(path) {
  return readFile(new URL(path, siteRoot), "utf8");
}

async function listFiles(directory = "") {
  const entries = await readdir(new URL(directory, siteRoot), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = `${directory}${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...(await listFiles(`${path}/`)));
    } else {
      files.push(path);
    }
  }
  return files;
}

const files = await listFiles();
const htmlFiles = files.filter((file) => file.endsWith(".html"));
const codeFiles = files.filter((file) => /\.(?:css|js|html)$/.test(file));
const sources = new Map(
  await Promise.all(codeFiles.map(async (file) => [file, await read(file)])),
);
const home = sources.get("index.html");
const serviceWorker = sources.get("sw.js");
const buildScript = await readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8");

test("首页提供数独与三种棋类入口，并沿用纸本册页品牌", () => {
  assert.match(home, /<title>一刻游艺｜[^<]+<\/title>/);
  assert.match(home, /<h1[^>]*id=["']hero-title["']/);
  for (const href of ["/sudoku/", "/xiangqi/", "/chess/", "/go/"]) {
    assert.match(home, new RegExp(`<a[^>]+class=["']leaf[^"']*["'][^>]+href=["']${href}["']`));
  }
  for (const name of ["数独", "象棋", "国际象棋", "围棋"]) {
    assert.match(home, new RegExp(`class=["']leaf__title["']>${name}<`));
  }
  assert.match(home, /<link[^>]+href=["']\.\/styles\.css["']/);
  assert.match(home, /<link[^>]+href=["']\.\/home\.css["']/);
  assert.match(home, /<script[^>]+type=["']module["'][^>]+src=["']\.\/js\/home\.js["']/);
});

test("首页分享图是 1200×630 的一刻游艺卷首", async () => {
  const card = await readFile(new URL("og-home.png", siteRoot));
  assert.deepEqual([...card.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.deepEqual([card.readUInt32BE(16), card.readUInt32BE(20)], [1200, 630]);
  for (const [attribute, value] of [
    ['property="og:image"', "./og-home.png"],
    ['property="og:image:width"', "1200"],
    ['property="og:image:height"', "630"],
    ['name="twitter:image"', "./og-home.png"],
  ]) {
    assert.ok(home.includes(`<meta ${attribute} content="${value}" />`), `首页缺少 ${attribute}`);
  }
  assert.ok(buildScript.includes('"og-home.png"'));
  assert.doesNotMatch(serviceWorker, /og-home\.png/);
});

test("每个子页面都能一步回到首页", () => {
  for (const { path, title, script } of GAME_PAGES) {
    const page = sources.get(path);
    assert.ok(page, `${path} 必须存在`);
    assert.match(page, /<html[^>]+lang=["']zh-CN["']/);
    assert.match(page, new RegExp(`<title>[^<]*${title}[^<]*</title>`));
    assert.match(
      page,
      /<a class="home-link" href="\/">[\s\S]*?返回首页[\s\S]*?<\/a>/,
      `${path} 顶部需要“返回首页”`,
    );
    assert.match(page, /<a class="footer-link" href="\/">[^<]*首页[^<]*<\/a>/);
    assert.match(page, /<link[^>]+href=["']\/styles\.css["']/);
    assert.match(page, new RegExp(`<script[^>]+type=["']module["'][^>]+src=["']${script}["']`));
    assert.match(page, /<meta[^>]+name=["']viewport["'][^>]+width=device-width/);
  }
});

test("棋类与数独页面以棋盘为舞台：设置与规则收进浮层，操作集中在侧栏", () => {
  for (const { path } of GAME_PAGES.slice(1)) {
    const page = sources.get(path);
    assert.match(page, /<header class="game-bar">/, `${path} 需要精简顶栏`);
    assert.match(page, /<section class="stage"[^>]*>[\s\S]*?class="board-frame board-frame--game"/);
    assert.match(page, /data-open="settings-panel"/);
    assert.match(page, /data-open="rules-panel"/);
    assert.match(page, /<dialog class="sheet" id="settings-panel"[\s\S]*?data-setting="opponent"[\s\S]*?<\/dialog>/);
    assert.match(page, /<dialog class="sheet sheet--rules" id="rules-panel"/);
    assert.match(page, /<div class="action-bar" role="toolbar"/);
    assert.equal((page.match(/<h1\b/g) ?? []).length, 1, `${path} 只能有一个 h1`);
  }

  const sudoku = sources.get("sudoku/index.html");
  assert.match(sudoku, /<main class="game-room practice-layout">\s*<header class="game-bar">/);
  assert.match(sudoku, /<section class="stage"[^>]*>[\s\S]*?id="sudoku-grid"/);
  assert.match(sudoku, /<link rel="stylesheet" href="\/games\.css" \/>/);
  assert.match(sources.get("js/app.js"), /bindSheets\(\)/);

  const styles = sources.get("games.css");
  assert.match(styles, /container:\s*stage\s*\/\s*size/, "横屏时舞台按可用高度计算棋盘");
  assert.match(styles, /width:\s*min\(100cqw,\s*var\(--frame-fit\)\)/);
  assert.match(styles, /@media \(min-width: 700px\) and \(min-aspect-ratio: 1\/1\)/);
  assert.match(sources.get("js/game-kit.js"), /export function bindSheets\(/);
});

test("所有页面遵守严格 CSP：没有内联脚本、内联样式和内联事件", () => {
  for (const file of htmlFiles) {
    const page = sources.get(file);
    assert.doesNotMatch(page, /<style\b/i, `${file} 不能有 <style>`);
    assert.doesNotMatch(page, /\sstyle\s*=/i, `${file} 不能有 style 属性`);
    assert.doesNotMatch(page, /\son[a-z]+\s*=/i, `${file} 不能有内联事件`);
    for (const script of page.match(/<script\b[^>]*>/gi) ?? []) {
      assert.match(script, /\ssrc=/i, `${file} 的脚本必须是外链文件`);
    }
  }

  for (const [file, source] of sources) {
    if (file.endsWith(".js")) {
      assert.doesNotMatch(source, /setAttribute\(\s*["']style["']/, `${file} 不能写 style 属性`);
      assert.doesNotMatch(source, /\binnerHTML\b|\beval\s*\(|new Function\(/, `${file} 不能注入代码`);
    }
  }
});

test("站点不引用任何外部资源，也不发起运行时网络请求", () => {
  for (const [file, source] of sources) {
    const withoutNamespace = source.replaceAll(SVG_NAMESPACE, "");
    assert.doesNotMatch(withoutNamespace, /https?:\/\//i, `${file} 含有外部地址`);
    if (file.endsWith(".js") && file !== "sw.js") {
      assert.doesNotMatch(
        source,
        /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon\s*\(/,
        `${file} 不应在运行时联网`,
      );
    }
  }
});

test("每个页面脚本的模块依赖都随站点打包", () => {
  for (const [file, source] of sources) {
    if (!file.startsWith("js/")) {
      continue;
    }
    for (const [, specifier] of source.matchAll(/(?:import|from)\s*["'](\.\/[^"']+)["']/g)) {
      assert.ok(files.includes(`js/${specifier.slice(2)}`), `${file} 引用了不存在的 ${specifier}`);
    }
  }

  assert.match(sources.get("js/game-kit.js"), /new Worker\(["']\/js\/ai-worker\.js["']/);
  for (const engine of ["xiangqi", "chess", "go"]) {
    assert.match(sources.get("js/ai-worker.js"), new RegExp(`from ["']\\./${engine}\\.js["']`));
  }
});

test("离线应用壳覆盖全部页面、样式与脚本，构建清单同步", () => {
  const shellBlock =
    serviceWorker.match(/const SHELL_PATHS\s*=\s*Object\.freeze\(\s*\[[\s\S]*?\]\s*\)/)?.[0] ?? "";
  const shellPaths = new Set(
    [...shellBlock.matchAll(/["']\.\/([^"']+)["']/g)].map((match) => match[1]),
  );

  for (const file of files) {
    if (/\.(?:html|css|js)$/.test(file) && file !== "sw.js") {
      assert.ok(shellPaths.has(file), `离线应用壳缺少 ${file}`);
      assert.match(buildScript, new RegExp(`["']${file.replaceAll(".", "\\.")}["']`), `构建清单缺少 ${file}`);
    }
  }
});

test("首页的“未完”印章读取各游戏真实的存档键", () => {
  const homeScript = sources.get("js/home.js");
  for (const [game, file] of [
    ["xiangqi", "js/xiangqi-app.js"],
    ["chess", "js/chess-app.js"],
    ["go", "js/go-app.js"],
  ]) {
    const key = sources.get(file).match(/const SAVE_KEY = "([^"]+)"/)?.[1];
    assert.ok(key, `${file} 必须声明 SAVE_KEY`);
    assert.match(homeScript, new RegExp(`${game}: "${key.replaceAll(".", "\\.")}"`));
  }
  assert.match(homeScript, /sudoku: "sudoku-practice:v1"/);
  assert.match(sources.get("js/storage.js"), /sudoku-practice:v\$\{STORAGE_VERSION\}/);
});

test("新增控件满足 44px 触控尺寸", () => {
  const styles = `${sources.get("styles.css")}\n${sources.get("games.css")}`;
  for (const selector of ["\\.home-link", "\\.choice-row button", "\\.promotion-choices button"]) {
    const rule = styles.match(new RegExp(`${selector}\\s*\\{(?<body>[^}]*)\\}`))?.groups?.body ?? "";
    assert.match(rule, /min-width\s*:\s*44px/, `${selector} 宽度至少 44px`);
    assert.match(rule, /min-height\s*:\s*(?:4[4-9]|[5-9]\d)px/, `${selector} 高度至少 44px`);
  }
});

test("动效尊重减少动态效果偏好", () => {
  assert.match(sources.get("home.css"), /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(sources.get("js/game-kit.js"), /prefers-reduced-motion: reduce/);
});
