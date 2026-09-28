@echo off
setlocal
title Setup Env - Git and Node
cd /d "%~dp0"

echo ===============================================
echo  Setup Environment - Git + Node.js
echo ===============================================
echo.

where winget >nul 2>nul
if errorlevel 1 (
  echo [INFO] winget not found. Please install manually:
  echo   Git: https://git-scm.com/download/win
  echo   Node.js LTS: https://nodejs.org/
  pause
  exit /b 1
)

echo [1/2] Installing Git ...
winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  echo [WARN] Git install may have failed. Try manual link above.
) else (
  echo [OK] Git done.
)
echo.

echo [2/2] Installing Node.js LTS ...
winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  echo [WARN] Node install may have failed. Try manual link above.
) else (
  echo [OK] Node done.
)
echo.

echo ===============================================
echo  Done. Close this window and re-open the tool.
echo  Then run option [1] again.
echo ===============================================
pause
