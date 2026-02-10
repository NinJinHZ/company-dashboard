# Company Dashboard · 独立站推进进度

> 目标：把 deepdive 变成可被搜索、可复用、可持续分发的资产；同时让独立站整体阅读体验对标 jimi.ink 的「低噪音 + 纸感 + 排版优先」。

## 已完成

### 2026-02-11

- ✅ **安全同步到 GitHub**：`company-dashboard` UI/UX 第一轮更新已推送
- ✅ 新增 `/deepdive/`：文章索引页（jimi 风格：日期→标题→摘要→标签）
- ✅ 新增 deepdive 文章模板页：`/deepdive/posts/hello-deepdive.html`
- ✅ 首页导航新增「文章」入口
- ✅ 全站「纸感底色」第一轮：背景更暖、对比更柔、hover 更安静
- ✅ Deepdive 页面底色同步到主站纸感底色

## 进行中 / 下一步

1) **统一样式资产**（建议）
   - 抽一个 `static/site.css`：统一背景/边框/字体/标签样式，减少每页重复 CSS

2) **内容落地协议 + 自动生成**
   - 目标结构：`deepdive/posts/*.md`（frontmatter: title/date/summary/tags/slug）
   - 生成：
     - `deepdive/index.html`（自动列表）
     - `deepdive/posts/<slug>.html`（文章页）

3) **首页接入 deepdive**
   - 首页展示最近 3 条 deepdive + “查看全部”

4) **图标/emoji 收敛**
   - 将 `data.json` 里用于 UI 的 emoji icon 改为统一 SVG/icon tile（避免风格冲突）

## 审核要点（给 Ninjin）

- 你重点看 3 件事：
  1) 底色/留白是否更舒服（接近 jimi.ink）
  2) Deepdive 列表页是否“干净到你愿意每天打开”
  3) 首页是否需要进一步减噪，还是保持信息密度
