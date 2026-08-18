# 待办事项清单 - 项目部署文档

## 1. 项目概述

本项目是一个基于纯前端技术栈（HTML/CSS/JavaScript）的轻量级待办事项清单应用。
- **核心功能**：输入、添加、标记完成（自动沉底）、删除、**提醒日期 + 到点提示音**（自定义 MP3 / 合成音兜底）、**双组收纳**（未完成≥5 / 已完成≥3）、**localStorage 永久持久化**（支持跨会话提醒调度）、DOM 节点复用实现无闪动更新。
- **技术特点**：无构建依赖、无后端服务、数据存储于浏览器 `localStorage`、提醒功能三道保障（精确 setTimeout + 切回前台补触发 + 60s 兜底）。
- **桌宠系统**：左侧史迪奇 6 张 GIF 轮播（3-5 秒随机切换）+ 情绪联动 + 对话气泡 Toast + 拖拽/隐藏/收纳。
- **适用场景**：个人日常任务管理、临时工作记录、带时效性提醒的轻量任务追踪。

## 2. 环境要求

由于项目是纯静态前端应用，**部署要求极低**，兼容主流浏览器与操作系统。

- **操作系统**：Windows、macOS、Linux 均可。
- **浏览器**：Chrome / Edge / Firefox / Safari（支持 HTML5、ES6、Web Audio API 即可）。
  > 建议使用 **Chrome ≥ 90 / Edge ≥ 90**，这两个浏览器对 `localStorage`、HTMLAudioElement 中文路径、Web Audio `resume()` 等 API 表现最稳定。
- **音频文件（必需）**：项目根目录需包含 `提示音效.mp3`。若该文件缺失，应用会自动回退到 Web Audio 合成"叮咚"声（保证不会无声），但音质与用户预期可能不一致，**部署时请务必把此文件一起上传**。
- **Node.js (可选)**：仅在需要通过 `http-server` 等工具本地启动 Web 服务时需要。
  - 建议版本：Node.js >= 14.x
  - 若不安装 Node.js，可使用 Python 内置服务或直接双击 HTML 文件运行。

## 3. 快速开始（本地运行）

### 方式一：直接运行（最简单）
直接双击 `index.html` 文件即可在浏览器中打开使用。

> **注意**：部分浏览器在 `file://` 协议下会限制以下功能，因此 **强烈推荐使用方式二（本地 Web 服务器）**：
> - `localStorage` 可能被禁用（数据无法保存）
> - `提示音效.mp3` 的 `load()` / `play()` 可能被 CORS 策略拦截（即使 prime 授权也无法播放）
> - AudioContext 无法被自动 resume

### 方式二：本地 Web 服务器（**强烈推荐**）

通过本地 HTTP 服务器托管文件，确保 `localStorage` 永久存储、提醒功能调度、MP3 预加载全链路正常。

#### 步骤：
1. **进入项目目录**
   ```bash
   cd path/to/your/project
   ```

2. **启动服务**
   - **使用 Python (若已安装)**
     ```bash
     # Python 3.x 版本
     python -m http.server 8010
     ```
   - **使用 Node.js (若已安装)**
     ```bash
     # 全局安装 http-server
     npm install -g http-server
     # 启动服务（-c-1 禁用缓存，避免修改后仍取旧文件）
     http-server -p 8010 -c-1
     ```

3. **访问应用**
   打开浏览器，访问 `http://localhost:8010`。
   进入后建议先点一次 **「🔊 测试音效」** 按钮：既可以确认声音正常，也会完成浏览器音频授权（unlock AudioContext + prime HTMLAudio），确保后续到点提醒能合法播放 MP3。

## 4. 生产部署（可选）

如需将应用部署到公网服务器以供他人访问，可选择任意静态文件托管服务。

### 4.1 通用 Web 服务器 (Nginx 示例)
1. **将以下文件和目录**上传至服务器的 `/var/www/todolist` 目录（缺一不可）：
   ```
   index.html        # 页面主文件
   style.css         # 样式文件（含史迪奇 / 提醒 / 音效按钮 / 响应式等所有样式）
   script.js         # 交互脚本（含提醒 / 收纳 / 桌宠 / 存储迁移等）
   提示音效.mp3       # MP3 提示音（务必一起上传！否则自动回退合成音兜底）
   img/              # 史迪奇 GIF 动图（需保留内部 6 张 gif，_original 可选）
   ```
   > `Task.md`、`CHANGELOG.md`、`deployment_guide.md`、`verify_*.py`、`screenshots/`、`.claude/`、`.trae/` 均为开发期文档/脚本/截图，**非运行必需**，可不上传。

