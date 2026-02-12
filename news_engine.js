const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');

const parser = new Parser();

// MVP Configuration
const SOURCES = [
    {
        name: 'Hacker News',
        url: 'https://hnrss.org/frontpage?points=100', // Filter for quality
        type: 'tech',
        weight: 'S'
    },
    {
        name: 'Reddit /r/startups',
        url: 'https://www.reddit.com/r/startups/top/.rss?t=day', // Top of the day
        type: 'startup',
        weight: 'A'
    },
    {
        name: 'TechCrunch',
        url: 'https://techcrunch.com/feed/',
        type: 'tech',
        weight: 'B'
    }
];

const OUTPUT_FILE = path.join(__dirname, 'static', 'news.json');

// --- Gemini Translation Helper ---
// Note: In a real app, use a proper queue. Here we just do sequential for MVP.
// We assume GOOGLE_API_KEY is available in env or we can try to use a free endpoint if configured.
// For this local MVP, we will simulate "Smart Translation" if no key, OR try to use a simple dictionary/rule if key missing.
// BETTER: Let's use the local LLM capability if possible, but since I am running this script via `node`, 
// I don't have direct access to the `llm` tool inside this node process.
// WORKAROUND: I will rewrite this script to be called via `openclaw exec` which has LLM access? 
// No, that's too complex. 
// SOLUTION: I will add a simple placeholder translator that appends "(中文待翻译)" 
// OR I can use a simple `fetch` to a translation API if you have one.
//
// WAIT! I am the agent. I can write the code to call Gemini API directly if I have the key.
// But I don't want to leak keys into the code.
//
// ALTERNATIVE: I will use a simple heuristic for now: 
// 1. Map known sources to Chinese names.
// 2. For titles, I can't translate without an API.
// 
// RE-THINK: The user wants CHINESE. I am an agent with `gemini` access.
// I can write a python script that uses `google-genai` (if installed) or just standard HTTP to call Gemini?
// Actually, I can just use my `edit` tool to inject a "Translate" step that uses a public free API? No, unreliable.
//
// BEST PATH: I will rewrite `news_engine.js` to accept a `--translate` flag, 
// and I will provide a wrapper script that uses *ME* (the agent) to translate the JSON after generation.
// 
// NO, that's slow.
//
// LET'S DO THIS: I will use the `GoogleGenerativeAI` package if available, or just mock it? 
// The user said "use Gemini". I will assume `GOOGLE_API_KEY` is in the environment or I can ask for it.
// 
// For now, to be fast and safe: I will modify the script to *prepare* for translation,
// and I will run a separate "Translate" pass using MYSELF (the agent) right now.
// i.e. I read the english JSON, I translate it in my context, and I write back the Chinese JSON.
// This is the most robust way without dealing with API keys in code.

async function fetchFeed(source) {
    try {
        console.log(`Fetching ${source.name}...`);
        const feed = await parser.parseURL(source.url);
        return feed.items.map(item => ({
            title: item.title,
            link: item.link,
            pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
            contentSnippet: item.contentSnippet || item.content || '',
            sourceName: source.name,
            weight: source.weight, // Inherit source weight initially
            id: item.guid || item.link
        })).slice(0, 10); // Take top 10 from each
    } catch (error) {
        console.error(`Error fetching ${source.name}:`, error.message);
        return [];
    }
}

function assignSignal(item) {
    // Simple heuristic for MVP Signal Strength
    const strongKeywords = ['Launch', 'Release', 'Announcing', 'Show HN', 'GPT', 'Gemini', 'OpenAI'];
    const title = item.title;
    
    let signal = item.weight; // Default to source weight
    let why = "";

    // Upgrade logic
    if (strongKeywords.some(k => title.includes(k))) {
        signal = 'S';
        why = "Contains strong signal keyword.";
    } else if (item.sourceName === 'Hacker News') {
        // HN is generally high signal
        if (signal !== 'S') signal = 'A'; 
    }

    // Generate a simple "Why it matters" stub
    if (!why) {
        if (signal === 'S') why = "High impact source/keyword.";
        else if (signal === 'A') why = "Trending in community.";
        else why = "Latest update.";
    }

    return {
        ...item,
        signal,
        whyItMatters: why
    };
}

async function main() {
    let allItems = [];

    for (const source of SOURCES) {
        const items = await fetchFeed(source);
        allItems = allItems.concat(items);
    }

    // 1. Process & Score
    let processedItems = allItems.map(assignSignal);

    // 2. Dedupe by Link
    const uniqueItems = [];
    const seenLinks = new Set();
    for (const item of processedItems) {
        if (!seenLinks.has(item.link)) {
            seenLinks.add(item.link);
            uniqueItems.push(item);
        }
    }

    // 3. Sort (S > A > B, then by Date)
    const weightMap = { 'S': 3, 'A': 2, 'B': 1 };
    uniqueItems.sort((a, b) => {
        const weightDiff = weightMap[b.signal] - weightMap[a.signal];
        if (weightDiff !== 0) return weightDiff;
        return b.pubDate - a.pubDate;
    });

    // 4. Output
    const output = {
        updatedAt: new Date().toISOString(),
        items: uniqueItems
    };

    if (!fs.existsSync(path.dirname(OUTPUT_FILE))){
        fs.mkdirSync(path.dirname(OUTPUT_FILE));
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log(`✅ Generated ${uniqueItems.length} news items to ${OUTPUT_FILE}`);
}

main();
