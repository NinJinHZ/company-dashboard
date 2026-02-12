#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("node:fs/promises");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const POSTS_MD_DIR = path.join(REPO_ROOT, "deepdive", "posts-md");
const POSTS_OUT_DIR = path.join(REPO_ROOT, "deepdive", "posts");
const INDEX_OUT_PATH = path.join(REPO_ROOT, "deepdive", "index.html");
const HOMEPAGE_PATH = path.join(REPO_ROOT, "index.html");

function escapeHtml(unsafe) {
  return String(unsafe)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function unquoteYamlString(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}

function parseYamlFrontmatter(frontmatterText, filename) {
  const lines = frontmatterText.replaceAll("\r\n", "\n").split("\n");
  const data = {};

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;

    const keyMatch = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (!keyMatch) {
      throw new Error(`Invalid frontmatter line in ${filename}: ${JSON.stringify(line)}`);
    }

    const key = keyMatch[1];
    const rest = keyMatch[2] ?? "";

    if (key === "tags") {
      const trimmed = rest.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        const inner = trimmed.slice(1, -1).trim();
        data.tags = inner
          ? inner
              .split(",")
              .map((t) => unquoteYamlString(t))
              .map((t) => t.trim())
              .filter(Boolean)
          : [];
        continue;
      }

      if (trimmed) {
        data.tags = [unquoteYamlString(trimmed)].filter(Boolean);
        continue;
      }

      const tags = [];
      while (i + 1 < lines.length) {
        const next = lines[i + 1];
        const m = /^\s*-\s*(.+)$/.exec(next);
        if (!m) break;
        tags.push(unquoteYamlString(m[1]).trim());
        i += 1;
      }
      data.tags = tags.filter(Boolean);
      continue;
    }

    data[key] = unquoteYamlString(rest).trim();
  }

  return data;
}

function parseFrontmatterAndContent(source, filename) {
  const text = String(source ?? "").replaceAll("\r\n", "\n");
  if (!text.startsWith("---\n")) {
    throw new Error(`Missing YAML frontmatter in ${filename} (expected starting ---)`);
  }

  const endIdx = text.indexOf("\n---\n", 4);
  if (endIdx === -1) {
    throw new Error(`Missing YAML frontmatter closing --- in ${filename}`);
  }

  const frontmatter = text.slice(4, endIdx).trim();
  const content = text.slice(endIdx + "\n---\n".length);
  return { data: parseYamlFrontmatter(frontmatter, filename), content };
}

