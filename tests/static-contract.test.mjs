import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

async function readBinary(path) {
  try {
    return await readFile(new URL(path, projectRoot));
  } catch {
    return Buffer.alloc(0);
  }
}

function parseJson(source) {
  return JSON.parse(source || "{}");
}

function pngDimensions(buffer, label) {
  assert.ok(buffer.length >= 24, `${label} 必须是完整的 PNG 文件`);
  assert.deepEqual(
    [...buffer.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    `${label} 必须包含 PNG 文件签名`,
  );
  assert.equal(buffer.toString("ascii", 12, 16), "IHDR", `${label} 必须包含 IHDR`);

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

const [
  html,
  css,
  app,
  manifestSource,
  serviceWorker,
  headers,
  notFound,
  wranglerSource,
  nodeVersion,
  buildScript,
  icon192,
  icon512,
  socialCard,
  implementationPlan,
  designPlan,
] = await Promise.all([
  readSource("site/index.html"),
  readSource("site/styles.css"),
  readSource("site/js/app.js"),
  readSource("site/manifest.webmanifest"),
  readSource("site/sw.js"),
  readSource("site/_headers"),
  readSource("site/404.html"),
  readSource("wrangler.jsonc"),
  readSource(".node-version"),
  readSource("scripts/build.mjs"),
  readBinary("site/icon-192.png"),
  readBinary("site/icon-512.png"),
  readBinary("site/og.png"),
  readSource("docs/plans/2026-08-03-sudoku-practice-implementation.md"),
  readSource("docs/plans/2026-08-03-sudoku-practice-design.md"),
]);

const manifest = parseJson(manifestSource);
const wrangler = parseJson(wranglerSource);

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

test("产品品牌、安装入口与分享元数据统一为数独一刻", () => {
  assert.match(html, /<title>数独一刻｜安静的纸上练习<\/title>/i);
  assert.match(
    html,
    /<meta[^>]+name=["']description["'][^>]+content=["'][^"']*数独一刻[^"']*["']/i,
  );
  assert.match(html, /class=["']brand__seal["'][^>]*>数独<\/span>/i);
  assert.match(html, /class=["']brand__name["'][^>]*>数独一刻<\/span>/i);
  assert.doesNotMatch(html, /方寸数独/);

  assert.match(
    html,
    /<link[^>]+rel=["']manifest["'][^>]+href=["']\.\/manifest\.webmanifest["']/i,
  );
  assert.match(
    html,
    /<link[^>]+rel=["']icon["'][^>]+sizes=["']192x192["'][^>]+href=["']\.\/icon-192\.png["']/i,
  );
  assert.match(
    html,
    /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']\.\/icon-192\.png["']/i,
  );
  assert.match(html, /name=["']apple-mobile-web-app-title["'][^>]+content=["']数独一刻["']/i);

  for (const [property, value] of [
    ["og:type", "website"],
    ["og:locale", "zh_CN"],
    ["og:title", "数独一刻"],
    ["og:image", "./og.png"],
    ["og:image:width", "1731"],
    ["og:image:height", "909"],
  ]) {
    assert.match(
      html,
      new RegExp(
        `<meta[^>]+property=["']${property.replaceAll(":", "\\:")}["'][^>]+content=["']${value.replaceAll(".", "\\.")}["']`,
        "i",
      ),
    );
  }

  for (const [name, value] of [
    ["twitter:card", "summary_large_image"],
    ["twitter:title", "数独一刻"],
    ["twitter:image", "./og.png"],
  ]) {
    assert.match(
      html,
      new RegExp(
        `<meta[^>]+name=["']${name.replaceAll(":", "\\:")}["'][^>]+content=["']${value.replaceAll(".", "\\.")}["']`,
        "i",
      ),
    );
  }

  assert.doesNotMatch(html, /rel=["']canonical["']/i);
  assert.doesNotMatch(html, /(?:og:url|https?:\/\/)/i);
});

test("Web App Manifest 描述可独立安装的中文应用", () => {
  assert.equal(manifest.id, "/");
  assert.equal(manifest.name, "数独一刻");
  assert.equal(manifest.short_name, "数独一刻");
  assert.equal(manifest.lang, "zh-CN");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.background_color, "#f2ecdf");
  assert.equal(manifest.theme_color, "#f2ecdf");
  assert.match(manifest.description ?? "", /数独/);
  assert.deepEqual(manifest.icons, [
    {
      src: "./icon-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "./icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
  ]);
});

test("安装图标尺寸正确且批准的图片资源保持原样", () => {
  assert.deepEqual(pngDimensions(icon192, "192 图标"), { width: 192, height: 192 });
  assert.deepEqual(pngDimensions(icon512, "512 图标"), { width: 512, height: 512 });
  assert.deepEqual(pngDimensions(socialCard, "分享图"), { width: 1731, height: 909 });

  assert.equal(
    sha256(icon192),
    "fbd1037eae18e39c43a649c37eefcf675e812ace9ab40c5f87e9a096a21d5db0",
  );
  assert.equal(
    sha256(icon512),
    "921d5246654ae8e5e1e690a2e719409f34c46553fc0f773a616bb33c8d31397a",
  );
  assert.equal(
    sha256(socialCard),
    "23da83e6b6c2b67ba8509c89a082db05e50c6c9ac875db982f2777ed95ba7d7e",
  );
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

test("Service Worker 以固定白名单预缓存完整且轻量的应用外壳", () => {
  assert.match(serviceWorker, /const CACHE_PREFIX\s*=\s*["']sudoku-practice-/);
  assert.match(serviceWorker, /const CACHE_NAME\s*=/);
  assert.match(serviceWorker, /const SHELL_PATHS\s*=\s*Object\.freeze\(\s*\[/);

  const expectedShellPaths = [
    "./index.html",
    "./404.html",
    "./styles.css",
    "./js/app.js",
    "./js/puzzles.js",
    "./js/storage.js",
    "./js/sudoku.js",
    "./manifest.webmanifest",
    "./icon-192.png",
  ];

  const shellBlock =
    serviceWorker.match(/const SHELL_PATHS\s*=\s*Object\.freeze\(\s*\[[\s\S]*?\]\s*\)/)?.[0] ??
    "";
  const actualShellPaths = [...shellBlock.matchAll(/["'](\.\/[^"']+)["']/g)].map(
    (match) => match[1],
  );

  assert.deepEqual(actualShellPaths, expectedShellPaths);
  assert.doesNotMatch(shellBlock, /(?:og|icon-512)\.png/);
  assert.match(serviceWorker, /const SHELL_URLS\s*=\s*new Set\(/);
});

test("Service Worker 只在完整预缓存后切换版本并清理旧应用壳", () => {
  for (const eventName of ["install", "activate", "fetch"]) {
    assert.match(
      serviceWorker,
      new RegExp(`self\\.addEventListener\\(["']${eventName}["']`),
    );
  }

  assert.match(serviceWorker, /cache\.addAll\(SHELL_PATHS\)/);
  assert.doesNotMatch(serviceWorker, /skipWaiting\s*\(/);
  assert.match(serviceWorker, /self\.clients\.claim\(\)/);
  assert.match(serviceWorker, /caches\.keys\(\)/);
  assert.match(serviceWorker, /cacheName\.startsWith\(CACHE_PREFIX\)/);
  assert.match(serviceWorker, /cacheName\s*!==\s*CACHE_NAME/);
  assert.match(serviceWorker, /caches\.delete\(cacheName\)/);
  assert.match(serviceWorker, /request\.method\s*!==\s*["']GET["']/);
  assert.match(serviceWorker, /url\.origin\s*!==\s*self\.location\.origin/);
});

test("根入口和版本耦合资源只读当前应用壳，避免跨版本混用", () => {
  assert.match(serviceWorker, /const APP_ROOT_URL\s*=/);
  assert.match(serviceWorker, /const INDEX_URL\s*=/);
  assert.match(serviceWorker, /const NOT_FOUND_URL\s*=/);
  assert.match(serviceWorker, /function isEntryNavigation\(/);
  assert.match(serviceWorker, /function serveCachedShell\(/);
  assert.match(serviceWorker, /request\.mode\s*===\s*["']navigate["']/);
  assert.match(
    serviceWorker,
    /isEntryNavigation\(url\)[\s\S]*?serveCachedShell\(INDEX_URL\)/,
  );
  assert.match(serviceWorker, /SHELL_URLS\.has\(url\.href\)/);
  assert.match(serviceWorker, /serveCachedShell\(url\.href\)/);
  assert.doesNotMatch(serviceWorker, /cache\.put\(|staleWhileRevalidate|ignoreSearch/);
});

test("非入口导航保留在线 404，离线回退本版本 404 且不缓存任意请求", () => {
  assert.match(serviceWorker, /function networkFirstNonEntryNavigation\(/);
  assert.match(serviceWorker, /networkFirstNonEntryNavigation[\s\S]*?await fetch\(request\)/);
  assert.match(
    serviceWorker,
    /networkFirstNonEntryNavigation[\s\S]*?catch[\s\S]*?serveCachedShell\(NOT_FOUND_URL\)/,
  );
  assert.match(
    serviceWorker,
    /request\.mode\s*===\s*["']navigate["'][\s\S]*?networkFirstNonEntryNavigation\(request\)/,
  );
  assert.doesNotMatch(serviceWorker, /caches\.match\(request|cache\.match\(request/);
  assert.doesNotMatch(serviceWorker, /url\.search\s*=|searchParams|ignoreSearch/);
});

test("应用在页面加载后注册同目录 Service Worker 并允许离线功能静默降级", () => {
  assert.match(app, /["']serviceWorker["']\s+in\s+navigator/);
  assert.match(app, /window\.addEventListener\(\s*["']load["']/);
  assert.match(
    app,
    /navigator\.serviceWorker\s*\.\s*register\(["']\.\/sw\.js["'],\s*\{[\s\S]*?scope:\s*["']\.\/["'][\s\S]*?updateViaCache:\s*["']none["'][\s\S]*?\}\)/,
  );
  assert.match(
    app,
    /navigator\.serviceWorker\s*\.\s*register[\s\S]*?\.catch\(\(\)\s*=>\s*\{\}\)/,
  );
});

test("Cloudflare Pages 静态响应采用严格安全头且 Service Worker 不被缓存", () => {
  assert.match(headers, /^\/\*\s*$/m);
  assert.match(headers, /X-Frame-Options:\s*DENY/i);
  assert.match(headers, /X-Content-Type-Options:\s*nosniff/i);
  assert.match(headers, /Referrer-Policy:\s*no-referrer/i);
  assert.match(
    headers,
    /Permissions-Policy:\s*camera=\(\),\s*microphone=\(\),\s*geolocation=\(\),\s*payment=\(\),\s*usb=\(\)/i,
  );

  for (const directive of [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "manifest-src 'self'",
    "worker-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ]) {
    assert.match(headers, new RegExp(directive.replaceAll("'", "[\"']"), "i"));
  }

  assert.match(headers, /^\/sw\.js\s*$/m);
  assert.match(headers, /Cache-Control:\s*no-cache,\s*no-store,\s*must-revalidate/i);
  assert.doesNotMatch(headers, /immutable/i);
});

test("自定义 404 是无外链的中文页面并提供根路径返回入口", () => {
  assert.match(notFound, /<html[^>]+lang=["']zh-CN["']/i);
  assert.match(notFound, /<title>[^<]*未找到[^<]*<\/title>/i);
  assert.match(notFound, /<h1[^>]*>[^<]*未找到[^<]*<\/h1>/i);
  assert.match(notFound, /<link[^>]+href=["']\/styles\.css["']/i);
  assert.match(notFound, /<a[^>]+href=["']\/["'][^>]*>[^<]*返回[^<]*<\/a>/i);
  assert.doesNotMatch(notFound, /<script|https?:\/\//i);
});

test("Cloudflare Pages 与 Node 构建配置保持纯静态", () => {
  assert.deepEqual(Object.keys(wrangler).sort(), [
    "compatibility_date",
    "name",
    "pages_build_output_dir",
  ]);
  assert.equal(wrangler.name, "sudoku-practice");
  assert.equal(wrangler.pages_build_output_dir, "./dist");
  assert.equal(wrangler.compatibility_date, "2026-08-03");
  assert.equal(nodeVersion.trim(), "22.16.0");

  for (const asset of [
    "404.html",
    "_headers",
    "icon-192.png",
    "icon-512.png",
    "index.html",
    "js/app.js",
    "js/puzzles.js",
    "js/storage.js",
    "js/sudoku.js",
    "manifest.webmanifest",
    "og.png",
    "styles.css",
    "sw.js",
  ]) {
    assert.match(buildScript, new RegExp(`["']${asset.replaceAll(".", "\\.")}["']`));
  }
});

test("实施文档记录原子应用壳与真实域名确定后的元数据步骤", () => {
  const task4 =
    implementationPlan.match(/### Task 4:[\s\S]*?(?=### Task 5:)/)?.[0] ?? "";
  assert.match(task4, /原子/);
  assert.match(task4, /固定白名单/);
  assert.match(task4, /完整预缓存/);
  assert.doesNotMatch(task4, /导航网络优先|后台刷新|stale-while-revalidate/i);
  assert.match(designPlan, /版本化原子应用壳/);

  const task6 = implementationPlan.match(/### Task 6:[\s\S]*$/)?.[0] ?? "";
  assert.match(task6, /真实自定义域名/);
  for (const metadata of ["canonical", "og:url", "绝对 OG", "Twitter"]) {
    assert.match(task6, new RegExp(metadata, "i"));
  }
  assert.match(task6, /域名[^。\n]*确定后/);
});

test("核心页面不引用外部资源，也不包含运行时网络请求", () => {
  const productSource = `${html}\n${css}\n${app}`;

  assert.doesNotMatch(productSource, /https?:\/\//i);
  assert.doesNotMatch(
    app,
    /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon\s*\(/i,
  );
});
