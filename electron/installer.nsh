; ============================================
; 自定义 NSIS 安装脚本
; 功能：覆盖默认的应用运行检查，强制关闭旧实例
; ============================================

; 覆盖默认的 CHECK_APP_RUNNING 宏
; 原因：默认宏在无法关闭应用时会弹出"无法关闭"对话框，需要用户手动操作
!macro customCheckAppRunning
  ; 强制终止正在运行的应用进程（/F 强制 /T 终止子树）
  nsExec::Exec `%SYSTEMROOT%\System32\cmd.exe /c taskkill /F /IM "${APP_EXECUTABLE_FILENAME}" /T /FI "USERNAME eq %USERNAME%"`
  ; 等待进程完全退出
  Sleep 2000
!macroend