function markdownToHtml(markdown) {
  const lines = String(markdown ?? "").replaceAll("\r\n", "\n").split("\n");
  const out = [];

  let inCodeFence = false;
  let codeFenceLang = "";
  let codeLines = [];

  let inList = false;
  let paragraphLines = [];

  function flushParagraph() {
    if (!paragraphLines.length) return;
    const raw = paragraphLines.join(" ").replace(/\s+/g, " ").trim();
    if (!raw) {
      paragraphLines = [];
      return;
    }

    let html = escapeHtml(raw);

    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, text, url) => {
      return `<a href="${url}">${text}</a>`;
    });

    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    out.push(`<p>${html}</p>`);
    paragraphLines = [];
  }

  function openListIfNeeded() {
    if (!inList) {
      flushParagraph();
      out.push("<ul>");
      inList = true;
    }
  }

  function closeListIfNeeded() {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  }

  function flushCodeFence() {
    const escaped = escapeHtml(codeLines.join("\n"));
    out.push(`<pre><code${codeFenceLang ? ` class="language-${escapeHtml(codeFenceLang)}"` : ""}>${escaped}</code></pre>`);
    codeLines = [];
    codeFenceLang = "";
  }

  for (const line of lines) {
    if (inCodeFence) {
      if (line.startsWith("```")) {
        inCodeFence = false;
        closeListIfNeeded();
        flushParagraph();
        flushCodeFence();
        continue;
      }
      codeLines.push(line);
      continue;
    }

    if (line.startsWith("```")) {
      inCodeFence = true;
      codeFenceLang = line.slice(3).trim();
      closeListIfNeeded();
      flushParagraph();
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line);
    if (headingMatch) {
      closeListIfNeeded();
      flushParagraph();
      const level = headingMatch[1].length;
      const text = escapeHtml(headingMatch[2].trim());
      out.push(`<h${level}>${text}</h${level}>`);
      continue;
    }

    const listMatch = /^\s*[-*]\s+(.+)$/.exec(line);
    if (listMatch) {
      openListIfNeeded();
      const itemText = escapeHtml(listMatch[1].trim())
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/`([^`]+)`/g, "<code>$1</code>");
      out.push(`<li>${itemText}</li>`);
      continue;
    }

    if (!line.trim()) {
      closeListIfNeeded();
      flushParagraph();
      continue;
    }

    paragraphLines.push(line.trim());
  }

  closeListIfNeeded();
  flushParagraph();

  if (inCodeFence) {
    flushCodeFence();
  }

  return out.join("\n");
}

function normalizeDate(dateStr) {
  const raw = String(dateStr || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`Invalid 'date' (expected YYYY-MM-DD): ${JSON.stringify(dateStr)}`);
  }
  return raw;
}

function normalizeSlug(slug) {
  const raw = String(slug || "").trim();
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(raw)) {
    throw new Error(
      `Invalid 'slug' (use lowercase letters, digits, dashes): ${JSON.stringify(slug)}`
    );
  }
  return raw;
}

function normalizeTags(tags) {
  if (!tags) return [];
  if (!Array.isArray(tags)) {
    throw new Error(`Invalid 'tags' (expected array): ${JSON.stringify(tags)}`);
  }
  return tags
    .map((t) => String(t).trim())
    .filter(Boolean)
    .slice(0, 12);
}

function renderBaseHtml({ title, description, bodyHtml }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = description ? escapeHtml(description) : "";

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  ${safeDescription ? `<meta name="description" content="${safeDescription}" />` : ""}
  <link rel="stylesheet" href="/static/site.css" />
</head>
<body>
  <div class="container">
    <nav class="topnav">
      <a href="/" class="brand">AI 进化论</a>
      <div class="navlinks">
        <a href="/deepdive/">文章</a>
        <a href="/">仪表盘</a>
        <a href="/docs/USAGE.md">关于</a>
      </div>
    </nav>
    ${bodyHtml}
  </div>
</body>
</html>
`;
}

function renderPostPage(post) {
  const tagsHtml = post.tags
    .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
    .join("");

  const articleHtml = markdownToHtml(post.markdown);

  return renderBaseHtml({
    title: `${post.title} · AI 进化论`,
    description: post.summary,
    bodyHtml: `
    <header class="pageheader">
      <div class="meta">${escapeHtml(post.date)}</div>
      <h1 class="pagetitle serif">${escapeHtml(post.title)}</h1>
      ${post.summary ? `<p class="pagesubtitle">${escapeHtml(post.summary)}</p>` : ""}
      ${post.tags.length ? `<div class="tagrow">${tagsHtml}</div>` : ""}
    </header>
    <article class="prose">
      ${articleHtml}
    </article>
    <footer class="pagefooter">
      <a href="/deepdive/">← 返回文章列表</a>
    </footer>
    `,
  });
}

function renderDeepdiveIndex(posts) {
  const itemsHtml = posts
    .map((post) => {
      const tagsHtml = post.tags
        .map((t) => `<span class="tag small">${escapeHtml(t)}</span>`)
        .join("");

      return `
      <article class="listitem">
        <div class="meta">${escapeHtml(post.date)}</div>
        <h2 class="listtitle">
          <a href="/deepdive/posts/${escapeHtml(post.slug)}.html">${escapeHtml(post.title)}</a>
        </h2>
        ${post.summary ? `<p class="listsummary">${escapeHtml(post.summary)}</p>` : ""}
        ${post.tags.length ? `<div class="tagrow">${tagsHtml}</div>` : ""}
      </article>
      `;
    })
    .join("\n");

  return renderBaseHtml({
    title: "Deepdive · AI 进化论",
    description: "写给未来的自己：把“看见”变成“理解”。",
    bodyHtml: `
    <header class="pageheader">
      <h1 class="pagetitle serif">Deepdive</h1>
      <p class="pagesubtitle">写给未来的自己：把“看见”变成“理解”。这里的内容会同步回仪表盘精选。</p>
    </header>
    <main class="list">
      ${itemsHtml || `<p class="muted">暂无文章。</p>`}
      <footer class="sitefooter">
        <div class="brand serif">AI 进化论</div>
        <div class="muted">Deepdive is an asset. Not a chat log.</div>
      </footer>
    </main>
    `,
  });
}

