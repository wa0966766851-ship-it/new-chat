@echo off
setlocal
title Rebuild Portable EXE
cd /d "%~dp0"

echo ===============================================
echo  Rebuild Portable EXE + ZIP
echo ===============================================
echo  Current dir: %CD%
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] node not found. Run setup-env.bat first.
  pause
  exit /b 1
)

echo [1/2] npm run package:portable ...
echo This runs: vite build + esbuild + copy files + zip + iexpress exe.
echo It takes several minutes on first run. Please wait.
call npm run package:portable
if errorlevel 1 (
  echo.
  echo [FAIL] package:portable failed. Copy the red text above to developer.
  pause
  exit /b 1
)

echo.
echo ===============================================
echo  [OK] Done. Outputs in release folder:
echo    seer-battle-simulator-portable.zip
echo    seer-battle-simulator.exe
echo  Upload the exe (or zip) to Drive and share it.
echo ===============================================
pause
