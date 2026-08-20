// ===== 待办事项清单 - 交互脚本 =====


// ---------- 1. 数据层 ----------

// 数据源：所有待办事项都存在这个数组里
// 每条事项结构（v2.7.0 扩展）：
//   { id: 唯一标识, text: 内容文本, done: 是否已完成,
//     remindAt: 提醒时间戳（毫秒，无提醒为 null）,
//     reminded: 是否已触发过本轮提醒（防重复响铃）,
//     recurrence: {                    // 循环设置（null=不循环）
//       enabled: true/false,
//       interval: 30,                   // 间隔数值
//       unit: 'minute'|'hour'|'day'|'week',
//       targetCount: null,              // 目标次数（null=无限循环）
//     },
//     completionCount: 0,               // 完成次数（循环专用）
//     lastRemindAt: 上次实际提醒时间戳,    // 循环调度用
//     targetCount: null,                // 目标执行次数（从 recurrence 同步）
//   }
// 后续的「添加 / 标记完成 / 删除 / 持久化 / 提醒调度」都围绕这个数组进行
let todos = [];

// localStorage 的键名（固定常量，便于统一管理与修改）
// v2.1.0 起从 sessionStorage 升级为 localStorage，让数据跨会话保留以支持提醒功能
const STORAGE_KEY = 'todos';

// 收纳状态：已完成项超过此数量则自动收纳
const VISIBLE_COMPLETED_LIMIT = 3;
// 展开/收起状态（只用于已完成收纳）
let isExpanded = false;


// 【新增】便签模式折叠状态（默认展开）
let stickyCollapsed = false;
let stickyWidthBeforeCollapse = 480; // 折叠前记住的宽度


// ---------- 1.1 存储相关：保存与读取 ----------

// 保存：把当前 todos 数组序列化为 JSON 字符串，存入 localStorage
// 调用时机：任何数据变更后统一调用（见 render() 末尾）
function save() {
  // JSON.stringify 把 JS 数组转成字符串，因为 localStorage 只能存字符串
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

// 读取：从 localStorage 取出字符串并反序列化回数组
// 调用时机：页面加载时调用一次，恢复上次的数据
// 兼容老版本：若 localStorage 没数据但 sessionStorage 有，则一次性迁移过来
function load() {
  // getItem 取出字符串；若键不存在则返回 null
  let data = localStorage.getItem(STORAGE_KEY);
  // 迁移：localStorage 没有、但 sessionStorage 有旧数据时，搬到 localStorage
  // 这样老版本用户首次打开 v2.1.0 时数据自动迁移，无感知
  if (!data) {
    const legacyData = sessionStorage.getItem(STORAGE_KEY);
    if (legacyData) {
      localStorage.setItem(STORAGE_KEY, legacyData);
      sessionStorage.removeItem(STORAGE_KEY);  // 清掉旧位置，避免双源
      data = legacyData;
    }
  }
  // 只有存在数据时才解析，避免 JSON.parse(null) 报错
  if (data) {
    // JSON.parse 把字符串还原成 JS 数组，赋值回 todos
    todos = JSON.parse(data);
    // 数据兼容：补齐旧事项缺失的新字段
    todos.forEach(function (t) {
      if (t.remindAt === undefined) t.remindAt = null;
      if (t.reminded === undefined) t.reminded = false;
      if (t.recurrence === undefined) t.recurrence = null;
      if (t.completionCount === undefined) t.completionCount = 0;
      if (t.lastRemindAt === undefined) t.lastRemindAt = null;
    });
  }
}


// ---------- 2. 获取页面元素 ----------

// 通过 id 拿到 HTML 中的关键元素，后续操作都基于这些引用
const todoInput = document.getElementById('todoInput');  // 输入框
const remindAtInput = document.getElementById('remindAtInput');  // 已废弃（v2.4.0 用 datetime picker 替代），保留兼容引用
const datetimePicker = document.getElementById('datetimePicker');  // 自定义日期时间选择器容器
const datetimeTrigger = document.getElementById('datetimeTrigger');  // 触发按钮
const datetimeDisplay = document.getElementById('datetimeDisplay');  // 显示文本
const datetimePopover = document.getElementById('datetimePopover');  // Popover 浮层
const addBtn = document.getElementById('addBtn');        // 添加按钮
const todoList = document.getElementById('todoList');    // 列表容器（<ul>）


// ---------- 3. DOM 节点缓存 ----------

// 缓存已创建的 <li> 节点，避免每次都重新创建导致闪动
// key: todo.id, value: <li> 元素
const nodeCache = new Map();


// ---------- 4. 渲染函数：增量更新 DOM，不做全量重建 ----------

function render() {
  // 分离未完成和已完成
  // 未完成项倒序：最新添加的显示在最上面
  const pending = todos.filter(function (t) { return !t.done; }).reverse();
  const done = todos.filter(function (t) { return t.done; });

  // 收纳判断：只保留已完成收纳，未完成项永不收纳
  const hasDoneCollapsible = done.length > 0; // 只要有已完成项就显示收纳按钮
  var isStickyMode = document.body.classList.contains('sticky-mode');

  // 计算可见项：未完成项全部显示，已完成项按展开/收起决定
  // 未完成项倒序：最新添加的显示在最上面
  let visiblePending = pending;
  let visibleDone = (hasDoneCollapsible && !isExpanded) ? [] : done;

  // 整体可见项顺序：未完成（最新在上）→ 已完成（底部）
  const visibleItems = visiblePending.concat(visibleDone);

  // 顺序可能变化（未完成倒序），清空缓存让节点重建
  nodeCache.clear();

  // 第一步：处理可见项的 DOM 节点（移动/创建/更新）
  const rebuiltIds = new Set(); // 记录本次新建的节点 ID
  visibleItems.forEach(function (todo, index) {
    let li = nodeCache.get(todo.id);
    if (!li) {
      // 缓存中没有 → 创建新节点，并移除 DOM 中可能残留的同 ID 旧节点
      const oldNode = todoList.querySelector('.todo-item[data-id="' + todo.id + '"]');
      if (oldNode) oldNode.remove();
      li = createTodoElement(todo);
      nodeCache.set(todo.id, li);
      rebuiltIds.add(todo.id);
    }
    // 确保节点在正确位置（用 insertBefore 移动节点，浏览器不会闪动）
    const refNode = todoList.children[index];
    if (refNode !== li) {
      todoList.insertBefore(li, refNode || null);
    }
    // 更新完成状态（仅切换 class 和 checkbox，不重建 DOM）
    updateItemState(li, todo);
  });

  // 【v2.7.0 新增】移除不在可见列表中的 DOM 节点（如被收纳的已完成项）
  const visibleIds = new Set(visibleItems.map(function (t) { return t.id; }));
  Array.from(todoList.children).forEach(function (child) {
    // 只处理待办项节点，跳过收纳按钮和收纳容器
    if (child.classList && child.classList.contains('todo-item')) {
      const itemId = parseInt(child.dataset.id, 10);
      if (!visibleIds.has(itemId)) {
        child.remove();
      }
    }
  });

  // 第二步：处理收纳区 UI（只保留已完成收纳按钮）
  let collapseBtn = document.getElementById('collapseBtn');
  let collapsedList = document.getElementById('collapsedList');

  // 移除可能残留的未完成收纳按钮（兼容旧版本）
  var pendingCollapseBtn = document.getElementById('pendingCollapseBtn');
  if (pendingCollapseBtn) {
    pendingCollapseBtn.remove();
    pendingCollapseBtn = null;
  }

  // 收纳区 UI：只保留已完成收纳按钮
  if (hasDoneCollapsible) {
    if (!collapseBtn) {
      collapseBtn = document.createElement('li');
      collapseBtn.id = 'collapseBtn';
      collapseBtn.className = 'collapse-btn';
      collapseBtn.addEventListener('click', function () {
        isExpanded = !isExpanded;
        render();
      });
    }
    // 更新文案
    const hiddenCount = done.length;
    if (isExpanded) {
      collapseBtn.innerHTML = '<span>收起 ▲</span>';
      collapseBtn.classList.add('expanded');
    } else {
      collapseBtn.innerHTML = '<span>还有 <strong id="collapseCount">' + hiddenCount + '</strong> 项已完成待办</span><span class="arrow">▼</span>';
      collapseBtn.classList.remove('expanded');
    }
    // 按钮位置：紧接在已完成可见项之后
    const offset = visiblePending.length + visibleDone.length;
    const btnRef = todoList.children[offset];
    if (btnRef !== collapseBtn) {
      todoList.insertBefore(collapseBtn, btnRef || null);
    }

    // 收纳容器（展开时显示所有被收纳的已完成项）
    if (!collapsedList) {
      collapsedList = document.createElement('ul');
      collapsedList.id = 'collapsedList';
      collapsedList.className = 'collapsed-list';
    }
    const listRef = collapseBtn.nextSibling;
    if (listRef !== collapsedList) {
      todoList.insertBefore(collapsedList, listRef);
    }
    collapsedList.style.display = isExpanded ? 'flex' : 'none';
  } else {
    // 没有已完成项，移除收纳 UI
    if (collapseBtn) collapseBtn.remove();
    if (collapsedList) collapsedList.remove();
  }

  // 第三步：清理已删除项的缓存节点
  const activeIds = new Set(todos.map(function (t) { return t.id; }));
  nodeCache.forEach(function (node, id) {
    if (!activeIds.has(id)) {
      node.remove();
      nodeCache.delete(id);
    }
  });

  // 保存数据
  save();

  // 便签模式：每次渲染后根据内容自适应窗口高度
  adjustStickyWindowHeight();
}

// 便签模式窗口高度自适应：有多少待办，窗口就有多大
function adjustStickyWindowHeight() {
  // 只在便签模式且未折叠时调整
  if (!document.body.classList.contains('sticky-mode')) return;
  if (stickyCollapsed) return;
  if (!window.electronAPI || !window.electronAPI.resizeWindow) return;

  // 双重 requestAnimationFrame：等浏览器完成样式计算和布局后再测量
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      // 测量 todoList 容器的 offsetHeight（包含所有子元素、padding）
      const todoList = document.getElementById('todoList');
      const listHeight = todoList ? todoList.offsetHeight : 0;

      // header 高度（标题栏）
      const header = document.querySelector('header');
      const headerHeight = header ? header.offsetHeight : 40;

      // 计算总高度：header + 列表 + 40px 留白（确保内容完整显示）
      const EXTRA_PADDING = 40;
      const contentHeight = headerHeight + listHeight + EXTRA_PADDING;

      // 计算目标高度，设置上下限
      const MIN_HEIGHT = 80;      // 最小高度：只显示标题栏
      const MAX_HEIGHT = 600;     // 最大高度：防止窗口过高，超出部分滚动
      const targetHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, contentHeight));

      // 宽度固定为进入便签模式时的宽度，不随内容变化
      const fixedWidth = window.stickyModeWidth || 480;
      window.electronAPI.resizeWindow(fixedWidth, targetHeight);
    });
  });
}


// ---------- 4.1 创建单条待办事项 DOM ----------

function createTodoElement(todo) {
  const li = document.createElement('li');
  li.className = 'todo-item';
  li.dataset.id = todo.id;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'todo-checkbox';
  checkbox.addEventListener('change', function () {
    if (typeof window.wrappedToggleTodo === 'function') {
      window.wrappedToggleTodo(todo.id);
    } else {
      toggleTodo(todo.id);
    }
  });

  const span = document.createElement('span');
  span.className = 'todo-text';
  span.textContent = todo.text;

  // 【双击编辑】双击待办文字可原地编辑
  span.addEventListener('dblclick', function (e) {
    e.stopPropagation();
    // 如果已经在编辑状态，不重复触发
    if (span.classList.contains('editing')) return;
    // 已完成的事项不允许编辑
    if (todo.done) return;

    span.classList.add('editing');
    const originalText = todo.text;
    // 创建输入框替代原文本
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'todo-edit-input';
    input.value = originalText;
    span.textContent = '';
    span.appendChild(input);
    input.focus();
    input.select();

    // 保存编辑
    function saveEdit() {
      const newText = input.value.trim();
      span.classList.remove('editing');
      if (newText && newText !== originalText) {
        // 更新数据
        todo.text = newText;
        // 如果原文本有提醒时间，重新解析新文本
        if (todo.remindAt && window.reminderModule) {
          const parsed = window.reminderModule.parse(newText);
          if (parsed.remindAt) {
            todo.remindAt = parsed.remindAt;
            todo.text = window.reminderModule.cleanTodoText(parsed.text);
          }
        }
        save();
        render();
        // 史迪奇反馈
        if (window.petMood) {
          window.petMood.toast('已更新待办内容，加油！', 'info');
        }
      } else {
        // 没改动或为空，恢复原文
        render();
      }
    }
    // 取消编辑
    function cancelEdit() {
      span.classList.remove('editing');
      render();
    }

    // 按 Enter 保存，按 Esc 取消，失去焦点也保存
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
    });
    input.addEventListener('blur', function () {
      saveEdit();
    });
  });

  // 构造 Tooltip 内容
  const tooltipParts = [];
  if (todo.remindAt) {
    const d = new Date(todo.remindAt);
    const dateStr = d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' +
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    tooltipParts.push('⏰ ' + dateStr);
  }
  if (todo.recurrence && todo.recurrence.enabled) {
    const unitMap = { minute: '分钟', hour: '小时', day: '天', week: '周' };
    let cycleText = '🔄 循环：每 ' + todo.recurrence.interval + ' ' + unitMap[todo.recurrence.unit];
    // 有目标次数时，在循环信息后追加次数进度
    if (todo.targetCount && todo.targetCount > 0) {
      cycleText += '（' + (todo.completionCount || 0) + '/' + todo.targetCount + ' 次）';
    }
    tooltipParts.push(cycleText);
  }
  if (tooltipParts.length > 0) {
    li.setAttribute('data-tooltip', tooltipParts.join(' | '));
    li.classList.add('has-tooltip');
  }

  // 【次数已集成到循环提醒】非循环事项不再显示独立计数器
  // 判断是否为循环事项（需要在添加 badge 前决定按钮区域）
  const isCycle = todo.recurrence && todo.recurrence.enabled;

  if (todo.remindAt || isCycle) {
    li.appendChild(checkbox);
    li.appendChild(span);

    // 提醒徽章（仅有 remindAt 时显示）
    if (todo.remindAt) {
      const badge = document.createElement('span');
      badge.className = 'reminder-badge';
      li.appendChild(badge);

      // 循环徽章装饰
      if (isCycle) {
        badge.classList.add('reminder-badge-cycle');
      }
    }

    // 循环完成次数小徽章（有目标次数时显示 "×2/8"，无目标时显示 "×2"）
    if (isCycle && todo.completionCount > 0) {
      const countBadge = document.createElement('span');
      countBadge.className = 'completion-count';
      if (todo.targetCount && todo.targetCount > 0) {
        // 有目标次数：显示 "已完成/总次数"
        countBadge.textContent = '×' + todo.completionCount + '/' + todo.targetCount;
      } else {
        // 无目标次数：只显示完成数
        countBadge.textContent = '×' + todo.completionCount;
      }
      li.appendChild(countBadge);
    }

    // 停止循环按钮（所有循环事项都显示，不依赖 remindAt）
    if (isCycle) {
      const stopBtn = document.createElement('button');
      stopBtn.className = 'stop-cycle-btn';
      stopBtn.textContent = '⏹';
      stopBtn.title = '停止循环提醒';
      stopBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        if (window.reminderModule) {
          window.reminderModule.stopCycle(todo.id);
        }
      });
      li.appendChild(stopBtn);
    }
  } else {
    li.appendChild(checkbox);
    li.appendChild(span);
  }

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = '删除';
  deleteBtn.addEventListener('click', function () {
    if (typeof window.wrappedDeleteTodo === 'function') {
      window.wrappedDeleteTodo(todo.id);
    } else {
      deleteTodo(todo.id);
    }
  });

  // 【长文本展开/收起】文字超过 3 行时添加展开按钮
  // 通过比较 scrollHeight 和 clientHeight 判断是否被截断
  requestAnimationFrame(function () {
    if (span.scrollHeight > span.clientHeight + 2) {
      li.classList.add('has-long-text');
      const expandBtn = document.createElement('span');
      expandBtn.className = 'todo-expand-btn';
      expandBtn.textContent = '展开';
      expandBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        span.classList.toggle('expanded');
        expandBtn.textContent = span.classList.contains('expanded') ? '收起' : '展开';
      });
      li.appendChild(expandBtn);
    }
  });

  li.appendChild(deleteBtn);
  return li;
}


// ---------- 4.2 更新单项的完成状态（仅切换 class/checked，不重建） ----------

function updateItemState(li, todo) {
  li.classList.toggle('completed', todo.done);
  // 切换已提醒标记 class（CSS 据此显示左上角小铃铛）
  li.classList.toggle('reminded', !!todo.reminded);
  const checkbox = li.querySelector('.todo-checkbox');
  if (checkbox) {
    checkbox.checked = todo.done;
  }
  // 【v2.7.0 新增】同步文本内容（修复双击编辑后不刷新的问题）
  // 仅在非编辑状态下更新，避免覆盖用户正在输入的内容
  const textSpan = li.querySelector('.todo-text');
  if (textSpan && !textSpan.classList.contains('editing') && textSpan.textContent !== todo.text) {
    textSpan.textContent = todo.text;
  }
  // 刷新提醒徽章的文案与颜色（按距离提醒时间变色）
  updateReminderBadge(li, todo);
}


// ---------- 4.3 提醒徽章刷新 ----------

// 时间戳格式化为"8月15日 08:00"样式，便于用户阅读
function formatReminderText(ts) {
  const d = new Date(ts);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return m + '月' + day + '日 ' + hh + ':' + mm;
}

// 根据距离提醒时间的远近，刷新徽章文案与颜色 class
// 规则：> 1天 灰色 / ≤1天且>1小时 紫色 / ≤1小时 橙色脉冲 / 已过期 红色删除线
function updateReminderBadge(li, todo) {
  const badge = li.querySelector('.reminder-badge');
  if (!badge) return;       // 无徽章节点（未设提醒的事项）
  if (!todo.remindAt) return;

  const now = Date.now();
  const diff = todo.remindAt - now;  // 正：未来；负：已过期

  // 清掉旧的状态类，避免叠加
  badge.classList.remove(
    'reminder-badge-far', 'reminder-badge-soon',
    'reminder-badge-urgent', 'reminder-badge-overdue'
  );

  if (todo.reminded || diff <= 0) {
    // 已提醒过或已过期：红色删除线
    badge.textContent = formatReminderText(todo.remindAt) + ' 已过';
    badge.classList.add('reminder-badge-overdue');
  } else if (diff > 86400000) {
    // > 1 天：灰色
    badge.textContent = formatReminderText(todo.remindAt);
    badge.classList.add('reminder-badge-far');
  } else if (diff > 3600000) {
    // ≤ 1 天且 > 1 小时：紫色
    badge.textContent = formatReminderText(todo.remindAt);
    badge.classList.add('reminder-badge-soon');
  } else {
    // ≤ 1 小时：橙色 + 脉冲 + 倒计时
    const mins = Math.max(1, Math.round(diff / 60000));
    badge.textContent = '还有 ' + mins + ' 分钟';
    badge.classList.add('reminder-badge-urgent');
  }
}


