@echo off
cd /d "%~dp0\.."

:: ── Parse flags ──────────────────────────────────────────────
set DEV=false
if "%~1"=="--dev" set DEV=true
if "%~1"=="-d"    set DEV=true

:: ── Check Docker ─────────────────────────────────────────────
where docker >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Docker is required but not installed.
    echo Install from https://docker.com/get-started
    pause
    exit /b 1
)

docker info >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Docker daemon is not running. Please start Docker Desktop and try again.
    pause
    exit /b 1
)

:: ── Check Claude auth ────────────────────────────────────────
if not exist "%USERPROFILE%\.claude.json" (
    echo Claude authentication not found at %USERPROFILE%\.claude.json
    echo Run "npx @anthropic-ai/claude-code" once to log in, then re-run this script.
    pause
    exit /b 1
)

:: ── Check Claude credentials for Docker ─────────────────────
:: On Windows the SDK stores OAuth tokens in Credential Manager.
:: The plaintext fallback at .claude\.credentials.json is written
:: automatically by Claude Code on non-macOS platforms.
if not exist "%USERPROFILE%\.claude\.credentials.json" (
    echo Claude credentials file not found at %USERPROFILE%\.claude\.credentials.json
    echo Make sure you have logged in with "npx @anthropic-ai/claude-code" first.
    pause
    exit /b 1
)

:: ── Build and start ──────────────────────────────────────────
if "%DEV%"=="true" (
    echo Starting Jobby in DEVELOPMENT mode (hot-reload enabled^)...
    docker compose -f docker-compose.dev.yml up --build -d
    echo.
    echo   Jobby (dev^) is running at  http://localhost:3000
    echo   Edit files locally — changes are picked up automatically.
    echo   Logs:                      docker compose -f docker-compose.dev.yml logs -f node
    echo   Stop:                      docker compose -f docker-compose.dev.yml down
) else (
    echo Building and starting Jobby...
    docker compose up --build -d
    echo.
    echo   Jobby is running at  http://localhost:3000
    echo   Stop with:           docker compose down
)

echo.
start http://localhost:3000
pause
