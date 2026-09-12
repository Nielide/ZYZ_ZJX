# QQQM Portfolio

一个移动端优先的 QQQM 持仓记录页，采用黑底、深灰胶囊和荧光黄绿色数字的视觉设计。

- `data/data.json` 是静态数据真源，保存 QQQM 持仓、价值、每日收益和历史回撤。
- `scripts/update-data.mjs` 使用 Finnhub 获取 QQQM 与回撤标的行情，使用 Frankfurter 获取 USD/CNY 参考汇率。
- `.github/workflows/update-data.yml` 在工作日定时运行，按上海日期更新一条历史快照并提交回仓库。
- `.github/workflows/deploy-pages.yml` 在 `main` 分支更新后自动部署 GitHub Pages。

## GitHub 设置

1. 将项目推送到 `main` 分支。
2. 在仓库 `Settings → Secrets and variables → Actions` 中新增 `FINNHUB_API_KEY`，值为你的 Finnhub Key。
3. 在仓库 `Settings → Pages` 中选择 `GitHub Actions` 作为构建来源。
4. 手动运行一次 `Update QQQM market data`，确认 `data/data.json` 能被更新。

网页打开时会读取工作流写入的 `data/data.json`，并刷新 USD/CNY 汇率；任一接口失败时仍保留最近一次 JSON 快照。Finnhub Key 只在 GitHub Actions Secret 中使用，不写入公开网页。

## Cloudflare Pages 设置

为了避免访客直接访问 GitHub Pages，可以将同一仓库连接到 Cloudflare Pages：

1. 选择仓库 `Nielide/ZYZ_ZJX`，生产分支使用 `main`。
2. Framework preset 选择 `None`，Build command 留空。
3. Build output directory 填写 `dist`。
4. 首次部署完成后，在 Pages 项目的 `Custom domains` 中绑定自己的完整域名或子域名。

每日工作流会同时更新 `data/data.json` 和 `dist/data/data.json`，因此 GitHub Pages 与 Cloudflare Pages 会使用同一份最新数据。

当前自定义域名部署使用 Cloudflare Workers Static Assets。`qqqm.hedh8899.top` 由 Worker 在服务端读取 GitHub `main` 分支的最新 `index.html`、数据和字体资源，边缘缓存按分钟更新；GitHub 暂时不可用时自动回退到最近一次随 Worker 部署的 `dist` 副本。访客浏览器无需直接连接 GitHub。

因此，修改网页后只需提交并推送到 GitHub `main` 分支，通常 1–3 分钟内即可在自定义域名生效。只有修改 `src/worker.js` 或 `wrangler.jsonc` 时，才需要重新执行一次 Cloudflare Worker 部署。

## 数据说明

当前项目初始 JSON 中的历史值是界面演示快照。Actions 会在工作日自动写入真实行情历史；网页端每 5 分钟重新读取数据并刷新价格与汇率，下拉页面超过阈值会触发同样的刷新动画。
