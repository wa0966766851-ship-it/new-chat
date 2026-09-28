@echo off
setlocal
title Seer Simulator Tool
cd /d "%~dp0"

:MENU
cls
echo ===============================================
echo  Seer Simulator One-Click Tool
echo ===============================================
echo  Current dir: %CD%
echo.
echo  [1] Download or update project
echo  [2] Update only (pull + install + build)
echo  [3] Test only (lint + test)
echo  [4] Start game
echo  [5] Package release zip
echo  [0] Exit
echo.
set /p CHOICE=Enter option [0-5]:
if "%CHOICE%"=="1" goto UPDATE_OR_CLONE
if "%CHOICE%"=="2" goto UPDATE_ONLY
if "%CHOICE%"=="3" goto TEST_ONLY
if "%CHOICE%"=="4" goto START_GAME
if "%CHOICE%"=="5" goto PACKAGE_ZIP
if "%CHOICE%"=="0" exit /b 0
echo Bad option, try again.
pause
goto MENU

:CHECK_BASIC
where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] git not found. Install Git for Windows first.
  echo https://git-scm.com/download/win
  pause
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] node not found. Install Node.js 20 LTS first.
  echo https://nodejs.org/
  pause
  exit /b 1
)
exit /b 0

:UPDATE_OR_CLONE
call :CHECK_BASIC
if errorlevel 1 goto MENU
if exist ".git" (
  echo [1/3] Found project, running git pull ...
  git pull origin main
  if errorlevel 1 (
    echo [FAIL] git pull failed. Private repo needs login first.
    pause
    goto MENU
  )
  goto INSTALL_BUILD
)
echo Current folder is not a project. Will clone fresh copy.
set REPO_URL=https://github.com/wa0966766851-ship-it/new-chat.git
set /p REPO_URL_IN=Repo URL [Enter for default]:
if not "%REPO_URL_IN%"=="" set REPO_URL=%REPO_URL_IN%
git clone "%REPO_URL%"
if errorlevel 1 (
  echo [FAIL] git clone failed. Private repo needs login first.
  pause
  goto MENU
)
echo Done. Enter new-chat folder and run this tool option [2].
pause
goto MENU

:UPDATE_ONLY
call :CHECK_BASIC
if errorlevel 1 goto MENU
if not exist ".git" (
  echo [ERROR] No .git here. Use option [1] first.
  pause
  goto MENU
)
echo [1/3] git pull origin main ...
git pull origin main
if errorlevel 1 (
  echo [FAIL] pull failed. Check network or Private permission.
  pause
  goto MENU
)
goto INSTALL_BUILD

:INSTALL_BUILD
echo [2/3] npm install ...
call npm install
if errorlevel 1 (
  echo [FAIL] npm install failed. Check network.
  pause
  goto MENU
)
echo [3/3] npm run build ...
call npm run build
if errorlevel 1 (
  echo [FAIL] build failed. Copy the error to developer.
  pause
  goto MENU
)
echo.
echo [OK] Update install build all done. Use [4] to start.
pause
goto MENU

:TEST_ONLY
call :CHECK_BASIC
if errorlevel 1 goto MENU
echo [1/2] npm run lint ...
call npm run lint
if errorlevel 1 (
  echo [FAIL] lint failed. Fix type errors first.
  pause
  goto MENU
)
echo [2/2] npm test ...
call npm test
if errorlevel 1 (
  echo [NOTE] test failed. Copy the red text to developer.
  pause
  goto MENU
)
echo.
echo [OK] lint + test all green.
pause
goto MENU

:START_GAME
call :CHECK_BASIC
if errorlevel 1 goto MENU
if not exist "dist\index.html" (
  echo No build yet, building first ...
  call npm run build
)
echo Starting server ...
start "" cmd /c "npm run start"
timeout /t 3 >nul
start "" "http://localhost:3000"
echo Browser opened at http://localhost:3000
pause
goto MENU

:PACKAGE_ZIP
call :CHECK_BASIC
if errorlevel 1 goto MENU
echo Packing release zip ...
call npm run package:zip
if errorlevel 1 (
  echo [FAIL] package failed.
  pause
  goto MENU
)
echo.
echo [OK] Output: release\seer-battle-simulator-portable.zip
echo Unzip and run launch-portable.cmd to play.
pause
goto MENU
