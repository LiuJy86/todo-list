// ---------- 7. 事件监听 ----------

// 点击「添加」按钮时调用 addTodo
addBtn.addEventListener('click', addTodo);

// 在输入框中按回车也能添加，提升输入体验
// 使用命名函数，方便后续移除并替换为包装版本
function onTodoInputKeydown(e) {
  // e.key 表示按下的键，'Enter' 即回车键
  if (e.key === 'Enter') {
    addTodo();
  }
}
todoInput.addEventListener('keydown', onTodoInputKeydown);


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
      lastRemindAt: null
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
  // 注意：只有日期选择器有明确设置时间时才覆盖；循环设置只在选择器有值时才覆盖，
  // 避免自然语言解析得到的循环设置被选择器的 null 覆盖
  const pickerTs = window.datetimePickerModule ? window.datetimePickerModule.getTimestamp() : null;
  if (pickerTs) {
    remindAt = pickerTs;
    const pickerRecurrence = window.datetimePickerModule.getRecurrence();
    if (pickerRecurrence) {
      recurrence = pickerRecurrence;
    }
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
      // 有目标次数时显示进度，无目标时只显示完成次数（targetCount 统一存在 recurrence 内）
      const recurrenceTarget = todo.recurrence && todo.recurrence.targetCount;
      if (recurrenceTarget && recurrenceTarget > 0) {
        window.petMood.toast('完成 ' + todo.completionCount + '/' + recurrenceTarget + ' 次！继续加油！', 'success');
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

// 重新绑定事件：移除原始监听器，改用包装版本
addBtn.removeEventListener('click', addTodo);
addBtn.addEventListener('click', wrappedAddTodo);

// 回车键也替换为包装版本：移除原始监听器，添加新的（命名函数可正确移除）
todoInput.removeEventListener('keydown', onTodoInputKeydown);
todoInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    wrappedAddTodo();
  }
});

// 将包装函数暴露到 window，供 createTodoElement 中的事件监听器调用
window.wrappedAddTodo = wrappedAddTodo;
window.wrappedToggleTodo = wrappedToggleTodo;
window.wrappedDeleteTodo = wrappedDeleteTodo;

// 用 getter 暴露 todos，确保始终返回最新引用（todos 在 load/deleteTodo/toggleTodo 中会被重新赋值）
Object.defineProperty(window, 'todos', {
  get: function () { return todos; },
  enumerable: true,
  configurable: true
});
window.getAllTodos = function () { return todos; };
