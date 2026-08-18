# 待办事项清单 - 项目部署文档

## 1. 项目概述

本项目是一个基于纯前端技术栈（HTML/CSS/JavaScript）的轻量级待办事项清单应用。
- **核心功能**：输入、添加、标记完成（自动沉底）、删除、会话级数据持久化、收纳与展开。
- **技术特点**：无构建依赖、无后端服务、数据存储于浏览器 `sessionStorage`、DOM 节点复用实现无闪动更新。
- **适用场景**：个人日常任务管理、临时工作记录。
- **收纳机制**：已完成项超过 3 条时自动收纳，支持展开/收起切换，保持列表整洁。

## 2. 环境要求

由于项目是纯静态前端应用，**部署要求极低**，兼容主流浏览器与操作系统。

- **操作系统**：Windows、macOS、Linux 均可。
- **浏览器**：Chrome / Edge / Firefox / Safari（支持 HTML5 与 ES6 即可）。
- **Node.js (可选)**：仅在需要通过 `http-server` 等工具本地启动 Web 服务时需要。
  - 建议版本：Node.js >= 14.x
  - 若不安装 Node.js，可使用 Python 内置服务或直接双击 HTML 文件运行。

## 3. 快速开始（本地运行）

### 方式一：直接运行（最简单）
直接双击 `index.html` 文件即可在浏览器中打开使用。
> **注意**：`sessionStorage` 在 `file://` 协议下通常不可用，建议使用本地 Web 服务器方式。

### 方式二：本地 Web 服务器（推荐）
通过本地 HTTP 服务器托管文件，确保 `sessionStorage` 功能正常工作。

#### 步骤：
1. **进入项目目录**
   ```bash
   cd path/to/your/project
   ```

2. **启动服务**
   - **使用 Python (若已安装)**
     ```bash
     # Python 3.x 版本
     python -m http.server 8000
     ```
   - **使用 Node.js (若已安装)**
     ```bash
     # 全局安装 http-server
     npm install -g http-server
     # 启动服务
     http-server -p 8000
     ```

3. **访问应用**
   打开浏览器，访问 `http://localhost:8000`。

## 4. 生产部署（可选）

如需将应用部署到公网服务器以供他人访问，可选择任意静态文件托管服务。

### 4.1 通用 Web 服务器 (Nginx 示例)
1. 将 `index.html`, `style.css`, `script.js` 上传至服务器的 `/var/www/todolist` 目录。
2. 在 Nginx 配置中添加静态文件服务：
   ```nginx
   server {
       listen 80;
       server_name your_domain.com;

       root /var/www/todolist;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```
3. 重载 Nginx：`nginx -s reload`

### 4.2 对象存储 / CDN (OSS/S3/Cloudflare)
直接将三个文件上传至对象存储桶的根目录，开启静态网站托管功能，并将 `index.html` 设置为默认首页。

## 5. 自动化测试与验证

项目已包含基于 Playwright 的自动化测试脚本 `verify_playwright.py`，可用于回归验证。

### 5.1 测试环境依赖
```bash
# 安装依赖
pip install playwright
# 安装 Chromium 浏览器内核
playwright install chromium
```

### 5.2 执行测试
1. **先启动本地服务**
   ```bash
   python -m http.server 8000
   ```
2. **运行测试脚本**
   ```bash
   # 新开一个终端，在项目目录执行
   python verify_playwright.py
   ```
3. **查看测试截图**
   运行完成后，所有测试步骤的截图会自动保存在项目下的 `screenshots/` 目录，文件名形如 `01_initial.png`、`02_after_add.png` 等，便于回归对比与问题排查。

### 5.3 测试用例覆盖
脚本将自动验证以下核心流程：
- **初始状态**：空列表、空存储。
- **添加流程**：输入事项、回车添加、列表渲染、`sessionStorage` 同步。
- **完成状态**：勾选复选框、应用 `completed` 样式、文本加删除线、该事项自动移至列表末尾，未完成事项按原顺序向上冒泡。
- **删除流程**：点击删除、DOM 移除、数据持久化更新。
- **持久化验证**：刷新页面后，数据完整保留且状态正确。
- **会话隔离**：新标签页打开，数据为空（`sessionStorage` 特性验证）。
- **收纳功能**（v1.3.0 新增）：
  - 已完成项超过 3 条时自动收纳，显示收纳数量。
  - 点击收纳按钮可展开/收起已完成项。
  - 展开状态下显示「收起 ▲」，收起状态显示「还有 N 项已完成待办 ▼」。
  - 勾选/取消勾选无闪动，DOM 节点复用。

## 6. 目录结构

```
project-root/
├── index.html               # 页面主文件
├── style.css                # 样式文件（含收纳区样式）
├── script.js                # 交互脚本（含DOM节点缓存、收纳逻辑）
├── verify_playwright.py     # 核心功能自动化测试脚本
├── verify_optimization.py   # 收纳功能专项测试脚本
├── screenshots/             # 测试截图保存目录（运行测试时自动生成）
├── deployment_guide.md      # 本文档
├── Task.md                  # 任务拆解文档
└── CHANGELOG.md             # 更新日志
```

## 7. 常见问题 (FAQ)

**Q: 数据会保存在哪？会丢失吗？**
A: 数据保存在当前标签页的 `sessionStorage` 中。
- **保留**：刷新页面 (`F5`) 不会丢失。
- **丢失**：关闭标签页或关闭浏览器后，数据会清空。

**Q: 如何让数据永久保存？**
A: 可在 `script.js` 中，将 `STORAGE_KEY` 的存储位置从 `sessionStorage` 改为 `localStorage`。`localStorage` 数据将永久保留，除非用户手动清除浏览器缓存。

**Q: 能否多人协作？**
A: 目前设计为单人使用。若需多人协作，需要引入后端数据库（如 Firebase, MySQL），并改造 `script.js` 中的数据读写逻辑。

**Q: 收纳功能的阈值可以调整吗？**
A: 可以。修改 `script.js` 中的 `VISIBLE_COMPLETED_LIMIT` 常量即可调整收纳阈值。默认值为 3，即已完成项超过 3 条时自动收纳。

**Q: 为什么勾选/取消勾选时界面没有闪动？**
A: v1.3.0 版本引入了 DOM 节点缓存机制。使用 `Map` 缓存已创建的 `<li>` 节点，操作时通过 `insertBefore` 移动节点位置，而非重建 DOM。这样浏览器无需重新渲染，操作流畅无闪动。

**Q: 收纳状态会保存吗？**
A: 收纳的内容（已完成项）会通过 `sessionStorage` 保存，但展开/收起状态不会持久化。每次刷新页面后，收纳区默认收起，需用户手动点击展开。