function buildHomepageDeepdiveInner(posts) {
  const latest = posts.slice(0, 3);
  if (!latest.length) {
    return `<div class="text-stone-500 text-sm">暂无文章。</div>`;
  }

  const cards = latest
    .map((p) => {
      const href = `/deepdive/posts/${escapeHtml(p.slug)}.html`;
      return `
<a href="${href}" class="block rounded-3xl border border-stone-200 bg-white/70 backdrop-blur p-6 hover:border-stone-300 hover:bg-white transition">
  <div class="text-xs text-stone-400 font-mono">${escapeHtml(p.date)}</div>
  <div class="mt-3 text-lg font-bold serif leading-snug text-stone-900">${escapeHtml(p.title)}</div>
  ${p.summary ? `<div class="mt-3 text-sm text-stone-600 leading-relaxed">${escapeHtml(p.summary)}</div>` : ""}
</a>`.trim();
    })
    .join("\n");

  return `<div class="grid grid-cols-1 md:grid-cols-3 gap-4">\n${cards}\n</div>`;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function readMarkdownPosts() {
  const entries = await fs.readdir(POSTS_MD_DIR, { withFileTypes: true });
  const mdFiles = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".md"))
    .map((e) => e.name)
    .sort();

  const posts = [];
  for (const filename of mdFiles) {
    const fullPath = path.join(POSTS_MD_DIR, filename);
    const raw = await fs.readFile(fullPath, "utf8");
    const parsed = parseFrontmatterAndContent(raw, filename);

    const title = String(parsed.data.title || "").trim();
    if (!title) throw new Error(`Missing 'title' in ${filename}`);

    const date = normalizeDate(parsed.data.date);
    const summary = String(parsed.data.summary || "").trim();
    const slug = normalizeSlug(parsed.data.slug);
    const tags = normalizeTags(parsed.data.tags);

    posts.push({
      title,
      date,
      summary,
      slug,
      tags,
      markdown: String(parsed.content || "").trim() + "\n",
      sourceFile: filename,
    });
  }

  posts.sort((a, b) => (a.date === b.date ? a.slug.localeCompare(b.slug) : b.date.localeCompare(a.date)));
  return posts;
}

async function updateHomepageIfMarkerPresent(posts) {
  let homepage;
  try {
    homepage = await fs.readFile(HOMEPAGE_PATH, "utf8");
  } catch {
    return { updated: false, reason: "missing homepage" };
  }

  const begin = "<!-- deepdive精选:begin -->";
  const end = "<!-- deepdive精选:end -->";

  if (!homepage.includes(begin) || !homepage.includes(end)) {
    return { updated: false, reason: "marker not found" };
  }

  const inner = buildHomepageDeepdiveInner(posts);
  const beginIdx = homepage.indexOf(begin);
  const indentStart = homepage.lastIndexOf("\n", beginIdx) + 1;
  const indent = homepage.slice(indentStart, beginIdx);

  const indentedInner = inner
    .split("\n")
    .map((l) => (l.trim() ? `${indent}${l}` : ""))
    .join("\n");

  const replaced = homepage.replace(
    new RegExp(`${begin}[\\s\\S]*?${end}`),
    `${begin}\n${indentedInner}\n${indent}${end}`
  );

  if (replaced !== homepage) {
    await fs.writeFile(HOMEPAGE_PATH, replaced, "utf8");
    return { updated: true };
  }

  return { updated: false, reason: "no changes" };
}

async function main() {
  await ensureDir(POSTS_OUT_DIR);

  const posts = await readMarkdownPosts();

  const seen = new Set();
  for (const post of posts) {
    if (seen.has(post.slug)) {
      throw new Error(`Duplicate slug: ${post.slug}`);
    }
    seen.add(post.slug);

    const outPath = path.join(POSTS_OUT_DIR, `${post.slug}.html`);
    const html = renderPostPage(post);
    await fs.writeFile(outPath, html, "utf8");
  }

  await fs.writeFile(INDEX_OUT_PATH, renderDeepdiveIndex(posts), "utf8");

  const homepageResult = await updateHomepageIfMarkerPresent(posts);

  console.log(`Deepdive: built ${posts.length} post(s).`);
  if (homepageResult.updated) console.log("Homepage: updated Deepdive 精选 section.");
  else console.log(`Homepage: skipped (${homepageResult.reason}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
