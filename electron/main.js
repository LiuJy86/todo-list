// Electron 主进程入口
// 负责创建窗口、系统托盘、应用生命周期管理
const { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

// ============================================
// 设置文件管理（主进程读写，零依赖）
// ============================================
// 设置文件路径：%APPDATA%/ToDoList/settings.json
function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

// 读取主进程侧的设置（用于开机自启动等需要主进程读取的配置）
function loadMainSettings() {
  const filePath = getSettingsPath();
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('读取设置文件失败:', e.message);
  }
  return {};
}

// 保存主进程侧的设置
function saveMainSettings(settings) {
  const filePath = getSettingsPath();
  try {
    // 确保目录存在（递归创建）
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (e) {
    console.error('保存设置文件失败:', e.message);
  }
}

let mainWindow = null;   // 主窗口
let tray = null;          // 系统托盘
let isQuitting = false;   // 是否真正退出（区分关闭到托盘和退出）

// ============================================
// 史迪仔桌面提醒窗口（v2.22.0）
// ============================================
let reminderWindow = null;        // 提醒窗口引用
const reminderTimers = new Map(); // 待办ID → setTimeout 引用

// 便签模式状态
let isStickyMode = false;           // 当前是否处于便签模式
let stickyPosition = null;          // 记住便签位置 {x, y}
let stickyMenu = null;              // 缓存托盘菜单引用

// 应用图标
function getIconPath() {
  return path.join(__dirname, 'icon.png');
}

// 创建主窗口（isToolbar: 是否用 toolbar 类型，便签模式使用）
function createWindow(isToolbar) {
  const config = {
    width: 480,
    height: 760,
    minWidth: 360,
    minHeight: 520,
    title: 'ToDoList',
    icon: getIconPath(),
    autoHideMenuBar: true,        // 隐藏菜单栏
    titleBarStyle: 'hidden',     // 隐藏原生标题栏（内容延伸到窗口边缘）
    backgroundColor: '#F2F2F7',   // 与页面渐变起始色一致，避免白屏
    webPreferences: {
      contextIsolation: true,     // 上下文隔离（安全）
      nodeIntegration: false,     // 禁用 Node 集成（安全）
      preload: path.join(__dirname, 'preload.js'),  // 预加载脚本
      spellcheck: false
    }
  };
  // toolbar 类型：Windows+D 不会最小化，不在任务栏和 Alt+Tab 显示（仅 Windows）
  if (isToolbar && process.platform === 'win32') {
    config.type = 'toolbar';
  }
  mainWindow = new BrowserWindow(config);

  // 加载本地页面（index.html 位于 src/ 目录）
  mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

  // 开发模式打开 DevTools
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // 拦截窗口关闭：最小化到托盘而非真正退出
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
      // 首次隐藏时托盘提示
      if (tray && !tray._notifiedOnce) {
        tray.displayBalloon({
          iconType: 'info',
          title: 'ToDoList',
          content: '我还在后台运行哦～提醒不会漏掉的！点击托盘图标重新打开。'
        });
        tray._notifiedOnce = true;
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

}

// ============================================
// 设置窗口
// ============================================
let settingsWindow = null;

function createSettingsWindow() {
  // 如果设置窗口已存在，直接聚焦
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 480,
    height: 620,
    title: '设置',
    icon: getIconPath(),
    autoHideMenuBar: true,
    backgroundColor: '#F2F2F7',
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: mainWindow,         // 父窗口（可选）
    modal: false,               // 非模态，不阻塞主窗口
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  settingsWindow.loadFile(path.join(__dirname, '..', 'src', 'settings.html'));

  // 关闭时清理引用
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// ============================================
// 全局快捷键管理
// ============================================
// 存储当前注册的快捷键
const registeredShortcuts = {
  'toggle-window': 'Alt+F',
  'toggle-sticky': 'Alt+G'
};

// 启动时读取保存的设置并应用
function applySavedSettings() {
  const mainSettings = loadMainSettings();
  // 应用开机自启动设置
  if (mainSettings.autoStart !== undefined) {
    app.setLoginItemSettings({
      openAtLogin: mainSettings.autoStart,
      openAsHidden: mainSettings.startHidden || false
    });
  }
}

// 注册所有全局快捷键
// 优先使用配置文件中的自定义快捷键，没有则用默认值
function registerGlobalShortcuts() {
  // 读取保存的快捷键设置
  const mainSettings = loadMainSettings();
  const savedShortcuts = mainSettings.shortcuts || {};

  // 合并：自定义设置覆盖默认值
  const shortcuts = {
    'toggle-window': savedShortcuts['toggle-window'] || registeredShortcuts['toggle-window'],
    'toggle-sticky': savedShortcuts['toggle-sticky'] || registeredShortcuts['toggle-sticky']
  };

  // 显示/隐藏窗口
  const ret1 = globalShortcut.register(shortcuts['toggle-window'], () => {
    toggleWindowVisibility();
  });
  if (!ret1) {
    console.error('显示/隐藏窗口 快捷键注册失败:', shortcuts['toggle-window']);
  }

  // 切换便签模式
  const ret2 = globalShortcut.register(shortcuts['toggle-sticky'], () => {
    toggleStickyMode(!isStickyMode);
  });
  if (!ret2) {
    console.error('切换便签模式 快捷键注册失败:', shortcuts['toggle-sticky']);
  }
}

// 切换窗口可见性（供快捷键调用）
function toggleWindowVisibility() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

// 重新注册某个快捷键（用户修改后调用）
function updateShortcut(action, newShortcut) {
  const oldShortcut = registeredShortcuts[action];

  // 先注销旧的
  if (oldShortcut) {
    globalShortcut.unregister(oldShortcut);
  }

  // 尝试注册新的
  const success = globalShortcut.register(newShortcut, () => {
    if (action === 'toggle-window') {
      toggleWindowVisibility();
    } else if (action === 'toggle-sticky') {
      toggleStickyMode(!isStickyMode);
    }
  });

  if (success) {
    registeredShortcuts[action] = newShortcut;
    // 同步写入配置文件，确保重启后依然生效
    const mainSettings = loadMainSettings();
    if (!mainSettings.shortcuts) mainSettings.shortcuts = {};
    mainSettings.shortcuts[action] = newShortcut;
    saveMainSettings(mainSettings);
    return { success: true, previousShortcut: oldShortcut };
  } else {
    // 注册失败，恢复旧的
    globalShortcut.register(oldShortcut, () => {
      if (action === 'toggle-window') {
        toggleWindowVisibility();
      } else if (action === 'toggle-sticky') {
        toggleStickyMode(!isStickyMode);
      }
    });
    return { success: false, previousShortcut: oldShortcut };
  }
}

// ============================================
// 史迪仔桌面提醒窗口（v2.22.0）
// ============================================

/**
 * 创建史迪仔提醒窗口
 * @param {Object} todo - 待办事项数据 { id, text, notes, priority }
 */
function createReminderWindow(todo) {
  // 如果提醒窗口已存在，先关闭旧的
  if (reminderWindow) {
    reminderWindow.destroy();
    reminderWindow = null;
  }

  const { screen } = require('electron');
  const display = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = display.workArea;

  // 创建透明、无边框、置顶窗口
  reminderWindow = new BrowserWindow({
    width: 320,
    height: 400,
    x: screenW - 340,           // 右侧留 20px 边距
    y: screenH - 420,           // 底部留 20px 边距
    frame: false,               // 无边框
    transparent: true,          // 透明背景
    alwaysOnTop: true,          // 始终置顶
    skipTaskbar: true,          // 不在任务栏显示
    resizable: false,           // 不可调整大小
    focusable: true,            // 可获取焦点
    hasShadow: false,           // 无阴影（透明窗口）
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // 加载提醒页面，传递待办数据
  const todoData = encodeURIComponent(JSON.stringify(todo));
  reminderWindow.loadFile(
    path.join(__dirname, '..', 'src', 'reminder.html'),
    { query: { todo: todoData } }
  );

  // 窗口关闭时清理引用，并把焦点交回主窗口
  reminderWindow.on('closed', () => {
    reminderWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
    }
  });

  console.log('[史迪仔提醒] 已弹出提醒窗口:', todo.text || todo.title);
}

/**
 * 为待办事项设置提醒定时器
 * @param {Object} todo - 待办事项 { id, text, reminderTime, ... }
 */
function setReminderTimer(todo) {
  // 清除该待办已有的定时器
  clearReminderTimer(todo.id);

  // 支持 remindAt (旧格式) 和 reminders 数组 (新格式)
  let triggerTime = null;

  if (todo.remindAt) {
    // 旧格式：直接使用 remindAt
    triggerTime = todo.remindAt;
  } else if (Array.isArray(todo.reminders) && todo.reminders.length > 0) {
    // 新格式：取第一个未提醒的 start 类型提醒点
    const startReminder = todo.reminders.find(function (r) {
      return r.type === 'start' && !r.reminded;
    });
    if (startReminder) {
      triggerTime = startReminder.at;
    }
  }

  if (!triggerTime) return;

  const now = Date.now();
  const delay = triggerTime - now;

  // 如果时间已过（延迟 <= 0），立即触发
  if (delay <= 0) {
    createReminderWindow(todo);
    return;
  }

  // 设置定时器
  const timerId = setTimeout(function () {
    createReminderWindow(todo);
    reminderTimers.delete(todo.id + ':window');
  }, delay);

  // 保存引用
  reminderTimers.set(todo.id + ':window', timerId);

  console.log('[史迪仔提醒] 已设置定时器:', todo.text || todo.title,
    '→', new Date(triggerTime).toLocaleString());
}

/**
 * 清除待办事项的提醒定时器
 * @param {string|number} todoId - 待办事项 ID
 */
function clearReminderTimer(todoId) {
  const timerId = reminderTimers.get(todoId + ':window');
  if (timerId) {
    clearTimeout(timerId);
    reminderTimers.delete(todoId + ':window');
    console.log('[史迪仔提醒] 已取消定时器: todoId=' + todoId);
  }
}

// 创建系统托盘
function createTray() {
  // 托盘图标（Windows 下 GIF 不可直接用，这里用 nativeImage 尝试加载）
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(getIconPath());
    if (trayIcon.isEmpty()) {
      // 16x16 透明占位
      trayIcon = nativeImage.createEmpty();
    }
  } catch (_) {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('ToDoList · 点击显示/隐藏');

  // 托盘右键菜单
  stickyMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: '隐藏到托盘',
      click: () => {
        if (mainWindow) mainWindow.hide();
      }
    },
    { type: 'separator' },
    {
      label: '⚙️ 设置',
      click: () => {
        createSettingsWindow();
      }
    },
    { type: 'separator' },
    {
      label: '访问 GitHub 仓库',
      click: () => {
        shell.openExternal('https://github.com/LiuJy86/todo-list');
      }
    },
    {
      label: '查看操作指南',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.executeJavaScript("window.location.href = 'user_guide.html';");
          // 注意：user_guide.html 与 index.html 同属 src/ 目录，相对路径仍可正常工作
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(stickyMenu);

  // 单击托盘：切换显示/隐藏
  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // 双击托盘：始终显示
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// 防止多开：第二个实例直接聚焦已有窗口
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  // 应用就绪
  app.whenReady().then(() => {
    // 启动时读取保存的设置并应用
    applySavedSettings();

    createWindow();
    createTray();

    // 注册全局快捷键
    registerGlobalShortcuts();

    // macOS 下激活应用时重建窗口
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

// 所有窗口关闭时不退出（macOS 行为一致化）
app.on('window-all-closed', (e) => {
  e.preventDefault();
});

// 真正退出前清理托盘和快捷键
app.on('before-quit', () => {
  isQuitting = true;
  // 注销所有全局快捷键，避免残留占用
  globalShortcut.unregisterAll();
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

// ============================================
// 设置相关 IPC 处理（v2.18.0）
// ============================================

// ============================================
// 史迪仔桌面提醒 IPC 处理（v2.22.0）
// ============================================

// 设置提醒定时器（渲染进程 → 主进程）
ipcMain.on('set-reminder-window', function (_, todo) {
  setReminderTimer(todo);
});

// 取消提醒定时器
ipcMain.on('cancel-reminder-window', function (_, todoId) {
  clearReminderTimer(todoId);
});

// 稍后提醒（延迟 N 分钟）
ipcMain.on('snooze-reminder', function (_, todo, minutes) {
  console.log('[主进程] 稍后提醒:', todo && todo.text, minutes, '分钟');
  // 先清除原有定时器
  clearReminderTimer(todo.id);
  // 设置新的触发时间
  const newTodo = Object.assign({}, todo);
  if (newTodo.remindAt) {
    newTodo.remindAt = Date.now() + minutes * 60000;
  }
  if (Array.isArray(newTodo.reminders) && newTodo.reminders.length > 0) {
    newTodo.reminders.forEach(function (r) {
      if (r.type === 'start') {
        r.at = Date.now() + minutes * 60000;
        r.reminded = false;
      }
    });
  }
  setReminderTimer(newTodo);
});

// 关闭提醒窗口
ipcMain.on('close-reminder-window', function () {
  console.log('[主进程] 关闭提醒窗口');
  if (reminderWindow) {
    reminderWindow.destroy();
    reminderWindow = null;
  }
});

// 完成待办（从提醒窗口触发）
ipcMain.on('complete-todo-from-reminder', function (_, todoId) {
  console.log('[主进程] 完成待办:', todoId);
  // 通知主窗口标记完成
  if (mainWindow) {
    mainWindow.webContents.send('complete-todo', todoId);
  }
  // 关闭提醒窗口
  if (reminderWindow) {
    reminderWindow.destroy();
    reminderWindow = null;
  }
});

// 设置开机自启动
ipcMain.on('set-auto-start', function (_, enabled) {
  // 立即生效（保留用户设置的 startHidden 偏好）
  const mainSettings = loadMainSettings();
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: mainSettings.startHidden || false
  });
  // 持久化到配置文件，下次启动时读取
  mainSettings.autoStart = enabled;
  saveMainSettings(mainSettings);
});

// 注册/修改快捷键（invoke 方式，返回结果给渲染进程）
ipcMain.handle('register-shortcut', function (_, action, newShortcut) {
  const result = updateShortcut(action, newShortcut);
  return result;
});

// 打开外部链接
ipcMain.on('open-external', function (_, url) {
  shell.openExternal(url);
});

// 获取应用版本号（从 package.json 读取）
ipcMain.handle('get-app-version', function () {
  return app.getVersion();
});

// 处理窗口置顶切换
ipcMain.on('toggle-always-on-top', function () {
  if (!mainWindow) return;
  // 切换置顶状态（取反）
  const newState = !mainWindow.isAlwaysOnTop();
  mainWindow.setAlwaysOnTop(newState);
  // 通知页面状态已变化
  mainWindow.webContents.send('always-on-top-changed', newState);
});

// 处理窗口大小调整（用于便签模式折叠/展开/自适应）
ipcMain.on('resize-window', function (_, width, height, resizable) {
  if (!mainWindow) return;
  // 便签模式下动态调整最小高度限制，允许窗口随内容缩小
  if (height <= 80) {
    // 折叠状态：只显示标题栏，允许缩到最小
    mainWindow.setMinimumSize(200, 50);
  } else {
    // 展开状态：自适应内容，最小高度设为标题栏高度（允许很小）
    mainWindow.setMinimumSize(200, 80);
  }
  mainWindow.setSize(width, height, true); // true = 动画效果，更平滑
  // 设置窗口是否可拖拽调整大小（折叠时固定大小）
  mainWindow.setResizable(resizable !== false);
});

// 【v2.14.0】处理退出便签模式请求（渲染进程通过双击 Esc 触发）
ipcMain.on('exit-sticky-mode', function () {
  if (isStickyMode) {
    toggleStickyMode(false);
  }
});

// 从操作指南页面返回主页面
ipcMain.on('load-main-page', function () {
  if (mainWindow) {
    mainWindow.loadFile('src/index.html');
  }
});

// 切换便签模式
function toggleStickyMode(enable) {
  if (!mainWindow) return;

  // 状态没变则不操作
  if (isStickyMode === enable) return;
  isStickyMode = enable;

  if (enable) {
    // 进入便签模式：用 toolbar 类型重建窗口（Windows+D 无法最小化）
    const { screen } = require('electron');
    const display = screen.getPrimaryDisplay();
    const { width: screenW } = display.workArea;

    let posX, posY;
    if (stickyPosition) {
      posX = stickyPosition.x;
      posY = stickyPosition.y;
    } else {
      // 首次：右上角（留 10px 边距）
      posX = screenW - 480 - 10;
      posY = 10;
    }

    // 销毁旧窗口
    mainWindow.destroy();

    // 创建 toolbar 类型窗口（不受 Windows+D 影响）
    // minHeight 设小，允许便签模式根据内容自适应高度
    mainWindow = new BrowserWindow({
      width: 480,
      height: 760,
      minWidth: 200,
      minHeight: 80,
      x: posX,
      y: posY,
      title: 'ToDoList',
      icon: getIconPath(),
      autoHideMenuBar: true,
      titleBarStyle: 'hidden',     // 隐藏原生标题栏，与主窗口一致
      backgroundColor: '#F2F2F7',
      type: 'toolbar',  // 关键：toolbar 类型不受 Windows+D 影响
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'preload.js'),
        spellcheck: false
      }
    });

    // 重新加载页面
    mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

    // 页面加载完成后显示窗口并通知进入便签模式
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.send('sticky-mode', true);
      mainWindow.show();
    });

    // 重新绑定关闭拦截
    mainWindow.on('close', (e) => {
      if (!isQuitting) {
        e.preventDefault();
        mainWindow.hide();
      }
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    // 监听拖动，记住位置
    mainWindow.on('move', saveStickyPosition);

  } else {
    // 退出便签模式：恢复普通窗口
    const [posX, posY] = mainWindow.getPosition();

    // 保存当前位置
    stickyPosition = { x: posX, y: posY };

    // 销毁 toolbar 窗口
    mainWindow.destroy();

    // 创建普通窗口
    mainWindow = new BrowserWindow({
      width: 480,
      height: 760,
      minWidth: 360,
      minHeight: 520,
      x: posX,
      y: posY,
      title: 'ToDoList',
      icon: getIconPath(),
      autoHideMenuBar: true,
      titleBarStyle: 'hidden',     // 隐藏原生标题栏，与主窗口一致
      backgroundColor: '#F2F2F7',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'preload.js'),
        spellcheck: false
      }
    });

    // 重新加载页面
    mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

    // 页面加载完成后显示窗口并通知退出便签模式
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.send('sticky-mode', false);
      mainWindow.show();
    });

    // 重新绑定关闭拦截
    mainWindow.on('close', (e) => {
      if (!isQuitting) {
        e.preventDefault();
        mainWindow.hide();
        if (tray && !tray._notifiedOnce) {
          tray.displayBalloon({
            iconType: 'info',
            title: 'ToDoList',
            content: '我还在后台运行哦～提醒不会漏掉的！点击托盘图标重新打开。'
          });
          tray._notifiedOnce = true;
        }
      }
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }
}

// 记住便签拖动后的位置
function saveStickyPosition() {
  if (!mainWindow) return;
  const [x, y] = mainWindow.getPosition();
  stickyPosition = { x, y };
}

// 安全：拒绝创建新窗口，统一在当前窗口打开（防止 target=_blank 拉起外部浏览器外的窗口）
app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    // 所有外部链接交给系统默认浏览器
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
});
