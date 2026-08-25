# 更新日志 (Changelog)

> 好的工具，值得你慢慢发现。
>
> 初遇时，你或许察觉不到它的好，只是寻常。
>
> 但某一天，当你真正需要它——
>
> 你会发现它始终在那里，安静、细腻、可靠。
>
> 像一位沉默的爱人，不言不语，却从未离开。
>
> 你拥有它时，不曾察觉什么特别；
>
> 直到失去，才恍然明白——
>
> 那正是你曾拥有过的，最好的温柔。

所有与待办事项清单应用相关的显著变更均记录在此文件中。

---

## [v2.22.0] - 2026-08-25

### 修复 (Fixed)

1. **安装脚本优化**
   - 使用 `customCheckAppRunning` 宏覆盖默认的应用运行检查
   - 修复安装时"无法关闭应用"的问题（托盘功能拦截关闭消息导致）
   - 文件：`electron/installer.nsh`

2. **便签模式空状态优化**
   - 便签模式下空状态显示更合理："便签模式 · 轻量提醒"
   - 提示文案动态读取用户设置的快捷键，避免写死 `Alt+G`
   - 隐藏示例按钮，缩小图标和内边距，更紧凑
   - 文件：`src/js/02-render.js`、`src/css/sticky.css`

3. **托盘菜单简化**
   - 移除托盘菜单中的「🗒 便签模式」选项
   - 清理相关的菜单状态同步代码
   - 文件：`electron/main.js`

### 优化 (Improved) — 日报功能与 UI

1. **日报 UI 重设计**
   - 去掉进度圆环，改用大数字完成率显示，更简洁直观
   - Apple 风格毛玻璃弹窗，干净清爽
   - 结语文案优化，更自然专业
   - 文件：`src/js/04-pet.js`、`src/css/report.css`

2. **日报数据修复**
   - `01-data.js` 新增 `window.getAllTodos()` 和 `window.getTodoCount()` 暴露数据
   - 修复日报显示 0% 的问题
   - 文件：`src/js/01-data.js`

3. **应用图标更新**
   - 使用 `electron/icon.png` 作为应用图标
   - 简化 `main.js` 中 `getIconPath()` 逻辑，移除旧 .ico 和 GIF 回退
   - 删除 `electron/icon.ico`
   - 文件：`package.json`、`electron/main.js`

4. **操作指南返回按钮修复**
   - 返回按钮从 `<a>` 改为 `<button>`，通过 Electron API 加载主页
   - 新增 `loadMainPage` API 和 `load-main-page` IPC 处理
   - 修复按钮点击区域被 `-webkit-app-region: drag` 拦截的问题
   - 文件：`src/user_guide.html`、`electron/preload.js`、`electron/main.js`

5. **Header 标题区域优化**
   - 增加 header 内边距（24px 上 / 20px 下）
   - 标题与副标题间距增加到 14px
   - 副标题添加 8px 左间距，与主标题保持呼吸感
   - 文件：`src/css/base.css`

### 新增 (Added) — 史迪仔桌面提醒功能

1. **独立提醒窗口**
   - 提醒触发时弹出独立透明窗口（`src/reminder.html`）
   - 支持稍后提醒、完成待办、关闭窗口操作
   - 文件：`src/reminder.html`、`src/js/reminder-window.js`

2. **提醒 API（v2.22.0）**
   - `setReminderWindow`：设置提醒定时器
   - `cancelReminderWindow`：取消提醒定时器
   - `snoozeReminder`：稍后提醒（延迟 N 分钟）
   - `closeReminder`：关闭提醒窗口
   - `completeTodoFromReminder`：从提醒窗口完成待办
   - 文件：`electron/preload.js`、`electron/main.js`

3. **农历数据外置**
   - 农历数据从 `06-reminder.js` 外置到 `src/js/lunar-data.js`
   - 减少主文件体积，提高加载效率
   - 文件：`src/js/lunar-data.js`、`src/js/lunar-data.json`

### 核心文件

- `src/js/01-data.js`：新增 `getAllTodos`、`getTodoCount` 全局访问器
- `src/js/04-pet.js`：日报 UI 重写，Apple 风格简洁设计
- `src/js/06-reminder.js`：农历数据外置、独立提醒窗口集成
- `src/js/reminder-window.js`：独立提醒窗口逻辑（新文件）
- `src/reminder.html`：独立提醒窗口页面（新文件）
- `src/css/report.css`：日报弹窗样式重写
- `src/css/base.css`：Header 标题间距优化
- `src/user_guide.html`：返回按钮修复
- `electron/main.js`：图标逻辑简化、新增 `load-main-page` IPC、提醒窗口 IPC
- `electron/preload.js`：新增 `loadMainPage` API、提醒相关 API
- `package.json`：图标路径更新

---

## [v2.21.0] - 2026-08-24

### 优化 (Improved) — 标题设计与视觉层次

1. **标题简化**
   - 移除标题中的 ✅ 和 📌 emoji，改为纯文字 `ToDoList`
   - 更干净、更专业的视觉呈现
   - 文件：`src/index.html`、`src/js/07-integration.js`

2. **新增副标题**
   - 标题下方新增 `高效待办 · 轻松管理` 副标题
   - Apple 风格淡色说明文字（#8E8E93）
   - 便签模式下自动隐藏副标题，保持紧凑
   - 文件：`src/index.html`、`src/style.css`（`.header-subtitle`）

