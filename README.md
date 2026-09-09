# QQQM Portfolio

一个移动端优先的 QQQM 持仓看板，参考 AssetHub 的数据流设计：

- `data/data.json` 是静态数据真源，网页启动时读取并绘制持仓、收益、净值曲线和回撤。
- `scripts/update-data.mjs` 使用 Finnhub 获取 QQQM 与回撤标的行情，使用 Frankfurter 获取 USD/CNY 参考汇率。
- `.github/workflows/update-data.yml` 在工作日定时运行，按上海日期更新一条历史快照并提交回仓库。
- `.github/workflows/deploy-pages.yml` 在 `main` 分支更新后自动部署 GitHub Pages。

## GitHub 设置

1. 创建一个 GitHub repository，并将本项目推送到 `main` 分支。
2. 在仓库 `Settings → Secrets and variables → Actions` 增加 `FINNHUB_API_KEY`。
3. 在 `Settings → Pages` 中选择 `GitHub Actions` 作为构建来源。
4. 手动运行一次 `Update QQQM market data`，确认 `data/data.json` 能被更新。

网页可以直接打开；如果同目录存在 `data/data.json`，页面会优先读取线上 JSON，加载失败时才使用内置演示数据。

## 数据说明

当前项目初始 JSON 中的历史值是界面演示快照。接入 Finnhub secret 后，Actions 才会开始写入真实行情历史。网页端每 5 分钟重新读取数据并刷新汇率；下拉页面超过阈值会触发同样的刷新动画。
