# 用户引导系统重写 — 执行文档

> **版本**：v2.25.0
> **日期**：2026-08-26
> **状态**：待审批

---

## 一、背景与目标

### 1.1 为什么要重写

现有 `08-onboarding.js`（v2.24.0）存在以下问题：

| 问题 | 说明 |
|---|---|
| 架构耦合 | 「首次引导」和「上下文提示」能力混为一体，难以扩展 |
| 触发方式单一 | 只支持首次启动的线性流程，无法基于用户行为动态触发 |
| 样式冗余 | `base.css` 中 ~210 行引导样式与全局基础样式混在一起 |
| 重置逻辑脆弱 | `settings.js` 兜底用 `location.reload()`，Electron 下体验差 |
| 无可复用组件 | 气泡 / 高亮 / 卡片无法被其他模块复用 |

### 1.2 重写目标

- **统一**：一个模块同时支持「首次引导」+「上下文提示」+「功能发现」
- **声明式**：通过配置数组定义引导步骤，新增引导零逻辑代码
- **可复用**：高亮层、说明卡片、气泡作为独立组件，全应用可调用
- **零依赖**：延续项目原生 JS 风格
- **用户可控**：所有引导均可关闭 / 跳过 / 重置

---

## 二、废弃清单（删除项）

### 2.1 文件级废弃

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/js/08-onboarding.js` | ❌ 删除 | 整个文件废弃，由 `09-guide.js` 取代 |

### 2.2 代码级废弃

| 文件 | 行号范围 | 删除内容 |
|---|---|---|
| `src/css/base.css` | L149–L370 | 整块 `用户引导覆盖层` 注释段下的所有 `.onboarding-*` 样式（约 220 行） |
| `src/index.html` | L238 | `<script src="js/08-onboarding.js"></script>` 引用 |
| `src/settings.js` | L322–L337 | `initOnboardingReset()` 函数整体 |
| `src/settings.js` | L30 | `initOnboardingReset()` 调用 |
| `src/settings.html` | L115–L127 | 「用户引导」设置区块（按钮 id 改为新逻辑） |

---

## 三、新增文件清单

| 文件 | 用途 | 预估行数 |
|---|---|---|
| `src/js/09-guide.js` | 统一引导引擎 | ~400 行 |
| `src/css/guide.css` | 引导组件样式 | ~280 行 |

---

## 四、架构设计

### 4.1 整体架构图

```
┌─────────────────────────────────────────────────────┐
│                  09-guide.js                         │
│                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ GuideEngine │  │ 组件层        │  │ 配置层      │ │
│  │             │  │              │  │            │ │
│  │ • start()   │──│ • Spotlight  │  │ • TOURS[]  │ │
│  │ • stop()    │  │ • Card       │  │ • TIPS[]   │ │
│  │ • reset()   │  │ • Tooltip    │  │ • State    │ │
│  │ • next()    │  │ • Arrow      │  │            │ │
│  └─────────────┘  └──────────────┘  └────────────┘ │
│         │                                           │
│         ▼                                           │
│  ┌─────────────────────────────────────────────┐    │
│  │              触发器系统                       │    │
│  │  once-version │ event │ mutation │ interval  │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### 4.2 核心模块职责

| 模块 | 职责 |
|---|---|
| **GuideEngine** | 引导引擎主控制器：启动 / 停止 / 步骤调度 / 状态持久化 |
| **Spotlight** | 高亮层：遮罩 + 镂空聚焦 + 脉冲动画 |
| **Card** | 说明卡片：标题 + 描述 + 操作按钮 + 进度点 |
| **Tooltip** | 轻量气泡：单行提示 + 「知道了」按钮 |
| **触发器系统** | 监听用户行为，满足条件时触发对应引导 |

### 4.3 触发器类型

| 类型 | 触发时机 | 适用场景 |
|---|---|---|
| `once-version` | 版本号不匹配时自动触发 | 首次启动 / 版本更新 |
| `event` | 监听 DOM 事件（focus / click / input） | 用户交互时触发 |
| `mutation` | DOM 子树变化 | 列表新增 / 状态变化 |
| `interval` | 定时轮询条件 | 周期性状态检测 |

---

## 五、配置数据结构

### 5.1 引导流程（TOURS）

