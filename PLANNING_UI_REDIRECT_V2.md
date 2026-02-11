# PLANNING · UI/UX 重做 V2（执行文档）

> 对应 PRD：`PRD_UI_REDIRECT_V2.md`
> 目标：在不迁移框架（静态 HTML）的前提下，将站点重做为“Swiss grid 杂志式首页 + 阅读优先”。

---

## 0) 项目状态

- 阶段：半成品（视觉系统 + 3 个关键页面）
- 交付面：
  - 首页：`index.html`
  - Deepdive 列表：`deepdive/index.html`
  - 文章模板：`deepdive/posts/hello-deepdive.html`

---

## 1) 角色与分工（Pod / 工种）

### CEO/PM（冰镇小龙虾）
- 需求挖掘（DGGing）与甲方确认
- PRD/Planning 写作与版本管理
- 决策日志与回滚策略
- 组织总监辩论（必要时）

### 设计总监（Design Director）
- 输出设计系统（Typography/Spacing/Grid/Colors）
- 首页信息层级与模块规范
- 无障碍规范（对比度/焦点/可读性）

### 前端工程总监（Frontend Director）
- 落地实现：`static/site.css`、页面结构重排
- 链接/路由策略：file:// 与部署一致（相对链接）
- 确保不破坏 existing pages（reports）

### 内容总监/主编（Editor-in-chief）
- 栏目结构与文案（栏目命名、摘要口径）
- Deepdive 列表字段（日期/标题/摘要/tag）规范

### QA/Reviewer
- 视觉一致性 review
- 链接/可访问性/响应式检查

---

## 2) 使用的 Agents（执行层）

> 这里记录“谁干了什么”，用于复盘：是我们理解错，还是需求变更。

- **Codex 工头（coding-agent）**：
  - UI 重做的代码改动与提交
  - Deepdive MD pipeline（脚本与生成页）
- **UI/UX Pro Max（design-system search）**：
  - 提供风格/排版/配色建议（Swiss Modernism 2.0 等）
- **Browser / web_fetch / Notion API**：
  - 竞品参考、素材/Deep Dive Action 点检索

---

## 3) 执行拆解（里程碑）

### M1｜视觉系统定稿（Design System v2）
- [ ] 字体对（A: Libre Bodoni + Public Sans / B: Fraunces + Space Grotesk）二选一
- [ ] 纸感背景、分割线、tag、链接、focus 统一
- [ ] 8/12 栏网格与 spacing 体系落盘到 `static/site.css`

### M2｜首页改版（杂志结构）
- [ ] Hero：主标题+副标题+单一主 CTA（最新 Deepdive）
- [ ] 栏目区块：Deepdive / 快报 / 视频 / 归档
- [ ] 去“dashboard 卡片噪音”：阴影减量、边框/分割线为主

### M3｜Deepdive 列表 + 文章页（阅读舒适）
- [ ] 列表：日期→标题→摘要→标签；分割线/留白节奏
- [ ] 文章页：行高、标题层级、blockquote、code 样式

### M4｜QA/验收（半成品）
- [ ] 375/768/1024/1440 响应式
- [ ] 键盘可用、focus 清晰
- [ ] file:// 与部署路径一致（相对链接）

---

## 4) 风险与回滚

- 风险：大幅改 CSS 影响 reports 页面
  - 缓解：尽量用“新增 class”而非全局覆盖；必要时 reports 保留原样式
- 回滚：
  - 所有变更走分支 PR
  - 发现方向不对：直接 close PR 或 revert merge commit
