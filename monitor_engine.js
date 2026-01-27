import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Parser from 'rss-parser';
import { TwitterApi } from 'twitter-api-v2';
import { HfInference } from '@huggingface/inference';
import { AestheticsCurator } from './curator_engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCES_FILE = path.join(__dirname, 'monitor_sources.json');
const DATA_FILE = path.join(__dirname, 'data.json');
const REPORT_DIR = path.join(__dirname, 'reports', 'daily-reports');
const ARCHIVE_DIR = path.join(__dirname, 'archives');
const CRAWLER_DATA_FILE = path.resolve(__dirname, '..', '爬虫', 'data', 'hot_items.json');
const BLOG_SOURCE_DIR = path.resolve(__dirname, '..', 'ninjin-brain-blog', 'posts');
const BLOG_AUDIO_DIR = path.resolve(__dirname, '..', 'ninjin-brain-blog', 'podcast', 'uploads');
const BLOG_DEST_DIR = path.join(__dirname, 'brain-blog');
const BLOG_AUDIO_DEST_DIR = path.join(BLOG_DEST_DIR, 'audio');
const BLOG_MAX_ITEMS = 6;

const LLM_API_BASE = process.env.LLM_API_BASE || 'https://api.openai.com';
const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';
const LLM_BRIEF_ENABLED = process.env.LLM_BRIEF_ENABLED !== 'false';
const LLM_SKIP = process.env.LLM_SKIP !== 'false';

// Image Gen Config
const IMAGE_GEN_ENABLED = process.env.IMAGE_GEN_ENABLED === 'true';
const IMAGE_PROVIDER = process.env.IMAGE_PROVIDER || 'openai'; // 'openai' | 'hf'

// OpenAI/NVIDIA Image Config
const IMAGE_API_BASE = process.env.IMAGE_API_BASE || LLM_API_BASE;
const IMAGE_API_KEY = process.env.IMAGE_API_KEY || LLM_API_KEY;
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gpt-image-1';

// Hugging Face Image Config
const HF_TOKEN = process.env.HF_TOKEN || '';
const HF_IMAGE_MODEL = process.env.HF_IMAGE_MODEL || 'stabilityai/stable-diffusion-xl-base-1.0';

const PRIORITY_TOPICS = [
    'kills',
    'cloud code',
    'cowork',
    'cloudbo'
];

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

function normalizeText(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
        .trim();
}

function matchesPriority(text) {
    const normalized = normalizeText(text);
    return PRIORITY_TOPICS.some(topic => normalized.includes(normalizeText(topic)));
}

function safeJsonParse(text) {
    try {
        return JSON.parse(text);
    } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) return null;
        try {
            return JSON.parse(match[0]);
        } catch {
            return null;
        }
    }
}

function extractSection(md, heading) {
    const pattern = new RegExp(`${heading}\\n([\\s\\S]*?)(?:\\n##|$)`, 'm');
    const match = md.match(pattern);
    if (!match) return [];
    return match[1]
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('- '))
        .map(line => line.replace(/^-\s+/, '').trim())
        .filter(Boolean);
}

function stripHtml(text) {
    return String(text || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractFirstMatch(content, patterns) {
    for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match && match[1]) return stripHtml(match[1]);
    }
    return '';
}

