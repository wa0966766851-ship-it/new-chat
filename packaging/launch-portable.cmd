@echo off
setlocal EnableDelayedExpansion
set "APP_DIR=%~dp0"
set "NODE_ENV=production"

echo ===============================================
echo  Seer Battle Simulator - Portable Launcher
echo ===============================================
echo.

REM --- 0. Self check: required files must sit next to this cmd
if not exist "%APP_DIR%node.exe" (
  echo [ERROR] node.exe not found next to launch-portable.cmd.
  echo Please unzip the WHOLE zip, not just this file.
  pause
  exit /b 1
)
if not exist "%APP_DIR%server.single.cjs" (
  echo [ERROR] server.single.cjs not found next to launch-portable.cmd.
  echo Please unzip the WHOLE zip, not just this file.
  pause
  exit /b 1
)
if not exist "%APP_DIR%dist\index.html" (
  echo [ERROR] dist\index.html not found. Incomplete unzip.
  echo Please unzip the WHOLE zip, not just this file.
  pause
  exit /b 1
)

REM --- 1. Pick a free port: prefer PORT env, else 3000, then scan up
set "WANT_PORT=%PORT%"
if "%WANT_PORT%"=="" set "WANT_PORT=3000"
set "FREE_PORT="
for /L %%P in (%WANT_PORT%,1,3100) do (
  if not defined FREE_PORT (
    netstat -ano | findstr /R /C:":%%P .*LISTENING" >nul 2>nul
    if errorlevel 1 set "FREE_PORT=%%P"
  )
)
if "%FREE_PORT%"=="" (
  echo [ERROR] No free port between %WANT_PORT% and 3100.
  echo Close some programs and try again.
  pause
  exit /b 1
)
if not "%FREE_PORT%"=="%WANT_PORT%" (
  echo [INFO] Port %WANT_PORT% busy, using %FREE_PORT% instead.
) else (
  echo [INFO] Using port %FREE_PORT%.
)
set "PORT=%FREE_PORT%"

REM --- 2. Start server in background, log to server.log
set "LOG=%APP_DIR%server.log"
echo Starting server on http://127.0.0.1:%FREE_PORT% ...
echo Log: %LOG%
start "SeerServer-%FREE_PORT%" /min cmd /c ""%APP_DIR%node.exe" "%APP_DIR%server.single.cjs" >> "%LOG%" 2>&1"

REM --- 3. Wait until server answers (max ~20s), then open browser
set "READY="
for /L %%I in (1,1,40) do (
  if not defined READY (
    powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:%FREE_PORT%/api/ai-status' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
    if not errorlevel 1 set "READY=1"
    if not defined READY timeout /t 1 /nobreak >nul
  )
)
if not defined READY (
  echo [ERROR] Server did not start in 20s. Last log lines:
  powershell -NoProfile -Command "Get-Content '%LOG%' -Tail 20"
  echo.
  echo Common causes:
  echo  - Antivirus quarantined node.exe (restore and allow it)
  echo  - Incomplete unzip (need node.exe + server.single.cjs + dist in same folder)
  pause
  exit /b 1
)

echo [OK] Server is up. Opening browser ...
start "" "http://127.0.0.1:%FREE_PORT%"
echo.
echo Game URL: http://127.0.0.1:%FREE_PORT%
echo Close this window to stop showing this message. The server keeps running.
echo To stop the server, run: stop-portable.cmd
pause