// ---------- 4. 添加待办事项 ----------

// 添加待办事项
// 参数：remindAt（可选）— 提醒时间戳（毫秒）；recurrence（可选）— 循环设置对象
// 返回值：新增的事项对象（供调用方调度提醒）；空输入时返回 undefined
function addTodo(remindAt, recurrence) {
  // 1) 读取输入框的值，并用 trim() 去除首尾空格
  const text = todoInput.value.trim();

  // 2) 空内容不添加：让输入框边框闪红一下作为提示
  if (text === '') {
    todoInput.style.borderColor = '#e74c3c';  // 红色边框
    // 300 毫秒后恢复默认边框色（清空 inline 样式，回到 CSS 控制）
    setTimeout(function () {
      todoInput.style.borderColor = '';
    }, 300);
    return;  // 直接返回，不执行后续添加逻辑
  }

  // 3) 构造新事项对象，推入数组
  // id 用 Date.now()（当前毫秒时间戳）保证唯一
  // remindAt：提醒时间戳（毫秒），无提醒为 null
  // reminded：是否已触发过本轮提醒，初始 false
  // recurrence：循环设置，无循环为 null（内含 targetCount：目标次数）
  // completionCount：完成次数，初始 0
  // targetCount：从循环设置中取（循环专用，非循环事项为 null）
  // currentCount：当前已执行次数，初始 0（非循环事项保持 0）
  const newTodo = {
    id: Date.now(),
    text: text,
    done: false,
    remindAt: remindAt || null,
    reminded: false,
    recurrence: recurrence || null,
    completionCount: 0,
    lastRemindAt: null,
    targetCount: (recurrence && recurrence.targetCount) ? recurrence.targetCount : null,
    currentCount: 0
  };
  todos.push(newTodo);

  // 4) 数据已变，重新渲染列表
  render();

  // 5) 清空输入框，并重新聚焦
  todoInput.value = '';
  todoInput.focus();

  // 6) 返回新增的事项对象，供调用方调度提醒
  return newTodo;
}


// ---------- 5. 切换完成状态 ----------

// 切换事项完成状态，并按规则重排列表顺序：
//   - 勾选（done 由 false → true）：将该事项移至数组末尾（已完成区末尾）
//   - 取消勾选（done 由 true → false）：将该事项插入到「所有未完成事项之后、
//     已完成事项之前」，保持未完成组按原添加顺序向上冒泡
function toggleTodo(id) {
  const todo = todos.find(function (t) {
    return t.id === id;
  });

  if (!todo) return;

  // 循环待办：勾选完成时的特殊处理（v2.4.0）
  if (todo.recurrence && todo.recurrence.enabled && !todo.done) {
    // 1) 记录完成次数
    todo.completionCount = (todo.completionCount || 0) + 1;

    // 2) 检查是否达到目标次数 → 达到则停止循环并完成
    const targetCount = todo.targetCount || (todo.recurrence && todo.recurrence.targetCount);
    if (targetCount && todo.completionCount >= targetCount) {
      // 达到目标次数：停止循环，标记完成
      if (window.reminderModule) {
        window.reminderModule.cancel(todo.id);
      }
      todo.done = true;
      todo.completedAt = Date.now();
      todo.recurrence = null; // 关闭循环
      if (window.petMood) {
        window.petMood.happy();
        window.petMood.toast('🎉 已完成 ' + targetCount + ' 次！循环提醒结束，太棒了！', 'success');
      }
      save();
      render();
      return;
    }

    // 3) 推进到下一个周期
    if (window.reminderModule) {
      const intervalMs = window.reminderModule.getIntervalMs(todo.recurrence);
      if (intervalMs) {
        todo.remindAt = Date.now() + intervalMs;
        todo.reminded = false;
        todo.lastRemindAt = Date.now();
      }
    }

    // 4) 保持未完成态
    todo.done = false;

    // 5) 调度下一轮
    if (window.reminderModule && todo.remindAt) {
      window.reminderModule.schedule(todo);
    }

    save();
    render();
    return;
  }

  // 非循环待办：保持原有逻辑
  todo.done = !todo.done;

  // 记录完成时间（用于日报统计）
  if (todo.done) {
    todo.completedAt = Date.now();
  } else {
    todo.completedAt = null;
  }

  if (window.reminderModule) {
    if (todo.done) {
      window.reminderModule.cancel(id);
    } else if (todo.remindAt && !todo.reminded) {
      window.reminderModule.schedule(todo);
    }
  }

  const remaining = todos.filter(function (t) {
    return t.id !== id;
  });

  if (todo.done) {
    remaining.push(todo);
  } else {
    const firstDoneIndex = remaining.findIndex(function (t) {
      return t.done;
    });
    if (firstDoneIndex === -1) {
      remaining.push(todo);
    } else {
      remaining.splice(firstDoneIndex, 0, todo);
    }
  }

  todos = remaining;
  save();
  render();
}


// ---------- 6. 删除待办事项 ----------

// 通过 id 从数组中移除对应事项，再重新渲染
// 用 filter 返回一个不含目标 id 的新数组，赋值回 todos
function deleteTodo(id) {
  // 删除前先取消该事项的提醒定时器，避免定时器残留导致幽灵提醒
  if (window.reminderModule) {
    window.reminderModule.cancel(id);
  }

  // filter 会遍历数组，返回 true 的元素保留、返回 false 的丢弃
  // 这里保留所有「id 不等于目标 id」的事项，即把目标事项排除掉
  todos = todos.filter(function (t) {
    return t.id !== id;
  });

  // 数据已变，重新渲染列表
  render();
}


// ---------- 7. 事件监听 ----------

// 点击「添加」按钮时调用 addTodo
addBtn.addEventListener('click', addTodo);

// 在输入框中按回车也能添加，提升输入体验
todoInput.addEventListener('keydown', function (e) {
  // e.key 表示按下的键，'Enter' 即回车键
  if (e.key === 'Enter') {
    addTodo();
  }
});


// ---------- 8. 页面初始化 ----------

// 脚本执行到此，说明函数定义与事件监听都已就绪
// 先从 sessionStorage 读取上次会话的数据
load();
// 再根据读取到的数据渲染列表（若有历史数据则会显示出来）
render();

// 检测 Electron 环境，给 body 添加 class（用于隐藏桌面端不需要的元素）
if (window.electronAPI) {
  document.body.classList.add('electron');
}

// ---------- 9. 便签模式与置顶（Electron 通信） ----------

// 监听 Electron 主进程发来的便签模式切换消息
if (window.electronAPI && window.electronAPI.onStickyMode) {
  window.electronAPI.onStickyMode(function (enabled) {
    // 给 body 加/便签模式 class，CSS 负责隐藏多余元素
    var addToggleBtn = document.getElementById('stickyAddToggleBtn');
    var stickyInputArea = document.getElementById('stickyInputArea');
    if (enabled) {
      document.body.classList.add('sticky-mode');
      document.documentElement.classList.add('sticky-mode');
      // 记录进入便签模式时的宽度，后续自适应时保持宽度不变
      window.stickyModeWidth = window.innerWidth;
      // 便签模式：显示折叠按钮和「+」按钮
      var collapseBtn = document.getElementById('stickyCollapseBtn');
      if (collapseBtn) collapseBtn.style.display = 'inline-block';
      if (addToggleBtn) addToggleBtn.style.display = 'inline-block';
      // 重新渲染：清理未完成收纳按钮、刷新列表
      render();
    } else {
      document.body.classList.remove('sticky-mode');
      document.documentElement.classList.remove('sticky-mode');
      // 退出便签模式：隐藏折叠按钮、「+」按钮和输入区，重置状态
      var collapseBtn = document.getElementById('stickyCollapseBtn');
      if (collapseBtn) {
        collapseBtn.style.display = 'none';
        collapseBtn.textContent = '▼';
        collapseBtn.title = '折叠列表';
      }
      if (addToggleBtn) {
        addToggleBtn.style.display = 'none';
        addToggleBtn.classList.remove('active');
      }
      if (stickyInputArea) stickyInputArea.style.display = 'none';
      stickyCollapsed = false;
      document.body.classList.remove('sticky-collapsed');
      // 重新渲染：恢复普通模式的收纳按钮
      render();
    }
  });
}

// 便签模式折叠按钮：点击折叠/展开整个窗口
(function () {
  var collapseBtn = document.getElementById('stickyCollapseBtn');
  if (!collapseBtn) return;
  collapseBtn.addEventListener('click', function () {
    stickyCollapsed = !stickyCollapsed;
    if (stickyCollapsed) {
      // 折叠：记住当前宽度，高度缩到 80px
      stickyWidthBeforeCollapse = window.innerWidth;
      document.body.classList.add('sticky-collapsed');
      if (window.electronAPI && window.electronAPI.resizeWindow) {
        window.electronAPI.resizeWindow(stickyWidthBeforeCollapse, 80);
      }
      collapseBtn.textContent = '▲';
      collapseBtn.title = '展开窗口';
    } else {
      // 展开：根据内容自适应高度（不再固定 760px）
      document.body.classList.remove('sticky-collapsed');
      // 先恢复宽度，高度会在 render 后的 adjustStickyWindowHeight 里自适应
      if (window.electronAPI && window.electronAPI.resizeWindow) {
        window.electronAPI.resizeWindow(stickyWidthBeforeCollapse, 80);
      }
      collapseBtn.textContent = '▼';
      collapseBtn.title = '折叠窗口';
      // 等 DOM 更新后，根据内容调整高度
      setTimeout(adjustStickyWindowHeight, 50);
    }
  });
})();

// 便签模式「+」按钮：点击展开输入区，输入文字后回车添加
(function () {
  var addToggleBtn = document.getElementById('stickyAddToggleBtn');
  var inputArea = document.getElementById('stickyInputArea');
  var stickyInput = document.getElementById('stickyInput');
  if (!addToggleBtn || !inputArea || !stickyInput) return;

  // 双击回车检测：记录上次按回车的时间
  var lastEnterTime = 0;
  var DOUBLE_ENTER_INTERVAL = 400; // 400 毫秒内连按两次回车视为「双击」

  // 收起输入区
  function collapseInput() {
    inputArea.style.display = 'none';
    addToggleBtn.classList.remove('active');
    stickyInput.value = '';
    lastEnterTime = 0;
  }

  // 执行添加：读取输入 → 推入数组 → 渲染 → 清空
  function doAdd() {
    var text = stickyInput.value.trim();
    if (text === '') {
      // 空输入：闪红提示
      stickyInput.style.borderColor = '#e74c3c';
      setTimeout(function () {
        stickyInput.style.borderColor = '';
      }, 300);
      return;
    }
    // 推入新事项（无提醒、无循环，纯文字）
    todos.push({
      id: Date.now(),
      text: text,
      done: false,
      remindAt: null,
      reminded: false,
      recurrence: null,
      completionCount: 0,
      lastRemindAt: null,
      targetCount: null,
      currentCount: 0
    });
    // 重新渲染（render 内部会自动 save + 调整便签窗口高度）
    render();
    // 清空输入框并保持聚焦
    stickyInput.value = '';
    stickyInput.focus();
  }

  // 点击标题栏「+」按钮：展开/收起输入区
  addToggleBtn.addEventListener('click', function () {
    if (inputArea.style.display === 'none') {
      // 展开
      inputArea.style.display = 'block';
      addToggleBtn.classList.add('active'); // 高亮按钮
      stickyInput.focus();
    } else {
      // 收起
      inputArea.style.display = 'none';
      addToggleBtn.classList.remove('active');
      stickyInput.value = '';
    }
  });

  // 按回车键：单击添加，双击（400ms 内）收起输入区
  stickyInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      var now = Date.now();
      var isDoubleEnter = (now - lastEnterTime) < DOUBLE_ENTER_INTERVAL;
      lastEnterTime = now;

      if (isDoubleEnter) {
        // 双击回车：收起输入区
        collapseInput();
      } else {
        // 单击回车：添加事项
        doAdd();
      }
    }
    // 按 Escape 收起输入区
    if (e.key === 'Escape') {
      collapseInput();
    }
  });
})();

// 置顶按钮：点击切换窗口置顶状态
(function () {
  var pinBtn = document.getElementById('pinBtn');
  if (!pinBtn) return;

  // 只在 Electron 环境下显示按钮
  if (window.electronAPI && window.electronAPI.toggleAlwaysOnTop) {
    pinBtn.style.display = 'inline-block';

    // 点击切换置顶
    pinBtn.addEventListener('click', function () {
      window.electronAPI.toggleAlwaysOnTop();
    });

    // 监听置顶状态变化，更新按钮样式
    window.electronAPI.onAlwaysOnTop(function (isEnabled) {
      if (isEnabled) {
        pinBtn.classList.add('active');
        pinBtn.title = '取消置顶';
      } else {
        pinBtn.classList.remove('active');
        pinBtn.title = '窗口置顶';
      }
    });
  } else {
    // 浏览器环境下隐藏按钮
    pinBtn.style.display = 'none';
  }
})();



// ===== 9. 史迪奇桌宠模块 =====

