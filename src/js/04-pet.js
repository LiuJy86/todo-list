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
    // 选择器：所有按钮、输入框、待办项、收纳按钮、链接、输入区域
    const avoidSelectors = 'button, input, .input-area, .todo-item, .collapse-btn, .collapsed-list, a, [role="button"]';
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

  // 检查给定的矩形是否与按钮矩形相交（用于气泡碰撞检测）
  function isPositionCollidingRect(petRect, rects) {
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      const m = r.margin || 0;
      if (
        petRect.right > r.left - m &&
        petRect.left < r.right + m &&
        petRect.bottom > r.top - m &&
        petRect.top < r.bottom + m
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
      // 行走结束后检测边缘
      updatePetEdgeClass();
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

  // 寻找一个不与内容重叠的随机位置
  // 最多尝试 10 次，若都找不到空白处则本次不移动
  function findFreePosition() {
    const rects = getAvoidRects();
    for (let i = 0; i < 10; i++) {
      const pos = getRandomPosition();
      if (!isPositionColliding(pos.x, pos.y, rects)) {
        return pos;
      }
    }
    return null;  // 找不到空白处
  }

  function scheduleNextMove() {
    if (isDragging || isHidden) return;

    const waitTime = 3000 + Math.random() * 5000;

    randomMoveTimer = setTimeout(function () {
      if (isDragging || isHidden) {
        scheduleNextMove();
        return;
      }
      const target = findFreePosition();
      if (target) {
        moveTo(target.x, target.y);
      }
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
    let newX = origX + (point.x - dragStartX);
    // 【修复】史迪奇使用 bottom 定位，Y 轴需要反转：鼠标上移 → bottom 增大（元素上移）
    let newY = origY - (point.y - dragStartY);

    // 拖拽时检测碰撞，若与列表/按钮相交则自动避开
    const rects = getAvoidRects();
    if (isPositionColliding(newX, newY, rects)) {
      const resolved = resolveCollision(newX, newY);
      newX = resolved.x;
      newY = resolved.y;
    }

    const clamped = clampPosition(newX, newY);
    pet.style.left = clamped.x + 'px';
    pet.style.bottom = clamped.y + 'px';
    currentX = clamped.x;
    currentY = clamped.y;
    // 拖拽过程中实时检测边缘
    updatePetEdgeClass();
  }

  function onDragEnd(e) {
    if (!isDragging && !e) return; // 已经清理过且无事件 → 跳过
    isDragging = false;
    pet.classList.remove('dragging');

    // 移除拖拽期间添加的全局监听
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

    // 拖拽结束检测边缘，调整气泡位置
    updatePetEdgeClass();
    startRandomMovement();
  }

  // 页面卸载时清理拖拽监听，防止内存泄漏（拖拽过程中关闭页面）
  window.addEventListener('beforeunload', function () {
    if (isDragging) {
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup', onDragEnd);
      document.removeEventListener('touchmove', onDragMove);
      document.removeEventListener('touchend', onDragEnd);
    }
  });

  // ---------- 9.5.1 边缘检测：动态调整气泡位置 ----------
  // 当史迪仔靠近屏幕左/右边缘时，添加对应 CSS 类，让气泡靠边对齐不被遮挡
  function updatePetEdgeClass() {
    const EDGE_THRESHOLD = 120; // 距离边缘多少像素算"靠近"
    pet.classList.remove('near-left', 'near-right');
    if (currentX <= EDGE_THRESHOLD) {
      pet.classList.add('near-left');
    } else if (currentX + PET_WIDTH >= window.innerWidth - EDGE_THRESHOLD) {
      pet.classList.add('near-right');
    }
  }

  pet.addEventListener('mousedown', onDragStart);
  pet.addEventListener('touchstart', onDragStart, { passive: false });

  // ---------- 9.6 点击/双击交互 ----------

  // 双击史迪奇查看日报
  pet.addEventListener('dblclick', function (e) {
    e.stopPropagation();
    if (isDragging) return;
    if (window.showDailyReport) {
      window.showDailyReport();
    }
  });

  // 史迪奇随机气泡文案池（中二 + 乐天派 + 暖心）
  const bubbleMessages = [
    // ===== 中二风格 =====
    '吾乃史迪奇，626 号实验体！你的待办就是本大人的使命！',
    '哼，没有待办能逃过我的眼睛！',
    '本大人今天也要守护你的待办清单！Ohana！',
    '感受到我体内涌动的力量了吗？那是完成待办的意志！',
    '吾之使命，乃助你征服所有待办！',
    // ===== 乐天派 =====
    '今天也是元气满满的一天！冲鸭！',
    '嘿嘿，有我在，什么都不怕~',
    '阳光正好，适合把待办一个个消灭！',
    '今天的心情是彩虹色的！',
    '笑一个吧，待办什么的分分钟搞定！',
    // ===== 暖心 =====
    '累了就休息一下，待办可以等一等哦~',
    '你已经做得很棒了，不要给自己太大压力。',
    '不管有多少待办，我都会陪着你。',
    '记得喝水，记得吃饭，你最重要。',
    '今天辛苦了，好好休息，明天继续加油。',
    '不管发生什么，Ohana 都在你身边。'
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
    // 气泡区域与页面内容重叠时不显示对话气泡
    // 气泡在桌宠上方（bottom: 100%），估算气泡区域进行检测
    const petRect = pet.getBoundingClientRect();
    const bubbleHeight = 40;   // 气泡高度（含 padding）
    const bubbleMargin = 12;   // 气泡与桌宠间距
    const bubbleWidth = 200;   // 气泡估算宽度
    const bubbleRect = {
      left: petRect.left + petRect.width / 2 - bubbleWidth / 2,
      right: petRect.left + petRect.width / 2 + bubbleWidth / 2,
      top: petRect.top - bubbleHeight - bubbleMargin,
      bottom: petRect.top - bubbleMargin
    };
    const rects = getAvoidRects();
    if (isPositionCollidingRect(bubbleRect, rects)) {
      return; // 气泡区域重叠则不显示
    }
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
    // 窗口大小变化时，检查是否有空间显示桌宠
    updatePetVisibility();
    // 如果有空间且桌宠可见，自动移到空白处
    if (!pet.classList.contains('hidden') && !isHidden) {
      const freePos = findFreePosition();
      if (freePos) {
        moveTo(freePos.x, freePos.y);
      }
    }
  });

  // 根据是否有空白区域决定是否显示桌宠
  // 只要能找到一块不被内容遮挡的位置，就显示桌宠
  function updatePetVisibility() {
    if (!pet) return;
    // 桌宠最小需要的空间（考虑缩小后的尺寸）
    const petMinWidth = 80;   // 桌宠最小宽度
    const petMinHeight = 100; // 桌宠最小高度

    // 窗口太小，连缩小后的桌宠都放不下，则隐藏
    if (window.innerWidth < petMinWidth + 20 || window.innerHeight < petMinHeight + 20) {
      pet.classList.add('hidden');
      return;
    }

    // 检查是否存在空白区域可以放置桌宠
    const rects = getAvoidRects();
    // 在视口范围内采样多个点，看是否有不碰撞的位置
    let hasFreeSpace = false;
    for (let x = 10; x < window.innerWidth - petMinWidth; x += 40) {
      for (let y = 10; y < window.innerHeight - petMinHeight; y += 40) {
        // y 是 bottom 坐标，需要转换
        if (!isPositionColliding(x, y, rects)) {
          hasFreeSpace = true;
          break;
        }
      }
      if (hasFreeSpace) break;
    }

    if (hasFreeSpace) {
      pet.classList.remove('hidden');
    } else {
      pet.classList.add('hidden');
    }
  }

  // 初始化时检查一次
  updatePetVisibility();

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

  // 初始化时检查碰撞，若重叠则自动移到安全位置
  setTimeout(function () {
    const rects = getAvoidRects();
    if (isPositionColliding(currentX, currentY, rects)) {
      const resolved = resolveCollision(currentX, currentY);
      currentX = resolved.x;
      currentY = resolved.y;
      pet.style.left = currentX + 'px';
      pet.style.bottom = currentY + 'px';
    }
    startRandomMovement();
  }, 500);

  // 启动 GIF 轮播（3-5 秒随机切换桌宠动图）
  startGifRotation();

  // ===== 史迪奇交互文字系统 =====
  // 页面打开 2 秒后，史迪奇主动说一句话
  setTimeout(function () {
    if (!isHidden && window.petMood) {
      // 根据当前待办数量选择不同风格的欢迎语
      const pendingCount = (window.todos || []).filter(function (t) { return !t.done; }).length;
      let welcomeMsg;
      if (pendingCount === 0) {
        welcomeMsg = '今天还没有待办呢，要不要加几个？我准备好了！';
      } else if (pendingCount < 3) {
        welcomeMsg = '今天有 ' + pendingCount + ' 项待办，我们一起搞定它们！';
      } else {
        welcomeMsg = '哇，今天有 ' + pendingCount + ' 项待办！别担心，有本大人在！';
      }
      window.petMood.toast(welcomeMsg, 'info');
    }
  }, 2000);

  // 空闲检测：用户 30 秒无操作，史迪奇主动搭话
  let idleTimer = null;
  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (!isHidden && window.petMood) {
        const idleMsgs = [
          '怎么不理我了？是不是在偷偷休息？',
          '待办在等你哦，别偷懒~',
          '本大人有点无聊了，快来和我互动一下！',
          '发呆也是一种休息，我懂的~',
          '有什么我能帮你的吗？'
        ];
        window.petMood.toast(idleMsgs[Math.floor(Math.random() * idleMsgs.length)], 'info');
      }
    }, 30000); // 30 秒无操作触发
  }
  // 监听用户操作，重置空闲计时
  ['click', 'keydown', 'mousemove', 'touchstart'].forEach(function (evt) {
    document.addEventListener(evt, resetIdleTimer, { passive: true });
  });
  resetIdleTimer();

  // 随机气泡：每 15-30 秒随机冒一个气泡
  function scheduleRandomBubble() {
    const delay = 15000 + Math.random() * 15000; // 15-30 秒随机
    setTimeout(function () {
      if (!isHidden && window.petMood) {
        window.petMood.bubble();
      }
      scheduleRandomBubble(); // 递归调度下一次
    }, delay);
  }

  // 首次进入页面时，史迪仔先说两句问候，然后启动随机互动
  setTimeout(function () {
    // 先更新边缘状态，确保气泡位置正确
    updatePetEdgeClass();
    const msg = '嘿！你听说过「景逸大人」这个名字吗？';
    petBubble.textContent = msg;
    petBubble.classList.add('show');

    // 动态调整气泡位置，防止超出屏幕
    adjustBubblePosition();

    if (bubbleTimer) clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () {
      petBubble.classList.remove('show');

      // 0.5 秒后显示第二句
      setTimeout(function () {
        const msg2 = '传说啊，他是世界上顶好顶好的人~ ✨';
        petBubble.textContent = msg2;
        petBubble.classList.add('show');

        // 再次调整位置
        adjustBubblePosition();

        bubbleTimer = setTimeout(function () {
          petBubble.classList.remove('show');

          // ★ 问候说完后，启动随机互动气泡
          // 等 8-15 秒后开始第一个随机气泡，然后持续循环
          const firstRandomDelay = 8000 + Math.random() * 7000;
          setTimeout(scheduleRandomBubble, firstRandomDelay);
        }, 4000);
      }, 500);
    }, 4000);
  }, 2000); // 页面加载 2 秒后显示第一句问候

  // 动态调整气泡位置，确保不超出屏幕边缘
  function adjustBubblePosition() {
    const bubbleRect = petBubble.getBoundingClientRect();
    const petRect = pet.getBoundingClientRect();
    const windowWidth = window.innerWidth;

    // 检查气泡是否超出右边缘
    if (bubbleRect.right > windowWidth) {
      const overflow = bubbleRect.right - windowWidth;
      // 将气泡向左移动，使其右边缘在屏幕内 10px
      petBubble.style.left = 'auto';
      petBubble.style.right = '10px';
      petBubble.style.transform = 'none';
    }
    // 检查气泡是否超出左边缘
    else if (bubbleRect.left < 0) {
      petBubble.style.left = '10px';
      petBubble.style.right = 'auto';
      petBubble.style.transform = 'none';
    }
  }

  // ===== 日报功能 =====
  // 生成今日日报数据
  function generateDailyReport() {
    const todos = window.todos || (window.getAllTodos ? window.getAllTodos() : []);
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const todayEnd = todayStart + 86400000;

    // 筛选今日完成的事项
    const completedToday = todos.filter(function (t) {
      return t.done && t.completedAt && t.completedAt >= todayStart && t.completedAt < todayEnd;
    });
    const pendingCount = todos.filter(function (t) { return !t.done; }).length;
    const totalCount = todos.length;
    const completionRate = totalCount > 0 ? Math.round((completedToday.length / totalCount) * 100) : 0;

    // 结语（简洁自然）
    let message;
    if (totalCount === 0) {
      message = '今天还没有添加待办，明天开始吧';
    } else if (completionRate >= 80) {
      message = '今日效率出色，继续保持这个节奏';
    } else if (completionRate >= 50) {
      message = '完成了大半，明天再接再厉';
    } else if (completedToday.length > 0) {
      message = '今日完成了 ' + completedToday.length + ' 项，还有提升空间';
    } else {
      message = '今日暂无完成事项，明天是新的开始';
    }

    return {
      date: (today.getMonth() + 1) + '月' + today.getDate() + '日',
      completed: completedToday.length,
      pending: pendingCount,
      total: totalCount,
      rate: completionRate,
      achievements: completedToday.map(function (t) { return t.text; }),
      message: message
    };
  }

  // 显示日报弹窗（Apple 风格 - 简洁版）
  function showDailyReport() {
    if (document.getElementById('dailyReportModal')) return;

    const data = generateDailyReport();

    // 成就列表
    let achievementsHtml = '';
    if (data.achievements.length > 0) {
      achievementsHtml = '<div class="dr-section">' +
        '<div class="dr-section-label">今日完成</div>' +
        '<div class="dr-achievements">' +
        data.achievements.slice(0, 6).map(function (text) {
          return '<div class="dr-achievement">' +
            '<span class="dr-check-icon"></span>' +
            '<span class="dr-achievement-text">' + text + '</span>' +
            '</div>';
        }).join('') +
        (data.achievements.length > 6 ? '<div class="dr-achievement-more">+' + (data.achievements.length - 6) + ' 项</div>' : '') +
        '</div></div>';
    }

    const modal = document.createElement('div');
    modal.id = 'dailyReportModal';
    modal.className = 'daily-report-modal';
    modal.innerHTML =
      '<div class="dr-overlay"></div>' +
      '<div class="dr-card">' +
        '<div class="dr-content">' +
          // 日期标签
          '<div class="dr-date-label">' + data.date + '</div>' +
          // 大标题
          '<div class="dr-headline">' + data.rate + '%</div>' +
          '<div class="dr-subtitle">今日完成率</div>' +
          // 统计行
          '<div class="dr-summary">' +
            '<div class="dr-summary-item">' +
              '<span class="dr-summary-num dr-green">' + data.completed + '</span>' +
              '<span class="dr-summary-text">已完成</span>' +
            '</div>' +
            '<div class="dr-summary-item">' +
              '<span class="dr-summary-num dr-orange">' + data.pending + '</span>' +
              '<span class="dr-summary-text">待办中</span>' +
            '</div>' +
            '<div class="dr-summary-item">' +
              '<span class="dr-summary-num">' + data.total + '</span>' +
              '<span class="dr-summary-text">总计</span>' +
            '</div>' +
          '</div>' +
          // 成就列表
          achievementsHtml +
          // 结语
          '<div class="dr-message">' + data.message + '</div>' +
        '</div>' +
        // 按钮
        '<div class="dr-footer">' +
          '<button class="dr-btn" id="dailyReportOk">完成</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    // 关闭弹窗
    function closeReport() { modal.remove(); }
    modal.querySelector('.dr-overlay').addEventListener('click', closeReport);
    document.getElementById('dailyReportOk').addEventListener('click', closeReport);
  }

  // 暴露全局接口
  window.showDailyReport = showDailyReport;

  // 检查是否到了日报时间（每晚 21:00）
  let dailyReportShown = false;
  function checkDailyReportTime() {
    const now = new Date();
    // 21:00 - 21:59 之间，且今日未显示过
    if (now.getHours() === 21 && !dailyReportShown) {
      dailyReportShown = true;
      // 史迪奇弹出提醒
      if (window.petMood) {
        window.petMood.toast('日报生成啦！点击我查看今天的成果吧~', 'info');
        // 点击史迪奇时显示报告
        setTimeout(function () {
          const originalOnPetClick = pet.onclick;
          pet.onclick = function () {
            showDailyReport();
            pet.onclick = originalOnPetClick;
          };
        }, 100);
      }
    }
    // 过了 25:00（实际是次日），重置标志
    if (now.getHours() === 0) {
      dailyReportShown = false;
    }
  }
  // 每 60 秒检查一次时间
  setInterval(checkDailyReportTime, 60000);
  // 页面打开时也检查一次
  setTimeout(checkDailyReportTime, 5000);

})();
