# 桌面端设置功能方案

> 本文档规划桌面应用的设置功能，包含开机自启动、快捷键设置、检查更新三大模块。

---

## 一、功能概览

```
┌─────────────────────────────────────────┐
│  ⚙️ 设置                                │
├─────────────────────────────────────────┤
│                                         │
│  常规                                    │
│  ├─ 开机自启动                       [开] │
│  └─ 启动时隐藏到托盘                 [关] │
│                                         │
│  快捷键                                  │
│  ├─ 显示/隐藏窗口   [ Alt+F ]   [修改]  │
│  └─ 切换便签模式   [ Alt+G ]   [修改]  │
│                                         │
│  更新                                    │
│  ├─ 当前版本    v2.17.0                  │
│  ├─ 自动检查更新                     [开] │
│  └─ 立即检查更新                    [按钮] │
│                                         │
│  关于                                    │
│  ├─ GitHub 仓库                     [链接] │
│  └─ 检查新版本                       [按钮] │
│                                         │
└─────────────────────────────────────────┘
```

---

## 二、模块详解

### 2.1 开机自启动

#### 实现方式

Electron 原生 API，零依赖：

```javascript
// electron/main.js
app.setLoginItemSettings({
  openAtLogin: true,        // 开机自动启动
  openAsHidden: true        // 启动时隐藏到托盘
});
```

#### 设置项

| 选项 | 说明 |
|:---|:---|
| 开机自启动 | 开关切换，记住用户选择 |
| 启动时隐藏 | 开机启动后不弹出窗口，静默到托盘 |

#### 存储

localStorage 持久化，键名：`settings.autoStart`、`settings.startHidden`

---

### 2.2 快捷键设置

#### 设计思路

用户点击输入框 → 按下想要的组合键 → 系统记录并注册

```
┌─────────────────────────────────────────┐
│  快捷键设置                              │
├─────────────────────────────────────────┤
│                                         │
│  显示/隐藏窗口                           │
│  ┌──────────────┐  ┌──────┐             │
│  │    Alt+F     │  │ 修改 │             │
│  └──────────────┘  └──────┘             │
│                                         │
│  切换便签模式                            │
│  ┌──────────────┐  ┌──────┐             │
│  │    Alt+G     │  │ 修改 │             │
│  └──────────────┘  └──────┘             │
│                                         │
└─────────────────────────────────────────┘
```

#### 默认快捷键

| 功能 | 默认快捷键 | 说明 |
|:---|:---|:---|
| 显示/隐藏窗口 | `Alt+F` | 快速呼出或隐藏主窗口 |
| 切换便签模式 | `Alt+G` | 在普通窗口和桌面便签模式间切换 |

> 两个快捷键都支持用户自定义修改

#### 实现要点

1. **捕获按键**：监听 `keydown`，组合 `Alt/Ctrl/Shift + 主键`
2. **冲突检测**：注册前检查 `globalShortcut.isRegistered()`
3. **持久化存储**：localStorage 保存自定义快捷键
4. **动态生效**：修改后立即注销旧快捷键、注册新快捷键
5. **便签模式切换**：调用已有的 `toggleStickyMode()` 函数

#### 代码框架

```javascript
// 渲染进程：捕获用户按下的组合键
inputEl.addEventListener('keydown', (e) => {
  e.preventDefault();
  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  parts.push(e.key.toUpperCase());
  const shortcut = parts.join('+');
  // 通过 IPC 发给主进程注册
  window.electronAPI.registerShortcut(action, shortcut);
});

// 主进程：注册快捷键
ipcMain.handle('register-shortcut', (event, action, shortcut) => {
  // 先注销旧的
  globalShortcut.unregister(shortcuts[action]);
  // 注册新的
  const success = globalShortcut.register(shortcut, () => {
    if (action === 'toggle-window') {
      toggleWindowVisibility();
    } else if (action === 'toggle-sticky') {
      toggleStickyMode(!isStickyMode);
    }
  });
  return { success };
});
```

---

### 2.3 检查更新

#### 两种方案对比

| | 方案A: electron-updater | 方案B: 手动版本比对 |
|:---|:---|:---|
| **用户体验** | ⭐⭐⭐ 自动下载+安装 | ⭐⭐ 提示后手动跳转下载 |
| **实现复杂度** | 需要配置发布流程 | 简单 fetch |
| **额外依赖** | `electron-updater` | 零依赖 |
| **发布流程** | GitHub Token + 打包签名 | 无特殊要求 |
| **适合场景** | 正式发布的桌面应用 | 个人/小范围使用 |

#### 推荐：先 B 后 A

> 当前阶段用**方案B（零依赖）**，等用户量上来后再升级到方案A。

#### 方案 B 实现

```javascript
// 检查更新（渲染进程）
async function checkUpdate() {
  const currentVersion = '2.17.0';
  const response = await fetch(
    'https://api.github.com/repos/LiuJy86/todo-list/releases/latest'
  );
  const data = await response.json();
  const latestVersion = data.tag_name; // "v2.18.0"
  
  if (compareVersion(latestVersion, currentVersion) > 0) {
    // 有新版本 → 弹窗 + 跳转 GitHub Releases
    shell.openExternal(data.html_url);
  }
}
```

#### 方案 A（electron-updater）实现

**安装依赖**：
```bash
npm install electron-updater --save
```

**package.json 添加发布配置**：
```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "LiuJy86",
      "repo": "todo-list"
    }
  },
  "scripts": {
    "publish": "electron-builder --win --publish always"
  }
}
```

