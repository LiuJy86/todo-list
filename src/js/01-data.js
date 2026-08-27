// ===== 待办事项清单 - 交互脚本 =====


// ---------- 1. 数据层 ----------

// 数据源：所有待办事项都存在这个数组里
// 每条事项结构：
//   { id: 唯一标识, text: 内容文本, done: 是否已完成,
//     reminders: [                     // 统一提醒点数组（v2.16.0）
//       { type: 'start', at: 时间戳, reminded: false },
//       { type: 'end',   at: 时间戳, reminded: false },
//       { type: 'before', at: 时间戳, reminded: false }
//     ],
//     recurrence: {                    // 循环设置（null=不循环）
//       enabled: true/false,
//       interval: 30,                   // 间隔数值
//       unit: 'minute'|'hour'|'day'|'week',
//       targetCount: null,              // 目标次数（null=无限循环）
//     },
//     completionCount: 0,               // 完成次数（循环专用）
//     lastRemindAt: 上次实际提醒时间戳    // 循环调度用
//   }
// 后续的「添加 / 标记完成 / 删除 / 持久化 / 提醒调度」都围绕这个数组进行
let todos = [];

// localStorage 的键名（固定常量，便于统一管理与修改）
// v2.1.0 起从 sessionStorage 升级为 localStorage，让数据跨会话保留以支持提醒功能
const STORAGE_KEY = 'todos';

// 暴露 todos 访问器（供日报等功能使用）
window.getAllTodos = function () { return todos; };
window.getTodoCount = function () { return todos.length; };

// 暴露 save 函数（供提醒模块等外部模块持久化数据）
window.saveTodos = save;

// ========== 时间格式化工具函数（供多模块复用） ==========

// 时间戳格式化为"8月15日 08:00"样式
window.formatReminderText = function (ts) {
  const d = new Date(ts);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return m + '月' + day + '日 ' + hh + ':' + mm;
};

// 时间戳格式化为简短"09:00"样式（用于时间轴）
window.formatTimeShort = function (ts) {
  const d = new Date(ts);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
};

// ===== 魔法数字常量集中管理（v2.22.0） =====

// 收纳状态：已完成项超过此数量则自动收纳（当前未使用，保留供未来扩展）
const VISIBLE_COMPLETED_LIMIT = 3;

// 输入框反馈动画时长（毫秒）
const INPUT_FLASH_DURATION = 300;
const INPUT_SUCCESS_DURATION = 400;

// 删除动画时长（毫秒）
const DELETE_ANIM_DURATION = 300;

// 双击检测间隔（毫秒）
const DOUBLE_CLICK_INTERVAL = 400;

// 便签模式窗口参数
const STICKY_DEFAULT_WIDTH = 480;
const STICKY_DEFAULT_HEIGHT = 760;
const STICKY_MIN_HEIGHT = 80;
// 便签模式最大高度：取屏幕可用高度的 80%，避免超出屏幕（最低 600，最高 1200）
function getStickyMaxHeight() {
  const screenH = (window.screen && window.screen.availHeight) || 800;
  return Math.max(600, Math.min(1200, Math.round(screenH * 0.8)));
}
const STICKY_BREATH_SPACE = 8;
const STICKY_HEIGHT_THRESHOLD = 8;

// 提醒时间阈值（毫秒）
const MS_PER_MINUTE = 60000;
const MS_PER_HOUR = 3600000;
const MS_PER_DAY = 86400000;

// 展开/收起状态（只用于已完成收纳）
let isExpanded = false;

// 便签模式折叠状态（默认展开）
let stickyCollapsed = false;


// ---------- 1.1 存储相关：保存与读取 ----------

