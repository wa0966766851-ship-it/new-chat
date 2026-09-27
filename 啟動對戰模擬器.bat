@echo off
rem Seer battle simulator launcher (opens a standalone window; closing it stops the server)
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0launcher\launcher.ps1"