async function syncBlogPosts() {
    try {
        const files = await fs.readdir(BLOG_SOURCE_DIR);
        const htmlFiles = files.filter(name => name.endsWith('.html'));
        if (!htmlFiles.length) return [];

        const stats = await Promise.all(htmlFiles.map(async (name) => {
            const filePath = path.join(BLOG_SOURCE_DIR, name);
            const stat = await fs.stat(filePath);
            return { name, filePath, mtime: stat.mtimeMs };
        }));

        const sorted = stats.sort((a, b) => b.mtime - a.mtime).slice(0, BLOG_MAX_ITEMS);
        await fs.mkdir(BLOG_DEST_DIR, { recursive: true });
        await fs.mkdir(BLOG_AUDIO_DEST_DIR, { recursive: true });

        const posts = [];
        for (const entry of sorted) {
            let html = await fs.readFile(entry.filePath, 'utf8');
            const title = extractFirstMatch(html, [
                /<h1[^>]*>([^<]+)<\/h1>/i,
                /<title>([^<]+)<\/title>/i
            ]);
            const summary = extractFirstMatch(html, [
                /<p[^>]*>([\s\S]*?)<\/p>/i
            ]) || '暂无摘要';
            const dateMatch = html.match(/on\s+(\d{4}-\d{2}-\d{2})/i);
            const dateIso = dateMatch ? dateMatch[1] : new Date(entry.mtime).toISOString().split('T')[0];
            const dateText = toDateString(dateIso);

            let audioSrc = '';
            const audioMatch = html.match(/<source\s+src="([^"]+)"/i);
            if (audioMatch && audioMatch[1]) {
                const audioName = path.basename(audioMatch[1]);
                const sourceAudioPath = path.join(BLOG_AUDIO_DIR, audioName);
                try {
                    await fs.copyFile(sourceAudioPath, path.join(BLOG_AUDIO_DEST_DIR, audioName));
                    audioSrc = `brain-blog/audio/${audioName}`;
                    html = html.replace(audioMatch[1], `audio/${audioName}`);
                } catch {
                    audioSrc = '';
                }
            }

            html = html.replace(/\.\.\/\.\.\/company-dashboard\/index\.html/g, '../index.html');

            const destPath = path.join(BLOG_DEST_DIR, entry.name);
            await fs.writeFile(destPath, html);

            posts.push({
                title: title || entry.name.replace('.html', ''),
                date: dateText,
                summary,
                link: `brain-blog/${entry.name}`,
                audio: audioSrc
            });
        }

        return posts;
    } catch {
        return [];
    }
}

