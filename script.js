// ===== 待办事项清单 - 交互脚本 =====


// ---------- 1. 数据层 ----------

// 数据源：所有待办事项都存在这个数组里
// 每条事项结构：
//   { id: 唯一标识, text: 内容文本, done: 是否已完成,
//     remindAt: 提醒时间戳（毫秒，无提醒为 null）,
//     reminded: 是否已触发过提醒（防重复响铃） }
// 后续的「添加 / 标记完成 / 删除 / 持久化 / 提醒调度」都围绕这个数组进行
let todos = [];

// localStorage 的键名（固定常量，便于统一管理与修改）
// v2.1.0 起从 sessionStorage 升级为 localStorage，让数据跨会话保留以支持提醒功能
const STORAGE_KEY = 'todos';

// 收纳状态：已完成项超过此数量则自动收纳
const VISIBLE_COMPLETED_LIMIT = 3;
// 未完成项超过此数量也自动收纳（待办是主要关注内容，阈值略高）
const VISIBLE_PENDING_LIMIT = 5;
// 两类收纳共用同一个展开/收起状态
let isExpanded = false;


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
    // 数据兼容：补齐旧事项缺失的新字段（无提醒）
    todos.forEach(function (t) {
      if (t.remindAt === undefined) t.remindAt = null;
      if (t.reminded === undefined) t.reminded = false;
    });
  }
}


// ---------- 2. 获取页面元素 ----------

// 通过 id 拿到 HTML 中的关键元素，后续操作都基于这些引用
const todoInput = document.getElementById('todoInput');  // 输入框
const remindAtInput = document.getElementById('remindAtInput');  // 日期时间选择器（v2.1.0 新增）
const addBtn = document.getElementById('addBtn');        // 添加按钮
const todoList = document.getElementById('todoList');    // 列表容器（<ul>）


// ---------- 3. DOM 节点缓存 ----------

// 缓存已创建的 <li> 节点，避免每次都重新创建导致闪动
// key: todo.id, value: <li> 元素
const nodeCache = new Map();


// ---------- 4. 渲染函数：增量更新 DOM，不做全量重建 ----------