完整的分步引导，支持多步骤、每步多相位：

```javascript
var TOURS = [
  {
    id: 'welcome-tour',                  // 唯一标识
    version: '1',                        // 完成标记版本号
    autoStart: true,                     // 是否自动启动
    steps: [
      {
        title: '欢迎使用 ToDoList',
        desc: '这是一个轻量的待办工具\n几秒钟带你了解核心功能 ✨',
        spotlight: null,                 // null = 居中卡片（无高亮）
        position: 'center',
        wait: null,                      // 无需等待操作
        action: { label: '开始体验', fn: 'next' }
      },
      {
        title: '添加待办',
        desc: '输入内容，按 Enter 即可添加\n试试自然语言："9点开会"',
        spotlight: '#todoInput',
        position: 'bottom',
        wait: {                          // 等待用户完成操作
          type: 'enter-with-value',
          target: '#todoInput',
          successOn: 'list-changed'
        }
      },
      {
        title: '设置提醒',
        desc: '点击 📅 设置提醒时间\n到点史迪仔会弹窗提醒你 🔔',
        spotlight: '#datetimeTrigger',
        position: 'bottom',
        wait: { type: 'click', target: '#datetimeTrigger' }
      },
      {
        title: '全部搞定',
        desc: '引导完成！\n添加、提醒、循环 —— 你都会了 🎉',
        spotlight: null,
        position: 'center',
        wait: null,
        action: { label: '开始使用', fn: 'complete' }
      }
    ]
  }
];
```

### 5.2 上下文提示（TIPS）

轻量气泡，基于行为触发：

```javascript
var TIPS = [
  {
    id: 'tip-natural-language',
    trigger: {
      type: 'event',
      event: 'focus',
      target: '#todoInput',
      condition: function () {
        return localStorage.getItem('tip-natural-language') !== 'done'
          && document.querySelectorAll('#todoList li').length === 0;
      }
    },
    content: '试试输入「9点半开会」，自动识别时间 ⏰',
    position: 'bottom',
    dismissible: true,
    autoHide: 5000
  },
  {
    id: 'tip-datetime-picker',
    trigger: {
      type: 'mutation',
      target: '#todoList',
      condition: function () {
        return localStorage.getItem('tip-datetime-picker') !== 'done'
          && document.querySelectorAll('#todoList li').length >= 1
          && localStorage.getItem('datetime_used') !== '1';
      }
    },
    content: '点击 📅 可为事项设置提醒时间',
    position: 'bottom',
    anchor: '#datetimeTrigger',
    dismissible: true,
    autoHide: 6000
  },
  {
    id: 'tip-complete-collapse',
    trigger: {
      type: 'mutation',
      target: '#todoList',
      condition: function (mutations) {
        return localStorage.getItem('tip-complete-collapse') !== 'done'
          && hasNewlyCompleted(mutations);
      }
    },
    content: '已完成的事项自动沉底，可点击展开/收起',
    position: 'top',
    anchor: '.completed-section',
    dismissible: true
  },
  {
    id: 'tip-overdue-badge',
    trigger: {
      type: 'interval',
      interval: 60000,
      condition: function () {
        return localStorage.getItem('tip-overdue-badge') !== 'done'
          && document.querySelector('.reminder-overdue') !== null;
      }
    },
    content: '🔴 红色徽章 = 已过期，双击事项可修改时间',
    position: 'top',
    anchor: '.reminder-overdue',
    dismissible: true
  }
];
```

---

## 六、UI 组件设计

### 6.1 Spotlight 高亮层

```
┌──────────────────────────────────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓┌──────────────┐▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓│  ░░░░░░░░░░  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← 镂空区（目标元素）
│▓▓▓▓│  ░ 目标元素 ░  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓│  ░░░░░░░░░░  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓└──────────────┘▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
└──────────────────────────────────────────────┘
            ╭─────────────────╮
            │  Card 说明卡片  │  ← 自动定位（避开高亮区 + 视口边界）
            ╰─────────────────╯
```

**实现**：
- 使用 `box-shadow: 0 0 0 9999px rgba(0,0,0,0.65)` 实现遮罩
- 目标元素区域通过 `clip-path` 或独立的 `position: fixed` 镂空框实现
- 脉冲动画：`0 0 0 4px rgba(0,122,255,0.6)` → `0 0 0 12px rgba(0,122,255,0.2)`

