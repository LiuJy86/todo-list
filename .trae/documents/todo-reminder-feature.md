# 待办事项「提醒日期 + 音效」功能实现方案

## 一、背景与目标（Context）

当前项目（v2.0.0）是纯前端待办清单应用，技术约束：只用 HTML/CSS/JS，无框架、无后端、无数据库，数据存于 `sessionStorage`（关闭浏览器即清空）。

**新需求**：待办事项可设置提醒时间（如「8:00 提醒我吃饭」、「8月15日 提醒我开会」），到点后通过音效提醒用户。

**核心挑战**：
1. 现有 `sessionStorage` 关闭即清空，提醒数据需跨会话保留 → 升级为 `localStorage`
2. 纯前端无法依赖音频文件 → 使用 Web Audio API 程序合成「叮咚」提示音
3. 浏览器自动播放策略 → 首次用户交互后 unlock AudioContext
4. 浏览器关闭后无法提醒（纯前端固有限制）→ 在 UI 上明确告知用户

**用户已确认的关键决策**：
- ✅ 存储升级到 `localStorage`（数据永久保留，含一次性迁移）
- ✅ Web Audio API 程序生成提示音（无文件依赖）
- ✅ 输入方式：datetime-local 选择器 + 自然语言解析（两者结合）
- ✅ 触发机制：精确 setTimeout + visibilitychange 漏检 + 60s setInterval 兜底

**版本号**：`v2.1.0`（新增功能、向后兼容，符合 SemVer minor 升级）

---

## 二、数据结构设计

`todos` 数组元素结构扩展（向后兼容，旧数据自动补齐）：

```javascript
{
  id: 1692830400000,        // 唯一标识（Date.now()）
  text: '吃饭',             // 内容文本（解析后剥离时间词）
  done: false,
  remindAt: 1692830400000,  // 【新】提醒时间戳（毫秒）；无提醒为 null
  reminded: false           // 【新】是否已触发提醒；触发后置 true，防重复响铃
}
```

---

## 三、文件改动一览

| 文件 | 改动量 | 关键改动 |
|---|---|---|
| `script.js` | 大 | 存储升级、addTodo 扩展、新增第 11 节提醒模块 IIFE |
| `index.html` | 中 | 输入区新增 datetime-local + 提示条 |
| `style.css` | 中 | 新增徽章/抖动/提示条样式 + 4 个 CSS 变量 |
| `CHANGELOG.md` | 小 | 新增 v2.1.0 条目 |
| `Task.md` | 小 | 新增任务 15 + 验收标准 |
| `.claude/requirement.md` | 小 | 新增需求条目 10 |

---

## 四、实现要点

### 4.1 存储升级（script.js:26-41）

- `save()` 改用 `localStorage.setItem`
- `load()` 优先读 localStorage；若 localStorage 为空但 sessionStorage 有旧数据，一次性迁移：搬到 localStorage 并 `sessionStorage.removeItem('todos')` 清掉旧位置
- 旧事项缺失的 `remindAt` / `reminded` 字段在 load 后补齐（`remindAt = null`, `reminded = false`）

### 4.2 UI 输入区（index.html:38-48）

在 `#todoInput` 与 `#addBtn` 之间插入 datetime-local：

```html
<input type="datetime-local" id="remindAtInput" title="选择提醒时间（可选）">
```

列表区上方新增提示条：
```html
<div id="reminderNotice" class="reminder-notice">
  提示：浏览器完全关闭后无法触发提醒，请保持本页面打开
</div>
```

### 4.3 自然语言解析（parseReminderFromText）

| 输入 | 解析结果 |
|---|---|
| `8:00 吃饭` | 今天 8:00（若已过则明天 8:00），文本=「吃饭」 |
| `15:30 开会` | 今天 15:30（已过则明天） |
| `明天8:00 跑步` | 明天 8:00 |
| `8月15日 8:00 月度会议` | 当年 8 月 15 日 8:00（已过则明年） |
| `8月15日 出差` | 当年 8 月 15 日 9:00（默认 9 点） |
| `买牛奶` | 解析失败 → 无提醒，原文本保留 |

解析失败时回退到 datetime-local 的值；都为空则纯添加（不阻断流程）。

### 4.4 Web Audio API 提示音

- 「叮咚」两声：880Hz「叮」+ 660Hz「咚」，间隔 180ms
- 封装 `playReminderSound()`，用 oscillator + gain 包络避免爆音
- `unlockAudio()` 监听首次 click/keydown/touchstart（`{ once: true }`），创建并 resume AudioContext
- 未 unlock 时到点跳过声音但保留视觉反馈（不报错）

### 4.5 触发调度（三道保障）

```javascript
const reminderTimers = new Map();  // todo.id → setTimeout timerId

scheduleReminder(todo)       // 精确 setTimeout 到点触发
scheduleAllReminders()        // 启动时扫描所有未提醒事项调度
cancelReminder(id)            // 删除/完成时取消定时器
checkMissedReminders()        // 漏检补触发（已到点但 reminded=false）
triggerReminder(todo)         // 触发：音效+高亮+气泡+reminded=true+save
```

