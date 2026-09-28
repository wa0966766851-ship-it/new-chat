@echo off
chcp 65001 >nul
cd /d "%~dp0"

rem === Build EXE reference bat (mirrors SeerBot 打包exe.bat) ===
rem Usage:
rem   Build_EXE.bat                  bump patch version then build (1.0.0 -> 1.0.1)
rem   Build_EXE.bat --keep-version   rebuild same version
rem   Build_EXE.bat --version 1.1.0  set version then build
rem
rem Steps (in tools/build_exe.ts):
rem   1. prepare_share --force (clean copy, drop .env/cache/logs/backups)
rem   2. npm install + lint + test + build:electron on the clean copy
rem   3. electron-builder nsis + portable
rem   4. collect to dist_release/<app><version>/ + verify
rem
rem Preflight: run from project root, not from share copy.

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Need Node 20+.
    pause
    exit /b 1
)
if not exist "electron\main.cjs" (
    echo [ERROR] electron\main.cjs not found. Run this bat from project root.
    pause
    exit /b 1
)
if exist ".share_copy" (
    echo [ERROR] This looks like a share copy. Run from the real project root.
    pause
    exit /b 1
)

npx tsx tools\build_exe.ts %*

if errorlevel 1 (
    echo.
    echo [FAILED] See messages above.
    pause
) else (
    echo.
    echo [OK] Check dist_release\ for the output folder.
)
