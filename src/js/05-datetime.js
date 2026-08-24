// ===== 10.5 自定义日期时间选择器（Popover 浮层）=====
// v2.4.0 新增：替代原生 datetime-local，支持日期/时间/循环三合一设置

const datetimePickerModule = (function () {
  // 模块内部状态
  let currentDate = null;       // 已选日期 (Date 对象，时间部分为 00:00)
  let currentHour = 8;          // 已选小时
  let currentMinute = 0;        // 已选分钟
  let currentRecurrence = null; // 循环设置对象
  let activeDatePreset = null;  // 当前激活的日期预设
  let activeTimePreset = null;  // 当前激活的时间预设
  let activeCyclePreset = null; // 当前激活的循环预设

  // DOM 引用
  const datetimePicker = document.getElementById('datetimePicker');
  const datetimeTrigger = document.getElementById('datetimeTrigger');
  const datetimeDisplay = document.getElementById('datetimeDisplay');
  const datetimePopover = document.getElementById('datetimePopover');
  const datePresetRow = document.getElementById('dpDatePresets');
  const hourSelect = document.getElementById('dpHourSelect');
  const minuteSelect = document.getElementById('dpMinuteSelect');
  const timePresetRow = document.getElementById('dpTimePresets');
  const cycleToggle = document.getElementById('dpCycleToggle');
  const cycleOptions = document.getElementById('dpCycleOptions');
  const cyclePresetRow = document.getElementById('dpCyclePresets');
  const customCycle = document.getElementById('dpCustomCycle');
  const cycleValueInput = document.getElementById('dpCycleValue');
  const cycleUnitSelect = document.getElementById('dpCycleUnit');
  const cycleCountInput = document.getElementById('dpCycleCount'); // 循环次数输入框
  const clearBtn = document.getElementById('dpClearBtn');
  const confirmBtn = document.getElementById('dpConfirmBtn');

  // ========== 滚轮选择器（月/日 + 时/分） ==========
  const DATE_ITEM_HEIGHT = 14;
  const TIME_ITEM_HEIGHT = 14;

  const wheelMonthList = document.getElementById('dpWheelMonthList');
  const wheelDayList = document.getElementById('dpWheelDayList');
  const wheelHourList = document.getElementById('dpWheelHourList');
  const wheelMinuteList = document.getElementById('dpWheelMinuteList');
  const yearLabel = document.getElementById('dpYearLabel');

  // 滚轮列状态
  const wheelState = {
    month:  { listEl: wheelMonthList,  items: [], index: 0, scrollTop: 0, itemH: DATE_ITEM_HEIGHT, dragging: false, startY: 0, startScroll: 0 },
    day:    { listEl: wheelDayList,    items: [], index: 0, scrollTop: 0, itemH: DATE_ITEM_HEIGHT, dragging: false, startY: 0, startScroll: 0 },
    hour:   { listEl: wheelHourList,   items: [], index: 8, scrollTop: 0, itemH: TIME_ITEM_HEIGHT, dragging: false, startY: 0, startScroll: 0 },
    minute: { listEl: wheelMinuteList, items: [], index: 0, scrollTop: 0, itemH: TIME_ITEM_HEIGHT, dragging: false, startY: 0, startScroll: 0 }
  };

  // 获取指定年月的天数
  function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  // 渲染单个滚轮列
  function renderWheel(col, items, selectedIndex) {
    const state = wheelState[col];
    const h = state.itemH;
    state.items = items;
    state.index = selectedIndex;
    state.listEl.innerHTML = items.map((val, i) => {
      let cls = 'dp-wheel-item';
      if (i === selectedIndex) cls += ' selected';
      else if (Math.abs(i - selectedIndex) <= 1) cls += ' near';
      else cls += ' far';
      return '<div class="' + cls + '" data-idx="' + i + '">' + val + '</div>';
    }).join('');
    state.scrollTop = selectedIndex * h;
    state.listEl.style.transform = 'translateY(' + (-state.scrollTop) + 'px)';
  }

  // 滚动并吸附到最近项
  function snapWheel(col) {
    const state = wheelState[col];
    const h = state.itemH;
    const rawIndex = Math.round(state.scrollTop / h);
    state.index = Math.max(0, Math.min(state.items.length - 1, rawIndex));
    state.scrollTop = state.index * h;
    state.listEl.style.transform = 'translateY(' + (-state.scrollTop) + 'px)';
    // 更新选中项样式
    state.listEl.querySelectorAll('.dp-wheel-item').forEach((el, i) => {
      el.classList.remove('selected', 'near', 'far');
      if (i === state.index) el.classList.add('selected');
      else if (Math.abs(i - state.index) <= 1) el.classList.add('near');
      else el.classList.add('far');
    });
  }

  // 绑定滚轮列的拖拽和滚轮事件
  function bindWheel(col, onChange) {
    const state = wheelState[col];
    const h = state.itemH;
    const listEl = state.listEl;

    // 鼠标拖拽
    listEl.addEventListener('mousedown', function (e) {
      state.dragging = true;
      state.startY = e.clientY;
      state.startScroll = state.scrollTop;
      listEl.style.transition = 'none';
    });
    document.addEventListener('mousemove', function (e) {
      if (!state.dragging) return;
      const delta = state.startY - e.clientY;
      state.scrollTop = state.startScroll + delta;
      state.scrollTop = Math.max(0, Math.min(state.scrollTop, (state.items.length - 1) * h));
      listEl.style.transform = 'translateY(' + (-state.scrollTop) + 'px)';
    });
    document.addEventListener('mouseup', function () {
      if (!state.dragging) return;
      state.dragging = false;
      listEl.style.transition = '';
      snapWheel(col);
      if (onChange) onChange();
    });

    // 滚轮事件
    listEl.addEventListener('wheel', function (e) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? h : -h;
      const newTop = state.scrollTop + delta;
      state.scrollTop = Math.max(0, Math.min(newTop, (state.items.length - 1) * h));
      listEl.style.transform = 'translateY(' + (-state.scrollTop) + 'px)';
      clearTimeout(state._wheelTimer);
      state._wheelTimer = setTimeout(function () {
        snapWheel(col);
        if (onChange) onChange();
      }, 120);
    }, { passive: false });

    // 点击直接选中
    listEl.addEventListener('click', function (e) {
      const item = e.target.closest('.dp-wheel-item');
      if (!item) return;
      const idx = parseInt(item.dataset.idx);
      state.scrollTop = idx * h;
      snapWheel(col);
      if (onChange) onChange();
    });

    // 触摸事件（移动端支持）
    listEl.addEventListener('touchstart', function (e) {
      state.dragging = true;
      state.startY = e.touches[0].clientY;
      state.startScroll = state.scrollTop;
      listEl.style.transition = 'none';
    }, { passive: true });
    listEl.addEventListener('touchmove', function (e) {
      if (!state.dragging) return;
      const delta = state.startY - e.touches[0].clientY;
      state.scrollTop = state.startScroll + delta;
      state.scrollTop = Math.max(0, Math.min(state.scrollTop, (state.items.length - 1) * h));
      listEl.style.transform = 'translateY(' + (-state.scrollTop) + 'px)';
    }, { passive: true });
    listEl.addEventListener('touchend', function () {
      if (!state.dragging) return;
      state.dragging = false;
      listEl.style.transition = '';
      snapWheel(col);
      if (onChange) onChange();
    });
  }

  // 初始化滚轮
  function initWheelPicker() {
    const now = new Date();
    const currentY = now.getFullYear();
    const currentM = now.getMonth() + 1;
    const currentD = now.getDate();

    // 年份标签
    yearLabel.textContent = currentY + '年';

    // 月份：1 ~ 12
    const months = [];
    for (let m = 1; m <= 12; m++) months.push(String(m));
    renderWheel('month', months, currentM - 1);

    // 日期：根据当前年月
    const daysInMonth = getDaysInMonth(currentY, currentM);
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) days.push(String(d));
    renderWheel('day', days, currentD - 1);

    // 小时：0 ~ 23
    const hours = [];
    for (let h = 0; h < 24; h++) hours.push(String(h).padStart(2, '0'));
    renderWheel('hour', hours, currentHour);

    // 分钟：0 ~ 59
    const minutes = [];
    for (let m = 0; m < 60; m++) minutes.push(String(m).padStart(2, '0'));
    renderWheel('minute', minutes, currentMinute);

    // 绑定事件
    bindWheel('month', onWheelDateChange);
    bindWheel('day', onWheelDateChange);
    bindWheel('hour', onWheelTimeChange);
    bindWheel('minute', onWheelTimeChange);
  }

  // 滚轮日期变化回调
  function onWheelDateChange() {
    const y = currentDate ? currentDate.getFullYear() : new Date().getFullYear();
    const m = parseInt(wheelState.month.items[wheelState.month.index]);
    const d = parseInt(wheelState.day.items[wheelState.day.index]);

    const maxDay = getDaysInMonth(y, m);
    if (wheelState.day.index >= maxDay) {
      const days = [];
      for (let i = 1; i <= maxDay; i++) days.push(String(i));
      renderWheel('day', days, maxDay - 1);
    }

    currentDate = new Date(y, m - 1, d);
    currentDate.setHours(0, 0, 0, 0);
    activeDatePreset = null;
    datePresetRow.querySelectorAll('.dp-preset.active').forEach(b => b.classList.remove('active'));
    updateDisplay();
  }

  // 滚轮时间变化回调
  function onWheelTimeChange() {
    currentHour = wheelState.hour.index;
    currentMinute = wheelState.minute.index;
    activeTimePreset = null;
    timePresetRow.querySelectorAll('.dp-preset.active').forEach(b => b.classList.remove('active'));
    updateDisplay();
  }

  // 设置滚轮到指定日期
  function setWheelToDate(date) {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const DATE_H = wheelState.month.itemH;

    // 年份标签
    yearLabel.textContent = y + '年';

    // 月份
    const monthIdx = m - 1;
    wheelState.month.index = monthIdx;
    wheelState.month.scrollTop = monthIdx * DATE_H;
    wheelState.month.listEl.style.transform = 'translateY(' + (-monthIdx * DATE_H) + 'px)';
    wheelState.month.listEl.querySelectorAll('.dp-wheel-item').forEach((el, i) => {
      el.classList.remove('selected', 'near', 'far');
      if (i === monthIdx) el.classList.add('selected');
      else if (Math.abs(i - monthIdx) <= 1) el.classList.add('near');
      else el.classList.add('far');
    });

    // 日期
    const maxDay = getDaysInMonth(y, m);
    const days = [];
    for (let i = 1; i <= maxDay; i++) days.push(String(i));
    const dayIdx = Math.min(d - 1, maxDay - 1);
    renderWheel('day', days, dayIdx);
  }

  // 设置时间滚轮
  function setWheelToTime(hour, minute) {
    const H = wheelState.hour.itemH;
    // 小时
    wheelState.hour.index = hour;
    wheelState.hour.scrollTop = hour * H;
    wheelState.hour.listEl.style.transform = 'translateY(' + (-hour * H) + 'px)';
    wheelState.hour.listEl.querySelectorAll('.dp-wheel-item').forEach((el, i) => {
      el.classList.remove('selected', 'near', 'far');
      if (i === hour) el.classList.add('selected');
      else if (Math.abs(i - hour) <= 1) el.classList.add('near');
      else el.classList.add('far');
    });
    // 分钟
    wheelState.minute.index = minute;
    wheelState.minute.scrollTop = minute * H;
    wheelState.minute.listEl.style.transform = 'translateY(' + (-minute * H) + 'px)';
    wheelState.minute.listEl.querySelectorAll('.dp-wheel-item').forEach((el, i) => {
      el.classList.remove('selected', 'near', 'far');
      if (i === minute) el.classList.add('selected');
      else if (Math.abs(i - minute) <= 1) el.classList.add('near');
      else el.classList.add('far');
    });
  }

  // 选择时间预设
  function selectTimePreset(preset) {
    const now = new Date();
    const presets = {
      now: { h: now.getHours(), m: now.getMinutes() },
      morning: { h: 8, m: 0 },
      noon: { h: 12, m: 0 },
      evening: { h: 20, m: 0 }
    };
    const p = presets[preset];
    if (!p) return;
    currentHour = p.h;
    currentMinute = p.m;
    setWheelToTime(p.h, p.m);
    timePresetRow.querySelectorAll('.dp-preset').forEach(function (b) {
      b.classList.toggle('active', b.dataset.time === preset);
    });
    activeTimePreset = preset;
  }
  function formatDisplayText() {
    if (!currentDate) return '选择提醒时间（可选）';
    const d = new Date(currentDate);
    const hh = String(currentHour).padStart(2, '0');
    const mm = String(currentMinute).padStart(2, '0');
    const dateStr = (d.getMonth() + 1) + '月' + d.getDate() + '日';
    const timeStr = hh + ':' + mm;
    let text = dateStr + ' ' + timeStr;
    if (currentRecurrence) {
      text += ' · ' + formatRecurrenceShort(currentRecurrence);
    }
    return text;
  }

  function formatRecurrenceShort(r) {
    if (!r || !r.enabled) return '';
    const unitMap = { minute: '分钟', hour: '小时', day: '天', week: '周' };
    let text = '每' + r.interval + unitMap[r.unit];
    // 有目标次数时追加显示（如 "每30分钟 ×8次"）
    if (r.targetCount && r.targetCount > 0) {
      text += ' ×' + r.targetCount + '次';
    }
    return text;
  }

  function formatRecurrenceLong(r) {
    if (!r || !r.enabled) return '';
    const unitMap = { minute: '分钟', hour: '小时', day: '天', week: '周' };
    return '每 ' + r.interval + ' ' + unitMap[r.unit] + '循环';
  }

  // 获取当前选中的完整时间戳
  function getTimestamp() {
    if (!currentDate) return null;
    const d = new Date(currentDate);
    d.setHours(currentHour, currentMinute, 0, 0);
    return d.getTime();
  }

  // 获取循环设置
  function getRecurrence() {
    return currentRecurrence;
  }

  // 打开 popover
  function open() {
    datetimePopover.classList.add('open');
    datetimeTrigger.classList.add('active');
    // 更新"现在"按钮显示
    const nowBtn = document.getElementById('dpNowBtn');
    if (nowBtn) {
      nowBtn.textContent = '现在';
    }
    // 初始化日期为今天
    if (!currentDate) {
      selectDatePreset('today');
    }
  }

  // 关闭 popover
  function close() {
    datetimePopover.classList.remove('open');
    datetimeTrigger.classList.remove('active');
  }

  // 选择日期预设
  function selectDatePreset(preset) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let d = new Date(today);
    switch (preset) {
      case 'today': break;
      case 'tomorrow': d.setDate(d.getDate() + 1); break;
      case 'dayAfter': d.setDate(d.getDate() + 2); break;
      case 'nextWeek':
        const day = d.getDay();
        const diff = day === 1 ? 7 : (8 - day);
        d.setDate(d.getDate() + diff);
        break;
      default: return;
    }
    currentDate = d;
    currentDate.setHours(0, 0, 0, 0);
    // 同步到滚轮
    setWheelToDate(d);
    // 高亮预设按钮
    datePresetRow.querySelectorAll('.dp-preset').forEach(function (b) {
      b.classList.toggle('active', b.dataset.date === preset);
    });
    activeDatePreset = preset;
  }

  // 选择时间预设（旧版保留，已弃用）
  function selectTimePreset_Deprecated(preset) {
    const now = new Date();
    const presets = {
      now: { h: now.getHours(), m: now.getMinutes() },
      morning: { h: 8, m: 0 },
      noon: { h: 12, m: 0 },
      evening: { h: 20, m: 0 }
    };
    const p = presets[preset];
    if (!p) return;
    currentHour = p.h;
    currentMinute = p.m;
    setWheelToTime(p.h, p.m);
    timePresetRow.querySelectorAll('.dp-preset').forEach(function (b) {
      b.classList.toggle('active', b.dataset.time === preset);
    });
    activeTimePreset = preset;
  }

  // 选择循环预设
  function selectCyclePreset(preset) {
    let r = null;
    switch (preset) {
      case '30m': r = { enabled: true, interval: 30, unit: 'minute', targetCount: parseInt(cycleCountInput.value) || null }; break;
      case '1h': r = { enabled: true, interval: 1, unit: 'hour', targetCount: parseInt(cycleCountInput.value) || null }; break;
      case '1d': r = { enabled: true, interval: 1, unit: 'day', targetCount: parseInt(cycleCountInput.value) || null }; break;
      case '1w': r = { enabled: true, interval: 1, unit: 'week', targetCount: parseInt(cycleCountInput.value) || null }; break;
      case 'custom':
        customCycle.style.display = 'flex';
        cycleValueInput.value = cycleValueInput.value || '30';
        cycleUnitSelect.value = cycleUnitSelect.value || 'minute';
        r = {
          enabled: true,
          interval: parseInt(cycleValueInput.value) || 30,
          unit: cycleUnitSelect.value,
          targetCount: parseInt(cycleCountInput.value) || null
        };
        break;
      default: return;
    }
    currentRecurrence = r;
    cyclePresetRow.querySelectorAll('.dp-preset').forEach(function (b) {
      b.classList.toggle('active', b.dataset.cycle === preset);
    });
    activeCyclePreset = preset;
  }

  // 清除所有选择
  function clearAll() {
    currentDate = null;
    currentHour = 8;
    currentMinute = 0;
    currentRecurrence = null;
    activeDatePreset = null;
    activeTimePreset = null;
    activeCyclePreset = null;
    datetimeDisplay.textContent = '选择提醒时间（可选）';
    datetimeDisplay.classList.add('placeholder');
    // 清除预设高亮
    datePresetRow.querySelectorAll('.dp-preset.active').forEach(b => b.classList.remove('active'));
    timePresetRow.querySelectorAll('.dp-preset.active').forEach(b => b.classList.remove('active'));
    cyclePresetRow.querySelectorAll('.dp-preset.active').forEach(b => b.classList.remove('active'));
    // 重置循环
    cycleToggle.checked = false;
    cycleOptions.style.display = 'none';
    customCycle.style.display = 'none';
    cycleCountInput.value = ''; // 清空循环次数
    hourSelect.value = '08';
    minuteSelect.value = '00';
    // 重置滚轮到今天
    const now = new Date();
    setWheelToDate(now);
    setWheelToTime(8, 0);
    close();
  }

  // 同步值到显示（在自然语言解析成功后调用）
  function syncFromTimestamp(timestamp, recurrence) {
    if (timestamp) {
      const d = new Date(timestamp);
      currentDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      currentHour = d.getHours();
      currentMinute = d.getMinutes();
      // 同步到滚轮
      setWheelToDate(currentDate);
      setWheelToTime(currentHour, currentMinute);
    }
    if (recurrence) {
      currentRecurrence = recurrence;
      cycleToggle.checked = true;
      cycleOptions.style.display = 'block';
    }
    updateDisplay();
  }

  function updateDisplay() {
    const text = formatDisplayText();
    datetimeDisplay.textContent = text;
    if (!currentDate) {
      datetimeDisplay.classList.add('placeholder');
    } else {
      datetimeDisplay.classList.remove('placeholder');
    }
  }

  // 绑定事件
  function bind() {
    initWheelPicker();

    // 触发按钮点击 → 打开/关闭
    datetimeTrigger.addEventListener('click', function (e) {
      e.stopPropagation();
      if (datetimePopover.classList.contains('open')) {
        close();
      } else {
        open();
      }
    });

    // 点击外部关闭
    document.addEventListener('click', function (e) {
      if (!datetimePicker.contains(e.target)) {
        close();
      }
    });

    // 日期预设按钮
    datePresetRow.addEventListener('click', function (e) {
      const btn = e.target.closest('.dp-preset');
      if (!btn) return;
      selectDatePreset(btn.dataset.date);
      updateDisplay();
    });

    // 时间预设
    timePresetRow.addEventListener('click', function (e) {
      const btn = e.target.closest('.dp-preset');
      if (!btn) return;
      selectTimePreset(btn.dataset.time);
      updateDisplay();
    });

    // 循环开关
    cycleToggle.addEventListener('change', function () {
      if (cycleToggle.checked) {
        cycleOptions.style.display = 'block';
        // 默认选每 30 分钟
        if (!currentRecurrence || !currentRecurrence.enabled) {
          selectCyclePreset('30m');
          updateDisplay();
        }
      } else {
        cycleOptions.style.display = 'none';
        customCycle.style.display = 'none';
        currentRecurrence = null;
        activeCyclePreset = null;
        cyclePresetRow.querySelectorAll('.dp-preset.active').forEach(b => b.classList.remove('active'));
        updateDisplay();
      }
    });

    // 循环预设
    cyclePresetRow.addEventListener('click', function (e) {
      const btn = e.target.closest('.dp-preset');
      if (!btn) return;
      selectCyclePreset(btn.dataset.cycle);
      updateDisplay();
    });

    // 自定义循环值变化时更新
    cycleValueInput.addEventListener('input', function () {
      if (currentRecurrence && activeCyclePreset === 'custom') {
        currentRecurrence.interval = parseInt(cycleValueInput.value) || 30;
        updateDisplay();
      }
    });
    cycleUnitSelect.addEventListener('change', function () {
      if (currentRecurrence && activeCyclePreset === 'custom') {
        currentRecurrence.unit = cycleUnitSelect.value;
        updateDisplay();
      }
    });
    // 循环次数变化时更新到 recurrence 对象
    cycleCountInput.addEventListener('input', function () {
      if (currentRecurrence && currentRecurrence.enabled) {
        currentRecurrence.targetCount = parseInt(cycleCountInput.value) || null;
      }
    });

    // 清除按钮
    clearBtn.addEventListener('click', function () {
      clearAll();
    });

    // 确定按钮：关闭 popover（实际提交在 wrappedAddTodo 中处理）
    confirmBtn.addEventListener('click', function () {
      if (!currentDate) {
        // 没有选日期，关闭不做任何事
        close();
        return;
      }
      updateDisplay();
      close();
    });

    // ESC 关闭
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && datetimePopover.classList.contains('open')) {
        close();
      }
    });
  }

  // 公开接口
  return {
    bind: bind,
    getTimestamp: getTimestamp,
    getRecurrence: getRecurrence,
    syncFromTimestamp: syncFromTimestamp,
    clearAll: clearAll,
    formatRecurrenceShort: formatRecurrenceShort,
    formatRecurrenceLong: formatRecurrenceLong
  };
})();

// 启动日期选择器
datetimePickerModule.bind();
