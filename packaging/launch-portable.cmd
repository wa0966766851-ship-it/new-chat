@echo off
setlocal
set "APP_DIR=%~dp0"
set "NODE_ENV=production"
start "" "http://127.0.0.1:3000"
"%APP_DIR%node.exe" "%APP_DIR%server.single.cjs"
