@echo off
rem Friend's entry point: installs the pinned Modlock once, then joins the session.
cd /d "%~dp0"
title Teste de sessao - entrar

if not exist "tools\modlock-v0.1.68\modlock.exe" (
  echo Instalando o Modlock v0.1.68 ^(confere o hash oficial^)...
  powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\install-modlock.ps1" || goto :erro
)

echo.
set /p ORIGEM=Cole o ENDERECO que te mandaram (https://....trycloudflare.com):
set /p CODIGO=Cole o CODIGO de entrada:
echo.
echo Entrando... o Deadlock vai abrir sozinho. Deixe esta janela aberta durante o teste.
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\spike\entrar.ps1" -Origin "%ORIGEM%" -Codigo "%CODIGO%" || goto :erro
goto :fim

:erro
echo.
echo Deu erro. Tire um print desta janela e mande para quem te passou o teste.

:fim
echo.
pause
