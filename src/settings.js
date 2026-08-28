// ============================================
// 设置页面逻辑
// 负责：读取/保存设置、快捷键捕获、检查更新
// ============================================

// 默认设置
const DEFAULT_SETTINGS = {
  autoStart: false,           // 开机自启动
  startHidden: false,         // 启动时隐藏
  shortcuts: {
    'toggle-window': 'Alt+F',   // 显示/隐藏窗口
    'toggle-sticky': 'Alt+G'    // 切换便签模式
  },
  customSound: null,          // 自定义音效文件名 (v2.24.0)
  customImages: []            // 自定义图片文件名数组 (v2.24.0)
};

// 当前设置（从 localStorage 加载，没有则用默认值）
let settings = loadSettings();

// 正在编辑的快捷键动作
let editingAction = null;

// ============================================
// 初始化：页面加载完成后执行
// ============================================
document.addEventListener('DOMContentLoaded', function () {
  initToggles();
  initShortcutInputs();
  initUpdateSection();
  initAboutSection();
  initGuideControls();
  initCustomSoundControls();
  initCustomImageControls();
});

// ============================================
// 设置持久化
// ============================================

// 从 localStorage 加载设置，缺失的项用默认值补齐
function loadSettings() {
  const saved = localStorage.getItem('settings');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // 深度合并：确保新增的设置项有默认值
      return {
        autoStart: parsed.autoStart ?? DEFAULT_SETTINGS.autoStart,
        startHidden: parsed.startHidden ?? DEFAULT_SETTINGS.startHidden,
        shortcuts: {
          ...DEFAULT_SETTINGS.shortcuts,
          ...(parsed.shortcuts || {})
        },
        customSound: parsed.customSound ?? DEFAULT_SETTINGS.customSound,
        customImages: Array.isArray(parsed.customImages) ? parsed.customImages : DEFAULT_SETTINGS.customImages
      };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  }
  return { ...DEFAULT_SETTINGS };
}

// 保存设置到 localStorage
function saveSettings() {
  localStorage.setItem('settings', JSON.stringify(settings));
}

// ============================================
// 开关设置（开机自启动、启动时隐藏）
// ============================================
function initToggles() {
  const autoStartEl = document.getElementById('autoStart');
  const startHiddenEl = document.getElementById('startHidden');

  // 初始化开关状态
  autoStartEl.checked = settings.autoStart;
  startHiddenEl.checked = settings.startHidden;

  // 开机自启动
  autoStartEl.addEventListener('change', function () {
    settings.autoStart = this.checked;
    saveSettings();
    // 通知主进程更新开机自启动设置
    if (window.electronAPI && window.electronAPI.setAutoStart) {
      window.electronAPI.setAutoStart(this.checked);
    }
  });

  // 启动时隐藏
  startHiddenEl.addEventListener('change', function () {
    settings.startHidden = this.checked;
    saveSettings();
    // 通知主进程同步设置（确保开机自启动时也能读取到）
    if (window.electronAPI && window.electronAPI.setStartHidden) {
      window.electronAPI.setStartHidden(this.checked);
    }
  });
}

// ============================================
// 快捷键设置
// ============================================
function initShortcutInputs() {
  const editBtns = document.querySelectorAll('.shortcut-edit-btn');

  editBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const action = this.dataset.action;
      startEditingShortcut(action);
    });
  });

  // 显示当前快捷键
  updateShortcutDisplay('toggle-window', 'shortcutToggleWindow');
  updateShortcutDisplay('toggle-sticky', 'shortcutToggleSticky');
}

// 更新快捷键显示
function updateShortcutDisplay(action, inputId) {
  const input = document.getElementById(inputId);
  if (input) {
    input.value = settings.shortcuts[action] || '';
  }
}