3. **便签模式进度胶囊**
   - 标题旁新增渐变进度胶囊，显示完成百分比
   - 绿色渐变填充（#34C759），固定宽度不变形
   - 进度变化时 0.3s 平滑过渡动画
   - 文件：`src/style.css`（`.sticky-progress`）、`src/js/07-integration.js`（`updateStickyTitle`）

4. **标题区域呼吸感优化**
   - 增加标题栏内边距（20px 上 / 18px 下）
   - 标题与副标题间距从 4px 增加到 8px
   - 胶囊内边距微调，整体更舒展
   - 文件：`src/style.css`

### 核心文件

- `src/index.html`：标题结构简化、新增副标题元素
- `src/style.css`：副标题样式、进度胶囊、标题间距优化
- `src/js/07-integration.js`：`updateStickyTitle` 函数重构，支持进度胶囊

### 修复 (Fixed) — 设置页面滚动条未隐藏

- 设置页面为独立窗口，仅加载 `settings.css`，不加载主页面 `style.css`，导致全局滚动条隐藏规则未生效
- 在 `src/settings.css` 中补全滚动条隐藏规则（Firefox / IE / Chromium 内核），滚动功能保持不变
- 文件：`src/settings.css`

---

## [v2.18.0] - 2026-08-24

### 新增 (Added) — 桌面端设置功能

1. **设置窗口**
   - 新增独立设置窗口，从托盘菜单「⚙️ 设置」进入
   - 包含常规、快捷键、更新、关于四个区块
   - 文件：`src/settings.html`、`src/settings.css`、`src/settings.js`

2. **开机自启动**
   - 开关控制是否开机自动启动应用
   - 设置持久化到 `%APPDATA%/ToDoList/settings.json`
   - 文件：`electron/main.js`（`applySavedSettings`、`set-auto-start` IPC）

3. **快捷键自定义**
   - 支持修改「显示/隐藏窗口」和「切换便签模式」快捷键
   - 默认：`Alt+F`（显示/隐藏）、`Alt+G`（便签模式）
   - 修改后立即生效，重启后保持
   - 冲突检测：被占用时提示并恢复原值
   - 文件：`electron/main.js`（`updateShortcut`、`registerGlobalShortcuts`）

4. **检查更新**
   - 通过 GitHub API 检查最新版本
   - 有新版本时提示并跳转 Releases 页面
   - 网络异常友好提示（超时、断网等）
   - 文件：`src/settings.js`（`initUpdateSection`、`compareVersions`）

### 核心文件

- `electron/main.js`：设置窗口创建、快捷键管理、开机自启动、配置文件读写
- `electron/preload.js`：暴露 `setAutoStart`、`registerShortcut`、`openExternal` API
- `src/settings.html`：设置页面结构
- `src/settings.js`：设置页面逻辑（localStorage、快捷键捕获、检查更新）
- `src/settings.css`：设置页面样式

---

## [v2.20.0] - 2026-08-24

### 优化 (Improved) — 无边框窗口与交互细节

1. **隐藏原生窗口标题栏**
   - 主窗口、设置窗口、便签模式均隐藏 Windows 原生标题栏
   - 页面 header 作为可拖拽区域（`-webkit-app-region: drag`）
   - 操作按钮区域排除拖拽（`-webkit-app-region: no-drag`）
   - 文件：`electron/main.js`（`titleBarStyle: 'hidden'`）、`src/style.css`

2. **全局滚动条隐藏**
   - 所有页面（主页面、设置页面、便签模式）统一隐藏滚动条
   - 保留鼠标滚轮/触摸板滚动功能
   - 覆盖 Firefox/IE/Edge/Chrome/Safari 全平台
   - 文件：`src/style.css`（`html`/`body`/`::-webkit-scrollbar`）、`.list-area` 滚动条隐藏

3. **设置窗口风格统一**
   - 背景改为 iOS 系统灰 `#F2F2F7`，与主页面一致
   - 文字色阶对齐 Apple 标准（`#1C1C1E` 主文字 / `#8E8E93` 次要文字）
   - 强调色统一为 Apple 蓝 `#007AFF`，开关激活态 Apple 绿 `#34C759`
   - 文件：`src/settings.css`、`electron/main.js`（`backgroundColor: '#F2F2F7'`）

4. **版本号动态读取**
   - 检查更新的当前版本从 `package.json` 自动读取，不再硬编码
   - 新增 `getVersion` preload API 和 `get-app-version` IPC 处理
   - 发版时只需修改 `package.json` 的 `version` 字段
   - 文件：`electron/preload.js`、`electron/main.js`、`src/settings.js`

### 修复 (Fixed)

1. **便签模式滚动修复**
   - 内容超出 600px 时自动启用列表区域滚动
   - 修复 `is-overflow` 类从未被 JavaScript 添加的问题
   - 文件：`src/js/02-render.js`（`adjustStickyWindowHeight` 动态添加/移除 `is-overflow`）

2. **开机自启动「启动时隐藏」修复**
   - `applySavedSettings` 和 `set-auto-start` IPC 现在正确读取 `startHidden` 设置
   - 文件：`electron/main.js`

3. **删除按钮悬停不显示详细 tooltip**
   - 全局追踪 `activeTooltips` 数组
   - 鼠标悬停删除按钮、复选框等操作元素时隐藏 tooltip，避免干扰
   - 文件：`src/js/02-render.js`

### 变更 (Changed)