2. 在 Nginx 配置中添加静态文件服务：
   ```nginx
   server {
       listen 80;
       server_name your_domain.com;

       root /var/www/todolist;
       index index.html;

       # 静态资源缓存：CSS/JS/MP3/IMG 加版本或长期缓存
       # 注意：style.css 在 index.html 中已带 ?v=N 版本参数
       location ~* \.(css|js|mp3|gif|png|jpg|svg)$ {
           expires 30d;
           add_header Cache-Control "public, immutable";
       }

       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```
3. 重载 Nginx：`nginx -s reload`

### 4.2 对象存储 / CDN (OSS/S3/Cloudflare)

直接将 **4.1 列的必需文件** 上传至对象存储桶的根目录，开启静态网站托管功能，并将 `index.html` 设置为默认首页。

> **CORS 注意**：若把 `提示音效.mp3` 放到独立 CDN 域下，需要确保 CDN 返回的 `Access-Control-Allow-Origin` 包含页面所在域，否则浏览器会拒绝 HTMLAudioElement 播放。最简单的做法是保持 `提示音效.mp3` 与 `index.html` 同域。

## 5. 自动化测试与验证

项目已包含基于 Playwright 的自动化测试脚本 `verify_playwright.py`（核心功能）与 `verify_optimization.py`（收纳功能专项），可用于回归验证。

### 5.1 测试环境依赖
```bash
# 安装依赖
pip install playwright
# 安装 Chromium 浏览器内核
playwright install chromium
```

### 5.2 执行测试
1. **先启动本地服务**（建议端口 8000/8010，测试脚本默认访问对应端口）
   ```bash
   python -m http.server 8010
   ```
2. **运行测试脚本**
   ```bash
   # 新开一个终端，在项目目录执行
   python verify_playwright.py
   ```
3. **查看测试截图**
   运行完成后，所有测试步骤的截图会自动保存在项目下的 `screenshots/` 目录，文件名形如 `01_initial.png`、`opt_01_initial.png` 等，便于回归对比与问题排查。

### 5.3 测试用例覆盖
- **初始状态**：空列表、空存储。
- **添加流程**：输入事项、回车添加、列表渲染、`localStorage` 同步。
- **完成状态**：勾选复选框、应用 `completed` 样式、文本加删除线、该事项自动移至列表末尾，未完成事项按原顺序向上冒泡。
- **删除流程**：点击删除、DOM 移除、数据持久化更新。
- **持久化验证**：刷新页面后，数据完整保留且状态正确（**localStorage，关闭浏览器再打开仍保留**，不再是旧版的 session 隔离）。
- **收纳功能**：
  - 已完成项超过 3 条时自动收纳，未完成项超过 5 条时自动收纳，两组颜色区分（蓝绿 vs 紫）
  - 点击任一收纳按钮可展开/收起全部被收纳项
  - 勾选/取消勾选无闪动，DOM 节点复用
- **提醒功能（需手动验证，Playwright 不支持音频输出）**：
  - 输入「8:00 吃饭」自动解析时间，datetime-local 同步显示
  - 点击「🔊 测试音效」按钮有声音 + 按钮脉冲动画
  - 设置 3 秒后提醒 → 到点播放 MP3 / 合成音 + 红框抖动 + 史迪奇气泡

## 6. 目录结构（运行必需）

```
project-root/
├── index.html               # 页面主文件
├── style.css                # 样式文件（含史迪奇 / 提醒 / 收纳 / 音效按钮 / 响应式等）
├── script.js                # 交互脚本（含提醒 IIFE、收纳、桌宠、toast 气泡、存储迁移）
├── 提示音效.mp3              # 【必需】自定义 MP3 提示音，缺失时自动回退合成音
├── img/                     # 桌宠 GIF（6 张：史迪奇1.gif ~ 史迪奇6.gif）
│   └── _original/           # 原稿备份（运行时不引用，可不传）
│
├── ——— 以下为开发资产，部署可省略 ———
├── screenshots/             # 测试截图
├── verify_playwright.py     # 核心功能自动化测试脚本
├── verify_optimization.py   # 收纳功能专项测试脚本
├── deployment_guide.md      # 本文档
├── README.md                # 项目说明
├── CHANGELOG.md             # 更新日志
├── Task.md                  # 任务拆解文档
├── .claude/                 # IDE 配置与开发约束
└── .trae/                   # IDE 草稿与文档
```

