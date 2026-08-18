# 待办事项清单（Stitch 桌宠版）

一个用 **HTML / CSS / JavaScript** 从零实现的待办事项应用，附带一只会说话的史迪奇桌宠。
面向零开发经验的读者，代码尽量简单，每段关键逻辑都附有中文注释。

## 功能

- ✅ 添加待办事项
- ✅ 标记完成 / 取消完成
- ✅ 删除单条事项
- ✅ 一键清除已完成事项
- ✅ 剩余事项计数
- ✅ 按 添加时间 / 内容 排序
- ✅ 本地存储（刷新页面不丢数据）
- 🧸 左侧史迪奇桌宠：点击图片切换表情、气泡说人话、粒子环绕特效、可拖动 / 隐藏

## 项目结构

```
todo-list/
├── index.html          # 页面结构
├── script.js           # 交互逻辑
├── style.css           # 样式
├── img/                # 史迪奇桌宠 GIF 动图
│   └── _original/      # 原始动图备份
├── screenshots/        # 功能演示截图
├── Task.md             # 任务说明
├── CHANGELOG.md        # 更新日志
├── deployment_guide.md # 部署指南
└── verify_*.py         # 自动化校验脚本
```

## 运行方式

无需安装、无需后端，直接用浏览器打开即可：

1. 双击 `index.html`，或
2. 在终端进入项目目录执行：

```bash
# 方式一：直接打开
start index.html          # Windows
open index.html           # macOS
xdg-open index.html       # Linux

# 方式二：起一个本地服务器（可选，避免某些浏览器限制）
python -m http.server 8000
# 然后访问 http://localhost:8000
```

## 技术栈

- 原生 HTML / CSS / JavaScript（无框架、无后端、无数据库）
- 数据保存在浏览器 `localStorage`，关闭再打开依然存在

## 开发环境

- 代码要求与说明见 [CLAUDE.md](.claude/CLAUDE.md)
- 项目配置见 [.claude/settings.json](.claude/settings.json)

## 更新日志

详见 [CHANGELOG.md](CHANGELOG.md)。