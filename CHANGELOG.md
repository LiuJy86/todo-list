# 更新日志 (Changelog)

所有与待办事项清单应用相关的显著变更均记录在此文件中。

---

## [v2.3.2] - 2026-08-18

### 新增 (Added) — GitHub 仓库悬浮入口

在右下角操作指南按钮上方新增一个 GitHub 仓库入口，方便用户在有网络时一键跳转到源码仓库：

- **新增 `<a class="github-fab">`**（位于 `.guide-fab` 正上方）：
  - href：`https://github.com/LiuJy86/todo-list`
  - `target="_blank" rel="noopener noreferrer"`：新标签页打开 + 防 tab-nabbing 安全加固
  - 图标使用**内联 SVG**（GitHub 官方 logo path），离线可用、无需网络字体、矢量无失真
  - 带 `title` 和 `aria-label` 双重无障碍标注
- **样式设计**（与 `.guide-fab` 区分又协调）：
  - 深色渐变背景（`#24292e → #1a1e22`，GitHub 品牌色调）
  - 同尺寸 52×52px 圆形、同 `right: 24px` 右对齐、同 `z-index: 9998`
  - `bottom: 88px`（指南按钮高 52 + 间距 36 = 88），保证两按钮垂直堆叠不重叠，实测 gap=12px
  - hover 时 `translateY(-2px) scale(1.06)` + 阴影加深
  - 窄屏（≤480px）：缩为 46×46px、`bottom: 74px`、SVG 缩为 20×20px，与窄屏 `.guide-fab` 保持 12px 间距
- **右下角布局规划**（三按钮垂直堆叠，互不冲突）：
  - 底层：`.guide-fab` 📖（紫色，操作指南）
  - 上层：`.github-fab` GitHub logo（深色，仓库入口）
  - 左下角：`#petRestoreBtn` 🐾（仅隐藏桌宠后出现，与右下角无冲突）

### 验证 (Verified)

- ✅ `.github-fab` 存在，href 正确指向 `https://github.com/LiuJy86/todo-list`
- ✅ 两按钮不重叠：`gap=12px`（github.bottom=620, guide.top=632）
- ✅ 两按钮右对齐：`right` 均为 686px
- ✅ SVG 图标正确渲染
- ✅ 窄屏响应式：两按钮同步缩小并保持 12px 间距
- ✅ 控制台零错误零警告

### 核心文件

- `index.html`：`</main>` 后新增 `<a class="github-fab">` 含内联 SVG；CSS 链接 `?v=9` → `?v=10`
- `style.css`：新增 `.github-fab` / `.github-fab:hover` / `.github-fab:active` + `.github-fab svg` + 窄屏 @media ≤480px

---

## [v2.3.1] - 2026-08-18

### 变更 (Changed) — 操作指南入口位置调整

根据用户反馈"操作文档右下角比较好"，将操作指南入口从**标题旁并排**改为**右下角悬浮 FAB**：

- **入口按钮位置迁移**：`<a class="guide-link">📖 操作指南</a>`（header 内）→ `<a class="guide-fab">📖</a>`（body 末尾，固定悬浮）
  - **理由**：指南属辅助功能，不应与标题抢焦点；列表滚动后仍可触达；符合 Web 应用"帮助按钮在右下角"习惯
  - **无冲突设计**：左下角已有 `#petRestoreBtn`（桌宠恢复按钮，仅隐藏桌宠后出现），右下角原空闲，两按钮对称分居左右两角，z-index 同为 9998
- **header 恢复简洁居中**：从 `flex + justify-content: center + flex-wrap` 改回 `text-align: center`，标题区视觉干净
- **FAB 样式**：
  - 圆形（`border-radius: 50%`，52×52px），紫色渐变背景，2px 白色描边
  - `position: fixed; right: 24px; bottom: 24px`，悬浮于视口右下角
  - hover 时 `translateY(-2px) scale(1.06)` + 阴影加深，active 回弹
  - 窄屏（≤480px）：缩为 46×46px、贴近边缘 16px，避免遮挡内容
  - 带 `title` 和 `aria-label` 双重无障碍标注

### 验证 (Verified)

- ✅ header 恢复简洁：`block | children=1 | text=待办事项清单`（只有 h1）
- ✅ 旧 `.guide-link` 已清零（`count=0`），新 `.guide-fab` 存在
- ✅ FAB 位置正确：`position=fixed, right=24px, bottom=24px, viewportRight=686, distanceFromRight=24, distanceFromBottom=24`
- ✅ FAB 样式正确：52×52px, `border-radius=50%`, `z-index=9998`, 紫色渐变背景
- ✅ href 正确指向 `user_guide.html`，点击可跳转
- ✅ 指南页 9 个 `.guide-section` 齐全，控制台零错误

### 核心文件

- `index.html`：`<header>` 移除 `<a class="guide-link">`，仅保留 `<h1>`；`</main>` 后新增 `<a class="guide-fab">📖</a>`；CSS 链接 `?v=8` → `?v=9`
- `style.css`：`header` 改回 `text-align: center`；删除 `.guide-link` / `.guide-link:hover` / `.guide-link:active`；新增 `.guide-fab` / `.guide-fab:hover` / `.guide-fab:active` + 窄屏 @media ≤480px

---

## [v2.3.0] - 2026-08-18

### 新增 (Added) — 操作指南文档 + UI 入口

针对真实用户场景，新增一份**完整可点击查阅的操作指南**，让用户在浏览器内即可随时学习所有功能，无需翻阅代码或外部 README：

- **新增独立页面 `user_guide.html`**（项目根目录）：
  - 复用主应用的 CSS 变量（颜色 / 圆角 / 间距），视觉风格与主应用统一
  - 顶部带 9 项**双列目录**，可点击锚点跳转；窄屏自动转单列
  - 右上角"← 返回待办"按钮，随时回到主应用
  - **9 个章节**覆盖全部功能：
    1. 添加待办（基础输入 + Enter 快捷键）
    2. 自然语言提醒（`8:00 吃饭` / `明天8:00 跑步` / `8月15日 8:00 开会` 等示例）
    3. 精确选择提醒时间（datetime-local 与文本框互补）
    4. 到点提醒与音效（三层反馈 + 🔊 测试音效按钮用法 + 自动播放策略提示）
    5. 紧迫度徽章（灰/紫/橙/红 四种状态，直接渲染真实 `.reminder-badge` 元素示例）
    6. 完成与删除（自动沉底 + 提醒联动）
    7. 双组收纳（未完成≥5 / 已完成≥3）
    8. 史迪奇桌宠（6 项互动能力）
    9. 常见问题（5 个高频 Q&A：浏览器关闭/无声/数据丢失/后台漏提醒/换 MP3）
  - 小贴士块（橙色左竖线）强调重点；内联代码（紫色背景）展示示例命令