function render() {
  // 分离未完成和已完成
  const pending = todos.filter(function (t) { return !t.done; });
  const done = todos.filter(function (t) { return t.done; });

  // 判断两类是否需要收纳
  const hasPendingCollapsible = pending.length > VISIBLE_PENDING_LIMIT;
  const hasDoneCollapsible = done.length > VISIBLE_COMPLETED_LIMIT;
  const hasCollapsible = hasPendingCollapsible || hasDoneCollapsible;

  // 计算可见项（展开时全部可见，收起时按阈值切片）
  let visiblePending, visibleDone;
  if (!hasCollapsible) {
    // 无需收纳，全部显示
    visiblePending = pending;
    visibleDone = done;
  } else if (isExpanded) {
    // 展开状态：所有项可见，收纳容器隐藏
    visiblePending = pending;
    visibleDone = done;
  } else {
    // 收起状态：按阈值切片显示
    visiblePending = pending.slice(0, VISIBLE_PENDING_LIMIT);
    visibleDone = done.slice(0, VISIBLE_COMPLETED_LIMIT);
  }

  // 整体可见项顺序：未完成可见 → （未完成收纳按钮）→ 已完成可见 → （已完成收纳按钮）
  const visibleItems = visiblePending.concat(visibleDone);

  // 第一步：处理可见项的 DOM 节点（移动/创建/更新）
  visibleItems.forEach(function (todo, index) {
    let li = nodeCache.get(todo.id);
    if (!li) {
      li = createTodoElement(todo);
      nodeCache.set(todo.id, li);
    }
    // 确保节点在正确位置（用 insertBefore 移动节点，浏览器不会闪动）
    const refNode = todoList.children[index];
    if (refNode !== li) {
      todoList.insertBefore(li, refNode || null);
    }
    // 更新完成状态（仅切换 class 和 checkbox，不重建 DOM）
    updateItemState(li, todo);
  });

  // 第二步：处理收纳区 UI（两类收纳按钮 + 一个收纳容器）
  let pendingCollapseBtn = document.getElementById('pendingCollapseBtn');
  let collapseBtn = document.getElementById('collapseBtn');        // 已完成收纳按钮
  let collapsedList = document.getElementById('collapsedList');

  if (hasCollapsible) {
    // ---------- 2.1 未完成收纳按钮 ----------
    if (hasPendingCollapsible) {
      if (!pendingCollapseBtn) {
        pendingCollapseBtn = document.createElement('li');
        pendingCollapseBtn.id = 'pendingCollapseBtn';
        pendingCollapseBtn.className = 'collapse-btn collapse-btn-pending';
        pendingCollapseBtn.addEventListener('click', function () {
          isExpanded = !isExpanded;
          render();
        });
      }
      // 更新文案
      const hiddenPending = pending.length - VISIBLE_PENDING_LIMIT;
      if (isExpanded) {
        pendingCollapseBtn.innerHTML = '<span>收起 ▲</span>';
        pendingCollapseBtn.classList.add('expanded');
      } else {
        pendingCollapseBtn.innerHTML = '<span>还有 <strong>' + hiddenPending + '</strong> 项待办</span><span class="arrow">▼</span>';
        pendingCollapseBtn.classList.remove('expanded');
      }
      // 按钮位置：紧接在未完成可见项之后
      const pendingBtnPos = visiblePending.length;
      const pendingBtnRef = todoList.children[pendingBtnPos];
      if (pendingBtnRef !== pendingCollapseBtn) {
        todoList.insertBefore(pendingCollapseBtn, pendingBtnRef || null);
      }
    } else if (pendingCollapseBtn) {
      // 不需要时移除
      pendingCollapseBtn.remove();
      pendingCollapseBtn = null;
    }

    // ---------- 2.2 已完成收纳按钮 ----------
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
      const hiddenCount = done.length - VISIBLE_COMPLETED_LIMIT;
      if (isExpanded) {
        collapseBtn.innerHTML = '<span>收起 ▲</span>';
        collapseBtn.classList.add('expanded');
      } else {
        collapseBtn.innerHTML = '<span>还有 <strong id="collapseCount">' + hiddenCount + '</strong> 项已完成待办</span><span class="arrow">▼</span>';
        collapseBtn.classList.remove('expanded');
      }
      // 按钮位置：紧接在已完成可见项之后（需考虑未完成按钮占位）
      // 计算偏移：未完成可见项 + （未完成按钮 0 或 1）+ 已完成可见项
      const offset = visiblePending.length + (hasPendingCollapsible ? 1 : 0) + visibleDone.length;
      const btnRef = todoList.children[offset];
      if (btnRef !== collapseBtn) {
        todoList.insertBefore(collapseBtn, btnRef || null);
      }
    } else if (collapseBtn) {
      collapseBtn.remove();
      collapseBtn = null;
    }

    // ---------- 2.3 收纳容器（展开时显示所有被收纳项）----------
    if (!collapsedList) {
      collapsedList = document.createElement('ul');
      collapsedList.id = 'collapsedList';
      collapsedList.className = 'collapsed-list';
    }
    // 容器位置：放在最后一个收纳按钮之后
    const lastBtn = collapseBtn || pendingCollapseBtn;
    if (lastBtn) {
      const listRef = lastBtn.nextSibling;
      if (listRef !== collapsedList) {
        todoList.insertBefore(collapsedList, listRef);
      }
    }
    // 根据展开/收起状态设置显示
    collapsedList.style.display = isExpanded ? 'flex' : 'none';

    // 展开时：把所有被收纳的项移入容器
    if (isExpanded) {
      const collapsedItems = [];
      if (hasPendingCollapsible) {
        collapsedItems.push.apply(collapsedItems, pending.slice(VISIBLE_PENDING_LIMIT));
      }
      if (hasDoneCollapsible) {
        collapsedItems.push.apply(collapsedItems, done.slice(VISIBLE_COMPLETED_LIMIT));
      }
      collapsedItems.forEach(function (todo) {
        let li = nodeCache.get(todo.id);
        if (!li) {
          li = createTodoElement(todo);
          nodeCache.set(todo.id, li);
        }
        collapsedList.appendChild(li);
        updateItemState(li, todo);
      });
    }
  } else {
    // 不需要收纳，移除所有收纳 UI
    if (pendingCollapseBtn) pendingCollapseBtn.remove();
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
    // 优先使用带情绪/toast 联动的包装版本（若存在），否则回退到原始 toggleTodo
    if (typeof window.wrappedToggleTodo === 'function') {
      window.wrappedToggleTodo(todo.id);
    } else {
      toggleTodo(todo.id);
    }
  });

  const span = document.createElement('span');
  span.className = 'todo-text';
  span.textContent = todo.text;

  // 若该事项设置了提醒时间，创建提醒徽章
  // 徽章的具体文案与颜色由 updateReminderBadge() 在每次渲染时刷新
  if (todo.remindAt) {
    const badge = document.createElement('span');
    badge.className = 'reminder-badge';
    li.appendChild(checkbox);
    li.appendChild(span);
    li.appendChild(badge);
  } else {
    li.appendChild(checkbox);
    li.appendChild(span);
  }

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = '删除';
  deleteBtn.addEventListener('click', function () {
    // 优先使用带情绪/toast 联动的包装版本（若存在），否则回退到原始 deleteTodo
    if (typeof window.wrappedDeleteTodo === 'function') {
      window.wrappedDeleteTodo(todo.id);
    } else {
      deleteTodo(todo.id);
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
// 参数：remindAt（可选）— 提醒时间戳（毫秒）；未传或为假值则不设提醒
// 返回值：新增的事项对象（供调用方调度提醒）；空输入时返回 undefined
function addTodo(remindAt) {
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
  // reminded：是否已触发过提醒，初始 false
  const newTodo = {
    id: Date.now(),
    text: text,
    done: false,
    remindAt: remindAt || null,
    reminded: false
  };
  todos.push(newTodo);

  // 4) 数据已变，重新渲染列表
  render();

  // 5) 清空输入框并重新聚焦，方便用户继续输入下一条
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
  // 用 find 在数组中按 id 查找对应事项
  const todo = todos.find(function (t) {
    return t.id === id;
  });

  if (!todo) {
    return;  // 未找到则直接返回
  }

  // 翻转完成状态（true 变 false，false 变 true）
  todo.done = !todo.done;

  // 提醒调度联动：
  //   - 勾选完成 → 取消该事项的提醒定时器（已完成无需再提醒）
  //   - 取消完成 → 若提醒时间未到且未提醒过，重新调度提醒
  if (window.reminderModule) {
    if (todo.done) {
      window.reminderModule.cancel(id);
    } else if (todo.remindAt && !todo.reminded) {
      window.reminderModule.schedule(todo);
    }
  }

  // 从数组中移除该事项，准备重新插入到合适位置
  const remaining = todos.filter(function (t) {
    return t.id !== id;
  });

  if (todo.done) {
    // 勾选完成 -> 追加到数组末尾（已完成区末尾）
    remaining.push(todo);
  } else {
    // 取消勾选 -> 插入到「第一个已完成事项」之前，即未完成区末尾
    // 这样未完成事项保持原添加顺序向上冒泡，已完成事项整体沉底
    const firstDoneIndex = remaining.findIndex(function (t) {
      return t.done;
    });
    if (firstDoneIndex === -1) {
      // 没有已完成事项，直接追加到末尾
      remaining.push(todo);
    } else {
      // 在第一个已完成事项之前插入
      remaining.splice(firstDoneIndex, 0, todo);
    }
  }

  // 用重排后的数组更新数据源
  todos = remaining;

  // 数据已变，重新渲染列表（复选框勾选状态与 completed 样式会同步更新）
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
    // 选择器：所有按钮、输入框、待办项、收纳按钮、链接
    const avoidSelectors = 'button, input, .todo-item, .collapse-btn, .collapsed-list, a, [role="button"]';
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

  function scheduleNextMove() {
    if (isDragging || isHidden) return;

    const waitTime = 3000 + Math.random() * 5000;

    randomMoveTimer = setTimeout(function () {
      if (isDragging || isHidden) {
        scheduleNextMove();
        return;
      }
      const target = getRandomPosition();
      moveTo(target.x, target.y);
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
    const newX = origX + (point.x - dragStartX);
    const newY = origY + (point.y - dragStartY);

    const clamped = clampPosition(newX, newY);
    pet.style.left = clamped.x + 'px';
    pet.style.bottom = clamped.y + 'px';
    currentX = clamped.x;
    currentY = clamped.y;
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

    startRandomMovement();
  }

  pet.addEventListener('mousedown', onDragStart);
  pet.addEventListener('touchstart', onDragStart, { passive: false });

  // ---------- 9.6 点击交互 ----------

  const bubbleMessages = [
    '嗨！有什么待办吗？',
    '记得完成待办哦~',
    '今天也要加油！',
    '要不要休息一下？',
    '工作快乐！',
    '我是史迪奇！',
    '一起加油吧~',
    '别忘了喝水！',
    '动一动吧~',
    '你真棒！'
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
  });

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

  // 页面加载 1 秒后开始随机移动
  setTimeout(startRandomMovement, 1000);

  // 启动 GIF 轮播（3-5 秒随机切换桌宠动图）
  startGifRotation();

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

// 包装 addTodo：整合自然语言解析 + datetime-local + 调度提醒 + 桌宠反馈
function wrappedAddTodo() {
  const rawText = todoInput.value.trim();
  if (rawText === '') {
    // 文本框为空：调用原 addTodo 触发红边框提示并返回（addTodo 内部会处理空输入）
    addTodo();
    return;
  }

  let remindAt = null;

  // 1) 优先尝试自然语言解析（如 "8:00 吃饭" → 今天 8:00 + 文本"吃饭"）
  if (window.reminderModule) {
    const parsed = window.reminderModule.parse(rawText);
    if (parsed.remindAt) {
      remindAt = parsed.remindAt;
      // 解析成功：把解析后的纯文本覆盖回输入框（剥离时间词）
      // 同时同步到 datetime-local 让用户看到确认
      todoInput.value = parsed.text;
      remindAtInput.value = window.reminderModule.formatToLocalInputValue(new Date(remindAt));
    }
  }

  // 2) 自然语言解析失败，但用户填了 datetime-local → 用 datetime-local 的值
  if (!remindAt && remindAtInput.value) {
    remindAt = new Date(remindAtInput.value).getTime();
  }
  // 3) 都没有 → remindAt 保持 null，纯添加（不阻断流程）

  // 调用扩展后的 addTodo（接受 remindAt 参数），返回新增事项对象
  const newTodo = addTodo(remindAt);

  // 为新增事项调度提醒定时器（仅当有 remindAt）
  if (newTodo && newTodo.remindAt && window.reminderModule) {
    window.reminderModule.schedule(newTodo);
  }

  // 清空 datetime-local（文本框已由 addTodo 清空）
  remindAtInput.value = '';

  // 触发桌宠反馈：有提醒时用专门文案，否则用随机文案
  if (window.petMood) {
    window.petMood.excited();
    const msg = remindAt
      ? '已设好提醒，到点我会叫你！'
      : ADD_TODO_TOASTS[Math.floor(Math.random() * ADD_TODO_TOASTS.length)];
    window.petMood.toast(msg, 'success');
  }
}

// 包装 toggleTodo：根据状态触发对应表情 + toast
function wrappedToggleTodo(id) {
  const todo = todos.find(function (t) { return t.id === id; });
  const wasDone = todo ? todo.done : false;
  toggleTodo(id);  // 调用原始函数
  if (window.petMood) {
    if (todo && todo.done) {
      // 勾选完成 → 开心 + 庆祝 toast
      window.petMood.happy();
      const msg = COMPLETE_TODO_TOASTS[Math.floor(Math.random() * COMPLETE_TODO_TOASTS.length)];
      window.petMood.toast(msg, 'success');
    } else if (wasDone && !todo.done) {
      // 取消勾选 → 提示 toast
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

  // 解析文本中的提醒时间，并返回剥离时间词后的纯事项文本
  // 支持规则：
  //   "8:00"          → 今天 8:00（若今天已过则改用明天 8:00）
  //   "15:30"         → 今天 15:30（已过则明天）
  //   "明天8:00"       → 明天 8:00
  //   "8月15日 8:00"   → 当年 8 月 15 日 8:00（已过则明年）
  //   "8月15日"        → 当年 8 月 15 日 9:00（默认 9 点）
  //   "明天"           → 明天 9:00（默认 9 点）
  // 失败：返回 { text: 原文, remindAt: null }（不阻断添加流程）
  function parseReminderFromText(rawText) {
    let text = rawText.trim();
    let remindAt = null;
    const now = new Date();

    // 规则 1：含"月""日"的明确日期 + 可选时间
    // 例：8月15日 8:00  或  8月15日
    const dateRe = /(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2}):(\d{2}))?/;
    const m1 = text.match(dateRe);
    if (m1) {
      const month = parseInt(m1[1], 10);
      const day = parseInt(m1[2], 10);
      const hour = m1[3] ? parseInt(m1[3], 10) : 9;   // 未给时间默认 9 点
      const min = m1[4] ? parseInt(m1[4], 10) : 0;
      const d = new Date(now.getFullYear(), month - 1, day, hour, min, 0);
      // 若该日期已过则推到明年
      if (d.getTime() <= now.getTime()) d.setFullYear(d.getFullYear() + 1);
      remindAt = d.getTime();
      text = text.replace(dateRe, '').trim();
      return { text: text || rawText, remindAt: remindAt };
    }

    // 规则 2："明天" + 时间
    // 例：明天8:00  或  明天 15:30
    const tomorrowRe = /明天\s*(\d{1,2}):(\d{2})/;
    const m2 = text.match(tomorrowRe);
    if (m2) {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(parseInt(m2[1], 10), parseInt(m2[2], 10), 0, 0);
      remindAt = d.getTime();
      text = text.replace(tomorrowRe, '').trim();
      return { text: text || rawText, remindAt: remindAt };
    }

    // 规则 3：纯时间 "HH:MM"，默认今天（已过则明天）
    const timeRe = /(\d{1,2}):(\d{2})/;
    const m3 = text.match(timeRe);
    if (m3) {
      const d = new Date(now);
      d.setHours(parseInt(m3[1], 10), parseInt(m3[2], 10), 0, 0);
      if (d.getTime() <= now.getTime()) {
        // 今天这个点已过，推到明天
        d.setDate(d.getDate() + 1);
      }
      remindAt = d.getTime();
      text = text.replace(timeRe, '').trim();
      return { text: text || rawText, remindAt: remindAt };
    }

    // 规则 4：单独"明天"（无具体时间），默认明天 9:00
    if (/^明天/.test(text) || /\s明天$/.test(text) || /明天$/.test(text)) {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      remindAt = d.getTime();
      text = text.replace(/明天/, '').trim();
      return { text: text || rawText, remindAt: remindAt };
    }

    // 解析失败：原文不动，无提醒
    return { text: rawText, remindAt: null };
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
  // 思路：到点时间 - 当前时间 = 等待毫秒数；若已过期（≤0）立即触发
  function scheduleReminder(todo) {
    // 无提醒时间 / 已提醒过 / 已完成 → 跳过
    if (!todo.remindAt || todo.reminded || todo.done) return;

    // 先清掉该事项的旧定时器（避免重复调度造成多次触发）
    const oldTimer = reminderTimers.get(todo.id);
    if (oldTimer) clearTimeout(oldTimer);

    const delay = todo.remindAt - Date.now();
    if (delay <= 0) {
      // 已过期：立即触发（可能页面刚加载就有漏掉的提醒）
      triggerReminder(todo);
    } else {
      // 未来时间：精确等待到点
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
    // 防重：已提醒过直接返回（避免兜底定时器与精确定时器重复触发）
    if (todo.reminded) return;

    // 1) 先标记为已提醒 + 持久化（防止后续动画回调或刷新后再次触发）
    todo.reminded = true;
    save();

    // 2) 播放"叮咚"音效
    playReminderSound();

    // 3) 找到对应 <li> 节点，加高亮 + 抖动动画类
    const li = nodeCache.get(todo.id);
    if (li) {
      li.classList.add('reminding');
      // 6 秒后撤销高亮，避免长期占用视觉
      setTimeout(function () {
        li.classList.remove('reminding');
      }, 6000);
    }

    // 4) 史迪奇弹气泡："该 [text] 啦！"（黄色 warning 边框）
    if (window.petMood) {
      window.petMood.excited();                                  // 兴奋跳一下
      window.petMood.toast('该 ' + todo.text + ' 啦！', 'warning');
    }

    // 5) 取消该事项的定时器（已触发，无需再等）
    cancelReminder(todo.id);

    // 6) 重新渲染，让徽章切换到"已过期"状态
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
    schedule: scheduleReminder,
    scheduleAll: scheduleAllReminders,
    cancel: cancelReminder,
    checkMissed: checkMissedReminders,
    trigger: triggerReminder,
    playSound: playReminderSound,
    unlockAudio: unlockAudio,
    hasAudioCtx: function () { return !!audioCtx && audioCtx.state === 'running'; },
    isMp3Ready: function () { return mp3Ready; },
    getMp3Src: function () { return REMINDER_MP3_SRC; },
    formatToLocalInputValue: formatToLocalInputValue
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
