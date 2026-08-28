// Electron 主进程入口
// 负责创建窗口、系统托盘、应用生命周期管理
const { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain, globalShortcut, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// 【内存优化】禁用 GPU 进程沙箱（单窗口应用不需要）
// app.disableHardwareAcceleration(); // 如需进一步减少内存可取消注释（会牺牲动画性能）

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

// ============================================
// 自定义资源管理（v2.24.0）
// ============================================

// 获取自定义资源根目录
function getCustomAssetsDir() {
  return path.join(app.getPath('userData'), 'custom-assets');
}

// 确保自定义资源目录存在
function ensureCustomAssetsDir() {
  const dir = getCustomAssetsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// 复制用户选择的文件到自定义资源目录
// prefix: 文件名前缀（'sound' 或 'image'）
// 返回: { success, filename } 或 { success: false, error }
function copyCustomFile(sourcePath, prefix) {
  try {
    const dir = ensureCustomAssetsDir();
    const ext = path.extname(sourcePath) || '';
    const basename = prefix + '-' + Date.now() + ext;
    const dest = path.join(dir, basename);
    fs.copyFileSync(sourcePath, dest);
    return { success: true, filename: basename };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// 删除自定义资源文件
function deleteCustomFile(filename) {
  try {
    if (!filename) return { success: true };
    const filePath = path.join(getCustomAssetsDir(), filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// 获取自定义音效文件名（最新的那个）
function getCustomSoundFilename() {
  try {
    const dir = getCustomAssetsDir();
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir).filter(function (f) {
      return f.startsWith('sound-');
    });
    return files.length > 0 ? files[0] : null;
  } catch (e) {
    return null;
  }
}

// 获取所有自定义图片文件名
function getCustomImageFilenames() {
  try {
    const dir = getCustomAssetsDir();
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(function (f) {
      return f.startsWith('image-');
    });
  } catch (e) {
    return [];
  }
}

let mainWindow = null;   // 主窗口
let tray = null;          // 系统托盘
let isQuitting = false;   // 是否真正退出（区分关闭到托盘和退出）
let trayNotified = false; // 是否已显示过托盘提示（替代 trayNotified）

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

// 创建主窗口（isToolbar: 是否用 toolbar 类型，便签模式使用；showStart: 是否初始显示）
function createWindow(isToolbar, showStart) {
  const config = {
    width: 480,
    height: 760,
    minWidth: 360,
    minHeight: 520,
    show: showStart !== false,   // 默认显示；false = 创建时不显示（避免闪烁）
    title: 'ToDoList',
    icon: getIconPath(),
    autoHideMenuBar: true,        // 隐藏菜单栏
    titleBarStyle: 'hidden',     // 隐藏原生标题栏（内容延伸到窗口边缘）
    backgroundColor: '#F2F2F7',   // 与页面渐变起始色一致，避免白屏
    webPreferences: {
      contextIsolation: true,     // 上下文隔离（安全）
      nodeIntegration: false,     // 禁用 Node 集成（安全）
      preload: path.join(__dirname, 'preload.js'),  // 预加载脚本
      spellcheck: false,
      // 【内存优化】禁用不必要的功能，减少进程开销
      webSecurity: true,
      enableWebSQL: false,        // 禁用 WebSQL（已废弃）
      webgl: false                // 禁用 WebGL（本应用不需要 3D 渲染）
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
      if (tray && !trayNotified) {
        tray.displayBalloon({
          iconType: 'info',
          title: 'ToDoList',
          content: '我还在后台运行哦～提醒不会漏掉的！点击托盘图标重新打开。'
        });
        trayNotified = true;
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
    const exePath = app.getPath('exe');
    app.setLoginItemSettings({
      openAtLogin: mainSettings.autoStart,
      openAsHidden: mainSettings.startHidden || false,
      // 指定可执行文件路径，确保启动的是 ToDoList 而不是 electron
      path: exePath !== 'electron.exe' ? exePath : undefined,
      args: []
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
  // 如果提醒窗口已存在，先安全关闭旧的
  if (reminderWindow && !reminderWindow.isDestroyed()) {
    reminderWindow.close();  // close 触发 closed 事件，自动清理引用
    // 注意：不需要手动设 null，closed 事件回调会处理
  } else if (reminderWindow) {
    // 窗口已销毁但引用未清理，手动清空
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

  // 加载提醒页面，传递待办数据和自定义资源
  // 手动构建 query 字符串，确保编码一致
  const todoData = encodeURIComponent(JSON.stringify(todo));
  const customSound = encodeURIComponent(getCustomSoundFilename() || '');
  const customImages = encodeURIComponent(JSON.stringify(getCustomImageFilenames()));
  const queryString = 'todo=' + todoData + '&sound=' + customSound + '&images=' + customImages;
  const reminderUrl = 'file:///' + path.join(__dirname, '..', 'src', 'reminder.html').replace(/\\/g, '/') + '?' + queryString;
  console.log('[主进程] 加载提醒窗口 URL:', reminderUrl.substring(0, 200) + '...');
  reminderWindow.loadURL(reminderUrl);

  // 窗口关闭时清理引用，并把焦点交回主窗口
  reminderWindow.on('closed', () => {
    reminderWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
    }
  });

  // 已弹出提醒窗口
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

  // 已设置提醒定时器
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
    // 已取消定时器
  }
}

// 创建系统托盘
function createTray() {
  // 销毁旧托盘图标，避免重复创建出现多个托盘图标
  if (tray) {
    tray.destroy();
    tray = null;
  }

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

  // 创建托盘菜单
  buildTrayMenu();

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

// 【优化】构建托盘菜单（独立函数，支持仅更新菜单而不重建托盘）
function buildTrayMenu() {
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
    {
      label: '便签模式',
      type: 'checkbox',
      checked: isStickyMode,
      click: () => {
        toggleStickyMode(!isStickyMode);
      }
    },
    { type: 'separator' },
    {
      label: '设置',
      click: () => {
        createSettingsWindow();
      }
    },
    { type: 'separator' },
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

  if (tray) {
    tray.setContextMenu(stickyMenu);
  }
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

    // 【修复】读取 startHidden 设置，决定是否初始隐藏窗口
    const mainSettings = loadMainSettings();
    const shouldHide = !!mainSettings.startHidden;
    console.log('[启动隐藏] settings.json 内容:', JSON.stringify(mainSettings));
    console.log('[启动隐藏] shouldHide =', shouldHide);

    createWindow(false, shouldHide);

    // 如果设置了隐藏，确保窗口不显示
    if (shouldHide && mainWindow) {
      mainWindow.hide();
    }

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

// 处理关闭窗口请求（隐藏到后台，程序继续运行）
ipcMain.on('hide-window', function () {
  if (mainWindow) {
    mainWindow.hide();
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
  // 稍后提醒
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
  // 关闭提醒窗口
  if (reminderWindow) {
    reminderWindow.destroy();
    reminderWindow = null;
  }
});

// 完成待办（从提醒窗口触发）
ipcMain.on('complete-todo-from-reminder', function (_, todoId) {
  // 完成待办
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
  const exePath = app.getPath('exe');
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: mainSettings.startHidden || false,
    // 指定可执行文件路径，确保启动的是 ToDoList 而不是 electron
    path: exePath !== 'electron.exe' ? exePath : undefined,
    args: []
  });
  // 持久化到配置文件，下次启动时读取
  mainSettings.autoStart = enabled;
  saveMainSettings(mainSettings);
});

// 【修复】设置启动时隐藏（同步到主进程配置文件）
ipcMain.on('set-start-hidden', function (_, enabled) {
  const mainSettings = loadMainSettings();
  mainSettings.startHidden = enabled;
  saveMainSettings(mainSettings);
  // 同步更新开机自启动的 openAsHidden 参数
  if (mainSettings.autoStart) {
    const exePath = app.getPath('exe');
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: enabled,
      path: exePath !== 'electron.exe' ? exePath : undefined,
      args: []
    });
  }
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

// ============================================
// 自定义资源 IPC 处理（v2.24.0）
// ============================================

// 获取 userData 路径
ipcMain.handle('get-user-data-path', function () {
  return app.getPath('userData');
});

// 选择音效文件（打开文件对话框）
ipcMain.handle('select-sound-file', async function () {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: '音频文件', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'] }
    ]
  });
  return result.canceled ? null : result.filePaths[0];
});

// 选择图片文件（多选）
ipcMain.handle('select-image-files', async function () {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '图片文件', extensions: ['gif', 'png', 'jpg', 'jpeg', 'webp', 'bmp', 'apng'] }
    ]
  });
  return result.canceled ? null : result.filePaths;
});

// 保存自定义音效
ipcMain.handle('save-custom-sound', async function (_, srcPath) {
  // 先清除旧的音效
  const oldSound = getCustomSoundFilename();
  if (oldSound) deleteCustomFile(oldSound);
  return copyCustomFile(srcPath, 'sound');
});

// 保存自定义图片
ipcMain.handle('save-custom-images', async function (_, srcPaths) {
  const results = [];
  srcPaths.forEach(function (srcPath) {
    const result = copyCustomFile(srcPath, 'image');
    if (result.success) {
      results.push(result.filename);
    }
  });
  return { success: true, filenames: results };
});

// 清除自定义音效
ipcMain.handle('clear-custom-sound', async function () {
  const oldSound = getCustomSoundFilename();
  if (oldSound) deleteCustomFile(oldSound);
  return { success: true };
});

// 清除所有自定义图片
ipcMain.handle('clear-custom-images', async function () {
  const images = getCustomImageFilenames();
  images.forEach(function (f) { deleteCustomFile(f); });
  return { success: true };
});

// 获取自定义资源信息
ipcMain.handle('get-custom-assets', async function () {
  return {
    sound: getCustomSoundFilename(),
    images: getCustomImageFilenames()
  };
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
    mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  }
});

// 切换便签模式
// 【优化】使用"先建后毁"策略，避免窗口闪烁
function toggleStickyMode(enable) {
  if (!mainWindow) return;

  // 状态没变则不操作
  if (isStickyMode === enable) return;
  isStickyMode = enable;

  // 保存旧窗口引用
  const oldWindow = mainWindow;

  // 【修复】移除旧窗口的 closed 事件 handler，避免销毁时误清 mainWindow
  oldWindow.removeAllListeners('closed');
  oldWindow.removeAllListeners('close');

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

    // 创建新窗口（隐藏状态，避免闪烁）
    mainWindow = new BrowserWindow({
      width: 480,
      height: 760,
      minWidth: 200,
      minHeight: 80,
      x: posX,
      y: posY,
      show: false,
      title: 'ToDoList',
      icon: getIconPath(),
      autoHideMenuBar: true,
      titleBarStyle: 'hidden',
      backgroundColor: '#F2F2F7',
      type: process.platform === 'win32' ? 'toolbar' : (process.platform === 'darwin' ? 'panel' : undefined),
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'preload.js'),
        spellcheck: false
      }
    });

    const newWindow = mainWindow;
    newWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

    newWindow.webContents.once('did-finish-load', () => {
      if (newWindow && !newWindow.isDestroyed()) {
        // 销毁旧窗口
        if (oldWindow && !oldWindow.isDestroyed()) {
          oldWindow.destroy();
        }
        // 通知并显示新窗口
        newWindow.webContents.send('sticky-mode', true);
        newWindow.show();
        newWindow.focus();
      }
    });

    newWindow.on('close', (e) => {
      if (!isQuitting) {
        e.preventDefault();
        newWindow.hide();
      }
    });

    newWindow.on('closed', () => {
      if (mainWindow === newWindow) mainWindow = null;
    });

    newWindow.on('move', saveStickyPosition);

  } else {
    // 退出便签模式：恢复普通窗口
    const [posX, posY] = mainWindow.getPosition();
    stickyPosition = { x: posX, y: posY };

    // 创建新窗口（隐藏状态，避免闪烁）
    mainWindow = new BrowserWindow({
      width: 480,
      height: 760,
      minWidth: 360,
      minHeight: 520,
      x: posX,
      y: posY,
      show: false,
      title: 'ToDoList',
      icon: getIconPath(),
      autoHideMenuBar: true,
      titleBarStyle: 'hidden',
      backgroundColor: '#F2F2F7',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'preload.js'),
        spellcheck: false
      }
    });

    const newWindow = mainWindow;
    newWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

    newWindow.webContents.once('did-finish-load', () => {
      if (newWindow && !newWindow.isDestroyed()) {
        // 销毁旧窗口
        if (oldWindow && !oldWindow.isDestroyed()) {
          oldWindow.destroy();
        }
        // 通知并显示新窗口
        newWindow.webContents.send('sticky-mode', false);
        newWindow.show();
        newWindow.focus();
      }
    });

    newWindow.on('close', (e) => {
      if (!isQuitting) {
        e.preventDefault();
        newWindow.hide();
        if (tray && !trayNotified) {
          tray.displayBalloon({
            iconType: 'info',
            title: 'ToDoList',
            content: '我还在后台运行哦～提醒不会漏掉的！点击托盘图标重新打开。'
          });
          trayNotified = true;
        }
      }
    });

    newWindow.on('closed', () => {
      if (mainWindow === newWindow) mainWindow = null;
    });
  }

  // 仅更新托盘菜单复选框状态，不重建整个托盘
  if (tray) {
    buildTrayMenu();
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
