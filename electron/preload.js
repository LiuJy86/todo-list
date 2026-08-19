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
  }
});