(function () {
  'use strict';

  // ---------- 9.1 元素引用 ----------
  const pet = document.getElementById('stitchPet');
  const petImg = document.getElementById('petImg');
  const petBubble = document.getElementById('petBubble');
  const petClose = document.getElementById('petClose');

  if (!pet) return;

  // ---------- 9.2 状态变量 ----------
  let isDragging = false;
  let isHidden = false;
  let randomMoveTimer = null;
  let inactivityTimer = null;
  let bubbleTimer = null;
  let gifRotationTimer = null;  // GIF 轮播定时器

  let currentX = 24;
  let currentY = 24;

  const MOVE_MARGIN = 20;
  const PET_WIDTH = 140;
  const PET_HEIGHT = 160;

  // ---------- 9.3 工具函数 ----------

  function getPointerPos(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function getRandomPosition() {
    const maxX = Math.max(MOVE_MARGIN, window.innerWidth - PET_WIDTH - MOVE_MARGIN);
    const maxY = Math.max(MOVE_MARGIN, window.innerHeight - PET_HEIGHT - MOVE_MARGIN);
    return {
      x: MOVE_MARGIN + Math.random() * (maxX - MOVE_MARGIN),
      y: MOVE_MARGIN + Math.random() * (maxY - MOVE_MARGIN)
    };
  }

  function clampPosition(x, y) {
    const maxX = Math.max(MOVE_MARGIN, window.innerWidth - PET_WIDTH - MOVE_MARGIN);
    const maxY = Math.max(MOVE_MARGIN, window.innerHeight - PET_HEIGHT - MOVE_MARGIN);
    return {
      x: Math.min(Math.max(MOVE_MARGIN, x), maxX),
      y: Math.min(Math.max(MOVE_MARGIN, y), maxY)
    };
  }

  // ---------- 9.3.1 避开功能按钮 ----------
  // 收集页面上需要避开的交互元素：按钮、输入框、待办项、收纳按钮等
  // 返回它们的视口矩形数组（含位置和尺寸）
  function getAvoidRects() {
    const rects = [];
    // 选择器：所有按钮、输入框、待办项、收纳按钮、链接、输入区域
    const avoidSelectors = 'button, input, .input-area, .todo-item, .collapse-btn, .collapsed-list, a, [role="button"]';
    const elements = document.querySelectorAll(avoidSelectors);
    elements.forEach(function (el) {
      // 跳过桌宠自身的元素（petClose 等）
      if (pet.contains(el)) return;
      // 跳过不可见元素
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return;
      const r = el.getBoundingClientRect();
      // 跳过尺寸为 0 的元素
      if (r.width === 0 || r.height === 0) return;
      rects.push({
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        // 额外留一些安全距离，避免史迪奇贴着按钮
        margin: 16
      });
    });
    return rects;
  }

  // 检查给定的桌宠左下角坐标是否与按钮矩形相交
  // 桌宠使用 left/bottom 定位，需要换算为左上角坐标
  function isPositionColliding(posX, posY, rects) {
    // 桌宠左上角坐标：x = posX, y = viewportHeight - posY - PET_HEIGHT
    const petLeft = posX;
    const petTop = window.innerHeight - posY - PET_HEIGHT;
    const petRight = petLeft + PET_WIDTH;
    const petBottom = petTop + PET_HEIGHT;

    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      const m = r.margin || 0;
      if (
        petRight > r.left - m &&
        petLeft < r.right + m &&
        petBottom > r.top - m &&
        petTop < r.bottom + m
      ) {
        return true;  // 发生碰撞
      }
    }
    return false;
  }

  // 检查给定的矩形是否与按钮矩形相交（用于气泡碰撞检测）
  function isPositionCollidingRect(petRect, rects) {
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      const m = r.margin || 0;
      if (
        petRect.right > r.left - m &&
        petRect.left < r.right + m &&
        petRect.bottom > r.top - m &&
        petRect.top < r.bottom + m
      ) {
        return true;  // 发生碰撞
      }
    }
    return false;
  }

  // 给定一个目标位置，若与按钮相交则尝试微调到附近不冲突的位置
  // 尝试四个方向的偏移，找到第一个不冲突的位置
  // 若都冲突则返回原位置（让用户至少能看到桌宠移动过去）
  function resolveCollision(targetX, targetY) {
    const rects = getAvoidRects();
    if (!isPositionColliding(targetX, targetY, rects)) {
      return { x: targetX, y: targetY, adjusted: false };
    }
    // 尝试偏移：上下左右各推 60~120px，找到不冲突的位置
    const offsets = [
      { dx: 0,   dy: 80 },   // 向下推
      { dx: 0,   dy: -80 },  // 向上推
      { dx: 100, dy: 0 },    // 向右推
      { dx: -100, dy: 0 },   // 向左推
      { dx: 80,  dy: 80 },   // 右下
      { dx: -80, dy: 80 },   // 左下
      { dx: 80,  dy: -80 },  // 右上
      { dx: -80, dy: -80 }   // 左上
    ];
    for (let i = 0; i < offsets.length; i++) {
      const candidate = clampPosition(targetX + offsets[i].dx, targetY + offsets[i].dy);
      if (!isPositionColliding(candidate.x, candidate.y, rects)) {
        return { x: candidate.x, y: candidate.y, adjusted: true };
      }
    }
    // 所有尝试都冲突，返回原目标（已 clamp 过）
    return { x: targetX, y: targetY, adjusted: false };
  }

  // ---------- 9.4 随机自主移动 ----------

  function moveTo(targetX, targetY) {
    if (isDragging || isHidden) return;

    // 自动避开功能按钮：若目标位置与按钮相交，尝试微调
    const resolved = resolveCollision(targetX, targetY);
    targetX = resolved.x;
    targetY = resolved.y;

    const dx = targetX - currentX;
    const dy = targetY - currentY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const duration = Math.max(1.5, Math.min(4, distance / 150));

    pet.classList.add('walking');

    pet.style.transition = 'left ' + duration + 's linear, bottom ' + duration + 's linear';
    pet.style.left = targetX + 'px';
    pet.style.bottom = targetY + 'px';

    if (dx < -10) {
      petImg.classList.add('facing-left');
      petImg.classList.remove('facing-right');
    } else if (dx > 10) {
      petImg.classList.add('facing-right');
      petImg.classList.remove('facing-left');
    }

    setTimeout(function () {
      currentX = targetX;
      currentY = targetY;
      pet.classList.remove('walking');
      pet.style.transition = '';
      // 行走结束后检测边缘
      updatePetEdgeClass();
    }, duration * 1000);
  }

  // ---------- 9.4.1 点击空白处召唤史迪奇 ----------
  // 监听 document 的 click 事件，若点击的不是按钮/输入框/桌宠本身，
  // 则让史迪奇走到点击位置（自动避开功能按钮）
  function onDocumentClick(e) {
    if (isHidden || isDragging) return;

    // 跳过桌宠自身及内部元素
    if (pet.contains(e.target)) return;

    // 跳过功能按钮、输入框、待办项、收纳按钮等交互元素
    // 这些元素应保留原有点击行为，不应触发召唤
    const interactiveSelectors = 'button, input, .todo-item, .collapse-btn, .collapsed-list, a, [role="button"], label, select, textarea';
    if (e.target.closest(interactiveSelectors)) return;

    // 计算点击位置对应的桌宠 left/bottom 坐标
    // 桌宠左下角对齐到点击点（让史迪奇"走过来"到点击位置）
    // 点击位置 (clientX, clientY) → left = clientX - PET_WIDTH/2, bottom = viewportHeight - clientY - PET_HEIGHT/2
    const clickX = e.clientX - PET_WIDTH / 2;
    const clickY = window.innerHeight - e.clientY - PET_HEIGHT / 2;

    // clamp 到视口范围内
    const clamped = clampPosition(clickX, clickY);

    // 暂停随机移动，直接走到点击位置
    stopRandomMovement();
    moveTo(clamped.x, clamped.y);

    // 走完后恢复随机移动（额外等待 2 秒让用户看清位置）
    const distance = Math.sqrt(
      Math.pow(clamped.x - currentX, 2) + Math.pow(clamped.y - currentY, 2)
    );
    const duration = Math.max(1.5, Math.min(4, distance / 150)) * 1000;
    setTimeout(function () {
      if (!isHidden && !isDragging) startRandomMovement();
    }, duration + 2000);
  }

  document.addEventListener('click', onDocumentClick);

  // 寻找一个不与内容重叠的随机位置
  // 最多尝试 10 次，若都找不到空白处则本次不移动
  function findFreePosition() {
    const rects = getAvoidRects();
    for (let i = 0; i < 10; i++) {
      const pos = getRandomPosition();
      if (!isPositionColliding(pos.x, pos.y, rects)) {
        return pos;
      }
    }
    return null;  // 找不到空白处
  }

  function scheduleNextMove() {
    if (isDragging || isHidden) return;

    const waitTime = 3000 + Math.random() * 5000;

    randomMoveTimer = setTimeout(function () {
      if (isDragging || isHidden) {
        scheduleNextMove();
        return;
      }
      const target = findFreePosition();
      if (target) {
        moveTo(target.x, target.y);
      }
      setTimeout(scheduleNextMove, 4000 + Math.random() * 3000);
    }, waitTime);
  }

  function startRandomMovement() {
    if (isHidden) return;
    stopRandomMovement();
    scheduleNextMove();
  }

  function stopRandomMovement() {
    if (randomMoveTimer) {
      clearTimeout(randomMoveTimer);
      randomMoveTimer = null;
    }
    pet.classList.remove('walking');
  }

  // ---------- 9.5 拖拽功能 ----------

  let dragStartX = 0, dragStartY = 0;
  let origX = 0, origY = 0;
  let clickDetectStart = 0;

  function onDragStart(e) {
    if (e.target === petClose || petClose.contains(e.target)) return;

    e.preventDefault();
    isDragging = true;
    clickDetectStart = Date.now();
    stopRandomMovement();

    const point = getPointerPos(e);
    dragStartX = point.x;
    dragStartY = point.y;
    origX = currentX;
    origY = currentY;

    pet.classList.add('dragging');
    pet.style.transition = 'none';

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend', onDragEnd);
  }

  function onDragMove(e) {
    if (!isDragging) return;
    e.preventDefault();

    const point = getPointerPos(e);
    let newX = origX + (point.x - dragStartX);
    // 【修复】史迪奇使用 bottom 定位，Y 轴需要反转：鼠标上移 → bottom 增大（元素上移）
    let newY = origY - (point.y - dragStartY);

    // 拖拽时检测碰撞，若与列表/按钮相交则自动避开
    const rects = getAvoidRects();
    if (isPositionColliding(newX, newY, rects)) {
      const resolved = resolveCollision(newX, newY);
      newX = resolved.x;
      newY = resolved.y;
    }

    const clamped = clampPosition(newX, newY);
    pet.style.left = clamped.x + 'px';
    pet.style.bottom = clamped.y + 'px';
    currentX = clamped.x;
    currentY = clamped.y;
    // 拖拽过程中实时检测边缘
    updatePetEdgeClass();
  }

  function onDragEnd(e) {
    isDragging = false;
    pet.classList.remove('dragging');

    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('touchmove', onDragMove);
    document.removeEventListener('touchend', onDragEnd);

    if (e) {
      const point = getPointerPos(e);
      const dist = Math.sqrt(
        Math.pow(point.x - dragStartX, 2) + Math.pow(point.y - dragStartY, 2)
      );
      const duration = Date.now() - clickDetectStart;
      if (dist < 8 && duration < 300) {
        onPetClick();
      }
    }

    // 拖拽结束检测边缘，调整气泡位置
    updatePetEdgeClass();
    startRandomMovement();
  }

  // ---------- 9.5.1 边缘检测：动态调整气泡位置 ----------
  // 当史迪仔靠近屏幕左/右边缘时，添加对应 CSS 类，让气泡靠边对齐不被遮挡
  function updatePetEdgeClass() {
    const EDGE_THRESHOLD = 120; // 距离边缘多少像素算"靠近"
    pet.classList.remove('near-left', 'near-right');
    if (currentX <= EDGE_THRESHOLD) {
      pet.classList.add('near-left');
    } else if (currentX + PET_WIDTH >= window.innerWidth - EDGE_THRESHOLD) {
      pet.classList.add('near-right');
    }
  }

  pet.addEventListener('mousedown', onDragStart);
  pet.addEventListener('touchstart', onDragStart, { passive: false });

  // ---------- 9.6 点击交互 ----------

  // 史迪奇随机气泡文案池（中二 + 乐天派 + 暖心）
  const bubbleMessages = [
    // ===== 中二风格 =====
    '吾乃史迪奇，626 号实验体！你的待办就是本大人的使命！',
    '哼，没有待办能逃过我的眼睛！',
    '本大人今天也要守护你的待办清单！Ohana！',
    '感受到我体内涌动的力量了吗？那是完成待办的意志！',
    '吾之使命，乃助你征服所有待办！',
    // ===== 乐天派 =====
    '今天也是元气满满的一天！冲鸭！',
    '嘿嘿，有我在，什么都不怕~',
    '阳光正好，适合把待办一个个消灭！',
    '今天的心情是彩虹色的！',
    '笑一个吧，待办什么的分分钟搞定！',
    // ===== 暖心 =====
    '累了就休息一下，待办可以等一等哦~',
    '你已经做得很棒了，不要给自己太大压力。',
    '不管有多少待办，我都会陪着你。',
    '记得喝水，记得吃饭，你最重要。',
    '今天辛苦了，好好休息，明天继续加油。',
    '不管发生什么，Ohana 都在你身边。'
  ];

  function onPetClick() {
    pet.classList.add('bounce');
    setTimeout(function () {
      pet.classList.remove('bounce');
    }, 500);
    showBubble();
  }

  // 参数：customMsg（可选）— 若传入则使用该文案，否则随机选一条
  function showBubble(customMsg) {
    // 气泡区域与页面内容重叠时不显示对话气泡
    // 气泡在桌宠上方（bottom: 100%），估算气泡区域进行检测
    const petRect = pet.getBoundingClientRect();
    const bubbleHeight = 40;   // 气泡高度（含 padding）
    const bubbleMargin = 12;   // 气泡与桌宠间距
    const bubbleWidth = 200;   // 气泡估算宽度
    const bubbleRect = {
      left: petRect.left + petRect.width / 2 - bubbleWidth / 2,
      right: petRect.left + petRect.width / 2 + bubbleWidth / 2,
      top: petRect.top - bubbleHeight - bubbleMargin,
      bottom: petRect.top - bubbleMargin
    };
    const rects = getAvoidRects();
    if (isPositionCollidingRect(bubbleRect, rects)) {
      return; // 气泡区域重叠则不显示
    }
    const msg = customMsg || bubbleMessages[Math.floor(Math.random() * bubbleMessages.length)];
    petBubble.textContent = msg;
    petBubble.classList.add('show');

    if (bubbleTimer) clearTimeout(bubbleTimer);
    // 有自定义文案时显示时间稍长（4秒），让用户看清反馈
    const duration = customMsg ? 4000 : 3000;
    bubbleTimer = setTimeout(function () {
      petBubble.classList.remove('show');
    }, duration);
  }

  // ---------- 9.7 关闭 / 恢复 ----------

  petClose.addEventListener('click', function (e) {
    e.stopPropagation();
    hidePet();
  });

  function hidePet() {
    isHidden = true;
    stopRandomMovement();
    stopGifRotation();  // 隐藏时停止 GIF 轮播
    pet.classList.add('hidden');

    setTimeout(function () {
      if (isHidden) showRestoreButton();
    }, 300);
  }

  function showRestoreButton() {
    const btn = document.createElement('button');
    btn.textContent = '🐾 召唤史迪奇';
    btn.id = 'petRestoreBtn';
    btn.style.cssText = [
      'position: fixed', 'left: 24px', 'bottom: 24px',
      'z-index: 9998', 'padding: 10px 16px',
      'background: rgba(102, 126, 234, 0.9)',
      'color: #fff', 'border: none',
      'border-radius: 20px', 'cursor: pointer',
      'font-size: 13px', 'font-weight: 600',
      'box-shadow: 0 4px 12px rgba(0,0,0,0.2)',
      'transition: all 0.2s', 'font-family: inherit'
    ].join(';');

    btn.addEventListener('mouseenter', function () {
      this.style.transform = 'translateY(-2px)';
      this.style.boxShadow = '0 6px 16px rgba(0,0,0,0.25)';
    });
    btn.addEventListener('mouseleave', function () {
      this.style.transform = '';
      this.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
    });
    btn.addEventListener('click', function () {
      isHidden = false;
      pet.classList.remove('hidden');
      startRandomMovement();
      startGifRotation();  // 恢复时重新启动 GIF 轮播
      btn.remove();
    });

    document.body.appendChild(btn);
  }

  // ---------- 9.7.1 GIF 轮播（3-5 秒随机切换桌宠动图）----------
  // 桌宠图片放在 img 文件夹下，共 6 张史迪奇系列 gif
  // 每 3-5 秒随机切换一张，切换时淡入淡出避免闪白突兀
  const PET_GIFS = [
    'img/史迪奇1.gif',
    'img/史迪奇2.gif',
    'img/史迪奇3.gif',
    'img/史迪奇4.gif',
    'img/史迪奇5.gif',
    'img/史迪奇6.gif'
  ];
  let currentGifIndex = 0;  // 当前显示的 gif 在数组中的下标

  // 预加载并切换到下一张 gif
  // 用 Image 对象预加载，加载完成后再换 src，避免直接改 src 造成的闪白
  function switchToNextGif() {
    if (PET_GIFS.length <= 1) return;
    // 随机选一张不同于当前的，保证每次切换都有变化
    let nextIndex;
    do {
      nextIndex = Math.floor(Math.random() * PET_GIFS.length);
    } while (nextIndex === currentGifIndex);

    const nextSrc = PET_GIFS[nextIndex];
    const loader = new Image();
    loader.onload = function () {
      // 淡出（0.3s，由 CSS 的 opacity transition 驱动）→ 换 src → 淡入（0.3s）
      // 注意：不在此处设置 inline transition，避免覆盖 CSS 中与 transform 共存的 transition
      petImg.style.opacity = '0';
      setTimeout(function () {
        petImg.src = nextSrc;
        currentGifIndex = nextIndex;
        // 下一帧再淡入，确保浏览器已应用新的 src
        requestAnimationFrame(function () {
          petImg.style.opacity = '1';
        });
      }, 300);
    };
    loader.src = nextSrc;
  }

  // 调度下一次切换（3-5 秒随机间隔）
  function scheduleNextGif() {
    if (isHidden) return;
    const waitTime = 3000 + Math.random() * 2000;  // 3000~5000ms
    gifRotationTimer = setTimeout(function () {
      if (isHidden) return;
      switchToNextGif();
      scheduleNextGif();
    }, waitTime);
  }

  function startGifRotation() {
    if (isHidden) return;
    stopGifRotation();
    scheduleNextGif();
  }

  function stopGifRotation() {
    if (gifRotationTimer) {
      clearTimeout(gifRotationTimer);
      gifRotationTimer = null;
    }
  }

  // ---------- 9.8 页面可见性 & 窗口大小 ----------

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      stopRandomMovement();
      stopGifRotation();  // 页面不可见时停止轮播，节省资源
    } else if (!isHidden) {
      startRandomMovement();
      startGifRotation();  // 页面恢复可见时重启轮播
    }
  });

  window.addEventListener('resize', function () {
    const clamped = clampPosition(currentX, currentY);
    currentX = clamped.x;
    currentY = clamped.y;
    pet.style.transition = 'none';
    pet.style.left = currentX + 'px';
    pet.style.bottom = currentY + 'px';
    // 窗口大小变化时，检查是否有空间显示桌宠
    updatePetVisibility();
    // 如果有空间且桌宠可见，自动移到空白处
    if (!pet.classList.contains('hidden') && !isHidden) {
      const freePos = findFreePosition();
      if (freePos) {
        moveTo(freePos.x, freePos.y);
      }
    }
  });

  // 根据是否有空白区域决定是否显示桌宠
  // 只要能找到一块不被内容遮挡的位置，就显示桌宠
  function updatePetVisibility() {
    if (!pet) return;
    // 桌宠最小需要的空间（考虑缩小后的尺寸）
    const petMinWidth = 80;   // 桌宠最小宽度
    const petMinHeight = 100; // 桌宠最小高度

    // 窗口太小，连缩小后的桌宠都放不下，则隐藏
    if (window.innerWidth < petMinWidth + 20 || window.innerHeight < petMinHeight + 20) {
      pet.classList.add('hidden');
      return;
    }

    // 检查是否存在空白区域可以放置桌宠
    const rects = getAvoidRects();
    // 在视口范围内采样多个点，看是否有不碰撞的位置
    let hasFreeSpace = false;
    for (let x = 10; x < window.innerWidth - petMinWidth; x += 40) {
      for (let y = 10; y < window.innerHeight - petMinHeight; y += 40) {
        // y 是 bottom 坐标，需要转换
        if (!isPositionColliding(x, y, rects)) {
          hasFreeSpace = true;
          break;
        }
      }
      if (hasFreeSpace) break;
    }

    if (hasFreeSpace) {
      pet.classList.remove('hidden');
    } else {
      pet.classList.add('hidden');
    }
  }

  // 初始化时检查一次
  updatePetVisibility();

  // ---------- 9.9 空闲互动 ----------

  function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(function () {
      if (!isDragging && !isHidden && !pet.classList.contains('walking')) {
        if (Math.random() < 0.3) {
          showBubble();
        }
      }
      resetInactivityTimer();
    }, 15000 + Math.random() * 10000);
  }

  document.addEventListener('mousemove', resetInactivityTimer);
  document.addEventListener('keydown', resetInactivityTimer);
  document.addEventListener('click', resetInactivityTimer);
  resetInactivityTimer();

  // ---------- 9.10 情绪状态机 ----------

  const petParticles = document.getElementById('petParticles');
  let currentMood = 'idle';
  let moodTimer = null;

  // 粒子图标库（不同情绪使用不同图标）
  const PARTICLE_ICONS = {
    happy: ['⭐', '✨', '💫', '🌟', '💖'],
    excited: ['💥', '✨', '⚡', '🔥', '🌟'],
    sad: ['💧', '🌧️', '💔'],
    angry: ['💢', '💥', '⚡'],
    love: ['❤️', '💖', '💕', '💗'],
    sparkle: ['✨', '⭐', '💫'],
    trail: ['✨']
  };

  // 设置情绪
  function setMood(mood, duration) {
    currentMood = mood;
    pet.classList.remove('happy', 'excited', 'sad', 'angry', 'sleeping', 'idle');
    pet.classList.add(mood);

    if (moodTimer) clearTimeout(moodTimer);
    if (duration) {
      moodTimer = setTimeout(function () {
        pet.classList.remove(mood);
        currentMood = 'idle';
      }, duration);
    }
  }

  // 情绪快捷方法
  function playHappy() {
    setMood('happy', 600);
    spawnParticles('happy', 10);
    showBubble();
  }

  function playExcited() {
    setMood('excited', 500);
    spawnParticles('excited', 8);
  }

  function playSad() {
    setMood('sad', 1200);
    spawnParticles('sad', 5);
  }

  function playAngry() {
    setMood('angry', 500);
    spawnParticles('angry', 6);
  }

  function playSleeping() {
    setMood('sleeping');
    spawnParticlesZZZ();
  }

  // ---------- 9.11 粒子系统 ----------

  function spawnParticles(type, count) {
    if (!petParticles) return;
    const icons = PARTICLE_ICONS[type] || PARTICLE_ICONS.sparkle;
    count = count || 5;

    for (let i = 0; i < count; i++) {
      setTimeout(function () {
        const p = document.createElement('div');
        p.className = 'particle';
        p.textContent = icons[Math.floor(Math.random() * icons.length)];
        const leftPos = 20 + Math.random() * 60;
        p.style.left = leftPos + '%';
        p.style.bottom = (40 + Math.random() * 30) + 'px';
        p.style.animationDuration = (0.8 + Math.random() * 0.6) + 's';
        petParticles.appendChild(p);

        setTimeout(function () {
          p.remove();
        }, 1500);
      }, i * 60);
    }
  }

  function spawnParticlesZZZ() {
    if (!petParticles) return;
    const z = document.createElement('div');
    z.className = 'pet-zzz';
    z.textContent = 'Z';
    z.style.left = '70%';
    z.style.bottom = '80px';
    petParticles.appendChild(z);

    setTimeout(function () { z.remove(); }, 2000);
  }

  // ---------- 9.11.1 史迪奇说话（替代独立 toast 系统）----------
  // 待办操作时，让史迪奇通过对话气泡"说话"反馈用户
  // 不再使用页面顶部的独立 toast，而是直接用史迪奇自身的对话气泡
  // 参数：text（说话内容）、type（类型：success/info/warning/error，影响气泡颜色）
  function showPetToast(text, type) {
    type = type || 'info';

    // 根据类型切换气泡颜色 class
    petBubble.classList.remove('type-success', 'type-info', 'type-warning', 'type-error');
    petBubble.classList.add('type-' + type);

    // 弹跳动效（让史迪奇看起来在"说话"）
    if (!isDragging && !isHidden) {
      pet.classList.add('bounce');
      setTimeout(function () { pet.classList.remove('bounce'); }, 500);
    }

    // 通过对话气泡显示文字（自定义文案模式，显示 4 秒）
    showBubble(text);

    // 气泡隐藏后清理类型 class，避免下次随机消息也带颜色
    if (bubbleTimer) clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () {
      petBubble.classList.remove('type-success', 'type-info', 'type-warning', 'type-error');
    }, 4100);
  }

  // 行走拖尾
  let trailTimer = null;
  function startTrail() {
    if (trailTimer) return;
    const colors = ['#FFD700', '#FF6B6B', '#667eea', '#4ECDC4', '#FFE66D', '#FF8C42'];
    trailTimer = setInterval(function () {
      if (pet.classList.contains('walking')) {
        const trail = document.createElement('div');
        trail.className = 'pet-trail';
        trail.style.background = colors[Math.floor(Math.random() * colors.length)];
        trail.style.left = (40 + Math.random() * 20) + '%';
        trail.style.bottom = '0px';
        petParticles.appendChild(trail);
        setTimeout(function () { trail.remove(); }, 800);
      }
    }, 150);
  }

  // ---------- 9.12 暴露全局接口 ----------

  window.petMood = {
    happy: playHappy,
    excited: playExcited,
    sad: playSad,
    angry: playAngry,
    sleep: playSleeping,
    bubble: showBubble,
    spawn: spawnParticles,
    toast: showPetToast  // 新增：显示文字 toast
  };

  // ---------- 9.13 启动 ----------

  const initPos = clampPosition(currentX, currentY);
  currentX = initPos.x;
  currentY = initPos.y;
  pet.style.left = currentX + 'px';
  pet.style.bottom = currentY + 'px';

  // 启动行走拖尾
  startTrail();

  // 初始化时检查碰撞，若重叠则自动移到安全位置
  setTimeout(function () {
    const rects = getAvoidRects();
    if (isPositionColliding(currentX, currentY, rects)) {
      const resolved = resolveCollision(currentX, currentY);
      currentX = resolved.x;
      currentY = resolved.y;
      pet.style.left = currentX + 'px';
      pet.style.bottom = currentY + 'px';
    }
    startRandomMovement();
  }, 500);

  // 启动 GIF 轮播（3-5 秒随机切换桌宠动图）
  startGifRotation();

  // ===== 史迪奇交互文字系统 =====
  // 页面打开 2 秒后，史迪奇主动说一句话
  setTimeout(function () {
    if (!isHidden && window.petMood) {
      // 根据当前待办数量选择不同风格的欢迎语
      const pendingCount = (window.todos || []).filter(function (t) { return !t.done; }).length;
      let welcomeMsg;
      if (pendingCount === 0) {
        welcomeMsg = '今天还没有待办呢，要不要加几个？我准备好了！';
      } else if (pendingCount < 3) {
        welcomeMsg = '今天有 ' + pendingCount + ' 项待办，我们一起搞定它们！';
      } else {
        welcomeMsg = '哇，今天有 ' + pendingCount + ' 项待办！别担心，有本大人在！';
      }
      window.petMood.toast(welcomeMsg, 'info');
    }
  }, 2000);

  // 空闲检测：用户 30 秒无操作，史迪奇主动搭话
  let idleTimer = null;
  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (!isHidden && window.petMood) {
        const idleMsgs = [
          '怎么不理我了？是不是在偷偷休息？',
          '待办在等你哦，别偷懒~',
          '本大人有点无聊了，快来和我互动一下！',
          '发呆也是一种休息，我懂的~',
          '有什么我能帮你的吗？'
        ];
        window.petMood.toast(idleMsgs[Math.floor(Math.random() * idleMsgs.length)], 'info');
      }
    }, 30000); // 30 秒无操作触发
  }
  // 监听用户操作，重置空闲计时
  ['click', 'keydown', 'mousemove', 'touchstart'].forEach(function (evt) {
    document.addEventListener(evt, resetIdleTimer, { passive: true });
  });
  resetIdleTimer();

  // 随机气泡：每 15-30 秒随机冒一个气泡
  function scheduleRandomBubble() {
    const delay = 15000 + Math.random() * 15000; // 15-30 秒随机
    setTimeout(function () {
      if (!isHidden && window.petMood) {
        window.petMood.bubble();
      }
      scheduleRandomBubble(); // 递归调度下一次
    }, delay);
  }

  // 首次进入页面时，史迪仔先说两句问候，然后启动随机互动
  setTimeout(function () {
    // 先更新边缘状态，确保气泡位置正确
    updatePetEdgeClass();
    const msg = '嘿！你听说过「景逸大人」这个名字吗？';
    petBubble.textContent = msg;
    petBubble.classList.add('show');

    // 动态调整气泡位置，防止超出屏幕
    adjustBubblePosition();

    if (bubbleTimer) clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () {
      petBubble.classList.remove('show');

      // 0.5 秒后显示第二句
      setTimeout(function () {
        const msg2 = '传说啊，他是世界上顶好顶好的人~ ✨';
        petBubble.textContent = msg2;
        petBubble.classList.add('show');

        // 再次调整位置
        adjustBubblePosition();

        bubbleTimer = setTimeout(function () {
          petBubble.classList.remove('show');

          // ★ 问候说完后，启动随机互动气泡
          // 等 8-15 秒后开始第一个随机气泡，然后持续循环
          const firstRandomDelay = 8000 + Math.random() * 7000;
          setTimeout(scheduleRandomBubble, firstRandomDelay);
        }, 4000);
      }, 500);
    }, 4000);
  }, 2000); // 页面加载 2 秒后显示第一句问候

  // 动态调整气泡位置，确保不超出屏幕边缘
  function adjustBubblePosition() {
    const bubbleRect = petBubble.getBoundingClientRect();
    const petRect = pet.getBoundingClientRect();
    const windowWidth = window.innerWidth;

    // 检查气泡是否超出右边缘
    if (bubbleRect.right > windowWidth) {
      const overflow = bubbleRect.right - windowWidth;
      // 将气泡向左移动，使其右边缘在屏幕内 10px
      petBubble.style.left = 'auto';
      petBubble.style.right = '10px';
      petBubble.style.transform = 'none';
    }
    // 检查气泡是否超出左边缘
    else if (bubbleRect.left < 0) {
      petBubble.style.left = '10px';
      petBubble.style.right = 'auto';
      petBubble.style.transform = 'none';
    }
  }

  // ===== 日报功能 =====
  // 生成今日日报内容
  function generateDailyReport() {
    // 通过闭包访问全局 todos 数组（window.todos 可能未定义）
    const todos = window.todos || window.getAllTodos ? window.getAllTodos() : [];
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const todayEnd = todayStart + 86400000;

    // 筛选今日完成的事项（完成时间在今日范围内）
    const completedToday = todos.filter(function (t) {
      return t.done && t.completedAt && t.completedAt >= todayStart && t.completedAt < todayEnd;
    });
    // 未完成事项
    const pendingCount = todos.filter(function (t) { return !t.done; }).length;
    // 总事项数
    const totalCount = todos.length;
    // 完成率
    const completionRate = totalCount > 0 ? Math.round((completedToday.length / totalCount) * 100) : 0;

    // 构造日报文本
    let report = '📊 今日日报\n\n';
    report += '🗓️ ' + (today.getMonth() + 1) + '月' + today.getDate() + '日\n';
    report += '━━━━━━━━━━━━━━\n';
    report += '✅ 已完成：' + completedToday.length + ' 项\n';
    report += '📝 待办中：' + pendingCount + ' 项\n';
    report += '📈 完成率：' + completionRate + '%\n';
    if (completedToday.length > 0) {
      report += '\n🏆 今日成就：\n';
      completedToday.forEach(function (t, i) {
        report += '  ' + (i + 1) + '. ' + t.text + '\n';
      });
    }
    report += '\n━━━━━━━━━━━━━━\n';
    // 暖心结语
    if (completionRate >= 80) {
      report += '太厉害了！今天的你超棒！🌟';
    } else if (completionRate >= 50) {
      report += '不错哦，继续保持！💪';
    } else if (completedToday.length > 0) {
      report += '完成了 ' + completedToday.length + ' 项，明天继续加油！';
    } else {
      report += '今天还没有完成事项，明天是新的一天！';
    }
    return report;
  }

  // 显示日报弹窗
  function showDailyReport() {
    // 如果已有日报弹窗，不重复创建
    if (document.getElementById('dailyReportModal')) return;

    const report = generateDailyReport();
    // 创建弹窗容器
    const modal = document.createElement('div');
    modal.id = 'dailyReportModal';
    modal.className = 'daily-report-modal';
    modal.innerHTML =
      '<div class="daily-report-overlay"></div>' +
      '<div class="daily-report-card">' +
        '<div class="daily-report-header">' +
          '<span class="daily-report-title">📊 今日日报</span>' +
          '<button class="daily-report-close" id="dailyReportClose">×</button>' +
        '</div>' +
        '<pre class="daily-report-body">' + report + '</pre>' +
        '<div class="daily-report-footer">' +
          '<button class="daily-report-btn" id="dailyReportOk">知道了</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    // 关闭弹窗
    function closeReport() {
      modal.remove();
    }
    document.getElementById('dailyReportClose').addEventListener('click', closeReport);
    document.getElementById('dailyReportOk').addEventListener('click', closeReport);
    modal.querySelector('.daily-report-overlay').addEventListener('click', closeReport);

    // 史迪奇反馈
    if (window.petMood) {
      window.petMood.happy();
    }
  }

  // 暴露全局接口
  window.showDailyReport = showDailyReport;

  // 检查是否到了日报时间（每晚 21:00）
  let dailyReportShown = false;
  function checkDailyReportTime() {
    const now = new Date();
    // 21:00 - 21:59 之间，且今日未显示过
    if (now.getHours() === 21 && !dailyReportShown) {
      dailyReportShown = true;
      // 史迪奇弹出提醒
      if (window.petMood) {
        window.petMood.toast('日报生成啦！点击我查看今天的成果吧~', 'info');
        // 点击史迪奇时显示报告
        setTimeout(function () {
          const originalOnPetClick = pet.onclick;
          pet.onclick = function () {
            showDailyReport();
            pet.onclick = originalOnPetClick;
          };
        }, 100);
      }
    }
    // 过了 25:00（实际是次日），重置标志
    if (now.getHours() === 0) {
      dailyReportShown = false;
    }
  }
  // 每 60 秒检查一次时间
  setInterval(checkDailyReportTime, 60000);
  // 页面打开时也检查一次
  setTimeout(checkDailyReportTime, 5000);

})();