### 6.2 Card 说明卡片

```
╭────────────────────────────────╮
│  步骤 1/4                       │  ← 徽章
│  添加待办                       │  ← 标题 (17px semibold)
│  输入内容，按 Enter 即可添加    │  ← 描述 (14px regular)
│  试试自然语言："9点开会"        │
│                                │
│  ● ○ ○ ○              [下一步] │  ← 进度点 + 操作按钮
╰────────────────────────────────╯
```

**定位逻辑**：
1. 优先用户指定的 `position`（top / bottom / left / right / center）
2. 检测是否溢出视口 → 自动翻转方向
3. 检测是否与高亮框重叠 → 尝试反方向
4. fallback：贴边四角

### 6.3 Tooltip 轻量气泡

```
╭─────────────────────────────────────╮
│  试试输入「9点半开会」，自动识别时间 ⏰  │
│                           [知道了]  │
╰─────────────────────────────────────╯
         ▲
         │ (箭头)
    ┌────┴────┐
    │ 目标元素 │
    └─────────┘
```

**特性**：
- 最大宽度 240px
- 13px 字号，单行或多行
- 无操作时 5-6 秒自动淡出
- 「知道了」按钮立即关闭并持久化「不再提示」

---

## 七、样式设计（guide.css）

### 7.1 新增设计令牌

```css
/* 追加到 tokens.css */
:root {
  --guide-overlay-bg: rgba(0, 0, 0, 0.65);
  --guide-spotlight-radius: 12px;
  --guide-card-bg: rgba(255, 255, 255, 0.98);
  --guide-card-shadow: 0 12px 48px rgba(0, 0, 0, 0.25);
  --guide-tooltip-bg: rgba(40, 40, 60, 0.92);
  --guide-tooltip-text: #ffffff;
  --guide-z-base: 9000;
}
```

### 7.2 样式清单

| 类名 | 用途 | 关键样式 |
|---|---|---|
| `#guide-overlay` | 引导根容器 | `position: fixed; inset: 0; z-index: 9000` |
| `.guide-spotlight` | 高亮镂空框 | `position: fixed; box-shadow: 0 0 0 9999px var(--guide-overlay-bg)` |
| `.guide-spotlight--pulse` | 脉冲等待动画 | `@keyframes guide-pulse` |
| `.guide-spotlight--success` | 成功状态 | 绿色光环 |
| `.guide-card` | 说明卡片 | 毛玻璃 + 圆角 16px + 阴影 |
| `.guide-card__badge` | 步骤徽章 | 胶囊标签 |
| `.guide-card__title` | 标题 | 17px semibold |
| `.guide-card__desc` | 描述 | 14px, line-height 1.6 |
| `.guide-card__footer` | 底栏 | flex 布局 |
| `.guide-card__dots` | 进度点 | 圆点 + active 长条 |
| `.guide-card__btn` | 操作按钮 | 主色 / 次要样式 |
| `.guide-tooltip` | 轻量气泡 | 深色背景 + 白色文字 |
| `.guide-tooltip__arrow` | 箭头 | CSS 三角形 |
| `.guide-tooltip__close` | 关闭按钮 | 「知道了」 |

### 7.3 动画定义

```css
@keyframes guide-spotlight-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes guide-pulse {
  0%, 100% { box-shadow: 0 0 0 9999px var(--guide-overlay-bg), 0 0 0 4px rgba(0,122,255,0.6); }
  50%      { box-shadow: 0 0 0 9999px var(--guide-overlay-bg), 0 0 0 12px rgba(0,122,255,0.2); }
}

@keyframes guide-success {
  0%   { box-shadow: 0 0 0 9999px var(--guide-overlay-bg), 0 0 0 4px rgba(52,199,89,0.6); }
  100% { box-shadow: 0 0 0 9999px var(--guide-overlay-bg), 0 0 0 20px rgba(52,199,89,0); }
}

@keyframes guide-card-in {
  from { opacity: 0; transform: translateY(8px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes guide-tooltip-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes guide-fade-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}
```

---

## 八、API 设计（全局接口）

