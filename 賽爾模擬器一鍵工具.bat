@echo off
chcp 65001 >nul
title 賽爾對戰模擬器 一鍵工具
cd /d "%~dp0"

:MENU
cls
echo ===============================================
echo  賽爾對戰模擬器 一鍵工具
echo ===============================================
echo  目前目錄：%CD%
echo.
echo  [1] 下載或更新專案（自動判斷：有 .git 就 pull，沒有就 clone）
echo  [2] 我要更新（pull + install + build）
echo  [3] 我要測試（lint + test）
echo  [4] 啟動遊戲（start + 開瀏覽器）
echo  [5] 打包發佈（package:zip）
echo  [0] 離開
echo.
set /p CHOICE=請輸入選項 [0-5]：
if "%CHOICE%"=="1" goto UPDATE_OR_CLONE
if "%CHOICE%"=="2" goto UPDATE_ONLY
if "%CHOICE%"=="3" goto TEST_ONLY
if "%CHOICE%"=="4" goto START_GAME
if "%CHOICE%"=="5" goto PACKAGE_ZIP
if "%CHOICE%"=="0" exit /b 0
echo 輸入錯誤，請重新選擇。
pause
goto MENU

:CHECK_BASIC
where git >nul 2>nul
if errorlevel 1 (
  echo [錯誤] 找不到 git，請先安裝 Git for Windows。
  echo 下載：https://git-scm.com/download/win
  pause
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo [錯誤] 找不到 Node.js，請先安裝 Node.js 20 以上 LTS。
  echo 下載：https://nodejs.org/
  pause
  exit /b 1
)
exit /b 0

:UPDATE_OR_CLONE
call :CHECK_BASIC
if errorlevel 1 goto MENU
if exist ".git" (
  echo [1/3] 偵測到已是專案目錄，執行 git pull ...
  git pull origin main
  if errorlevel 1 (
    echo [失敗] git pull 失敗。若倉庫是 Private，請先看本工具附的使用說明做登入。
    pause
    goto MENU
  )
  goto INSTALL_BUILD
) else (
  echo 目前目錄不是專案（沒有 .git），準備全新下載。
  echo 預設會下載到 .\new-chat
  set /p REPO_URL=請貼上倉庫網址（直接 Enter 用預設 https://github.com/wa0966766851-ship-it/new-chat.git）：
  if "%REPO_URL%"=="" set "REPO_URL=https://github.com/wa0966766851-ship-it/new-chat.git"
  git clone "%REPO_URL%"
  if errorlevel 1 (
    echo [失敗] clone 失敗。若是 Private 倉庫，請先登入（看說明）。
    pause
    goto MENU
  )
  echo 下載完成，請進入 new-chat 再跑一次本工具選 [2] 更新。
  pause
  goto MENU
)

:UPDATE_ONLY
call :CHECK_BASIC
if errorlevel 1 goto MENU
if not exist ".git" (
  echo [錯誤] 目前目錄沒有 .git，請用選項 [1] 先下載。
  pause
  goto MENU
)
echo [1/3] git pull origin main ...
git pull origin main
if errorlevel 1 (
  echo [失敗] pull 失敗，請檢查網路或 Private 權限。
  pause
  goto MENU
)
goto INSTALL_BUILD

:INSTALL_BUILD
echo [2/3] npm install ...
call npm install
if errorlevel 1 (
  echo [失敗] npm install 失敗，請檢查網路。
  pause
  goto MENU
)
echo [3/3] npm run build ...
call npm run build
if errorlevel 1 (
  echo [失敗] build 失敗，請把錯誤訊息貼給開發者。
  pause
  goto MENU
)
echo.
echo [完成] 更新＋安裝＋建置都好了。可以選 [4] 啟動遊戲。
pause
goto MENU

:TEST_ONLY
call :CHECK_BASIC
if errorlevel 1 goto MENU
echo [1/2] npm run lint ...
call npm run lint
if errorlevel 1 (
  echo [失敗] lint 沒過，請先修型別錯誤。
  pause
  goto MENU
)
echo [2/2] npm test ...
call npm test
if errorlevel 1 (
  echo [注意] 測試沒全過，請把上面的紅字貼給開發者。
  pause
  goto MENU
)
echo.
echo [完成] lint + test 全綠。
pause
goto MENU

:START_GAME
call :CHECK_BASIC
if errorlevel 1 goto MENU
if not exist "dist\index.html" (
  echo 還沒建置過，先幫你跑一次 build ...
  call npm run build
)
echo 啟動伺服器 ...
start "" cmd /c "npm run start"
timeout /t 3 >nul
start "" "http://localhost:3000"
echo 已開啟瀏覽器 http://localhost:3000 ，關掉伺服器視窗即停止。
pause
goto MENU

:PACKAGE_ZIP
call :CHECK_BASIC
if errorlevel 1 goto MENU
echo 正在打包 release/seer-battle-simulator-portable.zip ...
call npm run package:zip
if errorlevel 1 (
  echo [失敗] 打包失敗。
  pause
  goto MENU
)
echo.
echo [完成] 產物在 release\seer-battle-simulator-portable.zip
echo 解開後跑 launch-portable.cmd 就能玩。
pause
goto MENU
