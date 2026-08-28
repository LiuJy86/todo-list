/**
 * 史迪仔桌面提醒窗口脚本
 * v2.24.0 - 独立透明窗口，负责展示提醒 + 用户交互
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
  var currentTodo = null;

  // 当前播放的音频元素（用于关闭窗口时停止）
  var currentAudio = null;

  // ============================================
  // 获取 URL 参数中的待办数据
  // ============================================
  function getTodoFromURL() {
    console.log('[史迪仔提醒] window.location.search:', window.location.search);
    var params = new URLSearchParams(window.location.search);
    var todoEncoded = params.get('todo');
    console.log('[史迪仔提醒] todo 参数:', todoEncoded ? todoEncoded.substring(0, 100) + '...' : 'null');
    if (!todoEncoded) return null;
    try {
      // URLSearchParams.get() 会自动 decodeURIComponent，直接 parse
      var result = JSON.parse(todoEncoded);
      console.log('[史迪仔提醒] 解析成功:', result);
      return result;
    } catch (e) {
      console.error('[史迪仔提醒] 解析待办数据失败:', e);
      return null;
    }
  }

  // ============================================
  // 【v2.24.0】从 URL 参数获取自定义资源
  // ============================================
  function getCustomAssetsFromURL() {
    var params = new URLSearchParams(window.location.search);
    var sound = params.get('sound') || null;
    console.log('[史迪仔提醒] sound 参数:', sound);
    var images = [];
    try {
      var imagesParam = params.get('images');
      console.log('[史迪仔提醒] images 参数:', imagesParam);
      if (imagesParam) {
        // URLSearchParams.get() 会自动 decodeURIComponent
        images = JSON.parse(imagesParam);
      }
    } catch (e) {
      console.error('[史迪仔提醒] 解析 images 失败:', e);
      images = [];
    }
    return { sound: sound, images: images };
  }

  var customAssets = getCustomAssetsFromURL();

  // ============================================
  // 根据优先级选择史迪仔 GIF
  // ============================================
  function getStitchGifByPriority(priority) {
    // 【v2.24.0】优先使用自定义图片
    if (customAssets.images && customAssets.images.length > 0) {
      var index;
      switch (priority) {
        case 3: index = Math.min(2, customAssets.images.length - 1); break;
        case 2: index = Math.min(1, customAssets.images.length - 1); break;
        default: index = 0;
      }
      return customAssets.images[index];
    }
    // 默认史迪奇 GIF
    switch (priority) {
      case 3: return 6;
      case 2: return 4;
      case 1:
      default: return 1;
    }
  }

  // ============================================
  // 根据场景生成提醒文字（支持不同提醒类型）
  // ============================================
  function getReminderText(todo) {
    var title = todo.text || todo.title || '待办';
    var type = todo.reminderType || 'start';
    var texts;

    // 根据提醒类型选择不同的文案风格
    if (type === 'before') {
      // 结束前提醒：强调即将结束
      texts = [
        '⏰ 即将结束：' + title,
        '还有几分钟就结束了哦：' + title,
        '快结束了，准备好了吗：' + title,
        '⏳ ' + title + ' 即将到期～'
      ];
    } else if (type === 'end') {
      // 结束时间提醒
      texts = [
        '🏁 结束时间到：' + title,
        title + ' 结束时间到了！',
        '别忘了结束哦：' + title,
        '🏁 该完成啦：' + title
      ];
    } else {
      // 开始时间提醒（默认）
      texts = [
        '该' + title + '了！',
        '别忘了：' + title,
        title + ' 时间到！',
        '嘿！该' + title + '啦～'
      ];
    }

    var index = hashString(String(todo.id)) % texts.length;
    return texts[index];
  }

  // ============================================
  // 工具函数：字符串哈希
  // ============================================
  function hashString(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      var char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  // ============================================
  // 停止音效
  // ============================================
  function stopSound() {
    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      } catch (e) { /* ignore */ }
      currentAudio = null;
    }
  }

  // ============================================
  // 关闭窗口
  // ============================================
  function closeWindow() {
    console.log('[史迪仔提醒] 关闭窗口');
    stopSound(); // 关闭前先停止音效
    // 直接通过 IPC 通知主进程关闭
    if (window.electronAPI && window.electronAPI.closeReminder) {
      window.electronAPI.closeReminder();
    } else {
      console.error('[史迪仔提醒] electronAPI 不可用');
    }
  }

  // ============================================
  // 绑定按钮事件
  // ============================================
  function bindEvents(todo) {
    console.log('[史迪仔提醒] 绑定按钮事件');

    // "知道了"按钮
    var dismissBtn = document.getElementById('btn-dismiss');
    if (dismissBtn) {
      dismissBtn.onclick = function () {
        console.log('[史迪仔提醒] 点击：知道了');
        closeWindow();
      };
    } else {
      console.warn('[史迪仔提醒] 未找到 btn-dismiss');
    }

    // "稍后提醒"按钮
    var snoozeBtn = document.getElementById('btn-snooze');
    if (snoozeBtn) {
      snoozeBtn.onclick = function () {
        console.log('[史迪仔提醒] 点击：稍后提醒');
        if (window.electronAPI && window.electronAPI.snoozeReminder) {
          window.electronAPI.snoozeReminder(todo, 5);
        }
        closeWindow();
      };
    } else {
      console.warn('[史迪仔提醒] 未找到 btn-snooze');
    }

    // "完成"按钮
    var completeBtn = document.getElementById('btn-complete');
    if (completeBtn) {
      completeBtn.onclick = function () {
        console.log('[史迪仔提醒] 点击：完成', todo.id);
        if (window.electronAPI && window.electronAPI.completeTodoFromReminder) {
          window.electronAPI.completeTodoFromReminder(todo.id);
        }
        closeWindow();
      };
    } else {
      console.warn('[史迪仔提醒] 未找到 btn-complete');
    }

    // 点击史迪仔关闭
    var stitchWrapper = document.getElementById('stitch-wrapper');
    if (stitchWrapper) {
      stitchWrapper.onclick = function () {
        console.log('[史迪仔提醒] 点击：史迪仔');
        closeWindow();
      };
    }
  }

  // ============================================
  // 填充页面数据
  // ============================================
  function populateData(todo) {
    console.log('[史迪仔提醒] 填充数据:', todo);

    var reminderText = document.getElementById('reminder-text');
    if (reminderText) {
      reminderText.textContent = getReminderText(todo);
    }

    // 【优化】根据提醒类型显示不同图标
    var reminderIcon = document.getElementById('reminder-icon');
    if (reminderIcon) {
      var type = todo.reminderType || 'start';
      if (type === 'before') {
        reminderIcon.textContent = '⏰';  // 闹钟 - 即将结束
      } else if (type === 'end') {
        reminderIcon.textContent = '🏁';  // 旗帜 - 结束
      } else {
        reminderIcon.textContent = '🔔';  // 铃铛 - 开始
      }
    }

    // 设置史迪奇图片
    var stitchImg = document.getElementById('stitch-img');
    if (stitchImg) {
      var gifValue = getStitchGifByPriority(todo.priority);
      console.log('[史迪仔提醒] GIF值:', gifValue, '自定义图片:', customAssets.images);

      if (typeof gifValue === 'string') {
        // 自定义图片
        if (window.electronAPI && window.electronAPI.getUserDataPath) {
          window.electronAPI.getUserDataPath().then(function (userData) {
            stitchImg.src = 'file:///' + userData.replace(/\\/g, '/') + '/custom-assets/' + gifValue;
          }).catch(function () {
            stitchImg.src = 'img/史迪奇1.gif';
          });
        } else {
          stitchImg.src = 'img/史迪奇1.gif';
        }
      } else {
        // 默认 GIF
        stitchImg.src = 'img/史迪奇' + gifValue + '.gif';
      }
    }
  }

  // ============================================
  // 播放提示音
  // ============================================
  function playSound() {
    var src = '提示音效.mp3';

    if (customAssets.sound && window.electronAPI && window.electronAPI.getUserDataPath) {
      window.electronAPI.getUserDataPath().then(function (userData) {
        src = 'file:///' + userData.replace(/\\/g, '/') + '/custom-assets/' + customAssets.sound;
        doPlaySound(src);
      }).catch(function () {
        doPlaySound(src);
      });
    } else {
      doPlaySound(src);
    }
  }

  function doPlaySound(src) {
    try {
      // 先停止之前的音效，避免叠加
      stopSound();
      var audio = new Audio(src);
      audio.volume = 0.6;
      currentAudio = audio;
      audio.play().catch(function (e) {
        console.warn('[史迪仔提醒] 音频播放失败:', e);
      });
      // 播放完毕后自动清理引用
      audio.addEventListener('ended', function () {
        currentAudio = null;
      }, { once: true });
    } catch (e) {
      console.warn('[史迪仔提醒] 音频播放失败:', e);
    }
  }

  // ============================================
  // 启动动画序列
  // ============================================
  function startAnimation() {
    var stitchWrapper = document.getElementById('stitch-wrapper');
    if (!stitchWrapper) return;

    setTimeout(function () {
      stitchWrapper.classList.add('bouncing');
    }, 600);

    setTimeout(function () {
      stitchWrapper.classList.remove('bouncing');
      stitchWrapper.classList.add('shaking');
    }, 3000);

    setTimeout(function () {
      stitchWrapper.classList.remove('shaking');
    }, 8000);
  }

  // ============================================
  // 初始化
  // ============================================
  function init() {
    console.log('[史迪仔提醒] 初始化开始');

    currentTodo = getTodoFromURL();
    if (!currentTodo) {
      console.error('[史迪仔提醒] 未获取到待办数据');
      return;
    }

    console.log('[史迪仔提醒] 待办数据:', currentTodo);

    populateData(currentTodo);
    startAnimation();
    playSound();
    bindEvents(currentTodo);

    console.log('[史迪仔提醒] 初始化完成');
  }

  // ============================================
  // 启动
  // ============================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
