@echo off
setlocal
rem Run from the folder containing this launcher, even when double-clicked.
cd /d "%~dp0"

set "SIM_NODE_EXECUTABLE=node"
where node >nul 2>nul
if not errorlevel 1 goto run

rem Optional fallback for computers that already have a Codex runtime installed.
set "SIM_NODE_EXECUTABLE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if not exist "%SIM_NODE_EXECUTABLE%" (
  echo Node.js was not found.
  echo Install Node.js 20 or newer, then run this file again.
  pause
  exit /b 1
)

:run
if not exist "node_modules\ws\package.json" goto packages
if not exist "node_modules\@msgpack\msgpack\package.json" goto packages
echo Starting SystemCore Sim...
echo Keep this window open, then browse to http://localhost:4173
"%SIM_NODE_EXECUTABLE%" server.mjs
pause
exit /b

:packages
echo Install the project packages first: open PowerShell in this folder and run npm.cmd ci.
pause
exit /b 1