**主进程更新逻辑**：
```javascript
const { autoUpdater } = require('electron-updater');

// 发现新版本
autoUpdater.on('update-available', (info) => {
  mainWindow.webContents.send('update-available', info);
});

// 下载进度
autoUpdater.on('download-progress', (progress) => {
  mainWindow.webContents.send('download-progress', progress);
});

// 下载完成
autoUpdater.on('update-downloaded', (info) => {
  mainWindow.webContents.send('update-downloaded', info);
});

// 启动时检查（打包后才检查）
if (app.isPackaged) {
  autoUpdater.checkForUpdates();
}
```

**发布流程**：
```
1. 修改 package.json 版本号 "2.17.0" → "2.18.0"
2. git tag v2.18.0
3. git push origin master --tags
4. npm run publish
   → 自动打包 .exe
   → 自动创建 GitHub Release
   → 自动上传安装包
5. 用户下次启动自动收到更新提示
```

---

## 三、文件结构

```
electron/
├── main.js              # ← 修改：设置窗口、开机自启动、快捷键注册、更新逻辑
└── preload.js           # ← 修改：暴露 settings API

src/
├── settings.html        # ← 新增：设置页面结构
├── settings.js          # ← 新增：设置页面逻辑
└── settings.css         # ← 新增：设置页面样式
```

---

## 四、开发工作流

### 阶段一：基础设施（设置窗口）

| 步骤 | 任务 | 文件 | 预计时间 |
|:---:|:---|:---|:---:|
| 1.1 | 创建设置页面结构 | `src/settings.html` | 30min |
| 1.2 | 设置页面样式 | `src/settings.css` | 20min |
| 1.3 | 设置页面逻辑 | `src/settings.js` | 20min |
| 1.4 | 主进程添加 `createSettingsWindow()` | `electron/main.js` | 10min |
| 1.5 | 托盘菜单添加「⚙️ 设置」入口 | `electron/main.js` | 5min |
| 1.6 | preload 暴露 `openSettings` API | `electron/preload.js` | 5min |

**验收**：点击托盘「⚙️ 设置」→ 弹出设置窗口

---

### 阶段二：开机自启动

| 步骤 | 任务 | 文件 | 预计时间 |
|:---:|:---|:---|:---:|
| 2.1 | 设置页面添加开关 | `src/settings.html` | 5min |
| 2.2 | 读取/保存状态到 localStorage | `src/settings.js` | 10min |
| 2.3 | 主进程监听并调用 API | `electron/main.js` | 10min |
| 2.4 | 启动时读取设置并应用 | `electron/main.js` | 5min |

**验收**：开关切换后重启电脑生效

---

### 阶段三：快捷键设置

| 步骤 | 任务 | 文件 | 预计时间 |
|:---:|:---|:---|:---:|
| 3.1 | 设置页面添加快捷键区域（显示/隐藏 + 便签模式） | `src/settings.html` | 15min |
| 3.2 | 实现按键捕获输入框 | `src/settings.js` | 20min |
| 3.3 | 主进程实现注册 IPC（支持多个快捷键） | `electron/main.js` | 15min |
| 3.4 | 便签模式快捷键调用 `toggleStickyMode()` | `electron/main.js` | 10min |
| 3.5 | 冲突检测与提示 | `src/settings.js` | 10min |
| 3.6 | 持久化 + 启动恢复 | 多文件 | 10min |

**验收**：
- 修改快捷键后立即生效，重启后保持
- 按 `Alt+G` 切换便签模式，窗口正确转换

---

### 阶段四：检查更新

| 步骤 | 任务 | 文件 | 预计时间 |
|:---:|:---|:---|:---:|
| 4.1 | 设置页面添加更新区域 | `src/settings.html` | 10min |
| 4.2 | GitHub API 请求 + 版本比对 | `src/settings.js` | 20min |
| 4.3 | 有新版本弹窗 + 跳转 | `src/settings.js` | 10min |
| 4.4 | 网络异常处理 | `src/settings.js` | 10min |

**验收**：点击检查更新 → 正确提示结果

---

### 阶段五：测试 + 文档

| 步骤 | 任务 | 文件 | 预计时间 |
|:---:|:---|:---|:---:|
| 5.1 | 手动测试所有设置项 | — | 20min |
| 5.2 | 边界情况测试 | — | 15min |
| 5.3 | 更新 CHANGELOG.md | `docs/CHANGELOG.md` | 10min |
| 5.4 | 更新 README.md | `docs/README.md` | 5min |
| 5.5 | 更新 ELECTRON.md | `docs/ELECTRON.md` | 5min |
| 5.6 | 提交代码 | git | 5min |

---

## 五、时间估算

| 阶段 | 内容 | 时间 |
|:---:|:---|:---:|
| 一 | 基础设施（设置窗口） | 1.5h |
| 二 | 开机自启动 | 0.5h |
| 三 | 快捷键设置 | 1h |
| 四 | 检查更新 | 1h |
| 五 | 测试 + 文档 | 1h |
| **合计** | | **5h** |

---

## 六、提交策略

```
阶段一 + 阶段二 → 提交：feat: 添加设置窗口和开机自启动
阶段三           → 提交：feat: 添加快捷键自定义设置
阶段四 + 阶段五 → 提交：feat: 添加检查更新功能
```

每次提交都有**独立可用的功能**，方便回滚和审查。

---

## 七、备注

- 检查更新功能**推荐先用方案B（零依赖）**，后续有需要再升级到 electron-updater
- 快捷键设置需要考虑跨平台差异（macOS 用 Cmd 代替 Ctrl）
- 所有用户设置通过 localStorage 持久化，键名统一用 `settings.` 前缀