- 启动时调用 `scheduleAllReminders()`
- `visibilitychange` 切回前台时调用 `checkMissedReminders()`
- `setInterval(checkMissedReminders, 60000)` 后台兜底
- `triggerReminder` 先置 `reminded=true` + `save()`，防重 + 防刷新后重响

### 4.6 到点反馈链路

```
时间到 → triggerReminder(todo)
  ├─ todo.reminded = true; save()
  ├─ playReminderSound()                  // 叮咚
  ├─ li.classList.add('reminding')         // 红框 + 抖动 6s
  ├─ petMood.excited() + petMood.toast('该 XXX 啦！', 'warning')  // 史迪奇弹气泡
  ├─ cancelReminder(id)                   // 清定时器
  └─ render()                              // 徽章切到「已过期」状态
```

### 4.7 与现有代码集成点

| 位置 | 改动 |
|---|---|
| `script.js:6-8` 注释 | 更新数据结构示例 |
| `script.js:26-41` save/load | 改用 localStorage + 迁移 |
| `script.js:47-49` 元素引用 | 新增 `remindAtInput` 引用 |
| `script.js:235-272` createTodoElement | 有 remindAt 时追加 `<span class="reminder-badge">` |
| `script.js:277-283` updateItemState | 增加 `reminded` class + 调用 `updateReminderBadge` |
| `script.js:288-316` addTodo | 签名改 `addTodo(remindAt)`，对象新增 `remindAt/reminded`，返回新增对象 |
| `script.js:325-366` toggleTodo | 完成时 cancelReminder；取消完成时若未到点重 schedule |
| `script.js:373-382` deleteTodo | 调 `cancelReminder(id)` |
| `script.js:405-406` 启动区 | load + render 后追加 `scheduleAllReminders()` |
| `script.js:877-885` visibilitychange | 切回前台追加 `checkMissedReminders()` |
| `script.js:1114-1121` wrappedAddTodo | 整合：解析 → 同步 datetime-local → addTodo(remindAt) → scheduleReminder |
| `script.js` 末尾（行 1175 后） | 新增第 11 节提醒模块 IIFE |

### 4.8 徽章状态变色

| 距离提醒 | 颜色 | 文案 | 动画 |
|---|---|---|---|
| > 1 天 | 灰色 `#8888a0` | `8月15日 08:00` | 无 |
| ≤ 1 天，> 1 小时 | 紫色 `#667eea` | `8月15日 08:00` | 无 |
| ≤ 1 小时 | 橙色 `#ffa726` | `还有 N 分钟` | 脉冲 |
| 已过期 | 红色 `#ff6b6b` | `8月15日 08:00 已过` | 删除线 |

每 30 秒 setInterval 仅刷新徽章 textContent（不调用 render，避免反复写 localStorage）。

### 4.9 CSS 新增样式

新增 4 个 CSS 变量（`:root`）：`--reminder-far/soon/urgent/overdue`

新增样式块：
- `#remindAtInput` 样式（与 `#todoInput` 风格统一）
- `.reminder-badge` + 4 个状态变体（far/soon/urgent/overdue）
- `.reminder-badge-urgent` 脉冲动画 `badge-pulse`
- `.todo-item.reminding` 红框 + 抖动 `reminder-shake`
- `.todo-item.reminded::before` 小铃铛 🔔 标识
- `.reminder-notice` 提示条样式（虚线橙色边框）
- `@media (max-width: 600px)` datetime-local 换行适配

---

## 五、新增「提醒模块」IIFE 结构（script.js 末尾）

```javascript
// ===== 11. 提醒模块（提醒日期 + 音效）=====
(function () {
  'use strict';
  const reminderTimers = new Map();
  let audioCtx = null;

  // 11.2 时间格式化
  function formatReminderText(ts) { /* "8月15日 08:00" */ }
  function formatToLocalInputValue(date) { /* datetime-local 接受的格式 */ }

  // 11.3 自然语言解析
  function parseReminderFromText(rawText) { /* 4 条规则 */ }

  // 11.4 Web Audio 提示音
  function unlockAudio() { /* 首次交互 resume */ }
  function playReminderSound() { /* 叮咚两声 */ }
  ['click', 'keydown', 'touchstart'].forEach(function (e) {
    document.addEventListener(e, unlockAudio, { once: true });
  });

  // 11.5 调度与触发
  function scheduleReminder(todo) { /* setTimeout 精确触发 */ }
  function scheduleAllReminders() { /* 启动时扫描 */ }
  function cancelReminder(id) { /* 清除定时器 */ }
  function checkMissedReminders() { /* 漏检补触发 */ }
  function triggerReminder(todo) { /* 完整反馈链路 */ }
  function updateReminderBadge(li, todo) { /* 徽章文案与颜色 */ }

  // 11.6 兜底定时器
  setInterval(checkMissedReminders, 60000);
  setInterval(updateAllBadges, 30000);

  // 11.7 暴露接口
  window.reminderModule = {
    parse: parseReminderFromText,
    schedule: scheduleReminder,
    scheduleAll: scheduleAllReminders,
    cancel: cancelReminder,
    trigger: triggerReminder,
    playSound: playReminderSound,
    updateBadge: updateReminderBadge
  };

  // 11.8 启动调度（推到下一个事件循环，确保 todos 已就绪）
  setTimeout(scheduleAllReminders, 0);
})();
```

