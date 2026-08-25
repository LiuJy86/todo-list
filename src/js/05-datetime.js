// ===== 10.5 自定义日期时间选择器（Popover 浮层）=====
// v2.4.0 新增：替代原生 datetime-local，支持日期/时间/循环三合一设置

const datetimePickerModule = (function () {
  // 模块内部状态
  let currentDate = null;       // 开始日期 (Date 对象，时间部分为 00:00)
  let currentHour = 8;          // 开始小时
  let currentMinute = 0;        // 开始分钟
  let currentEndDate = null;    // 结束日期 (Date 对象，可选)
  let currentEndHour = 9;       // 结束小时
  let currentEndMinute = 0;     // 结束分钟
  let endRemindBefore = 0;      // 结束前提醒分钟数，0=不提醒
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
  const hourInput = document.getElementById('dpHourInput');
  const minuteInput = document.getElementById('dpMinuteInput');
  const monthInput = document.getElementById('dpMonthInput');
  const dayInput = document.getElementById('dpDayInput');
  const endMonthInput = document.getElementById('dpEndMonthInput');
  const endDayInput = document.getElementById('dpEndDayInput');
  const endHourInput = document.getElementById('dpEndHourInput');
  const endMinuteInput = document.getElementById('dpEndMinuteInput');
  const startToggle = document.getElementById('dpStartToggle');
  const startOptions = document.getElementById('dpStartOptions');
  const endToggle = document.getElementById('dpEndToggle');
  const endOptions = document.getElementById('dpEndOptions');
  const beforeToggle = document.getElementById('dpBeforeToggle');
  const beforeOptions = document.getElementById('dpBeforeOptions');
  const beforeInput = document.getElementById('dpBeforeInput');
  const timePresetRow = document.getElementById('dpTimePresets');
  const endTimePresetRow = document.getElementById('dpEndTimePresets');
  const cycleToggle = document.getElementById('dpCycleToggle');
  const cycleOptions = document.getElementById('dpCycleOptions');
  const cyclePresetRow = document.getElementById('dpCyclePresets');
  const customCycle = document.getElementById('dpCustomCycle');
  const cycleValueInput = document.getElementById('dpCycleValue');
  const cycleUnitSelect = document.getElementById('dpCycleUnit');
  const cycleCountInput = document.getElementById('dpCycleCount'); // 循环次数输入框
  const clearBtn = document.getElementById('dpClearBtn');
  const confirmBtn = document.getElementById('dpConfirmBtn');

  // ========== 日期输入（月/日） ==========

  // 获取指定年月的天数
  function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  // 初始化日期输入框
  function initDateInputs() {
    // 初始化输入框默认值
    updateDateInputs();
    updateTimeInputs();
    updateEndDateInputs();
    updateEndTimeInputs();
  }

  // 同步开始月/日到输入框
  function updateDateInputs() {
    if (!currentDate) return;
    if (monthInput) monthInput.value = String(currentDate.getMonth() + 1);
    if (dayInput) dayInput.value = String(currentDate.getDate());
  }

  // 同步结束月/日到输入框
  function updateEndDateInputs() {
    if (!currentEndDate) return;
    if (endMonthInput) endMonthInput.value = String(currentEndDate.getMonth() + 1);
    if (endDayInput) endDayInput.value = String(currentEndDate.getDate());
  }

  // 同步开始时/分到输入框
  function updateTimeInputs() {
    if (hourInput) hourInput.value = String(currentHour).padStart(2, '0');
    if (minuteInput) minuteInput.value = String(currentMinute).padStart(2, '0');
  }

  // 同步结束时/分到输入框
  function updateEndTimeInputs() {
    if (endHourInput) endHourInput.value = String(currentEndHour).padStart(2, '0');
    if (endMinuteInput) endMinuteInput.value = String(currentEndMinute).padStart(2, '0');
  }

  // 开始日期输入变化回调
  function onDateInputChange() {
    let m = parseInt(monthInput.value, 10);
    let d = parseInt(dayInput.value, 10);
    const y = currentDate ? currentDate.getFullYear() : new Date().getFullYear();

    if (isNaN(m) || m < 1) m = 1;
    if (m > 12) m = 12;

    const maxDay = getDaysInMonth(y, m);
    if (isNaN(d) || d < 1) d = 1;
    if (d > maxDay) d = maxDay;

    currentDate = new Date(y, m - 1, d);
    currentDate.setHours(0, 0, 0, 0);

    // 同步回输入框（修正非法值）
    if (monthInput) monthInput.value = String(m);
    if (dayInput) dayInput.value = String(d);

    activeDatePreset = null;
    datePresetRow.querySelectorAll('.dp-preset.active').forEach(b => b.classList.remove('active'));
    updateDisplay();
  }

  // 结束日期输入变化回调
  function onEndDateInputChange() {
    let m = parseInt(endMonthInput.value, 10);
    let d = parseInt(endDayInput.value, 10);
    const y = currentEndDate ? currentEndDate.getFullYear() : (currentDate ? currentDate.getFullYear() : new Date().getFullYear());

    if (isNaN(m) || m < 1) m = 1;
    if (m > 12) m = 12;

    const maxDay = getDaysInMonth(y, m);
    if (isNaN(d) || d < 1) d = 1;
    if (d > maxDay) d = maxDay;

    currentEndDate = new Date(y, m - 1, d);
    currentEndDate.setHours(0, 0, 0, 0);

    // 同步回输入框（修正非法值）
    if (endMonthInput) endMonthInput.value = String(m);
    if (endDayInput) endDayInput.value = String(d);

    updateDisplay();
  }

  // 结束时间输入变化回调
  function onEndTimeInputChange() {
    let h = parseInt(endHourInput.value, 10);
    let m = parseInt(endMinuteInput.value, 10);

    if (isNaN(h) || h < 0) h = 0;
    if (h > 23) h = 23;
    if (isNaN(m) || m < 0) m = 0;
    if (m > 59) m = 59;

    currentEndHour = h;
    currentEndMinute = m;

    if (endHourInput) endHourInput.value = String(h).padStart(2, '0');
    if (endMinuteInput) endMinuteInput.value = String(m).padStart(2, '0');

    updateDisplay();
  }

  // 结束前提醒变化回调
  function onBeforeInputChange() {
    let v = parseInt(beforeInput.value, 10);
    if (isNaN(v) || v < 1) v = 0;
    if (v > 999) v = 999;
    endRemindBefore = v;
    if (v === 0) {
      beforeInput.value = '';
    }
    updateDisplay();
  }

  // 时间变化回调（由输入框触发）
  function onTimeChange() {
    activeTimePreset = null;
    timePresetRow.querySelectorAll('.dp-preset.active').forEach(b => b.classList.remove('active'));
    updateDisplay();
  }

  // 同步指定开始日期到输入框
  function setDateInputs(date) {
    if (!date) return;
    if (monthInput) monthInput.value = String(date.getMonth() + 1);
    if (dayInput) dayInput.value = String(date.getDate());
  }

  // 同步指定结束日期到输入框
  function setEndDateInputs(date) {
    if (!date) return;
    if (endMonthInput) endMonthInput.value = String(date.getMonth() + 1);
    if (endDayInput) endDayInput.value = String(date.getDate());
  }

  // 获取结束时间戳（无结束时间返回 null）
  function getEndTimestamp() {
    if (!currentEndDate) return null;
    const d = new Date(currentEndDate);
    d.setHours(currentEndHour, currentEndMinute, 0, 0);
    return d.getTime();
  }

  // 获取结束前提醒分钟数
  function getEndRemindBefore() {
    return endRemindBefore;
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
    updateTimeInputs();
    timePresetRow.querySelectorAll('.dp-preset').forEach(function (b) {
      b.classList.toggle('active', b.dataset.time === preset);
    });
    activeTimePreset = preset;
  }

  // 结束时间快捷预设：+1小时、+2小时、明天、下周
  function selectEndTimePreset(preset) {
    if (!currentDate) return;
    // 基于开始时间计算结束时间
    const startTs = new Date(currentDate);
    startTs.setHours(currentHour, currentMinute, 0, 0);

    let endTs;
    const presets = {
      '1h': 60 * 60 * 1000,
      '2h': 2 * 60 * 60 * 1000,
      '明天': 24 * 60 * 60 * 1000,
      '下周': 7 * 24 * 60 * 60 * 1000
    };

    if (presets[preset]) {
      endTs = new Date(startTs.getTime() + presets[preset]);
    } else {
      return;
    }

    currentEndDate = new Date(endTs);
    currentEndDate.setHours(0, 0, 0, 0);
    currentEndHour = endTs.getHours();
    currentEndMinute = endTs.getMinutes();
    setEndDateInputs(currentEndDate);
    updateEndTimeInputs();

    // 高亮当前预设按钮
    if (endTimePresetRow) {
      endTimePresetRow.querySelectorAll('.dp-preset').forEach(function (b) {
        b.classList.toggle('active', b.dataset.endTime === preset);
      });
    }
    updateDisplay();
  }

  function formatDisplayText() {
    if (!currentDate) return '选择提醒时间（可选）';
    const d = new Date(currentDate);
    const hh = String(currentHour).padStart(2, '0');
    const mm = String(currentMinute).padStart(2, '0');
    const dateStr = (d.getMonth() + 1) + '月' + d.getDate() + '日';
    let text = dateStr + ' ' + hh + ':' + mm;

    // 结束时间
    if (currentEndDate) {
      const ed = new Date(currentEndDate);
      const eh = String(currentEndHour).padStart(2, '0');
      const em = String(currentEndMinute).padStart(2, '0');
      const endDateStr = (ed.getMonth() + 1) + '月' + ed.getDate() + '日';
      if (dateStr === endDateStr) {
        text += ' ~ ' + eh + ':' + em;
      } else {
        text += ' ~ ' + endDateStr + ' ' + eh + ':' + em;
      }
    }

    // 结束前提醒
    if (endRemindBefore > 0) {
      text += ' (前' + endRemindBefore + '分)';
    }

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
    // 同步到输入框
    setDateInputs(d);
    // 高亮预设按钮
    datePresetRow.querySelectorAll('.dp-preset').forEach(function (b) {
      b.classList.toggle('active', b.dataset.date === preset);
    });
    activeDatePreset = preset;
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
    currentEndDate = null;
    currentEndHour = 9;
    currentEndMinute = 0;
    endRemindBefore = 0;
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
    if (hourInput) hourInput.value = '';
    if (minuteInput) minuteInput.value = '';
    if (monthInput) monthInput.value = '';
    if (dayInput) dayInput.value = '';
    // 重置开始时间
    if (startToggle) startToggle.checked = false;
    if (startOptions) startOptions.style.display = 'none';
    // 重置结束时间
    if (endToggle) endToggle.checked = false;
    if (endOptions) endOptions.style.display = 'none';
    if (endMonthInput) endMonthInput.value = '';
    if (endDayInput) endDayInput.value = '';
    if (endHourInput) endHourInput.value = '';
    if (endMinuteInput) endMinuteInput.value = '';
    // 重置结束前提醒
    if (beforeToggle) beforeToggle.checked = false;
    if (beforeOptions) beforeOptions.style.display = 'none';
    if (beforeInput) beforeInput.value = '';
    currentHour = 8;
    currentMinute = 0;
    currentEndHour = 9;
    currentEndMinute = 0;
    endRemindBefore = 0;
    close();
  }

  // 同步值到显示（在自然语言解析成功后调用）
  function syncFromTimestamp(timestamp, recurrence, endTimestamp, beforeMinutes) {
    if (timestamp) {
      const d = new Date(timestamp);
      currentDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      currentHour = d.getHours();
      currentMinute = d.getMinutes();
      // 同步到日期和时间输入框
      setDateInputs(currentDate);
      updateTimeInputs();
      // 展开开始时间区域
      if (startToggle) startToggle.checked = true;
      if (startOptions) startOptions.style.display = 'block';
    }
    // 同步结束时间
    if (endTimestamp) {
      const ed = new Date(endTimestamp);
      currentEndDate = new Date(ed.getFullYear(), ed.getMonth(), ed.getDate());
      currentEndHour = ed.getHours();
      currentEndMinute = ed.getMinutes();
      setEndDateInputs(currentEndDate);
      updateEndTimeInputs();
      if (endToggle) endToggle.checked = true;
      if (endOptions) endOptions.style.display = 'block';
    }
    // 同步结束前提醒
    if (beforeMinutes && beforeMinutes > 0) {
      endRemindBefore = beforeMinutes;
      if (beforeInput) beforeInput.value = String(beforeMinutes);
      if (beforeToggle) beforeToggle.checked = true;
      if (beforeOptions) beforeOptions.style.display = 'block';
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
    initDateInputs();

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

    // 输入框直接输入时/分
    function onTimeInputChange() {
      let h = parseInt(hourInput.value, 10);
      let m = parseInt(minuteInput.value, 10);
      if (isNaN(h) || h < 0) h = 0;
      if (h > 23) h = 23;
      if (isNaN(m) || m < 0) m = 0;
      if (m > 59) m = 59;
      currentHour = h;
      currentMinute = m;
      activeTimePreset = null;
      timePresetRow.querySelectorAll('.dp-preset.active').forEach(b => b.classList.remove('active'));
      updateDisplay();
    }
    if (hourInput) {
      hourInput.addEventListener('change', onTimeInputChange);
      hourInput.addEventListener('blur', onTimeInputChange);
    }
    if (minuteInput) {
      minuteInput.addEventListener('change', onTimeInputChange);
      minuteInput.addEventListener('blur', onTimeInputChange);
    }

    // 输入框直接输入月/日
    if (monthInput) {
      monthInput.addEventListener('change', onDateInputChange);
      monthInput.addEventListener('blur', onDateInputChange);
    }
    if (dayInput) {
      dayInput.addEventListener('change', onDateInputChange);
      dayInput.addEventListener('blur', onDateInputChange);
    }

    // 开始时间开关
    if (startToggle) {
      startToggle.addEventListener('change', function () {
        if (startToggle.checked) {
          startOptions.style.display = 'block';
        } else {
          startOptions.style.display = 'none';
          // 清除开始时间
          currentDate = null;
          currentHour = 8;
          currentMinute = 0;
          activeDatePreset = null;
          activeTimePreset = null;
          if (monthInput) monthInput.value = '';
          if (dayInput) dayInput.value = '';
          if (hourInput) hourInput.value = '';
          if (minuteInput) minuteInput.value = '';
          // 取消预设高亮
          if (datePresetRow) {
            datePresetRow.querySelectorAll('.dp-preset').forEach(function (b) {
              b.classList.remove('active');
            });
          }
          if (timePresetRow) {
            timePresetRow.querySelectorAll('.dp-preset').forEach(function (b) {
              b.classList.remove('active');
            });
          }
          updateDisplay();
        }
      });
    }

    // 结束时间开关
    if (endToggle) {
      endToggle.addEventListener('change', function () {
        if (endToggle.checked) {
          endOptions.style.display = 'block';
          // 默认结束日期=开始日期，时间=开始时间+1小时
          if (!currentEndDate && currentDate) {
            currentEndDate = new Date(currentDate);
            currentEndHour = currentHour + 1;
            currentEndMinute = currentMinute;
            if (currentEndHour > 23) currentEndHour = 23;
            setEndDateInputs(currentEndDate);
            updateEndTimeInputs();
          }
        } else {
          endOptions.style.display = 'none';
          currentEndDate = null;
          updateDisplay();
        }
      });
    }

    // 结束时间输入框
    if (endMonthInput) {
      endMonthInput.addEventListener('change', onEndDateInputChange);
      endMonthInput.addEventListener('blur', onEndDateInputChange);
    }
    if (endDayInput) {
      endDayInput.addEventListener('change', onEndDateInputChange);
      endDayInput.addEventListener('blur', onEndDateInputChange);
    }
    if (endHourInput) {
      endHourInput.addEventListener('change', onEndTimeInputChange);
      endHourInput.addEventListener('blur', onEndTimeInputChange);
    }
    if (endMinuteInput) {
      endMinuteInput.addEventListener('change', onEndTimeInputChange);
      endMinuteInput.addEventListener('blur', onEndTimeInputChange);
    }

    // 结束前提醒开关
    if (beforeToggle) {
      beforeToggle.addEventListener('change', function () {
        if (beforeToggle.checked) {
          beforeOptions.style.display = 'block';
          if (endRemindBefore === 0) {
            endRemindBefore = 15;
            beforeInput.value = '15';
          }
        } else {
          beforeOptions.style.display = 'none';
          endRemindBefore = 0;
          if (beforeInput) beforeInput.value = '';
        }
        updateDisplay();
      });
    }

    // 结束前提醒输入框
    if (beforeInput) {
      beforeInput.addEventListener('change', onBeforeInputChange);
      beforeInput.addEventListener('blur', onBeforeInputChange);
    }

    // 结束时间快捷预设
    if (endTimePresetRow) {
      endTimePresetRow.addEventListener('click', function (e) {
        var btn = e.target.closest('.dp-preset');
        if (!btn) return;
        selectEndTimePreset(btn.dataset.endTime);
      });
    }

    // 结束前提醒预设按钮
    var beforePresets = document.querySelector('.dp-before-presets');
    if (beforePresets) {
      beforePresets.addEventListener('click', function (e) {
        var btn = e.target.closest('.dp-preset');
        if (!btn) return;
        var mins = parseInt(btn.dataset.before, 10);
        if (isNaN(mins)) return;
        endRemindBefore = mins;
        beforeInput.value = String(mins);
        // 自动开启开关
        if (!beforeToggle.checked) {
          beforeToggle.checked = true;
          beforeOptions.style.display = 'block';
        }
        updateDisplay();
      });
    }

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
    getEndTimestamp: getEndTimestamp,
    getEndRemindBefore: getEndRemindBefore,
    getRecurrence: getRecurrence,
    syncFromTimestamp: syncFromTimestamp,
    clearAll: clearAll,
    formatRecurrenceShort: formatRecurrenceShort,
    formatRecurrenceLong: formatRecurrenceLong
  };
})();

// 启动日期选择器
datetimePickerModule.bind();
