@echo off
setlocal EnableDelayedExpansion
title IMS — نظام إدارة المعلومات الطبية
chcp 65001 > nul

REM ================================================================
REM  IMS Medical System — One-Click Launcher
REM  يشغّل السيرفر في الخلفية ويفتح النظام كتطبيق سطح مكتب مستقل
REM ================================================================

cd /d "%~dp0"

REM --- 1. تحقق من تثبيت Node.js ---
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [خطأ] لم يتم العثور على Node.js. يرجى تثبيته من https://nodejs.org
    pause
    exit /b 1
)

REM --- 2. تحقق هل السيرفر يعمل مسبقاً ---
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [معلومة] السيرفر يعمل مسبقاً على المنفذ 3000.
    goto :OpenApp
)

REM --- 3. تشغيل السيرفر في الخلفية ---
echo [جاري] تشغيل السيرفر في الخلفية...
start "" /B /MIN cmd /c "node server.js > server_log.txt 2>&1"

REM --- 4. انتظر حتى يصبح السيرفر جاهزاً (حد أقصى 15 ثانية) ---
set /A TRIES=0
:WaitLoop
    timeout /t 1 /nobreak >nul
    set /A TRIES+=1
    netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
    if %errorlevel% equ 0 goto :OpenApp
    if %TRIES% lss 15 goto :WaitLoop

echo [تحذير] السيرفر لم يبدأ في الوقت المحدد. تحقق من ملف server_log.txt
goto :OpenApp

:OpenApp
REM --- 5. ابحث عن Chrome وافتح النظام بوضع App Mode ---
set APP_URL=http://localhost:3000/IMS_Medical_System_4.html
set APP_TITLE=IMS Medical System

REM مسارات Chrome المحتملة
set CHROME1="%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set CHROME2="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
set CHROME3="%LocalAppData%\Google\Chrome\Application\chrome.exe"

if exist %CHROME1% (
    start "" %CHROME1% --app="%APP_URL%" --window-size=1280,800 --window-position=100,50 --title="%APP_TITLE%"
    goto :Done
)
if exist %CHROME2% (
    start "" %CHROME2% --app="%APP_URL%" --window-size=1280,800 --window-position=100,50 --title="%APP_TITLE%"
    goto :Done
)
if exist %CHROME3% (
    start "" %CHROME3% --app="%APP_URL%" --window-size=1280,800 --window-position=100,50 --title="%APP_TITLE%"
    goto :Done
)

REM إذا لم يوجد Chrome، جرّب Edge بوضع App
set EDGE="%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if exist %EDGE% (
    echo [معلومة] Chrome غير موجود. يُستخدم Microsoft Edge بوضع التطبيق...
    start "" %EDGE% --app="%APP_URL%" --window-size=1280,800 --window-position=100,50
    goto :Done
)

REM الحل الأخير: فتح المتصفح الافتراضي
echo [معلومة] لم يُعثر على Chrome أو Edge. فتح المتصفح الافتراضي...
start "" "%APP_URL%"

:Done
REM --- 6. رسالة بسيطة في شريط العنوان تبقى في الخلفية ---
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║   IMS — نظام إدارة المعلومات الطبية         ║
echo  ║   السيرفر يعمل على: http://localhost:3000    ║
echo  ║   لإيقاف النظام: اضغط Ctrl+C أو أغلق هذه   ║
echo  ║   النافذة.                                  ║
echo  ╚══════════════════════════════════════════════╝
echo.

REM احتفظ بالنافذة مفتوحة حتى لا يتوقف السيرفر
:KeepAlive
    timeout /t 30 /nobreak >nul 2>&1
    netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
    if %errorlevel% neq 0 (
        echo [تحذير] السيرفر توقف. جاري إعادة التشغيل...
        start "" /B /MIN cmd /c "node server.js > server_log.txt 2>&1"
        timeout /t 3 /nobreak >nul
    )
goto :KeepAlive