async function readCrawlerHotspots() {
    try {
        const raw = await fs.readFile(CRAWLER_DATA_FILE, 'utf8');
        const payload = JSON.parse(raw);
        const items = Array.isArray(payload.items) ? payload.items : [];
        const sorted = items
            .slice()
            .sort((a, b) => (b.hotness_score || 0) - (a.hotness_score || 0));
        return sorted.slice(0, 6).map((item) => ({
            platform: item.platform || '',
            tag: item.tag || '',
            url: item.url || '',
            author: item.author || '',
            metrics: item.metrics || {},
            publish_time: item.publish_time || '',
            crawl_time: item.crawl_time || '',
            hotness_score: item.hotness_score || 0,
            is_hot: Boolean(item.is_hot)
        }));
    } catch {
        return [];
    }
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
    const queries = (source.queries && source.queries.length)
        ? source.queries
        : (source.query ? [source.query] : []);
    const limit = source.limit || 5;
    const headers = {
        'Accept': 'application/vnd.github+json'
    };
    if (process.env.GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const results = await Promise.all(queries.map(async queryText => {
        const query = encodeURIComponent(queryText);
        const url = `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=${limit}`;
        const data = await fetchJson(url, { headers });
        return data.items.map(item => ({
            id: item.full_name,
            title: item.name,
            summary: item.description || 'No description provided.',
            date: toDateString(item.pushed_at),
            link: item.html_url,
            source: 'GitHub'
        }));
    }));

    return results.flat();
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
        try {
            const feed = await parser.parseURL(feedUrl);
            return (feed.items || []).slice(0, 3).map(item => ({
                id: item.guid || item.link,
                title: item.title || 'Untitled',
                summary: item.contentSnippet || 'No summary available.',
                date: toDateString(item.pubDate),
                link: item.link || feedUrl,
                source: feed.title || 'RSS'
            }));
        } catch (error) {
            console.warn(`RSS parse failed: ${feedUrl}`, error.message || error);
            return [];
        }
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

async function buildLatestNews(items) {
    const enriched = [];
    let count = 0;
    const total = items.filter(Boolean).length;
    
    // Batch processing to avoid rate limits
    const BATCH_SIZE = 1;
    const validItems = items.filter(Boolean);
    
    for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
        const batch = validItems.slice(i, i + BATCH_SIZE);
        console.log(`Classifying batch ${i/BATCH_SIZE + 1}/${Math.ceil(validItems.length/BATCH_SIZE)}...`);
        
        for (const item of batch) {
            const result = await classifyItem(item);
            enriched.push(result);
        }
        
        // Small delay between batches
        if (i + BATCH_SIZE < validItems.length) {
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
    }

    const withScores = enriched.map(item => ({
        ...item,
        classification: item.classification || heuristicClassification(item)
    }));

    const deepCandidates = withScores
        .filter(item => item.classification.kind === 'deep')
        .sort((a, b) => b.classification.score - a.classification.score);
    const briefCandidates = withScores
        .filter(item => item.classification.kind !== 'deep')
        .sort((a, b) => b.classification.score - a.classification.score);

    const deepDives = deepCandidates.slice(0, 2);
    const briefs = briefCandidates.slice(0, 6);
    if (deepDives.length < 2) {
        const fill = briefCandidates.slice(6, 6 + (2 - deepDives.length));
        deepDives.push(...fill);
    }

    const format = (item, tag, tagClass, icon, cover) => ({
        id: item.id,
        tag,
        tag_class: tagClass,
        date: item.date,
        title: item.title,
        summary: item.summary,
        icon,
        cover,
        cover_title: item.classification.cover_title,
        cover_subtitle: item.classification.cover_subtitle,
        cover_prompt: item.classification.cover_prompt,
        score: item.classification.score,
        source: item.source,
        source_link: item.link,
        link: item.link
    });

    const deepFormatted = deepDives.map(item => format(item, '深度分析', 'badge-deep', '🧠', 'static/cover_a_final.png'));
    const briefFormatted = briefs.map(item => format(item, '简报速览', 'badge-brief', '⚡', 'static/cover_b_final.png'));
    return [...deepFormatted, ...briefFormatted].slice(0, 8);
}

function slugify(text) {
    return String(text)
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'deep-dive';
}

async function callLlm(prompt, maxTokens = 500) {
    if (!LLM_API_KEY) return '';
    const url = `${LLM_API_BASE}/v1/chat/completions`;
    const payload = {
        model: LLM_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: maxTokens
    };
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`
    };
    const timeoutMs = 90000;

    const attempt = async () => {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(timeoutMs)
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`LLM error ${response.status}: ${text}`);
        }
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim() || '';
        if (content) {
            console.log(`[LLM] Success: model=${LLM_MODEL} base=${LLM_API_BASE}`);
        } else {
            console.log('[LLM] Response empty');
        }
        return content;
    };

    try {
        return await attempt();
    } catch (error) {
        const isTimeout = error?.name === 'TimeoutError' || String(error?.message || '').includes('timed out');
        if (isTimeout) {
            console.warn('[LLM] Timeout, retrying once...');
            return await attempt();
        }
        throw error;
    }
}

async function generateCoverImage(item, dateIso) {
    if (LLM_SKIP) return item.cover;
    if (!IMAGE_GEN_ENABLED) return item.cover;
    
    const curator = new AestheticsCurator();
    const style = curator.selectStyle(item);
    const basePrompt = item.cover_prompt || buildCoverPromptFallback(item);
    const prompt = curator.curatePrompt(basePrompt, null, item); // Pass item for context binding
    
    console.log(`[Curator] Selected Style: ${style.name} for "${item.title.slice(0, 20)}..."`);

    try {
        let buffer;

        if (IMAGE_PROVIDER === 'hf') {
            if (!HF_TOKEN) {
                console.warn('HF_TOKEN missing for Hugging Face image generation');
                return item.cover;
            }
            const hf = new HfInference(HF_TOKEN);
            // Use specific model with nscale provider implicit or default routing
            const blob = await hf.textToImage({
                model: HF_IMAGE_MODEL,
                inputs: prompt,
                parameters: { 
                    negative_prompt: style.negative_prompt || "blurry, low quality, distortion, ugly, text, watermark" 
                }
            });
            buffer = Buffer.from(await blob.arrayBuffer());
        } else {
            // OpenAI / NVIDIA Standard
            if (!IMAGE_API_KEY) return item.cover;
            const response = await fetch(`${IMAGE_API_BASE}/v1/images/generations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${IMAGE_API_KEY}`
                },
                body: JSON.stringify({
                    model: IMAGE_MODEL,
                    prompt,
                    size: '1024x1024'
                })
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Image error ${response.status}: ${text}`);
            }
            const payload = await response.json();
            const data = payload.data?.[0];
            if (!data) return item.cover;

            if (data.b64_json) {
                buffer = Buffer.from(data.b64_json, 'base64');
            } else if (data.url) {
                const imageResponse = await fetch(data.url);
                if (!imageResponse.ok) return item.cover;
                const arrayBuffer = await imageResponse.arrayBuffer();
                buffer = Buffer.from(arrayBuffer);
            }
        }

        if (!buffer) return item.cover;

        const coverDir = path.join(__dirname, 'static', 'covers');
        await fs.mkdir(coverDir, { recursive: true });
        const slug = slugify(item.title || item.id);
        const filename = `${dateIso}-${slug}.png`;
        const filePath = path.join(coverDir, filename);

        await fs.writeFile(filePath, buffer);
        return `static/covers/${filename}`;

    } catch (error) {
        console.warn('Image generation failed:', error.message || error);
    }
    return item.cover;
}

