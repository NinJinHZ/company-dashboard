async function loadData() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Could not load data.json:", error);
        return null;
    }
}

function renderLatestNews(newsItems) {
    const container = document.querySelector('#latest');
    if (!container) return;

    const header = container.querySelector('h2');
    container.innerHTML = '';
    if (header) container.appendChild(header);

    newsItems.forEach(item => {
        const article = document.createElement('article');
        article.className = 'post-card group cursor-pointer';
        article.onclick = () => { if (item.link && item.link !== '#') location.href = item.link; };
        
        article.innerHTML = `
            <div class="flex flex-col md:flex-row gap-10">
                <div class="flex-1">
                    <div class="flex items-center gap-3 mb-4">
                        <span class="${item.tag_class}">${item.tag}</span>
                        <span class="text-xs text-gray-400 font-mono">${item.date}</span>
                    </div>
                    <h3 class="text-4xl font-bold mb-6 group-hover:text-blue-600 transition-colors leading-tight serif">${item.title}</h3>
                    <p class="text-gray-500 leading-relaxed text-lg">${item.summary}</p>
                </div>
                <div class="w-full md:w-56 h-56 bg-gray-50 rounded-2xl flex items-center justify-center text-6xl border border-gray-100 shadow-sm">${item.icon}</div>
            </div>
        `;
        container.appendChild(article);
    });
}

function renderVerdicts(verdicts) {
    const container = document.querySelector('#verdicts .grid');
    if (!container) return;

    container.innerHTML = '';

    verdicts.forEach(verdict => {
        const div = document.createElement('div');
        div.className = 'bg-white p-4 rounded-xl shadow-sm border border-purple-100';
        
        const statusClass = verdict.status === 'up' ? 'text-green-600' : 'text-red-600';
        const statusText = verdict.status === 'up' ? '↑ 进化中' : '↓ 已凉透';

        div.innerHTML = `
            <div class="${statusClass} font-bold mb-1">${statusText}</div>
            <div class="font-bold">${verdict.name}</div>
            <div class="text-xs text-gray-400">${verdict.desc}</div>
        `;
        container.appendChild(div);
    });
}

function renderPodcast(podcast) {
    if (!podcast) return;
    const title = document.querySelector('#podcast-title');
    const summary = document.querySelector('#podcast-summary');
    const meta = document.querySelector('#podcast-meta');
    const audio = document.querySelector('#podcast-audio');

    if (title && podcast.title) title.textContent = podcast.title;
    if (summary && podcast.summary) summary.textContent = podcast.summary;
    if (meta && podcast.meta) meta.textContent = podcast.meta;
    if (audio && podcast.audio) audio.src = podcast.audio;
}

async function updateDashboard() {
    const data = await loadData();
    if (data) {
        renderLatestNews(data.latest_news);
        renderVerdicts(data.verdicts);
        renderPodcast(data.podcast);
        
        const dateElement = document.querySelector('header p.text-gray-400');
        if (dateElement && data.meta && data.meta.date) {
            dateElement.innerHTML = `${data.meta.date} · ${data.meta.author || 'Ninjin 数字化实验室'}`;
        }
    }
}

document.addEventListener('DOMContentLoaded', updateDashboard);