// 开始编辑快捷键：点击输入框后监听按键
function startEditingShortcut(action) {
  const inputId = action === 'toggle-window' ? 'shortcutToggleWindow' : 'shortcutToggleSticky';
  const input = document.getElementById(inputId);

  // 如果已经在编辑这个，就取消
  if (editingAction === action) {
    stopEditingShortcut(input);
    return;
  }

  // 先停止其他编辑
  stopAllEditing();

  editingAction = action;
  input.value = '请按下快捷键...';
  input.classList.add('listening');

  // 绑定一次性的按键监听
  input.onkeydown = function (e) {
    e.preventDefault();
    e.stopPropagation();

    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');

    // 主键：忽略纯修饰键
    const key = e.key;
    if (key !== 'Control' && key !== 'Alt' && key !== 'Shift') {
      parts.push(key.toUpperCase());
    }

    // 必须有主键才算有效快捷键
    if (parts.length === 0 || (parts.length === 1 && ['Control', 'Alt', 'Shift'].includes(parts[0]))) {
      return;
    }

    const shortcut = parts.join('+');

    // 保存新快捷键
    settings.shortcuts[action] = shortcut;
    saveSettings();

    // 通知主进程注册新快捷键
    if (window.electronAPI && window.electronAPI.registerShortcut) {
      window.electronAPI.registerShortcut(action, shortcut, function (result) {
        if (!result.success) {
          alert('快捷键 ' + shortcut + ' 已被占用，请选择其他组合');
          // 恢复原值
          settings.shortcuts[action] = result.previousShortcut;
          saveSettings();
          updateShortcutDisplay(action, inputId);
        }
      });
    }

    stopEditingShortcut(input);
  };
}

// 停止编辑某个快捷键输入框
function stopEditingShortcut(input) {
  input.classList.remove('listening');
  input.onkeydown = null;
  editingAction = null;
  // 恢复显示当前值
  const action = input.id === 'shortcutToggleWindow' ? 'toggle-window' : 'toggle-sticky';
  updateShortcutDisplay(action, input.id);
}

// 停止所有编辑状态
function stopAllEditing() {
  const inputs = document.querySelectorAll('.shortcut-input');
  inputs.forEach(function (input) {
    stopEditingShortcut(input);
  });
}

// 点击输入框外部时停止编辑
document.addEventListener('click', function (e) {
  if (editingAction && !e.target.closest('.shortcut-input-wrap')) {
    stopAllEditing();
  }
});

// ============================================
// 检查更新（v2.18.0）
// 方案：请求 GitHub API 获取最新版本，与当前版本比对
// ============================================
// 版本号从 package.json 动态读取（通过 Electron IPC），不再硬编码
let CURRENT_VERSION = '0.0.0';  // 占位，实际值在 initUpdateSection 中异步获取
const GITHUB_API_URL = 'https://api.github.com/repos/LiuJy86/todo-list/releases/latest';
const GITHUB_RELEASES_URL = 'https://github.com/LiuJy86/todo-list/releases/latest';

async function initUpdateSection() {
  const btn = document.getElementById('checkUpdateBtn');
  const status = document.getElementById('updateStatus');

  // 从主进程获取真实版本号（package.json 中的 version）
  if (window.electronAPI && window.electronAPI.getVersion) {
    try {
      CURRENT_VERSION = await window.electronAPI.getVersion();
    } catch (e) {
      console.error('获取版本号失败:', e);
    }
  }

  // 显示当前版本
  document.getElementById('versionInfo').textContent = 'v' + CURRENT_VERSION;

  btn.addEventListener('click', async function () {
    btn.disabled = true;
    btn.textContent = '检查中...';
    status.className = '';
    status.textContent = '正在连接 GitHub...';

    try {
      // 请求 GitHub API（带 10 秒超时）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(GITHUB_API_URL, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'ToDoList-App'  // GitHub API 要求必须带 User-Agent
        }
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('GitHub 返回错误: ' + response.status);
      }

      const data = await response.json();
      const latestVersion = data.tag_name || ''; // 如 "v2.18.0"

      // 版本号比对
      if (compareVersions(latestVersion, CURRENT_VERSION) > 0) {
        // 有新版本
        status.className = 'update-available';
        status.innerHTML = '🎉 发现新版本 <strong>' + latestVersion + '</strong>（当前 v' + CURRENT_VERSION + '）';
        btn.textContent = '前往下载';
        btn.onclick = function () {
          window.electronAPI.openExternal(GITHUB_RELEASES_URL);
        };
      } else {
        // 已是最新
        status.className = 'update-ready';
        status.textContent = '✅ 已是最新版本（v' + CURRENT_VERSION + '）';
        btn.textContent = '检查更新';
      }

    } catch (error) {
      // 网络异常处理
      status.className = 'update-error';
      if (error.name === 'AbortError') {
        status.textContent = '⏰ 请求超时，请检查网络后重试';
      } else {
        status.textContent = '❌ 检查失败: ' + error.message;
      }
      btn.textContent = '重试';
    }

    btn.disabled = false;
  });
}

