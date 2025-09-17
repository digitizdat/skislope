# Makefile for Ski Slope project using uv

.PHONY: help install dev-install test lint format clean run-server run-mcp setup check

# Default target
help:
	@echo "🎿 Ski Slope Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make setup        Setup development environment with uv"
	@echo "  make install      Install production dependencies"
	@echo "  make dev-install  Install development dependencies"
	@echo ""
	@echo "Development:"
	@echo "  make run-server   Start HTTP server"
	@echo "  make run-mcp      Start MCP elevation server"
	@echo "  make test         Run all tests"
	@echo "  make lint         Run linting checks"
	@echo "  make format       Format code"
	@echo "  make check        Run all quality checks"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean        Clean cache and build artifacts"
	@echo "  make update       Update dependencies"

# Environment setup
setup:
	@echo "🔧 Setting up development environment..."
	./scripts/setup-dev.sh

install:
	@echo "📦 Installing production dependencies..."
	uv pip install -e .

dev-install:
	@echo "📦 Installing development dependencies..."
	uv pip install -e ".[dev,mcp]"

# Development servers
run-server:
	@echo "🚀 Starting HTTP server..."
	uv run python server.py

run-mcp:
	@echo "🚀 Starting MCP elevation server..."
	uv run python run_elevation_server.py

# Testing and quality
test:
	@echo "🧪 Running tests..."
	./scripts/run-tests.sh

lint:
	@echo "🔍 Running linting..."
	uv run ruff check .
	npm run lint

format:
	@echo "✨ Formatting code..."
	uv run ruff check . --fix
	uv run black .
	npm run format

check: lint test
	@echo "✅ All quality checks passed!"

# Maintenance
clean:
	@echo "🧹 Cleaning up..."
	rm -rf .uv-cache/
	rm -rf htmlcov/
	rm -rf .pytest_cache/
	rm -rf .ruff_cache/
	rm -rf node_modules/.cache/
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

update:
	@echo "⬆️ Updating dependencies..."
	uv pip install --upgrade -e ".[dev,mcp]"
	npm update

# Virtual environment management
venv:
	@echo "🐍 Creating virtual environment..."
	uv venv --python 3.11

activate:
	@echo "To activate the virtual environment, run:"
	@echo "source .venv/bin/activate"