1. **删除待办不再弹出确认窗口**
   - 点击删除按钮直接执行删除动画
   - 保留桌宠表情反馈和 toast 提示
   - 文件：`src/js/07-integration.js`

---

## [v2.19.0] - 2026-08-24

### 优化 (Improved) — Apple 极简白昼 UI 风格

1. **设计令牌重构**
   - 背景改为 iOS 系统灰 #F2F2F7
   - 卡片纯白 + 微妙阴影（0 2px 8px）
   - 文字色阶：#1C1C1E / #3A3A3C / #8E8E93
   - 强调色改为 iOS 系统蓝 #007AFF
   - 圆角精致化（8-12px）

2. **组件 Apple 风格化**
   - 标题栏：纯色文字 + 极淡背景分隔线
   - 输入框：系统灰背景 + 蓝色聚焦光环
   - 按钮：纯色扁平（替代渐变）+ 轻触缩放反馈
   - 复选框：圆形（替代圆角方形）
   - 开关：iOS 风格（绿色激活态）
   - 徽章：低饱和色块 + 微妙动画
   - 时间轴：Apple 蓝→红渐变
   - Tooltip：深色毛玻璃效果
   - 滚动条：更细更淡

3. **动画曲线**
   - 统一使用 Apple 标准缓动 cubic-bezier(0.42, 0, 0.58, 1)

### 核心文件

- `src/style.css`：全面重构 CSS 变量与组件样式

---

## [v2.18.0] - 2026-08-24

### 新增 (Added) — 结束时间快捷预设

1. **快捷时间按钮**
   - 结束时间区域新增 +1小时、+2小时、明天、下周 快捷按钮
   - 基于开始时间自动计算结束时间，一键设置无需手动输入
   - 文件：`src/index.html`、`src/js/05-datetime.js`

### 优化 (Improved) — Tooltip 与浮层

1. **JS 动态 Tooltip 替代 CSS 伪元素**
   - 所有待办项的悬浮提示改用 JS 动态创建，挂载到 `<body>`
   - 使用 `position: fixed` 彻底解决 `overflow-y: auto` 容器裁剪问题
   - 智能定位：默认上方，空间不足自动切换下方，边界保护不超出视口
   - 文件：`src/js/02-render.js`（`attachTooltip()` 函数）、`src/style.css`（`.js-tooltip` 样式）

2. **日期选择器浮层可滚动**
   - 浮层添加 `max-height: 80vh` 和 `overflow-y: auto`
   - 内容超出视口时可滚动，避免按钮不可见
   - 文件：`src/style.css`

### 核心文件

- `src/index.html`：结束时间快捷预设按钮
- `src/style.css`：`.js-tooltip` 样式、浮层滚动
- `src/js/02-render.js`：`attachTooltip()` 通用 tooltip 函数、时间轴和待办项绑定
- `src/js/05-datetime.js`：`selectEndTimePreset()` 函数、预设按钮事件绑定

---

## [v2.17.0] - 2026-08-24

### 新增 (Added) — 全局快捷键

1. **Alt+F 显示/隐藏窗口**
   - 注册系统级全局快捷键 `Alt+F`，按下时切换主窗口的显示/隐藏
   - 即使窗口已隐藏到托盘，按下 Alt+F 也能快速呼出
   - 应用退出时自动注销快捷键，避免残留占用
   - 文件：`electron/main.js`

### 核心文件

- `electron/main.js`：引入 `globalShortcut`、注册 Alt+F 快捷键、退出时注销

---

## [v2.14.0] - 2026-08-24

### 新增 (Added) — 便签模式功能增强

1. **📌 便签模式指示器**
   - 进入便签模式后标题左侧显示 📌 图标，淡色标题栏背景区分普通模式
   - 文件：`src/index.html`、`src/style.css`、`src/js/07-integration.js`

2. **待办计数显示**
   - 展开状态显示 `(3项待办)`，折叠状态显示完成进度 `✓2/5`
   - 文件：`src/js/07-integration.js`（`updateStickyTitle()` 函数）

3. **双击 Esc 退出便签模式**
   - 400ms 内按两次 Esc 即可退出便签模式
   - 文件：`src/js/07-integration.js`、`electron/preload.js`、`electron/main.js`

4. **添加成功反馈**
   - 便签模式下添加事项时输入框绿色边框闪烁
   - 文件：`src/style.css`、`src/js/07-integration.js`

### 优化 (Improved) — 便签模式视觉与动画

1. **便签纸质感**
   - 标题栏淡色背景 + 拖拽光标提示（`cursor: move`、`-webkit-app-region: drag`）
   - 文件：`src/style.css`

2. **输入区平滑展开/收起动画**
   - 使用 `max-height` + `opacity` 过渡替代 `display: none/block` 瞬间切换
   - 文件：`src/style.css`

3. **折叠/展开动画优化**
   - 用 `max-height` + `opacity` 过渡替代 `display: none`，与窗口 resize 动画同步
   - 文件：`src/style.css`

4. **底部留白呼吸感**
   - 便签模式 main 区域底部内边距从 24px 增加到 36px
   - 高度计算改用 `scrollHeight` 直接测量，确保底部空白不被裁切
   - 文件：`src/style.css`、`src/js/02-render.js`

### 修复 (Fixed)

1. **便签模式宽度跳动**
   - 折叠/展开时宽度使用进入便签模式时记录的固定值（`document.documentElement.clientWidth`），不再依赖会随滚动条变化的 `window.innerWidth`
   - 高度计算添加阈值判断（8px），防止连续微小变化导致窗口持续缩小
   - 文件：`src/js/02-render.js`、`src/js/07-integration.js`

