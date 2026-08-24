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
  // 注意：targetCount 统一存在 recurrence 内，不再顶层重复存储
  const newTodo = {
    id: Date.now(),
    text: text,
    done: false,
    remindAt: remindAt || null,
    reminded: false,
    recurrence: recurrence || null,
    completionCount: 0,
    lastRemindAt: null
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
    // targetCount 统一存在 recurrence 内
    const targetCount = todo.recurrence && todo.recurrence.targetCount;
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
