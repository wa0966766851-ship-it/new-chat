@echo off
chcp 65001 >nul
title 停止賽爾對戰模擬器
set "FOUND="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /r /c:":3000 .*LISTENING"') do (
  set "FOUND=1"
  taskkill /PID %%a /T /F >nul 2>nul
)
if defined FOUND (echo 已停止對戰模擬器伺服器。) else (echo 伺服器目前沒有在執行。)
timeout /t 2 >nul