## 7. 常见问题 (FAQ)

**Q1: 数据会保存在哪？会丢失吗？**
A: 自 v2.1 起，数据保存在浏览器的 **`localStorage`**（不再是旧版的 sessionStorage）。
- **保留**：刷新页面 (`F5`)、关闭再打开浏览器、甚至电脑重启后都不会丢失。
- **丢失**：仅当用户手动清除浏览器缓存数据（或 localStorage 满后被浏览器回收）时才会清空。
- **一次性迁移**：老版本用户首次打开 v2.1+ 时，若 `localStorage` 无数据但 `sessionStorage` 有旧数据，系统会自动搬到 `localStorage` 并清掉 `sessionStorage`，做到无感知升级。

**Q2: 提醒功能怎么不响？（最常见）**
A: 这通常是 **浏览器自动播放策略** 导致的，按以下步骤逐一排查：
1. **音频授权**：页面打开后，先点击一次任何交互元素（推荐点「🔊 测试音效」按钮）。浏览器要求首次 play 必须在用户手势内触发。
2. **文件是否存在**：确认「提示音效.mp3」与 index.html 同目录、同域、同权限。部署后可打开 DevTools → Network 看「提示音效.mp3」是否返回 200（而不是 404 / 403 / CORS 拦截）。
3. **系统音量**：确认系统和浏览器标签页本身未静音（标签页右键 → "解除网站静音"）。
4. **兜底路径**：即便 MP3 缺失，应用也会自动播放 Web Audio 合成"叮咚"两声。如果合成音也没声音 → 说明步骤 1 的首次手势没完成，或 AudioContext 处于 suspended。点击「🔊 测试音效」会同时完成 unlock + prime。

**Q3: 浏览器关闭后为什么提醒没触发？**
A: 纯前端应用无后台进程。**浏览器完全关闭后 setTimeout/setInterval/AudioContext 全部停止**，这是浏览器沙箱的硬限制（与技术栈无关）。
- **可行做法**：保持页面打开（最小化 / 放后台标签页均可）。橙色提示条会一直显示此提醒。
- **后台标签页降频**：部分浏览器对后台标签页定时器做降频（最小 ~1 分钟），应用已配置 visibilitychange + 60 秒 setInterval 兜底，切回前台或最迟 1 分钟内会补触发。
- **需要真·后台提醒**：需引入后端数据库 + Web Push Notification（Service Worker），超出当前项目约束。

**Q4: 收纳功能的阈值可以调整吗？**
A: 可以。修改 `script.js` 顶部两个常量即可：
- `VISIBLE_PENDING_LIMIT = 5`：未完成项收纳阈值（超过此值的未完成项自动收纳）
- `VISIBLE_COMPLETED_LIMIT = 3`：已完成项收纳阈值
收纳的内容（数据本身）会通过 `localStorage` 持久保存，但展开/收起状态不会持久化，每次刷新页面后收纳区默认收起。

**Q5: 提示音 MP3 可以换成别的吗？**
A: 可以。直接把你想用的 MP3 文件名改成「提示音效.mp3」覆盖原文件即可；或者保留你自己的文件名，修改 `script.js` 11.4 模块顶部的常量 `REMINDER_MP3_SRC = encodeURI('你的文件名.mp3')` 即可。两种方式都不需要再改 HTML 或 CSS。
- 建议：MP3 时长 ≤ 2 秒（如「叮咚」/「铃铃」等），避免 800ms 节流窗口内被打断。

**Q6: 为什么勾选/取消勾选时界面没有闪动？**
A: v1.3.0 引入了 DOM 节点缓存机制。使用 `Map`（`nodeCache`）缓存已创建的 `<li>` 节点，操作时通过 `insertBefore` 移动节点位置，而非重建 DOM。浏览器不需要重新解析样式和布局，操作流畅。同时徽章倒计时（每 30 秒刷新）也只改 `textContent`，不触发 render 和 localStorage 写操作。

**Q7: 能否多人协作？跨设备同步？**
A: 目前设计为单人单设备使用。`localStorage` 仅限当前浏览器当前设备。若需多人/跨设备协作，需要引入后端（如 Firebase、MySQL、Supabase）并改造 `script.js` 中的 `load()/save()` 读写逻辑，超出当前项目范围。
