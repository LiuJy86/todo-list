/**
 * 史迪仔桌面提醒窗口脚本
 * v2.22.0 - 独立透明窗口，负责展示提醒 + 用户交互
 *
 * 功能：
 * 1. 从 URL 参数解析待办数据
 * 2. 控制史迪仔抖动动画
 * 3. 播放提示音
 * 4. 处理用户按钮交互（知道了/稍后提醒/完成）
 */
(function () {
  'use strict';

  // 当前待办数据
  let currentTodo = null;

  // ============================================
  // 获取 URL 参数中的待办数据
  // ============================================
  function getTodoFromURL() {
    const params = new URLSearchParams(window.location.search);
    const todoEncoded = params.get('todo');
    if (!todoEncoded) return null;
    try {
      return JSON.parse(decodeURIComponent(todoEncoded));
    } catch (e) {
      console.error('[史迪仔提醒] 解析待办数据失败:', e);
      return null;
    }
  }

  // ============================================
  // 初始化
  // ============================================
  function init() {
    currentTodo = getTodoFromURL();
    if (!currentTodo) {
      console.error('[史迪仔提醒] 未获取到待办数据');
      return;
    }

    // 填充数据
    populateData(currentTodo);

    // 启动动画
    startAnimation();

    // 播放提示音
    playSound();

    // 绑定按钮事件
    bindEvents(currentTodo);
  }

  // ============================================
  // 填充页面数据
  // ============================================
  function populateData(todo) {
    const reminderText = document.getElementById('reminder-text');
    const todoTitle = document.getElementById('todo-title');
    const todoNotes = document.getElementById('todo-notes');
    const stitchImg = document.getElementById('stitch-img');

    // 设置提醒文字
    reminderText.textContent = getReminderText(todo);

    // 设置待办标题（兼容 text 和 title 字段）
    if (todoTitle) {
      todoTitle.textContent = todo.text || todo.title || '待办事项';
    }

    // 设置备注（如果有）
    if (todoNotes) {
      if (todo.notes) {
        todoNotes.textContent = todo.notes;
        todoNotes.style.display = 'block';
      } else {
        todoNotes.style.display = 'none';
      }
    }

    // 根据优先级选择不同史迪仔表情
    const gifIndex = getStitchGifByPriority(todo.priority);
    stitchImg.src = `img/史迪奇${gifIndex}.gif`;
  }

  // ============================================
  // 根据场景生成提醒文字
  // ============================================
  function getReminderText(todo) {
    const title = todo.text || todo.title || '待办';
    const texts = [
      `该${title}了！`,
      `别忘了：${title}`,
      `${title} 时间到！`,
      `嘿！该${title}啦～`,
    ];
    // 根据 todo.id 选择一个固定的文案
    const index = hashString(String(todo.id)) % texts.length;
    return texts[index];
  }

  // ============================================
  // 根据优先级选择史迪仔 GIF
  // ============================================
  function getStitchGifByPriority(priority) {
    // 1=普通(可爱), 2=中等(期待), 3=紧急(着急)
    switch (priority) {
      case 3: return 6;  // 紧急 - 史迪奇6.gif
      case 2: return 4;  // 中等 - 史迪奇4.gif
      case 1:
      default: return 1; // 普通 - 史迪奇1.gif
    }
  }

  // ============================================
  // 启动动画序列（自然轻柔版）
  // ============================================
  function startAnimation() {
    const stitchWrapper = document.getElementById('stitch-wrapper');

    // 阶段1：入场后先轻微弹跳 3 次（约2.4秒），引起注意
    setTimeout(() => {
      stitchWrapper.classList.add('bouncing');
    }, 600);

    // 阶段2：弹跳结束后切换为轻柔摇摆，持续更久
    setTimeout(() => {
      stitchWrapper.classList.remove('bouncing');
      stitchWrapper.classList.add('shaking');
    }, 3000);

    // 阶段3：8 秒后停止所有动画，恢复安静
    setTimeout(() => {
      stitchWrapper.classList.remove('shaking');
    }, 8000);
  }

  // ============================================
  // 播放提示音
  // ============================================
  function playSound() {
    try {
      const audio = new Audio('提示音效.mp3');
      audio.volume = 0.6;
      audio.play().catch(function (e) {
        console.warn('[史迪仔提醒] 音频播放失败:', e);
      });
    } catch (e) {
      console.warn('[史迪仔提醒] 音频播放失败:', e);
    }
  }

  // ============================================
  // 绑定按钮事件
  // ============================================
  function bindEvents(todo) {
    // "知道了"按钮 - 关闭窗口
    document.getElementById('btn-dismiss').addEventListener('click', function () {
      dismissWithAnimation();
    });

    // "稍后提醒"按钮 - 延迟 5 分钟
    document.getElementById('btn-snooze').addEventListener('click', function () {
      if (window.electronAPI) {
        window.electronAPI.snoozeReminder(todo, 5);
      } else {
        console.error('[史迪仔提醒] electronAPI 不可用');
      }
      dismissWithAnimation();
    });

    // "完成"按钮 - 标记待办完成
    document.getElementById('btn-complete').addEventListener('click', function () {
      if (window.electronAPI) {
        window.electronAPI.completeTodoFromReminder(todo.id);
      } else {
        console.error('[史迪仔提醒] electronAPI 不可用');
      }
      dismissWithAnimation();
    });

    // 点击史迪仔也可以关闭
    document.getElementById('stitch-wrapper').addEventListener('click', function () {
      dismissWithAnimation();
    });
  }

  // ============================================
  // 带动画关闭
  // ============================================
  function dismissWithAnimation() {
    const container = document.getElementById('reminder-container');
    container.classList.add('dismissing');

    // 动画结束后通知主进程关闭窗口
    setTimeout(function () {
      if (window.electronAPI) {
        window.electronAPI.closeReminder();
      }
    }, 300);
  }

  // ============================================
  // 工具函数：字符串哈希
  // ============================================
  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  // ============================================
  // 启动
  // ============================================
  document.addEventListener('DOMContentLoaded', init);

})();
