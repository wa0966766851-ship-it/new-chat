@echo off
setlocal EnableExtensions
title Build EXE - Seer Simulator
cd /d "%~dp0"

rem Build EXE reference bat (mirrors SeerBot build flow)
rem Usage:
rem   Build_EXE.bat                  bump patch version then build
rem   Build_EXE.bat --keep-version   rebuild same version
rem   Build_EXE.bat --version 1.1.0  set version then build
rem
rem Steps (in tools/build_exe.ts):
rem   1. prepare_share --force (clean copy, drop env/cache/logs/backups)
rem   2. npm install + lint + test + build:electron on the clean copy
rem   3. electron-builder nsis + portable
rem   4. collect to dist_release folder + verify
rem
rem Run from project root, not from share copy.

echo Current dir: %CD%

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Need Node 20+.
    pause
    exit /b 1
)
if not exist "electron\main.cjs" (
    echo [ERROR] electron\main.cjs not found. Run this bat from project root.
    echo Current dir is: %CD%
    pause
    exit /b 1
)
if exist ".share_copy" (
    echo [ERROR] This looks like a share copy. Run from the real project root.
    pause
    exit /b 1
)

call npx tsx tools\build_exe.ts %*

if errorlevel 1 (
    echo.
    echo [FAILED] See messages above.
    pause
) else (
    echo.
    echo [OK] Check dist_release\ for the output folder.
    pause
)