- **主页面新增入口按钮**：
  - `index.html` 的 `<header>` 标题旁加入 `<a href="user_guide.html" class="guide-link">📖 操作指南</a>`
  - 紫色渐变胶囊按钮，与「🔊 测试音效」按钮风格统一，hover 上浮 + 阴影加深
  - `header` 从 `text-align: center` 改为 `flex + justify-content: center + flex-wrap: wrap`，标题与按钮并排，窄屏自动换行

### 变更 (Changed) — 样式与缓存

- **`header` 布局重构**：从单文本居中改为 flex 容器，支持标题 + 多个入口按钮并排展示，为后续可能新增的入口（如设置、关于等）预留扩展位
- **CSS 缓存版本递增**：`index.html` 的 `style.css?v=7` → `?v=8`，确保用户取到含 `.guide-link` 样式的最新 CSS

### 验证 (Verified)

- ✅ 入口按钮存在且 href 正确：`📖 操作指南 | href=user_guide.html`
- ✅ header 布局正确：`flex | children=2`（h1 + a）
- ✅ 按钮样式生效：`border-radius: 999px` + 紫色渐变背景 + 白字
- ✅ 指南页可访问：标题 `操作指南 · 待办事项清单`，9 个 `.guide-section` 章节
- ✅ 控制台零错误零警告
- ✅ 主应用其它功能（添加/提醒/收纳/桌宠/音效）无回归

### 核心文件

- `user_guide.html`（**新增**）：完整操作指南页面，含目录 / 9 章节 / 返回按钮 / 内联专用样式
- `index.html`：`<header>` 内新增 `<a class="guide-link">📖 操作指南</a>`；CSS 链接版本号 `?v=7` → `?v=8`
- `style.css`：`header` 改为 flex 布局 + `flex-wrap: wrap`；新增 `.guide-link` / `.guide-link:hover` / `.guide-link:active` 样式

---

## [v2.2.0] - 2026-08-18

### 优化 (Optimized) — 整体布局整洁度 + 视觉层级

针对用户反馈"UI 不够整洁"，在**不改变整体布局骨架**的前提下对 5 处关键区域进行了精简优化：

- **输入区改为两行布局**（解决三元素并排拥挤问题）：
  - 第一行：文本框独占整行（`#todoInput flex: 1 1 100%`），输入区域更宽敞
  - 第二行：`datetime-local`（`max-width: 260px`）+ "添加"按钮并排，`flex-wrap: wrap` 保证窄屏自动换行
  - 统一由 `.input-area` 管理 gap 与对齐，视觉节奏更干净
- **提示条样式收敛**（从醒目的橙红虚线改为清晰但不抢焦点的橙色柔和边框）：
  - 文字：12px / 字重 500 / `#b8741a`（深橙棕），比之前 `var(--text-secondary)` 更清晰可读
  - 背景：`rgba(255,167,38, 0.12)` + 1px `rgba(255,167,38, 0.35)` 边框，语义明确但不喧宾夺主
  - 结构：改为 `display: flex`，左侧文字居中、右侧测试按钮紧凑
- **列表项紧凑度提升**：
  - 上下内边距从 12px → 10px，列表密度更高
  - 阴影强度：`0 4px 20px rgba(31,38,135,0.12)` → `0 2px 12px rgba(31,38,135,0.06)`，视觉更轻盈
  - Hover 效果：`translateY(-2px)` → `translateY(-1px)`，反馈克制不浮夸
- **提醒徽章精致化**：内边距微调 + 字间距 0.2px，视觉更清爽

### 新增 (Added) — 🔊 音效测试按钮 + MP3 提示音

- **🔊 测试音效按钮**：与提示条"浏览器关闭后无法触发提醒"并排的胶囊形紫色按钮（`#soundTest-btn`）：
  - 任何时间点击可验证提示音是否正常出声（800ms 节流防抖 + 绿色脉冲动画做视觉确认）
  - 按钮点击本身就是用户交互手势，能同时触发 AudioContext unlock 与 HTMLAudio prime，确保到点提醒时播放不受浏览器自动播放策略拦截
  - 响应式：≤480px 窄屏时按钮换行到第二行居中，不挤压提示文字
- **提示音改为项目根目录 MP3 文件**（`提示音效.mp3`）：
  - 路径使用 `encodeURI('提示音效.mp3')` 兼容中文文件名，`new Audio()` 单例复用，避免每次播放新建实例
  - 模块启动时立即 `ensureMp3Audio()` 设置 `src` + `preload='auto'` + `load()` 预加载
  - 首次用户交互时 `unlockAudio()` 内对 HTMLAudio 执行 `play() → pause() → currentTime=0` prime 授权，让后续 setTimeout 到点触发的提醒也能合法 play

### 变更 (Changed) — 音效可靠性升级

- **播放链路从单一 Web Audio 改为"MP3 优先 + Web Audio 兜底"的双重保障**：
  1. 优先分支：`playReminderSound()` → 若 `mp3Ready=true` → `currentTime=0` 打断重播 + `play()`
  2. 兜底分支：MP3 `play().catch()` 或加载失败 → `tryPlayBeepsFallback()` → 原 `doPlayBeeps()` 合成"叮咚"两声（880Hz + 660Hz，音量 0.5）
- **AudioContext 状态管理修复**（解决"到点无音效"问题）：
  - 原 `playReminderSound` 只判 `if (!audioCtx) return;`，未处理 `state === 'suspended'`（标签页失焦时浏览器自动挂起）
  - 新逻辑：suspended 分支 `resume().then(doPlayBeeps)`；失败记录明确 warn；`unlockAudio` 的 `resume()` 加 `.catch()`

### 新增暴露接口 (Exposed API)

