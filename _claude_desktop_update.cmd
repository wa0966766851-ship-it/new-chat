@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo START %DATE% %TIME% > .desktop-releases\claude-update-20261101.log
call npm run desktop:update >> .desktop-releases\claude-update-20261101.log 2>&1
echo EXIT %ERRORLEVEL% >> .desktop-releases\claude-update-20261101.log