// 保存：把当前 todos 数组序列化为 JSON 字符串，存入 localStorage
// 调用时机：任何数据变更后统一调用（见 render() 末尾）
function save() {
  // JSON.stringify 把 JS 数组转成字符串，因为 localStorage 只能存字符串
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

// 读取：从 localStorage 取出字符串并反序列化回数组
// 调用时机：页面加载时调用一次，恢复上次的数据
// 兼容老版本：若 localStorage 没数据但 sessionStorage 有，则一次性迁移过来
function load() {
  // getItem 取出字符串；若键不存在则返回 null
  let data = localStorage.getItem(STORAGE_KEY);
  // 迁移：localStorage 没有、但 sessionStorage 有旧数据时，搬到 localStorage
  // 这样老版本用户首次打开 v2.1.0 时数据自动迁移，无感知
  if (!data) {
    const legacyData = sessionStorage.getItem(STORAGE_KEY);
    if (legacyData) {
      localStorage.setItem(STORAGE_KEY, legacyData);
      sessionStorage.removeItem(STORAGE_KEY);  // 清掉旧位置，避免双源
      data = legacyData;
    }
  }
  // 只有存在数据时才解析，避免 JSON.parse(null) 报错
  if (data) {
    // JSON.parse 把字符串还原成 JS 数组，赋值回 todos
    todos = JSON.parse(data);
    // 数据兼容：补齐旧事项缺失的新字段 + 迁移到新 reminders 数组格式
    todos.forEach(function (t) {
      // 旧格式迁移：remindAt/endRemindAt/endRemindBefore → reminders 数组
      if (!Array.isArray(t.reminders)) {
        t.reminders = [];
        if (t.remindAt) {
          t.reminders.push({ type: 'start', at: t.remindAt, reminded: !!t.reminded });
        }
        if (t.endRemindAt) {
          t.reminders.push({ type: 'end', at: t.endRemindAt, reminded: !!t.endReminded });
          if (t.endRemindBefore > 0) {
            t.reminders.push({ type: 'before', at: t.endRemindAt - t.endRemindBefore * 60000, reminded: !!t.beforeReminded });
          }
        }
        // 清理旧字段
        delete t.remindAt;
        delete t.endRemindAt;
        delete t.endRemindBefore;
        delete t.reminded;
        delete t.endReminded;
        delete t.beforeReminded;
      }
      if (t.recurrence === undefined) t.recurrence = null;
      if (t.completionCount === undefined) t.completionCount = 0;
      if (t.lastRemindAt === undefined) t.lastRemindAt = null;
    });
  }
}

// 辅助函数：获取指定类型的提醒点
function getReminder(todo, type) {
  if (!todo || !Array.isArray(todo.reminders)) return null;
  return todo.reminders.find(function (r) { return r.type === type; }) || null;
}

// 辅助函数：获取指定类型的提醒时间戳
function getReminderAt(todo, type) {
  var r = getReminder(todo, type);
  return r ? r.at : null;
}

// 辅助函数：判断指定类型提醒是否已触发
function isReminded(todo, type) {
  var r = getReminder(todo, type);
  return r ? !!r.reminded : true; // 不存在视为已提醒（不再调度）
}


// ---------- 2. 获取页面元素 ----------

// 通过 id 拿到 HTML 中的关键元素，后续操作都基于这些引用
const todoInput = document.getElementById('todoInput');  // 输入框
// remindAtInput 已移除（v2.4.0 起用 datetime picker 替代原生 datetime-local）
const datetimePicker = document.getElementById('datetimePicker');  // 自定义日期时间选择器容器
const datetimeTrigger = document.getElementById('datetimeTrigger');  // 触发按钮
const datetimeDisplay = document.getElementById('datetimeDisplay');  // 显示文本
const datetimePopover = document.getElementById('datetimePopover');  // Popover 浮层
const addBtn = document.getElementById('addBtn');        // 添加按钮
const todoList = document.getElementById('todoList');    // 列表容器（<ul>）


// ---------- 3. DOM 节点缓存 ----------

// 缓存已创建的 <li> 节点，避免每次都重新创建导致闪动
// key: todo.id, value: <li> 元素
const nodeCache = new Map();
