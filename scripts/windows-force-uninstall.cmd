@echo off
setlocal EnableExtensions
title Force uninstall Mobile Standalone Edition
echo.
echo Stopping leftover processes and deleting the install...
echo.

taskkill /F /IM "Mobile Standalone Edition.exe" /T >nul 2>&1
wmic process where "CommandLine like '%%mobile-standalone-backend%%'" call terminate >nul 2>&1

if exist "%LOCALAPPDATA%\Programs\Mobile Standalone Edition\" (
  echo Removing "%LOCALAPPDATA%\Programs\Mobile Standalone Edition"
  rd /s /q "%LOCALAPPDATA%\Programs\Mobile Standalone Edition"
)
if exist "%LOCALAPPDATA%\Programs\mobile-standalone-edition\" (
  echo Removing "%LOCALAPPDATA%\Programs\mobile-standalone-edition"
  rd /s /q "%LOCALAPPDATA%\Programs\mobile-standalone-edition"
)
if exist "%ProgramFiles%\Mobile Standalone Edition\" (
  echo Removing "%ProgramFiles%\Mobile Standalone Edition"
  rd /s /q "%ProgramFiles%\Mobile Standalone Edition"
)
if exist "%ProgramFiles(x86)%\Mobile Standalone Edition\" (
  echo Removing "%ProgramFiles(x86)%\Mobile Standalone Edition"
  rd /s /q "%ProgramFiles(x86)%\Mobile Standalone Edition"
)

del /f /q "%USERPROFILE%\Desktop\Mobile Standalone Edition.lnk" >nul 2>&1
del /f /q "%PUBLIC%\Desktop\Mobile Standalone Edition.lnk" >nul 2>&1
del /f /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Mobile Standalone Edition.lnk" >nul 2>&1
rd /s /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Mobile Standalone Edition" >nul 2>&1

for /f "delims=" %%k in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall" 2^>nul') do (
  reg query "%%k" /v DisplayName 2>nul | findstr /C:"Mobile Standalone Edition" >nul
  if not errorlevel 1 (
    echo Removing uninstall entry %%k
    reg delete "%%k" /f >nul
  )
)
for /f "delims=" %%k in ('reg query "HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall" 2^>nul') do (
  reg query "%%k" /v DisplayName 2>nul | findstr /C:"Mobile Standalone Edition" >nul
  if not errorlevel 1 (
    echo Removing uninstall entry %%k
    reg delete "%%k" /f >nul
  )
)

echo.
echo Done. Refresh Programs and Features, then run the new Setup.
echo.
pause