- `window.reminderModule.isMp3Ready()` → MP3 文件是否加载成功
- `window.reminderModule.getMp3Src()` → MP3 实际编码路径（调试用）
- 保留 3 个调试 getter：`hasAudioCtx` / `isMp3Ready` / `getMp3Src`（用户场景无感知，仅控制台可用）

### 修正 (Corrected) — 已知限制与描述更新

- v2.1.0 "已知限制"第 2 条从"未首次交互前完全无法播放音效"修正为：**首次交互前到点会触发视觉反馈（高亮/抖动/史迪奇气泡），只是无声音；首次任意点击/按键后即可出声**
- 浏览器缓存 CSS 导致样式更新未生效：`index.html` CSS 链接加版本参数 `style.css?v=N`，每次优化后递增确保用户取到最新样式

### 验证 (Verified)

- ✅ 输入区两行布局正确：文本框独占首行，datetime-local + 添加按钮在第二行
- ✅ 提示条不再过浅：颜色加深（`#b8741a`）、字号 12px、加橙色细边框，清晰但不抢焦点
- ✅ 🔊 测试音效按钮：点击后 `Mp3Ready=true`、`hasAudioCtx=true`、playing 类触发脉冲动画、600ms 后自动清除
- ✅ 3 秒短时提醒到点后：`reminded=true`、徽章变 overdue、控制台零错误（MP3 分支正常播放）
- ✅ 播放容错：MP3 加载失败时自动回退合成"叮咚"声（双保险）
- ✅ 节流防抖：800ms 内连续点击测试按钮只响一次（无 oscillator 叠音爆音）
- ✅ 收纳、桌宠、轮播、toast 气泡、徽章倒计时等功能无回归

### 核心文件

- `index.html`：提示条改为 flex 结构，新增 `<button class="sound-test-btn" id="soundTestBtn">🔊 测试音效</button>`；CSS 链接版本号递增
- `style.css`：`.reminder-notice` 改为 flex + flex-wrap；新增 `.sound-test-btn` / `.sound-test-btn:hover` / `.sound-test-btn:active` / `.sound-test-btn.playing` + `@keyframes soundPulse`；`.input-area` 加 `flex-wrap: wrap`；`#todoInput`/`#remindAtInput` 调整 flex 与 max-width；`.todo-item` 阴影与 padding 收紧；新增窄屏 @media ≤480px 响应式
- `script.js`：11.4 节提示音模块重写（MP3 单例 + ensureMp3Audio + unlockAudio prime 授权 + playReminderSound 双分支兜底 + tryPlayBeepsFallback）；11.8 新增 3 个 API；11.8b 新增测试按钮绑定逻辑（800ms 节流 + playing class 强制重排重启动画）

---

## [v2.1.0] - 2026-08-18

### 新增 (Added) — 待办事项提醒日期 + 音效

- **待办事项可设置提醒时间**，支持两种输入方式（互补）：
  - **自然语言解析**：在文本框输入「8:00 吃饭」「明天8:00 跑步」「8月15日 8:00 开会」「8月15日 出差」等，自动解析时间并剥离时间词
  - **原生 datetime-local 选择器**：精确选择提醒日期与时间
  - 两者结合：自然语言解析成功时自动同步到 datetime-local 让用户确认；解析失败时回退到 datetime-local 的值；都为空则纯添加（不阻断流程）
- **到点「叮咚」提示音**：使用 Web Audio API 程序合成两声提示音（880Hz「叮」+ 660Hz「咚」，间隔 180ms），无需任何音频文件
- **提醒徽章按紧迫度变色**：
  - 远期（> 1 天）：灰色 `#8888a0`
  - 接近（≤ 1 天，> 1 小时）：紫色 `#667eea`
  - 紧迫（≤ 1 小时）：橙色 `#ffa726` + 脉冲动画 + 「还有 N 分钟」倒计时
  - 已过期：红色 `#ff6b6b` + 删除线
- **到点视觉反馈链路**：对应待办项红框 + 抖动动画 6 秒 + 史迪奇弹气泡「该 XXX 啦！」（黄色 warning 边框）
- **三道触发保障**确保不漏提醒：
  - 精确 `setTimeout` 到点触发
  - `visibilitychange` 切回前台时补触发切走期间错过的提醒
  - 60 秒 `setInterval` 兜底检查（应对后台标签页定时器降频）
- **提醒徽章实时倒计时**：每 30 秒刷新所有徽章文案（仅改 textContent，不触发 render，避免反复写 localStorage）
- **浏览器关闭无法提醒的提示条**：列表区上方虚线橙色提示条告知用户保持页面打开

### 变更 (Changed)

- **存储从 `sessionStorage` 升级到 `localStorage`**：数据永久保留，跨会话触发提醒（提醒功能的本质需求）
  - **一次性迁移**：老版本用户首次打开 v2.1.0 时，若 localStorage 无数据但 sessionStorage 有旧数据，自动搬到 localStorage 并清掉 sessionStorage，无感知升级
- **`todos` 数据结构新增两个可选字段**（向后兼容，旧数据自动补齐）：
  - `remindAt`：提醒时间戳（毫秒），无提醒为 `null`
  - `reminded`：是否已触发过提醒，触发后置 `true` 防重复响铃
- **`addTodo(remindAt)` 函数签名扩展**：接受可选的提醒时间戳参数，返回新增事项对象供调度
- **`createTodoElement` 增加提醒徽章**：有 `remindAt` 时追加 `<span class="reminder-badge">`，文案与颜色由 `updateReminderBadge` 刷新
- **`updateItemState` 增加 `reminded` class 切换**：CSS 据此显示左上角小铃铛 🔔 标识
- **`toggleTodo` 集成提醒调度**：勾选完成时 `cancelReminder`；取消完成时若提醒未到则重新 `scheduleReminder`
- **`deleteTodo` 集成 `cancelReminder`**：删除事项时清除定时器，避免幽灵提醒
- **`wrappedAddTodo` 整合解析与调度**：自然语言解析 → 同步 datetime-local → addTodo(remindAt) → scheduleReminder

### 新增模块 (Module)