function buildBriefPrompt(item) {
    return `你是AI情报编辑。请基于以下信息写一段120-160字的中文简报，总结事实+影响，不要引用外链，不要夸张。\n\n标题: ${item.title}\n摘要: ${item.summary}\n来源: ${item.source}\n链接: ${item.source_link || item.link}`;
}

function buildDeepDivePrompt(item) {
    return `你是AI深度解读作者。基于以下信息输出中文深度解读，分为4段：\n1) 背景\n2) 核心价值\n3) 风险与争议\n4) 我的判断\n总长度400-700字。\n\n标题: ${item.title}\n摘要: ${item.summary}\n来源: ${item.source}\n链接: ${item.source_link || item.link}`;
}

function buildClassificationPrompt(item) {
    const priorities = PRIORITY_TOPICS.map(topic => `- ${topic}`).join('\n');
    return `你是AI情报主编，需要把内容划分为深度解读或简报速览，并给出封面文案与图像提示词。\n\n优先作为深度解读的关键词（命中请尽量给深度）：\n${priorities}\n\n请输出严格JSON：\n{\n  "kind": "deep"|"brief",\n  "score": 0-100,\n  "reason": "分类理由，简短一句",\n  "cover_title": "封面标题，<=18字",\n  "cover_subtitle": "封面副标题，<=28字",\n  "cover_prompt": "英文图像提示词，实验室/赛博极简风格"\n}\n\n内容：\n标题: ${item.title}\n摘要: ${item.summary}\n来源: ${item.source}\n链接: ${item.source_link || item.link}`;
}

function buildCoverPromptFallback(item) {
    const title = item.title || 'AI Insight';
    return `cyber minimal laboratory, warm beige background, editorial collage, abstract circuitry, bold typography, focus on ${title}, cinematic lighting, high detail`;
}

function heuristicClassification(item) {
    const priorityHit = matchesPriority(`${item.title} ${item.summary}`);
    const sourceBoost = ['GitHub', 'Hacker News'].includes(item.source) ? 15 : 0;
    const baseScore = priorityHit ? 95 : 55 + sourceBoost;
    const kind = priorityHit || baseScore >= 70 ? 'deep' : 'brief';
    return {
        kind,
        score: baseScore,
        reason: priorityHit ? '命中高优先关键词' : `基于来源与热度判断为${kind}`,
        cover_title: item.title?.slice(0, 18) || 'AI 情报解读',
        cover_subtitle: String(item.summary || '').slice(0, 28),
        cover_prompt: buildCoverPromptFallback(item)
    };
}