2. **添加待办闪动问题**
   - 移除 `.todo_item` 基础类上的 `slideIn` 动画，避免与 `todo-item-enter` 的 `slideInDown` 动画冲突
   - 文件：`src/style.css`

### 核心文件

- `src/style.css`：便签纸质感、输入区动画、折叠动画、底部留白、修复动画冲突
- `src/index.html`：📌 指示器元素
- `src/js/02-render.js`：高度计算改用 scrollHeight、宽度固定、阈值防抖
- `src/js/07-integration.js`：updateStickyTitle、双击 Esc 退出、添加成功反馈
- `electron/preload.js`：暴露 `exitStickyMode` API
- `electron/main.js`：新增 `exit-sticky-mode` IPC 处理、托盘菜单状态同步

---

## [v2.16.0] - 2026-08-24

### 新增 (Added) — 双时间提醒功能

1. **开始时间 + 结束时间提醒**
   - 每条待办可独立设置开始时间和结束时间
   - 开始时间提醒："该开始【xxx】了！"
   - 结束时间提醒："【xxx】截止时间到了！"
   - 文件：`src/index.html`、`src/style.css`、`src/js/03-crud.js`、`src/js/06-reminder.js`

2. **结束前 N 分钟提醒**
   - 可设置结束前 5/10/15/30 分钟（或自定义分钟数）提前提醒
   - 提醒文案："【xxx】还有 N 分钟截止！"
   - 文件：`src/index.html`、`src/style.css`、`src/js/05-datetime.js`

3. **日期选择器 UI 增强**
   - 新增"结束时间"开关区域（带日期+时间输入）
   - 新增"结束前提醒"开关区域（带快捷预设按钮）
   - 显示文案示例：`8月25日 09:00 ~ 12:00 (前15分)`
   - 文件：`src/index.html`、`src/style.css`、`src/js/05-datetime.js`

4. **徽章显示时间范围**
   - 有开始+结束时间时显示：`8/25 09:00 ~ 12:00`
   - 仅有开始时间显示：`8/25 09:00`
   - 颜色状态基于最近的提醒时间判断
   - 文件：`src/js/02-render.js`

### 优化 (Improved) — 数据模型与可视化

1. **统一提醒点数组**
   - 将分散的 `remindAt`、`endRemindAt`、`endRemindBefore`、`reminded` 等统一为 `reminders` 数组
   - 新格式：`reminders: [{ type: 'start'|'end'|'before', at: 时间戳, reminded: false }]`
   - 向后兼容：旧数据自动迁移到新格式
   - 文件：`src/js/01-data.js`、`src/js/03-crud.js`、`src/js/06-reminder.js`

2. **时间轴可视化**
   - 列表项中有开始+结束时间时，显示渐变时间轴（蓝→红）
   - 两端圆点标识起止位置，下方显示时间段标签（如 `09:00 - 12:00`）
   - 文件：`src/js/02-render.js`、`src/style.css`

3. **辅助函数封装**
   - 新增 `getReminder()`、`getReminderAt()`、`isReminded()` 辅助函数
   - 简化各模块对提醒点的访问逻辑
   - 文件：`src/js/01-data.js`

### 核心文件

- `src/index.html`：结束时间区、结束前提醒区 UI
- `src/style.css`：新区域样式、动画、时间轴样式
- `src/js/01-data.js`：统一 reminders 数组、向后兼容迁移、辅助函数
- `src/js/05-datetime.js`：结束时间、结束前提醒状态管理、输入同步
- `src/js/03-crud.js`：`addTodo()` 构建 reminders 数组
- `src/js/06-reminder.js`：基于 reminders 数组的统一调度、触发、漏检
- `src/js/02-render.js`：徽章显示时间范围、时间轴可视化、Tooltip 详细信息
- `src/js/07-integration.js`：传入结束时间和结束前提醒参数

---

## [v2.15.0] - 2026-08-24

### 优化 (Improved) — 日期时间选择器

1. **日期输入改为直接键入**
   - 移除月/日滚轮选择器，改为点击输入框直接输入月/日
   - 自动校验范围（月 1-12，日 1-当月最大天数），非法值自动修正
   - 文件：`src/index.html`、`src/style.css`、`src/js/05-datetime.js`

2. **日期预设同步输入框**
   - 点击"今天/明天/后天/下周一"预设按钮后，输入框同步显示对应日期
   - 文件：`src/js/05-datetime.js`

3. **自然语言解析同步输入框**
   - 解析"明天下午3点"等自然语言后，月/日/时/分输入框全部同步更新
   - 文件：`src/js/05-datetime.js`

---

## [v2.13.0] - 2026-08-24

### 新增 (Added) — 用户体验优化

1. **删除确认对话框**
   - 删除待办前弹出确认框，显示待办文本（如"确定要删除「买菜」吗？"）
   - 用户点击"确定"才执行删除，点击"取消"中止操作
   - 文件：`src/js/07-integration.js`

2. **按钮涟漪效果**
   - 添加按钮点击时从点击位置扩散圆形波纹（Material Design 风格）
   - 波纹自动淡出移除，不残留 DOM
   - 文件：`src/style.css`（@keyframes ripple-effect）、`src/js/07-integration.js`

