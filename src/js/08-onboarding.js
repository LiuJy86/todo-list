/**
 * 用户引导模块 (v2.24.0) - 分步高亮设计
 *
 * 设计理念：每个步骤内部分为多个"相位"，每个相位高亮一个元素，
 * 用户完成操作后自动高亮下一个元素，形成流畅的引导流程。
 *
 * 流程（共 2 步，每步多个相位）：
 * 第1步：输入 → Enter → 展示
 * 第2步：输入 → 点击时间管理 → 高亮弹窗 → 点击确定 → Enter → 展示
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'onboarding_done';
  var CURRENT_VERSION = '12';

  var currentStep = 0;
  var currentPhase = 0;
  var overlay, highlight, card;
  var actionCompleted = false;
  var cleanup = null;
  var phaseCleanup = null;

  // ============ 步骤定义 ============
  // 每个步骤包含多个相位，每个相位：
  //   selector: 要高亮的元素
  //   desc: 该相位的引导文案
  //   wait: 等待的操作类型
  //   position: 卡片位置偏好
  var STEPS = [
    {
      title: '第1步：添加待办',
      showResult: '#todoList li:first-child',
      phases: [
        {
          selector: '#todoInput',
          desc: '请输入：九点半提醒我开线上会议',
          wait: 'input',
          position: 'bottom'
        },
        {
          selector: '#todoInput',
          desc: '按 Enter 添加',
          wait: 'enter',
          position: 'bottom'
        }
      ]
    },
    {
      title: '第2步：设置提醒',
      showResult: '#todoList li:first-child',
      phases: [
        {
          selector: '#todoInput',
          desc: '输入：睡觉',
          wait: 'input',
          position: 'bottom'
        },
        {
          selector: '#datetimeTrigger',
          desc: '点击 📅 时间管理',
          wait: 'click',
          position: 'bottom'
        },
        {
          selector: '#datetimePopover',
          desc: '选择提醒时间',
          wait: 'clickAnywhere',
          position: 'right'
        },
        {
          selector: '#dpConfirmBtn',
          desc: '点击「确定」确认时间',
          wait: 'click',
          position: 'left'
        },
        {
          selector: '#todoInput',
          desc: '按 Enter 添加',
          wait: 'enter',
          position: 'bottom'
        }
      ]
    }
  ];

  // ============ 启动 ============
  function start() {
    if (localStorage.getItem(STORAGE_KEY) === CURRENT_VERSION) return;
    currentStep = 0;
    currentPhase = 0;
    createOverlay();
    renderStep();
  }

  function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'onboarding-overlay';
    overlay.innerHTML =
      '<div class="onboarding-highlight"></div>' +
      '<div class="onboarding-card">' +
      '<div class="onboarding-step-badge"></div>' +
      '<h3 class="onboarding-card-title"></h3>' +
      '<p class="onboarding-card-desc"></p>' +
      '<div class="onboarding-card-status">' +
      '<span class="onboarding-status-icon">⏳</span>' +
      '<span class="onboarding-status-text">请按提示操作...</span>' +
      '</div>' +
      '<div class="onboarding-card-footer">' +
      '<div class="onboarding-dots"></div>' +
      '<div class="onboarding-actions">' +
      '<button class="onboarding-btn onboarding-btn-skip">跳过</button>' +
      '<button class="onboarding-btn onboarding-btn-next">下一步</button>' +
      '</div>' +
      '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    highlight = overlay.querySelector('.onboarding-highlight');
    card = overlay.querySelector('.onboarding-card');
    bindEvents();
  }

  // ============ 渲染 ============
  function renderStep() {
    if (cleanup) { cleanup(); cleanup = null; }
    if (phaseCleanup) { phaseCleanup(); phaseCleanup = null; }
    closeDatetimePicker();
    actionCompleted = false;
    currentPhase = 0;

    if (currentStep >= STEPS.length) { complete(); return; }

    var step = STEPS[currentStep];

    // 更新 UI
    overlay.querySelector('.onboarding-step-badge').textContent = '步骤 ' + (currentStep + 1) + '/' + STEPS.length;
    card.querySelector('.onboarding-card-title').textContent = step.title;
    renderDots();

    var statusEl = card.querySelector('.onboarding-card-status');
    statusEl.style.display = 'flex';
    statusEl.classList.remove('completed');
    statusEl.querySelector('.onboarding-status-icon').textContent = '⏳';
    statusEl.querySelector('.onboarding-status-text').textContent = '请按提示操作...';

    card.querySelector('.onboarding-btn-next').style.display = '';
    card.querySelector('.onboarding-btn-next').textContent = (currentStep < STEPS.length - 1) ? '下一步' : '完成引导';

    highlight.classList.add('onboarding-highlight-pulse');

    renderPhase();
  }

  function renderPhase() {
    if (phaseCleanup) { phaseCleanup(); phaseCleanup = null; }

    var step = STEPS[currentStep];
    if (currentPhase >= step.phases.length) {
      // 所有相位完成，展示结果
      showStepResult();
      return;
    }

    var phase = step.phases[currentPhase];

    // 等待元素出现
    var target = document.querySelector(phase.selector);
    if (!target || target.offsetParent === null) {
      // 特殊处理：如果 popover 还没打开，不等待
      if (phase.selector === '#datetimePopover') {
        // 等待 popover 出现
        var waitPopover = setInterval(function () {
          var pop = document.querySelector('#datetimePopover');
          if (pop && pop.classList.contains('open') && pop.offsetParent !== null) {
            clearInterval(waitPopover);
            renderPhase();
          }
        }, 200);
        phaseCleanup = function () { clearInterval(waitPopover); };
        return;
      }
      setTimeout(renderPhase, 300);
      return;
    }

    // 更新卡片文案
    card.querySelector('.onboarding-card-desc').textContent = phase.desc;

    // 高亮目标
    highlight.style.display = 'block';
    card.classList.remove('onboarding-card-centered');
    positionHighlight(target);
    positionCard(phase.position, target);

    // 绑定交互
    bindPhaseWait(phase, target);
  }

  function bindPhaseWait(phase, target) {
    var step = STEPS[currentStep];

    var phaseDone = function () {
      if (phaseCleanup) { phaseCleanup(); phaseCleanup = null; }
      currentPhase++;
      // 短暂延迟后渲染下一相位
      setTimeout(renderPhase, 200);
    };

    var stepDone = function () {
      if (actionCompleted) return;
      actionCompleted = true;

      var statusEl = card.querySelector('.onboarding-card-status');
      statusEl.classList.add('completed');
      statusEl.querySelector('.onboarding-status-icon').textContent = '✅';
      statusEl.querySelector('.onboarding-status-text').textContent = '完成！';

      highlight.classList.remove('onboarding-highlight-pulse');
      highlight.classList.add('onboarding-highlight-success');

      if (step.showResult) {
        setTimeout(function () { showStepResult(); }, 300);
      }
    };

    switch (phase.wait) {
      case 'input':
        // 等待用户输入内容
        var onInput = function () {
          if (target.value && target.value.trim().length > 0) {
            target.removeEventListener('input', onInput);
            phaseDone();
          }
        };
        target.addEventListener('input', onInput);
        phaseCleanup = function () { target.removeEventListener('input', onInput); };
        break;

      case 'enter':
        // 等待用户按 Enter
        var onEnter = function (e) {
          if (e.key === 'Enter') {
            target.removeEventListener('keydown', onEnter);
            // 等待 todoList 变化
            var list = document.getElementById('todoList');
            var obs = new MutationObserver(function (muts) {
              for (var i = 0; i < muts.length; i++) {
                if (muts[i].addedNodes.length > 0) {
                  obs.disconnect();
                  stepDone();
                  return;
                }
              }
            });
            obs.observe(list, { childList: true });
            phaseCleanup = function () { obs.disconnect(); };
          }
        };
        target.addEventListener('keydown', onEnter);
        phaseCleanup = function () { target.removeEventListener('keydown', onEnter); };
        break;

      case 'click':
        // 等待用户点击目标
        target.addEventListener('click', phaseDone, { once: true });
        phaseCleanup = function () { target.removeEventListener('click', phaseDone); };
        break;

      case 'clickAnywhere':
        // 等待用户点击弹窗内任意位置（交互即继续）
        var onPopClick = function () {
          setTimeout(phaseDone, 100);
        };
        target.addEventListener('click', onPopClick, { once: true });
        phaseCleanup = function () { target.removeEventListener('click', onPopClick); };
        break;
    }
  }

  function showStepResult() {
    var step = STEPS[currentStep];
    if (!step.showResult) return;

    var target = document.querySelector(step.showResult);
    if (!target || target.offsetParent === null) {
      setTimeout(showStepResult, 300);
      return;
    }

    highlight.style.display = 'block';
    card.classList.remove('onboarding-card-centered');
    positionHighlight(target);
    positionCard('bottom', target);
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    card.querySelector('.onboarding-card-desc').textContent = '✅ 事项已添加成功！';
  }

  function renderDots() {
    var step = STEPS[currentStep];
    var total = step.phases.length;
    var html = '';
    for (var i = 0; i < total; i++) {
      html += '<span class="onboarding-dot' +
        (i === currentPhase ? ' active' : '') +
        (i < currentPhase ? ' completed' : '') + '"></span>';
    }
    overlay.querySelector('.onboarding-dots').innerHTML = html;
  }

  // ============ 定位 ============
  function positionHighlight(target) {
    var rect = target.getBoundingClientRect();
    highlight.style.top = (rect.top - 8) + 'px';
    highlight.style.left = (rect.left - 8) + 'px';
    highlight.style.width = (rect.width + 16) + 'px';
    highlight.style.height = (rect.height + 16) + 'px';
  }

  function positionCard(preferred, target) {
    var rect = target.getBoundingClientRect();
    var cardW = 260, cardH = 140, gap = 20;

    var hl = {
      top: rect.top - 15, left: rect.left - 15,
      right: rect.right + 15, bottom: rect.bottom + 15,
      cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2
    };

    var vw = window.innerWidth, vh = window.innerHeight;
    var cands = [];

    if (preferred === 'center') {
      cands = [{ top: vh / 2 - cardH / 2, left: vw / 2 - cardW / 2 }];
    } else {
      cands = [
        { top: hl.cy - cardH / 2, left: hl.right + gap },
        { top: hl.bottom + gap, left: hl.cx - cardW / 2 },
        { top: hl.top - cardH - gap, left: hl.cx - cardW / 2 },
        { top: hl.cy - cardH / 2, left: hl.left - cardW - gap },
        { top: 20, left: vw - cardW - 20 },
        { top: 20, left: 20 }
      ];
    }

    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      c.left = Math.max(10, Math.min(c.left, vw - cardW - 10));
      c.top = Math.max(10, Math.min(c.top, vh - cardH - 10));
      if (!overlaps(c, cardW, cardH, hl)) {
        card.style.top = c.top + 'px';
        card.style.left = c.left + 'px';
        card.style.bottom = 'auto';
        card.style.right = 'auto';
        return;
      }
    }
    card.style.top = '20px';
    card.style.left = (vw - cardW - 20) + 'px';
    card.style.bottom = 'auto';
    card.style.right = 'auto';
  }

  function overlaps(c, w, h, hl) {
    return !(c.left + w < hl.left || c.left > hl.right || c.top + h < hl.top || c.top > hl.bottom);
  }

  // ============ 工具 ============
  function closeDatetimePicker() {
    if (window.datetimePickerModule) {
      var popover = document.getElementById('datetimePopover');
      if (popover && popover.classList.contains('open')) {
        window.datetimePickerModule.close();
      }
    }
  }

  // ============ 流程控制 ============
  function next() { currentStep++; renderStep(); }
  function skip() { complete(); }

  function complete() {
    localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
    if (cleanup) cleanup();
    if (phaseCleanup) phaseCleanup();
    if (overlay) { overlay.remove(); overlay = null; }
    document.removeEventListener('keydown', onEsc);
    window.removeEventListener('resize', onResize);
  }

  function bindEvents() {
    overlay.querySelector('.onboarding-btn-skip').addEventListener('click', skip);
    overlay.querySelector('.onboarding-btn-next').addEventListener('click', next);
    document.addEventListener('keydown', onEsc);
    window.addEventListener('resize', onResize);
  }

  function onEsc(e) { if (e.key === 'Escape') skip(); }
  function onResize() {
    var step = STEPS[currentStep];
    if (step && step.phases) {
      var phase = step.phases[currentPhase];
      if (phase) {
        var target = document.querySelector(phase.selector);
        if (target) {
          positionHighlight(target);
          positionCard(phase.position, target);
        }
      }
    }
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    currentStep = 0;
    currentPhase = 0;
    if (overlay) { overlay.remove(); overlay = null; }
    if (cleanup) cleanup();
    if (phaseCleanup) phaseCleanup();
    document.removeEventListener('keydown', onEsc);
    window.removeEventListener('resize', onResize);
    start();
  }

  window.Onboarding = { start: start, reset: reset };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 500); });
  } else {
    setTimeout(start, 500);
  }

})();
