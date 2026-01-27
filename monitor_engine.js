import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Parser from 'rss-parser';
import { TwitterApi } from 'twitter-api-v2';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCES_FILE = path.join(__dirname, 'monitor_sources.json');
const DATA_FILE = path.join(__dirname, 'data.json');
const REPORT_DIR = path.join(__dirname, 'reports', 'daily-reports');

const parser = new Parser();

function toDateString(input) {
    const date = input ? new Date(input) : new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
}

function toIsoDate(input) {
    const date = input ? new Date(input) : new Date();
    return date.toISOString().split('T')[0];
}

function toChineseDate(input) {
    const date = input ? new Date(input) : new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}年${month}月${day}日`;
}

async function readSources() {
    const raw = await fs.readFile(SOURCES_FILE, 'utf8');
    return JSON.parse(raw);
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`Request failed ${response.status} ${url}`);
    }
    return response.json();
}

async function fetchGitHub(source) {
    const query = encodeURIComponent(source.query);
    const limit = source.limit || 5;
    const url = `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=${limit}`;
    const headers = {
        'Accept': 'application/vnd.github+json'
    };
    if (process.env.GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    const data = await fetchJson(url, { headers });
    return data.items.map(item => ({
        id: item.full_name,
        title: item.name,
        summary: item.description || 'No description provided.',
        date: toDateString(item.pushed_at),
        link: item.html_url,
        source: 'GitHub'
    }));
}

async function fetchHackerNews(source) {
    const limit = source.limit || 6;
    const ids = await fetchJson('https://hacker-news.firebaseio.com/v0/topstories.json');
    const top = ids.slice(0, limit);
    const items = await Promise.all(top.map(async id => fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)));
    return items.map(item => ({
        id: `hn-${item.id}`,
        title: item.title,
        summary: item.text ? item.text.replace(/<[^>]*>/g, '').slice(0, 140) : 'Discussion trending on Hacker News.',
        date: toDateString(item.time * 1000),
        link: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
        source: 'Hacker News'
    }));
}

async function fetchReddit(source) {
    const feeds = source.feeds || [];
    const headers = {
        'User-Agent': 'ninjin-monitor/1.0'
    };
    const results = await Promise.all(feeds.map(async feed => {
        const data = await fetchJson(feed, { headers });
        return (data.data?.children || []).map(item => ({
            id: `reddit-${item.data.id}`,
            title: item.data.title,
            summary: item.data.selftext?.slice(0, 140) || 'Trending discussion in Reddit AI communities.',
            date: toDateString(item.data.created_utc * 1000),
            link: `https://www.reddit.com${item.data.permalink}`,
            source: 'Reddit'
        }));
    }));
    return results.flat();
}

async function fetchRss(source) {
    const feeds = source.feeds || [];
    const results = await Promise.all(feeds.map(async feedUrl => {
        const feed = await parser.parseURL(feedUrl);
        return (feed.items || []).slice(0, 3).map(item => ({
            id: item.guid || item.link,
            title: item.title || 'Untitled',
            summary: item.contentSnippet || 'No summary available.',
            date: toDateString(item.pubDate),
            link: item.link || feedUrl,
            source: feed.title || 'RSS'
        }));
    }));
    return results.flat();
}

async function fetchX(source) {
    if (!process.env.X_BEARER_TOKEN) return [];
    const client = new TwitterApi(process.env.X_BEARER_TOKEN);
    const queries = source.queries || [];
    const limit = source.limit || 5;
    const results = [];

    for (const query of queries) {
        const response = await client.v2.search(query, { max_results: Math.min(10, limit) });
        const tweets = response.data?.data || [];
        for (const tweet of tweets) {
            results.push({
                id: `x-${tweet.id}`,
                title: query,
                summary: tweet.text.slice(0, 180),
                date: toDateString(new Date()),
                link: `https://x.com/i/web/status/${tweet.id}`,
                source: 'X'
            });
            if (results.length >= limit) break;
        }
        if (results.length >= limit) break;
    }

    return results;
}

async function fetchXiaohongshu(source) {
    const endpoint = process.env.XHS_API_ENDPOINT;
    if (!endpoint) return [];
    const keywords = source.keywords || [];
    const limit = source.limit || 5;
    const headers = {};
    if (process.env.XHS_API_TOKEN) {
        headers.Authorization = `Bearer ${process.env.XHS_API_TOKEN}`;
    }

    const results = [];
    for (const keyword of keywords) {
        const url = endpoint.includes('{q}') ? endpoint.replace('{q}', encodeURIComponent(keyword)) : endpoint;
        const data = await fetchJson(url, { headers });
        const items = Array.isArray(data) ? data : (data.items || data.data || data.notes || []);
        for (const item of items) {
            const title = item.title || item.note_title || item.name || keyword;
            const summary = item.desc || item.description || item.content || '';
            const link = item.url || item.link || item.share_url || '#';
            const date = item.date || item.time || item.created_at || new Date().toISOString();
            results.push({
                id: item.id || item.note_id || `${keyword}-${results.length}`,
                title,
                summary: String(summary).slice(0, 180),
                date: toDateString(date),
                link,
                source: 'Xiaohongshu'
            });
            if (results.length >= limit) break;
        }
        if (results.length >= limit) break;
    }

    return results;
}