```javascript
window.Guide = {
  // 引导控制
  start: function (tourId) {},     // 启动指定引导（默认自动判断）
  stop: function () {},            // 停止当前引导
  next: function () {},            // 下一步 / 下一相位
  skip: function () {},            // 跳过当前引导
  reset: function () {},           // 重置所有引导状态（清除 localStorage）
  resetTour: function (tourId) {}, // 重置指定引导
  resetTip: function (tipId) {},   // 重置指定提示

  // 状态查询
  isActive: function () {},        // 是否有引导正在进行
  getCompleted: function () {},    // 获取已完成的引导 ID 列表

  // 手动触发（供其他模块调用）
  showTooltip: function (target, content, options) {},  // 手动显示气泡
  hideTooltip: function () {}                            // 手动隐藏气泡
};
```

---

## 九、集成点变更

### 9.1 index.html

```html
<!-- 删除 -->
<script src="js/08-onboarding.js"></script>

<!-- 新增 -->
<script src="js/09-guide.js"></script>
```

### 9.2 新增 CSS 引用

在 `css/styles.css` 的 `@import` 列表末尾追加：

```css
@import url('guide.css');
```

### 9.3 settings.html

```html
<!-- 旧 -->
<section class="settings-section">
  <h2 class="section-title">用户引导</h2>
  <div class="settings-item">
    <div class="settings-item-info">
      <span class="settings-item-label">重新查看引导</span>
      <span class="settings-item-desc">再次显示首次使用时的功能引导</span>
    </div>
    <button id="resetOnboardingBtn" class="action-btn">查看引导</button>
  </div>
</section>

<!-- 新 -->
<section class="settings-section">
  <h2 class="section-title">用户引导</h2>
  <div class="settings-item">
    <div class="settings-item-info">
      <span class="settings-item-label">重新查看引导</span>
      <span class="settings-item-desc">再次显示首次使用时的功能引导</span>
    </div>
    <button id="guideResetTourBtn" class="action-btn">查看引导</button>
  </div>
  <div class="settings-item">
    <div class="settings-item-info">
      <span class="settings-item-label">重置操作提示</span>
      <span class="settings-item-desc">恢复所有「知道了」关闭过的气泡提示</span>
    </div>
    <button id="guideResetTipsBtn" class="action-btn">重置</button>
  </div>
</section>
```

### 9.4 settings.js

```javascript
// 删除 initOnboardingReset() 函数和调用

// 新增
function initGuideControls() {
  const tourBtn = document.getElementById('guideResetTourBtn');
  const tipsBtn = document.getElementById('guideResetTipsBtn');

  if (tourBtn) {
    tourBtn.addEventListener('click', function () {
      if (window.Guide) {
        window.Guide.resetTour('welcome-tour');
        // Electron 下切回主页面并启动引导
        if (window.electronAPI && window.electronAPI.loadMainPage) {
          window.electronAPI.loadMainPage();
        } else {
          location.reload();
        }
      }
    });
  }

  if (tipsBtn) {
    tipsBtn.addEventListener('click', function () {
      if (window.Guide) {
        window.Guide.reset('tips');  // 仅重置 tips，保留 tour
        showToast('操作提示已重置'); // 假设有 toast
      }
    });
  }
}
```

### 9.5 07-integration.js（钩子暴露）

在现有事件回调中埋入引导触发标记：

```javascript
// 在 addTodo 成功后（约 L??）
localStorage.setItem('first_todo_added', '1');
if (window.Guide) window.Guide.notify('todo-added');

// 在 datetime 确认后（约 L??）
localStorage.setItem('datetime_used', '1');
```

---

## 十、实施步骤

### Phase 1：基础引擎 + 首次引导（约 2/3 工作量）

| # | 任务 | 预估耗时 | 产出 |
|---|---|---|---|
| 1 | 创建 `src/css/guide.css` — 全部组件样式 | 1.5h | 独立样式文件 |
| 2 | 创建 `src/js/09-guide.js` — GuideEngine 骨架 + Spotlight + Card | 2h | 引导引擎 |
| 3 | 实现 TOURS 配置 + 步骤调度逻辑 | 1h | 可运行的首次引导 |
| 4 | 实现定位算法（自动避让 + 翻转） | 1h | 智能定位 |
| 5 | 实现 wait 交互等待（enter-with-value / click / input） | 1h | 交互感引导 |
| 6 | 更新 `index.html` / `styles.css` 引用 | 5min | 集成 |

