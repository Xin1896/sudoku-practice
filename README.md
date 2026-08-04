# 数独一刻

一个免登录、纯静态、离线优先的中文数独练习网站。题库、字体与界面资源全部随网站打包，进度仅保存在用户自己的浏览器中。

## 功能

- 入门、进阶、挑战三档难度，内置经唯一解与解法分级验证的题库。
- 候选数、擦除、撤销、冲突提示、有限提示和完成统计。
- 自动保存当前棋盘、候选数、用时和已完成题目。
- 键盘操作、屏幕阅读器结构、320px 窄屏与减少动效支持。
- 首次成功访问后可离线打开并继续练习。

## 本地验证

需要 Node.js 22 或更高版本。

```bash
npm test
npm run build
```

网站源码位于 `site/`，构建产物输出到 `dist/`。项目运行时不依赖服务器、第三方 CDN 或外部 API。

## Vercel

连接这个 GitHub 仓库时使用以下设置：

- Framework preset：`Other`
- Production branch：`main`
- Build command：`npm run build`
- Output directory：`dist`
- Node.js：`22.x`

`vercel.json` 已包含构建目录、PWA 更新策略和安全响应头。项目同时保留 Cloudflare Pages 配置，便于以后做备用静态部署。

## 中国大陆可达性

站点不引用 Google Fonts、境外 CDN 或第三方 API，可尽量减少首屏的跨境依赖。但 Vercel 在中国大陆没有服务器或 CDN 节点，也不提供中国大陆可用性 SLA；正式发布后应绑定自定义域名，并进行移动、联通、电信三网实测。
