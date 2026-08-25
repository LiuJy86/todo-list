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
      // 记录进入便签模式时的宽度（使用 clientWidth，不含滚动条）
      // 注意：不用 window.innerWidth，因为它会随滚动条出现/变化
      window.stickyModeWidth = document.documentElement.clientWidth || STICKY_DEFAULT_WIDTH;
      // 便签模式：显示折叠按钮和「+」按钮
      var collapseBtn = document.getElementById('stickyCollapseBtn');
      if (collapseBtn) collapseBtn.style.display = 'inline-block';
      if (addToggleBtn) addToggleBtn.style.display = 'inline-block';
      // 【v2.14.0】更新标题（显示便签指示器 + 待办计数）
      updateStickyTitle();
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
      if (stickyInputArea) stickyInputArea.classList.remove('show');
      stickyCollapsed = false;
      document.body.classList.remove('sticky-collapsed');
      // 【v2.14.0】更新标题（恢复原标题）
      updateStickyTitle();
      // 重新渲染：恢复普通模式的收纳按钮
      render();
    }
  });
}

// 【v2.14.0】更新便签模式标题（显示待办计数 / 完成进度）
function updateStickyTitle() {
  var h1 = document.querySelector('header h1');
  if (!h1) return;
  var total = todos.length;
  var done = todos.filter(function (t) { return t.done; }).length;
  if (document.body.classList.contains('sticky-mode')) {
    // 便签模式：显示进度胶囊（色块样式）
    var percent = total > 0 ? Math.round((done / total) * 100) : 0;
    var blocks = 10;
    var filledBlocks = Math.round((percent / 100) * blocks);
    var blockHtml = '';
    for (var i = 0; i < blocks; i++) {
      blockHtml += '<span class="sticky-progress-block' + (i < filledBlocks ? ' filled' : '') + '"></span>';
    }
    var progressHtml = '<span class="sticky-progress">' +
      '<span class="sticky-progress-bar">' + blockHtml + '</span>' +
      '<span class="sticky-progress-text">' + percent + '%</span>' +
      '</span>';
    if (total === 0) {
      h1.innerHTML = 'ToDoList';
    } else if (stickyCollapsed) {
      // 折叠状态：显示进度胶囊
      h1.innerHTML = 'ToDoList' + progressHtml;
    } else {
      // 展开状态：显示进度胶囊
      h1.innerHTML = 'ToDoList' + progressHtml;
    }
  } else {
    // 普通模式：纯文字标题
    h1.innerHTML = 'ToDoList';
  }
}

