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
  }
});