- **第 11 节「提醒模块」IIFE**（script.js 末尾）：独立闭包封装，对外暴露 `window.reminderModule` 接口
  - `parse(text)`：自然语言解析提醒时间
  - `schedule(todo)` / `scheduleAll()` / `cancel(id)`：调度管理
  - `checkMissed()`：漏检补触发
  - `trigger(todo)`：完整触发反馈链路
  - `playSound()` / `unlockAudio()`：Web Audio 提示音
  - `formatToLocalInputValue(date)`：datetime-local 格式转换

### 已知限制 (Known Limitations)

- **浏览器完全关闭后无法触发提醒**：纯前端无后台进程，setTimeout/setInterval/AudioContext 全部失效；通过 UI 提示条明确告知用户保持页面打开
- **未首次交互前无法播放音效**：浏览器自动播放策略要求 AudioContext 在用户首次交互后才能 resume；首次交互前到点仍会触发视觉反馈（高亮、抖动、气泡），只是无声音
- **长时间后台标签页可能延迟**：部分浏览器对后台标签页定时器降频（最小 1 分钟）；通过 visibilitychange + 60s 兜底确保最迟 1 分钟内补触发
- **跨设备不同步**：localStorage 仅限当前浏览器当前设备；要跨设备需后端，超出项目约束

### 验证 (Verified)

- ✅ 输入「8:00 吃饭」→ 文本框变「吃饭」，datetime-local 显示今天 08:00
- ✅ 输入「8月15日 8:00 开会」→ 解析为当年 8 月 15 日 08:00
- ✅ 设置 30 秒后提醒 → 到点播放「叮咚」声 + 红框抖动 + 史迪奇弹气泡
- ✅ reminded = true 写入 localStorage，刷新后不再响
- ✅ 到点前删除/完成事项 → 不触发提醒
- ✅ 切后台再切回 → 漏掉的提醒补触发
- ✅ 徽章按紧迫度变色（灰/紫/橙/红）
- ✅ 老版本 sessionStorage 数据自动迁移到 localStorage
- ✅ 现有收纳、桌宠、GIF 轮播功能无回归

### 核心文件

- `index.html`：输入区新增 `datetime-local` + 列表区上方提示条
- `script.js`：存储升级 localStorage 含迁移；`addTodo` 扩展接受 `remindAt`；`createTodoElement`/`updateItemState` 增加徽章；`toggleTodo`/`deleteTodo` 集成 `cancelReminder`；`wrappedAddTodo` 整合解析+调度；新增第 11 节提醒模块 IIFE
- `style.css`：新增 4 个 CSS 变量（`--reminder-far/soon/urgent/overdue`）；`#remindAtInput` 样式；`.reminder-badge` + 4 种状态变体；`.todo-item.reminding` 抖动动画；`.todo-item.reminded::before` 铃铛；`.reminder-notice` 提示条；窄屏适配

---

## [v2.0.0] - 2026-08-18

### 修复 (Fixed) — 桌宠图片路径 404

- **修正 GIF 文件名**：发现 img 文件夹实际文件名为 `史迪奇1.gif`~`史迪奇6.gif`（共 6 张），此前代码引用的 `史迪奇.gif` 与 `线条小狗.gif` 均不存在，导致初始加载与轮播部分图片 404。
  - `index.html`：`<img>` 的 `src` 从 `img/史迪奇.gif` 改为 `img/史迪奇1.gif`
  - `script.js`：`PET_GIFS` 数组改为 6 张实际存在的 gif（`史迪奇1.gif`~`史迪奇6.gif`），移除不存在的两条

### 优化 (Optimized) — 桌宠边界融入

- **边缘羽化（mask）**：为 `.pet-img` 增加径向 `mask` 渐变（`radial-gradient(ellipse 97% 97% at 50% 48%, #000 80%, rgba(0,0,0,0.55) 90%, transparent 100%)`），让 GIF 图片四周自然淡出，消除硬矩形边界，桌宠自然融入页面背景。
- **柔和双层投影**：将原来的单层 `drop-shadow` 改为双层——底层大范围漫射（`0 10px 14px rgba(0,0,0,0.22)`）+ 顶层近距离接触（`0 3px 4px rgba(0,0,0,0.18)`），让桌宠立体地"浮"在页面上而非贴片。
- **放大平滑**：`image-rendering: auto`，弱化 90×90 原图放大到 140px 的像素感。
- **统一过渡**：`transition` 增加 `opacity 0.3s ease`（配合轮播淡入淡出），由 CSS 统一管理，避免 JS inline 样式覆盖 transform 动画。

### 变更 (Changed)

- **`switchToNextGif()`**：移除轮播切换时的 `petImg.style.transition = 'opacity 0.3s ease'` inline 设置，改由 CSS 的 `transition` 统一管理 opacity 与 transform，避免覆盖情绪/拖拽的 transform 动画。

### 验证 (Verified)

- ✅ 桌宠初始显示 `img/史迪奇1.gif`，无 404
- ✅ 轮播在 6 张 gif 间切换，均正常加载
- ✅ 图片四周边缘自然淡出，无明显硬矩形边界
- ✅ 桌宠有柔和投影，立体浮于页面
- ✅ 切换时淡入淡出正常，控制台无报错

### 核心文件

- `index.html`：`<img>` 的 `src` 改为 `img/史迪奇1.gif`
- `script.js`：`PET_GIFS` 改为 6 张实际文件名；`switchToNextGif` 移除 inline transition
- `style.css`：`.pet-img` 增加径向 mask、双层 drop-shadow、`image-rendering`、opacity transition

---

## [v1.9.0] - 2026-08-18

### 新增 (Added) — 桌宠 GIF 轮播

- **桌宠图片改为 img 文件夹下的 GIF 动图**：将 `<img>` 的 `src` 从根目录的 `史迪奇.gif` 改为 `img/史迪奇.gif`，图片资源统一收纳到 `img/` 文件夹。
- **3-5 秒随机轮播切换**：桌宠每 3-5 秒（`3000 + Math.random() * 2000` ms）随机切换一张 GIF 动图，共 7 张参与轮播：
  - `img/史迪奇.gif`、`img/史迪奇2.gif`、`img/史迪奇3.gif`、`img/史迪奇4.gif`、`img/史迪奇5.gif`、`img/史迪奇6.gif`、`img/线条小狗.gif`