// 便签模式折叠按钮：点击折叠/展开整个窗口
(function () {
  var collapseBtn = document.getElementById('stickyCollapseBtn');
  if (!collapseBtn) return;
  collapseBtn.addEventListener('click', function () {
    stickyCollapsed = !stickyCollapsed;
    var addToggleBtn = document.getElementById('stickyAddToggleBtn');
    // 使用进入便签模式时记录的固定宽度，折叠/展开时宽度不变
    const fixedWidth = window.stickyModeWidth || STICKY_DEFAULT_WIDTH;
    if (stickyCollapsed) {
      // 折叠：先收起输入区，再隐藏内容 + 缩窄窗口（与 CSS 动画同步）
      lastAppliedHeight = 0; // 重置高度记录，下次展开时重新计算
      // 收起输入区（如果有展开的话）
      if (addToggleBtn) {
        addToggleBtn.classList.remove('active');
      }
      var inputArea = document.getElementById('stickyInputArea');
      if (inputArea) {
        inputArea.classList.remove('show');
        setTimeout(function () {
          if (!inputArea.classList.contains('show')) inputArea.style.display = 'none';
        }, 300);
      }
      // 添加折叠 class（CSS 动画：max-height → 0, opacity → 0）
      document.body.classList.add('sticky-collapsed');
      if (window.electronAPI && window.electronAPI.resizeWindow) {
        window.electronAPI.resizeWindow(fixedWidth, STICKY_MIN_HEIGHT);
      }
      collapseBtn.textContent = '▲';
      collapseBtn.title = '展开窗口';
      // 【v2.14.0】折叠时更新标题（显示完成进度）
      updateStickyTitle();
    } else {
      // 展开：先把窗口放大到最大高度 → 移除折叠 class → 测量真实高度 → 收缩到合适值
      document.body.classList.remove('sticky-collapsed');
      // 先放大到最大高度，让内容完全展开（避免 scrollHeight 因窗口太小而测量不准）
      if (window.electronAPI && window.electronAPI.resizeWindow) {
        window.electronAPI.resizeWindow(fixedWidth, STICKY_MAX_HEIGHT);
      }
      collapseBtn.textContent = '▼';
      collapseBtn.title = '折叠窗口';
      updateStickyTitle();
      // 等一帧让浏览器完成布局计算，然后测量真实高度并收缩到合适值
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          adjustStickyWindowHeight();
        });
      });
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

  // 收起输入区（动画结束后清除 inline display，避免与 CSS 动画冲突）
  function collapseInput() {
    inputArea.classList.remove('show');
    addToggleBtn.classList.remove('active');
    stickyInput.value = '';
    lastEnterTime = 0;
    // 动画结束后隐藏元素（与 CSS transition 时长 0.3s 一致）
    setTimeout(function () {
      if (!inputArea.classList.contains('show')) {
        inputArea.style.display = 'none';
      }
    }, 300);
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
      reminders: [],
      recurrence: null,
      completionCount: 0,
      lastRemindAt: null
    });
    // 重新渲染（render 内部会自动 save + 调整便签窗口高度）
    render();
    // 【v2.14.0】添加成功反馈：输入框绿色边框闪烁
    stickyInput.classList.add('success-flash');
    setTimeout(function () {
      stickyInput.classList.remove('success-flash');
    }, INPUT_SUCCESS_DURATION);
    // 【v2.14.0】更新标题（待办计数变化）
    updateStickyTitle();
    // 清空输入框并保持聚焦
    stickyInput.value = '';
    stickyInput.focus();
  }

  // 点击标题栏「+」按钮：展开/收起输入区
  addToggleBtn.addEventListener('click', function () {
    if (!inputArea.classList.contains('show')) {
      // 展开：先清除 inline display，再加 CSS class 触发动画
      inputArea.style.display = '';
      // 用 requestAnimationFrame 确保 display 生效后再加 class，动画才能触发
      requestAnimationFrame(function () {
        inputArea.classList.add('show');
      });
      addToggleBtn.classList.add('active'); // 高亮按钮
      stickyInput.focus();
    } else {
      // 收起
      collapseInput();
    }
  });

  // 按回车键：单击添加，双击收起输入区
  stickyInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      var now = Date.now();
      var isDoubleEnter = (now - lastEnterTime) < DOUBLE_CLICK_INTERVAL;
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