### Phase 2：上下文提示 + 触发器系统（约 1/3 工作量）

| # | 任务 | 预估耗时 |
|---|---|---|
| 7 | 实现 Tooltip 组件 | 0.5h |
| 8 | 实现触发器系统（event / mutation / interval） | 1.5h |
| 9 | 实现 TIPS 配置 + 条件判断 | 0.5h |
| 10 | 埋入 integration.js 钩子 | 0.5h |

### Phase 3：设置页集成 + 收尾

| # | 任务 | 预估耗时 |
|---|---|---|
| 11 | 更新 settings.html / settings.js | 0.5h |
| 12 | 删除旧文件 `08-onboarding.js` + 清理 base.css | 0.5h |
| 13 | 全场景测试（首次 / 重置 / Electron / 便签模式） | 1h |

---

## 十一、测试验收清单

### 11.1 首次引导

- [ ] 首次打开应用自动弹出欢迎卡片
- [ ] 点击「开始体验」进入输入框高亮
- [ ] 用户在输入框输入内容并回车 → 自动下一步
- [ ] 点击 📅 时间管理按钮 → 自动下一步
- [ ] 最后一步点击「开始使用」→ 引导完成，遮罩消失
- [ ] 刷新后不再自动弹出

### 11.2 上下文提示

- [ ] 首次聚焦输入框 + 无待办 → 显示自然语言提示
- [ ] 添加 1 个待办后 → 显示时间选择器提示
- [ ] 首次完成待办 → 显示已完成沉底提示
- [ ] 有待办过期 → 显示红色徽章含义提示
- [ ] 点击「知道了」→ 气泡消失，不再重复显示

### 11.3 设置页

- [ ] 点击「查看引导」→ 重置状态并回到主页面重新播放引导
- [ ] 点击「重置操作提示」→ 气泡提示恢复可触发

### 11.4 兼容性

- [ ] Electron 桌面端正常（窗口模式 / 便签模式）
- [ ] 网页版正常
- [ ] 窄屏（< 480px）卡片 / 气泡不溢出
- [ ] 窗口 resize 后高亮 / 卡片位置自适应

---

## 十二、风险与应对

| 风险 | 概率 | 影响 | 应对 |
|---|---|---|---|
| `clip-path` 镂空在旧版 Electron 渲染异常 | 中 | 高 | 降级方案：使用 4 个 div 围合镂空（兼容性强） |
| 引导触发时机与用户操作冲突 | 中 | 中 | 引导进行中时禁用其他引导；每会话最多 1 条 tip |
| MutationObserver 性能 | 低 | 中 | 只监听 `#todoList`，debounce 条件判断 |
| localStorage 被用户清除后重复引导 | 低 | 低 | 正常行为，无需处理 |
| 设置页「查看引导」后页面跳转体验 | 中 | 低 | Electron 用 `loadMainPage()`，网页用 `href` |

---

## 十三、后续扩展（非本次范围）

| 功能 | 说明 | 优先级 |
|---|---|---|
| 功能发现徽章 | 新功能入口显示「新」点 | P2 |
| 按需引导菜单 | 帮助菜单可选播放特定流程 | P2 |
| 快捷键引导 | 首次使用显示快捷键速查 | P3 |
| 便签模式引导 | 进入便签模式时简述差异 | P3 |
| 多语言引导文案 | 跟随 i18n | P3 |

---

## 十四、总结

本次重写：

- ✅ 废弃 `08-onboarding.js`（~430 行）+ `base.css` 引导样式（~220 行）
- ✅ 新增 `09-guide.js`（~400 行）+ `guide.css`（~280 行）
- ✅ 统一「首次引导 + 上下文提示 + 功能发现」三套能力
- ✅ 声明式配置，新增引导步骤只需加配置项
- ✅ 设置页支持分别重置引导和提示
- ✅ 零外部依赖，延续原生 JS 风格

---

**请审批：**
1. ☐ 方案方向 OK → 我开始实现
2. ☐ 引导步骤需要调整（增删改）
3. ☐ 上下文提示规则需要调整
4. ☐ 其他意见
