# Company Dashboard Usage

## Daily Update (Manual)
```bash
cd /Users/dongyi/Desktop/我的开发/company-dashboard
node monitor_engine.js
```

## Optional Sources
Set environment variables for social sources:
```bash
export X_BEARER_TOKEN="your_x_bearer_token"
export XHS_API_ENDPOINT="https://your-xhs-endpoint?q={q}"
export XHS_API_TOKEN="your_xhs_token"
```

## Daily Update (9:00 AM)
```bash
crontab -e
```
Add:
```bash
0 9 * * * /Users/dongyi/.nvm/versions/node/v24.13.0/bin/node /Users/dongyi/Desktop/我的开发/company-dashboard/monitor_engine.js >> /Users/dongyi/Desktop/我的开发/company-dashboard/daily_updates.log 2>&1
```

## Local Preview
```bash
npx serve .
```

## Deepdive Build (Markdown → HTML)
Deepdive 源文件放在 `deepdive/posts-md/`，运行脚本会生成：
- `deepdive/posts/<slug>.html`
- `deepdive/index.html`
- （可选）更新首页的 “Deepdive 精选” 模块

```bash
npm install
npm run build:deepdive
```

## Data Flow
1. `monitor_engine.js` fetches signals and writes `data.json`.
2. `update_dashboard.js` renders the latest data in the browser.