---

## 六、实施顺序（按依赖关系）

每步可独立验证，符合 CLAUDE.md「每次只完成一个任务」原则：

1. **存储升级** → 刷新页面数据保留即可验证
2. **数据结构扩展**（addTodo 接受 remindAt）→ 控制台手动调用验证
3. **HTML 输入区改造** → 视觉验证
4. **CSS 样式** → 静态视觉验证
5. **createTodoElement 徽章渲染 + updateItemState 刷新** → 添加事项看到徽章
6. **自然语言解析** → 控制台 `reminderModule.parse('8:00 吃饭')` 验证
7. **wrappedAddTodo 整合** → 输入"8:00 吃饭"看到 datetime-local 同步
8. **Web Audio 提示音** → 点击页面后到点听到叮咚
9. **scheduleReminder + triggerReminder** → 设置 30 秒后提醒到点响铃
10. **visibilitychange + 60s setInterval 兜底** → 切后台再切回补触发
11. **deleteTodo / toggleTodo 集成 cancelReminder** → 删除/完成不响铃
12. **启动区 scheduleAllReminders** → 刷新后已设提醒仍生效
13. **CHANGELOG + Task.md + requirement.md 文档更新** → v2.1.0 写入

---

## 七、验收标准

### 数据与存储
- [ ] 添加带提醒事项后刷新页面，数据仍在（localStorage）
- [ ] 老版本 sessionStorage 数据首次打开新版本自动迁移到 localStorage
- [ ] 旧事项（无 remindAt 字段）打开后无徽章、控制台无报错
- [ ] 关闭浏览器再打开，提醒事项仍保留

### 输入与解析
- [ ] `8:00 吃饭` → 文本框变「吃饭」，datetime-local 显示今天 08:00
- [ ] `15:30 开会`（已过）→ datetime-local 自动改为明天 15:30
- [ ] `明天8:00 跑步` → 明天 8:00
- [ ] `8月15日 8:00 月度会议` → 当年 8 月 15 日 8:00
- [ ] `8月15日 出差` → 默认 9:00
- [ ] 纯文本 `买牛奶` → 正常添加，无徽章
- [ ] datetime-local 填值、文本框写 `开会` → 用 datetime-local 时间
- [ ] 文本框为空但 datetime-local 有值 → 红边框提示

### 提醒触发
- [ ] 设置 30 秒后提醒 → 到点播放「叮咚」
- [ ] 到点 `<li>` 红框 + 抖动 6 秒
- [ ] 到点史迪奇弹气泡「该 XXX 啦！」（黄色 warning 边框）
- [ ] 到点徽章变红色删除线
- [ ] reminded = true 写入 localStorage，刷新后不再响
- [ ] 到点前删除事项 → 不触发
- [ ] 到点前勾选完成 → 不触发

### 触发保障
- [ ] 切到后台 → 60 秒后切回，过期提醒立即补触发
- [ ] 长时间后台 → 切回时漏掉的提醒一次性全部触发
- [ ] 同一提醒不会重复触发

### 徽章状态
- [ ] 2 天后提醒 → 灰色徽章
- [ ] ≤ 1 天 → 紫色徽章
- [ ] ≤ 1 小时 → 橙色脉冲 + 「还有 N 分钟」
- [ ] 已提醒过 → 红色删除线 + 「已过」

### 兼容性（无回归）
- [ ] 现有收纳逻辑（> 5 待办 / > 3 已完成）正常
- [ ] 桌宠拖拽、避障、GIF 轮播、情绪反馈全部正常
- [ ] 现有 addBtn / 回车 / 删除 / 完成 事件链路无回归

---

## 八、已知限制

1. **浏览器关闭后无法提醒**：纯前端无后台进程；通过 UI 提示条明确告知用户保持页面打开
2. **未首次交互前无法播放音效**：浏览器自动播放策略；首次交互后 unlock，未 unlock 时仍有视觉反馈
3. **长时间后台标签页可能延迟**：浏览器降频定时器；visibilitychange + 60s 兜底确保最迟 1 分钟内补触发
4. **跨设备不同步**：localStorage 仅限当前浏览器当前设备；要跨设备需后端，超出项目约束

---

## 九、关键复用点

- 复用 `window.petMood.toast(text, type)` 显示对话气泡（script.js:1015-1036）
- 复用 `window.petMood.excited()` 触发桌宠兴奋动画
- 复用现有 `nodeCache`（Map）减少 DOM 重建
- 复用 CSS 变量体系（`--accent-color` / `--delete-color` / `--radius-*` / `--transition-*`）
- 复用现有红边框输入提示机制（script.js:293-299）
- 复用 `wrappedAddTodo` 已替换的 addBtn 监听（无需重绑事件）
- 复用 `visibilitychange` 现有监听器追加逻辑（不重复绑定）