- **淡入淡出切换**：切换时先淡出（0.3s）再淡入（0.3s），避免直接更换 `src` 导致的闪白突兀。
- **预加载机制**：使用 `new Image()` 预加载下一张 GIF，`onload` 后才更换 `src`，确保切换瞬间图片已就绪。
- **不重复切换**：随机选下一张时排除当前下标，保证每次切换都有视觉变化。

### 新增逻辑 (Logic)

- **`PET_GIFS` 常量数组**：img 文件夹下 7 张 GIF 的路径列表。
- **`switchToNextGif()`**：随机选择不同于当前的 GIF，预加载 + 淡入淡出切换。
- **`scheduleNextGif()`**：以 3-5 秒随机间隔递归调度下一次切换（仿 `scheduleNextMove` 模式）。
- **`startGifRotation()` / `stopGifRotation()`**：轮播启停控制，管理 `gifRotationTimer` 定时器。

### 变更 (Changed) — 生命周期集成

- **`hidePet()`**：隐藏桌宠时调用 `stopGifRotation()` 停止轮播。
- **恢复按钮点击**：恢复桌宠时调用 `startGifRotation()` 重启轮播。
- **`visibilitychange` 事件**：页面不可见时停止轮播节省资源，恢复可见时重启。
- **启动区**：页面加载后调用 `startGifRotation()` 启动轮播。

### 验证 (Verified)

- ✅ 桌宠初始显示 `img/史迪奇.gif`，路径正确
- ✅ 等待后 src 在 7 张 gif 之间随机切换
- ✅ 切换间隔约 3-5 秒
- ✅ 切换时有淡入淡出效果，无闪白
- ✅ 隐藏/恢复桌宠时轮播正确停止/重启
- ✅ 页面切到后台时轮播停止，回到前台时恢复

### 核心文件

- `index.html`：`<img>` 的 `src` 改为 `img/史迪奇.gif`
- `script.js`：新增 `PET_GIFS` 数组、`switchToNextGif`/`scheduleNextGif`/`startGifRotation`/`stopGifRotation` 函数；在 `hidePet`/恢复按钮/`visibilitychange`/启动区集成启停调用

---

## [v1.8.0] - 2026-08-18

### 变更 (Changed) — 视觉与交互优化

- **桌宠图片改为 GIF 动图**：将 `<img>` 的 `src` 从 `史迪奇.png`（静态图）改为 `史迪奇.gif`（动图），让史迪奇在网页上呈现动态效果。
- **收纳按钮（收拉框）对比度与层次感优化**：
  - 加深背景色（`rgba(102,126,234,0.12)`）、加粗边框至 `1.5px` 并提升边框透明度
  - 新增 `box-shadow` 投影，hover/active 状态分别加深阴影，增强立体层次感
  - 未完成收纳按钮（`.collapse-btn-pending`）使用深蓝绿色 `#1e6e6f`，与已完成按钮的紫色形成明显区分
  - 数字部分用 `<strong>` 包裹并加白底圆角，强化视觉焦点

### 重构 (Refactored) — toast 系统改为史迪奇对话气泡

- **取消独立 toast 提示条系统**：移除页面顶部固定的 `pet-toast-container` / `pet-toast` DOM 与对应 CSS 样式，所有待办操作反馈统一通过史迪奇自身的对话气泡（`pet-bubble`）展示。
- **`showBubble(customMsg)` 扩展**：支持传入自定义文案；自定义文案显示时长 4 秒（随机文案 3 秒）。
- **`showPetToast(text, type)` 重写**：复用对话气泡，按操作类型切换气泡边框/背景颜色 class（`type-success`/`type-info`/`type-warning`/`type-error`），并触发史迪奇弹跳动效；气泡隐藏后自动清理类型 class。
- **`window.petMood.toast` 别名**：指向 `showPetToast`，保持调用接口不变。

### 新增样式 (CSS)

- `.pet-bubble.type-success`：青绿色边框 + 淡青渐变背景（完成操作）
- `.pet-bubble.type-info`：蓝紫色边框 + 淡蓝渐变背景（信息提示）
- `.pet-bubble.type-warning`：橙色边框 + 淡橙渐变背景（删除已完成等警告）
- `.pet-bubble.type-error`：红色边框 + 淡红渐变背景（错误）

### 移除 (Removed)

- 移除独立 toast 系统相关代码：`ensureToastContainer` / `showPetToast` 旧实现（顶部提示条）、`.pet-toast-container` / `.pet-toast` / `.pet-toast-*` 样式规则。

### 验证 (Verified)

- ✅ 桌宠图片为 `史迪奇.gif`，GIF 文件存在于项目目录
- ✅ 收纳按钮具备明显边框、阴影与层次感，未完成/已完成按钮颜色区分清晰
- ✅ 添加待办时史迪奇弹出绿色边框气泡（如「又多了一项待办，加油！」）
- ✅ 完成待办时弹出绿色庆祝气泡（如「太棒了！又完成一项！」）
- ✅ 删除待办时根据状态弹出 info/warning 气泡
- ✅ 页面顶部无独立 toast 提示条残留

### 核心文件

- `index.html`：`<img>` 的 `src` 改为 `史迪奇.gif`
- `script.js`：扩展 `showBubble`、重写 `showPetToast`、`petMood.toast` 别名到 `showPetToast`；移除独立 toast 系统代码
- `style.css`：优化 `.collapse-btn` 系列样式；新增 `.pet-bubble.type-*` 样式；移除 `.pet-toast-*` 样式

---

## [v1.7.0] - 2026-08-18

### 新增 (Added) — 桌宠交互增强

- **点击空白召唤桌宠**：点击页面任意空白区域，史迪奇会自动走到点击位置。
- **桌宠自动避障**：史迪奇移动时会自动避开功能按钮（添加按钮、输入框、待办项、收纳按钮、链接等），通过 `resolveCollision()` 计算偏移，8 方向尝试找到不冲突的位置。
- **待办操作 Toast 反馈**：
  - 添加待办 → 显示「又多了一项待办，加油！」等成功 toast（绿色）
  - 完成待办 → 显示「干得漂亮！继续加油！」等庆祝 toast（绿色）
  - 取消完成 → 显示「取消完成？没关系，继续加油！」信息 toast（蓝色）
  - 删除已完成 → 显示「已完成的也删了？想清楚哦~」警告 toast（橙色）
  - 删除未完成 → 显示「删除了待办，需不需要重新加回来？」信息 toast（蓝色）

