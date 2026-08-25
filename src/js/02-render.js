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

  // 注意：此处不清空 nodeCache！
  // 缓存的意义就是复用已有节点，只通过 insertBefore 移动位置来重排，避免重建 DOM 造成的闪动
  // 已删除项的缓存会在第三步统一清理

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

  // 【v2.13.0】空状态显示/隐藏
  var emptyState = document.getElementById('emptyState');
  if (emptyState) {
    if (todos.length === 0) {
      emptyState.style.display = 'block';
    } else {
      emptyState.style.display = 'none';
    }
  }

  // 【v2.13.0】为新创建的节点添加进入动画
  rebuiltIds.forEach(function (id) {
    var node = nodeCache.get(id);
    if (node) {
      node.classList.add('todo-item-enter');
      // 动画结束后移除 class，避免重复触发
      node.addEventListener('animationend', function handler() {
        node.classList.remove('todo-item-enter');
        node.removeEventListener('animationend', handler);
      });
    }
  });

  // 保存数据
  save();

  // 【v2.14.0】便签模式：每次渲染后更新标题（待办计数 / 完成进度）
  if (typeof updateStickyTitle === 'function') {
    updateStickyTitle();
  }

  // 便签模式：每次渲染后根据内容自适应窗口高度
  adjustStickyWindowHeight();
}

// 便签模式窗口高度自适应：有多少待办，窗口就有多大
// 使用防抖 + 阈值判断，避免连续微小变化导致窗口持续缩小
let lastAppliedHeight = 0; // 上次应用的高度，用于判断是否需要更新

