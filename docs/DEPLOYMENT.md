# Deployment Plan (MVP)

## Goal
Launch a public MVP within 7 days using static hosting and scheduled data refresh.

## Recommended Stack
1. **Static Hosting**: Vercel or Netlify
2. **Data**: `data.json` committed to repo for MVP
3. **Automation**: GitHub Actions or local cron to refresh `data.json`

## Option A: Vercel (Fastest)
1. Push repo to GitHub.
2. Import into Vercel as a static site.
3. Build command: none.
4. Output: root directory.
5. Add a GitHub Action to run `node monitor_engine.js` daily and commit the updated `data.json`.

## Option B: Netlify (Simple)
1. Push repo to GitHub.
2. Import into Netlify.
3. Build command: none.
4. Publish directory: root.
5. Use Netlify Scheduled Functions or GitHub Action to refresh `data.json`.

## Phase 2: Supabase Migration
1. Move `data.json` into Supabase tables.
2. Replace `fetch('data.json')` with fetch to Supabase or a thin edge API.
3. Add auth for dashboard admin writes.

## Timeline
- **Day 1-2**: UI polish + stable `monitor_engine.js`.
- **Day 3**: Deploy to Vercel.
- **Day 4-7**: Iterate UI and refine data sources.
