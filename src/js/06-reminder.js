// ===== 11. 提醒模块（提醒日期 + 音效）=====
// 独立 IIFE 封装，避免污染全局。对外暴露 window.reminderModule 接口供其他模块调用。
// 功能：自然语言解析提醒时间 / Web Audio 程序合成提示音 / 精确 setTimeout 调度 / 漏检补触发

(function () {
  'use strict';

  // ---------- 11.1 模块状态 ----------
  // 调度表：key 为 todo.id，value 为 setTimeout 返回的 timerId
  // 用于在事项被删除/完成/重新编辑时取消旧定时器，避免幽灵提醒
  const reminderTimers = new Map();
  // AudioContext 实例（首次用户交互后创建并 resume）
  let audioCtx = null;


  // ---------- 11.2 时间格式化 ----------

  // 把 Date 对象转换为 datetime-local 输入框接受的格式：yyyy-MM-ddTHH:mm
  // 注意：datetime-local 不接受秒，也不接受时区后缀
  function formatToLocalInputValue(date) {
    const yyyy = date.getFullYear();
    const MM = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const HH = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return yyyy + '-' + MM + '-' + dd + 'T' + HH + ':' + mm;
  }


  // ---------- 11.3 自然语言解析 ----------

  // ===== 农历数据表（1900-2100年）=====
  // 每个条目用 20 位二进制编码一年的农历信息：
  //   位 0-3：闰月月份（0=无闰月，1-12=闰几月）
  //   位 4-15：12个月，每位表示该月天数（1=30天，0=29天）
  //   位 16：闰月天数（1=30天，0=29天）
  const lunarInfo = [
    0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
    0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
    0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
    0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
    0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
    0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5d0, 0x14573, 0x052d0, 0x0a9a8, 0x0e950, 0x06aa0,
    0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
    0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b5a0, 0x195a6,
    0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
    0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0,
    0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
    0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
    0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
    0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
    0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
    0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
    0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
    0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
    0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
    0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
    0x0d520
  ];

  // 农历 1900 年正月初一对应的阳历日期：1900-01-31
  const LUNAR_BASE_DATE = new Date(1900, 0, 31);

  // 获取某农历年的闰月月份（0=无闰月）
  function getLunarLeapMonth(year) {
    return lunarInfo[year - 1900] & 0xf;
  }

  // 获取某农历年闰月的天数（0=无闰月）
  function getLunarLeapDays(year) {
    const leapMonth = getLunarLeapMonth(year);
    if (leapMonth === 0) return 0;
    return (lunarInfo[year - 1900] & 0x10000) ? 30 : 29;
  }

  // 获取某农历年某月的天数（1-12月）
  // 编码规则：bit 4 = 1月, bit 5 = 2月, ..., bit 15 = 12月（1=30天, 0=29天）
  function getLunarMonthDays(year, month) {
    const mask = 1 << (4 + month - 1); // month 1 → bit 4, month 12 → bit 15
    return (lunarInfo[year - 1900] & mask) ? 30 : 29;
  }

  // 获取某农历年的总天数
  function getLunarYearDays(year) {
    let sum = 348; // 12个月 × 29天（基础）
    // 统计 bits 4-15 中有多少位为 1（即有多少个月是 30 天）
    for (let bit = 4; bit <= 15; bit++) {
      sum += (lunarInfo[year - 1900] & (1 << bit)) ? 1 : 0;
    }
    return sum + getLunarLeapDays(year);
  }

  // 农历转阳历（返回 { year, month, day }）
  function lunarToSolar(lunarYear, lunarMonth, lunarDay, isLeapMonth) {
    // 计算从 1900-01-31 到目标农历日期的天数偏移
    let offset = 0;
    // 累加整年
    for (let y = 1900; y < lunarYear; y++) {
      offset += getLunarYearDays(y);
    }
    // 累加当年月份
    const leapMonth = getLunarLeapMonth(lunarYear);
    for (let m = 1; m < lunarMonth; m++) {
      offset += getLunarMonthDays(lunarYear, m);
    }
    // 如果目标月在闰月之后，需要加上闰月天数
    if (leapMonth > 0 && lunarMonth > leapMonth) {
      offset += getLunarLeapDays(lunarYear);
    }
    // 如果是闰月，需要加上前面所有月份 + 闰月之前的天数
    if (isLeapMonth) {
      offset += getLunarMonthDays(lunarYear, lunarMonth); // 先加本月（非闰月）
      offset += getLunarLeapDays(lunarYear); // 再加闰月
    }
    // 加上当月的天数偏移
    offset += lunarDay - 1;
    // 计算阳历日期
    const solarDate = new Date(LUNAR_BASE_DATE.getTime() + offset * 24 * 60 * 60 * 1000);
    return {
      year: solarDate.getFullYear(),
      month: solarDate.getMonth() + 1,
      day: solarDate.getDate()
    };
  }

  // 中文数字 → 阿拉伯数字映射（用于解析"七点""半小时"等中文表达）
  const CN_NUM = {
    '零': 0, '半': 0.5, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
    '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20, '廿': 20,
    '三十': 30, '卅': 30, '四十': 40, '五十': 50, '六十': 60, '七十': 70,
    '八十': 80, '九十': 90, '百': 100
  };

  // 把中文数字字符串转为整数（支持"七""十二""二十""廿九""三十一""一百"等）
  function cnToNumber(str) {
    if (/^\d+$/.test(str)) return parseInt(str, 10);       // 纯数字直接返回
    if (CN_NUM[str] !== undefined) return CN_NUM[str];       // 查表
    // 组合数字：廿/卅 + [一~九]，如"廿九"=29、"卅一"=31
    const nianRe = /^([廿卅])([一二两三四五六七八九])?$/;
    const mNian = str.match(nianRe);
    if (mNian) {
      const base = CN_NUM[mNian[1]]; // 廿=20, 卅=30
      const ones = mNian[2] ? CN_NUM[mNian[2]] : 0;
      return base + ones;
    }
    // 组合数字：[X十][Y] 模式，如"二十一"=21、"三十一"=31、"九十九"=99
    const comboRe = /^([一二两三四五六七八九])十([一二两三四五六七八九])?$/;
    const m = str.match(comboRe);
    if (m) {
      const tens = CN_NUM[m[1]];
      const ones = m[2] ? CN_NUM[m[2]] : 0;
      if (tens !== undefined && (m[2] === undefined || ones !== undefined)) {
        return tens * 10 + ones;
      }
    }
    // 组合数字：[X百][Y十][Z] 模式，如"一百"=100、"一百零一"=100
    const hundredRe = /^([一二两三四五六七八九])百(([一二两三四五六七八九])十)?([一二两三四五六七八九])?$/;
    const m2 = str.match(hundredRe);
    if (m2) {
      const hundreds = CN_NUM[m2[1]] * 100;
      const tens = m2[3] ? CN_NUM[m2[3]] * 10 : 0;
      const ones = m2[4] ? CN_NUM[m2[4]] : 0;
      return hundreds + tens + ones;
    }
    return NaN;
  }

  // 预处理：中文月份/日期 → 阿拉伯数字
  // 例："八月十五号提醒我开会" → "8月15提醒我开会"
  //     "十二月三十一日" → "12月31"
  //     "8/15提醒我吃饭" → "8月15提醒我吃饭"
  function convertChineseDate(text) {
    // 斜杠日期：8/15、12/31 → 8月15、12月31
    text = text.replace(/(\d{1,2})\/(\d{1,2})/g, '$1月$2');
    // 中文月份：X月（一月~十二月），如"八月"→"8月"、"十二月"→"12月"
    const cnMonthRe = /([一二两三四五六七八九十]+)月/g;
    text = text.replace(cnMonthRe, function (match, cnMonth) {
      const num = cnToNumber(cnMonth);
      return isNaN(num) ? match : (num + '月');
    });
    // 中文日期：X号/X日（一号~三十一号），如"十五号"→"15"、"三十一日"→"31"
    // 注意：前面不能是"周"（避免把"周五"中的"五"误转）
    //       后面不能跟"点"（避免把"七点"中的"七"误转）
    //       后面不能跟"刻"（避免把"一刻"中的"一"误转）
    const cnDayRe = /(?<!周)([一二两三四五六七八九十]+)(?![点刻])(号|日)?/g;
    text = text.replace(cnDayRe, function (match, cnDay, suffix) {
      // 只转换合理的日期数字（1-31），避免误转换其他中文数字
      const num = cnToNumber(cnDay);
      if (isNaN(num) || num < 1 || num > 31) return match;
      return num + '';
    });
    return text;
  }

  // 解析文本中的提醒时间，并返回剥离时间词后的纯事项文本
  // 支持规则（按优先级从高到低）：
  //   "八月十五号提醒我开会" → 当年 8 月 15 日 9:00（已过则明年），文本"开会"
  //   "8月15日 8:00"       → 当年 8 月 15 日 8:00（已过则明年）
  //   "明天8:00"           → 明天 8:00
  //   "后天早上体检"        → 后天 8:00
  //   "大后天提醒我面试"    → 3 天后 9:00
  //   "下周一提醒我交周报"  → 下周一 9:00
  //   "周五晚上聚会"        → 周五 19:00
  //   "每30分钟提醒我喝水"  → 30 分钟后 + 自动开启循环
  //   "每天8点起床"        → 今天 8:00 + 自动开启循环
  //   "半小时后提醒我喝水"  → 30 分钟后，文本"喝水"
  //   "1小时后"/"两小时后"  → 1/2 小时后
  //   "七点提醒我洗澡"      → 今天 7:00（已过则明天），文本"洗澡"
  //   "八点半提醒我睡觉"    → 今天 8:30（已过则明天），文本"睡觉"
  //   "早上8点跑步"        → 今天 8:00（已过则明天）
  //   "晚上9点关灯"        → 今天 21:00
  //   "今天晚上八点半"      → 今天 20:30（已过则明天）
  //   "明天下午三点"        → 明天 15:00
  //   "一会儿提醒我"        → 5 分钟后
  //   "8:00"               → 今天 8:00（已过则明天）
  //   "过10分钟"           → 10 分钟后（新）
  //   "再过2小时"          → 2 小时后（新）
  //   "大后天"             → 3 天后（新）
  //   "明天早上"           → 明天 7:00（新）
  //   "后天下午"           → 后天 15:00（新）
  // 失败：返回 { text: 原文, remindAt: null, recurrence: null }
  function parseReminderFromText(rawText) {
    // 预处理：先把中文月份/日期转为阿拉伯数字（如"八月十五号"→"8月15日"）
    // 但农历日期需要保留中文数字用于转换，所以先标记农历前缀
    let text = convertChineseDate(rawText.trim());
    let remindAt = null;
    let recurrence = null;   // 循环设置（每X 模式时自动填充）
    const now = new Date();

    // ===== 预处理：提取"提醒我XXX"中的事项内容 =====
    const remindActionRe = /(?:提醒我|提醒|叫我)([一-龥a-zA-Z0-9]+)/;
    const actionMatch = text.match(remindActionRe);

    // ===== 辅助函数：构造返回结果并清理文本 =====
    function result(finalText, ts) {
      let t = finalText.trim();
      // 清理残留的"提醒我/提醒/叫我"前缀，提取真正的动作
      t = t.replace(/^(提醒我|提醒|叫我)\s*/, '').trim();
      // 清理末尾可能残留的"提醒我/提醒/叫我"
      t = t.replace(/\s*(提醒我|提醒|叫我)$/, '').trim();
      // 如果剥离后为空但有"提醒我XXX"的动作，用动作作为文本
      if (!t && actionMatch) t = actionMatch[1];
      return { text: t || rawText, remindAt: ts, recurrence: recurrence };
    }

    // ===== 辅助函数：从文本开头解析时段词+时间 =====
    // 支持："早上8点"、"下午3：30"、"晚上"（纯时段）、"8：30"（纯时间）
    // 返回 { hour, min, matchedLength, period }
    function parsePeriodAndTime(str) {
      const periodMap = { '早上': 7, '早晨': 7, '上午': 9, '中午': 12, '下午': 15, '晚上': 19, '凌晨': 0 };
      const periodOffset = { '早上': 0, '早晨': 0, '上午': 0, '中午': 12, '下午': 12, '晚上': 12, '凌晨': 0 };
      let hour = 9, min = 0, length = 0, period = '';
      // 先匹配时段词
      const mPeriod = str.match(/^(早上|早晨|上午|中午|下午|晚上|凌晨)\s*/);
      if (mPeriod) {
        period = mPeriod[1];
        hour = periodMap[period] || 9;
        length = mPeriod[0].length;
      }
      // 再匹配具体时间（覆盖时段默认值）
      // 支持格式：
      //   数字+冒号：8:30、8：30、15:45
      //   数字+点系列：8点、8点半、8点整、8点30分、8点30
      //   中文+点系列：八点、八点半、八点整、九点一刻、八点二十分、八点二十
      const remaining = str.slice(length);
      let mTime = null;

      // 尝试匹配：数字+冒号 (8:30, 8：30)
      mTime = remaining.match(/^(\d{1,2})[：:](\d{2})/);
      if (mTime) {
        hour = parseInt(mTime[1], 10);
        min = parseInt(mTime[2], 10) || 0;
      } else {
        // 尝试匹配：数字+点系列 (8点, 8点半, 8点整, 8点30分, 8点30)
        // 注意：长的后缀放前面（点半、点整、点一刻），避免"点"先匹配导致"点半"被截断
        mTime = remaining.match(/^(\d{1,2})(点半|点整|点一刻|点(\d{1,2})分?|点)/);
        if (mTime) {
          hour = parseInt(mTime[1], 10);
          const suffix = mTime[2];
          if (suffix === '点半') min = 30;
          else if (suffix === '点整') min = 0;
          else if (suffix === '点一刻') min = 15;
          else if (suffix.startsWith('点')) min = parseInt(mTime[3] || '0', 10);  // mTime[3]是分钟数字
          else min = 0;
        } else {
          // 尝试匹配：中文+点系列 (八点, 八点半, 八点整, 九点一刻, 八点二十分, 八点二十, 八点30分)
          // 同样：长的后缀放前面
          mTime = remaining.match(/^([一二两三四五六七八九十]+)(点半|点整|点一刻|点([一二两三四五六七八九十]+)分?|点(\d{1,2})分?|点)/);
          if (mTime) {
            hour = cnToNumber(mTime[1]);
            const suffix = mTime[2];
            if (suffix === '点半') min = 30;
            else if (suffix === '点整') min = 0;
            else if (suffix === '点一刻') min = 15;
            else if (suffix.startsWith('点')) {
              // 中文分钟或数字分钟 (mTime[3]是中文分钟, mTime[4]是数字分钟)
              if (mTime[3]) min = cnToNumber(mTime[3]) || 0;
              else if (mTime[4]) min = parseInt(mTime[4], 10);
              else min = 0;
            }
            else min = 0;
          }
        }
      }

      if (mTime) {
        // 有时段词且时间为 12 小时制（<12），加偏移转 24 小时制
        if (period && hour < 12 && periodOffset[period] > 0) hour += periodOffset[period];
        length += mTime[0].length;
      }
      return { hour, min, matchedLength: length, period };
    }

      // ===== 规则 0.5：农历日期（农历X月Y日 → 转换为阳历）=====
    // 例：农历八月十五提醒我赏月、农历正月初一拜年、农历腊月三十除夕
    // 注意：农历日期前面有"农历"或"阴历"前缀
    // 支持"正月"=1月、"腊月"=12月、"闰X月"、"初一"~"初十"
    // 因为 convertChineseDate 会把中文数字转成阿拉伯数字，所以这里用原始文本匹配
    const rawTextTrimmed = rawText.trim();
    const lunarRe = /(农历|阴历)\s*(闰)?(正|腊|[一二两三四五六七八九十廿]+)月(初[一二三四五六七八九十]|[一二两三四五六七八九十廿]+)(?:号|日)?/;
    const mLunar = rawTextTrimmed.match(lunarRe);
    if (mLunar) {
      const isLeap = !!mLunar[2]; // 是否闰月
      // 处理特殊月份名称："正月"=1月，"腊月"=12月
      let lunarMonthStr = mLunar[3];
      let lunarMonth;
      if (lunarMonthStr === '正') lunarMonth = 1;
      else if (lunarMonthStr === '腊') lunarMonth = 12;
      else lunarMonth = cnToNumber(lunarMonthStr);
      // 处理日期："初X"格式（初一~初十）
      let lunarDayStr = mLunar[4];
      let lunarDay;
      if (lunarDayStr.startsWith('初')) {
        // "初"后面的数字：初一=1, 初二=2, ..., 初十=10
        const dayNum = cnToNumber(lunarDayStr.slice(1));
        lunarDay = isNaN(dayNum) ? NaN : dayNum;
      } else {
        lunarDay = cnToNumber(lunarDayStr);
      }
      if (!isNaN(lunarMonth) && !isNaN(lunarDay) && lunarMonth >= 1 && lunarMonth <= 12 && lunarDay >= 1 && lunarDay <= 30) {
        // 尝试用当前年份转换，如果已过则用下一年
        const currentYear = now.getFullYear();
        let solar = lunarToSolar(currentYear, lunarMonth, lunarDay, isLeap);
        let d = new Date(solar.year, solar.month - 1, solar.day, 9, 0, 0);
        // 解析农历日期后面的时段词+时间（从原始文本截取）
        const afterLunar = rawTextTrimmed.slice(mLunar[0].length);
        const pt = parsePeriodAndTime(afterLunar);
        d.setHours(pt.hour, pt.min, 0, 0);
        if (d.getTime() <= now.getTime()) {
          // 今年已过，尝试明年
          solar = lunarToSolar(currentYear + 1, lunarMonth, lunarDay, isLeap);
          d = new Date(solar.year, solar.month - 1, solar.day, pt.hour, pt.min, 0);
        }
        remindAt = d.getTime();
        // 从原始文本中截取农历日期之后的部分
        const afterLunarRaw = rawTextTrimmed.slice(mLunar[0].length);
        text = afterLunarRaw.slice(pt.matchedLength).trim();
        return result(text, remindAt);
      }
    }

    // ===== 规则 1：明确日期（X月Y日/号，"日/号"可选） + 可选时段/时间 =====
    // 例：8月15日 8:00、8月15、8月15日八点、八月十五上午、8月15号下午3点
    const dateRe = /(\d{1,2})月(\d{1,2})[日号]?\s*/;
    const m1 = text.match(dateRe);
    if (m1) {
      const month = parseInt(m1[1], 10);
      const day = parseInt(m1[2], 10);
      // 日期后面可能跟时段词+时间，用辅助函数解析
      const pt = parsePeriodAndTime(text.slice(m1[0].length));
      const d = new Date(now.getFullYear(), month - 1, day, pt.hour, pt.min, 0);
      if (d.getTime() <= now.getTime()) d.setFullYear(d.getFullYear() + 1); // 已过则明年
      remindAt = d.getTime();
      text = text.slice(m1[0].length + pt.matchedLength).trim();
      return result(text, remindAt);
    }

    // ===== 规则 1.5：纯日期（仅"日"部分，无月份）+ 可选时段/时间 =====
    // 例：十五号、15号、15日、十五号下午 → 当月该日（已过则下月）
    // 排除：后面跟"：/:"/"点"（时间）或"分钟/小时/天"（相对时间）的数字
    const dayOnlyRe = /^(\d{1,2})号?日?\s*/;
    const mDayOnly = text.match(dayOnlyRe);
    if (mDayOnly && !text.includes('月') && !/^\d{1,2}[：:]/.test(text) && !/^\d{1,2}点/.test(text) && !/^\d{1,2}\s*(分钟|分|小时|时|天|周|星期)/.test(text)) {
      const day = parseInt(mDayOnly[1], 10);
      if (day >= 1 && day <= 31) {
        const pt = parsePeriodAndTime(text.slice(mDayOnly[0].length));
        const d = new Date(now.getFullYear(), now.getMonth(), day, pt.hour, pt.min, 0);
        if (d.getTime() <= now.getTime()) d.setMonth(d.getMonth() + 1); // 已过则下月
        remindAt = d.getTime();
        text = text.slice(mDayOnly[0].length + pt.matchedLength).trim();
        return result(text, remindAt);
      }
    }

    // ===== 规则 1.6：今晚 + 可选时段/时间 =====
    // 例：今晚提醒我吃饭、今晚8：30（→20:30）、今晚八点
    const tonightRe = /今晚\s*/;
    const mTonight = text.match(tonightRe);
    if (mTonight) {
      const pt = parsePeriodAndTime(text.slice(mTonight[0].length));
      let hour, min;
      if (pt.matchedLength > 0) {
        // 有具体时间：如果 hour < 12，加 12 转 24 小时制（今晚默认晚上）
        hour = pt.hour < 12 ? pt.hour + 12 : pt.hour;
        min = pt.min;
      } else {
        // 没匹配到任何时段/时间，默认 19:00
        hour = 19;
        min = 0;
      }
      const d = new Date(now);
      d.setHours(hour, min, 0, 0);
      if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1); // 已过则明天
      remindAt = d.getTime();
      text = text.slice(mTonight[0].length + pt.matchedLength).trim();
      return result(text, remindAt);
    }

    // ===== 规则 2："明天/后天/大后天" + 可选时段/时间 =====
    // 例：明天8:00、明天早上8点、后天早上体检、大后天提醒我面试、明天七点
    const futureDayRe = /(大后天|后天|明天)\s*/;
    const m2 = text.match(futureDayRe);
    if (m2) {
      const dayType = m2[1];
      const d = new Date(now);
      const dayOffset = dayType === '大后天' ? 3 : (dayType === '后天' ? 2 : 1);
      d.setDate(d.getDate() + dayOffset);
      // 用辅助函数解析时段+时间
      const pt = parsePeriodAndTime(text.slice(m2[0].length));
      d.setHours(pt.hour, pt.min, 0, 0);
      remindAt = d.getTime();
      text = text.slice(m2[0].length + pt.matchedLength).trim();
      return result(text, remindAt);
    }

    // ===== 规则 3：星期/周（本/上/下 + 周X）+ 可选时段/时间 =====
    // 例：下周一提醒我交周报、周五晚上聚会、本周五交作业、周三早上开会
    // "本"=本周（默认），"上"=上周，"下"=下周
    const weekRe = /(本+|上+|下+)?周?(周一|周二|周三|周四|周五|周六|周日|周天|星期天)\s*/;
    const mWeek = text.match(weekRe);
    if (mWeek) {
      const prefix = mWeek[1] || '';
      const dayName = mWeek[2];
      const dayMap = { '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '周日': 0, '周天': 0, '星期天': 0 };
      const targetDay = dayMap[dayName];
      const d = new Date(now);
      // 计算到目标星期的天数差
      let diff = targetDay - now.getDay();
      if (diff <= 0) diff += 7; // 今天已过或就是今天，取下周
      // 如果有"上"前缀且 diff <= 7，则再往前推一周；有"下"前缀则往后推
      if (prefix.includes('上') && diff <= 7) diff += 7;
      if (prefix.includes('下') && diff <= 7) diff += 7;
      d.setDate(d.getDate() + diff);
      // 用辅助函数解析时段+时间
      const pt = parsePeriodAndTime(text.slice(mWeek[0].length));
      d.setHours(pt.hour, pt.min, 0, 0);
      remindAt = d.getTime();
      text = text.slice(mWeek[0].length + pt.matchedLength).trim();
      return result(text, remindAt);
    }

    // ===== 规则 4："每X"循环提醒（每30分钟、每天8点、每周一）=====
    // 例：每30分钟提醒我喝水、每天8点起床、每周一开会
    const everyRe = /每(\d+)?\s*(半)?\s*(分钟|分|小时|时|天|周|星期|周[一二三四五六日]|周一|周二|周三|周四|周五|周六|周日)\s*(?:(\d{1,2}):(\d{2})|([一二两三四五六七八九十]+)点(?:半|一刻)?(\d{1,2})?分?|早上|早晨|上午|中午|下午|晚上|凌晨)?/;
    const mEvery = text.match(everyRe);
    if (mEvery) {
      let value = mEvery[1] ? parseInt(mEvery[1], 10) : 1;
      if (mEvery[2]) value += 0.5; // "半"
      const unit = mEvery[3];
      // 计算首次提醒时间
      const d = new Date(now);
      if (unit === '分钟' || unit === '分') {
        d.setMinutes(d.getMinutes() + value);
      } else if (unit === '小时' || unit === '时') {
        d.setHours(d.getHours() + value);
      } else if (unit === '天') {
        // 每天：如果给了具体时间就用该时间，否则 1 天后
        if (mEvery[4]) {
          d.setHours(parseInt(mEvery[4], 10), parseInt(mEvery[5], 10), 0, 0);
          if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
        } else if (mEvery[6]) {
          let hour = cnToNumber(mEvery[6]);
          let min = 0;
          if (mEvery[0].includes('半')) min = 30;
          d.setHours(hour, min, 0, 0);
          if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
        } else {
          d.setDate(d.getDate() + 1);
        }
      } else if (unit === '周' || unit === '星期') {
        d.setDate(d.getDate() + 7); // 1 周后
      } else if (/周[一二三四五六日]/.test(unit) || ['周一','周二','周三','周四','周五','周六','周日'].includes(unit)) {
        // 每周X：计算到目标星期的天数
        const dayMap = { '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '周日': 0 };
        const dayShort = unit.replace('周', '周'); // 统一
        const targetDay = dayMap[unit] || dayMap['周' + unit.slice(-1)];
        let diff = targetDay - now.getDay();
        if (diff <= 0) diff += 7;
        d.setDate(d.getDate() + diff);
        d.setHours(9, 0, 0, 0);
      }
      remindAt = d.getTime();
      text = text.replace(everyRe, '').trim();
      // 自动设置循环
      recurrence = { enabled: true, intervalMs: getIntervalMsForUnit(unit, value) };
      if (!text && actionMatch) text = actionMatch[1];
      return result(text, remindAt);
    }

    // ===== 规则 5：相对时间（X分钟后/X小时后/X天后/过X分钟/再过Y小时）=====
    // 例：半小时后提醒我喝水、1小时后、两小时后、20分钟后、3天后、过10分钟、再过2小时
    const relRe = /(?:过|再过)?\s*(\d+)?\s*(半|[一二两三四五六七八九十百]+)?\s*(分钟|分|小时|时|天|周|星期)后/;
    const mRel = text.match(relRe);
    if (mRel) {
      let value = 0;
      if (mRel[1]) {
        value = parseInt(mRel[1], 10);
        if (mRel[2]) value += cnToNumber(mRel[2]) || 0;
      } else if (mRel[2]) {
        value = cnToNumber(mRel[2]);
      }
      const unit = mRel[3];
      const d = new Date(now);
      if (unit === '分钟' || unit === '分') d.setMinutes(d.getMinutes() + value);
      else if (unit === '小时' || unit === '时') d.setHours(d.getHours() + value);
      else if (unit === '天') d.setDate(d.getDate() + value);
      else if (unit === '周' || unit === '星期') d.setDate(d.getDate() + value * 7);
      remindAt = d.getTime();
      text = text.replace(relRe, '').trim();
      if (!text && actionMatch) text = actionMatch[1];
      return result(text, remindAt);
    }

    // ===== 规则 6：时段 + 时间（早上8点、中午12点、晚上9点、早上八点）=====
    // 例：早上8点跑步、中午12点吃饭、晚上9点关灯、早上八点晨跑
    // 支持：今天/明天 + 时段 + 各种时间格式（8点半、8点30分、八点整、九点一刻等）
    const periodTimeRe = /(今天|明天)?\s*(早上|早晨|上午|中午|下午|晚上|凌晨)\s*/;
    const mPt = text.match(periodTimeRe);
    if (mPt) {
      const dayPrefix = mPt[1];  // "今天"或"明天"（可选）
      const periodWord = mPt[2]; // 时段词（早上、下午等）
      // 用辅助函数解析时段后的各种时间格式
      const pt = parsePeriodAndTime(text.slice(mPt[0].length));
      let hour = pt.hour;
      const min = pt.min;
      // 根据时段词对小时进行偏移（12 小时制 → 24 小时制）
      const periodOffsetMap = { '早上': 0, '早晨': 0, '上午': 0, '中午': 12, '下午': 12, '晚上': 12, '凌晨': 0 };
      if (hour < 12 && periodOffsetMap[periodWord] > 0) {
        hour += periodOffsetMap[periodWord];
      }
      const d = new Date(now);
      // 处理"今天/明天"前缀
      if (dayPrefix === '明天') {
        d.setDate(d.getDate() + 1);
      }
      d.setHours(hour, min, 0, 0);
      // "今天"前缀且时间已过，则推到明天；无前缀保持原逻辑
      if (d.getTime() <= now.getTime()) {
        if (dayPrefix === '今天') d.setDate(d.getDate() + 1);
        else if (!dayPrefix) d.setDate(d.getDate() + 1);
      }
      remindAt = d.getTime();
      text = text.slice(mPt[0].length + pt.matchedLength).trim();
      if (!text && actionMatch) text = actionMatch[1];
      return result(text, remindAt);
    }

    // ===== 规则 6.5：纯时段词（无具体时间，单独使用）=====
    // 例：上午提醒我吃饭、下午提醒我开会、晚上提醒我跑步、下午3点
    // 默认时间：早上/早晨/上午=9:00、中午=12:00、下午=15:00、晚上=19:00、凌晨=0:00
    const periodOnlyRe = /^(早上|早晨|上午|中午|下午|晚上|凌晨)\s*/;
    const mPeriodOnly = text.match(periodOnlyRe);
    if (mPeriodOnly && !/\d{1,2}月/.test(text)) {
      // 用辅助函数解析时段+时间
      const pt = parsePeriodAndTime(text.slice(mPeriodOnly[0].length));
      // 如果辅助函数没匹配到任何内容，使用时段默认值
      const hour = pt.matchedLength > 0 ? pt.hour : { '早上': 7, '早晨': 7, '上午': 9, '中午': 12, '下午': 15, '晚上': 19, '凌晨': 0 }[mPeriodOnly[1]] || 9;
      const min = pt.matchedLength > 0 ? pt.min : 0;
      const d = new Date(now);
      d.setHours(hour, min, 0, 0);
      if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1); // 已过则明天
      remindAt = d.getTime();
      text = text.slice(mPeriodOnly[0].length + pt.matchedLength).trim();
      return result(text, remindAt);
    }

    // ===== 智能时间推断：纯时间（无时段词，无日期）=====
    // 支持各种格式：
    //   中文数字：七点、八点半、九点一刻、八点二十分、八点二十
    //   阿拉伯数字：8点半、8点30分、8点30、9点整、9点一刻、8:30
    // 例：七点提醒我洗澡、八点半提醒我睡觉、8点30分提醒我吃饭
    //
    // 智能推断逻辑（上午说的优先上午，下午说的优先下午）：
    //   1. 如果原始时间还没到 → 今天
    //   2. 如果原始时间已过，加 12 小时（上午→下午）还没到 → 今天
    //   3. 如果加 12 小时也过了 → 明天
    // 例：下午 14:00 说"八点半" → 20:30（今天）；晚上 21:00 说"八点半" → 明天 8:30
    function smartTimeResolve(hour, min) {
      const d = new Date(now);
      d.setHours(hour, min, 0, 0);
      if (d.getTime() > now.getTime()) {
        // 1) 原始时间还没到 → 直接用
        return d;
      }
      // 2) 原始时间已过，尝试加 12 小时（上午→下午/晚上）
      const d2 = new Date(now);
      d2.setHours(hour + 12, min, 0, 0);
      if (d2.getTime() > now.getTime() && hour + 12 < 24) {
        return d2;
      }
      // 3) 加 12 小时也过了或超出 24 → 明天
      d.setDate(d.getDate() + 1);
      return d;
    }

    // ===== 规则 7：纯时间（中文格式）=====
    const cnTimeRe = /^(\d{1,2}|[一二两三四五六七八九十]+)(点半|点整|点一刻|点(\d{1,2}|[一二两三四五六七八九十]+)分?|点)/;
    const mCn = text.match(cnTimeRe);
    if (mCn) {
      let hour, min = 0;
      const hourStr = mCn[1];
      const suffix = mCn[2];
      // 解析小时（中文或数字）
      if (/^\d+$/.test(hourStr)) {
        hour = parseInt(hourStr, 10);
      } else {
        hour = cnToNumber(hourStr);
      }
      // 解析分钟
      if (suffix === '点半') min = 30;
      else if (suffix === '点整') min = 0;
      else if (suffix === '点一刻') min = 15;
      else if (suffix.startsWith('点')) {
        // 中文分钟或数字分钟 (mCn[3]是分钟部分)
        if (mCn[3]) {
          if (/^\d+$/.test(mCn[3])) {
            min = parseInt(mCn[3], 10);
          } else {
            min = cnToNumber(mCn[3]) || 0;
          }
        }
      }
      const d = smartTimeResolve(hour, min);
      remindAt = d.getTime();
      text = text.slice(mCn[0].length).trim();
      if (!text && actionMatch) text = actionMatch[1];
      return result(text, remindAt);
    }

    // ===== 规则 8：纯数字时间 "HH:MM" 或 "HH：MM"（全角冒号）=====
    const timeRe = /(\d{1,2})[：:](\d{2})/;
    const m3 = text.match(timeRe);
    if (m3) {
      const hour = parseInt(m3[1], 10);
      const min = parseInt(m3[2], 10);
      const d = smartTimeResolve(hour, min);
      remindAt = d.getTime();
      text = text.replace(timeRe, '').trim();
      if (!text && actionMatch) text = actionMatch[1];
      return result(text, remindAt);
    }

    // ===== 规则 9："一会儿/等会/等一下"（模糊稍后，默认 5 分钟后）=====
    if (/^(一会儿|等会|等一下|稍后|待会|过会儿)/.test(text)) {
      const d = new Date(now);
      d.setMinutes(d.getMinutes() + 5); // 默认 5 分钟后
      remindAt = d.getTime();
      text = text.replace(/^(一会儿|等会|等一下|稍后|待会|过会儿)\s*/, '').trim();
      if (!text && actionMatch) text = actionMatch[1];
      return result(text, remindAt);
    }

    // ===== 规则 9.1："明天/后天/大后天 + 时段"（无具体时间）=====
    // 例：明天早上、后天下午、大后天后天
    const dayPeriodRe = /(明天|后天|大后天)\s*(早上|早晨|上午|中午|下午|晚上|凌晨)?/;
    const mDp = text.match(dayPeriodRe);
    if (mDp && !text.match(/\d{1,2}[点:]/)) { // 没有具体时间才走这条规则
      const dayType = mDp[1];
      const period = mDp[2];
      const dayOffset = dayType === '大后天' ? 3 : (dayType === '后天' ? 2 : 1);
      // 时段默认时间映射
      const periodHour = { '早上': 7, '早晨': 7, '上午': 9, '中午': 12, '下午': 15, '晚上': 19, '凌晨': 0 };
      const d = new Date(now);
      d.setDate(d.getDate() + dayOffset);
      d.setHours(period ? periodHour[period] : 9, 0, 0, 0);
      remindAt = d.getTime();
      text = text.replace(dayPeriodRe, '').trim();
      return result(text, remindAt);
    }

    // ===== 规则 10：单独"明天"（无具体时间），默认明天 9:00 =====
    if (/^明天/.test(text) || /\s明天$/.test(text) || /明天$/.test(text)) {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      remindAt = d.getTime();
      text = text.replace(/明天/, '').trim();
      return result(text, remindAt);
    }

    // 解析失败：原文不动，无提醒
    return { text: rawText, remindAt: null, recurrence: null };
  }

  // 辅助：根据"每X"的单位计算循环间隔毫秒数
  function getIntervalMsForUnit(unit, value) {
    if (unit === '分钟' || unit === '分') return value * 60 * 1000;
    if (unit === '小时' || unit === '时') return value * 60 * 60 * 1000;
    if (unit === '天') return value * 24 * 60 * 60 * 1000;
    if (unit === '周' || unit === '星期') return 7 * 24 * 60 * 60 * 1000;
    if (/周[一二三四五六日]/.test(unit) || ['周一','周二','周三','周四','周五','周六','周日'].includes(unit)) {
      return 7 * 24 * 60 * 60 * 1000;
    }
    return value * 60 * 1000; // 默认分钟
  }

  // 清理文本：去掉"提醒我""提醒""叫我"等前缀和多余语气词，提炼纯事项内容
  // 例："提醒我喝水" → "喝水"，"叫我起床" → "起床"，"提醒交作业" → "交作业"
  //     "明天提醒我晨跑" → "晨跑"，"两小时后" → "两小时后"（保留，因为没有动作主体）
  function cleanTodoText(text) {
    let t = text.trim();
    // 去掉"提醒我""叫我""提醒"前缀
    t = t.replace(/^(提醒我|叫我|提醒)\s*/, '').trim();
    // 去掉"明天""后天""今天"等时间前缀（这些是时间词，不是事项内容）
    t = t.replace(/^(明天|后天|今天)\s*/, '').trim();
    // 去掉末尾的语气词："吧""啊""呀""哦""呢"等
    t = t.replace(/[吧啊呀哦呢哈]+$/, '').trim();
    return t;
  }


  // ---------- 11.4 提示音播放（优先 MP3，兜底 Web Audio 合成） ----------

  // MP3 音效路径（与 index.html 同目录）。URL encode 中文路径以免部分浏览器无法加载
  const REMINDER_MP3_SRC = encodeURI('提示音效.mp3');

  // 单例 HTMLAudio 元素（全局只创建一次，复用避免每次 new Audio 造成泄漏和延迟）
  let mp3Audio = null;
  // MP3 是否成功加载（true 代表可以走 MP3 分支；false 走 Web Audio 兜底）
  let mp3Ready = false;

  // AudioContext 实例（首次用户交互后创建并 resume）—— 作为 MP3 加载失败时的兜底
  // 注意：audioCtx 已在 11.1 "模块状态" 中声明，这里不再重复声明

  // 创建并配置 HTMLAudio 元素（只执行一次）
  function ensureMp3Audio() {
    if (mp3Audio) return mp3Audio;
    try {
      mp3Audio = new Audio();
      mp3Audio.src = REMINDER_MP3_SRC;
      mp3Audio.preload = 'auto';         // 提前预加载数据（若浏览器允许）
      mp3Audio.volume = 1.0;              // 最大音量（原音效文件自行控制音量）
      // 成功加载 → 标记可用
      mp3Audio.addEventListener('canplaythrough', function () {
        mp3Ready = true;
      }, { once: true });
      // 加载失败 → 标记不可用，后续走 Web Audio 兜底
      mp3Audio.addEventListener('error', function (e) {
        mp3Ready = false;
        console.warn('提示音效 MP3 加载失败，将使用合成音作为兜底：', e);
      }, { once: true });
      // 主动触发加载（某些浏览器仅在设置 src 后不会自动开始加载）
      if (typeof mp3Audio.load === 'function') {
        try { mp3Audio.load(); } catch (e) { /* ignore */ }
      }
    } catch (e) {
      mp3Audio = null;
      mp3Ready = false;
      console.warn('创建 Audio 元素失败：', e);
    }
    return mp3Audio;
  }

  // 模块启动时立即创建 Audio 元素并触发预加载（src 会被设置，但 play() 仍需用户手势）
  ensureMp3Audio();

  // 在用户首次交互（点击/按键/触摸）时初始化音频资源
  // 包含两部分：1) Web Audio AudioContext 的 unlock + resume
  //             2) HTMLAudio 的 prime（play 立即 pause，让浏览器给此元素放行 autoplay）
  function unlockAudio() {
    // --- A. Web Audio（兜底路径） ---
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn('当前浏览器不支持 Web Audio API，合成兜底音将不可用');
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function (e) {
        console.warn('AudioContext 恢复失败:', e);
      });
    }

    // --- B. HTMLAudio（MP3 路径）---
    // 关键：在用户手势回调中"快速 play→pause"把此 Audio 元素标记为"已获用户授权"
    // 之后 scheduleReminder 触发时（即使没有用户手势）也能调用 play()
    ensureMp3Audio();
    if (mp3Audio) {
      const playPromise = mp3Audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(function () {
          // 成功开始播放，立即暂停并回到开头 —— 这一步完成"授权 prime"
          try {
            mp3Audio.pause();
            mp3Audio.currentTime = 0;
          } catch (e) { /* ignore */ }
          mp3Ready = true;
        }).catch(function (e) {
          // 某些浏览器即便在用户手势下 play() 仍会拒绝（例如 headless、静音环境）
          // 这只是"授权 prime 失败"，文件本身已加载好，仍可在 playReminderSound 中再尝试
          // 因此不把 mp3Ready 置为 false，仅记录日志（若真播放失败由 playReminderSound 兜底回退）
          console.warn('MP3 prime 被拒绝（playReminderSound 仍会尝试首次播放，失败则回退合成音）：', e);
        });
      } else {
        // 老浏览器：play() 为同步，立即回到开头
        try {
          mp3Audio.pause();
          mp3Audio.currentTime = 0;
        } catch (e) { /* ignore */ }
      }
    }
  }

  // 主入口：播放提示音（优先 MP3，失败/未加载时用 Web Audio 合成兜底）
  // 调用前必须保证：1) unlockAudio() 至少被调用过一次（用户交互后） 2) audioCtx / mp3Audio 状态可接受
  function playReminderSound() {
    // --- 1) 优先尝试 MP3 ---
    if (mp3Ready && mp3Audio) {
      try {
        // 连点时重播：先回到 0 再 play（currentTime=0 可打断当前播放直接从头来）
        try { mp3Audio.currentTime = 0; } catch (e) { /* ignore */ }
        const p = mp3Audio.play();
        if (p && typeof p.then === 'function') {
          p.catch(function (e) {
            // MP3 play() 被浏览器拦截（非常罕见），回退到合成音
            console.warn('MP3 play 被拦截，回退合成音：', e);
            tryPlayBeepsFallback();
          });
        }
        return;  // MP3 分支已触发（或 promise 里会兜底）
      } catch (e) {
        console.warn('MP3 播放异常，回退合成音：', e);
        // 直接落入 Web Audio 兜底
      }
    }

    // --- 2) 兜底：Web Audio 合成"叮咚"声 ---
    tryPlayBeepsFallback();
  }

  // Web Audio 合成兜底：检查 audioCtx 状态 → 合成播放
  function tryPlayBeepsFallback() {
    if (!audioCtx) {
      console.warn('提示音未播放：用户尚未与页面交互，AudioContext 未初始化');
      return;
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(function () {
        doPlayBeeps();
      }).catch(function (e) {
        console.warn('恢复 AudioContext 失败，无法播放合成提示音：', e);
      });
    } else {
      doPlayBeeps();
    }
  }

  // 合成"叮咚"两声（内部函数）
  function doPlayBeeps() {
    if (!audioCtx || audioCtx.state !== 'running') return;
    const now = audioCtx.currentTime;

    // 两个频率：880Hz（叮）+ 660Hz（咚），间隔 180ms
    const beeps = [
      { freq: 880, start: 0,    duration: 0.20 },
      { freq: 660, start: 0.24, duration: 0.28 }
    ];

    beeps.forEach(function (b) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = b.freq;

      // 音量包络：0 → 0.5 → 0，避免开始/结束的爆音
      gain.gain.setValueAtTime(0, now + b.start);
      gain.gain.linearRampToValueAtTime(0.5, now + b.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + b.start + b.duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + b.start);
      osc.stop(now + b.start + b.duration + 0.05);  // 多留 50ms 避免尾部咔哒
    });
  }

  // 首次用户交互时 unlock 音频（once: true 自动移除监听）
  ['click', 'keydown', 'touchstart'].forEach(function (evt) {
    document.addEventListener(evt, unlockAudio, { once: true });
  });


  // ---------- 11.5 调度与触发 ----------

  // 为单条事项注册精确 setTimeout
  function scheduleReminder(todo) {
    // 无提醒时间 / 已完成 → 跳过
    // 循环提醒允许 reminded=true（刚触发过正在推进中的），由 advanceCycle 重置 reminded 后再调度
    if (!todo.remindAt || todo.done) return;

    // 非循环事项：已提醒过则不重复调度
    if (!todo.recurrence || !todo.recurrence.enabled) {
      if (todo.reminded) return;
    }

    const oldTimer = reminderTimers.get(todo.id);
    if (oldTimer) clearTimeout(oldTimer);

    const delay = todo.remindAt - Date.now();
    if (delay <= 0) {
      triggerReminder(todo);
    } else {
      const timerId = setTimeout(function () {
        triggerReminder(todo);
      }, delay);
      reminderTimers.set(todo.id, timerId);
    }
  }

  // 启动时扫描所有未提醒事项，逐个调度
  function scheduleAllReminders() {
    todos.forEach(function (t) {
      if (t.remindAt && !t.reminded && !t.done) {
        scheduleReminder(t);
      }
    });
  }

  // 取消某条事项的定时器（删除/完成时调用）
  function cancelReminder(id) {
    const t = reminderTimers.get(id);
    if (t) {
      clearTimeout(t);
      reminderTimers.delete(id);
    }
  }

  // 漏检检查：扫描所有"已到点但 reminded 还是 false"的事项，补触发
  // 调用时机：visibilitychange 切回前台 / 60 秒 setInterval 兜底
  function checkMissedReminders() {
    const now = Date.now();
    todos.forEach(function (t) {
      if (t.remindAt && !t.reminded && !t.done && t.remindAt <= now) {
        triggerReminder(t);
      }
    });
  }

  // 触发提醒：完整反馈链路
  function triggerReminder(todo) {
    // 防重：已提醒过直接返回
    if (todo.reminded) return;

    // 1) 先标记为已提醒 + 持久化
    todo.reminded = true;
    save();

    // 2) 播放"叮咚"音效
    playReminderSound();

    // 3) 找到对应 <li> 节点，加高亮 + 抖动动画
    const li = nodeCache.get(todo.id);
    if (li) {
      li.classList.add('reminding');
      setTimeout(function () {
        li.classList.remove('reminding');
      }, 6000);
    }

    // 4) 史迪奇弹气泡
    if (window.petMood) {
      window.petMood.excited();
      const cycleMsg = todo.recurrence && todo.recurrence.enabled
        ? '循环提醒：该 ' + todo.text + ' 啦！（已完成 ' + (todo.completionCount || 0) + ' 次）'
        : '该 ' + todo.text + ' 啦！';
      window.petMood.toast(cycleMsg, 'warning');
    }

    // 5) 取消该事项的定时器
    cancelReminder(todo.id);

    // 6) 循环提醒：推进到下一个周期并重新调度
    if (todo.recurrence && todo.recurrence.enabled && !todo.done) {
      advanceCycle(todo);
    }

    // 7) 重新渲染
    render();
  }

  // 循环提醒：推进到下一个周期
  function advanceCycle(todo) {
    if (!todo.recurrence || !todo.recurrence.enabled) return;

    const intervalMs = getIntervalMs(todo.recurrence);
    if (!intervalMs) return;

    // 从当前 remindAt 开始累加（用户选择的"从起始时间累加"策略）
    // 如果本次 remindAt 已经过期，则从现在开始算下一个周期
    const now = Date.now();
    const baseTime = todo.remindAt > now ? todo.remindAt : now;
    todo.remindAt = baseTime + intervalMs;
    todo.reminded = false;  // 重置以便下一轮能触发
    todo.lastRemindAt = now;
    save();
    scheduleReminder(todo);
  }

  // 将循环间隔转换为毫秒
  function getIntervalMs(recurrence) {
    if (!recurrence) return 0;
    const unitMs = {
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000
    };
    const multiplier = unitMs[recurrence.unit];
    if (!multiplier) return 0;
    return recurrence.interval * multiplier;
  }

  // 停止循环提醒（用户手动操作）
  function stopCycleReminder(id) {
    const todo = todos.find(function (t) { return t.id === id; });
    if (!todo) return;
    todo.recurrence = null;  // 清空循环设置（targetCount 也随之清除，不再需要单独设为 null）
    todo.completionCount = 0;
    todo.lastRemindAt = null;
    cancelReminder(id);
    // 清除缓存节点，强制重建 DOM（否则停止按钮不会消失）
    nodeCache.delete(id);
    save();
    render();
  }


  // ---------- 11.6 兜底定时器 ----------

  // 60 秒兜底检查：用于后台标签页（浏览器会降频 setTimeout，60 秒兜底确保不漏）
  setInterval(checkMissedReminders, 60000);

  // 30 秒刷新所有徽章文案（仅改 textContent，不调用 render，避免反复写 localStorage）
  // 让"还有 N 分钟"倒计时每 30 秒更新一次
  setInterval(function () {
    nodeCache.forEach(function (li, id) {
      const todo = todos.find(function (t) { return t.id === id; });
      if (todo) updateReminderBadge(li, todo);
    });
  }, 30000);


  // ---------- 11.7 页面可见性联动 ----------
  // 切回前台时补触发切走期间错过的提醒
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      checkMissedReminders();
    }
  });


  // ---------- 11.8 暴露接口 ----------
  window.reminderModule = {
    parse: parseReminderFromText,
    cleanTodoText: cleanTodoText,
    schedule: scheduleReminder,
    scheduleAll: scheduleAllReminders,
    cancel: cancelReminder,
    checkMissed: checkMissedReminders,
    trigger: triggerReminder,
    playSound: playReminderSound,
    unlockAudio: unlockAudio,
    stopCycle: stopCycleReminder,
    getIntervalMs: getIntervalMs,
    getIntervalMsForUnit: getIntervalMsForUnit,
    hasAudioCtx: function () { return !!audioCtx && audioCtx.state === 'running'; },
    isMp3Ready: function () { return mp3Ready; },
    getMp3Src: function () { return REMINDER_MP3_SRC; },
    formatToLocalInputValue: formatToLocalInputValue
  };

  // 同时暴露日期选择器模块
  window.datetimePickerModule = {
    getTimestamp: datetimePickerModule.getTimestamp,
    getRecurrence: datetimePickerModule.getRecurrence,
    syncFromTimestamp: datetimePickerModule.syncFromTimestamp,
    clearAll: datetimePickerModule.clearAll,
    formatRecurrenceShort: datetimePickerModule.formatRecurrenceShort,
    formatRecurrenceLong: datetimePickerModule.formatRecurrenceLong
  };


  // ---------- 11.8b 绑定"🔊 测试音效"按钮 ----------
  // 节流：避免用户高频连点造成多个 oscillator 叠加爆音
  let soundTestCooldown = false;
  const SOUND_TEST_COOLDOWN_MS = 800;  // 至少留足"叮咚"两声时长

  function bindSoundTestButton() {
    const btn = document.getElementById('soundTestBtn');
    if (!btn) return;

    btn.addEventListener('click', function () {
      // 冷却中：忽略，不给任何反馈，避免进一步引导连点
      if (soundTestCooldown) return;
      soundTestCooldown = true;
      setTimeout(function () { soundTestCooldown = false; }, SOUND_TEST_COOLDOWN_MS);

      // 1) 按钮本身就是用户交互，先确保 AudioContext 被 unlock + resume
      unlockAudio();

      // 2) 加播放中样式（脉冲动画 0.5s，视觉确认）
      btn.classList.remove('playing');
      // 强制重排以重启动画（否则移除后立即添加不会触发）
      void btn.offsetWidth;
      btn.classList.add('playing');
      setTimeout(function () {
        btn.classList.remove('playing');
      }, 600);  // 略长于动画 0.5s

      // 3) 播放"叮咚"两声
      playReminderSound();
    });
  }

  // DOM 按钮一定在 reminderModule IIFE 之前解析（按钮写在 body 中，script 在 body 末尾）
  // 为稳妥起见仍用 setTimeout 延迟到下一轮事件循环
  setTimeout(bindSoundTestButton, 0);


  // ---------- 11.9 启动调度 ----------
  // 推到下一个事件循环，确保 todos 已通过 load() 加载、render() 已执行
  setTimeout(scheduleAllReminders, 0);

})();
