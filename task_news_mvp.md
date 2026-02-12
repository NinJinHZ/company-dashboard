# MVP Task: Minimal News Engine & Page

**Context:**
We are building a "News/Signal Engine" for the company-dashboard.
Current stack: Static HTML + Node.js scripts. No build step (vanilla JS/HTML).

**Goal:**
Create a functional `/news` page by tomorrow daytime.

**Requirements:**
1. **Data Source Script (`news_engine.js`)**:
   - Use `rss-parser` (already in package.json).
   - Fetch 3 feeds:
     - HN Frontpage: `https://hnrss.org/frontpage`
     - Reddit (Startups): `https://www.reddit.com/r/startups/.rss`
     - A Tech RSS (e.g., TechCrunch or similar reliable one): `https://techcrunch.com/feed/`
   - **Normalize**: Map them to a standard object `{ title, url, source, time, summary }`.
   - **Dedupe**: Simple check by URL.
   - **Label**: Assign `S` (Hero), `A` (Important), or `B` (Normal) signal based on simple rules (e.g., if title contains "AI" or "Launch" -> S).
   - **Output**: Write to `static/news.json`.

2. **Frontend Page (`static/news.html`)**:
   - A magazine-style layout (Clean, high information density).
   - **Hero Section**: Shows the top "S" tier item (big title, summary).
   - **Columns**: 3 columns below for different categories (or just a list if easier).
   - **No Emoji**: Use professional badges/labels (CSS).
   - Fetch `news.json` on load and render.

3. **Integration**:
   - Add a "News" link to the main `index.html` navigation.

**Execution:**
- Write `news_engine.js`.
- Write `static/news.html`.
- Update `index.html`.
- Run `node news_engine.js` to verify it generates data.
- Commit the changes.

**Note:**
- If you hit rate limits with Reddit, just mock the data or skip it for now.
- Keep it simple. No complex frameworks.
