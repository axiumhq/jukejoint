@echo off
rem Friend's exit: stops the Modlock daemon the safe way.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\spike\parar.ps1"
echo.
echo Pronto. Pode fechar.
pause
