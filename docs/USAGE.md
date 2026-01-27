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

## Data Flow
1. `monitor_engine.js` fetches signals and writes `data.json`.
2. `update_dashboard.js` renders the latest data in the browser.