async function classifyItem(item) {
    if (LLM_SKIP || !LLM_API_KEY) {
        return { ...item, classification: heuristicClassification(item) };
    }
    try {
        const response = await callLlm(buildClassificationPrompt(item), 300);
        const parsed = safeJsonParse(response);
        if (!parsed || !parsed.kind) {
            return { ...item, classification: heuristicClassification(item) };
        }
        const normalizedKind = parsed.kind === 'deep' ? 'deep' : 'brief';
        return {
            ...item,
            classification: {
                kind: normalizedKind,
                score: Number(parsed.score) || 60,
                reason: parsed.reason || '',
                cover_title: parsed.cover_title || item.title || 'AI 情报解读',
                cover_subtitle: parsed.cover_subtitle || String(item.summary || '').slice(0, 28),
                cover_prompt: parsed.cover_prompt || buildCoverPromptFallback(item)
            }
        };
    } catch (error) {
        console.warn('Classification LLM failed:', error.message || error);
        return { ...item, classification: heuristicClassification(item) };
    }
}

async function enrichItemsWithLlm(items) {
    if (LLM_SKIP) return items;
    const enriched = [];
    console.log(`Enriching ${items.length} items with LLM...`);
    
    for (const [index, item] of items.entries()) {
        console.log(`Processing item ${index + 1}/${items.length}: ${item.title.slice(0, 30)}...`);
        
        if (item.tag === '深度分析') {
            try {
                const analysis = await callLlm(buildDeepDivePrompt(item), 900);
                enriched.push({ ...item, analysis: analysis || item.summary });
            } catch (error) {
                console.warn('Deep dive LLM failed:', error.message || error);
                enriched.push({ ...item, analysis: item.summary });
            }
            continue;
        }

        if (LLM_BRIEF_ENABLED && LLM_API_KEY && !LLM_SKIP) {
            try {
                const brief = await callLlm(buildBriefPrompt(item), 220);
                enriched.push({ ...item, summary: brief || item.summary });
            } catch (error) {
                console.warn('Brief LLM failed:', error.message || error);
                enriched.push(item);
            }
        } else {
            enriched.push(item);
        }
        
        // Add small delay between items
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    return enriched;
}

function buildPodcastSummaryPrompt(latestNews) {
    const items = latestNews.map(item => `- ${item.title} (${item.tag})`).join('\n');
    return `你是播客主编。请基于今日情报输出一段80-140字中文播客摘要，强调“怎么用/为什么重要”。\n\n今日情报:\n${items}`;
}

function buildPodcastScriptPrompt(latestNews) {
    const items = latestNews.map(item => `- ${item.title} (${item.tag})`).join('\n');
    return `你是播客主持人，输出一段300-500字中文脚本，分3段：\n1) 今日看点总览\n2) 每条情报的“怎么用/影响”一句话\n3) 行业趋势一句话结尾\n\n今日情报:\n${items}`;
}

async function buildPodcastBlock(latestNews) {
    const deepDives = latestNews.filter(item => item.tag === '深度分析');
    const briefs = latestNews.filter(item => item.tag !== '深度分析');
    const titles = [...deepDives, ...briefs].slice(0, 5).map(item => item.title).join(' · ');
    let summary = `深度解读 ${deepDives.length} 条，快讯 ${briefs.length} 条。重点话题：${titles}`;
    let script = '';
    
    const curator = new AestheticsCurator();
    const podcastStyle = curator.selectStyle({ title: 'Podcast', summary: titles, tag: '深度分析' });
    const podcastCoverPrompt = curator.curatePrompt(
        "minimalist radio studio, microphone closeup, waveform visualizer, soft dark lighting",
        null,
        { title: 'Podcast', summary: titles, tag: '深度分析' }
    );

    if (LLM_API_KEY && !LLM_SKIP) {
        try {
            const llmSummary = await callLlm(buildPodcastSummaryPrompt(latestNews), 200);
            if (llmSummary) summary = llmSummary;
            script = await callLlm(buildPodcastScriptPrompt(latestNews), 600);
            
            const scriptAudit = curator.auditText(script, 'toxic-geek');
            if (!scriptAudit.passed) {
                console.warn(`[Curator] Podcast script tone issues: ${scriptAudit.issues.join(', ')}`);
            }
        } catch (error) {
            console.warn('Podcast LLM failed:', error.message || error);
        }
    }

    return {
        title: '今日播客：AI 情报速递 · 15 分钟',
        summary,
        meta: `Daily Briefing · ${deepDives.length} 深度 / ${briefs.length} 快讯`,
        script,
        audio: process.env.PODCAST_AUDIO_URL || '',
        cover_prompt: podcastCoverPrompt,
        style: podcastStyle.name
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

function renderDailyReportHtml(dateIso, deepDives, briefs) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>任务复盘日报 · ${dateIso}</title>
  <style>
    body { font-family: "Noto Serif SC", serif; background: #f6f3ee; color: #111827; margin: 0; }
    .wrap { max-width: 880px; margin: 0 auto; padding: 48px 24px; }
    h1, h2, h3 { font-family: "Space Grotesk", sans-serif; }
    .meta { color: #6b7280; margin-bottom: 24px; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 20px; padding: 24px; margin-bottom: 24px; }
    ul { padding-left: 20px; }
  </style>
</head>
<body>
  <div class="wrap">
    <a href="../../index.html">← Back to Dashboard</a>
    <h1>📄 Ninjin 超级公司 · 任务复盘日报</h1>
    <div class="meta">日期: ${dateIso}</div>
    <div class="card">
      <h2>今日战果 · 深度解读</h2>
      <ul>${deepDives.map(item => `<li>${item}</li>`).join('') || '<li>无</li>'}</ul>
    </div>
    <div class="card">
      <h2>今日战果 · 情报速览</h2>
      <ul>${briefs.map(item => `<li>${item}</li>`).join('') || '<li>无</li>'}</ul>
    </div>
    <div class="card"><h2>遇到的问题与解决</h2></div>
    <div class="card"><h2>目前的不足与缺口</h2></div>
    <div class="card"><h2>明日计划</h2></div>
  </div>
</body>
</html>`;
}

async function writeReport(dateIso, deepDives, briefs) {
    await fs.mkdir(REPORT_DIR, { recursive: true });
    const reportPath = path.join(REPORT_DIR, `Report_${dateIso}.md`);
    const reportHtmlPath = path.join(REPORT_DIR, `Report_${dateIso}.html`);
    const deepList = deepDives.map(item => `- ${item.title}`).join('\n');
    const briefList = briefs.map(item => `- ${item.title}`).join('\n');
    const content = `# 📄 Ninjin 超级公司 · 任务复盘日报\n# 日期: ${dateIso}\n\n## 1. 今日战果\n\n### 深度解读\n${deepList || '- 无'}\n\n### 情报速览\n${briefList || '- 无'}\n\n## 2. 遇到的问题与解决\n\n## 3. 目前的不足与缺口\n\n## 4. 明日计划\n`;
    await fs.writeFile(reportPath, content);
    const html = renderDailyReportHtml(dateIso, deepDives.map(item => item.title), briefs.map(item => item.title));
    await fs.writeFile(reportHtmlPath, html);
}

async function ensureDailyReportsHtml() {
    await fs.mkdir(REPORT_DIR, { recursive: true });
    const entries = await fs.readdir(REPORT_DIR);
    const mdReports = entries.filter(name => name.startsWith('Report_') && name.endsWith('.md'));
    for (const name of mdReports) {
        const dateIso = name.replace('Report_', '').replace('.md', '');
        const htmlName = `Report_${dateIso}.html`;
        if (entries.includes(htmlName)) continue;
        const mdPath = path.join(REPORT_DIR, name);
        const md = await fs.readFile(mdPath, 'utf8');
        const deepTitles = extractSection(md, '### 深度解读');
        const briefTitles = extractSection(md, '### 情报速览');
        const html = renderDailyReportHtml(dateIso, deepTitles, briefTitles);
        await fs.writeFile(path.join(REPORT_DIR, htmlName), html);
    }
}

async function writeContentPages(items, archives = []) {
    const deepDir = path.join(__dirname, 'reports', 'deep-dives');
    const briefDir = path.join(__dirname, 'reports', 'briefs');
    await fs.mkdir(deepDir, { recursive: true });
    await fs.mkdir(briefDir, { recursive: true });
    const updates = [];

    const archiveLinks = archives.slice(0, 3);

    for (const item of items) {
        if (item.tag !== '深度分析') {
            const slug = slugify(item.title || item.id);
            const filename = `${slug}.html`;
            const filePath = path.join(briefDir, filename);
            const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${item.title} · 情报速览</title>
  <style>
    body { font-family: "Noto Serif SC", serif; background: #f6f3ee; color: #111827; margin: 0; }
    .wrap { max-width: 920px; margin: 0 auto; padding: 48px 24px; }
    h1 { font-family: "Space Grotesk", sans-serif; font-size: 36px; margin-bottom: 16px; }
    .meta { color: #6b7280; margin-bottom: 24px; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 20px; padding: 24px; }
    .source { color: #2563eb; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrap">
    <a href="../../index.html">← Back to Dashboard</a>
    <h1>${item.title}</h1>
    <div class="meta">${item.date} · 情报速览</div>
    <div class="card">
      <p>${item.summary}</p>
      ${item.cover_title ? `<p><strong>${item.cover_title}</strong> ${item.cover_subtitle || ''}</p>` : ''}
      <p><a class="source" href="${item.source_link || item.link}" target="_blank" rel="noreferrer">原始来源</a></p>
    </div>
  </div>
</body>
</html>`;
            await fs.writeFile(filePath, html);
            updates.push({ ...item, link: `reports/briefs/${filename}` });
            continue;
        }
        const slug = slugify(item.title || item.id);
        const filename = `${slug}.html`;
        const filePath = path.join(deepDir, filename);
        const firstSeen = item.first_seen || item.date;
        const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${item.title} · 深度解读</title>
  <style>
    body { font-family: "Noto Serif SC", serif; background: #f6f3ee; color: #111827; margin: 0; }
    .wrap { max-width: 920px; margin: 0 auto; padding: 48px 24px; }
    h1 { font-family: "Space Grotesk", sans-serif; font-size: 40px; margin-bottom: 16px; }
    .meta { color: #6b7280; margin-bottom: 24px; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 20px; padding: 24px; }
    .source { color: #2563eb; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrap">
    <a href="../../index.html">← Back to Dashboard</a>
    <h1>${item.title}</h1>
    <div class="meta">${item.date} · 深度解读 · 首次进入雷达 ${firstSeen}</div>
    <div class="card">
      <p>${item.analysis || item.summary}</p>
      ${item.cover_title ? `<p><strong>${item.cover_title}</strong> ${item.cover_subtitle || ''}</p>` : ''}
      <p><a class="source" href="${item.source_link || item.link}" target="_blank" rel="noreferrer">原始来源</a></p>
    </div>
    ${archiveLinks.length ? `
    <div class="card">
      <h2>往期回顾</h2>
      <ul>${archiveLinks.map(item => `<li><a class="source" href="${item.link}">${item.date}</a></li>`).join('')}</ul>
    </div>
    ` : ''}
  </div>
</body>
</html>`;
        await fs.writeFile(filePath, html);
        updates.push({ ...item, link: `reports/deep-dives/${filename}` });
    }

    return updates;
}

async function writeArchiveIndex() {
    await fs.mkdir(ARCHIVE_DIR, { recursive: true });
    await ensureDailyReportsHtml();
    const entries = await fs.readdir(REPORT_DIR);
    const reports = entries
        .filter(name => name.endsWith('.html'))
        .map(name => ({
            date: name.replace('Report_', '').replace('.html', ''),
            link: `../reports/daily-reports/${name}`
        }))
        .sort((a, b) => b.date.localeCompare(a.date));

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>往期归档 · Ninjin Intelligence</title>
  <style>
    body { font-family: "Space Grotesk", sans-serif; background: #f6f3ee; color: #111827; margin: 0; }
    .wrap { max-width: 860px; margin: 0 auto; padding: 48px 24px; }
    h1 { font-family: "Fraunces", serif; font-size: 40px; margin-bottom: 16px; }
    .list { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 16px; text-decoration: none; color: inherit; }
  </style>
</head>
<body>
  <div class="wrap">
    <a href="../index.html">← Back to Dashboard</a>
    <h1>往期归档</h1>
    <div class="list">
      ${reports.map(item => `<a class="card" href="${item.link}">${item.date}</a>`).join('')}
    </div>
  </div>
</body>
</html>`;

    await fs.writeFile(path.join(ARCHIVE_DIR, 'index.html'), html);
    return reports;
}

async function run() {
    const sources = await readSources();
    const extraRss = (process.env.EXTRA_RSS_FEEDS || '').split(',').map(item => item.trim()).filter(Boolean);
    const extraGitHubQueries = (process.env.EXTRA_GITHUB_QUERIES || '').split(',').map(item => item.trim()).filter(Boolean);
    const extraXQueries = (process.env.EXTRA_X_QUERIES || '').split(',').map(item => item.trim()).filter(Boolean);

    if (extraRss.length) {
        sources.rss = sources.rss || { feeds: [] };
        sources.rss.feeds = Array.from(new Set([...(sources.rss.feeds || []), ...extraRss]));
    }

    if (extraGitHubQueries.length) {
        sources.github = sources.github || { limit: 5 };
        sources.github.queries = Array.from(new Set([...(sources.github.queries || []), ...(sources.github.query ? [sources.github.query] : []), ...extraGitHubQueries]));
    }

    if (extraXQueries.length) {
        sources.x = sources.x || { limit: 5, queries: [] };
        sources.x.queries = Array.from(new Set([...(sources.x.queries || []), ...extraXQueries]));
    }
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
    // Limit to 3 items to ensure end-to-end completion within timeout for verification
    // const limitedItems = items.slice(0, 3);
    const latestNews = await buildLatestNews(items);
    const enrichedNews = await enrichItemsWithLlm(latestNews);
    const withCovers = await Promise.all(enrichedNews.map(async item => {
        const cover = await generateCoverImage(item, dateIso);
        return { ...item, cover, first_seen: item.date };
    }));

    const verdicts = existing?.verdicts || [
        { status: 'up', name: 'MCP Protocol', desc: '生态爆发，已成为行业事实标准。' },
        { status: 'down', name: 'SimpleWrapper-AI', desc: 'GitHub 已 2 个月无更新，纯套壳逻辑已被市场淘汰。' }
    ];

    const deepDives = withCovers.filter(item => item.tag === '深度分析');
    const briefs = withCovers.filter(item => item.tag !== '深度分析');
    await writeReport(dateIso, deepDives, briefs);
    const archives = await writeArchiveIndex();
    const updatedNews = await writeContentPages(withCovers, archives);
    const blogPosts = await syncBlogPosts();
    const blogLead = blogPosts[0];
    const data = {
        meta: {
            date: dateCn,
            author: 'Ninjin 数字化实验室'
        },
        latest_news: updatedNews,
        verdicts,
        social_hotspots: await readCrawlerHotspots(),
        podcast: blogLead ? {
            title: blogLead.title,
            summary: blogLead.summary,
            meta: blogLead.date,
            audio: blogLead.audio || ''
        } : await buildPodcastBlock(updatedNews),
        blog_posts: blogPosts,
        archives
    };

    const tmpFile = `${DATA_FILE}.tmp`;
    await fs.writeFile(tmpFile, JSON.stringify(data, null, 2));
    await fs.rename(tmpFile, DATA_FILE);

    
    console.log(`[${dateIso}] Monitor update complete.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    run();
}