### 变更 (Changed)

- **`moveTo()` 函数增强**：在移动前调用 `resolveCollision()` 检查目标位置是否与按钮重叠，重叠时尝试 8 方向偏移找到不冲突位置。
- **`createTodoElement()` 事件绑定改造**：checkbox 和删除按钮的事件监听改为优先调用 `window.wrappedToggleTodo` / `window.wrappedDeleteTodo`（带情绪+toast 联动），不存在时回退到原始函数。
- **`addBtn` 事件重新绑定**：使用 `removeEventListener` 移除原始 `addTodo` 监听器，改用 `wrappedAddTodo` 触发情绪和 toast。
- **回车键拦截**：在 `todoInput` 上添加 capture 阶段的 keydown 监听器，拦截 Enter 键并调用 `wrappedAddTodo`，避免重复触发原始 `addTodo`。

### 新增样式 (CSS)

- `.pet-toast-container`：固定在页面顶部居中的 toast 容器，垂直堆叠多条 toast。
- `.pet-toast`：圆角胶囊样式 toast，带毛玻璃效果和入场动画（淡入+回弹缩放）。
- `.pet-toast-success` / `-info` / `-warning` / `-error`：四种类型颜色变体（绿/蓝/橙/红渐变）。

### 新增 API

- `window.petMood.toast(text, type)`：显示一条文字 toast，参数 `type` 可选 `success`/`info`/`warning`/`error`。
- `window.wrappedAddTodo` / `wrappedToggleTodo` / `wrappedDeleteTodo`：包装版本的待办操作函数，调用后会触发情绪和 toast 反馈。

### 验证 (Verified)

- ✅ 点击空白处，史迪奇移动到点击位置（已测试）
- ✅ 史迪奇与按钮无重叠（`pet.right(302) < btn.left(486)` = true）
- ✅ 拖拽史迪奇到任意位置，位置正确更新
- ✅ 添加待办时显示 toast「又多了一项待办，加油！」
- ✅ 完成待办时显示 toast「干得漂亮！继续加油！」

### 技术说明

- **避障算法**：`getAvoidRects()` 收集所有按钮/输入框/待办项的视口矩形，`isPositionColliding()` 检测碰撞，`resolveCollision()` 在 8 个方向尝试偏移（80~100px）找到不冲突的位置。
- **Toast 系统**：独立于 `petBubble` 对话气泡，使用 `petToastContainer` 容器堆叠显示，2.5 秒后自动淡出移除。
- **事件重绑定**：因 `addEventListener('click', addTodo)` 已绑定原始函数引用，直接重新赋值 `addTodo` 不影响已绑定的监听器，需用 `removeEventListener` + `addEventListener` 替换。

### 核心文件

- `script.js`：新增 `getAvoidRects`/`isPositionColliding`/`resolveCollision`/`onDocumentClick`/`showPetToast`/`ensureToastContainer` 函数；新增 `wrappedAddTodo`/`wrappedToggleTodo`/`wrappedDeleteTodo` 包装函数；修改 `moveTo`/`createTodoElement`。
- `style.css`：新增 `.pet-toast-container`/`.pet-toast`/`.pet-toast-*` 样式。

---

## [v1.6.0] - 2026-08-18

### 新增 (Added) — 未完成项收纳功能

- **未完成项自动收纳**：当未完成（待办中）事项超过 5 条时，超出部分自动收纳隐藏，避免列表过长影响阅读。
- **收纳按钮文案区分**：
  - 未完成收纳按钮显示「还有 N 项待办 ▼」（蓝绿色 `#2c7a7b`）
  - 已完成收纳按钮沿用「还有 N 项已完成待办 ▼」（紫色 `--accent-color`）
  - 两类按钮颜色明显区分，便于用户快速识别
- **共用展开开关**：两类收纳共用一个 `isExpanded` 状态，点击任一收纳按钮都可同时展开/收起所有被收纳项。

### 变更 (Changed)

- **`render()` 函数重构**：
  - 渲染顺序改为「未完成可见项 → 未完成收纳按钮 → 已完成可见项 → 已完成收纳按钮 → 收纳容器」
  - 收纳按钮位置计算需考虑前一个按钮的占位偏移
  - 展开时收纳容器同时显示未完成和已完成的被收纳项
- **新增常量**：
  - `VISIBLE_PENDING_LIMIT = 5`：未完成项收纳阈值（待办是主要关注内容，阈值略高于已完成项的 3 条）

### 新增样式 (CSS)

- 新增 `.collapse-btn-pending` 样式：未完成收纳按钮变体，使用蓝绿色调区分。
- 新增 `.collapse-btn-pending strong` 样式：未完成收纳按钮的数字强调色。
- 新增 `.collapse-btn strong` 样式：已完成收纳按钮的数字强调色（紫色）。

### 验证 (Verified)

- ✅ 添加 6 条以上未完成事项后，超出 5 条的部分被收纳
- ✅ 未完成收纳按钮正确显示「还有 N 项待办」
- ✅ 点击未完成收纳按钮可展开所有被收纳项（包括已完成的）
- ✅ 展开后按钮文案变为「收起 ▲」
- ✅ 未完成和已完成收纳按钮颜色有明显区分

### 技术说明

- **核心文件**：
  - `script.js`：新增 `VISIBLE_PENDING_LIMIT` 常量；重写 `render()` 函数的收纳逻辑
  - `style.css`：新增 `.collapse-btn-pending` 系列样式
- **关键 API**：`Array.prototype.slice`、`Array.prototype.concat`、`insertBefore`
- **配置项**：修改 `VISIBLE_PENDING_LIMIT` 可调整未完成项收纳阈值

---

## [v1.5.0] - 2026-08-17

### 新增 (Added)

- 新增 **史迪奇（Stitch）装饰动画**：
  - 在页面左侧空白处使用纯 CSS 绘制史迪奇形象，包括蓝色头部、大圆耳朵、大眼睛、鼻子、带牙齿的嘴、粉红色肚皮和手臂。
  - 整体形象位于左下角（`position: fixed; left: 48px; bottom: 48px`），不影响主内容交互（`pointer-events: none`）。

### 新增动画 (Animations)