function buildLatestNews(items) {
    const deepDiveSources = new Set(['GitHub', 'Hacker News']);
    const sorted = items.filter(Boolean);
    const deepDives = [];
    const briefs = [];

    for (const item of sorted) {
        if (deepDives.length < 2 && deepDiveSources.has(item.source)) {
            deepDives.push(item);
        } else if (briefs.length < 6) {
            briefs.push(item);
        }
        if (deepDives.length >= 2 && briefs.length >= 6) break;
    }

    const format = (item, tag, tagClass, icon) => ({
        id: item.id,
        tag,
        tag_class: tagClass,
        date: item.date,
        title: item.title,
        summary: item.summary,
        icon,
        link: item.link
    });

    const deepFormatted = deepDives.map(item => format(item, '深度分析', 'badge-deep', '🧠'));
    const briefFormatted = briefs.map(item => format(item, '简报速览', 'badge-brief', '⚡'));
    return [...deepFormatted, ...briefFormatted].slice(0, 8);
}

function buildPodcastBlock(latestNews) {
    const deepDives = latestNews.filter(item => item.tag === '深度分析');
    const briefs = latestNews.filter(item => item.tag !== '深度分析');
    const titles = [...deepDives, ...briefs].slice(0, 5).map(item => item.title).join(' · ');
    return {
        title: '今日播客：AI 情报速递 · 15 分钟',
        summary: `深度解读 ${deepDives.length} 条，快讯 ${briefs.length} 条。重点话题：${titles}`,
        meta: `Daily Briefing · ${deepDives.length} 深度 / ${briefs.length} 快讯`,
        audio: process.env.PODCAST_AUDIO_URL || ''
    };
}

async function readExistingData() {
    try {
        const raw = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

async function writeReport(dateIso, deepDives, briefs) {
    await fs.mkdir(REPORT_DIR, { recursive: true });
    const reportPath = path.join(REPORT_DIR, `Report_${dateIso}.md`);
    const deepList = deepDives.map(item => `- ${item.title}`).join('\n');
    const briefList = briefs.map(item => `- ${item.title}`).join('\n');
    const content = `# 📄 Ninjin 超级公司 · 任务复盘日报\n# 日期: ${dateIso}\n\n## 1. 今日战果\n\n### 深度解读\n${deepList || '- 无'}\n\n### 情报速览\n${briefList || '- 无'}\n\n## 2. 遇到的问题与解决\n\n## 3. 目前的不足与缺口\n\n## 4. 明日计划\n`;
    await fs.writeFile(reportPath, content);
}

async function run() {
    const sources = await readSources();
    const dateIso = toIsoDate();
    const dateCn = toChineseDate();
    const existing = await readExistingData();

    const results = await Promise.allSettled([
        fetchGitHub(sources.github),
        fetchHackerNews(sources.hackernews),
        fetchReddit(sources.reddit),
        fetchRss(sources.rss),
        fetchX(sources.x),
        fetchXiaohongshu(sources.xiaohongshu)
    ]);

    const items = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    const latestNews = buildLatestNews(items);

    const verdicts = existing?.verdicts || [
        { status: 'up', name: 'MCP Protocol', desc: '生态爆发，已成为行业事实标准。' },
        { status: 'down', name: 'SimpleWrapper-AI', desc: 'GitHub 已 2 个月无更新，纯套壳逻辑已被市场淘汰。' }
    ];

    const data = {
        meta: {
            date: dateCn,
            author: 'Ninjin 数字化实验室'
        },
        latest_news: latestNews,
        verdicts,
        podcast: buildPodcastBlock(latestNews)
    };

    const tmpFile = `${DATA_FILE}.tmp`;
    await fs.writeFile(tmpFile, JSON.stringify(data, null, 2));
    await fs.rename(tmpFile, DATA_FILE);

    const deepDives = latestNews.filter(item => item.tag === '深度分析');
    const briefs = latestNews.filter(item => item.tag !== '深度分析');
    await writeReport(dateIso, deepDives, briefs);
    console.log(`[${dateIso}] Monitor update complete.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    run();
}