3. **添加成功反馈**
   - 成功添加待办后，输入框绿色边框闪烁 + 扩散光晕
   - 文件：`src/style.css`（@keyframes success-pulse）、`src/js/03-crud.js`

### 优化 (Improved) — 动画效果

1. **新待办滑入动画**
   - 新添加的待办从上方平滑滑入（slideInDown 0.35s）
   - 文件：`src/style.css`（@keyframes slideInDown）、`src/js/02-render.js`

2. **删除淡出动画**
   - 删除时节点淡出 + 缩小 + 左滑（fadeOutLeft 0.3s）
   - 动画完成后才从数据中移除，视觉更流畅
   - 文件：`src/style.css`（@keyframes fadeOutLeft）、`src/js/03-crud.js`

3. **完成庆祝动画（CSS 已就绪）**
   - 勾选框弹跳动画（checkbox-bounce）
   - 完成时金色闪光（complete-flash）
   - 文件：`src/style.css`

### 新增 (Added) — 空状态提示

1. **丰富的空状态组件**
   - 无待办时显示：浮动图标 + 标题 + 引导文字 + 示例按钮
   - 示例按钮可点击填入输入框（"明天9点开会"、"每30分钟喝水"、"周末去爬山"）
   - 文件：`src/index.html`、`src/style.css`、`src/js/02-render.js`

### 核心文件

- `src/style.css`：新增 10+ 个动画 keyframes 和样式类
- `src/index.html`：添加空状态 DOM 元素
- `src/js/02-render.js`：空状态显示/隐藏、新节点进入动画
- `src/js/03-crud.js`：删除动画、添加成功反馈
- `src/js/07-integration.js`：删除确认、按钮涟漪、空状态按钮事件
- `verify_playwright.py`：自动处理确认对话框

---

## [v2.12.1] - 2026-08-24

### 修复 (Fixed)

1. **自然语言循环提醒被覆盖 bug**
   - 修复输入"每30分钟喝水"等循环提醒时，`recurrence` 被日期选择器的 `null` 覆盖的问题
   - 根因：`wrappedAddTodo` 中 `syncFromTimestamp` 设置了 `currentDate`，导致后续 `getTimestamp()` 返回非 null，进而 `getRecurrence()` 返回的 `null` 覆盖了自然语言解析得到的 `recurrence`
   - 修复：只有当日期选择器有明确的循环设置时，才覆盖自然语言解析的结果

### 测试 (Test)

1. **完善 Playwright 高级功能测试用例**
   - 新增 8 个高级功能测试：收纳与展开、双击编辑、提醒解析、循环提醒、日期选择器、长文本折叠、桌宠交互、空输入提示
   - 测试覆盖率达 21/22（收纳按钮测试按要求跳过）

### 核心文件

- `src/js/07-integration.js`：修复 `wrappedAddTodo` 中 recurrence 被覆盖的逻辑
- `verify_playwright.py`：新增高级功能测试用例

---

## [v2.12.0] - 2026-08-20

### 优化 (Improved)

1. **操作指南重写**
   - 从 12 章节精简为 6 章节：快速上手、提醒功能、列表显示、桌面端、桌宠、常见问题
   - 移除过时的"双组收纳"描述，更新为"已完成收纳在底部"
   - 更新便签模式说明（支持添加事项）
   - 新增智能时间推断说明
   - 常见问题精简为 5 个核心问题

---

## [v2.11.0] - 2026-08-20

### 新增 (Added)

1. **便签模式添加事项**
   - 便签模式标题栏新增「＋」按钮，点击展开输入区
   - 输入文字后按回车即可添加事项（纯文字，不设提醒/循环）
   - 双击回车或按 Escape 收起输入区
   - 添加后窗口高度自动适应

2. **循环次数集成到日期选择器**
   - 日期选择器循环提醒区新增「次数」输入框
   - 设置循环提醒几次后自动停止（留空=无限循环）
   - 移除旧的目标次数独立输入框

### 优化 (Improved)

1. **收纳逻辑简化**
   - 取消未完成项收纳功能，未完成项始终全部显示
   - 只保留已完成收纳框，永远位于列表最底部
   - 减少视觉干扰，聚焦未完成事项

2. **列表显示顺序**
   - 未完成项改为倒序：最新添加的事项显示在最上面
   - 已完成收纳框永远在最底部
   - 勾选完成 → 事项沉到底部；取消勾选 → 浮到顶部

3. **滚动条优化**
   - 普通模式隐藏外层 body 滚动条，只保留列表区域内部滚动
   - 列表区域滚动条平时淡隐（4px），悬停时显示
   - 整体视觉更简洁

4. **智能时间推断**
   - 纯时间表达（如"八点半"、"8:30"）支持上午/下午智能推断
   - 推断逻辑：原始时间未到 → 用原始时间；已过 → 加 12 小时；加 12 小时也过 → 明天
   - 例：下午说"八点半" → 20:30（今天）；晚上说"八点半" → 明天 8:30

5. **头部按钮组布局**
   - 标题栏按钮改为 flex 横向排列，间距均匀
   - 「+」按钮展开后蓝色高亮提示输入区已展开

### 修复 (Fixed)

1. **便签模式窗口自适应**
   - 添加事项后窗口高度自动调整
   - 进入/退出便签模式时正确刷新收纳按钮状态

---

## [v2.10.0] - 2026-08-20

### 新增 (Added)

