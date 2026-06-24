# 股市情报速览 · App Store 上架指南

本文档列出从代码到上架 App Store 并开通订阅的全部步骤。代码层面的工作已完成，以下是**需要你本人操作**的部分（涉及账号登录、付费配置）。

### 代码侧已就绪（无需再写代码）
- App 全部页面与逻辑（自选 / 搜索 / 分析 / 付费墙 / 设置）
- RevenueCat 订阅集成，含无 key 时的 mock 降级（`src/lib/purchases.ts`）
- 后端多源行情 API + `/api/health`（`server.js`、`render.yaml`）
- 隐私清单 `ios/PrivacyInfo.xcprivacy`
- 隐私政策页 `public/privacy.html`、使用条款页 `public/terms.html`（随后端部署到 `/privacy`、`/terms`）
- EAS 构建 / 提交配置 `eas.json`

### 待你本人填入（涉及账号，无法代填）
| 位置 | 字段 | 来源 |
| --- | --- | --- |
| `mobile/app.json` → `extra.apiBaseUrl` | 公网后端地址 | 第 1 步 Render 部署后得到 |
| `mobile/app.json` → `extra.revenueCatApiKey` | RevenueCat Public iOS Key | 第 2 步 RevenueCat 后台 |
| `mobile/app.json` → `extra.eas.projectId` | EAS 项目 ID | `eas init` 后得到 |
| `mobile/eas.json` → `submit.production.ios` | appleId / ascAppId / appleTeamId | 第 3、4 步 Apple 后台 |

---

## 0. 前置条件

- [x] React Native (Expo SDK 56) App 已完成
- [x] 多源数据后端已就绪
- [x] RevenueCat 订阅 SDK 已集成（免费/Pro 门控）
- [x] 隐私清单 `ios/PrivacyInfo.xcprivacy` 已生成
- [x] 隐私政策与使用条款页面已生成（`public/privacy.html`、`public/terms.html`，随后端一同部署）
- [x] EAS 配置 `eas.json` 已生成

你需要准备：
- Apple Developer 账号（$99/年）：https://developer.apple.com
- App Store Connect 账号
- RevenueCat 账号（免费档够用）：https://app.revenuecat.com
- 一个能公网访问的后端地址（部署 Render/Railway，见下文）

---

## 1. 部署后端 API

后端代码在 `~/stock-analyzer/server.js`，必须部署到公网，App 才能取数据。

### Render 部署（推荐，仓库已含 render.yaml）

1. 把 `~/stock-analyzer` 推到 GitHub 私有仓库
2. 在 https://render.com 新建 Web Service，选该仓库
3. 配置：
   - Build Command: 留空（无构建步骤）
   - Start Command: `node server.js`
   - 环境变量：`PORT=4173`
4. 部署后获得地址，如 `https://stock-analyzer-xxxx.onrender.com`

### 验证
```bash
curl https://你的地址/api/health
# 应返回 {"ok":true,"service":"stock-analyzer","version":"1.1.0",...}
```

### 把地址填回 App
编辑 `mobile/app.json`：
```json
"extra": {
  "apiBaseUrl": "https://stock-analyzer-xxxx.onrender.com"
}
```

---

## 2. 配置 RevenueCat 订阅

1. 在 https://app.revenuecat.com 新建项目，选 iOS
2. 填入 Apple Bundle ID：`com.silkchen.stockanalyzer`
3. 在 **Project Settings → API Keys** 拿到 **Public iOS API Key**（`appl_xxxxxxxx`）
4. 在 **Product** 页面创建 3 个产品（对应 App Store Connect 的订阅产品，见第 4 步）：
   - `stock_pro_monthly`（月度）
   - `stock_pro_yearly`（年度）
   - `stock_pro_lifetime`（终身/非订阅消耗型，单独建）
5. 在 **Entitlements** 创建 entitlement：`pro`，把上面 3 个产品都关联上
6. 在 **Offerings** 创建默认 offering，把产品放入对应 package

### 把 API Key 填回 App
编辑 `mobile/app.json`：
```json
"extra": {
  "revenueCatApiKey": "appl_xxxxxxxx"
}
```

> 未填 key 时 App 会以 mock 模式运行（点订阅直接解锁，仅用于开发调试）。

---

## 3. Apple Developer 配置

1. 登录 https://developer.apple.com → Certificates, Identifiers & Profiles
2. **Identifiers → App IDs** 新建：
   - Bundle ID: `com.silkchen.stockanalyzer`（Explicit）
   - Capabilities 勾选：**In-App Purchase**
3. 记下你的 **Apple Team ID**（右上角 Membership 页）

---

## 4. App Store Connect 配置订阅产品

登录 https://appstoreconnect.apple.com：

