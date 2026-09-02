@echo off
setlocal
cd /d "%~dp0"

set "SIM_NODE=node"
where node >nul 2>nul
if not errorlevel 1 goto run

set "SIM_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if not exist "%SIM_NODE%" (
  echo Node.js was not found.
  echo Install Node.js 20 or newer, then run this file again.
  pause
  exit /b 1
)

:run
echo Starting SystemCore Sim...
echo Keep this window open, then browse to http://localhost:4173
"%SIM_NODE%" server.mjs
pause
