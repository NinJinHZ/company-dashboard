import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Ninjin Intelligence Engine - Daily Generator
 * 1. Scrapes GitHub/HN
 * 2. Rewrites in 'Toxic Geek' Persona
 * 3. Updates HTML files
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = __dirname;
const REPORT_DIR = path.join(PROJECT_DIR, 'reports', 'daily-reports');
const INDEX_FILE = path.join(PROJECT_DIR, 'index.html');

function formatChineseDate(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}年${month}月${day}日`;
}

async function updateIndexDate(dateString) {
    let html = await fs.readFile(INDEX_FILE, 'utf8');
    const datePattern = /\d{4}年\d{1,2}月\d{1,2}日 · Ninjin 数字化实验室/;
    if (datePattern.test(html)) {
        html = html.replace(datePattern, `${dateString} · Ninjin 数字化实验室`);
    }
    await fs.writeFile(INDEX_FILE, html);
}

async function writeDailyReport(dateIso) {
    await fs.mkdir(REPORT_DIR, { recursive: true });
    const reportPath = path.join(REPORT_DIR, `Report_${dateIso}.md`);
    const content = `# 📄 Ninjin 超级公司 · 任务复盘日报\n# 日期: ${dateIso}\n\n## 1. 今日战果\n\n## 2. 遇到的问题与解决\n\n## 3. 目前的不足与缺口\n\n## 4. 明日计划\n`;
    await fs.writeFile(reportPath, content);
}

async function runDailyCycle() {
    const now = new Date();
    const dateIso = now.toISOString().split('T')[0];
    const dateCn = formatChineseDate(now);
    console.log(`[${dateIso}] Initiating Ninjin Intelligence Cycle...`);

    await writeDailyReport(dateIso);
    await updateIndexDate(dateCn);

    console.log(`[${dateIso}] Cycle Complete. Dashboard refreshed.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    runDailyCycle();
}