// ===== 10. 待办事项与桌宠情绪联动 =====

// 添加待办时的 toast 文案池（随机选一条，增加趣味性）
const ADD_TODO_TOASTS = [
  '又多了一项待办，加油！',
  '收到！我会盯着你完成的~',
  '记下来啦，别忘了哦！',
  '新任务到达！冲鸭！',
  '好的，已加入待办清单~'
];

// 完成待办时的 toast 文案池
const COMPLETE_TODO_TOASTS = [
  '太棒了！又完成一项！',
  '干得漂亮！继续加油！',
  '搞定一项！你真厉害！',
  '完成！我为你骄傲~',
  '又消灭一个待办！'
];

// 由于 addBtn 和 todoInput 已在文件上方绑定原始 addTodo/toggleTodo/deleteTodo 引用，
// 直接重新赋值函数不会改变已绑定的监听器。这里采用「包装」方案：
// 移除旧监听器，添加新监听器调用包装后的逻辑。

// 包装 addTodo：整合自然语言解析 + 日期选择器 + 循环设置 + 调度提醒 + 桌宠反馈
function wrappedAddTodo() {
  const rawText = todoInput.value.trim();
  if (rawText === '') {
    addTodo();
    return;
  }

  let remindAt = null;
  let recurrence = null;

  // 1) 优先尝试自然语言解析
  if (window.reminderModule) {
    let parsed;
    try {
      parsed = window.reminderModule.parse(rawText);
    } catch (err) {
      console.error('解析失败:', err);
      // 解析失败时直接添加原文本
      addTodo();
      return;
    }
    if (parsed && parsed.remindAt) {
      remindAt = parsed.remindAt;
      // 清理文本：去掉"提醒我""提醒""叫我"等前缀，提炼纯事项内容
      todoInput.value = window.reminderModule.cleanTodoText(parsed.text);
      // 如果解析结果带循环设置（"每X"模式），自动启用循环
      if (parsed.recurrence && parsed.recurrence.enabled) {
        recurrence = parsed.recurrence;
      }
      // 同步到日期选择器显示
      if (window.datetimePickerModule) {
        window.datetimePickerModule.syncFromTimestamp(remindAt, null);
      }
    }
  }

  // 2) 从日期选择器获取时间（覆盖自然语言解析结果）
  const pickerTs = window.datetimePickerModule ? window.datetimePickerModule.getTimestamp() : null;
  if (pickerTs) {
    remindAt = pickerTs;
    recurrence = window.datetimePickerModule.getRecurrence();
  }

  // 3) 都没有 → 纯添加（不设提醒）
  const newTodo = addTodo(remindAt, recurrence);

  if (newTodo && newTodo.remindAt && window.reminderModule) {
    window.reminderModule.schedule(newTodo);
  }

  // 清空日期选择器（含循环次数）
  if (window.datetimePickerModule) {
    window.datetimePickerModule.clearAll();
  }

  // 触发桌宠反馈
  if (window.petMood) {
    window.petMood.excited();
    const msg = remindAt
      ? (recurrence && recurrence.enabled
          ? '已设好循环提醒，到点我会叫你！'
          : '已设好提醒，到点我会叫你！')
      : ADD_TODO_TOASTS[Math.floor(Math.random() * ADD_TODO_TOASTS.length)];
    window.petMood.toast(msg, 'success');
  }
}

// 包装 toggleTodo：根据状态触发对应表情 + toast
function wrappedToggleTodo(id) {
  const todo = todos.find(function (t) { return t.id === id; });
  const wasDone = todo ? todo.done : false;
  const wasCycle = todo && todo.recurrence && todo.recurrence.enabled;
  const oldCount = todo ? (todo.completionCount || 0) : 0;

  toggleTodo(id);

  if (window.petMood) {
    if (wasCycle && !todo.done && todo.completionCount > oldCount) {
      // 循环待办完成一次 → 庆祝 + 下一轮倒计时
      window.petMood.happy();
      // 有目标次数时显示进度，无目标时只显示完成次数
      if (todo.targetCount && todo.targetCount > 0) {
        window.petMood.toast('完成 ' + todo.completionCount + '/' + todo.targetCount + ' 次！继续加油！', 'success');
      } else {
        window.petMood.toast('完成第 ' + todo.completionCount + ' 次！下一轮提醒已安排', 'success');
      }
    } else if (todo && todo.done) {
      window.petMood.happy();
      const msg = COMPLETE_TODO_TOASTS[Math.floor(Math.random() * COMPLETE_TODO_TOASTS.length)];
      window.petMood.toast(msg, 'success');
    } else if (wasDone && !todo.done) {
      window.petMood.toast('取消完成？没关系，继续加油！', 'info');
    }
  }
}

// 包装 deleteTodo：根据状态触发对应表情 + toast
function wrappedDeleteTodo(id) {
  const todo = todos.find(function (t) { return t.id === id; });
  deleteTodo(id);  // 调用原始函数
  if (window.petMood) {
    if (todo && todo.done) {
      window.petMood.angry(); // 删除已完成的 → 生气
      window.petMood.toast('已完成的也删了？想清楚哦~', 'warning');
    } else {
      window.petMood.sad(); // 删除未完成的 → 难过
      window.petMood.toast('删除了待办，需不需要重新加回来？', 'info');
    }
  }
}

// 重新绑定事件：移除原始 addTodo 的监听器，改用包装版本
addBtn.removeEventListener('click', addTodo);
addBtn.addEventListener('click', wrappedAddTodo);

// 将包装函数暴露到 window，供 createTodoElement 中的事件监听器调用
window.wrappedAddTodo = wrappedAddTodo;
window.wrappedToggleTodo = wrappedToggleTodo;
// 暴露 todos 访问器（供日报等功能使用）
window.getAllTodos = function () { return todos; };
window.wrappedDeleteTodo = wrappedDeleteTodo;

// 回车键也需要走包装逻辑：先移除再添加
// 由于原回车监听器是匿名函数无法移除，我们改为在 keydown 时判断后调用 wrappedAddTodo
// 实际上原监听器内调用的是 addTodo()（函数引用），重新赋值 addTodo 不影响它
// 因此这里直接覆盖 todoInput 的 keydown 监听：用 capture 阶段拦截 Enter
todoInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    e.stopImmediatePropagation();  // 阻止后续监听器（包括原始的 addTodo 调用）
    wrappedAddTodo();
  }
}, true);  // capture 阶段先执行


// ===== 10.5 自定义日期时间选择器（Popover 浮层）=====
// v2.4.0 新增：替代原生 datetime-local，支持日期/时间/循环三合一设置

