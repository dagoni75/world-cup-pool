@echo off
cd /d "%~dp0"
echo Starting Kickoff Pool...
echo.
call "C:\Program Files\nodejs\npm.cmd" run dev
echo.
echo The application has stopped.
pause
