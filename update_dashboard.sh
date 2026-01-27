#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATE=$(date +"%Y-%m-%d")

node "$SCRIPT_DIR/monitor_engine.js"
echo "Dashboard updated for $DATE"
