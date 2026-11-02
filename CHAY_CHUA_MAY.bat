@echo off
chcp 65001 >nul
title Chua May Online - server
cd /d "%~dp0"
where node >nul 2>nul || (echo [!] Chua co Node.js. Tai tai https://nodejs.org roi chay lai file nay. & start https://nodejs.org & pause & exit /b)
if not exist node_modules\ws (echo Dang cai thu vien ws... & call npm install --no-audit --no-fund || (pause & exit /b))
echo.
echo === Chua May dang chay ===
echo  May nay:        http://localhost:3000
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do echo  Cung Wi-Fi:    http:%%a:3000 | findstr /v "169.254"
echo.
start "Chua May - server" cmd /k node server.js
timeout /t 2 >nul
start "" http://localhost:3000
where cloudflared >nul 2>nul && goto tunnel
if exist "%ProgramFiles(x86)%\cloudflared\cloudflared.exe" set "PATH=%PATH%;%ProgramFiles(x86)%\cloudflared" & goto tunnel
echo De ban be o xa vao bang link, can cai cloudflared (mien phi, cua Cloudflare).
set /p ok=Cai cloudflared bang winget ngay bay gio? (y/n): 
if /i not "%ok%"=="y" (echo Bo qua. Chi choi duoc trong cung Wi-Fi. & pause & exit /b)
winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
set "PATH=%PATH%;%ProgramFiles(x86)%\cloudflared;%ProgramFiles%\cloudflared"
:tunnel
echo.
echo Dang tao link cong khai... Tim dong co "https://....trycloudflare.com" ben duoi va gui cho ban be.
echo (Dong cua so nay thi link tat. Server van chay o cua so kia.)
cloudflared tunnel --url http://localhost:3000
pause
