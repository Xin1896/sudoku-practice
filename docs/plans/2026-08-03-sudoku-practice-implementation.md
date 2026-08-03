# 数独练习站 Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 构建并发布一个免登录、移动端优先、可离线使用的中文数独练习 PWA。

**Architecture:** 使用纯静态 HTML/CSS/JavaScript，数独引擎与 DOM 解耦；题库随站点打包，状态保存在 localStorage，Service Worker 提供离线能力。`npm run build` 产出可直接交给 Cloudflare Pages 的 `dist/` 目录。

**Tech Stack:** HTML5、CSS、JavaScript ES Modules、Node.js 内置测试、Service Worker、Web App Manifest、Cloudflare Pages、GitHub。

---

### Task 1: 建立可测试的静态项目与数独规则引擎

**Files:**
- Create: `site/js/sudoku.js`
- Create: `tests/sudoku.test.mjs`
- Modify: `package.json`
- Create: `scripts/build.mjs`
- Delete: Vinext/Next.js starter files after the static build path is working

**Step 1: Write the failing tests**

为盘面解析、同行/同列/同宫冲突、候选数切换、普通输入、撤销快照、完成判定和唯一解计数分别写最小测试。

```js
test("同一行的重复数字会被标记为冲突", () => {
  const board = Array(81).fill(0);
  board[0] = board[4] = 7;
  assert.deepEqual([...findConflicts(board)].sort(), [0, 4]);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/sudoku.test.mjs`

Expected: FAIL because `site/js/sudoku.js` does not exist or required exports are missing.

**Step 3: Write minimal implementation**

实现 `parseGrid`、`findConflicts`、`getCandidates`、`setValue`、`toggleNote`、`isSolved`、`countSolutions` 与不可变历史快照。

**Step 4: Run tests to verify they pass**

Run: `node --test tests/sudoku.test.mjs`

Expected: all engine tests PASS.

**Step 5: Add static build**

将 `package.json` 精简为 Node 22 静态项目；`scripts/build.mjs` 清理 `dist/` 后复制 `site/`，并拒绝缺少核心文件的构建。

**Step 6: Commit**

Commit: `build static sudoku engine`

### Task 2: 内置题库与持久化状态

**Files:**
- Create: `site/js/puzzles.js`
- Create: `site/js/storage.js`
- Create: `tests/puzzles.test.mjs`
- Create: `tests/storage.test.mjs`

**Step 1: Write failing tests**

验证每题为 81 个字符、给定数字与解答一致、解答有效、谜题唯一解；验证保存数据版本、损坏数据回退和恢复当前局。

**Step 2: Verify RED**

Run: `node --test tests/puzzles.test.mjs tests/storage.test.mjs`

Expected: FAIL because puzzle and storage modules are absent.

**Step 3: Implement**

随包内置三档题目，提供按难度和已完成 ID 选择下一题的方法；localStorage 数据包含题目 ID、盘面、候选、历史、开始时间、累计用时、错误和提示次数。

**Step 4: Verify GREEN**

Run: `node --test tests/puzzles.test.mjs tests/storage.test.mjs`

Expected: all tests PASS and every puzzle has exactly one solution.

**Step 5: Commit**

Commit: `add offline puzzle bank and progress storage`

### Task 3: 构建完整触屏与键盘界面

**Files:**
- Create: `site/index.html`
- Create: `site/styles.css`
- Create: `site/js/app.js`
- Create: `tests/static-contract.test.mjs`

**Step 1: Write failing contract tests**

验证页面包含 81 个可聚焦网格单元、数字键 1–9、候选/擦除/撤销/提示按钮、难度切换、计时与 `aria-live` 状态区；验证没有外部脚本、样式、字体或 API URL。

**Step 2: Verify RED**

Run: `node --test tests/static-contract.test.mjs`

Expected: FAIL because the product page is absent.

**Step 3: Implement UI**

实现响应式九宫格、选择与关联高亮、输入、候选、撤销、提示、完成面板、自动保存、计时器、方向键和快捷键。触控目标至少 44px，320px 宽无横向滚动，支持 `prefers-reduced-motion`。

**Step 4: Verify GREEN**

Run: `node --test tests/static-contract.test.mjs`

Expected: contract tests PASS.

**Step 5: Commit**

Commit: `build mobile sudoku practice interface`

### Task 4: PWA、离线资源与 Cloudflare Pages 配置

**Files:**
- Create: `site/manifest.webmanifest`
- Create: `site/sw.js`
- Create: `site/_headers`
- Create: `site/404.html`
- Create: `site/icon-192.png`
- Create: `site/icon-512.png`
- Create: `site/og.png`
- Create: `wrangler.jsonc`
- Modify: `site/index.html`
- Extend: `tests/static-contract.test.mjs`

**Step 1: Write failing tests**

验证 Manifest、图标、Service Worker 预缓存清单、离线导航回退、安全响应头和 Pages 输出目录配置。

**Step 2: Verify RED**

Run: `node --test tests/static-contract.test.mjs`

Expected: FAIL on missing PWA assets/configuration.

**Step 3: Implement PWA and deployment files**

Service Worker 只缓存同源 GET；导航网络优先并回退首页，静态资源缓存优先并后台刷新。`wrangler.jsonc` 使用 `pages_build_output_dir: "./dist"`，不声明函数或数据库。

**Step 4: Verify GREEN and build**

Run: `npm test && npm run build`

Expected: tests PASS and `dist/` contains all required assets.

**Step 5: Commit**

Commit: `add offline pwa and pages configuration`

### Task 5: 浏览器验收、GitHub 与 Cloudflare 发布

**Files:**
- Modify only if validation finds defects

**Step 1: Functional browser verification**

验证新游戏、输入、候选、撤销、提示、刷新恢复、完成判定、键盘导航、320px 和桌面布局；关闭网络后刷新并完成一次关键交互。

**Step 2: Production verification**

Run: `npm test && npm run build`

Expected: zero failures and exit code 0.

**Step 3: Publish source**

创建公开 GitHub 仓库 `sudoku-practice`，推送生产分支；检查仓库中不存在凭据、构建缓存或外部依赖。

**Step 4: Publish Pages**

在已认证的 Cloudflare 账号创建 Pages 项目并发布 `dist/`。若账号未授权，停在登录步骤并提供唯一必要操作。

**Step 5: Mainland reachability check**

绑定用户提供的自定义域名后，从大陆多运营商检测 DNS、TLS、HTML、CSS、JS、题库、Service Worker 和图标；明确区分“本次实测可访问”与“Cloudflare 提供大陆 SLA”。
