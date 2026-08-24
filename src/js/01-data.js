// ===== 待办事项清单 - 交互脚本 =====


// ---------- 1. 数据层 ----------

// 数据源：所有待办事项都存在这个数组里
// 每条事项结构：
//   { id: 唯一标识, text: 内容文本, done: 是否已完成,
//     remindAt: 提醒时间戳（毫秒，无提醒为 null）,
//     reminded: 是否已触发过本轮提醒（防重复响铃）,
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

// 收纳状态：已完成项超过此数量则自动收纳
const VISIBLE_COMPLETED_LIMIT = 3;
// 展开/收起状态（只用于已完成收纳）
let isExpanded = false;


// 【新增】便签模式折叠状态（默认展开）
let stickyCollapsed = false;
let stickyWidthBeforeCollapse = 480; // 折叠前记住的宽度


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
    // 数据兼容：补齐旧事项缺失的新字段
    todos.forEach(function (t) {
      if (t.remindAt === undefined) t.remindAt = null;
      if (t.reminded === undefined) t.reminded = false;
      if (t.recurrence === undefined) t.recurrence = null;
      if (t.completionCount === undefined) t.completionCount = 0;
      if (t.lastRemindAt === undefined) t.lastRemindAt = null;
    });
  }
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
