@echo off
chcp 65001 >nul
cd /d "%~dp0"
"C:\Users\Yang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\launch-lan.mjs
pause
