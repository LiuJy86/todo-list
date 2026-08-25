; ============================================
; 自定义 NSIS 安装脚本
; 功能：覆盖默认的"应用正在运行"提示，自动关闭旧实例后直接覆盖安装
; ============================================

!macro customInstall
  ; 查找正在运行的应用窗口（APPNAME 由 electron-builder 自动注入）
  FindWindow $0 "${APPNAME}" ""
  StrCmp $0 0 install_done
    ; 先尝试优雅关闭：发送 WM_CLOSE (0x0010)
    ; 注意：如果应用拦截了 close 事件（如最小化到托盘），此消息可能无法真正退出进程
    System::Call "user32::PostMessage(i 0x$0, i 0x0010, i 0, i 0)"
    Sleep 1500
    ; 检查进程是否已退出
    FindWindow $0 "${APPNAME}" ""
    StrCmp $0 0 install_done
      ; 仍未退出，强制终止（/F 强制 /T 终止子树）
      ExecWait '"taskkill" /F /IM "${APP_EXECUTABLE_FILENAME}" /T'
      Sleep 500
  install_done:
!macroend
