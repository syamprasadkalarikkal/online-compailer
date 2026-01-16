#!/bin/bash

echo "=========================================="
echo "  Docker Setup for Online Compiler"
echo "=========================================="
echo ""

echo "Step 1: Creating directory structure..."
mkdir -p docker/python docker/node docker/java docker/cpp
mkdir -p temp/python temp/node temp/java temp/cpp

echo "Step 2: Checking if Docker is installed..."
if ! command -v docker &> /dev/null
then
    echo "ERROR: Docker is not installed!"
    echo "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

echo "Step 3: Checking if Docker is running..."
if ! docker info &> /dev/null
then
    echo "ERROR: Docker is not running!"
    echo "Please start Docker Desktop and try again."
    exit 1
fi

echo "Step 4: Building Docker images..."
echo ""

echo "Building Python runner..."
docker build -t python-runner ./docker/python
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to build Python runner"
    exit 1
fi
echo ""

echo "Building Node.js runner..."
docker build -t node-runner ./docker/node
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to build Node.js runner"
    exit 1
fi
echo ""

echo "Building Java runner..."
docker build -t java-runner ./docker/java
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to build Java runner"
    exit 1
fi
echo ""

echo "Building C/C++ runner..."
docker build -t cpp-runner ./docker/cpp
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to build C/C++ runner"
    exit 1
fi
echo ""

echo "=========================================="
echo "  Setup Complete!"
echo "=========================================="
echo ""
echo "Docker images created:"
docker images | grep -E "REPOSITORY|python-runner|node-runner|java-runner|cpp-runner"
echo ""
echo "You can now run: npm run dev"
echo ""