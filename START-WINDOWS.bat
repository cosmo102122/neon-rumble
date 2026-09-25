@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 or newer, then open this file again.
  echo https://nodejs.org/
  pause
  exit /b 1
)
if not exist node_modules\ws (
  call npm ci
  if errorlevel 1 (
    echo Package installation failed. Check your internet connection.
    pause
    exit /b 1
  )
)
echo Open http://localhost:3000 in your browser.
echo Keep this window open while playing. Press Ctrl+C to stop the server.
call npm start
pause