- **整体浮动**（`stitch-float`）：3.2s 循环上下浮动 14px，营造悬浮感。
- **眨眼**（`blink`）：4.5s 循环，每周期眨眼一次，眼睛垂直缩放至 10%。
- **耳朵摆动**（`ear-wiggle-left/right`）：2.8s 循环左右耳交错摆动 ±20°。
- **手臂摆动**（`arm-swing-left/right`）：2.4s 循环左右手交错摆动 ±15°。
- **影子呼吸**（`shadow-pulse`）：3.2s 与浮动同步，影子随身体上下浮动放大缩小，模拟立体感。

### 响应式 (Responsive)

- 新增 `@media (max-width: 880px)` 媒体查询：屏幕宽度小于 880px 时自动隐藏史迪奇，避免在小屏幕设备上遮挡主内容。
- 主内容区 `max-width: 520px` 居中，史迪奇所需左侧空间约 200px，仅在屏幕宽度 ≥ 880px 时显示。

### 视觉细节 (Visual Details)

- **配色**：身体使用蓝色渐变（`#5ba0e0 → #3e7bc0`），肚皮使用粉色渐变（`#ffd9dc → #f0b8c0`），与背景渐变形成明显对比，符合对比度要求。
- **立体感**：通过 `inset` 阴影模拟身体曲面，`box-shadow` 提供落地阴影。
- **眼睛**：白色眼球 + 黑色描边 + 黑色瞳孔 + 白色高光，符合史迪奇标志性大眼睛形象。
- **牙齿**：使用 `linear-gradient` 绘制 4 颗白色牙齿分隔，模拟史迪奇特色牙齿。

### 验证 (Verified)

- ✅ 史迪奇正常渲染：容器位置 `left≈48px, top≈270px`，尺寸 `150×200px`
- ✅ 所有动画属性生效：浮动、眨眼、耳朵摆动、手臂摆动、影子呼吸
- ✅ 响应式隐藏：屏幕 < 880px 时自动隐藏

### 技术说明

- **核心文件**：
  - `index.html`：新增史迪奇 DOM 结构（第 13-34 行）
  - `style.css`：新增史迪奇样式与动画（第 336-592 行）
- **纯 CSS 实现**：无 JavaScript 依赖，无外部图片资源，性能开销低
- **可访问性**：使用 `aria-hidden="true"` 标记为装饰元素，避免屏幕阅读器误读

---

## [v1.3.0] - 2026-08-17

### 新增 (Added)

- 新增 **收纳功能**：
  - 当已完成项超过 3 条时，自动收纳超出部分，避免列表过长影响阅读体验。
  - 收纳时显示「还有 N 项已完成待办 ▼」提示按钮，明确告知用户收纳数量。
- 新增 **展开/收起功能**：
  - 点击收纳按钮可展开所有已完成项，按钮变为「收起 ▲」。
  - 再次点击可收起回收纳状态，恢复整洁的列表视图。
- 新增 **DOM 节点缓存机制**：
  - 使用 `Map` 缓存已创建的 `<li>` 节点，避免每次操作都重建 DOM。
  - 节点复用确保操作流畅无闪动，提升用户体验。

### 变更 (Changed)

- **`render()` 函数重构**：
  - 从「全量重建 DOM」改为「增量更新 DOM 节点」模式。
  - 使用 `nodeCache` 缓存节点，通过 `insertBefore` 移动节点位置，而非 `innerHTML = ''` 清空重建。
  - 勾选/取消勾选时仅切换 `classList` 和 `checkbox.checked`，不重建 DOM 结构。
- **新增配置常量**：
  - `VISIBLE_COMPLETED_LIMIT = 3`：收纳阈值，超过此数量的已完成项自动收纳。
  - `isExpanded`：收纳展开状态标志，控制收纳区的显示/隐藏。

### 新增样式 (CSS)

- 新增 `.collapse-btn` 样式：收纳提示按钮，带虚线边框和淡紫色背景。
- 新增 `.collapse-btn.expanded` 样式：展开状态下箭头旋转 180°。
- 新增 `.collapsed-list` 样式：收纳容器，支持 flex 布局和显隐切换。
- 新增 `@keyframes slideDown` 动画：收纳区展开时的淡入下滑效果。

### 验证 (Verified)

- ✅ 收纳触发：勾选 4 条后自动收纳超出的 1 条
- ✅ 收纳数量显示：提示按钮正确显示收纳的条数
- ✅ 展开功能：点击收纳按钮可展开所有已完成项
- ✅ 收起功能：再次点击可恢复收纳状态
- ✅ 无闪动效果：勾选/取消勾选时节点复用，界面无闪动

### 技术说明

- **核心文件**：
  - `script.js`：`render()` 函数重写（第 58-188 行）、新增 `nodeCache` 缓存机制
  - `style.css`：新增收纳相关样式（第 278-334 行）
- **关键 API**：`Map`、`insertBefore`、`classList.toggle`
- **配置项**：修改 `VISIBLE_COMPLETED_LIMIT` 可调整收纳阈值

---

## [v1.2.0] - 2026-08-17

### 新增 (Added)

- 新增 **完成项自动沉底功能**：
  - 重写 `toggleTodo(id)`：勾选完成（`done: false → true`）时，将该事项从原位置移除并追加到数组末尾（已完成区末尾）。
  - 取消勾选（`done: true → false`）时，将该事项插入到「所有未完成事项之后、已完成事项之前」，保持未完成组按原添加顺序向上冒泡。
  - 排序基于数据数组本身，渲染由 `render()` 自然反映新顺序，无需额外 DOM 操作或滚动 API。
  - 列表新顺序会通过 `save()` 同步持久化到 `sessionStorage`，刷新后保持一致。
- 新增 **Playwright 测试截图保存**：
  - 运行测试时自动在项目根目录下创建 `screenshots/` 文件夹。
  - 每个关键测试步骤（初始、添加、勾选、取消勾选、删除、刷新、新标签页）均保存全页截图，文件名形如 `01_initial.png`。
  - 便于回归对比与问题排查。
- 新增 **Playwright 测试用例**：在原有 6 项基础上新增 2 项排序验证
  - `3.1 第二条完成项追加到已完成区末尾`：验证多个完成项按勾选顺序排列。
  - `3.2 取消勾选后冒泡到未完成区末尾`：验证取消勾选后事项插入未完成组末尾，未完成组保持原添加顺序。

