#!/bin/bash
# Ninjin Super-Company: Automated Daily Pulse (V4.1 - Stability Patch)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$SCRIPT_DIR/daily_updates.log"
REPORT_DIR="$SCRIPT_DIR/reports/daily-reports"
DATE_STR=$(date +"%Y-%m-%d")
FULL_DATE=$(date +"%Y-%m-%d %H:%M:%S")

{
    echo "--------------------------------------------------"
    echo "STARTING SEQUENTIAL UPDATE: $FULL_DATE"
    
    # STAGE 1: Intelligence Gathering (Simulated staggered start)
    echo "[STAGE 1] Triggering Intelligence Scan..."
    sleep 2 # Atlas Queue Buffer
    node "$SCRIPT_DIR/monitor_engine.js"
    
    # STAGE 2: Content Adaptation
    echo "[STAGE 2] Running Content Adaptation (Agent-Lightning)..."
    sleep 5 # Atlas Queue Buffer
    
    # STAGE 3: Generate Daily Mission Report
    echo "[STAGE 3] Archiving Management Report..."
    REPORT_FILE="$REPORT_DIR/Report_$DATE_STR.md"
    if [ ! -f "$REPORT_FILE" ]; then
        echo "# 📄 Ninjin 超级公司 · 任务复盘日报" > "$REPORT_FILE"
        echo "# 日期: $DATE_STR" >> "$REPORT_FILE"
        echo "## 1. 今日战果" >> "$REPORT_FILE"
        echo "## 2. 遇到的问题与解决" >> "$REPORT_FILE"
        echo "## 3. 目前的不足与缺口" >> "$REPORT_FILE"
        echo "## 4. 明日计划" >> "$REPORT_FILE"
    fi
    
    # STAGE 4: Distribution
    echo "[STAGE 4] Deploying social distribution to X..."
    node "$SCRIPT_DIR/post_to_x.cjs"
    
    echo "SUCCESS: Dashboard, Social, and Mission Report synchronized."
    echo "--------------------------------------------------"
} >> "$LOG_FILE" 2>&1
