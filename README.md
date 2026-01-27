# Company Dashboard

## 🚀 Mission
The central nervous system of **Ninjin Super Company**. Visualizes AI intelligence, survival verdicts, and personal insights.

Auto-deploy check: 2026-01-27 (sync verify)

## 📚 Documentation
- **[REQUIREMENTS.md](./REQUIREMENTS.md)**: Detailed feature specs and architecture.
- **[Usage Guide](./docs/USAGE.md)**: How to run updates and manage content.
- **[Deployment](./docs/DEPLOYMENT.md)**: MVP hosting plan.

## 👤 Roles & Responsibilities
- **CEO (You)**: Vision, verdict direction, public-facing positioning.
- **Sisyphus**: Data pipeline, dashboard rendering, automation, integration.
- **HRD / Skill Recruiter**: Skill sourcing, audit, approval.
- **Gems / Opal**: Marketing narrative and ops distribution.
- Full details: **[ROLES.md](./ROLES.md)**

## 🛠 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Update Content
The dashboard is data-driven.
- **Auto-Update**: Run `node daily_engine.js` to fetch and regenerate `data.json`.
- **Manual**: Edit `data.json` directly.

### 3. Run Locally
Serve the static files:
```bash
npx serve .
```

## 🏗 Project Structure
- `index.html`: Main entry point (Dynamic rendering via JS).
- `update_dashboard.js`: Frontend logic to render `data.json`.
- `data.json`: The single source of truth for UI content.
- `daily_engine.js`: The backend aggregator script.
- `reports/`: Markdown files for daily deep dives.

## 🔗 Related Projects
- **Ninjin Brain Blog**: Personal insights engine.
- **Qwen TTS MCP**: Voice generation backend.
