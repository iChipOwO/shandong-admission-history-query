@echo off
chcp 65001 >nul
echo 正在启动往届录取信息电脑离线版...
echo 如果浏览器没有自动打开，请访问 http://127.0.0.1:5177
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0local-server.ps1"
if errorlevel 1 (
  echo.
  echo 启动失败，请查看上方提示。
  pause
)
