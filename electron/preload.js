// Electron 预加载脚本
// 在渲染进程加载前运行，安全地向页面暴露有限的 Electron API
const { contextBridge, ipcRenderer } = require('electron');

// 通过 contextBridge 向页面暴露安全的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 监听便签模式切换
  onStickyMode: function (callback) {
    ipcRenderer.on('sticky-mode', function (event, enabled) {
      callback(enabled);
    });
  },
  // 切换窗口置顶
  toggleAlwaysOnTop: function () {
    ipcRenderer.send('toggle-always-on-top');
  },
  // 监听置顶状态变化
  onAlwaysOnTop: function (callback) {
    ipcRenderer.on('always-on-top-changed', function (event, isEnabled) {
      callback(isEnabled);
    });
  },
  // 调整窗口大小（用于便签模式折叠/展开）
  // resizable: 是否允许用户拖拽调整窗口大小
  resizeWindow: function (width, height, resizable) {
    ipcRenderer.send('resize-window', width, height, resizable);
  },
  // 【v2.14.0】退出便签模式（渲染进程 → 主进程）
  exitStickyMode: function () {
    ipcRenderer.send('exit-sticky-mode');
  },

  // ============================================
  // 设置相关 API（v2.18.0）
  // ============================================

  // 设置开机自启动
  setAutoStart: function (enabled) {
    ipcRenderer.send('set-auto-start', enabled);
  },

  // 注册/修改快捷键
  // action: 'toggle-window' | 'toggle-sticky'
  // shortcut: 如 'Alt+F'
  // callback: 注册结果回调
  registerShortcut: function (action, shortcut, callback) {
    // 用 invoke 等待主进程返回结果
    ipcRenderer.invoke('register-shortcut', action, shortcut).then(function (result) {
      if (callback) callback(result);
    });
  },

  // 打开外部链接（通过系统默认浏览器）
  openExternal: function (url) {
    ipcRenderer.send('open-external', url);
  },

  // 获取当前应用版本号（从 package.json 读取）
  getVersion: function () {
    return ipcRenderer.invoke('get-app-version');
  },

  // ============================================
  // 史迪仔桌面提醒 API（v2.22.0）
  // ============================================

  // 设置提醒定时器
  setReminderWindow: function (todo) {
    ipcRenderer.send('set-reminder-window', todo);
  },

  // 取消提醒定时器
  cancelReminderWindow: function (todoId) {
    ipcRenderer.send('cancel-reminder-window', todoId);
  },

  // 稍后提醒（延迟 N 分钟）
  snoozeReminder: function (todo, minutes) {
    ipcRenderer.send('snooze-reminder', todo, minutes);
  },

  // 关闭提醒窗口
  closeReminder: function () {
    ipcRenderer.send('close-reminder-window');
  },

  // 从提醒窗口完成待办
  completeTodoFromReminder: function (todoId) {
    ipcRenderer.send('complete-todo-from-reminder', todoId);
  },

  // 监听提醒触发（主进程 → 渲染进程）
  onReminderTriggered: function (callback) {
    ipcRenderer.on('reminder-triggered', function (event, todoId) {
      callback(todoId);
    });
  },

  // 监听完成待办请求（从提醒窗口 → 主窗口）
  onCompleteTodo: function (callback) {
    ipcRenderer.on('complete-todo', function (event, todoId) {
      callback(todoId);
    });
  },

  // 加载主页面（从操作指南返回）
  loadMainPage: function () {
    ipcRenderer.send('load-main-page');
  }
});