1. **时间格式全面覆盖**
   - 支持「数字+点半」格式：`8点半`、`15点半`
   - 支持「数字+点+数字分」格式：`8点30分`、`8点30`（无"分"字）
   - 支持「中文+点+整」格式：`八点整`、`九点整`
   - 支持「中文+点+一刻」格式：`九点一刻`、`三点一刻`（一刻=15分）
   - 支持「中文+点+中文分」格式：`八点二十分`、`八点二十`
   - 支持「时段词 + 上述任意格式」组合：`今天下午8点半`、`今晚九点一刻`、`明天八点整`
   - 支持「日期 + 时间」组合：`8月15日8点半`、`八月十五九点一刻`

2. **纯时间格式（无时段词）**
   - 支持单独使用：`8点半提醒我吃饭`、`9点整提醒我开会`
   - 支持中文格式：`三点一刻提醒我休息`、`八点二十分提醒我锻炼`

### 修复 (Fixed)

1. **时段偏移修复**
   - 修复「下午8点」被解析为 08:00 而非 20:00 的问题
   - 修复「今晚8:30」被解析为 08:30 而非 20:30 的问题
   - 确保时段词（下午/晚上/中午）正确转换为 24 小时制

2. **中文数字误转换修复**
   - 修复「一刻」中的「一」被误转为「1」的问题
   - 修复 convertChineseDate 函数，添加「刻」到排除列表

3. **文本清理修复**
   - 修复时间词残留问题：`半`、`整`、`刻`、`分` 等不再残留在事项文本中
   - 确保所有匹配的时间文本被正确消费

---

## [v2.9.0] - 2026-08-19

### 新增 (Added)

1. **便签模式折叠/展开**
   - 便签模式下标题栏新增 ▼ 折叠按钮
   - 点击折叠：窗口缩至标题栏高度（80px），只显示标题栏
   - 点击展开：恢复到折叠前的宽度和完整高度
   - 折叠时窗口宽度保持不变，仅改变高度

2. **长文本展开/收起**
   - 待办事项文字超过 3 行时自动折叠，末尾显示「展开」按钮
   - 点击「展开」显示全文，按钮变为「收起」
   - 点击「收起」恢复 3 行折叠状态

3. **气泡碰撞检测**
   - 桌宠与页面内容重叠时，自动隐藏对话气泡
   - 检测气泡区域（桌宠上方）是否与按钮/输入框等内容重叠
   - 不重叠时正常显示气泡

### 优化 (Improved)

1. **桌宠避让内容**
   - 桌宠走动时自动避开按钮、输入框、待办项等内容区域
   - 随机移动前检测目标位置是否与内容重叠
   - 最多尝试 10 次寻找空白位置，找不到则暂时不动
   - 拖拽时实时检测碰撞并自动微调位置

2. **桌宠小窗口显示**
   - 不再用固定宽度阈值判断是否显示桌宠
   - 实时检测页面是否存在空白区域，只要有空间就显示
   - 窗口太小时（<100x120）才隐藏，避免显示不全
   - 窗口大小变化时自动移到空白位置

3. **待办项悬浮层级**
   - 悬浮时 z-index 提升至 100，避免被桌宠遮挡提醒徽章

4. **自然语言解析增强**
   - 新增「今天/明天 + 时段 + 时间」：`今天晚上八点半`、`明天下午三点`
   - 新增「明天/后天/大后天 + 时段」（无具体时间）：`明天早上`、`后天下午`
   - 新增「过X分钟/再过Y小时」：`过10分钟`、`再过2小时`
   - 修复规则 5 误匹配导致整个解析函数退出的 bug
   - 增强文本清理：自动剥离「提醒我/提醒/叫我」前缀

### 修复 (Fixed)

- **规则 5 误匹配 bug**：`relRe` 正则末尾 `后?` 导致"天晚上"被误匹配，`return` 退出整个函数，后续规则无法执行
- **待办项悬浮被遮挡**：桌宠 z-index 高于待办项，悬浮时提醒徽章被遮挡
- **气泡遮挡内容**：桌宠与内容重叠时气泡仍显示，影响阅读

### 核心文件

- `src/script.js`：长文本展开/收起、气泡碰撞检测、桌宠避让逻辑、自然语言解析增强
- `src/style.css`：长文本折叠样式、便签模式折叠样式、桌宠 z-index 调整
- `src/index.html`：便签模式折叠按钮
- `electron/main.js`：便签模式窗口重建逻辑（toolbar 类型）、resize-window IPC
- `electron/preload.js`：resizeWindow API

---

## [v2.8.1] - 2026-08-19

### 新增 (Added)

1. **双击编辑待办事项**
   - 双击待办事项文字可原地弹出输入框编辑
   - 按 Enter 保存，按 Esc 取消

2. **目标计数功能**
   - 每条待办可设置目标执行次数（如喝水 8 次）
   - 点击「+」按钮计数，达到目标自动标记完成

3. **史迪奇交互文字**
   - 新增中二/乐天/暖心风格的对话气泡
   - 在页面打开、用户空闲、操作反馈、随机气泡四种场景触发

4. **日报功能**
   - 每晚 21:00 自动提醒生成日报
   - 也可手动点击史迪奇查看
   - 日报显示今日完成事项、完成率、暖心结语

5. **自动收纳已完成项**
   - 已完成事项默认折叠收纳
   - 点击「还有 N 项已完成」展开查看

### 修复 (Fixed)

- **拖拽 Y 轴反转**：修复史迪奇拖动时 Y 轴方向反了的问题
- **应用图标**：使用史迪奇形象作为桌面应用图标

