@echo off
setlocal
pushd "%~dp0"
title Vokabelarena - Schul-WLAN
where node.exe >nul 2>&1
if errorlevel 1 (
  echo Node.js fehlt. Installiere Node.js und starte diese Datei erneut.
  pause
  popd
  exit /b 1
)
if not exist "fleet-server.cjs" (
  echo Bitte das gesamte Spielpaket entpacken und diese Datei darin starten.
  pause
  popd
  exit /b 1
)
node fleet-server.cjs --open
pause
popd
