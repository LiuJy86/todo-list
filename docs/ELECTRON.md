# 桌面应用打包指南（Electron）

本文档说明如何将待办事项清单 Web 应用打包为 Windows 桌面应用。

## 前置要求

- **Node.js** ≥ 18（推荐 LTS 版本）：https://nodejs.org/
- **Git**（克隆仓库用）
- **Windows 10/11**（打包 Windows 安装包）

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 开发模式运行
```bash
npm start
```
或带 DevTools 调试：
```bash
npm run dev
```

### 3. 打包为 Windows 安装包
```bash
npm run build
```
生成物在 `dist/` 目录下：
- `待办事项清单-Setup-2.6.0.exe`：NSIS 安装包（推荐分发）
- `待办事项清单-2.6.0-portable.exe`：免安装便携版（双击即用）

## 应用特性

### 系统托盘常驻
- 关闭主窗口时**最小化到系统托盘**（而非退出），确保提醒功能不中断
- 首次隐藏到托盘时弹出系统通知提示
- 托盘右键菜单：显示窗口 / 隐藏 / 便签模式 / 设置 / 访问 GitHub / 查看指南 / 退出
- 单击托盘：切换显示/隐藏
- 双击托盘：始终显示

### 全局快捷键
- `Alt+F`：快速显示/隐藏主窗口（默认，可自定义）
- `Alt+G`：切换便签模式（默认，可自定义）
- 即使窗口已隐藏到托盘，按下快捷键也能一键呼出
- 应用退出时自动注销，避免快捷键残留占用
- 用户可在设置中自定义快捷键，修改后立即生效并持久化

### 设置中心
- 入口：托盘菜单「⚙️ 设置」
- 功能：开机自启动、快捷键自定义、个性化设置、检查更新、GitHub 链接、用户引导
- 设置持久化：`%APPDATA%/ToDoList/settings.json`

### 个性化设置（v2.24.0）
- **自定义提示音效**：用户可选择本地音频文件替代默认音效，支持试听和恢复默认
  - 支持格式：mp3、wav、ogg、flac、m4a、aac
  - 存储路径：`%APPDATA%/ToDoList/custom-assets/sound-*.{ext}`
- **自定义桌宠动图**：用户可添加多张图片替代默认史迪奇 GIF，支持预览和清空
  - 支持格式：gif、png、jpg、jpeg、webp、bmp、apng
  - 存储路径：`%APPDATA%/ToDoList/custom-assets/image-*.{ext}`
- 自定义资源通过 IPC 通道 `electronAPI` 与主进程通信
- 文件：`src/settings.js`、`electron/main.js`、`electron/preload.js`

### 无边框窗口
- 隐藏 Windows 原生标题栏（`titleBarStyle: 'hidden'`）
- 页面 header 作为可拖拽区域移动窗口
- 操作按钮（置顶、折叠、添加）排除拖拽区域，正常点击
- 设置窗口、便签模式窗口同样无边框，切换时视觉一致
- 文件：`electron/main.js`、`src/style.css`

### 全局滚动条隐藏
- 所有页面滚动条隐藏，保留鼠标滚轮/触摸板滚动功能
- 覆盖 Firefox/IE/Edge/Chrome/Safari 全平台
- 文件：`src/style.css`

### 单实例锁
- 防止多开，第二次启动时自动聚焦到已有窗口

### 安全配置
- `contextIsolation: true`：上下文隔离
- `nodeIntegration: false`：禁用 Node 集成
- 外部链接（GitHub 仓库等）自动交给系统默认浏览器打开

## 图标准备

打包前需要准备 `electron/build/icon.ico` 图标文件，详见 [electron/build/README.md](electron/build/README.md)。

临时方案：无图标也能运行（`npm start` 不需要图标），但打包会有警告。

## 目录结构

```
todo-list/
├── electron/
│   ├── main.js          # Electron 主进程入口
│   ├── icon.ico         # 应用图标
│   └── build/           # electron-builder 打包资源目录
├── src/
│   ├── index.html       # 主页面
│   ├── script.js        # 交互逻辑
│   ├── style.css        # 样式
│   ├── user_guide.html  # 操作指南
│   ├── 提示音效.mp3
│   └── img/             # 桌宠 GIF
├── scripts/             # 打包脚本
├── docs/                # 文档
└── package.json         # 项目配置
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm start` | 开发模式运行 |
| `npm run dev` | 开发模式 + DevTools |
| `npm run build` | 打包 Windows NSIS 安装包 |
| `npm run build:portable` | 打包 Windows 免安装便携版 |

## 打包后行为

- **数据存储**：localStorage 数据持久化在 Electron 的用户数据目录下
  - 路径：`%APPDATA%/待办事项清单/`
  - 卸载应用会清除数据（便携版除外）
- **自定义资源**：用户自定义的音效和图片存储在 `custom-assets` 子目录
  - 路径：`%APPDATA%/待办事项清单/custom-assets/`
  - 卸载应用会清除（便携版除外）
- **提醒功能**：关闭窗口到托盘后，setTimeout 定时器继续运行，到点照常提醒
- **音效**：`提示音效.mp3` 随应用打包，无需额外配置
- **自定义音效**：用户选择的音频文件会被复制到 `custom-assets` 目录，提醒时优先使用
- **自动播放策略**：Electron 环境下不受浏览器自动播放策略限制，首次到点即可出声

## 常见问题

### Q1: `npm install` 下载 Electron 很慢？
配置国内镜像：
```bash
npm config set registry https://registry.npmmirror.com
npm config set electron_mirror https://registry.npmmirror.com/-/binary/electron/
npm config set electron_builder_binaries_mirror https://registry.npmmirror.com/-/binary/electron-builder-binaries/
npm install
```

### Q2: 打包失败提示找不到 icon.ico？
临时注释 `package.json` 中 `build.win.icon` 字段，或按 [electron/build/README.md](electron/build/README.md) 生成图标。

### Q3: 打包后窗口空白？
检查 `package.json` 的 `build.files` 字段是否包含了 `src/index.html`、`src/script.js`、`src/style.css`。

### Q4: 便携版和安装版的区别？
- **安装版（NSIS）**：需要安装，创建开始菜单/桌面快捷方式，数据存于 `%APPDATA%`
- **便携版（Portable）**：单 exe 文件，双击即用，数据存于 exe 同目录

### Q5: 如何减小安装包体积？
默认打包会包含完整 Chromium（约 150MB）。如需更小体积可考虑：
- 使用 `electron-builder` 的 `compression: maximum`
- 或改用 [Tauri](https://tauri.app/)（基于系统 WebView，包体约 10MB，但需要 Rust 环境）
