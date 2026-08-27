/**
 * 统一引导系统 (v2.25.0)
 *
 * 合并「首次引导」+「上下文提示」+「功能发现」三套能力。
 * 声明式配置，新增引导步骤只需加配置项。
 *
 * 全局 API: window.Guide = { start, stop, next, skip, reset, ... }
 */
(function () {
  'use strict';

  // ============ 常量 ============
  var TOUR_STORAGE_KEY = 'guide_tour_done';
  var TIP_PREFIX = 'guide_tip_';
  var GUIDE_PROGRESS_KEY = 'guide_tour_progress';
  var CURRENT_TOUR_VERSION = '1';

  var GUIDE_STATE = {
    idle: 'idle',
    running: 'running',
    tooltip: 'tooltip'
  };

  // ============ 全局状态 ============
  var state = GUIDE_STATE.idle;
  var currentTour = null;
  var currentStepIndex = 0;
  var currentPhaseIndex = 0;
  var overlayEl = null;
  var spotlightEl = null;
  var cardEl = null;
  var tooltipEl = null;
  var cleanup = null;
  var phaseCleanup = null;
  var tipQueue = [];
  var lastTipTime = 0;
  var TIP_COOLDOWN = 3000; // 两条 tip 之间最小间隔

  // ============ 引导流程配置 ============
  var TOURS = [
    {
      id: 'welcome-tour',
      version: '1',
      autoStart: true,
      steps: [
        {
          title: '欢迎使用 ToDoList',
          desc: '这是一个轻量的待办工具\n几秒钟带你了解核心功能 ✨',
          spotlight: null,
          position: 'center',
          wait: null,
          action: { label: '开始体验', fn: 'next' }
        },
        {
          title: '添加待办',
          desc: '输入内容，按 Enter 即可添加\n试试："9点半开会"，自动识别提醒时间 ⏰',
          spotlight: '#todoInput',
          position: 'bottom',
          wait: { type: 'enter-with-value', target: '#todoInput' }
        },
        {
          title: '事项操作',
          desc: '事项已创建！你可以：\n\n✅ 勾选左侧方框 → 完成事项\n✏️ 双击文字 → 编辑内容\n📅 点击时间徽章 → 修改提醒时间\n🖱️ 悬停右侧 → 显示删除按钮',
          spotlight: '#todoList li:first-child',
          position: 'bottom',
          wait: null,
          action: { label: '下一步', fn: 'next' }
        },
        {
          title: '设置提醒',
          desc: '点击 📅 时间管理\n可为事项设置提醒时间、循环提醒\n到点桌宠会弹窗提醒你 🔔',
          spotlight: '#datetimeTrigger',
          position: 'bottom',
          wait: { type: 'click', target: '#datetimeTrigger' }
        },
        {
          title: '提醒设置 ⏰',
          desc: '可以为事项设置提醒：\n\n📅 开始时间 — 任务何时开始\n🏁 结束时间 — 任务何时结束\n⏰ 结束前提醒 — 结束前 N 分钟提醒你\n🔄 循环提醒 — 周期性重复提醒\n\n设置好后点击「确定」保存',
          spotlight: '#datetimePopover',
          position: 'bottom',
          wait: null,
          action: { label: '下一步', fn: 'next' }
        },
        {
          title: '快捷键技巧 ⌨️',
          desc: '两枚快捷键，效率翻倍：\n\nAlt+F — 快速显示/隐藏程序窗口\nAlt+G — 切换便签模式/普通模式（窗口变桌面便签）\n\n快来试试吧！更多快捷方式等你来发掘',
          spotlight: null,
          position: 'center',
          wait: null,
          action: { label: '下一步', fn: 'next' }
        },
        {
          title: '桌宠日报 📊',
          desc: '双击桌宠，可以查看你的每日完成报告！\n\n📈 完成率 — 今日完成进度\n✅ 已完成 — 事项统计\n\n试试看，双击它吧！',
          spotlight: '#stitchPet',
          position: 'top',
          wait: { type: 'dblclick-then-modal-close', target: '#stitchPet', modalTarget: '#dailyReportModal' }
        },
        {
          title: '全部搞定',
          desc: '核心功能你都会了：\n\n• 输入添加待办（自然语言识别时间）\n• 勾选完成 / 双击编辑 / 悬停删除\n• 📅 设置提醒和循环\n• ⌨️ 快捷键效率翻倍\n• 📊 双击史迪奇查看日报\n\n恭喜你，已经掌握所有核心功能了！🎉',
          spotlight: null,
          position: 'center',
          wait: null,
          action: { label: '完成引导', fn: 'complete' }
        }
      ]
    },
    {
      id: 'sticky-tour',
      version: '1',
      autoStart: false, // 不自动启动，通过 body class 变化触发
      steps: [
        {
          title: '便签模式 📌',
          desc: '已进入便签模式！\n\n▼ 折叠 — 点击折叠按钮收起/展开列表\n📌 固定 — 窗口固定在桌面，Windows+D 无法最小化\n➕ 添加 — 点击 + 按钮快速添加待办\n\n双击 Esc 可退出便签模式',
          spotlight: null,
          position: 'center',
          wait: null,
          action: { label: '知道了', fn: 'complete' }
        }
      ]
    }
  ];

  // ============ 上下文提示配置 ============
  var TIPS = [
    {
      id: 'natural-language',
      trigger: {
        type: 'event',
        event: 'focus',
        target: '#todoInput',
        condition: function () {
          return localStorage.getItem(TIP_PREFIX + 'natural-language') !== 'done'
            && document.querySelectorAll('#todoList li').length === 0;
        }
      },
      content: '试试输入"9点半开会"，自动识别时间 ⏰',
      position: 'bottom',
      dismissible: true,
      autoHide: 5000
    },
    {
      id: 'datetime-picker',
      trigger: {
        type: 'custom',
        check: function () {
          return localStorage.getItem(TIP_PREFIX + 'datetime-picker') !== 'done'
            && document.querySelectorAll('#todoList li').length >= 1
            && localStorage.getItem('guide_datetime_used') !== '1';
        }
      },
      content: '点击 📅 可为事项设置提醒时间',
      position: 'bottom',
      anchor: '#datetimeTrigger',
      dismissible: true,
      autoHide: 6000
    },
    {
      id: 'complete-collapse',
      trigger: {
        type: 'custom',
        check: function () {
          return localStorage.getItem(TIP_PREFIX + 'complete-collapse') !== 'done'
            && hasCompletedAnItem();
        }
      },
      content: '已完成的事项自动沉底，可点击展开/收起',
      position: 'top',
      anchor: '.completed-section',
      dismissible: true,
      autoHide: 6000
    },
    {
      id: 'overdue-badge',
      trigger: {
        type: 'interval',
        interval: 60000,
        condition: function () {
          return localStorage.getItem(TIP_PREFIX + 'overdue-badge') !== 'done'
            && document.querySelector('.reminder-overdue') !== null;
        }
      },
      content: '🔴 红色徽章 = 已过期，双击事项可修改时间',
      position: 'top',
      anchor: '.reminder-overdue',
      dismissible: true,
      autoHide: 8000
    },
    {
      id: 'pet-discovery',
      trigger: {
        type: 'custom',
        check: function () {
          return localStorage.getItem(TIP_PREFIX + 'pet-discovery') !== 'done'
            && localStorage.getItem('guide_first_completed') === '1';
        }
      },
      content: '✨ 太棒了！试试看双击史迪奇？它会给你惊喜',
      position: 'top',
      anchor: '#stitchPet',
      dismissible: true,
      autoHide: 6000
    }
  ];

  // ============ 工具函数 ============

  function hasCompletedAnItem() {
    var list = document.getElementById('todoList');
    if (!list) return false;
    var items = list.querySelectorAll('li');
    for (var i = 0; i < items.length; i++) {
      if (items[i].classList.contains('done')) return true;
    }
    return false;
  }

  function getViewport() {
    return {
      w: window.innerWidth,
      h: window.innerHeight
    };
  }

  function overlaps(rect1, rect2) {
    return !(
      rect1.left + rect1.width < rect2.left ||
      rect1.left > rect2.left + rect2.width ||
      rect1.top + rect1.height < rect2.top ||
      rect1.top > rect2.top + rect2.height
    );
  }

  // ============ Spotlight 高亮层 ============

  function createSpotlight() {
    var el = document.createElement('div');
    el.className = 'guide-spotlight';
    el.style.display = 'none';
    overlayEl.appendChild(el);
    return el;
  }

  function showSpotlight(target, animate) {
    if (!spotlightEl) return;
    var rect = target.getBoundingClientRect();
    // animate=false 时临时禁用过渡，用于步骤切换瞬间定位
    if (animate === false) {
      spotlightEl.style.transition = 'none';
      // 强制重排，确保 transition:none 生效
      void spotlightEl.offsetHeight;
    }
    spotlightEl.style.top = (rect.top - 6) + 'px';
    spotlightEl.style.left = (rect.left - 6) + 'px';
    spotlightEl.style.width = (rect.width + 12) + 'px';
    spotlightEl.style.height = (rect.height + 12) + 'px';
    spotlightEl.style.display = 'block';
    if (animate === false) {
      // 恢复过渡（下一帧开始动画）
      void spotlightEl.offsetHeight;
      spotlightEl.style.transition = '';
    }
  }

  function hideSpotlight() {
    if (spotlightEl) spotlightEl.style.display = 'none';
  }

  function setSpotlightPulse(pulse) {
    if (!spotlightEl) return;
    if (pulse) {
      spotlightEl.classList.add('guide-spotlight--pulse');
      spotlightEl.classList.remove('guide-spotlight--success');
    } else {
      spotlightEl.classList.remove('guide-spotlight--pulse');
    }
  }

  function setSpotlightSuccess() {
    if (!spotlightEl) return;
    spotlightEl.classList.remove('guide-spotlight--pulse');
    spotlightEl.classList.add('guide-spotlight--success');
  }

  // ============ Card 说明卡片 ============

  function createCard() {
    var el = document.createElement('div');
    el.className = 'guide-card';
    el.innerHTML =
      '<span class="guide-card__badge"></span>' +
      '<h3 class="guide-card__title"></h3>' +
      '<p class="guide-card__desc"></p>' +
      '<div class="guide-card__footer">' +
        '<div class="guide-card__dots"></div>' +
        '<div class="guide-card__actions">' +
          '<button class="guide-card__btn guide-card__btn--skip">跳过</button>' +
          '<button class="guide-card__btn guide-card__btn--primary"></button>' +
        '</div>' +
      '</div>';
    overlayEl.appendChild(el);

    // 绑定按钮事件
    el.querySelector('.guide-card__btn--skip').addEventListener('click', skip);
    el.querySelector('.guide-card__btn--primary').addEventListener('click', handleCardAction);

    return el;
  }

  function handleCardAction() {
    if (!currentTour) return;
    var step = currentTour.steps[currentStepIndex];
    if (step && step.action && step.action.fn) {
      if (step.action.fn === 'next') {
        next();
      } else if (step.action.fn === 'complete') {
        complete();
      }
    } else {
      next();
    }
  }

  function renderCard(step, totalSteps) {
    if (!cardEl) return;

    // 徽章
    cardEl.querySelector('.guide-card__badge').textContent =
      '步骤 ' + (currentStepIndex + 1) + '/' + totalSteps;

    // 标题 & 描述
    cardEl.querySelector('.guide-card__title').textContent = step.title || '';
    cardEl.querySelector('.guide-card__desc').textContent = step.desc || '';

    // 进度点
    var dotsHtml = '';
    for (var i = 0; i < totalSteps; i++) {
      var cls = 'guide-card__dot';
      if (i === currentStepIndex) cls += ' guide-card__dot--active';
      else if (i < currentStepIndex) cls += ' guide-card__dot--completed';
      dotsHtml += '<span class="' + cls + '"></span>';
    }
    cardEl.querySelector('.guide-card__dots').innerHTML = dotsHtml;

    // 按钮
    var btn = cardEl.querySelector('.guide-card__btn--primary');
    if (step.action && step.action.label) {
      btn.textContent = step.action.label;
    } else {
      btn.textContent = (currentStepIndex < totalSteps - 1) ? '下一步' : '完成引导';
    }

    // 跳过按钮
    var skipBtn = cardEl.querySelector('.guide-card__btn--skip');
    skipBtn.style.display = (currentStepIndex < totalSteps - 1) ? '' : 'none';

    // 定位
    if (step.position === 'center' || !step.spotlight) {
      cardEl.classList.add('guide-card--centered');
    } else {
      // 先移除居中 class，再测量定位（避免居中 transform 影响高度测量）
      cardEl.classList.remove('guide-card--centered');
      cardEl.style.top = 'auto';
      cardEl.style.left = 'auto';
      var target = document.querySelector(step.spotlight);
      if (target) {
        positionCard(step.position, target);
      }
    }
  }

  function positionCard(preferred, target) {
    if (!cardEl) return;
    var rect = target.getBoundingClientRect();
    var gap = 12;

    // 先测量卡片实际尺寸
    cardEl.style.visibility = 'hidden';
    cardEl.style.top = '-9999px';
    cardEl.style.left = '-9999px';
    cardEl.style.width = '';
    var cardW = cardEl.offsetWidth || 300;
    var cardH = cardEl.offsetHeight || 180;
    cardEl.style.visibility = '';

    var vp = getViewport();

    // 卡片宽度不能超过视口
    if (cardW > vp.w - 20) {
      cardW = vp.w - 20;
      cardEl.style.width = cardW + 'px';
      cardEl.style.visibility = 'hidden';
      cardEl.style.top = '-9999px';
      cardEl.style.left = '-9999px';
      cardH = cardEl.offsetHeight || 180;
      cardEl.style.visibility = '';
    }

    // 目标元素的外扩区域（卡片不能与此重叠）
    var hl = {
      top: rect.top - 6,
      left: rect.left - 6,
      right: rect.right + 6,
      bottom: rect.bottom + 6,
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2
    };

    // 计算四个方向的可用空间
    var spaceRight = vp.w - hl.right;   // 右侧可用宽度
    var spaceBottom = vp.h - hl.bottom; // 下方可用高度
    var spaceLeft = hl.left;            // 左侧可用宽度
    var spaceTop = hl.top;              // 上方可用高度

    // 为每个候选位置打分：空间越大分数越高，能完整显示加分
    var cands = [];

    // 右侧
    if (spaceRight >= cardW + gap) {
      cands.push({
        score: spaceRight,
        top: Math.max(10, Math.min(hl.cy - cardH / 2, vp.h - cardH - 10)),
        left: hl.right + gap
      });
    }

    // 下方
    if (spaceBottom >= cardH + gap) {
      cands.push({
        score: spaceBottom,
        top: hl.bottom + gap,
        left: Math.max(10, Math.min(hl.cx - cardW / 2, vp.w - cardW - 10))
      });
    }

    // 左侧
    if (spaceLeft >= cardW + gap) {
      cands.push({
        score: spaceLeft,
        top: Math.max(10, Math.min(hl.cy - cardH / 2, vp.h - cardH - 10)),
        left: hl.left - cardW - gap
      });
    }

    // 上方
    if (spaceTop >= cardH + gap) {
      cands.push({
        score: spaceTop,
        top: hl.top - cardH - gap,
        left: Math.max(10, Math.min(hl.cx - cardW / 2, vp.w - cardW - 10))
      });
    }

    // 按可用空间从大到小排序，优先选择空间最充裕的方向
    cands.sort(function (a, b) { return b.score - a.score; });

    // 尝试每个候选位置
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      c.left = Math.max(10, Math.min(c.left, vp.w - cardW - 10));
      c.top = Math.max(10, Math.min(c.top, vp.h - cardH - 10));

      var cardRect = { left: c.left, top: c.top, width: cardW, height: cardH };
      if (!overlaps(cardRect, hl)) {
        cardEl.style.top = c.top + 'px';
        cardEl.style.left = c.left + 'px';
        cardEl.style.bottom = 'auto';
        cardEl.style.right = 'auto';
        return;
      }
    }

    // 没有理想位置：选择空间最大的方向，允许部分在视口内
    // 优先顺序：下 > 右 > 上 > 左（根据 preferred 调整）
    var fallbackOrder = [];
    if (preferred === 'bottom') fallbackOrder = ['bottom', 'right', 'top', 'left'];
    else if (preferred === 'right') fallbackOrder = ['right', 'bottom', 'left', 'top'];
    else if (preferred === 'top') fallbackOrder = ['top', 'right', 'bottom', 'left'];
    else if (preferred === 'left') fallbackOrder = ['left', 'bottom', 'top', 'right'];
    else fallbackOrder = ['bottom', 'right', 'top', 'left'];

    for (var k = 0; k < fallbackOrder.length; k++) {
      var dir = fallbackOrder[k];
      var fc = null;
      if (dir === 'bottom') {
        fc = { top: Math.min(hl.bottom + gap, vp.h - cardH - 10), left: Math.max(10, Math.min(hl.cx - cardW / 2, vp.w - cardW - 10)) };
      } else if (dir === 'right') {
        fc = { top: Math.max(10, Math.min(hl.cy - cardH / 2, vp.h - cardH - 10)), left: Math.min(hl.right + gap, vp.w - cardW - 10) };
      } else if (dir === 'top') {
        fc = { top: Math.max(10, hl.top - cardH - gap), left: Math.max(10, Math.min(hl.cx - cardW / 2, vp.w - cardW - 10)) };
      } else if (dir === 'left') {
        fc = { top: Math.max(10, Math.min(hl.cy - cardH / 2, vp.h - cardH - 10)), left: Math.max(10, hl.left - cardW - gap) };
      }
      if (fc && fc.top >= 10 && fc.left >= 10) {
        cardEl.style.top = fc.top + 'px';
        cardEl.style.left = fc.left + 'px';
        cardEl.style.bottom = 'auto';
        cardEl.style.right = 'auto';
        return;
      }
    }

    // 最终 fallback：顶部居中
    cardEl.style.top = '10px';
    cardEl.style.left = Math.max(10, (vp.w - cardW) / 2) + 'px';
    cardEl.style.bottom = 'auto';
    cardEl.style.right = 'auto';
  }

  // ============ Tooltip 轻量气泡 ============

  function showTooltip(config) {
    if (state === GUIDE_STATE.running) return; // 引导进行中不显示 tip

    var now = Date.now();
    if (now - lastTipTime < TIP_COOLDOWN) {
      // 排队等待
      tipQueue.push(config);
      return;
    }

    lastTipTime = now;
    _renderTooltip(config);
  }

  function _renderTooltip(config) {
    destroyTooltip();
    state = GUIDE_STATE.tooltip;

    var el = document.createElement('div');
    el.className = 'guide-tooltip';
    el.innerHTML =
      '<div class="guide-tooltip__body">' +
        '<span class="guide-tooltip__text"></span>' +
        '<button class="guide-tooltip__close">知道了</button>' +
      '</div>' +
      '<div class="guide-tooltip__arrow"></div>';

    el.querySelector('.guide-tooltip__text').textContent = config.content;

    overlayEl.appendChild(el);
    tooltipEl = el;

    // 关闭按钮
    el.querySelector('.guide-tooltip__close').addEventListener('click', function () {
      dismissTip(config.id);
    });

    // 定位
    var anchor = config.anchor || config.trigger.target;
    var target = document.querySelector(anchor);
    if (target) {
      positionTooltip(config.position || 'bottom', target, el);
    } else {
      // 无锚点：屏幕底部居中
      var vp = getViewport();
      el.style.top = (vp.h - 80) + 'px';
      el.style.left = (vp.w / 2 - 120) + 'px';
    }

    // 设置箭头
    var arrow = el.querySelector('.guide-tooltip__arrow');
    var pos = config.position || 'bottom';
    if (pos === 'bottom') arrow.className = 'guide-tooltip__arrow guide-tooltip__arrow--bottom';
    else if (pos === 'top') arrow.className = 'guide-tooltip__arrow guide-tooltip__arrow--top';
    else if (pos === 'left') arrow.className = 'guide-tooltip__arrow guide-tooltip__arrow--left';
    else if (pos === 'right') arrow.className = 'guide-tooltip__arrow guide-tooltip__arrow--right';

    // 自动隐藏
    if (config.autoHide) {
      cleanup = setTimeout(function () {
        dismissTip(config.id);
      }, config.autoHide);
    }
  }

  function positionTooltip(preferred, target, el) {
    var rect = target.getBoundingClientRect();
    var tipW = 240, tipH = 60, gap = 14;
    var vp = getViewport();

    var cands = [];
    if (preferred === 'bottom') {
      cands = [
        { top: rect.bottom + gap, left: rect.left + rect.width / 2 - tipW / 2 },
        { top: rect.top - tipH - gap, left: rect.left + rect.width / 2 - tipW / 2 },
        { top: rect.bottom + gap, left: vp.w - tipW - 10 },
        { top: rect.bottom + gap, left: 10 }
      ];
    } else if (preferred === 'top') {
      cands = [
        { top: rect.top - tipH - gap, left: rect.left + rect.width / 2 - tipW / 2 },
        { top: rect.bottom + gap, left: rect.left + rect.width / 2 - tipW / 2 },
        { top: rect.top - tipH - gap, left: vp.w - tipW - 10 },
        { top: rect.top - tipH - gap, left: 10 }
      ];
    } else {
      cands = [
        { top: rect.bottom + gap, left: rect.left + rect.width / 2 - tipW / 2 },
        { top: rect.top - tipH - gap, left: rect.left + rect.width / 2 - tipW / 2 }
      ];
    }

    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      c.left = Math.max(10, Math.min(c.left, vp.w - tipW - 10));
      c.top = Math.max(10, Math.min(c.top, vp.h - tipH - 10));
      el.style.top = c.top + 'px';
      el.style.left = c.left + 'px';
      el.style.bottom = 'auto';
      el.style.right = 'auto';
      return;
    }

    el.style.top = '20px';
    el.style.left = (vp.w - tipW - 20) + 'px';
  }

  function dismissTip(tipId) {
    if (tipId) {
      localStorage.setItem(TIP_PREFIX + tipId, 'done');
    }
    destroyTooltip();
    state = GUIDE_STATE.idle;

    // 处理排队中的 tip
    if (tipQueue.length > 0) {
      var next = tipQueue.shift();
      setTimeout(function () { showTooltip(next); }, 500);
    }

    // 重启触发器监听
    startTipTriggers();
  }

  function destroyTooltip() {
    if (cleanup) { clearTimeout(cleanup); cleanup = null; }
    if (tooltipEl) {
      tooltipEl.classList.add('guide-tooltip--hiding');
      setTimeout(function () {
        if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; }
      }, 200);
    }
  }

  // ============ 触发器系统 ============

  var tipTriggers = {
    events: [],
    intervals: [],
    mutationObservers: []
  };

  function startTipTriggers() {
    stopTipTriggers();

    for (var i = 0; i < TIPS.length; i++) {
      var tip = TIPS[i];
      var trigger = tip.trigger;

      if (!trigger) continue;

      // 已完成的跳过
      if (localStorage.getItem(TIP_PREFIX + tip.id) === 'done') continue;

      if (trigger.type === 'event') {
        bindEventTrigger(tip, trigger);
      } else if (trigger.type === 'interval') {
        bindIntervalTrigger(tip, trigger);
      } else if (trigger.type === 'custom') {
        // custom 类型由外部钩子主动触发，这里用轮询检查
        bindCustomTrigger(tip, trigger);
      }
    }
  }

  function stopTipTriggers() {
    // 移除事件监听（通过标记失效）
    tipTriggers.events = [];

    // 清除定时器
    for (var i = 0; i < tipTriggers.intervals.length; i++) {
      clearInterval(tipTriggers.intervals[i]);
    }
    tipTriggers.intervals = [];

    // 断开 MutationObserver
    for (var j = 0; j < tipTriggers.mutationObservers.length; j++) {
      tipTriggers.mutationObservers[j].disconnect();
    }
    tipTriggers.mutationObservers = [];
  }

  function bindEventTrigger(tip, trigger) {
    var handler = function (e) {
      if (state !== GUIDE_STATE.idle) return;
      if (trigger.target && !e.target.closest(trigger.target)) return;
      if (trigger.condition && !trigger.condition()) return;
      showTooltip(tip);
    };

    document.addEventListener(trigger.event, handler, true);
    tipTriggers.events.push({ event: trigger.event, handler: handler });
  }

  function bindIntervalTrigger(tip, trigger) {
    var intervalId = setInterval(function () {
      if (state !== GUIDE_STATE.idle) return;
      if (trigger.condition && !trigger.condition()) return;
      showTooltip(tip);
      clearInterval(intervalId);
    }, trigger.interval || 30000);
    tipTriggers.intervals.push(intervalId);
  }

  function bindCustomTrigger(tip, trigger) {
    // custom 类型：每 5 秒检查一次条件
    var intervalId = setInterval(function () {
      if (state !== GUIDE_STATE.idle) return;
      if (!trigger.check || !trigger.check()) return;
      showTooltip(tip);
      clearInterval(intervalId);
    }, 5000);
    tipTriggers.intervals.push(intervalId);
  }

  // ============ 引导流程控制 ============

  function createOverlay() {
    if (!overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.id = 'guide-overlay';
      document.body.appendChild(overlayEl);
    }
    // 始终确保 spotlight 和 card 存在（onLoad 可能已创建 overlay）
    if (!spotlightEl) spotlightEl = createSpotlight();
    if (!cardEl) cardEl = createCard();
  }

  function destroyOverlay() {
    stopTipTriggers();
    if (phaseCleanup) { phaseCleanup(); phaseCleanup = null; }
    if (cleanup) { clearTimeout(cleanup); cleanup = null; }
    unblockUnderlyingInteraction();
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
    spotlightEl = null;
    cardEl = null;
    tooltipEl = null;
    state = GUIDE_STATE.idle;
  }

  function findTour(tourId) {
    for (var i = 0; i < TOURS.length; i++) {
      if (TOURS[i].id === tourId) return TOURS[i];
    }
    return TOURS[0];
  }

  function startTour(tourId) {
    var tour = tourId ? findTour(tourId) : TOURS[0];
    if (!tour) return;

    currentTour = tour;
    currentStepIndex = 0;
    currentPhaseIndex = 0;
    state = GUIDE_STATE.running;

    createOverlay();
    renderStep();
    blockUnderlyingInteraction();
    // 引导开始时停止史迪奇随机移动
    if (window.stopPetMovement) window.stopPetMovement();

    // 便签引导：根据卡片内容自适应窗口大小
    if (tourId === 'sticky-tour' && document.body.classList.contains('sticky-mode')) {
      fitStickyWindowToCard();
    }
  }

  // 便签模式下根据引导卡片内容自适应窗口高度（宽度保持默认）
  function fitStickyWindowToCard() {
    if (!cardEl || !window.electronAPI || !window.electronAPI.resizeWindow) return;

    // 双 rAF 确保卡片已完成渲染和布局
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var cardHeight = cardEl.offsetHeight || 200;
        var header = document.querySelector('header');
        var headerHeight = header ? header.offsetHeight : 40;
        // 高度 = header + 卡片 + 留白，宽度保持便签模式默认宽度
        var targetHeight = headerHeight + cardHeight + 40;
        targetHeight = Math.max(200, Math.min(800, targetHeight));
        var fixedWidth = window.stickyModeWidth || 480;
        window.electronAPI.resizeWindow(fixedWidth, Math.round(targetHeight), true);
      });
    });
  }

  function renderStep() {
    if (!currentTour || !cardEl) return;

    // 检查当前模式是否允许渲染该引导
    if (!canRenderTour(currentTour.id)) {
      // 模式不匹配，隐藏 overlay
      if (overlayEl) overlayEl.style.display = 'none';
      return;
    }

    if (phaseCleanup) { phaseCleanup(); phaseCleanup = null; }

    // 确保引导层可见（上一步可能隐藏了）
    if (overlayEl) overlayEl.style.display = '';

    var step = currentTour.steps[currentStepIndex];
    if (!step) { complete(); return; }

    renderCard(step, currentTour.steps.length);

    if (step.spotlight) {
      var target = document.querySelector(step.spotlight);
      if (target) {
        showSpotlight(target, false); // false = 步骤切换时瞬间定位，不动画
        setSpotlightPulse(!!step.wait);
      }
    } else {
      hideSpotlight();
    }

    // 绑定交互等待
    if (step.wait) {
      bindStepWait(step);
    }
  }

  function bindStepWait(step) {
    var wait = step.wait;
    var target = document.querySelector(wait.target);
    if (!target) return;

    phaseCleanup = function () { /* 由具体绑定覆盖 */ };

    switch (wait.type) {
      case 'click':
        var onClick = function () {
          target.removeEventListener('click', onClick);
          onStepActionComplete(step);
        };
        target.addEventListener('click', onClick);
        phaseCleanup = function () { target.removeEventListener('click', onClick); };
        break;

      case 'enter-with-value':
        // 记录当前列表项数量，Enter 后轮询检测新增
        // 注意：使用 capture 阶段 + 提前捕获 value，因为 integration.js 的 keydown 会先清空输入
        var listEl2 = document.getElementById('todoList');
        var initialCount = listEl2 ? listEl2.querySelectorAll('li').length : 0;
        var pollTimer = null;
        var triggered = false;

        var onEnter3 = function (e) {
          if (e.key !== 'Enter' || triggered) return;
          // 在 capture 阶段，input 还未被清空，此时捕获值
          var val = e.target.value ? e.target.value.trim() : '';
          if (val.length === 0) return;
          triggered = true;
          target.removeEventListener('keydown', onEnter3, true);
          // 轮询等待列表项数量增加
          var list = document.getElementById('todoList');
          if (list) {
            pollTimer = setInterval(function () {
              var currentCount = list.querySelectorAll('li').length;
              if (currentCount > initialCount) {
                clearInterval(pollTimer);
                pollTimer = null;
                onStepActionComplete(step);
              }
            }, 100);
            // 超时保护：5 秒后停止轮询
            var timeoutTimer = setTimeout(function () {
              if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
            }, 5000);
            phaseCleanup = function () {
              clearInterval(pollTimer); pollTimer = null;
              clearTimeout(timeoutTimer);
            };
          }
        };
        // 使用 capture=true 确保在 integration.js 的 bubble 阶段监听器之前执行
        target.addEventListener('keydown', onEnter3, true);
        phaseCleanup = function () { target.removeEventListener('keydown', onEnter3, true); };
        break;

      case 'dblclick-then-modal-close':
        // 组合交互：先等待双击目标，然后等待弹窗关闭
        // overlay 有 pointer-events: none，点击可穿透，无需提前隐藏
        var onDblClick = function () {
          target.removeEventListener('dblclick', onDblClick);
          // 双击发生后隐藏引导层，让用户可以看到弹窗内容
          if (overlayEl) overlayEl.style.display = 'none';
          // 阶段2：等待弹窗关闭
          waitForModalClose(wait.modalTarget, step);
        };
        target.addEventListener('dblclick', onDblClick);
        phaseCleanup = function () {
          target.removeEventListener('dblclick', onDblClick);
          if (overlayEl) overlayEl.style.display = '';
        };
        break;

      case 'modal-close-with-tooltip':
        // 弹窗已打开时，隐藏卡片避免遮挡，显示轻量提示气泡
        // 弹窗关闭后自动进入下一步
        var modalEl = document.querySelector(wait.target);
        if (modalEl) {
          // 弹窗已存在，隐藏卡片和高亮框（不隐藏 overlay，否则 tooltip 也不可见）
          if (cardEl) cardEl.style.visibility = 'hidden';
          hideSpotlight();
          // 显示提示气泡（直接渲染，绕过 showTooltip 的 running 状态检查）
          if (wait.tooltip) {
            _renderTooltip({
              id: 'guide-step-tooltip',
              content: wait.tooltip,
              position: 'top',
              anchor: wait.target,
              dismissible: false,
              autoHide: null
            });
          }
          // 监听弹窗关闭
          var modalParent = modalEl.parentNode;
          var modalObs = new MutationObserver(function (muts) {
            for (var i = 0; i < muts.length; i++) {
              var removed = muts[i].removedNodes;
              for (var j = 0; j < removed.length; j++) {
                if (removed[j] === modalEl || (removed[j] && removed[j].contains && removed[j].contains(modalEl))) {
                  modalObs.disconnect();
                  dismissTip('guide-step-tooltip');
                  if (cardEl) cardEl.style.visibility = '';
                  onStepActionComplete(step);
                  return;
                }
              }
            }
          });
          modalObs.observe(modalParent, { childList: true, subtree: true });
          phaseCleanup = function () {
            modalObs.disconnect();
            dismissTip('guide-step-tooltip');
            if (cardEl) cardEl.style.visibility = '';
          };
        } else {
          // 弹窗不存在，等待其出现后再监听关闭
          var appearObs = new MutationObserver(function () {
            var m = document.querySelector(wait.target);
            if (m) {
              appearObs.disconnect();
              // 弹窗出现了，隐藏卡片和高亮框
              if (cardEl) cardEl.style.visibility = 'hidden';
              hideSpotlight();
              // 显示提示气泡
              if (wait.tooltip) {
                _renderTooltip({
                  id: 'guide-step-tooltip',
                  content: wait.tooltip,
                  position: 'top',
                  anchor: wait.target,
                  dismissible: false,
                  autoHide: null
                });
              }
              // 监听关闭
              var mp = m.parentNode;
              var closeObs = new MutationObserver(function (muts) {
                for (var i = 0; i < muts.length; i++) {
                  var removed = muts[i].removedNodes;
                  for (var j = 0; j < removed.length; j++) {
                    if (removed[j] === m || (removed[j] && removed[j].contains && removed[j].contains(m))) {
                      closeObs.disconnect();
                      dismissTip('guide-step-tooltip');
                      if (cardEl) cardEl.style.visibility = '';
                      onStepActionComplete(step);
                      return;
                    }
                  }
                }
              });
              closeObs.observe(mp, { childList: true, subtree: true });
              phaseCleanup = function () {
                closeObs.disconnect();
                dismissTip('guide-step-tooltip');
                if (cardEl) cardEl.style.visibility = '';
              };
            }
          });
          appearObs.observe(document.body, { childList: true, subtree: true });
          phaseCleanup = function () {
            appearObs.disconnect();
            dismissTip('guide-step-tooltip');
            if (cardEl) cardEl.style.visibility = '';
          };
        }
        break;

    }
  }

  // 等待弹窗关闭的辅助函数
  function waitForModalClose(modalTarget, stepWait) {
    var modalEl = document.querySelector(modalTarget);
    if (modalEl) {
      // 弹窗已存在，监听关闭
      var modalParent = modalEl.parentNode;
      var modalObs = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var removed = muts[i].removedNodes;
          for (var j = 0; j < removed.length; j++) {
            if (removed[j] === modalEl || (removed[j] && removed[j].contains && removed[j].contains(modalEl))) {
              modalObs.disconnect();
              if (overlayEl) overlayEl.style.display = '';
              onStepActionComplete(stepWait);
              return;
            }
          }
        }
      });
      modalObs.observe(modalParent, { childList: true, subtree: true });
      phaseCleanup = function () { modalObs.disconnect(); if (overlayEl) overlayEl.style.display = ''; };
    } else {
      // 弹窗不存在，等待出现后再监听关闭
      var appearObs = new MutationObserver(function () {
        var m = document.querySelector(modalTarget);
        if (m) {
          appearObs.disconnect();
          var mp = m.parentNode;
          var closeObs = new MutationObserver(function (muts) {
            for (var i = 0; i < muts.length; i++) {
              var removed = muts[i].removedNodes;
              for (var j = 0; j < removed.length; j++) {
                if (removed[j] === m || (removed[j] && removed[j].contains && removed[j].contains(m))) {
                  closeObs.disconnect();
                  if (overlayEl) overlayEl.style.display = '';
                  onStepActionComplete(stepWait);
                  return;
                }
              }
            }
          });
          closeObs.observe(mp, { childList: true, subtree: true });
          phaseCleanup = function () { closeObs.disconnect(); if (overlayEl) overlayEl.style.display = ''; };
        }
      });
      appearObs.observe(document.body, { childList: true, subtree: true });
      phaseCleanup = function () { appearObs.disconnect(); if (overlayEl) overlayEl.style.display = ''; };
    }
  }

  function onStepActionComplete(step) {
    setSpotlightSuccess();
    // 延迟进入下一步
    setTimeout(function () {
      next();
    }, 600);
  }

  function next() {
    if (!currentTour) return;
    currentStepIndex++;
    saveProgress();
    if (currentStepIndex >= currentTour.steps.length) {
      complete();
    } else {
      renderStep();
    }
  }

  function skip() {
    complete();
  }

  function complete() {
    var completedTourId = currentTour ? currentTour.id : null;
    if (currentTour) {
      localStorage.setItem(TOUR_STORAGE_KEY, currentTour.version || '1');
    }
    localStorage.removeItem(GUIDE_PROGRESS_KEY); // 清除进度
    destroyOverlay();
    currentTour = null;
    currentStepIndex = 0;
    // 引导结束后恢复史迪奇随机移动
    if (window.startPetMovement) window.startPetMovement();

    // 便签引导结束后，恢复窗口到默认大小（宽度 480，高度自适应内容）
    if (completedTourId === 'sticky-tour' && document.body.classList.contains('sticky-mode')) {
      resetStickyWindowSize();
    }
  }

  // 便签模式下恢复窗口到默认宽度，高度根据内容自适应
  function resetStickyWindowSize() {
    if (!window.electronAPI || !window.electronAPI.resizeWindow) return;

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var mainEl = document.querySelector('main');
        var mainHeight = mainEl ? mainEl.scrollHeight : 0;
        var header = document.querySelector('header');
        var headerHeight = header ? header.offsetHeight : 40;
        var contentHeight = headerHeight + mainHeight + 8; // STICKY_BREATH_SPACE
        var stickyMaxH = getStickyMaxHeight();
        var targetHeight = Math.max(80, Math.min(stickyMaxH, contentHeight));
        var fixedWidth = window.stickyModeWidth || 480;
        window.electronAPI.resizeWindow(fixedWidth, Math.round(targetHeight), true);
      });
    });
  }

  function stop() {
    complete();
  }

  // ============ 进度保存与恢复 ============

  function saveProgress() {
    if (currentTour) {
      localStorage.setItem(GUIDE_PROGRESS_KEY, JSON.stringify({
        tourId: currentTour.id,
        stepIndex: currentStepIndex,
        version: currentTour.version || '1'
      }));
    }
  }

  function loadProgress() {
    try {
      var data = localStorage.getItem(GUIDE_PROGRESS_KEY);
      if (!data) return null;
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  }

  function clearProgress() {
    localStorage.removeItem(GUIDE_PROGRESS_KEY);
  }

  // 恢复上次的引导进度
  function resumeProgress() {
    var progress = loadProgress();
    if (!progress) return false;
    // 检查版本是否匹配
    var tour = findTour(progress.tourId);
    if (!tour || (tour.version || '1') !== progress.version) {
      clearProgress();
      return false;
    }
    // 检查是否已完成
    if (localStorage.getItem(TOUR_STORAGE_KEY) === progress.version) {
      clearProgress();
      return false;
    }
    // 恢复引导
    currentTour = tour;
    currentStepIndex = progress.stepIndex;
    state = GUIDE_STATE.running;
    createOverlay();
    renderStep();
    return true;
  }

  // ============ 引导时禁用底层交互 ============

  function blockUnderlyingInteraction() {
    // 引导运行时，拦截非引导卡片的点击
    document.addEventListener('click', handleBlockedClick, true);
  }

  function unblockUnderlyingInteraction() {
    document.removeEventListener('click', handleBlockedClick, true);
  }

  function handleBlockedClick(e) {
    if (state !== GUIDE_STATE.running) return;
    // 允许点击引导卡片
    if (cardEl && cardEl.contains(e.target)) return;
    // 允许点击 tooltip
    if (tooltipEl && tooltipEl.contains(e.target)) return;
    // 允许点击 overlay 内的元素（tooltip 等）
    if (overlayEl && overlayEl.contains(e.target)) return;
    // 允许点击当前步骤的目标元素
    var step = currentTour && currentTour.steps[currentStepIndex];
    if (step && step.spotlight) {
      var target = document.querySelector(step.spotlight);
      if (target && target.contains(e.target)) return;
    }
    // 允许点击 wait.target 元素
    if (step && step.wait && step.wait.target) {
      var waitTarget = document.querySelector(step.wait.target);
      if (waitTarget && waitTarget.contains(e.target)) return;
    }
    // 允许点击当前步骤明确需要的弹窗（仅允许 wait.modalTarget 或 spotlight 相关的弹窗）
    if (step && step.wait && step.wait.modalTarget) {
      var modalEl = document.querySelector(step.wait.modalTarget);
      if (modalEl && modalEl.contains(e.target)) return;
    }
    // 便签模式下允许点击便签相关 UI
    if (document.body.classList.contains('sticky-mode')) {
      var stickyElements = document.querySelectorAll('#stickyAddToggleBtn, #stickyCollapseBtn, #hideWindowBtn, #stickyInput, #stickyInputArea, .sticky-progress');
      for (var j = 0; j < stickyElements.length; j++) {
        if (stickyElements[j].contains(e.target)) return;
      }
    }
    // 阻止其他所有点击
    e.preventDefault();
    e.stopPropagation();
  }

  // ============ 自动启动 ============

  function autoStart() {
    var tour = TOURS[0];
    if (!tour || !tour.autoStart) return;
    if (localStorage.getItem(TOUR_STORAGE_KEY) === (tour.version || '1')) return;

    // 延迟启动，等页面渲染完成
    setTimeout(function () {
      if (state === GUIDE_STATE.idle) {
        // 优先恢复上次的进度
        if (!resumeProgress()) {
          startTour(tour.id);
        }
      }
    }, 600);
  }

  // ============ 全局 API ============

  window.Guide = {
    // 引导控制
    start: function (tourId) { startTour(tourId); },
    stop: function () { stop(); },
    next: function () { next(); },
    skip: function () { skip(); },

    // 重置
    reset: function (scope) {
      if (scope === 'tips') {
        // 只重置 tips
        for (var i = 0; i < TIPS.length; i++) {
          localStorage.removeItem(TIP_PREFIX + TIPS[i].id);
        }
      } else if (scope === 'tour') {
        localStorage.removeItem(TOUR_STORAGE_KEY);
      } else {
        // 全部重置
        localStorage.removeItem(TOUR_STORAGE_KEY);
        for (var j = 0; j < TIPS.length; j++) {
          localStorage.removeItem(TIP_PREFIX + TIPS[j].id);
        }
      }
    },
    resetTour: function (tourId) {
      localStorage.removeItem(TOUR_STORAGE_KEY);
      localStorage.removeItem(GUIDE_PROGRESS_KEY);
      localStorage.removeItem(STICKY_TOUR_SHOWN_KEY);
    },
    resetTip: function (tipId) {
      localStorage.removeItem(TIP_PREFIX + tipId);
    },

    // 状态查询
    isActive: function () { return state !== GUIDE_STATE.idle; },
    getCompleted: function () {
      var completed = [];
      if (localStorage.getItem(TOUR_STORAGE_KEY)) completed.push('tour');
      for (var i = 0; i < TIPS.length; i++) {
        if (localStorage.getItem(TIP_PREFIX + TIPS[i].id) === 'done') {
          completed.push(TIPS[i].id);
        }
      }
      return completed;
    },

    // 手动控制
    showTooltip: function (target, content, options) {
      options = options || {};
      var config = {
        id: 'manual-' + Date.now(),
        content: content,
        position: options.position || 'bottom',
        anchor: typeof target === 'string' ? target : null,
        dismissible: true,
        autoHide: options.autoHide || 5000
      };
      showTooltip(config);
    },
    hideTooltip: function () { dismissTip(); },

    // 检查并显示 custom 类型的提示（供外部钩子调用）
    checkCustomTips: function () {
      for (var i = 0; i < TIPS.length; i++) {
        var tip = TIPS[i];
        if (tip.trigger && tip.trigger.type === 'custom' && tip.trigger.check) {
          if (tip.trigger.check()) {
            showTooltip(tip);
            break; // 一次只显示一个
          }
        }
      }
    },

    // 内部启动 tip 触发器
    _startTipTriggers: startTipTriggers
  };

  // ============ 初始化 ============

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onLoad);
    } else {
      onLoad();
    }
  }

  function onLoad() {
    // 创建 overlay 容器（用于 tooltip 显示）
    overlayEl = document.createElement('div');
    overlayEl.id = 'guide-overlay';
    overlayEl.style.pointerEvents = 'none';
    document.body.appendChild(overlayEl);

    // 启动引导
    autoStart();

    // 启动 tip 触发器
    startTipTriggers();

    // 监听便签模式切换，进入便签模式时显示专属引导
    watchStickyMode();
  }

  // 便签模式引导（与普通引导完全独立）
  var STICKY_TOUR_SHOWN_KEY = 'guide_sticky_tour_shown';

  // 检查当前模式是否允许渲染引导
  function canRenderTour(tourId) {
    var isSticky = document.body.classList.contains('sticky-mode');
    if (tourId === 'sticky-tour') {
      // 便签引导只在便签模式显示
      return isSticky;
    } else {
      // 普通引导只在非便签模式显示
      return !isSticky;
    }
  }

  // 监听便签模式切换
  function watchStickyMode() {
    var observer = new MutationObserver(function (muts) {
      var isSticky = document.body.classList.contains('sticky-mode');

      if (isSticky) {
        // 进入便签模式
        if (currentTour && currentTour.id !== 'sticky-tour') {
          // 普通引导正在运行，隐藏它
          if (overlayEl) overlayEl.style.display = 'none';
        } else if (!currentTour && localStorage.getItem(STICKY_TOUR_SHOWN_KEY) !== '1') {
          // 首次进入便签模式，显示便签引导
          localStorage.setItem(STICKY_TOUR_SHOWN_KEY, '1');
          // 延迟启动引导，让 adjustStickyWindowHeight 先完成
          // startTour 内部会根据卡片内容自适应调整窗口大小
          setTimeout(function () {
            startTour('sticky-tour');
          }, 100);
        }
      } else {
        // 退出便签模式
        if (currentTour && currentTour.id === 'sticky-tour') {
          // 完成便签引导
          complete();
        } else if (overlayEl) {
          // 恢复普通引导显示
          overlayEl.style.display = '';
        }
      }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  // 全局事件：Esc 跳过引导
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state === GUIDE_STATE.running) {
      skip();
    }
  });

  // resize 时重新定位
  window.addEventListener('resize', function () {
    if (state === GUIDE_STATE.running && currentTour) {
      var step = currentTour.steps[currentStepIndex];
      if (step && step.spotlight) {
        var target = document.querySelector(step.spotlight);
        if (target) {
          showSpotlight(target, false); // resize 时也瞬间定位
          if (!step.position || step.position !== 'center') {
            positionCard(step.position, target);
          }
        }
      }
    }
  });

  // 启动
  init();

})();
