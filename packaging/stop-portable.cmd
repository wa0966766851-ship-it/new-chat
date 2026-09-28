@echo off
setlocal
title Stop Seer Portable Server
echo Stopping Seer portable server processes (node.exe running server.single.cjs) ...
set "FOUND="
for /f "tokens=2 delims=," %%a in ('tasklist /v /fo csv ^| findstr /i "server.single.cjs"') do (
  set "FOUND=1"
)
REM Fallback: kill node.exe started from this folder by window title SeerServer-*
for /f "tokens=2" %%p in ('tasklist /v /fo list ^| findstr /i "SeerServer-"') do (
  set "FOUND=1"
)
taskkill /FI "WINDOWTITLE eq SeerServer-*" /T /F >nul 2>nul
if errorlevel 1 (
  echo No SeerServer window found. Trying port-based cleanup on 3000-3100 ...
  for /L %%P in (3000,1,3100) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":%%P .*LISTENING"') do (
      echo Found listener on %%P pid %%a, killing ...
      taskkill /PID %%a /T /F >nul 2>nul
      set "FOUND=1"
    )
  )
) else (
  set "FOUND=1"
)
if defined FOUND (echo Done.) else (echo No running server found.)
timeout /t 2 >nul