### 构建 (Build)

- 版本号统一为 v2.8.1
- Electron 桌面端打包（NSIS 安装包 + 便携版）
- 代码签名后发布到 GitHub Release

### 文档 (Documentation)

- 操作指南新增「双击编辑」说明

---

## [v2.7.1] - 2026-08-19

### 新增 (Added) — 窗口置顶按钮

1. **标题栏置顶按钮**
   - 页面标题右侧新增 📌 按钮，点击可切换窗口置顶
   - 置顶时按钮变红，取消置顶恢复灰色
   - 仅在桌面端显示，浏览器环境下自动隐藏

### 优化 (Improved)

- **桌宠显示阈值调整**：窗口宽度 < 360px 时才隐藏桌宠（原为 480px），小窗口也能看到史迪奇

### 核心文件

- `electron/preload.js`：新增置顶按钮 IPC 通信 API
- `electron/main.js`：新增置顶切换 IPC 处理
- `src/index.html`：标题栏添加置顶按钮
- `src/style.css`：置顶按钮样式 + 桌宠隐藏阈值调整
- `src/script.js`：置顶按钮点击逻辑与状态同步

---

## [v2.7.0] - 2026-08-19

### 新增 (Added) — 便签模式

1. **桌面便签模式**
   - 右键托盘图标 → 勾选「🗒 便签模式」即可切换
   - 进入后窗口自动移到屏幕右上角，只显示待办列表
   - 可勾选完成任务，但不能新增/删除/编辑
   - 不置顶、不抢焦点，不影响其他软件操作
   - 支持拖动调整位置，位置会被记住
   - 取消勾选恢复正常窗口

2. **技术实现**
   - 新增 `electron/preload.js` 预加载脚本，安全地进行进程间通信
   - 通过 IPC 通信实现托盘菜单与页面状态的同步

### 核心文件

- `electron/main.js`：新增便签模式状态管理、窗口定位、IPC 通信
- `electron/preload.js`：新增预加载脚本，暴露安全的 electronAPI
- `src/script.js`：监听便签模式消息，切换 body class
- `src/style.css`：新增便签模式样式，隐藏输入区/桌宠/按钮等非必要元素

---

## [v2.6.0] - 2026-08-19

### 新增 (Added) — 自然语言解析全面增强

1. **更多时间表达方式**
   - 支持「后天」「大后天」：`后天提醒我体检`
   - 支持「星期/周」：`下周一交周报`、`周五晚上聚会`
   - 支持「时段+时间」：`早上8点跑步`、`晚上9点关灯`
   - 支持「每X循环」：`每30分钟喝水`（自动开启循环提醒）
   - 支持「模糊稍后」：`一会儿提醒我`（默认5分钟后）
   - 支持「中文数字时间」：`七点洗澡`、`八点半睡觉`

2. **智能文本清理**
   - 自动剥离「提醒我」「提醒」「叫我」等前缀
   - 自动剥离「明天」「后天」等时间词
   - 自动清理末尾语气词（吧、啊、呀等）

### 变更 (Changed)

- **项目结构重组**：源码归入 `src/`、Electron 归入 `electron/`、脚本归入 `scripts/`、文档归入 `docs/`
- **README 重写**：新增理念阐述（极简·轻量·实用）

### 核心文件

- `src/script.js`：自然语言解析模块全面重构，新增 7 条解析规则
- `docs/README.md`：项目结构树和运行方式更新
- `electron/main.js`：路径引用更新
- `package.json`：入口路径和打包配置更新

---

## [v2.5.0] - 2026-08-18

### 新增 (Added) — 滚轮日期时间选择器 + 两列布局 + 现在快捷按钮

1. **自定义滚轮（Wheel Picker）日期时间选择器**
   - 替换 Popover 内的 `<input type="date">` 和 `<select>` 下拉框
   - **日期区**：年份标签（静态显示系统年份）+ 月份/日期双列滚轮
   - **时间区**：小时/分钟双列滚轮
   - 三种交互方式：鼠标拖拽、滚轮滚动、点击选中
   - 精确垂直居中：选中数字始终位于滚轮容器几何中心
   - 紧凑化设计：item 高度 14px，容器高度 42px，强遮罩只显示选中项
   - 动态更新：切换年月时自动调整当月天数（含闰年 2 月）

2. **Popover 两列布局**
   - 左列：日期（预设 + 滚轮）
   - 右列：循环提醒开关 + 间隔预设 + 操作按钮（清除/确定）
   - 操作按钮使用 `margin-top: auto` 固定在右列底部对齐

3. **"现在"快捷时间按钮**
   - 时间预设行新增「现在」按钮，点击立即设为当前系统时间
   - 按钮文本简洁，仅显示"现在"二字

### 优化 (Improved)

- **UI 统一**：年份标签样式与月/日滚轮完全统一（相同背景色 `#fafbff`、圆角 `10px`、边框样式）
- **视觉层次**：滚轮项三级透明度（选中 100% → 邻近 45% → 远处 15%），引导视觉焦点
- **预设按钮统一**：日期预设（今天/明天/后天/下周一）和时间预设（现在/8:00/12:00/20:00）使用相同胶囊风格
- **滚轮平滑过渡**：`cubic-bezier(0.25, 1, 0.5, 1)` 缓动曲线，滚动吸附更丝滑

### 修复 (Fixed)

