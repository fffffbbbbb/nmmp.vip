@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Push to GitHub

REM ==========================================================
REM  One-click push to GitHub
REM    push.bat                - ask for a commit message
REM    push.bat "your message" - no prompt, commit and push
REM    push.bat --dry-run      - show only, change nothing
REM  NOTE: keep this file ASCII-only. Chinese text in a .bat
REM        corrupts cmd.exe parsing (byte-offset desync).
REM ==========================================================

set "DRY="
if /i "%~1"=="--dry-run" set "DRY=1"

echo ==========================================
if defined DRY echo    Push to GitHub   [DRY RUN]
if not defined DRY echo    Push to GitHub
echo ==========================================
echo.

REM ---------------- 1. environment ----------------
where git >nul 2>nul
if errorlevel 1 (
    echo [ERROR] git not found. Install Git for Windows first.
    goto :fail
)

git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Not a git repository: %CD%
    goto :fail
)

set "BRANCH="
for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "BRANCH=%%b"

set "REMOTE="
for /f "delims=" %%r in ('git remote 2^>nul') do if not defined REMOTE set "REMOTE=%%r"

if not defined REMOTE (
    echo [ERROR] No remote configured.
    echo         Run: git remote add origin YOUR_REPO_URL
    goto :fail
)

set "REMOTEURL="
for /f "delims=" %%u in ('git remote get-url !REMOTE! 2^>nul') do set "REMOTEURL=%%u"

echo   Branch : !BRANCH!
echo   Remote : !REMOTE!
echo   URL    : !REMOTEURL!
echo.

REM ---------------- 2. show changes ----------------
echo ---------- Changes ----------
git -c core.quotepath=false status --short
echo -----------------------------
echo.

set "HASCHANGE="
for /f "delims=" %%l in ('git status --porcelain 2^>nul') do set "HASCHANGE=1"

if not defined HASCHANGE (
    echo [INFO] No new changes in the working tree.
    set "UPSTREAM=!REMOTE!/!BRANCH!"
    set "AHEAD="
    for /f "delims=" %%c in ('git log --oneline "!UPSTREAM!..HEAD" 2^>nul') do set "AHEAD=1"
    if defined AHEAD (
        echo        Local commits not pushed yet, going to push step.
        goto :dopush
    )
    echo        Local and remote are identical. Nothing to do.
    goto :done
)

REM ---------------- 3. commit message ----------------
set "MSG=%~1"
if /i "!MSG!"=="--dry-run" set "MSG="
if defined MSG goto :havemsg

if defined DRY (
    set "MSG=chore: update site content"
    goto :havemsg
)

echo Enter a commit message, or just press Enter for the auto message:
set /p "MSG=Message: "
if not defined MSG set "MSG=chore: update site content"

:havemsg

if defined DRY (
    echo.
    echo [DRY RUN] would run: git add -A
    echo [DRY RUN] would run: git commit -m "!MSG!"
    echo [DRY RUN] would run: git push !REMOTE! !BRANCH!
    echo.
    echo [DRY RUN] nothing was committed or pushed.
    goto :done
)

REM ---------------- 4. commit ----------------
echo.
echo ---------- Commit ----------
git add -A
if errorlevel 1 (
    echo [ERROR] git add failed.
    goto :fail
)

git commit -m "!MSG!"
if errorlevel 1 (
    echo [ERROR] git commit failed, see git output above.
    goto :fail
)

:dopush
REM ---------------- 5. push ----------------
echo.
echo ---------- Push ----------
git push !REMOTE! !BRANCH!
if errorlevel 1 (
    echo.
    echo [ERROR] Push failed. Common causes:
    echo   1. remote has new commits - run: git pull --rebase
    echo   2. authentication failed - check GitHub credentials or token
    echo   3. network problem       - check network or proxy
    goto :fail
)

echo.
echo ==========================================
echo   [OK] Pushed to !REMOTE!/!BRANCH!
echo ==========================================
git -c core.quotepath=false log --oneline -1
echo.
echo   View online: !REMOTEURL!
goto :done

:fail
echo.
echo [FAILED] Task not completed. Read the hints above and retry.
if not defined DRY pause
exit /b 1

:done
echo.
if not defined DRY pause
exit /b 0
