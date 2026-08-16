; 覆盖安装时不要弹「请先关闭应用」：窗口关了，后台 Electron / Java 执行节点常还在。
; 静默杀掉后再继续装。

!macro KillStandaloneProcesses
  DetailPrint "Closing leftover ${PRODUCT_NAME} processes..."
  nsExec::ExecToLog 'taskkill /F /IM "${APP_EXECUTABLE_FILENAME}" /T'
  ; 安装目录里的 jar 被本机执行节点占用时，不杀 Java 就无法覆盖文件
  nsExec::ExecToLog 'cmd /c wmic process where "CommandLine like ''%mobile-standalone-backend%''" call terminate'
  Sleep 800
!macroend

!macro customCheckAppRunning
  !insertmacro KillStandaloneProcesses
!macroend

!macro customInit
  !insertmacro KillStandaloneProcesses
!macroend