const datetimePickerModule = (function () {
  // 模块内部状态
  let currentDate = null;       // 已选日期 (Date 对象，时间部分为 00:00)
  let currentHour = 8;          // 已选小时
  let currentMinute = 0;        // 已选分钟
  let currentRecurrence = null; // 循环设置对象
  let activeDatePreset = null;  // 当前激活的日期预设
  let activeTimePreset = null;  // 当前激活的时间预设
  let activeCyclePreset = null; // 当前激活的循环预设

  // DOM 引用
  const datetimePicker = document.getElementById('datetimePicker');
  const datetimeTrigger = document.getElementById('datetimeTrigger');
  const datetimeDisplay = document.getElementById('datetimeDisplay');
  const datetimePopover = document.getElementById('datetimePopover');
  const datePresetRow = document.getElementById('dpDatePresets');
  const hourSelect = document.getElementById('dpHourSelect');
  const minuteSelect = document.getElementById('dpMinuteSelect');
  const timePresetRow = document.getElementById('dpTimePresets');
  const cycleToggle = document.getElementById('dpCycleToggle');
  const cycleOptions = document.getElementById('dpCycleOptions');
  const cyclePresetRow = document.getElementById('dpCyclePresets');
  const customCycle = document.getElementById('dpCustomCycle');
  const cycleValueInput = document.getElementById('dpCycleValue');
  const cycleUnitSelect = document.getElementById('dpCycleUnit');
  const cycleCountInput = document.getElementById('dpCycleCount'); // 循环次数输入框
  const clearBtn = document.getElementById('dpClearBtn');
  const confirmBtn = document.getElementById('dpConfirmBtn');

  // ========== 滚轮选择器（月/日 + 时/分） ==========
  const DATE_ITEM_HEIGHT = 14;
  const TIME_ITEM_HEIGHT = 14;

  const wheelMonthList = document.getElementById('dpWheelMonthList');
  const wheelDayList = document.getElementById('dpWheelDayList');
  const wheelHourList = document.getElementById('dpWheelHourList');
  const wheelMinuteList = document.getElementById('dpWheelMinuteList');
  const yearLabel = document.getElementById('dpYearLabel');

  // 滚轮列状态
  const wheelState = {
    month:  { listEl: wheelMonthList,  items: [], index: 0, scrollTop: 0, itemH: DATE_ITEM_HEIGHT, dragging: false, startY: 0, startScroll: 0 },
    day:    { listEl: wheelDayList,    items: [], index: 0, scrollTop: 0, itemH: DATE_ITEM_HEIGHT, dragging: false, startY: 0, startScroll: 0 },
    hour:   { listEl: wheelHourList,   items: [], index: 8, scrollTop: 0, itemH: TIME_ITEM_HEIGHT, dragging: false, startY: 0, startScroll: 0 },
    minute: { listEl: wheelMinuteList, items: [], index: 0, scrollTop: 0, itemH: TIME_ITEM_HEIGHT, dragging: false, startY: 0, startScroll: 0 }
  };

  // 获取指定年月的天数
  function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  // 渲染单个滚轮列
  function renderWheel(col, items, selectedIndex) {
    const state = wheelState[col];
    const h = state.itemH;
    state.items = items;
    state.index = selectedIndex;
    state.listEl.innerHTML = items.map((val, i) => {
      let cls = 'dp-wheel-item';
      if (i === selectedIndex) cls += ' selected';
      else if (Math.abs(i - selectedIndex) <= 1) cls += ' near';
      else cls += ' far';
      return '<div class="' + cls + '" data-idx="' + i + '">' + val + '</div>';
    }).join('');
    state.scrollTop = selectedIndex * h;
    state.listEl.style.transform = 'translateY(' + (-state.scrollTop) + 'px)';
  }

  // 滚动并吸附到最近项
  function snapWheel(col) {
    const state = wheelState[col];
    const h = state.itemH;
    const rawIndex = Math.round(state.scrollTop / h);
    state.index = Math.max(0, Math.min(state.items.length - 1, rawIndex));
    state.scrollTop = state.index * h;
    state.listEl.style.transform = 'translateY(' + (-state.scrollTop) + 'px)';
    // 更新选中项样式
    state.listEl.querySelectorAll('.dp-wheel-item').forEach((el, i) => {
      el.classList.remove('selected', 'near', 'far');
      if (i === state.index) el.classList.add('selected');
      else if (Math.abs(i - state.index) <= 1) el.classList.add('near');
      else el.classList.add('far');
    });
  }

  // 绑定滚轮列的拖拽和滚轮事件
  function bindWheel(col, onChange) {
    const state = wheelState[col];
    const h = state.itemH;
    const listEl = state.listEl;

    // 鼠标拖拽
    listEl.addEventListener('mousedown', function (e) {
      state.dragging = true;
      state.startY = e.clientY;
      state.startScroll = state.scrollTop;
      listEl.style.transition = 'none';
    });
    document.addEventListener('mousemove', function (e) {
      if (!state.dragging) return;
      const delta = state.startY - e.clientY;
      state.scrollTop = state.startScroll + delta;
      state.scrollTop = Math.max(0, Math.min(state.scrollTop, (state.items.length - 1) * h));
      listEl.style.transform = 'translateY(' + (-state.scrollTop) + 'px)';
    });
    document.addEventListener('mouseup', function () {
      if (!state.dragging) return;
      state.dragging = false;
      listEl.style.transition = '';
      snapWheel(col);
      if (onChange) onChange();
    });

    // 滚轮事件
    listEl.addEventListener('wheel', function (e) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? h : -h;
      const newTop = state.scrollTop + delta;
      state.scrollTop = Math.max(0, Math.min(newTop, (state.items.length - 1) * h));
      listEl.style.transform = 'translateY(' + (-state.scrollTop) + 'px)';
      clearTimeout(state._wheelTimer);
      state._wheelTimer = setTimeout(function () {
        snapWheel(col);
        if (onChange) onChange();
      }, 120);
    }, { passive: false });

    // 点击直接选中
    listEl.addEventListener('click', function (e) {
      const item = e.target.closest('.dp-wheel-item');
      if (!item) return;
      const idx = parseInt(item.dataset.idx);
      state.scrollTop = idx * h;
      snapWheel(col);
      if (onChange) onChange();
    });

    // 触摸事件（移动端支持）
    listEl.addEventListener('touchstart', function (e) {
      state.dragging = true;
      state.startY = e.touches[0].clientY;
      state.startScroll = state.scrollTop;
      listEl.style.transition = 'none';
    }, { passive: true });
    listEl.addEventListener('touchmove', function (e) {
      if (!state.dragging) return;
      const delta = state.startY - e.touches[0].clientY;
      state.scrollTop = state.startScroll + delta;
      state.scrollTop = Math.max(0, Math.min(state.scrollTop, (state.items.length - 1) * h));
      listEl.style.transform = 'translateY(' + (-state.scrollTop) + 'px)';
    }, { passive: true });
    listEl.addEventListener('touchend', function () {
      if (!state.dragging) return;
      state.dragging = false;
      listEl.style.transition = '';
      snapWheel(col);
      if (onChange) onChange();
    });
  }

  // 初始化滚轮
  function initWheelPicker() {
    const now = new Date();
    const currentY = now.getFullYear();
    const currentM = now.getMonth() + 1;
    const currentD = now.getDate();

    // 年份标签
    yearLabel.textContent = currentY + '年';

    // 月份：1 ~ 12
    const months = [];
    for (let m = 1; m <= 12; m++) months.push(String(m));
    renderWheel('month', months, currentM - 1);

    // 日期：根据当前年月
    const daysInMonth = getDaysInMonth(currentY, currentM);
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) days.push(String(d));
    renderWheel('day', days, currentD - 1);

    // 小时：0 ~ 23
    const hours = [];
    for (let h = 0; h < 24; h++) hours.push(String(h).padStart(2, '0'));
    renderWheel('hour', hours, currentHour);

    // 分钟：0 ~ 59
    const minutes = [];
    for (let m = 0; m < 60; m++) minutes.push(String(m).padStart(2, '0'));
    renderWheel('minute', minutes, currentMinute);

    // 绑定事件
    bindWheel('month', onWheelDateChange);
    bindWheel('day', onWheelDateChange);
    bindWheel('hour', onWheelTimeChange);
    bindWheel('minute', onWheelTimeChange);
  }

  // 滚轮日期变化回调
  function onWheelDateChange() {
    const y = currentDate ? currentDate.getFullYear() : new Date().getFullYear();
    const m = parseInt(wheelState.month.items[wheelState.month.index]);
    const d = parseInt(wheelState.day.items[wheelState.day.index]);

    const maxDay = getDaysInMonth(y, m);
    if (wheelState.day.index >= maxDay) {
      const days = [];
      for (let i = 1; i <= maxDay; i++) days.push(String(i));
      renderWheel('day', days, maxDay - 1);
    }

    currentDate = new Date(y, m - 1, d);
    currentDate.setHours(0, 0, 0, 0);
    activeDatePreset = null;
    datePresetRow.querySelectorAll('.dp-preset.active').forEach(b => b.classList.remove('active'));
    updateDisplay();
  }

  // 滚轮时间变化回调
  function onWheelTimeChange() {
    currentHour = wheelState.hour.index;
    currentMinute = wheelState.minute.index;
    activeTimePreset = null;
    timePresetRow.querySelectorAll('.dp-preset.active').forEach(b => b.classList.remove('active'));
    updateDisplay();
  }

  // 设置滚轮到指定日期
  function setWheelToDate(date) {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const DATE_H = wheelState.month.itemH;

    // 年份标签
    yearLabel.textContent = y + '年';

    // 月份
    const monthIdx = m - 1;
    wheelState.month.index = monthIdx;
    wheelState.month.scrollTop = monthIdx * DATE_H;
    wheelState.month.listEl.style.transform = 'translateY(' + (-monthIdx * DATE_H) + 'px)';
    wheelState.month.listEl.querySelectorAll('.dp-wheel-item').forEach((el, i) => {
      el.classList.remove('selected', 'near', 'far');
      if (i === monthIdx) el.classList.add('selected');
      else if (Math.abs(i - monthIdx) <= 1) el.classList.add('near');
      else el.classList.add('far');
    });

    // 日期
    const maxDay = getDaysInMonth(y, m);
    const days = [];
    for (let i = 1; i <= maxDay; i++) days.push(String(i));
    const dayIdx = Math.min(d - 1, maxDay - 1);
    renderWheel('day', days, dayIdx);
  }

  // 设置时间滚轮
  function setWheelToTime(hour, minute) {
    const H = wheelState.hour.itemH;
    // 小时
    wheelState.hour.index = hour;
    wheelState.hour.scrollTop = hour * H;
    wheelState.hour.listEl.style.transform = 'translateY(' + (-hour * H) + 'px)';
    wheelState.hour.listEl.querySelectorAll('.dp-wheel-item').forEach((el, i) => {
      el.classList.remove('selected', 'near', 'far');
      if (i === hour) el.classList.add('selected');
      else if (Math.abs(i - hour) <= 1) el.classList.add('near');
      else el.classList.add('far');
    });
    // 分钟
    wheelState.minute.index = minute;
    wheelState.minute.scrollTop = minute * H;
    wheelState.minute.listEl.style.transform = 'translateY(' + (-minute * H) + 'px)';
    wheelState.minute.listEl.querySelectorAll('.dp-wheel-item').forEach((el, i) => {
      el.classList.remove('selected', 'near', 'far');
      if (i === minute) el.classList.add('selected');
      else if (Math.abs(i - minute) <= 1) el.classList.add('near');
      else el.classList.add('far');
    });
  }

  // 选择时间预设
  function selectTimePreset(preset) {
    const now = new Date();
    const presets = {
      now: { h: now.getHours(), m: now.getMinutes() },
      morning: { h: 8, m: 0 },
      noon: { h: 12, m: 0 },
      evening: { h: 20, m: 0 }
    };
    const p = presets[preset];
    if (!p) return;
    currentHour = p.h;
    currentMinute = p.m;
    setWheelToTime(p.h, p.m);
    timePresetRow.querySelectorAll('.dp-preset').forEach(function (b) {
      b.classList.toggle('active', b.dataset.time === preset);
    });
    activeTimePreset = preset;
  }
  function formatDisplayText() {
    if (!currentDate) return '选择提醒时间（可选）';
    const d = new Date(currentDate);
    const hh = String(currentHour).padStart(2, '0');
    const mm = String(currentMinute).padStart(2, '0');
    const dateStr = (d.getMonth() + 1) + '月' + d.getDate() + '日';
    const timeStr = hh + ':' + mm;
    let text = dateStr + ' ' + timeStr;
    if (currentRecurrence) {
      text += ' · ' + formatRecurrenceShort(currentRecurrence);
    }
    return text;
  }

  function formatRecurrenceShort(r) {
    if (!r || !r.enabled) return '';
    const unitMap = { minute: '分钟', hour: '小时', day: '天', week: '周' };
    let text = '每' + r.interval + unitMap[r.unit];
    // 有目标次数时追加显示（如 "每30分钟 ×8次"）
    if (r.targetCount && r.targetCount > 0) {
      text += ' ×' + r.targetCount + '次';
    }
    return text;
  }

  function formatRecurrenceLong(r) {
    if (!r || !r.enabled) return '';
    const unitMap = { minute: '分钟', hour: '小时', day: '天', week: '周' };
    return '每 ' + r.interval + ' ' + unitMap[r.unit] + '循环';
  }

  // 获取当前选中的完整时间戳
  function getTimestamp() {
    if (!currentDate) return null;
    const d = new Date(currentDate);
    d.setHours(currentHour, currentMinute, 0, 0);
    return d.getTime();
  }

  // 获取循环设置
  function getRecurrence() {
    return currentRecurrence;
  }

  // 打开 popover
  function open() {
    datetimePopover.classList.add('open');
    datetimeTrigger.classList.add('active');
    // 更新"现在"按钮显示
    const nowBtn = document.getElementById('dpNowBtn');
    if (nowBtn) {
      nowBtn.textContent = '现在';
    }
    // 初始化日期为今天
    if (!currentDate) {
      selectDatePreset('today');
    }
  }

  // 关闭 popover
  function close() {
    datetimePopover.classList.remove('open');
    datetimeTrigger.classList.remove('active');
  }

  // 选择日期预设
  function selectDatePreset(preset) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let d = new Date(today);
    switch (preset) {
      case 'today': break;
      case 'tomorrow': d.setDate(d.getDate() + 1); break;
      case 'dayAfter': d.setDate(d.getDate() + 2); break;
      case 'nextWeek':
        const day = d.getDay();
        const diff = day === 1 ? 7 : (8 - day);
        d.setDate(d.getDate() + diff);
        break;
      default: return;
    }
    currentDate = d;
    currentDate.setHours(0, 0, 0, 0);
    // 同步到滚轮
    setWheelToDate(d);
    // 高亮预设按钮
    datePresetRow.querySelectorAll('.dp-preset').forEach(function (b) {
      b.classList.toggle('active', b.dataset.date === preset);
    });
    activeDatePreset = preset;
  }

  // 选择时间预设（旧版保留，已弃用）
  function selectTimePreset_Deprecated(preset) {
    const now = new Date();
    const presets = {
      now: { h: now.getHours(), m: now.getMinutes() },
      morning: { h: 8, m: 0 },
      noon: { h: 12, m: 0 },
      evening: { h: 20, m: 0 }
    };
    const p = presets[preset];
    if (!p) return;
    currentHour = p.h;
    currentMinute = p.m;
    setWheelToTime(p.h, p.m);
    timePresetRow.querySelectorAll('.dp-preset').forEach(function (b) {
      b.classList.toggle('active', b.dataset.time === preset);
    });
    activeTimePreset = preset;
  }

  // 选择循环预设
  function selectCyclePreset(preset) {
    let r = null;
    switch (preset) {
      case '30m': r = { enabled: true, interval: 30, unit: 'minute', targetCount: parseInt(cycleCountInput.value) || null }; break;
      case '1h': r = { enabled: true, interval: 1, unit: 'hour', targetCount: parseInt(cycleCountInput.value) || null }; break;
      case '1d': r = { enabled: true, interval: 1, unit: 'day', targetCount: parseInt(cycleCountInput.value) || null }; break;
      case '1w': r = { enabled: true, interval: 1, unit: 'week', targetCount: parseInt(cycleCountInput.value) || null }; break;
      case 'custom':
        customCycle.style.display = 'flex';
        cycleValueInput.value = cycleValueInput.value || '30';
        cycleUnitSelect.value = cycleUnitSelect.value || 'minute';
        r = {
          enabled: true,
          interval: parseInt(cycleValueInput.value) || 30,
          unit: cycleUnitSelect.value,
          targetCount: parseInt(cycleCountInput.value) || null
        };
        break;
      default: return;
    }
    currentRecurrence = r;
    cyclePresetRow.querySelectorAll('.dp-preset').forEach(function (b) {
      b.classList.toggle('active', b.dataset.cycle === preset);
    });
    activeCyclePreset = preset;
  }

  // 清除所有选择
  function clearAll() {
    currentDate = null;
    currentHour = 8;
    currentMinute = 0;
    currentRecurrence = null;
    activeDatePreset = null;
    activeTimePreset = null;
    activeCyclePreset = null;
    datetimeDisplay.textContent = '选择提醒时间（可选）';
    datetimeDisplay.classList.add('placeholder');
    // 清除预设高亮
    datePresetRow.querySelectorAll('.dp-preset.active').forEach(b => b.classList.remove('active'));
    timePresetRow.querySelectorAll('.dp-preset.active').forEach(b => b.classList.remove('active'));
    cyclePresetRow.querySelectorAll('.dp-preset.active').forEach(b => b.classList.remove('active'));
    // 重置循环
    cycleToggle.checked = false;
    cycleOptions.style.display = 'none';
    customCycle.style.display = 'none';
    cycleCountInput.value = ''; // 清空循环次数
    hourSelect.value = '08';
    minuteSelect.value = '00';
    // 重置滚轮到今天
    const now = new Date();
    setWheelToDate(now);
    setWheelToTime(8, 0);
    close();
  }

  // 同步值到显示（在自然语言解析成功后调用）
  function syncFromTimestamp(timestamp, recurrence) {
    if (timestamp) {
      const d = new Date(timestamp);
      currentDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      currentHour = d.getHours();
      currentMinute = d.getMinutes();
      // 同步到滚轮
      setWheelToDate(currentDate);
      setWheelToTime(currentHour, currentMinute);
    }
    if (recurrence) {
      currentRecurrence = recurrence;
      cycleToggle.checked = true;
      cycleOptions.style.display = 'block';
    }
    updateDisplay();
  }

  function updateDisplay() {
    const text = formatDisplayText();
    datetimeDisplay.textContent = text;
    if (!currentDate) {
      datetimeDisplay.classList.add('placeholder');
    } else {
      datetimeDisplay.classList.remove('placeholder');
    }
  }

  // 绑定事件
  function bind() {
    initWheelPicker();

    // 触发按钮点击 → 打开/关闭
    datetimeTrigger.addEventListener('click', function (e) {
      e.stopPropagation();
      if (datetimePopover.classList.contains('open')) {
        close();
      } else {
        open();
      }
    });

    // 点击外部关闭
    document.addEventListener('click', function (e) {
      if (!datetimePicker.contains(e.target)) {
        close();
      }
    });

    // 日期预设按钮
    datePresetRow.addEventListener('click', function (e) {
      const btn = e.target.closest('.dp-preset');
      if (!btn) return;
      selectDatePreset(btn.dataset.date);
      updateDisplay();
    });

    // 时间预设
    timePresetRow.addEventListener('click', function (e) {
      const btn = e.target.closest('.dp-preset');
      if (!btn) return;
      selectTimePreset(btn.dataset.time);
      updateDisplay();
    });

    // 循环开关
    cycleToggle.addEventListener('change', function () {
      if (cycleToggle.checked) {
        cycleOptions.style.display = 'block';
        // 默认选每 30 分钟
        if (!currentRecurrence || !currentRecurrence.enabled) {
          selectCyclePreset('30m');
          updateDisplay();
        }
      } else {
        cycleOptions.style.display = 'none';
        customCycle.style.display = 'none';
        currentRecurrence = null;
        activeCyclePreset = null;
        cyclePresetRow.querySelectorAll('.dp-preset.active').forEach(b => b.classList.remove('active'));
        updateDisplay();
      }
    });

    // 循环预设
    cyclePresetRow.addEventListener('click', function (e) {
      const btn = e.target.closest('.dp-preset');
      if (!btn) return;
      selectCyclePreset(btn.dataset.cycle);
      updateDisplay();
    });

    // 自定义循环值变化时更新
    cycleValueInput.addEventListener('input', function () {
      if (currentRecurrence && activeCyclePreset === 'custom') {
        currentRecurrence.interval = parseInt(cycleValueInput.value) || 30;
        updateDisplay();
      }
    });
    cycleUnitSelect.addEventListener('change', function () {
      if (currentRecurrence && activeCyclePreset === 'custom') {
        currentRecurrence.unit = cycleUnitSelect.value;
        updateDisplay();
      }
    });
    // 循环次数变化时更新到 recurrence 对象
    cycleCountInput.addEventListener('input', function () {
      if (currentRecurrence && currentRecurrence.enabled) {
        currentRecurrence.targetCount = parseInt(cycleCountInput.value) || null;
      }
    });

    // 清除按钮
    clearBtn.addEventListener('click', function () {
      clearAll();
    });

    // 确定按钮：关闭 popover（实际提交在 wrappedAddTodo 中处理）
    confirmBtn.addEventListener('click', function () {
      if (!currentDate) {
        // 没有选日期，关闭不做任何事
        close();
        return;
      }
      updateDisplay();
      close();
    });

    // ESC 关闭
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && datetimePopover.classList.contains('open')) {
        close();
      }
    });
  }

  // 公开接口
  return {
    bind: bind,
    getTimestamp: getTimestamp,
    getRecurrence: getRecurrence,
    syncFromTimestamp: syncFromTimestamp,
    clearAll: clearAll,
    formatRecurrenceShort: formatRecurrenceShort,
    formatRecurrenceLong: formatRecurrenceLong
  };
})();