// 版本号比对工具
// 返回: 1 =有新版本, 0 =相同, -1 =当前更新
function compareVersions(latest, current) {
  // 去掉前缀 "v"
  const l = latest.replace(/^v/, '');
  const c = current.replace(/^v/, '');

  const partsL = l.split('.').map(Number);
  const partsC = c.split('.').map(Number);

  for (let i = 0; i < Math.max(partsL.length, partsC.length); i++) {
    const a = partsL[i] || 0;
    const b = partsC[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

// ============================================
// 关于（GitHub 链接）
// ============================================
function initAboutSection() {
  const btn = document.getElementById('openGithubBtn');
  btn.addEventListener('click', function () {
    // 通过 Electron 打开外部链接
    if (window.electronAPI && window.electronAPI.openExternal) {
      window.electronAPI.openExternal('https://github.com/LiuJy86/todo-list');
    } else {
      window.open('https://github.com/LiuJy86/todo-list', '_blank');
    }
  });
}

// ============================================
// 【v2.25.0】用户引导 - 重置引导 / 重置提示
// ============================================
function initGuideControls() {
  const tourBtn = document.getElementById('guideResetTourBtn');

  if (tourBtn) {
    tourBtn.addEventListener('click', function () {
      // 重置引导状态（清除完成标记、进度、便签引导标记）
      localStorage.removeItem('guide_tour_done');
      localStorage.removeItem('guide_tour_progress');
      localStorage.removeItem('guide_sticky_tour_shown');

      // 如果在便签模式下，先退出便签模式
      if (window.electronAPI && window.electronAPI.exitStickyMode) {
        window.electronAPI.exitStickyMode();
      }

      // 回到主页面启动引导
      if (window.electronAPI && window.electronAPI.loadMainPage) {
        window.electronAPI.loadMainPage();
      } else {
        window.location.href = 'index.html';
      }
    });
  }
}

// ============================================
// 【v2.24.0】个性化 - 自定义提示音效
// ============================================
function initCustomSoundControls() {
  var descEl = document.getElementById('soundDesc');
  var previewBtn = document.getElementById('previewSoundBtn');
  var selectBtn = document.getElementById('selectSoundBtn');
  var clearBtn = document.getElementById('clearSoundBtn');

  if (!descEl || !selectBtn) return; // 元素不存在则跳过

  // 更新描述显示
  function updateDesc() {
    if (settings.customSound) {
      descEl.textContent = '自定义: ' + settings.customSound;
    } else {
      descEl.textContent = '默认音效';
    }
  }

  // 选择音效
  selectBtn.addEventListener('click', async function () {
    if (!window.electronAPI || !window.electronAPI.selectSoundFile) {
      alert('文件选择功能不可用');
      return;
    }
    try {
      var srcPath = await window.electronAPI.selectSoundFile();
      if (!srcPath) return; // 用户取消

      var result = await window.electronAPI.saveCustomSound(srcPath);
      if (result && result.success) {
        settings.customSound = result.filename;
        saveSettings();
        updateDesc();
      } else {
        alert('保存音效失败: ' + (result && result.error ? result.error : '未知错误'));
      }
    } catch (e) {
      alert('选择音效失败: ' + e.message);
    }
  });

  // 试听逻辑（播放/暂停/停止）
  var previewAudio = null;   // 当前 Audio 实例
  var previewState = 'stop'; // 'stop' | 'playing'

  // 设置按钮状态（图标由 CSS 绘制）
  function setPreviewState(state) {
    previewState = state;
    if (state === 'playing') {
      previewBtn.classList.add('playing');
    } else {
      previewBtn.classList.remove('playing');
    }
  }

  // 停止播放并重置
  function stopPreview() {
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
      previewAudio = null;
    }
    setPreviewState('stop');
  }

  // 试听按钮点击
  previewBtn.addEventListener('click', async function () {
    // 正在播放 → 停止
    if (previewState === 'playing') {
      stopPreview();
      return;
    }

    // 停止之前的播放
    stopPreview();

    // 获取音频源
    var src;
    if (settings.customSound && window.electronAPI && window.electronAPI.getUserDataPath) {
      try {
        var userData = await window.electronAPI.getUserDataPath();
        src = 'file:///' + userData.replace(/\\/g, '/') + '/custom-assets/' + settings.customSound;
      } catch (e) {
        src = '提示音效.mp3';
      }
    } else {
      src = '提示音效.mp3';
    }

    try {
      previewAudio = new Audio(src);
      previewAudio.volume = 0.6;

      // 播放结束 → 重置
      previewAudio.addEventListener('ended', function () {
        setPreviewState('stop');
      }, { once: true });

      // 播放出错 → 显示错误
      previewAudio.addEventListener('error', function () {
        console.warn('试听失败');
        previewAudio = null;
        setPreviewState('stop');
      }, { once: true });

      // 开始播放
      var playPromise = previewAudio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(function () {
          setPreviewState('playing');
        }).catch(function (e) {
          console.warn('试听失败:', e);
          setPreviewState('stop');
        });
      } else {
        setPreviewState('playing');
      }
    } catch (e) {
      console.warn('试听失败:', e);
      setPreviewState('stop');
    }
  });

  // 恢复默认
  clearBtn.addEventListener('click', async function () {
    if (!window.electronAPI || !window.electronAPI.clearCustomSound) {
      return;
    }
    try {
      await window.electronAPI.clearCustomSound();
      settings.customSound = null;
      saveSettings();
      updateDesc();
    } catch (e) {
      console.warn('清除音效失败:', e);
    }
  });

  updateDesc();
}

// ============================================
// 【v2.24.0】个性化 - 自定义桌宠动图
// ============================================
function initCustomImageControls() {
  var descEl = document.getElementById('imagesDesc');
  var gridEl = document.getElementById('imagePreviewGrid');
  var addBtn = document.getElementById('addImagesBtn');
  var clearBtn = document.getElementById('clearImagesBtn');

  if (!descEl || !addBtn) return; // 元素不存在则跳过

  // 渲染预览网格
  async function renderGrid() {
    var images = settings.customImages || [];
    gridEl.innerHTML = '';
    descEl.textContent = images.length > 0 ? '自定义 ' + images.length + ' 张' : '默认 6 张';

    if (images.length === 0 || !window.electronAPI || !window.electronAPI.getUserDataPath) {
      return;
    }

    try {
      var userData = await window.electronAPI.getUserDataPath();
      var basePath = 'file:///' + userData.replace(/\\/g, '/') + '/custom-assets/';
      images.forEach(function (filename) {
        var thumb = document.createElement('div');
        thumb.className = 'image-thumb';
        var img = document.createElement('img');
        img.src = basePath + filename;
        img.alt = filename;
        thumb.appendChild(img);
        gridEl.appendChild(thumb);
      });
    } catch (e) {
      console.warn('加载图片预览失败:', e);
    }
  }

  // 添加图片
  addBtn.addEventListener('click', async function () {
    if (!window.electronAPI || !window.electronAPI.selectImageFiles) {
      alert('文件选择功能不可用');
      return;
    }
    try {
      var paths = await window.electronAPI.selectImageFiles();
      if (!paths || paths.length === 0) return; // 用户取消

      var result = await window.electronAPI.saveCustomImages(paths);
      if (result && result.success) {
        settings.customImages = (settings.customImages || []).concat(result.filenames);
        saveSettings();
        renderGrid();
      } else {
        alert('保存图片失败');
      }
    } catch (e) {
      alert('选择图片失败: ' + e.message);
    }
  });

  // 清空
  clearBtn.addEventListener('click', async function () {
    if (!window.electronAPI || !window.electronAPI.clearCustomImages) {
      return;
    }
    try {
      await window.electronAPI.clearCustomImages();
      settings.customImages = [];
      saveSettings();
      renderGrid();
    } catch (e) {
      console.warn('清除图片失败:', e);
    }
  });

  renderGrid();
}
