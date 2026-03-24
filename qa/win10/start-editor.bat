@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo Starting local server on http://127.0.0.1:4173
echo Close this window to stop the server.
echo.

powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local-server.ps1" -Port 4173
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Server exited with code %EXIT_CODE%.
  echo If this keeps happening, please send this terminal output to developer.
  pause
)

endlocal