// 启动日期选择器
datetimePickerModule.bind();


// ===== 11. 提醒模块（提醒日期 + 音效）=====
// 独立 IIFE 封装，避免污染全局。对外暴露 window.reminderModule 接口供其他模块调用。
// 功能：自然语言解析提醒时间 / Web Audio 程序合成提示音 / 精确 setTimeout 调度 / 漏检补触发

(function () {
  'use strict';

  // ---------- 11.1 模块状态 ----------
  // 调度表：key 为 todo.id，value 为 setTimeout 返回的 timerId
  // 用于在事项被删除/完成/重新编辑时取消旧定时器，避免幽灵提醒
  const reminderTimers = new Map();
  // AudioContext 实例（首次用户交互后创建并 resume）
  let audioCtx = null;


  // ---------- 11.2 时间格式化 ----------

  // 把 Date 对象转换为 datetime-local 输入框接受的格式：yyyy-MM-ddTHH:mm
  // 注意：datetime-local 不接受秒，也不接受时区后缀
  function formatToLocalInputValue(date) {
    const yyyy = date.getFullYear();
    const MM = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const HH = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return yyyy + '-' + MM + '-' + dd + 'T' + HH + ':' + mm;
  }


  // ---------- 11.3 自然语言解析 ----------

  // ===== 农历数据表（1900-2100年）=====
  // 每个条目用 20 位二进制编码一年的农历信息：
  //   位 0-3：闰月月份（0=无闰月，1-12=闰几月）
  //   位 4-15：12个月，每位表示该月天数（1=30天，0=29天）
  //   位 16：闰月天数（1=30天，0=29天）
  const lunarInfo = [
    0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
    0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
    0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
    0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
    0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
    0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5d0, 0x14573, 0x052d0, 0x0a9a8, 0x0e950, 0x06aa0,
    0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
    0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b5a0, 0x195a6,
    0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
    0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0,
    0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
    0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
    0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
    0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
    0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
    0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
    0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
    0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
    0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
    0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
    0x0d520
  ];

  // 农历 1900 年正月初一对应的阳历日期：1900-01-31
  const LUNAR_BASE_DATE = new Date(1900, 0, 31);

  // 获取某农历年的闰月月份（0=无闰月）
  function getLunarLeapMonth(year) {
    return lunarInfo[year - 1900] & 0xf;
  }

  // 获取某农历年闰月的天数（0=无闰月）
  function getLunarLeapDays(year) {
    const leapMonth = getLunarLeapMonth(year);
    if (leapMonth === 0) return 0;
    return (lunarInfo[year - 1900] & 0x10000) ? 30 : 29;
  }

  // 获取某农历年某月的天数（1-12月）
  // 编码规则：bit 4 = 1月, bit 5 = 2月, ..., bit 15 = 12月（1=30天, 0=29天）
  function getLunarMonthDays(year, month) {
    const mask = 1 << (4 + month - 1); // month 1 → bit 4, month 12 → bit 15
    return (lunarInfo[year - 1900] & mask) ? 30 : 29;
  }

  // 获取某农历年的总天数
  function getLunarYearDays(year) {
    let sum = 348; // 12个月 × 29天（基础）
    // 统计 bits 4-15 中有多少位为 1（即有多少个月是 30 天）
    for (let bit = 4; bit <= 15; bit++) {
      sum += (lunarInfo[year - 1900] & (1 << bit)) ? 1 : 0;
    }
    return sum + getLunarLeapDays(year);
  }

  // 农历转阳历（返回 { year, month, day }）
  function lunarToSolar(lunarYear, lunarMonth, lunarDay, isLeapMonth) {
    // 计算从 1900-01-31 到目标农历日期的天数偏移
    let offset = 0;
    // 累加整年
    for (let y = 1900; y < lunarYear; y++) {
      offset += getLunarYearDays(y);
    }
    // 累加当年月份
    const leapMonth = getLunarLeapMonth(lunarYear);
    for (let m = 1; m < lunarMonth; m++) {
      offset += getLunarMonthDays(lunarYear, m);
    }
    // 如果目标月在闰月之后，需要加上闰月天数
    if (leapMonth > 0 && lunarMonth > leapMonth) {
      offset += getLunarLeapDays(lunarYear);
    }
    // 如果是闰月，需要加上前面所有月份 + 闰月之前的天数
    if (isLeapMonth) {
      offset += getLunarMonthDays(lunarYear, lunarMonth); // 先加本月（非闰月）
      offset += getLunarLeapDays(lunarYear); // 再加闰月
    }
    // 加上当月的天数偏移
    offset += lunarDay - 1;
    // 计算阳历日期
    const solarDate = new Date(LUNAR_BASE_DATE.getTime() + offset * 24 * 60 * 60 * 1000);
    return {
      year: solarDate.getFullYear(),
      month: solarDate.getMonth() + 1,
      day: solarDate.getDate()
    };
  }

  // 中文数字 → 阿拉伯数字映射（用于解析"七点""半小时"等中文表达）
  const CN_NUM = {
    '零': 0, '半': 0.5, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
    '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20, '廿': 20,
    '三十': 30, '卅': 30, '四十': 40, '五十': 50, '六十': 60, '七十': 70,
    '八十': 80, '九十': 90, '百': 100
  };

  // 把中文数字字符串转为整数（支持"七""十二""二十""廿九""三十一""一百"等）
  function cnToNumber(str) {
    if (/^\d+$/.test(str)) return parseInt(str, 10);       // 纯数字直接返回
    if (CN_NUM[str] !== undefined) return CN_NUM[str];       // 查表
    // 组合数字：廿/卅 + [一~九]，如"廿九"=29、"卅一"=31
    const nianRe = /^([廿卅])([一二两三四五六七八九])?$/;
    const mNian = str.match(nianRe);
    if (mNian) {
      const base = CN_NUM[mNian[1]]; // 廿=20, 卅=30
      const ones = mNian[2] ? CN_NUM[mNian[2]] : 0;
      return base + ones;
    }
    // 组合数字：[X十][Y] 模式，如"二十一"=21、"三十一"=31、"九十九"=99
    const comboRe = /^([一二两三四五六七八九])十([一二两三四五六七八九])?$/;
    const m = str.match(comboRe);
    if (m) {
      const tens = CN_NUM[m[1]];
      const ones = m[2] ? CN_NUM[m[2]] : 0;
      if (tens !== undefined && (m[2] === undefined || ones !== undefined)) {
        return tens * 10 + ones;
      }
    }
    // 组合数字：[X百][Y十][Z] 模式，如"一百"=100、"一百零一"=100
    const hundredRe = /^([一二两三四五六七八九])百(([一二两三四五六七八九])十)?([一二两三四五六七八九])?$/;
    const m2 = str.match(hundredRe);
    if (m2) {
      const hundreds = CN_NUM[m2[1]] * 100;
      const tens = m2[3] ? CN_NUM[m2[3]] * 10 : 0;
      const ones = m2[4] ? CN_NUM[m2[4]] : 0;
      return hundreds + tens + ones;
    }
    return NaN;
  }

  // 预处理：中文月份/日期 → 阿拉伯数字
  // 例："八月十五号提醒我开会" → "8月15提醒我开会"
  //     "十二月三十一日" → "12月31"
  //     "8/15提醒我吃饭" → "8月15提醒我吃饭"
  function convertChineseDate(text) {
    // 斜杠日期：8/15、12/31 → 8月15、12月31
    text = text.replace(/(\d{1,2})\/(\d{1,2})/g, '$1月$2');
    // 中文月份：X月（一月~十二月），如"八月"→"8月"、"十二月"→"12月"
    const cnMonthRe = /([一二两三四五六七八九十]+)月/g;
    text = text.replace(cnMonthRe, function (match, cnMonth) {
      const num = cnToNumber(cnMonth);
      return isNaN(num) ? match : (num + '月');
    });
    // 中文日期：X号/X日（一号~三十一号），如"十五号"→"15"、"三十一日"→"31"
    // 注意：前面不能是"周"（避免把"周五"中的"五"误转）
    //       后面不能跟"点"（避免把"七点"中的"七"误转）
    //       后面不能跟"刻"（避免把"一刻"中的"一"误转）
    const cnDayRe = /(?<!周)([一二两三四五六七八九十]+)(?![点刻])(号|日)?/g;
    text = text.replace(cnDayRe, function (match, cnDay, suffix) {
      // 只转换合理的日期数字（1-31），避免误转换其他中文数字
      const num = cnToNumber(cnDay);
      if (isNaN(num) || num < 1 || num > 31) return match;
      return num + '';
    });
    return text;
  }

  // 解析文本中的提醒时间，并返回剥离时间词后的纯事项文本
  // 支持规则（按优先级从高到低）：
  //   "八月十五号提醒我开会" → 当年 8 月 15 日 9:00（已过则明年），文本"开会"
  //   "8月15日 8:00"       → 当年 8 月 15 日 8:00（已过则明年）
  //   "明天8:00"           → 明天 8:00
  //   "后天早上体检"        → 后天 8:00
  //   "大后天提醒我面试"    → 3 天后 9:00
  //   "下周一提醒我交周报"  → 下周一 9:00
  //   "周五晚上聚会"        → 周五 19:00
  //   "每30分钟提醒我喝水"  → 30 分钟后 + 自动开启循环
  //   "每天8点起床"        → 今天 8:00 + 自动开启循环
  //   "半小时后提醒我喝水"  → 30 分钟后，文本"喝水"
  //   "1小时后"/"两小时后"  → 1/2 小时后
  //   "七点提醒我洗澡"      → 今天 7:00（已过则明天），文本"洗澡"
  //   "八点半提醒我睡觉"    → 今天 8:30（已过则明天），文本"睡觉"
  //   "早上8点跑步"        → 今天 8:00（已过则明天）
  //   "晚上9点关灯"        → 今天 21:00
  //   "今天晚上八点半"      → 今天 20:30（已过则明天）
  //   "明天下午三点"        → 明天 15:00
  //   "一会儿提醒我"        → 5 分钟后
  //   "8:00"               → 今天 8:00（已过则明天）
  //   "过10分钟"           → 10 分钟后（新）
  //   "再过2小时"          → 2 小时后（新）
  //   "大后天"             → 3 天后（新）
  //   "明天早上"           → 明天 7:00（新）
  //   "后天下午"           → 后天 15:00（新）
  // 失败：返回 { text: 原文, remindAt: null, recurrence: null }
  function parseReminderFromText(rawText) {
    // 预处理：先把中文月份/日期转为阿拉伯数字（如"八月十五号"→"8月15日"）
    // 但农历日期需要保留中文数字用于转换，所以先标记农历前缀
    let text = convertChineseDate(rawText.trim());
    let remindAt = null;
    let recurrence = null;   // 循环设置（每X 模式时自动填充）
    const now = new Date();

    // ===== 预处理：提取"提醒我XXX"中的事项内容 =====
    const remindActionRe = /(?:提醒我|提醒|叫我)([一-龥a-zA-Z0-9]+)/;
    const actionMatch = text.match(remindActionRe);

    // ===== 辅助函数：构造返回结果并清理文本 =====
    function result(finalText, ts) {
      let t = finalText.trim();
      // 清理残留的"提醒我/提醒/叫我"前缀，提取真正的动作
      t = t.replace(/^(提醒我|提醒|叫我)\s*/, '').trim();
      // 清理末尾可能残留的"提醒我/提醒/叫我"
      t = t.replace(/\s*(提醒我|提醒|叫我)$/, '').trim();
      // 如果剥离后为空但有"提醒我XXX"的动作，用动作作为文本
      if (!t && actionMatch) t = actionMatch[1];
      return { text: t || rawText, remindAt: ts, recurrence: recurrence };
    }

    // ===== 辅助函数：从文本开头解析时段词+时间 =====
    // 支持："早上8点"、"下午3：30"、"晚上"（纯时段）、"8：30"（纯时间）
    // 返回 { hour, min, matchedLength, period }
    function parsePeriodAndTime(str) {
      const periodMap = { '早上': 7, '早晨': 7, '上午': 9, '中午': 12, '下午': 15, '晚上': 19, '凌晨': 0 };
      const periodOffset = { '早上': 0, '早晨': 0, '上午': 0, '中午': 12, '下午': 12, '晚上': 12, '凌晨': 0 };
      let hour = 9, min = 0, length = 0, period = '';
      // 先匹配时段词
      const mPeriod = str.match(/^(早上|早晨|上午|中午|下午|晚上|凌晨)\s*/);
      if (mPeriod) {
        period = mPeriod[1];
        hour = periodMap[period] || 9;
        length = mPeriod[0].length;
      }
      // 再匹配具体时间（覆盖时段默认值）
      // 支持格式：
      //   数字+冒号：8:30、8：30、15:45
      //   数字+点系列：8点、8点半、8点整、8点30分、8点30
      //   中文+点系列：八点、八点半、八点整、九点一刻、八点二十分、八点二十
      const remaining = str.slice(length);
      let mTime = null;

      // 尝试匹配：数字+冒号 (8:30, 8：30)
      mTime = remaining.match(/^(\d{1,2})[：:](\d{2})/);
      if (mTime) {
        hour = parseInt(mTime[1], 10);
        min = parseInt(mTime[2], 10) || 0;
      } else {
        // 尝试匹配：数字+点系列 (8点, 8点半, 8点整, 8点30分, 8点30)
        // 注意：长的后缀放前面（点半、点整、点一刻），避免"点"先匹配导致"点半"被截断
        mTime = remaining.match(/^(\d{1,2})(点半|点整|点一刻|点(\d{1,2})分?|点)/);
        if (mTime) {
          hour = parseInt(mTime[1], 10);
          const suffix = mTime[2];
          if (suffix === '点半') min = 30;
          else if (suffix === '点整') min = 0;
          else if (suffix === '点一刻') min = 15;
          else if (suffix.startsWith('点')) min = parseInt(mTime[3] || '0', 10);  // mTime[3]是分钟数字
          else min = 0;
        } else {
          // 尝试匹配：中文+点系列 (八点, 八点半, 八点整, 九点一刻, 八点二十分, 八点二十, 八点30分)
          // 同样：长的后缀放前面
          mTime = remaining.match(/^([一二两三四五六七八九十]+)(点半|点整|点一刻|点([一二两三四五六七八九十]+)分?|点(\d{1,2})分?|点)/);
          if (mTime) {
            hour = cnToNumber(mTime[1]);
            const suffix = mTime[2];
            if (suffix === '点半') min = 30;
            else if (suffix === '点整') min = 0;
            else if (suffix === '点一刻') min = 15;
            else if (suffix.startsWith('点')) {
              // 中文分钟或数字分钟 (mTime[3]是中文分钟, mTime[4]是数字分钟)
              if (mTime[3]) min = cnToNumber(mTime[3]) || 0;
              else if (mTime[4]) min = parseInt(mTime[4], 10);
              else min = 0;
            }
            else min = 0;
          }
        }
      }

      if (mTime) {
        // 有时段词且时间为 12 小时制（<12），加偏移转 24 小时制
        if (period && hour < 12 && periodOffset[period] > 0) hour += periodOffset[period];
        length += mTime[0].length;
      }
      return { hour, min, matchedLength: length, period };
    }

      // ===== 规则 0.5：农历日期（农历X月Y日 → 转换为阳历）=====
    // 例：农历八月十五提醒我赏月、农历正月初一拜年、农历腊月三十除夕
    // 注意：农历日期前面有"农历"或"阴历"前缀
    // 支持"正月"=1月、"腊月"=12月、"闰X月"、"初一"~"初十"
    // 因为 convertChineseDate 会把中文数字转成阿拉伯数字，所以这里用原始文本匹配
    const rawTextTrimmed = rawText.trim();
    const lunarRe = /(农历|阴历)\s*(闰)?(正|腊|[一二两三四五六七八九十廿]+)月(初[一二三四五六七八九十]|[一二两三四五六七八九十廿]+)(?:号|日)?/;
    const mLunar = rawTextTrimmed.match(lunarRe);
    if (mLunar) {
      const isLeap = !!mLunar[2]; // 是否闰月
      // 处理特殊月份名称："正月"=1月，"腊月"=12月
      let lunarMonthStr = mLunar[3];
      let lunarMonth;
      if (lunarMonthStr === '正') lunarMonth = 1;
      else if (lunarMonthStr === '腊') lunarMonth = 12;
      else lunarMonth = cnToNumber(lunarMonthStr);
      // 处理日期："初X"格式（初一~初十）
      let lunarDayStr = mLunar[4];
      let lunarDay;
      if (lunarDayStr.startsWith('初')) {
        // "初"后面的数字：初一=1, 初二=2, ..., 初十=10
        const dayNum = cnToNumber(lunarDayStr.slice(1));
        lunarDay = isNaN(dayNum) ? NaN : dayNum;
      } else {
        lunarDay = cnToNumber(lunarDayStr);
      }
      if (!isNaN(lunarMonth) && !isNaN(lunarDay) && lunarMonth >= 1 && lunarMonth <= 12 && lunarDay >= 1 && lunarDay <= 30) {
        // 尝试用当前年份转换，如果已过则用下一年
        const currentYear = now.getFullYear();
        let solar = lunarToSolar(currentYear, lunarMonth, lunarDay, isLeap);
        let d = new Date(solar.year, solar.month - 1, solar.day, 9, 0, 0);
        // 解析农历日期后面的时段词+时间（从原始文本截取）
        const afterLunar = rawTextTrimmed.slice(mLunar[0].length);
        const pt = parsePeriodAndTime(afterLunar);
        d.setHours(pt.hour, pt.min, 0, 0);
        if (d.getTime() <= now.getTime()) {
          // 今年已过，尝试明年
          solar = lunarToSolar(currentYear + 1, lunarMonth, lunarDay, isLeap);
          d = new Date(solar.year, solar.month - 1, solar.day, pt.hour, pt.min, 0);
        }
        remindAt = d.getTime();
        // 从原始文本中截取农历日期之后的部分
        const afterLunarRaw = rawTextTrimmed.slice(mLunar[0].length);
        text = afterLunarRaw.slice(pt.matchedLength).trim();
        return result(text, remindAt);
      }
    }

    // ===== 规则 1：明确日期（X月Y日/号，"日/号"可选） + 可选时段/时间 =====
    // 例：8月15日 8:00、8月15、8月15日八点、八月十五上午、8月15号下午3点
    const dateRe = /(\d{1,2})月(\d{1,2})[日号]?\s*/;
    const m1 = text.match(dateRe);
    if (m1) {
      const month = parseInt(m1[1], 10);
      const day = parseInt(m1[2], 10);
      // 日期后面可能跟时段词+时间，用辅助函数解析
      const pt = parsePeriodAndTime(text.slice(m1[0].length));
      const d = new Date(now.getFullYear(), month - 1, day, pt.hour, pt.min, 0);
      if (d.getTime() <= now.getTime()) d.setFullYear(d.getFullYear() + 1); // 已过则明年
      remindAt = d.getTime();
      text = text.slice(m1[0].length + pt.matchedLength).trim();
      return result(text, remindAt);
    }

    // ===== 规则 1.5：纯日期（仅"日"部分，无月份）+ 可选时段/时间 =====
    // 例：十五号、15号、15日、十五号下午 → 当月该日（已过则下月）
    // 排除：后面跟"：/:"/"点"（时间）或"分钟/小时/天"（相对时间）的数字
    const dayOnlyRe = /^(\d{1,2})号?日?\s*/;
    const mDayOnly = text.match(dayOnlyRe);
    if (mDayOnly && !text.includes('月') && !/^\d{1,2}[：:]/.test(text) && !/^\d{1,2}点/.test(text) && !/^\d{1,2}\s*(分钟|分|小时|时|天|周|星期)/.test(text)) {
      const day = parseInt(mDayOnly[1], 10);
      if (day >= 1 && day <= 31) {
        const pt = parsePeriodAndTime(text.slice(mDayOnly[0].length));
        const d = new Date(now.getFullYear(), now.getMonth(), day, pt.hour, pt.min, 0);
        if (d.getTime() <= now.getTime()) d.setMonth(d.getMonth() + 1); // 已过则下月
        remindAt = d.getTime();
        text = text.slice(mDayOnly[0].length + pt.matchedLength).trim();
        return result(text, remindAt);
      }
    }

    // ===== 规则 1.6：今晚 + 可选时段/时间 =====
    // 例：今晚提醒我吃饭、今晚8：30（→20:30）、今晚八点
    const tonightRe = /今晚\s*/;
    const mTonight = text.match(tonightRe);
    if (mTonight) {
      const pt = parsePeriodAndTime(text.slice(mTonight[0].length));
      let hour, min;
      if (pt.matchedLength > 0) {
        // 有具体时间：如果 hour < 12，加 12 转 24 小时制（今晚默认晚上）
        hour = pt.hour < 12 ? pt.hour + 12 : pt.hour;
        min = pt.min;
      } else {
        // 没匹配到任何时段/时间，默认 19:00
        hour = 19;
        min = 0;
      }
      const d = new Date(now);
      d.setHours(hour, min, 0, 0);
      if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1); // 已过则明天
      remindAt = d.getTime();
      text = text.slice(mTonight[0].length + pt.matchedLength).trim();
      return result(text, remindAt);
    }

    // ===== 规则 2："明天/后天/大后天" + 可选时段/时间 =====
    // 例：明天8:00、明天早上8点、后天早上体检、大后天提醒我面试、明天七点
    const futureDayRe = /(大后天|后天|明天)\s*/;
    const m2 = text.match(futureDayRe);
    if (m2) {
      const dayType = m2[1];
      const d = new Date(now);
      const dayOffset = dayType === '大后天' ? 3 : (dayType === '后天' ? 2 : 1);
      d.setDate(d.getDate() + dayOffset);
      // 用辅助函数解析时段+时间
      const pt = parsePeriodAndTime(text.slice(m2[0].length));
      d.setHours(pt.hour, pt.min, 0, 0);
      remindAt = d.getTime();
      text = text.slice(m2[0].length + pt.matchedLength).trim();
      return result(text, remindAt);
    }

    // ===== 规则 3：星期/周（本/上/下 + 周X）+ 可选时段/时间 =====
    // 例：下周一提醒我交周报、周五晚上聚会、本周五交作业、周三早上开会
    // "本"=本周（默认），"上"=上周，"下"=下周
    const weekRe = /(本+|上+|下+)?周?(周一|周二|周三|周四|周五|周六|周日|周天|星期天)\s*/;
    const mWeek = text.match(weekRe);
    if (mWeek) {
      const prefix = mWeek[1] || '';
      const dayName = mWeek[2];
      const dayMap = { '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '周日': 0, '周天': 0, '星期天': 0 };
      const targetDay = dayMap[dayName];
      const d = new Date(now);
      // 计算到目标星期的天数差
      let diff = targetDay - now.getDay();
      if (diff <= 0) diff += 7; // 今天已过或就是今天，取下周
      // 如果有"上"前缀且 diff <= 7，则再往前推一周；有"下"前缀则往后推
      if (prefix.includes('上') && diff <= 7) diff += 7;
      if (prefix.includes('下') && diff <= 7) diff += 7;
      d.setDate(d.getDate() + diff);
      // 用辅助函数解析时段+时间
      const pt = parsePeriodAndTime(text.slice(mWeek[0].length));
      d.setHours(pt.hour, pt.min, 0, 0);
      remindAt = d.getTime();
      text = text.slice(mWeek[0].length + pt.matchedLength).trim();
      return result(text, remindAt);
    }

    // ===== 规则 4："每X"循环提醒（每30分钟、每天8点、每周一）=====
    // 例：每30分钟提醒我喝水、每天8点起床、每周一开会
    const everyRe = /每(\d+)?\s*(半)?\s*(分钟|分|小时|时|天|周|星期|周[一二三四五六日]|周一|周二|周三|周四|周五|周六|周日)\s*(?:(\d{1,2}):(\d{2})|([一二两三四五六七八九十]+)点(?:半|一刻)?(\d{1,2})?分?|早上|早晨|上午|中午|下午|晚上|凌晨)?/;
    const mEvery = text.match(everyRe);
    if (mEvery) {
      let value = mEvery[1] ? parseInt(mEvery[1], 10) : 1;
      if (mEvery[2]) value += 0.5; // "半"
      const unit = mEvery[3];
      // 计算首次提醒时间
      const d = new Date(now);
      if (unit === '分钟' || unit === '分') {
        d.setMinutes(d.getMinutes() + value);
      } else if (unit === '小时' || unit === '时') {
        d.setHours(d.getHours() + value);
      } else if (unit === '天') {
        // 每天：如果给了具体时间就用该时间，否则 1 天后
        if (mEvery[4]) {
          d.setHours(parseInt(mEvery[4], 10), parseInt(mEvery[5], 10), 0, 0);
          if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
        } else if (mEvery[6]) {
          let hour = cnToNumber(mEvery[6]);
          let min = 0;
          if (mEvery[0].includes('半')) min = 30;
          d.setHours(hour, min, 0, 0);
          if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
        } else {
          d.setDate(d.getDate() + 1);
        }
      } else if (unit === '周' || unit === '星期') {
        d.setDate(d.getDate() + 7); // 1 周后
      } else if (/周[一二三四五六日]/.test(unit) || ['周一','周二','周三','周四','周五','周六','周日'].includes(unit)) {
        // 每周X：计算到目标星期的天数
        const dayMap = { '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '周日': 0 };
        const dayShort = unit.replace('周', '周'); // 统一
        const targetDay = dayMap[unit] || dayMap['周' + unit.slice(-1)];
        let diff = targetDay - now.getDay();
        if (diff <= 0) diff += 7;
        d.setDate(d.getDate() + diff);
        d.setHours(9, 0, 0, 0);
      }
      remindAt = d.getTime();
      text = text.replace(everyRe, '').trim();
      // 自动设置循环
      recurrence = { enabled: true, intervalMs: getIntervalMsForUnit(unit, value) };
      if (!text && actionMatch) text = actionMatch[1];
      return result(text, remindAt);
    }

    // ===== 规则 5：相对时间（X分钟后/X小时后/X天后/过X分钟/再过Y小时）=====
    // 例：半小时后提醒我喝水、1小时后、两小时后、20分钟后、3天后、过10分钟、再过2小时
    const relRe = /(?:过|再过)?\s*(\d+)?\s*(半|[一二两三四五六七八九十百]+)?\s*(分钟|分|小时|时|天|周|星期)后/;
    const mRel = text.match(relRe);
    if (mRel) {
      let value = 0;
      if (mRel[1]) {
        value = parseInt(mRel[1], 10);
        if (mRel[2]) value += cnToNumber(mRel[2]) || 0;
      } else if (mRel[2]) {
        value = cnToNumber(mRel[2]);
      }
      const unit = mRel[3];
      const d = new Date(now);
      if (unit === '分钟' || unit === '分') d.setMinutes(d.getMinutes() + value);
      else if (unit === '小时' || unit === '时') d.setHours(d.getHours() + value);
      else if (unit === '天') d.setDate(d.getDate() + value);
      else if (unit === '周' || unit === '星期') d.setDate(d.getDate() + value * 7);
      remindAt = d.getTime();
      text = text.replace(relRe, '').trim();
      if (!text && actionMatch) text = actionMatch[1];
      return result(text, remindAt);
    }

    // ===== 规则 6：时段 + 时间（早上8点、中午12点、晚上9点、早上八点）=====
    // 例：早上8点跑步、中午12点吃饭、晚上9点关灯、早上八点晨跑
    // 支持：今天/明天 + 时段 + 各种时间格式（8点半、8点30分、八点整、九点一刻等）
    const periodTimeRe = /(今天|明天)?\s*(早上|早晨|上午|中午|下午|晚上|凌晨)\s*/;
    const mPt = text.match(periodTimeRe);
    if (mPt) {
      const dayPrefix = mPt[1];  // "今天"或"明天"（可选）
      const periodWord = mPt[2]; // 时段词（早上、下午等）
      // 用辅助函数解析时段后的各种时间格式
      const pt = parsePeriodAndTime(text.slice(mPt[0].length));
      let hour = pt.hour;
      const min = pt.min;
      // 根据时段词对小时进行偏移（12 小时制 → 24 小时制）
      const periodOffsetMap = { '早上': 0, '早晨': 0, '上午': 0, '中午': 12, '下午': 12, '晚上': 12, '凌晨': 0 };
      if (hour < 12 && periodOffsetMap[periodWord] > 0) {
        hour += periodOffsetMap[periodWord];
      }
      const d = new Date(now);
      // 处理"今天/明天"前缀
      if (dayPrefix === '明天') {
        d.setDate(d.getDate() + 1);
      }
      d.setHours(hour, min, 0, 0);
      // "今天"前缀且时间已过，则推到明天；无前缀保持原逻辑
      if (d.getTime() <= now.getTime()) {
        if (dayPrefix === '今天') d.setDate(d.getDate() + 1);
        else if (!dayPrefix) d.setDate(d.getDate() + 1);
      }
      remindAt = d.getTime();
      text = text.slice(mPt[0].length + pt.matchedLength).trim();
      if (!text && actionMatch) text = actionMatch[1];
      return result(text, remindAt);
    }

    // ===== 规则 6.5：纯时段词（无具体时间，单独使用）=====
    // 例：上午提醒我吃饭、下午提醒我开会、晚上提醒我跑步、下午3点
    // 默认时间：早上/早晨/上午=9:00、中午=12:00、下午=15:00、晚上=19:00、凌晨=0:00
    const periodOnlyRe = /^(早上|早晨|上午|中午|下午|晚上|凌晨)\s*/;
    const mPeriodOnly = text.match(periodOnlyRe);
    if (mPeriodOnly && !/\d{1,2}月/.test(text)) {
      // 用辅助函数解析时段+时间
      const pt = parsePeriodAndTime(text.slice(mPeriodOnly[0].length));
      // 如果辅助函数没匹配到任何内容，使用时段默认值
      const hour = pt.matchedLength > 0 ? pt.hour : { '早上': 7, '早晨': 7, '上午': 9, '中午': 12, '下午': 15, '晚上': 19, '凌晨': 0 }[mPeriodOnly[1]] || 9;
      const min = pt.matchedLength > 0 ? pt.min : 0;
      const d = new Date(now);
      d.setHours(hour, min, 0, 0);
      if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1); // 已过则明天
      remindAt = d.getTime();
      text = text.slice(mPeriodOnly[0].length + pt.matchedLength).trim();
      return result(text, remindAt);
    }

    // ===== 智能时间推断：纯时间（无时段词，无日期）=====
    // 支持各种格式：
    //   中文数字：七点、八点半、九点一刻、八点二十分、八点二十
    //   阿拉伯数字：8点半、8点30分、8点30、9点整、9点一刻、8:30
    // 例：七点提醒我洗澡、八点半提醒我睡觉、8点30分提醒我吃饭
    //
    // 智能推断逻辑（上午说的优先上午，下午说的优先下午）：
    //   1. 如果原始时间还没到 → 今天
    //   2. 如果原始时间已过，加 12 小时（上午→下午）还没到 → 今天
    //   3. 如果加 12 小时也过了 → 明天
    // 例：下午 14:00 说"八点半" → 20:30（今天）；晚上 21:00 说"八点半" → 明天 8:30
    function smartTimeResolve(hour, min) {
      const d = new Date(now);
      d.setHours(hour, min, 0, 0);
      if (d.getTime() > now.getTime()) {
        // 1) 原始时间还没到 → 直接用
        return d;
      }
      // 2) 原始时间已过，尝试加 12 小时（上午→下午/晚上）
      const d2 = new Date(now);
      d2.setHours(hour + 12, min, 0, 0);
      if (d2.getTime() > now.getTime() && hour + 12 < 24) {
        return d2;
      }
      // 3) 加 12 小时也过了或超出 24 → 明天
      d.setDate(d.getDate() + 1);
      return d;
    }

    // ===== 规则 7：纯时间（中文格式）=====
    const cnTimeRe = /^(\d{1,2}|[一二两三四五六七八九十]+)(点半|点整|点一刻|点(\d{1,2}|[一二两三四五六七八九十]+)分?|点)/;
    const mCn = text.match(cnTimeRe);
    if (mCn) {
      let hour, min = 0;
      const hourStr = mCn[1];
      const suffix = mCn[2];
      // 解析小时（中文或数字）
      if (/^\d+$/.test(hourStr)) {
        hour = parseInt(hourStr, 10);
      } else {
        hour = cnToNumber(hourStr);
      }
      // 解析分钟
      if (suffix === '点半') min = 30;
      else if (suffix === '点整') min = 0;
      else if (suffix === '点一刻') min = 15;
      else if (suffix.startsWith('点')) {
        // 中文分钟或数字分钟 (mCn[3]是分钟部分)
        if (mCn[3]) {
          if (/^\d+$/.test(mCn[3])) {
            min = parseInt(mCn[3], 10);
          } else {
            min = cnToNumber(mCn[3]) || 0;
          }
        }
      }
      const d = smartTimeResolve(hour, min);
      remindAt = d.getTime();
      text = text.slice(mCn[0].length).trim();
      if (!text && actionMatch) text = actionMatch[1];
      return result(text, remindAt);
    }

    // ===== 规则 8：纯数字时间 "HH:MM" 或 "HH：MM"（全角冒号）=====
    const timeRe = /(\d{1,2})[：:](\d{2})/;
    const m3 = text.match(timeRe);
    if (m3) {
      const hour = parseInt(m3[1], 10);
      const min = parseInt(m3[2], 10);
      const d = smartTimeResolve(hour, min);
      remindAt = d.getTime();
      text = text.replace(timeRe, '').trim();
      if (!text && actionMatch) text = actionMatch[1];
      return result(text, remindAt);
    }

    // ===== 规则 9："一会儿/等会/等一下"（模糊稍后，默认 5 分钟后）=====
    if (/^(一会儿|等会|等一下|稍后|待会|过会儿)/.test(text)) {
      const d = new Date(now);
      d.setMinutes(d.getMinutes() + 5); // 默认 5 分钟后
      remindAt = d.getTime();
      text = text.replace(/^(一会儿|等会|等一下|稍后|待会|过会儿)\s*/, '').trim();
      if (!text && actionMatch) text = actionMatch[1];
      return result(text, remindAt);
    }

    // ===== 规则 9.1："明天/后天/大后天 + 时段"（无具体时间）=====
    // 例：明天早上、后天下午、大后天后天
    const dayPeriodRe = /(明天|后天|大后天)\s*(早上|早晨|上午|中午|下午|晚上|凌晨)?/;
    const mDp = text.match(dayPeriodRe);
    if (mDp && !text.match(/\d{1,2}[点:]/)) { // 没有具体时间才走这条规则
      const dayType = mDp[1];
      const period = mDp[2];
      const dayOffset = dayType === '大后天' ? 3 : (dayType === '后天' ? 2 : 1);
      // 时段默认时间映射
      const periodHour = { '早上': 7, '早晨': 7, '上午': 9, '中午': 12, '下午': 15, '晚上': 19, '凌晨': 0 };
      const d = new Date(now);
      d.setDate(d.getDate() + dayOffset);
      d.setHours(period ? periodHour[period] : 9, 0, 0, 0);
      remindAt = d.getTime();
      text = text.replace(dayPeriodRe, '').trim();
      return result(text, remindAt);
    }

    // ===== 规则 10：单独"明天"（无具体时间），默认明天 9:00 =====
    if (/^明天/.test(text) || /\s明天$/.test(text) || /明天$/.test(text)) {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      remindAt = d.getTime();
      text = text.replace(/明天/, '').trim();
      return result(text, remindAt);
    }

    // 解析失败：原文不动，无提醒
    return { text: rawText, remindAt: null, recurrence: null };
  }

  // 辅助：根据"每X"的单位计算循环间隔毫秒数
  function getIntervalMsForUnit(unit, value) {
    if (unit === '分钟' || unit === '分') return value * 60 * 1000;
    if (unit === '小时' || unit === '时') return value * 60 * 60 * 1000;
    if (unit === '天') return value * 24 * 60 * 60 * 1000;
    if (unit === '周' || unit === '星期') return 7 * 24 * 60 * 60 * 1000;
    if (/周[一二三四五六日]/.test(unit) || ['周一','周二','周三','周四','周五','周六','周日'].includes(unit)) {
      return 7 * 24 * 60 * 60 * 1000;
    }
    return value * 60 * 1000; // 默认分钟
  }

  // 清理文本：去掉"提醒我""提醒""叫我"等前缀和多余语气词，提炼纯事项内容
  // 例："提醒我喝水" → "喝水"，"叫我起床" → "起床"，"提醒交作业" → "交作业"
  //     "明天提醒我晨跑" → "晨跑"，"两小时后" → "两小时后"（保留，因为没有动作主体）
  function cleanTodoText(text) {
    let t = text.trim();
    // 去掉"提醒我""叫我""提醒"前缀
    t = t.replace(/^(提醒我|叫我|提醒)\s*/, '').trim();
    // 去掉"明天""后天""今天"等时间前缀（这些是时间词，不是事项内容）
    t = t.replace(/^(明天|后天|今天)\s*/, '').trim();
    // 去掉末尾的语气词："吧""啊""呀""哦""呢"等
    t = t.replace(/[吧啊呀哦呢哈]+$/, '').trim();
    return t;
  }


  // ---------- 11.4 提示音播放（优先 MP3，兜底 Web Audio 合成） ----------

  // MP3 音效路径（与 index.html 同目录）。URL encode 中文路径以免部分浏览器无法加载
  const REMINDER_MP3_SRC = encodeURI('提示音效.mp3');

  // 单例 HTMLAudio 元素（全局只创建一次，复用避免每次 new Audio 造成泄漏和延迟）
  let mp3Audio = null;
  // MP3 是否成功加载（true 代表可以走 MP3 分支；false 走 Web Audio 兜底）
  let mp3Ready = false;

  // AudioContext 实例（首次用户交互后创建并 resume）—— 作为 MP3 加载失败时的兜底
  // 注意：audioCtx 已在 11.1 "模块状态" 中声明，这里不再重复声明

  // 创建并配置 HTMLAudio 元素（只执行一次）
  function ensureMp3Audio() {
    if (mp3Audio) return mp3Audio;
    try {
      mp3Audio = new Audio();
      mp3Audio.src = REMINDER_MP3_SRC;
      mp3Audio.preload = 'auto';         // 提前预加载数据（若浏览器允许）
      mp3Audio.volume = 1.0;              // 最大音量（原音效文件自行控制音量）
      // 成功加载 → 标记可用
      mp3Audio.addEventListener('canplaythrough', function () {
        mp3Ready = true;
      }, { once: true });
      // 加载失败 → 标记不可用，后续走 Web Audio 兜底
      mp3Audio.addEventListener('error', function (e) {
        mp3Ready = false;
        console.warn('提示音效 MP3 加载失败，将使用合成音作为兜底：', e);
      }, { once: true });
      // 主动触发加载（某些浏览器仅在设置 src 后不会自动开始加载）
      if (typeof mp3Audio.load === 'function') {
        try { mp3Audio.load(); } catch (e) { /* ignore */ }
      }
    } catch (e) {
      mp3Audio = null;
      mp3Ready = false;
      console.warn('创建 Audio 元素失败：', e);
    }
    return mp3Audio;
  }

  // 模块启动时立即创建 Audio 元素并触发预加载（src 会被设置，但 play() 仍需用户手势）
  ensureMp3Audio();

  // 在用户首次交互（点击/按键/触摸）时初始化音频资源
  // 包含两部分：1) Web Audio AudioContext 的 unlock + resume
  //             2) HTMLAudio 的 prime（play 立即 pause，让浏览器给此元素放行 autoplay）
  function unlockAudio() {
    // --- A. Web Audio（兜底路径） ---
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn('当前浏览器不支持 Web Audio API，合成兜底音将不可用');
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function (e) {
        console.warn('AudioContext 恢复失败:', e);
      });
    }

    // --- B. HTMLAudio（MP3 路径）---
    // 关键：在用户手势回调中"快速 play→pause"把此 Audio 元素标记为"已获用户授权"
    // 之后 scheduleReminder 触发时（即使没有用户手势）也能调用 play()
    ensureMp3Audio();
    if (mp3Audio) {
      const playPromise = mp3Audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(function () {
          // 成功开始播放，立即暂停并回到开头 —— 这一步完成"授权 prime"
          try {
            mp3Audio.pause();
            mp3Audio.currentTime = 0;
          } catch (e) { /* ignore */ }
          mp3Ready = true;
        }).catch(function (e) {
          // 某些浏览器即便在用户手势下 play() 仍会拒绝（例如 headless、静音环境）
          // 这只是"授权 prime 失败"，文件本身已加载好，仍可在 playReminderSound 中再尝试
          // 因此不把 mp3Ready 置为 false，仅记录日志（若真播放失败由 playReminderSound 兜底回退）
          console.warn('MP3 prime 被拒绝（playReminderSound 仍会尝试首次播放，失败则回退合成音）：', e);
        });
      } else {
        // 老浏览器：play() 为同步，立即回到开头
        try {
          mp3Audio.pause();
          mp3Audio.currentTime = 0;
        } catch (e) { /* ignore */ }
      }
    }
  }

  // 主入口：播放提示音（优先 MP3，失败/未加载时用 Web Audio 合成兜底）
  // 调用前必须保证：1) unlockAudio() 至少被调用过一次（用户交互后） 2) audioCtx / mp3Audio 状态可接受
  function playReminderSound() {
    // --- 1) 优先尝试 MP3 ---
    if (mp3Ready && mp3Audio) {
      try {
        // 连点时重播：先回到 0 再 play（currentTime=0 可打断当前播放直接从头来）
        try { mp3Audio.currentTime = 0; } catch (e) { /* ignore */ }
        const p = mp3Audio.play();
        if (p && typeof p.then === 'function') {
          p.catch(function (e) {
            // MP3 play() 被浏览器拦截（非常罕见），回退到合成音
            console.warn('MP3 play 被拦截，回退合成音：', e);
            tryPlayBeepsFallback();
          });
        }
        return;  // MP3 分支已触发（或 promise 里会兜底）
      } catch (e) {
        console.warn('MP3 播放异常，回退合成音：', e);
        // 直接落入 Web Audio 兜底
      }
    }

    // --- 2) 兜底：Web Audio 合成"叮咚"声 ---
    tryPlayBeepsFallback();
  }

  // Web Audio 合成兜底：检查 audioCtx 状态 → 合成播放
  function tryPlayBeepsFallback() {
    if (!audioCtx) {
      console.warn('提示音未播放：用户尚未与页面交互，AudioContext 未初始化');
      return;
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(function () {
        doPlayBeeps();
      }).catch(function (e) {
        console.warn('恢复 AudioContext 失败，无法播放合成提示音：', e);
      });
    } else {
      doPlayBeeps();
    }
  }

  // 合成"叮咚"两声（内部函数）
  function doPlayBeeps() {
    if (!audioCtx || audioCtx.state !== 'running') return;
    const now = audioCtx.currentTime;

    // 两个频率：880Hz（叮）+ 660Hz（咚），间隔 180ms
    const beeps = [
      { freq: 880, start: 0,    duration: 0.20 },
      { freq: 660, start: 0.24, duration: 0.28 }
    ];

    beeps.forEach(function (b) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = b.freq;

      // 音量包络：0 → 0.5 → 0，避免开始/结束的爆音
      gain.gain.setValueAtTime(0, now + b.start);
      gain.gain.linearRampToValueAtTime(0.5, now + b.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + b.start + b.duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + b.start);
      osc.stop(now + b.start + b.duration + 0.05);  // 多留 50ms 避免尾部咔哒
    });
  }

  // 首次用户交互时 unlock 音频（once: true 自动移除监听）
  ['click', 'keydown', 'touchstart'].forEach(function (evt) {
    document.addEventListener(evt, unlockAudio, { once: true });
  });


  // ---------- 11.5 调度与触发 ----------

  // 为单条事项注册精确 setTimeout
  function scheduleReminder(todo) {
    // 无提醒时间 / 已完成 → 跳过
    // 循环提醒允许 reminded=true（刚触发过正在推进中的），由 advanceCycle 重置 reminded 后再调度
    if (!todo.remindAt || todo.done) return;

    // 非循环事项：已提醒过则不重复调度
    if (!todo.recurrence || !todo.recurrence.enabled) {
      if (todo.reminded) return;
    }

    const oldTimer = reminderTimers.get(todo.id);
    if (oldTimer) clearTimeout(oldTimer);

    const delay = todo.remindAt - Date.now();
    if (delay <= 0) {
      triggerReminder(todo);
    } else {
      const timerId = setTimeout(function () {
        triggerReminder(todo);
      }, delay);
      reminderTimers.set(todo.id, timerId);
    }
  }

  // 启动时扫描所有未提醒事项，逐个调度
  function scheduleAllReminders() {
    todos.forEach(function (t) {
      if (t.remindAt && !t.reminded && !t.done) {
        scheduleReminder(t);
      }
    });
  }

  // 取消某条事项的定时器（删除/完成时调用）
  function cancelReminder(id) {
    const t = reminderTimers.get(id);
    if (t) {
      clearTimeout(t);
      reminderTimers.delete(id);
    }
  }

  // 漏检检查：扫描所有"已到点但 reminded 还是 false"的事项，补触发
  // 调用时机：visibilitychange 切回前台 / 60 秒 setInterval 兜底
  function checkMissedReminders() {
    const now = Date.now();
    todos.forEach(function (t) {
      if (t.remindAt && !t.reminded && !t.done && t.remindAt <= now) {
        triggerReminder(t);
      }
    });
  }

  // 触发提醒：完整反馈链路
  function triggerReminder(todo) {
    // 防重：已提醒过直接返回
    if (todo.reminded) return;

    // 1) 先标记为已提醒 + 持久化
    todo.reminded = true;
    save();

    // 2) 播放"叮咚"音效
    playReminderSound();

    // 3) 找到对应 <li> 节点，加高亮 + 抖动动画
    const li = nodeCache.get(todo.id);
    if (li) {
      li.classList.add('reminding');
      setTimeout(function () {
        li.classList.remove('reminding');
      }, 6000);
    }

    // 4) 史迪奇弹气泡
    if (window.petMood) {
      window.petMood.excited();
      const cycleMsg = todo.recurrence && todo.recurrence.enabled
        ? '循环提醒：该 ' + todo.text + ' 啦！（已完成 ' + (todo.completionCount || 0) + ' 次）'
        : '该 ' + todo.text + ' 啦！';
      window.petMood.toast(cycleMsg, 'warning');
    }

    // 5) 取消该事项的定时器
    cancelReminder(todo.id);

    // 6) 循环提醒：推进到下一个周期并重新调度
    if (todo.recurrence && todo.recurrence.enabled && !todo.done) {
      advanceCycle(todo);
    }

    // 7) 重新渲染
    render();
  }

  // 循环提醒：推进到下一个周期
  function advanceCycle(todo) {
    if (!todo.recurrence || !todo.recurrence.enabled) return;

    const intervalMs = getIntervalMs(todo.recurrence);
    if (!intervalMs) return;

    // 从当前 remindAt 开始累加（用户选择的"从起始时间累加"策略）
    // 如果本次 remindAt 已经过期，则从现在开始算下一个周期
    const now = Date.now();
    const baseTime = todo.remindAt > now ? todo.remindAt : now;
    todo.remindAt = baseTime + intervalMs;
    todo.reminded = false;  // 重置以便下一轮能触发
    todo.lastRemindAt = now;
    save();
    scheduleReminder(todo);
  }

  // 将循环间隔转换为毫秒
  function getIntervalMs(recurrence) {
    if (!recurrence) return 0;
    const unitMs = {
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000
    };
    const multiplier = unitMs[recurrence.unit];
    if (!multiplier) return 0;
    return recurrence.interval * multiplier;
  }

  // 停止循环提醒（用户手动操作）
  function stopCycleReminder(id) {
    const todo = todos.find(function (t) { return t.id === id; });
    if (!todo) return;
    todo.recurrence = null;
    todo.completionCount = 0;
    todo.lastRemindAt = null;
    todo.targetCount = null;
    cancelReminder(id);
    // 清除缓存节点，强制重建 DOM（否则停止按钮不会消失）
    nodeCache.delete(id);
    save();
    render();
  }


  // ---------- 11.6 兜底定时器 ----------

  // 60 秒兜底检查：用于后台标签页（浏览器会降频 setTimeout，60 秒兜底确保不漏）
  setInterval(checkMissedReminders, 60000);

  // 30 秒刷新所有徽章文案（仅改 textContent，不调用 render，避免反复写 localStorage）
  // 让"还有 N 分钟"倒计时每 30 秒更新一次
  setInterval(function () {
    nodeCache.forEach(function (li, id) {
      const todo = todos.find(function (t) { return t.id === id; });
      if (todo) updateReminderBadge(li, todo);
    });
  }, 30000);


  // ---------- 11.7 页面可见性联动 ----------
  // 切回前台时补触发切走期间错过的提醒
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      checkMissedReminders();
    }
  });


  // ---------- 11.8 暴露接口 ----------
  window.reminderModule = {
    parse: parseReminderFromText,
    cleanTodoText: cleanTodoText,
    schedule: scheduleReminder,
    scheduleAll: scheduleAllReminders,
    cancel: cancelReminder,
    checkMissed: checkMissedReminders,
    trigger: triggerReminder,
    playSound: playReminderSound,
    unlockAudio: unlockAudio,
    stopCycle: stopCycleReminder,
    getIntervalMs: getIntervalMs,
    getIntervalMsForUnit: getIntervalMsForUnit,
    hasAudioCtx: function () { return !!audioCtx && audioCtx.state === 'running'; },
    isMp3Ready: function () { return mp3Ready; },
    getMp3Src: function () { return REMINDER_MP3_SRC; },
    formatToLocalInputValue: formatToLocalInputValue
  };

  // 同时暴露日期选择器模块
  window.datetimePickerModule = {
    getTimestamp: datetimePickerModule.getTimestamp,
    getRecurrence: datetimePickerModule.getRecurrence,
    syncFromTimestamp: datetimePickerModule.syncFromTimestamp,
    clearAll: datetimePickerModule.clearAll,
    formatRecurrenceShort: datetimePickerModule.formatRecurrenceShort,
    formatRecurrenceLong: datetimePickerModule.formatRecurrenceLong
  };


  // ---------- 11.8b 绑定"🔊 测试音效"按钮 ----------
  // 节流：避免用户高频连点造成多个 oscillator 叠加爆音
  let soundTestCooldown = false;
  const SOUND_TEST_COOLDOWN_MS = 800;  // 至少留足"叮咚"两声时长

  function bindSoundTestButton() {
    const btn = document.getElementById('soundTestBtn');
    if (!btn) return;

    btn.addEventListener('click', function () {
      // 冷却中：忽略，不给任何反馈，避免进一步引导连点
      if (soundTestCooldown) return;
      soundTestCooldown = true;
      setTimeout(function () { soundTestCooldown = false; }, SOUND_TEST_COOLDOWN_MS);

      // 1) 按钮本身就是用户交互，先确保 AudioContext 被 unlock + resume
      unlockAudio();

      // 2) 加播放中样式（脉冲动画 0.5s，视觉确认）
      btn.classList.remove('playing');
      // 强制重排以重启动画（否则移除后立即添加不会触发）
      void btn.offsetWidth;
      btn.classList.add('playing');
      setTimeout(function () {
        btn.classList.remove('playing');
      }, 600);  // 略长于动画 0.5s

      // 3) 播放"叮咚"两声
      playReminderSound();
    });
  }

  // DOM 按钮一定在 reminderModule IIFE 之前解析（按钮写在 body 中，script 在 body 末尾）
  // 为稳妥起见仍用 setTimeout 延迟到下一轮事件循环
  setTimeout(bindSoundTestButton, 0);


  // ---------- 11.9 启动调度 ----------
  // 推到下一个事件循环，确保 todos 已通过 load() 加载、render() 已执行
  setTimeout(scheduleAllReminders, 0);

})();
