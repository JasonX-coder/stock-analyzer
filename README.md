# Stock Analyzer

一个本地和云端均可运行的股票走势分析工具，支持输入 A 股、港股、美股代码或名称，查看行情走势、交易计划和公司财务摘要。

## 功能

- 股票代码或名称检索
- 当日、当周、当月多周期技术分析
- 支撑位、压力位、止损和止盈区间
- 公司财务摘要与营收、利润趋势
- Canvas 走势 chart

## 本地运行

```bash
npm start
```

默认访问地址：

```text
http://127.0.0.1:4173
```

指定端口：

```bash
PORT=4177 npm start
```

## 部署说明

这是一个 Node.js 服务，前端会调用 `/api/analyze` 获取实时行情和财务数据。因此它不能只用 GitHub Pages 完整运行，需要部署到支持 Node.js 的平台，例如 Render、Railway、Vercel Serverless 或 Fly.io。

推荐启动命令：

```bash
npm start
```

平台需要提供 `PORT` 环境变量；服务默认监听 `0.0.0.0`，适合云端运行。
