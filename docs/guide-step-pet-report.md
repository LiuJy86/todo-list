# 引导步骤新增：双击史迪奇查看日报

> 设计文档 — 待审核后实施

## 1. 需求概述

在快捷键步骤之后、「全部搞定」之前，新增一个步骤引导用户了解史迪奇桌宠的日报功能：

| 快捷键 | 功能 |
|--------|------|
| 双击史迪奇 | 查看每日完成报告 |

## 2. 交互流程

```
用户双击史迪奇 → 日报弹窗自动打开 → 用户关闭弹窗 → 进入下一步
```

这是一个**组合交互**步骤，包含两个阶段：
1. 等待用户双击史迪奇（`dblclick`）
2. 等待用户关闭日报弹窗（`modal-close`）

## 3. 修改文件

| 文件 | 修改内容 |
|------|----------|
| `src/js/09-guide.js` | 1. 恢复 `dblclick` 和 `modal-close` 等待处理器<br>2. 新增步骤配置 |
| `tests/guide.spec.js` | 新增测试用例 |

## 4. 步骤配置

```javascript
{
  title: '史迪奇日报 📊',
  desc: '双击史迪奇，可以查看你的每日完成报告！\n\n📈 完成率 — 今日完成进度\n✅ 已完成 — 事项统计\n\n试试看，双击它吧！',
  spotlight: '#stitchPet',
  position: 'top',
  wait: { type: 'dblclick-then-modal-close', target: '#stitchPet', modalTarget: '#dailyReportModal' }
}
```

### 字段说明

| 字段 | 值 | 理由 |
|------|-----|------|
| `title` | `'史迪奇日报 📊'` | 点明功能 |
| `desc` | 引导文案 | 说明功能 + 引导操作 |
| `spotlight` | `'#stitchPet'` | 高亮史迪奇 |
| `position` | `'top'` | 史迪奇通常在屏幕下方，卡片放上方 |
| `wait.type` | `'dblclick-then-modal-close'` | 组合交互类型 |

## 5. 引导流程变更

### 变更前（6 步）

```
步骤1 欢迎 → 步骤2 添加待办 → 步骤3 事项操作 → 步骤4 设置提醒 → 步骤5 快捷键 → 步骤6 全部搞定
```

### 变更后（7 步）

```
步骤1 欢迎 → 步骤2 添加待办 → 步骤3 事项操作 → 步骤4 设置提醒 → 步骤5 快捷键 → 步骤6 史迪奇日报 → 步骤7 全部搞定
```

## 6. 技术实现

### 6.1 新增等待类型 `dblclick-then-modal-close`

在 `bindStepWait` 的 switch 中新增一个 case：

```javascript
case 'dblclick-then-modal-close':
  // 阶段1：等待双击目标元素
  var onDblClick = function () {
    target.removeEventListener('dblclick', onDblClick);
    // 隐藏引导层，让用户可以看到弹窗内容
    if (overlayEl) overlayEl.style.display = 'none';
    // 阶段2：等待弹窗关闭
    waitForModalClose(wait.modalTarget);
  };
  target.addEventListener('dblclick', onDblClick);
  // 隐藏引导层让用户可以双击桌宠
  if (overlayEl) overlayEl.style.display = 'none';
  phaseCleanup = function () {
    target.removeEventListener('dblclick', onDblClick);
    if (overlayEl) overlayEl.style.display = '';
  };
  break;

function waitForModalClose(modalTarget) {
  var modalEl = document.querySelector(modalTarget);
  if (modalEl) {
    // 弹窗已存在，监听关闭
    var modalParent = modalEl.parentNode;
    var obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var removed = muts[i].removedNodes;
        for (var j = 0; j < removed.length; j++) {
          if (removed[j] === modalEl || (removed[j] && removed[j].contains && removed[j].contains(modalEl))) {
            obs.disconnect();
            if (overlayEl) overlayEl.style.display = '';
            onStepActionComplete(step);
            return;
          }
        }
      }
    });
    obs.observe(modalParent, { childList: true, subtree: true });
    phaseCleanup = function () { obs.disconnect(); if (overlayEl) overlayEl.style.display = ''; };
  } else {
    // 弹窗不存在，等待出现后再监听关闭
    var appearObs = new MutationObserver(function () {
      var m = document.querySelector(modalTarget);
      if (m) {
        appearObs.disconnect();
        var mp = m.parentNode;
        var closeObs = new MutationObserver(function (muts) {
          for (var i = 0; i < muts.length; i++) {
            var removed = muts[i].removedNodes;
            for (var j = 0; j < removed.length; j++) {
              if (removed[j] === m || (removed[j] && removed[j].contains && removed[j].contains(m))) {
                closeObs.disconnect();
                if (overlayEl) overlayEl.style.display = '';
                onStepActionComplete(step);
                return;
              }
            }
          }
        });
        closeObs.observe(mp, { childList: true, subtree: true });
        phaseCleanup = function () { closeObs.disconnect(); if (overlayEl) overlayEl.style.display = ''; };
      }
    });
    appearObs.observe(document.body, { childList: true, subtree: true });
    phaseCleanup = function () { appearObs.disconnect(); if (overlayEl) overlayEl.style.display = ''; };
  }
}
```

### 6.2 为什么不用两个独立步骤？

| 方案 | 优点 | 缺点 |
|------|------|------|
| **组合步骤**（推荐） | 逻辑内聚，用户流畅体验 | 代码稍复杂 |
| 两个独立步骤 | 代码复用现有 handler | 中间需要"弹窗已打开"的过渡卡片，打断流畅性 |

## 7. 影响范围

| 影响项 | 说明 |
|--------|------|
| 引导步骤数 | 6 → 7 |
| 徽章显示 | 最大 `步骤 7/7` |
| 死代码恢复 | `modal-close` 相关逻辑恢复（仅复用部分） |
| 测试 | 新增 1-2 个测试用例 |

## 8. 测试计划

| 测试用例 | 验证点 |
|----------|--------|
| 步骤6显示正确 | 标题「史迪奇日报 📊」，徽章 `6/7` |
| 双击史迪奇后弹窗打开 | 日报弹窗可见 |
| 关闭弹窗后进入步骤7 | 标题「全部搞定」，徽章 `7/7` |

## 9. 待确认事项

- [ ] 文案是否需要调整？
- [ ] 是否需要 spotlight 高亮史迪奇？
- [ ] 弹窗打开后是否需要在引导层显示提示？
- [ ] 是否同意组合步骤方案？