- 日期选择器弹出浏览器原生日历面板、风格不统一的问题
- 时间下拉框选中项在容器内垂直位置偏移的问题
- 年月切换时日期列未正确更新天数的边界问题

### 核心文件

- `index.html`：Popover 结构改为两列布局，日期/时间改为滚轮容器，新增「现在」按钮
- `style.css`：新增滚轮选择器全套样式（`.dp-wheel-picker` / `.dp-wheel-col` / `.dp-wheel-list` / `.dp-wheel-item` / `.dp-wheel-highlight` / `.dp-wheel-mask`），紧凑化容器尺寸，统一年份标签样式
- `script.js`：新增 `datetimePickerModule` 滚轮子模块（`renderWheel` / `snapWheel` / `bindWheel` / `setWheelToDate` / `setWheelToTime`），更新 `DATE_ITEM_HEIGHT` / `TIME_ITEM_HEIGHT` 为 14px，新增「现在」预设逻辑

---

## [v2.4.0] - 2026-08-18

### 新增 (Added) — 自定义日期时间选择器 + 循环提醒 + 悬浮提示

1. **自定义日期时间选择器 Popover**
   - 替换原生 `<input type="datetime-local">`，改为自定义 Popover 浮层组件
   - 支持日期预设快捷选择（今天/明天/后天/下周一）
   - 支持时间预设快捷选择（早上 8:00 / 中午 12:00 / 晚上 20:00）
   - 支持手动选择年月日和小时/分钟
   - 整个触发区域可点击打开二级窗口，交互更自然
   - 点击外部自动关闭，ESC 键关闭

2. **循环提醒功能**
   - 支持开启循环提醒开关
   - 预设循环间隔：每 30 分钟 / 每 1 小时 / 每 1 天 / 每 1 周
   - 支持自定义循环间隔（数值 + 单位：分钟/小时/天/周）
   - 触发提醒后自动推进到下一个周期并重新调度
   - 显示循环图标 🔄 和停止循环按钮 ⏹

3. **完成自动开启下一轮**
   - 循环待办勾选完成后，自动记录完成次数
   - 自动推进到下一个周期，保持未完成态继续循环
   - 显示完成次数徽章（如 ×3），带弹跳动画
   - 桌宠反馈：完成第 N 次 + 下一轮提醒已安排

4. **悬浮 Tooltip 提示**
   - 待办事项鼠标悬浮显示设置信息
   - 显示提醒时间、循环设置、完成次数等信息

5. **数据模型扩展**
   - todos 增加 `recurrence` 字段（循环设置对象）
   - todos 增加 `completionCount` 字段（完成次数）
   - todos 增加 `lastRemindAt` 字段（上次提醒时间戳）
   - 旧数据自动兼容，缺失字段自动补齐默认值

### 优化 (Improved)

- UI 更简洁：提示条弱化、列表项紧凑、阴影轻薄
- 响应式布局：输入区两行布局，自适应不同屏幕宽度
- 提醒徽章优化：循环徽章增加 🔄 装饰
- 停止循环按钮：圆形红色按钮，hover 放大效果
- **Popover 紧凑化**：浮层宽度从 320-360px 缩小至 260-280px，间距、字号、按钮全面紧凑化，不再延伸出屏幕
- **层级修复**：`.input-area` 添加 `position: relative + z-index`，确保 Popover 浮层始终覆盖下方列表项

### 修复 (Fixed)

- 日期时间选择器显示 2 位年份（yy）的问题已通过自定义组件彻底解决
- Popover 浮层被下方待办事项遮挡的 z-index 层级问题

---

## [v2.3.3] - 2026-08-18

### 修复 (Fixed) — datetime-local 显示为 2 位年份

**现象**：下载后本地运行时，日期时间选择器显示 `yy/mm/日 --:--`（2 位年份），而非预期的 4 位年份。

**根因**：`<input type="datetime-local">` 的显示格式由**浏览器 locale + 操作系统区域设置**控制，与 `value` 字符串无关。在中文 Windows + Chrome/Edge 环境下，浏览器默认用中文短格式渲染日期，导致 4 位年份被压缩为 2 位显示。

**诊断证据**：
- `formatToLocalInputValue()` 生成的值 `2026-08-18T08:00` 已经是 4 位年份（正确）
- `el.value` 在 DOM 里存储的也是 `2026-08-18T08:00`（正确）
- 仅渲染层把 `2026` 显示为 `yy`——纯显示问题

**修复**：给 `#remindAtInput` 添加 `lang="en"` 属性，强制浏览器用英文 locale 渲染 datetime-local，英文格式下始终显示 4 位年份（`mm/dd/yyyy, --:--` 或 `yyyy/mm/dd --:--`）。

**影响**：仅改变控件显示格式，底层 value 仍为 `yyyy-MM-ddTHH:mm`（HTML5 规范格式），所有 JS 逻辑（parseReminderFromText / formatToLocalInputValue / wrappedAddTodo / scheduleReminder）完全不受影响。

### 验证 (Verified)

- ✅ `lang` 属性生效：`en`
- ✅ 设置值后仍为 `2026-08-18T08:00`（4 位年份）
- ✅ `formatToLocalInputValue` 仍输出 4 位年份
- ✅ 控制台零错误
- ✅ 功能无回归：解析、调度、提醒触发链路完全不受影响

### 核心文件

- `index.html`：`#remindAtInput` 新增 `lang="en"` 属性 + 注释说明

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