// 【v2.14.0】便签模式：双击 Esc 退出便签模式
(function () {
  var lastEscTime = 0;
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.classList.contains('sticky-mode')) {
      var now = Date.now();
      if (now - lastEscTime < DOUBLE_CLICK_INTERVAL) {
        // 双击 Esc → 退出便签模式
        if (window.electronAPI && window.electronAPI.exitStickyMode) {
          window.electronAPI.exitStickyMode();
        }
        lastEscTime = 0;
      } else {
        lastEscTime = now;
      }
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
  let endRemindAt = null;
  let endRemindBefore = 0;
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
        window.datetimePickerModule.syncFromTimestamp(remindAt, null, parsed.endRemindAt, parsed.endRemindBefore);
      }
    }
  }

  // 2) 从日期选择器获取时间（覆盖自然语言解析结果）
  // 注意：只有日期选择器有明确设置时间时才覆盖；循环设置只在选择器有值时才覆盖，
  // 避免自然语言解析得到的循环设置被选择器的 null 覆盖
  const pickerTs = window.datetimePickerModule ? window.datetimePickerModule.getTimestamp() : null;
  if (pickerTs) {
    remindAt = pickerTs;
    // 获取结束时间
    const pickerEndTs = window.datetimePickerModule.getEndTimestamp();
    if (pickerEndTs) {
      endRemindAt = pickerEndTs;
    }
    // 获取结束前提醒
    const pickerBefore = window.datetimePickerModule.getEndRemindBefore();
    if (pickerBefore > 0) {
      endRemindBefore = pickerBefore;
    }
    const pickerRecurrence = window.datetimePickerModule.getRecurrence();
    if (pickerRecurrence) {
      recurrence = pickerRecurrence;
    }
  }

  // 3) 都没有 → 纯添加（不设提醒）
  const newTodo = addTodo(remindAt, endRemindAt, endRemindBefore, recurrence);

  if (newTodo && window.reminderModule && Array.isArray(newTodo.reminders) && newTodo.reminders.length > 0) {
    window.reminderModule.schedule(newTodo);
  }

  // 清空日期选择器（含循环次数）
  if (window.datetimePickerModule) {
    window.datetimePickerModule.clearAll();
  }

  // 触发桌宠反馈
  if (window.petMood) {
    window.petMood.excited();
    let msg;
    if (remindAt || endRemindAt) {
      if (recurrence && recurrence.enabled) {
        msg = '已设好循环提醒，到点我会叫你！';
      } else if (endRemindAt && endRemindBefore > 0) {
        msg = '已设好提醒（含结束前 ' + endRemindBefore + ' 分钟提醒），到点我会叫你！';
      } else if (endRemindAt) {
        msg = '已设好开始+结束提醒，到点我会叫你！';
      } else {
        msg = '已设好提醒，到点我会叫你！';
      }
    } else {
      msg = ADD_TODO_TOASTS[Math.floor(Math.random() * ADD_TODO_TOASTS.length)];
    }
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

// 包装 deleteTodo：动画删除 → 表情 + toast 反馈（不再弹窗确认）
function wrappedDeleteTodo(id) {
  const todo = todos.find(function (t) { return t.id === id; });
  deleteTodo(id);  // 直接执行删除（含动画）
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

// 【v2.13.0】添加按钮涟漪效果：点击时从点击位置扩散圆形波纹
function addButtonRipple(event) {
  var button = event.currentTarget;
  // 计算点击位置相对于按钮的坐标
  var rect = button.getBoundingClientRect();
  var x = event.clientX - rect.left;
  var y = event.clientY - rect.top;
  // 创建涟漪元素
  var ripple = document.createElement('span');
  ripple.className = 'btn-ripple';
  ripple.style.left = x + 'px';
  ripple.style.top = y + 'px';
  button.appendChild(ripple);
  // 动画结束后移除涟漪元素
  ripple.addEventListener('animationend', function () {
    ripple.remove();
  });
}
addBtn.addEventListener('click', addButtonRipple, true); // 使用捕获阶段，确保在 wrappedAddTodo 之前执行

// 【v2.13.0】空状态示例按钮点击：填入输入框并聚焦
var emptyState = document.getElementById('emptyState');
if (emptyState) {
  emptyState.addEventListener('click', function (e) {
    var btn = e.target.closest('.empty-example-btn');
    if (btn) {
      var text = btn.dataset.text;
      if (text && todoInput) {
        todoInput.value = text;
        todoInput.focus();
        // 将光标移到文本末尾
        todoInput.setSelectionRange(text.length, text.length);
      }
    }
  });
}

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

// ============================================
// 【v2.22.0】史迪仔桌面提醒窗口 - 主窗口监听
// ============================================

// 监听从提醒窗口发来的"完成待办"请求
if (window.electronAPI && window.electronAPI.onCompleteTodo) {
  window.electronAPI.onCompleteTodo(function (todoId) {
    console.log('[史迪仔提醒] 收到完成待办请求:', todoId);
    // 找到对应的待办并切换完成状态
    var todo = todos.find(function (t) { return t.id === todoId; });
    if (todo && !todo.done) {
      // 使用包装函数触发完成逻辑（含桌宠反馈）
      wrappedToggleTodo(todoId);
    }
  });
}