1. **我的 App → 新建 App**
   - 名称：股市情报速览
   - 主语言：简体中文
   - Bundle ID：选 `com.silkchen.stockanalyzer`
   - SKU：`stockanalyzer2026`
2. 进入 App → **订阅**：
   - 创建订阅组：`Pro 会员`
   - 在组内创建订阅产品：
     | 产品 ID | 时长 | 价格 | 本地化名称 |
     | --- | --- | --- | --- |
     | `stock_pro_monthly` | 1 个月 | ¥18 | Pro 月度 |
     | `stock_pro_yearly` | 1 年 | ¥128 | Pro 年度 |
   - 每个产品填：参考名称、价格档、本地化描述、订阅时长
   - 上传订阅截图（付费墙界面截图）
3. **App 内购买项目** → 单独创建非订阅型（可选）：
   - `stock_pro_lifetime`，类型选「非消耗型」，价格 ¥298
4. 把这些产品 ID 在 RevenueCat 后台对应填好（见第 2 步）
5. **App 信息**：
   - 填隐私政策 URL：`https://stock-analyzer-xxxx.onrender.com/privacy`（页面已随第 1 步后端部署，文件为 `public/privacy.html`，无需另建 GitHub Pages）
   - 填「使用条款」URL：`https://stock-analyzer-xxxx.onrender.com/terms`（文件为 `public/terms.html`；亦可改用 Apple 标准 EULA：https://apple.com/legal/internet-services/itunes/dev/stdeula）
   - 上面的域名换成你在第 1 步拿到的真实 Render 地址；先用 `curl https://你的地址/privacy` 确认返回 HTML 200。

---

## 5. 用 EAS 构建 IPA

```bash
cd ~/stock-analyzer/mobile

# 首次：登录 Expo 账号并关联项目
eas login
eas build:configure   # 生成 eas.json（已预置，可跳过）
eas init              # 关联 EAS 项目，拿到 projectId 填回 app.json extra.eas.projectId

# 构建 App Store 版本（生产签名）
eas build --platform ios --profile production

# 构建完成后，提交到 App Store Connect
eas submit --platform ios --profile production
```

`eas submit` 会要求填：
- `appleId`：你的 Apple ID 邮箱
- `ascAppId`：App Store Connect 里的 App 数字 ID
- `appleTeamId`：Apple Team ID

这些也写进了 `eas.json` 的 `submit.production.ios`，填好后免交互提交。

---

## 6. 审核材料

在 App Store Connect 录入：

- **截图**：6.7" iPhone（必须）+ 5.5" / 6.5"（可选）。App 已是深色金融风，建议截：自选页、搜索结果、分析页（走势图+结论+周期卡片）、付费墙
- **App 预览视频**（可选，30s 内）
- **描述**：见下方模板
- **关键词**：股票,行情,股市,技术分析,A股,港股,美股,交易计划,选股
- **审核备注**（重要）：
  > 本 App 数据来自公开行情接口，仅供学习研究。请用测试股票如 600519（贵州茅台）审核。订阅为 Pro 高级功能解锁，付费墙内可查看完整价格。测试账号无需登录，直接搜索即可使用免费功能。

### App 描述模板
```
股市情报速览——盘前盘后快速复盘的多周期股票分析工具。

【核心能力】
· A股、港股、美股代码/名称一键检索
· 日/周/月多周期趋势、支撑位、压力位、量能分析
· 综合交易计划：买入区间、卖出区间、止损提示
· 财务摘要：营收、净利润、毛利率、ROE、PE
· K线走势图与价格区间可视化

【Pro 会员】
升级解锁多周期深度分析、完整交易计划、财务详情与无广告体验。

数据来自公开行情接口，可能存在延迟。本应用不构成投资建议。
```

---

## 7. 常见审核风险与对策

| 风险 | 对策 |
| --- | --- |
| 数据来源合规质疑 | 备注说明"公开行情接口"，避免宣称实时行情；如被拒可考虑接 Tushare 等授权源 |
| 订阅价值不足 | 确保免费版有足够基础功能，Pro 提供真实增量价值 |
| 隐私清单缺失 | 已生成 PrivacyInfo.xcprivacy |
| 无隐私政策 | 已生成 `public/privacy.html`，随后端部署到 `https://你的地址/privacy`，无需另建 GitHub Pages |
| 诱导付费 | 付费墙措辞中性，提供"恢复购买"，已做 |

---

## 8. 本地开发与调试

```bash
# 启动后端
cd ~/stock-analyzer && PORT=4173 node server.js

# 启动 App（模拟器）
cd ~/stock-analyzer/mobile && npx expo run:ios

# 真机调试需先 eas build --profile development
```