function adjustStickyWindowHeight() {
  // 只在便签模式且未折叠时调整
  if (!document.body.classList.contains('sticky-mode')) return;
  if (stickyCollapsed) return;
  if (!window.electronAPI || !window.electronAPI.resizeWindow) return;

  // 双重 requestAnimationFrame：等浏览器完成样式计算和布局后再测量
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      // 直接测量 main 元素的总高度（包含 padding 和所有子元素）
      const mainEl = document.querySelector('main');
      const mainHeight = mainEl ? mainEl.scrollHeight : 0;

      // header 高度（标题栏）
      const header = document.querySelector('header');
      const headerHeight = header ? header.offsetHeight : 40;

      // 总高度 = header + main（已含 padding），再加少量呼吸空间
      const contentHeight = headerHeight + mainHeight + STICKY_BREATH_SPACE;

      // 计算目标高度，设置上下限
      const rawHeight = Math.max(STICKY_MIN_HEIGHT, Math.min(STICKY_MAX_HEIGHT, contentHeight));

      // 取整到整数像素，避免亚像素渲染导致的微小差异
      const targetHeight = Math.round(rawHeight);

      // 宽度固定为进入便签模式时记录的宽度，折叠/展开时不变化
      const fixedWidth = window.stickyModeWidth || STICKY_DEFAULT_WIDTH;

      // 如果高度变化小于阈值，不调整（防止窗口持续微小变化）
      if (lastAppliedHeight > 0 && Math.abs(targetHeight - lastAppliedHeight) < STICKY_HEIGHT_THRESHOLD) {
        // 但仍需检查是否溢出（内容动态变化时）
        const isOverflow = contentHeight > MAX_HEIGHT;
        const hasClass = document.body.classList.contains('is-overflow');
        if (isOverflow === hasClass) return; // 状态没变，跳过
      }
      lastAppliedHeight = targetHeight;

      // 内容超出最大高度时，添加 is-overflow 类启用列表区域滚动
      if (contentHeight > STICKY_MAX_HEIGHT) {
        document.body.classList.add('is-overflow');
      } else {
        document.body.classList.remove('is-overflow');
      }

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
        if (Array.isArray(todo.reminders) && todo.reminders.length > 0 && window.reminderModule) {
          const parsed = window.reminderModule.parse(newText);
          if (parsed.remindAt) {
            var startItem = todo.reminders.find(function (r) { return r.type === 'start'; });
            if (startItem) {
              startItem.at = parsed.remindAt;
              startItem.reminded = false;
            }
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

  // 从 reminders 数组获取各类型提醒点
  const hasReminders = Array.isArray(todo.reminders) && todo.reminders.length > 0;
  const startReminder = hasReminders ? todo.reminders.find(function (r) { return r.type === 'start'; }) : null;
  const endReminder = hasReminders ? todo.reminders.find(function (r) { return r.type === 'end'; }) : null;
  const beforeReminder = hasReminders ? todo.reminders.find(function (r) { return r.type === 'before'; }) : null;
  const hasStart = !!startReminder;
  const hasEnd = !!endReminder;
  const hasBefore = !!beforeReminder;

  // 构造 Tooltip 内容
  const tooltipParts = [];
  if (hasStart) {
    const d = new Date(startReminder.at);
    const dateStr = d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' +
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (hasEnd) {
      tooltipParts.push('📅 开始：' + dateStr);
    } else {
      tooltipParts.push('⏰ ' + dateStr);
    }
  }
  if (hasEnd) {
    const ed = new Date(endReminder.at);
    const endDateStr = ed.getFullYear() + '年' + (ed.getMonth() + 1) + '月' + ed.getDate() + '日 ' +
      String(ed.getHours()).padStart(2, '0') + ':' + String(ed.getMinutes()).padStart(2, '0');
    tooltipParts.push('🏁 结束：' + endDateStr);
  }
  if (hasBefore && hasEnd) {
    const beforeMins = Math.round((endReminder.at - beforeReminder.at) / MS_PER_MINUTE);
    tooltipParts.push('⏰ 结束前 ' + beforeMins + ' 分钟提醒');
  }
  if (todo.recurrence && todo.recurrence.enabled) {
    const unitMap = { minute: '分钟', hour: '小时', day: '天', week: '周' };
    let cycleText = '🔄 循环：每 ' + todo.recurrence.interval + ' ' + unitMap[todo.recurrence.unit];
    // 有目标次数时，在循环信息后追加次数进度（targetCount 统一存在 recurrence 内）
    const recurrenceTarget = todo.recurrence && todo.recurrence.targetCount;
    if (recurrenceTarget && recurrenceTarget > 0) {
      cycleText += '（' + (todo.completionCount || 0) + '/' + recurrenceTarget + ' 次）';
    }
    tooltipParts.push(cycleText);
  }
  if (tooltipParts.length > 0) {
    const tooltipText = tooltipParts.join(' | ');
    li.setAttribute('data-tooltip', tooltipText);
    li.classList.add('has-tooltip');
    // 有时间轴时不在此处绑定 tooltip（时间轴自有更详细的 tooltip）
    if (!(hasStart && hasEnd)) {
      attachTooltip(li, tooltipText);
    }
  }

  // 【次数已集成到循环提醒】非循环事项不再显示独立计数器
  // 判断是否为循环事项（需要在添加 badge 前决定按钮区域）
  const isCycle = todo.recurrence && todo.recurrence.enabled;

  // 有提醒时间或循环时显示徽章区域
  if (hasStart || hasEnd || isCycle) {
    li.appendChild(checkbox);
    li.appendChild(span);

    // 提醒徽章（有开始或结束时间时显示）
    // 当仅有开始或结束之一（无时间范围）时显示徽章；有时间轴时由时间轴承担显示
    if ((hasStart || hasEnd) && !(hasStart && hasEnd)) {
      const badge = document.createElement('span');
      badge.className = 'reminder-badge';
      li.appendChild(badge);

      // 循环徽章装饰
      if (isCycle) {
        badge.classList.add('reminder-badge-cycle');
      }
    }

    // 循环完成次数小徽章（有目标次数时显示 "×2/8"，无目标时显示 "×2"）
    // targetCount 统一存在 recurrence 内
    const recurrenceTarget = todo.recurrence && todo.recurrence.targetCount;
    if (isCycle && todo.completionCount > 0) {
      const countBadge = document.createElement('span');
      countBadge.className = 'completion-count';
      if (recurrenceTarget && recurrenceTarget > 0) {
        // 有目标次数：显示 "已完成/总次数"
        countBadge.textContent = '×' + todo.completionCount + '/' + recurrenceTarget;
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

    // 时间轴可视化（有开始+结束时间时显示）
    if (hasStart && hasEnd) {
      const timeline = document.createElement('div');
      timeline.className = 'todo-timeline';
      const timelineBar = document.createElement('div');
      timelineBar.className = 'todo-timeline-bar';
      const timelineStart = document.createElement('span');
      timelineStart.className = 'todo-timeline-dot start';
      const timelineEnd = document.createElement('span');
      timelineEnd.className = 'todo-timeline-dot end';
      const timelineLabel = document.createElement('span');
      timelineLabel.className = 'todo-timeline-label';
      timelineLabel.textContent = formatTimeShort(startReminder.at) + ' - ' + formatTimeShort(endReminder.at);
      timelineBar.appendChild(timelineStart);
      timelineBar.appendChild(timelineEnd);
      timeline.appendChild(timelineBar);
      timeline.appendChild(timelineLabel);
      // 悬浮显示完整时间信息（使用 JS 动态创建 tooltip，挂载到 body 避免被 overflow 裁剪）
      const tooltipText = '📅 ' + formatReminderText(startReminder.at) + '\n🏁 ' + formatReminderText(endReminder.at);
      timeline.setAttribute('data-tooltip', tooltipText);
      timeline.classList.add('has-tooltip');
      attachTooltip(timeline, tooltipText);
      li.appendChild(timeline);
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
  // 悬停删除按钮时隐藏详细 tooltip，避免干扰操作
  deleteBtn.addEventListener('mouseenter', hideAllTooltips);
  deleteBtn.addEventListener('mouseleave', function () {
    // 离开后如果仍在 li 内，可重新显示（由 li 的 mouseenter 处理）
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


// ---------- 4.1.x 时间轴 tooltip（JS 动态创建，挂载到 body 避免 overflow 裁剪） ----------

// 全局 tooltip 追踪：当前显示的 tooltip 元素数组
const activeTooltips = [];

// 隐藏所有当前显示的 tooltip（用于悬停按钮等交互元素时）
function hideAllTooltips() {
  while (activeTooltips.length > 0) {
    const el = activeTooltips.pop();
    if (el && el.parentNode) {
      el.remove();
    }
  }
}

// 通用 tooltip 附件函数：JS 动态创建，position: fixed 脱离滚动容器裁剪
function attachTooltip(element, text) {
  let tooltipEl = null;

  function showTooltip() {
    if (tooltipEl) return;
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'js-tooltip';
    tooltipEl.textContent = text;
    document.body.appendChild(tooltipEl);
    activeTooltips.push(tooltipEl);

    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
    let top = rect.top - tooltipRect.height - 8;

    // 上方空间不足时显示在下方
    if (top < 0) {
      top = rect.bottom + 8;
    }
    // 边界保护
    left = Math.max(8, Math.min(left, window.innerWidth - tooltipRect.width - 8));

    tooltipEl.style.left = left + 'px';
    tooltipEl.style.top = top + 'px';
    tooltipEl.style.opacity = '1';
  }

  function hideTooltip() {
    if (tooltipEl) {
      const idx = activeTooltips.indexOf(tooltipEl);
      if (idx !== -1) activeTooltips.splice(idx, 1);
      tooltipEl.remove();
      tooltipEl = null;
    }
  }

  element.addEventListener('mouseenter', showTooltip);
  element.addEventListener('mouseleave', hideTooltip);
  element.addEventListener('DOMNodeRemoved', hideTooltip);
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

// 时间戳格式化为简短"09:00"样式（用于时间轴）
function formatTimeShort(ts) {
  const d = new Date(ts);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

// 根据距离提醒时间的远近，刷新徽章文案与颜色 class
// 规则：> 1天 灰色 / ≤1天且>1小时 紫色 / ≤1小时 橙色脉冲 / 已过期 红色删除线
function updateReminderBadge(li, todo) {
  const badge = li.querySelector('.reminder-badge');
  if (!badge) return;       // 无徽章节点（未设提醒的事项）

  // 从 reminders 数组获取各类型提醒点
  const hasReminders = Array.isArray(todo.reminders) && todo.reminders.length > 0;
  if (!hasReminders) return;

  const startR = todo.reminders.find(function (r) { return r.type === 'start'; });
  const endR = todo.reminders.find(function (r) { return r.type === 'end'; });
  const beforeR = todo.reminders.find(function (r) { return r.type === 'before'; });
  const hasStart = !!startR;
  const hasEnd = !!endR;
  if (!hasStart && !hasEnd) return;

  const now = Date.now();

  // 确定用于颜色判断的最近提醒时间
  let activeTime = null;
  let activeReminded = true;
  // 优先级：结束前提醒 > 开始时间 > 结束时间
  if (beforeR && !beforeR.reminded) {
    activeTime = beforeR.at;
    activeReminded = false;
  } else if (startR && !startR.reminded) {
    activeTime = startR.at;
    activeReminded = false;
  } else if (endR && !endR.reminded) {
    activeTime = endR.at;
    activeReminded = false;
  }

  const diff = activeTime ? activeTime - now : -1;

  // 清掉旧的状态类，避免叠加
  badge.classList.remove(
    'reminder-badge-far', 'reminder-badge-soon',
    'reminder-badge-urgent', 'reminder-badge-overdue'
  );

  // 构造徽章文案
  let badgeText = '';
  if (hasStart && hasEnd) {
    // 有开始+结束：显示时间范围
    const startStr = formatTimeShort(startR.at);
    const endStr = formatTimeShort(endR.at);
    const startDate = new Date(startR.at);
    const endDate = new Date(endR.at);
    const sameDay = startDate.getMonth() === endDate.getMonth() && startDate.getDate() === endDate.getDate();
    if (sameDay) {
      badgeText = startStr + ' ~ ' + endStr;
    } else {
      badgeText = (startDate.getMonth() + 1) + '/' + startDate.getDate() + ' ' + startStr + ' ~ ' +
        (endDate.getMonth() + 1) + '/' + endDate.getDate() + ' ' + endStr;
    }
    if (activeReminded || diff <= 0) {
      badgeText += ' 已过';
    }
  } else if (hasStart) {
    // 仅有开始时间
    if (startR.reminded || diff <= 0) {
      badgeText = formatReminderText(startR.at) + ' 已过';
    } else if (diff <= MS_PER_HOUR) {
      const mins = Math.max(1, Math.round(diff / MS_PER_MINUTE));
      badgeText = '还有 ' + mins + ' 分钟';
    } else {
      badgeText = formatReminderText(startR.at);
    }
  } else if (hasEnd) {
    // 仅有结束时间
    if (endR.reminded || diff <= 0) {
      badgeText = formatReminderText(endR.at) + ' 已过';
    } else if (diff <= MS_PER_HOUR) {
      const mins = Math.max(1, Math.round(diff / MS_PER_MINUTE));
      badgeText = '还有 ' + mins + ' 分钟';
    } else {
      badgeText = formatReminderText(endR.at);
    }
  }

  badge.textContent = badgeText;

  // 颜色状态
  if (activeReminded || diff <= 0) {
    badge.classList.add('reminder-badge-overdue');
  } else if (diff > MS_PER_DAY) {
    badge.classList.add('reminder-badge-far');
  } else if (diff > MS_PER_HOUR) {
    badge.classList.add('reminder-badge-soon');
  } else {
    badge.classList.add('reminder-badge-urgent');
  }
}
