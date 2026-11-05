@echo off
rem Runs the pinned Modlock CLI from tools\ without the update check.
set MODLOCK_NO_UPDATE_CHECK=1
if not exist "%~dp0..\tools\modlock-v0.1.73\modlock.exe" (
  echo modlock.exe nao encontrado. Rode scripts\install-modlock.ps1 1>&2
  exit /b 1
)
"%~dp0..\tools\modlock-v0.1.73\modlock.exe" %*
