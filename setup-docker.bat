@echo off
echo ==========================================
echo   Docker Setup for Online Compiler
echo ==========================================
echo.

echo Step 1: Creating directory structure...
if not exist "docker\python" mkdir docker\python
if not exist "docker\node" mkdir docker\node
if not exist "docker\java" mkdir docker\java
if not exist "docker\cpp" mkdir docker\cpp
if not exist "temp\python" mkdir temp\python
if not exist "temp\node" mkdir temp\node
if not exist "temp\java" mkdir temp\java
if not exist "temp\cpp" mkdir temp\cpp

echo Step 2: Checking if Docker is installed...
docker --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not installed!
    echo Please install Docker Desktop from: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo Step 3: Checking if Docker is running...
docker info >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not running!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo Step 4: Building Docker images...
echo.

echo Building Python runner...
docker build -t python-runner ./docker/python
if errorlevel 1 (
    echo ERROR: Failed to build Python runner
    pause
    exit /b 1
)
echo.

echo Building Node.js runner...
docker build -t node-runner ./docker/node
if errorlevel 1 (
    echo ERROR: Failed to build Node.js runner
    pause
    exit /b 1
)
echo.

echo Building Java runner...
docker build -t java-runner ./docker/java
if errorlevel 1 (
    echo ERROR: Failed to build Java runner
    pause
    exit /b 1
)
echo.

echo Building C/C++ runner...
docker build -t cpp-runner ./docker/cpp
if errorlevel 1 (
    echo ERROR: Failed to build C/C++ runner
    pause
    exit /b 1
)
echo.

echo ==========================================
echo   Setup Complete!
echo ==========================================
echo.
echo Docker images created:
docker images | findstr "REPOSITORY python-runner node-runner java-runner cpp-runner"
echo.
echo You can now run: npm run dev
echo.
pause