### 变更 (Changed)

- **`toggleTodo` 逻辑重构**：从「单纯翻转 done + 重新渲染」改为「翻转 done + 数组重排 + 重新渲染」。
- **Playwright 测试断言更新**：原有用例的断言适配新的列表排序（勾选第 2 条后该事项移到末尾、删除第 1 条后剩余顺序更新等）。

### 移除 (Removed)

- 移除上一版本误加的 `scrollToBottom()` 辅助函数及其在 `addTodo`、`toggleTodo` 中的调用（基于对需求的错误理解）。

### 技术说明

- **核心文件**：`script.js`（第 137-184 行 `toggleTodo` 重写）、`verify_playwright.py`（截图保存 + 新增 2 项测试用例）
- **依赖 API**：`Array.prototype.filter`、`Array.prototype.findIndex`、`Array.prototype.splice`、`Array.prototype.push`
- **截图目录**：`<项目根>/screenshots/`（运行测试时自动创建）

---

## [v1.1.0] - 2026-08-17

### 新增 (Added)

- 引入 **CSS 变量设计令牌体系**：在 `:root` 中定义了颜色、间距、圆角、过渡等 20+ 变量，实现样式统一管理，便于后续主题切换与维护。
- 新增 **玻璃拟态（Glassmorphism）效果**：输入区容器 `.input-area` 和列表项 `.todo-item` 使用半透明背景 + `backdrop-filter: blur(12px)` 实现磨砂玻璃质感。
- 新增 **自定义复选框样式**：通过 `appearance: none` 原生复选框，使用 CSS 绘制圆角方形样式，勾选时显示渐变紫色背景 + 白色对勾。
- 新增 **列表项入场动画**：`@keyframes slideIn` 实现事项添加时的淡入 + 上移动画。
- 新增 **空状态提示**：使用 `#todoList:empty::before` 伪元素显示「暂无待办事项，添加一个开始吧 ✨」引导文案。
- 新增 **微动效交互**：按钮 hover 上浮、列表项 hover 阴影加深、删除按钮 hover 缩放变色。

### 变更 (Changed)

- **页面背景**：从纯色改为 135° 线性渐变（紫 → 蓝），并设置 `background-attachment: fixed` 避免滚动时背景偏移。
- **字体栈**：统一使用跨平台现代字体栈（Apple System / Segoe UI / PingFang SC / Microsoft YaHei），启用 `-webkit-font-smoothing` 抗锯齿。
- **标题样式**：优化字间距 `-0.5px`，添加文字阴影增强层次感。
- **输入框样式**：圆角 12px，聚焦时边框变色 + 外发光效果。
- **添加按钮**：改为渐变紫色背景 + 投影，hover 时上浮，active 时回弹。
- **删除按钮**：默认低透明度红色文字，hover 时变为实心红色按钮 + 缩放效果。
- **已完成状态**：列表项整体透明度降至 70%，文字添加删除线并置灰。

### 优化 (Optimized)

- **数据驱动视图架构**：所有 UI 变更通过修改 `todos` 数据数组 + 调用 `render()` 重绘实现，视图与数据严格同步。
- **事件委托优化**：每个列表项的复选框和删除按钮事件直接绑定在新建元素上，通过 `todo.id` 精准定位，避免数组下标错位问题。
- **输入体验**：支持回车键快速添加，空内容时输入框边框闪红提示，添加后自动清空并聚焦。

---

## [v1.1.1] - 2026-08-17

### 变更 (Changed) — 对比度优化

- **背景渐变色加深**：
  - `--bg-gradient-start`: `#e0c3fc` → `#c9a0dc`（深紫）
  - `--bg-gradient-end`: `#8ec5fc` → `#5fa8e6`（深蓝）
- **卡片/容器不透明度提升**：
  - `--card-bg`: `rgba(255,255,255,0.75)` → `rgba(255,255,255,0.9)`
  - `--input-bg`: `rgba(255,255,255,0.85)` → `rgba(255,255,255,0.95)`
  - `--card-border`: `rgba(255,255,255,0.5)` → `rgba(255,255,255,0.7)`
- **文字颜色加深**：
  - `--text-secondary`: `#666` → `#555`
  - `--text-muted`: `#b0b0c0` → `#8888a0`
- **边框颜色加深**：
  - `--border-color`: `rgba(0,0,0,0.08)` → `rgba(0,0,0,0.15)`
- **卡片阴影加强**：
  - `--card-shadow` 透明度从 `0.15` 提升至 `0.2`
- **标题阴影优化**：
  - 从白色阴影 `rgba(255,255,255,0.5)` 改为深色阴影 `rgba(0,0,0,0.15)`，在加深后的背景上对比更清晰
- **删除按钮可见度提升**：
  - 背景透明度 `0.1` → `0.15`
  - 整体透明度 `0.7` → `0.9`

### 验证 (Verified)

- ✅ 视觉对比度提升：背景更深、卡片更实、文字更清晰
- ✅ Playwright 自动化测试 6/6 项全部通过
  1. 初始状态为空
  2. 添加 3 条事项
  3. 标记完成（删除线 + 置灰）
  4. 删除第 1 条
  5. 刷新后数据完整保留
  6. session 语义（新标签页数据清空）

---

## [v1.0.0] - 2026-08-17

### 新增 (Added) — 初始版本

- **HTML 结构** (`index.html`)：语义化标签布局，包含标题区、输入区（文本框 + 添加按钮）、列表区（`<ul>` 容器）。
- **核心交互逻辑** (`script.js`)：
  - 添加待办事项（支持点击按钮 + 回车键）
  - 标记完成/取消完成（复选框切换）
  - 删除待办事项（按 ID 精准定位）
  - `sessionStorage` 持久化（页面刷新数据不丢失）
- **基础样式**：简单的白色背景 + 黑色文字 + 基础间距布局。
- **Playwright 测试脚本** (`verify_playwright.py`)：覆盖 6 项核心功能的端到端自动化验证。
- **任务拆解文档** (`Task.md`)：将需求转化为 6 个可执行任务。
- **部署指南** (`deployment_guide.md`)：包含环境要求、本地运行、生产部署、自动化测试等内容。
