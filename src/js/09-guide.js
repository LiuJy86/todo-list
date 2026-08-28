/**
 * 统一引导系统 (v2.24.0)
 *
 * 声明式配置，新增引导步骤只需加配置项。
 * 仅保留「说明卡片」引导，移除气泡提醒。
 *
 * 全局 API: window.Guide = { start, stop, next, skip, reset, ... }
 */
(function () {
  'use strict';

  // ============ 常量 ============
  var TOUR_STORAGE_KEY = 'guide_tour_done';
  var GUIDE_PROGRESS_KEY = 'guide_tour_progress';
  var CURRENT_TOUR_VERSION = '1';

  var GUIDE_STATE = {
    idle: 'idle',
    running: 'running'
  };

  // ============ 全局状态 ============
  var state = GUIDE_STATE.idle;
  var currentTour = null;
  var currentStepIndex = 0;
  var overlayEl = null;
  var spotlightEl = null;
  var cardEl = null;
  var phaseCleanup = null;

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
      autoStart: false,
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
    if (animate === false) {
      spotlightEl.style.transition = 'none';
      void spotlightEl.offsetHeight;
    }
    spotlightEl.style.top = (rect.top - 6) + 'px';
    spotlightEl.style.left = (rect.left - 6) + 'px';
    spotlightEl.style.width = (rect.width + 12) + 'px';
    spotlightEl.style.height = (rect.height + 12) + 'px';
    spotlightEl.style.display = 'block';
    if (animate === false) {
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

    cardEl.querySelector('.guide-card__badge').textContent =
      '步骤 ' + (currentStepIndex + 1) + '/' + totalSteps;

    cardEl.querySelector('.guide-card__title').textContent = step.title || '';
    cardEl.querySelector('.guide-card__desc').textContent = step.desc || '';

    var dotsHtml = '';
    for (var i = 0; i < totalSteps; i++) {
      var cls = 'guide-card__dot';
      if (i === currentStepIndex) cls += ' guide-card__dot--active';
      else if (i < currentStepIndex) cls += ' guide-card__dot--completed';
      dotsHtml += '<span class="' + cls + '"></span>';
    }
    cardEl.querySelector('.guide-card__dots').innerHTML = dotsHtml;

    var btn = cardEl.querySelector('.guide-card__btn--primary');
    if (step.action && step.action.label) {
      btn.textContent = step.action.label;
    } else {
      btn.textContent = (currentStepIndex < totalSteps - 1) ? '下一步' : '完成引导';
    }

    var skipBtn = cardEl.querySelector('.guide-card__btn--skip');
    skipBtn.style.display = (currentStepIndex < totalSteps - 1) ? '' : 'none';

    if (step.position === 'center' || !step.spotlight) {
      cardEl.classList.add('guide-card--centered');
    } else {
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

    cardEl.style.visibility = 'hidden';
    cardEl.style.top = '-9999px';
    cardEl.style.left = '-9999px';
    cardEl.style.width = '';
    var cardW = cardEl.offsetWidth || 300;
    var cardH = cardEl.offsetHeight || 180;
    cardEl.style.visibility = '';

    var vp = getViewport();

    if (cardW > vp.w - 20) {
      cardW = vp.w - 20;
      cardEl.style.width = cardW + 'px';
      cardEl.style.visibility = 'hidden';
      cardEl.style.top = '-9999px';
      cardEl.style.left = '-9999px';
      cardH = cardEl.offsetHeight || 180;
      cardEl.style.visibility = '';
    }

    var hl = {
      top: rect.top - 6,
      left: rect.left - 6,
      right: rect.right + 6,
      bottom: rect.bottom + 6,
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2
    };

    var spaceRight = vp.w - hl.right;
    var spaceBottom = vp.h - hl.bottom;
    var spaceLeft = hl.left;
    var spaceTop = hl.top;

    var cands = [];

    if (spaceRight >= cardW + gap) {
      cands.push({
        score: spaceRight,
        top: Math.max(10, Math.min(hl.cy - cardH / 2, vp.h - cardH - 10)),
        left: hl.right + gap
      });
    }

    if (spaceBottom >= cardH + gap) {
      cands.push({
        score: spaceBottom,
        top: hl.bottom + gap,
        left: Math.max(10, Math.min(hl.cx - cardW / 2, vp.w - cardW - 10))
      });
    }

    if (spaceLeft >= cardW + gap) {
      cands.push({
        score: spaceLeft,
        top: Math.max(10, Math.min(hl.cy - cardH / 2, vp.h - cardH - 10)),
        left: hl.left - cardW - gap
      });
    }

    if (spaceTop >= cardH + gap) {
      cands.push({
        score: spaceTop,
        top: hl.top - cardH - gap,
        left: Math.max(10, Math.min(hl.cx - cardW / 2, vp.w - cardW - 10))
      });
    }

    cands.sort(function (a, b) { return b.score - a.score; });

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

    cardEl.style.top = '10px';
    cardEl.style.left = Math.max(10, (vp.w - cardW) / 2) + 'px';
    cardEl.style.bottom = 'auto';
    cardEl.style.right = 'auto';
  }

  // ============ 引导流程控制 ============

  function createOverlay() {
    if (!overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.id = 'guide-overlay';
      document.body.appendChild(overlayEl);
    }
    if (!spotlightEl) spotlightEl = createSpotlight();
    if (!cardEl) cardEl = createCard();
  }

  function destroyOverlay() {
    if (phaseCleanup) { phaseCleanup(); phaseCleanup = null; }
    unblockUnderlyingInteraction();
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
    spotlightEl = null;
    cardEl = null;
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
    state = GUIDE_STATE.running;

    createOverlay();
    renderStep();
    blockUnderlyingInteraction();
    if (window.stopPetMovement) window.stopPetMovement();

    if (tourId === 'sticky-tour' && document.body.classList.contains('sticky-mode')) {
      fitStickyWindowToCard();
    }
  }

  function fitStickyWindowToCard() {
    if (!cardEl || !window.electronAPI || !window.electronAPI.resizeWindow) return;

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var cardHeight = cardEl.offsetHeight || 200;
        var header = document.querySelector('header');
        var headerHeight = header ? header.offsetHeight : 40;
        var targetHeight = headerHeight + cardHeight + 40;
        targetHeight = Math.max(200, Math.min(800, targetHeight));
        var fixedWidth = window.stickyModeWidth || 480;
        window.electronAPI.resizeWindow(fixedWidth, Math.round(targetHeight), true);
      });
    });
  }

  function renderStep() {
    if (!currentTour || !cardEl) return;

    if (!canRenderTour(currentTour.id)) {
      if (overlayEl) overlayEl.style.display = 'none';
      return;
    }

    if (phaseCleanup) { phaseCleanup(); phaseCleanup = null; }

    if (overlayEl) overlayEl.style.display = '';

    var step = currentTour.steps[currentStepIndex];
    if (!step) { complete(); return; }

    renderCard(step, currentTour.steps.length);

    if (step.spotlight) {
      var target = document.querySelector(step.spotlight);
      if (target) {
        showSpotlight(target, false);
        setSpotlightPulse(!!step.wait);
      }
    } else {
      hideSpotlight();
    }

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
        var listEl2 = document.getElementById('todoList');
        var initialCount = listEl2 ? listEl2.querySelectorAll('li').length : 0;
        var pollTimer = null;
        var triggered = false;

        var onEnter3 = function (e) {
          if (e.key !== 'Enter' || triggered) return;
          var val = e.target.value ? e.target.value.trim() : '';
          if (val.length === 0) return;
          triggered = true;
          target.removeEventListener('keydown', onEnter3, true);
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
            var timeoutTimer = setTimeout(function () {
              if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
            }, 5000);
            phaseCleanup = function () {
              clearInterval(pollTimer); pollTimer = null;
              clearTimeout(timeoutTimer);
            };
          }
        };
        target.addEventListener('keydown', onEnter3, true);
        phaseCleanup = function () { target.removeEventListener('keydown', onEnter3, true); };
        break;

      case 'dblclick-then-modal-close':
        var onDblClick = function () {
          target.removeEventListener('dblclick', onDblClick);
          if (overlayEl) overlayEl.style.display = 'none';
          waitForModalClose(wait.modalTarget, step);
        };
        target.addEventListener('dblclick', onDblClick);
        phaseCleanup = function () {
          target.removeEventListener('dblclick', onDblClick);
          if (overlayEl) overlayEl.style.display = '';
        };
        break;

    }
  }

  // 等待弹窗关闭的辅助函数
  function waitForModalClose(modalTarget, stepWait) {
    var modalEl = document.querySelector(modalTarget);
    if (modalEl) {
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
    localStorage.removeItem(GUIDE_PROGRESS_KEY);
    destroyOverlay();
    currentTour = null;
    currentStepIndex = 0;
    if (window.startPetMovement) window.startPetMovement();

    if (completedTourId === 'sticky-tour' && document.body.classList.contains('sticky-mode')) {
      resetStickyWindowSize();
    }
  }

  function resetStickyWindowSize() {
    if (!window.electronAPI || !window.electronAPI.resizeWindow) return;

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var mainEl = document.querySelector('main');
        var mainHeight = mainEl ? mainEl.scrollHeight : 0;
        var header = document.querySelector('header');
        var headerHeight = header ? header.offsetHeight : 40;
        var contentHeight = headerHeight + mainHeight + 8;
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

  function resumeProgress() {
    var progress = loadProgress();
    if (!progress) return false;
    var tour = findTour(progress.tourId);
    if (!tour || (tour.version || '1') !== progress.version) {
      clearProgress();
      return false;
    }
    if (localStorage.getItem(TOUR_STORAGE_KEY) === progress.version) {
      clearProgress();
      return false;
    }
    currentTour = tour;
    currentStepIndex = progress.stepIndex;
    state = GUIDE_STATE.running;
    createOverlay();
    renderStep();
    return true;
  }

  // ============ 引导时禁用底层交互 ============

  function blockUnderlyingInteraction() {
    document.addEventListener('click', handleBlockedClick, true);
  }

  function unblockUnderlyingInteraction() {
    document.removeEventListener('click', handleBlockedClick, true);
  }

  function handleBlockedClick(e) {
    if (state !== GUIDE_STATE.running) return;
    if (cardEl && cardEl.contains(e.target)) return;
    if (overlayEl && overlayEl.contains(e.target)) return;
    var step = currentTour && currentTour.steps[currentStepIndex];
    if (step && step.spotlight) {
      var target = document.querySelector(step.spotlight);
      if (target && target.contains(e.target)) return;
    }
    if (step && step.wait && step.wait.target) {
      var waitTarget = document.querySelector(step.wait.target);
      if (waitTarget && waitTarget.contains(e.target)) return;
    }
    if (step && step.wait && step.wait.modalTarget) {
      var modalEl = document.querySelector(step.wait.modalTarget);
      if (modalEl && modalEl.contains(e.target)) return;
    }
    if (document.body.classList.contains('sticky-mode')) {
      var stickyElements = document.querySelectorAll('#stickyAddToggleBtn, #stickyCollapseBtn, #hideWindowBtn, #stickyInput, #stickyInputArea, .sticky-progress');
      for (var j = 0; j < stickyElements.length; j++) {
        if (stickyElements[j].contains(e.target)) return;
      }
    }
    e.preventDefault();
    e.stopPropagation();
  }

  // ============ 自动启动 ============

  function autoStart() {
    var tour = TOURS[0];
    if (!tour || !tour.autoStart) return;
    if (localStorage.getItem(TOUR_STORAGE_KEY) === (tour.version || '1')) return;

    setTimeout(function () {
      if (state === GUIDE_STATE.idle) {
        if (!resumeProgress()) {
          startTour(tour.id);
        }
      }
    }, 600);
  }

  // ============ 全局 API ============

  window.Guide = {
    start: function (tourId) { startTour(tourId); },
    stop: function () { stop(); },
    next: function () { next(); },
    skip: function () { skip(); },

    reset: function (scope) {
      if (scope === 'tour') {
        localStorage.removeItem(TOUR_STORAGE_KEY);
      } else {
        localStorage.removeItem(TOUR_STORAGE_KEY);
      }
    },
    resetTour: function (tourId) {
      localStorage.removeItem(TOUR_STORAGE_KEY);
      localStorage.removeItem(GUIDE_PROGRESS_KEY);
      localStorage.removeItem(STICKY_TOUR_SHOWN_KEY);
    },

    isActive: function () { return state !== GUIDE_STATE.idle; },
    getCompleted: function () {
      var completed = [];
      if (localStorage.getItem(TOUR_STORAGE_KEY)) completed.push('tour');
      return completed;
    }
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
    autoStart();
    watchStickyMode();
  }

  // 便签模式引导
  var STICKY_TOUR_SHOWN_KEY = 'guide_sticky_tour_shown';

  function canRenderTour(tourId) {
    var isSticky = document.body.classList.contains('sticky-mode');
    if (tourId === 'sticky-tour') {
      return isSticky;
    } else {
      return !isSticky;
    }
  }

  function watchStickyMode() {
    var observer = new MutationObserver(function (muts) {
      var isSticky = document.body.classList.contains('sticky-mode');

      if (isSticky) {
        if (currentTour && currentTour.id !== 'sticky-tour') {
          if (overlayEl) overlayEl.style.display = 'none';
        } else if (!currentTour && localStorage.getItem(STICKY_TOUR_SHOWN_KEY) !== '1') {
          localStorage.setItem(STICKY_TOUR_SHOWN_KEY, '1');
          setTimeout(function () {
            startTour('sticky-tour');
          }, 100);
        }
      } else {
        if (currentTour && currentTour.id === 'sticky-tour') {
          complete();
        } else if (overlayEl) {
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
          showSpotlight(target, false);
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
