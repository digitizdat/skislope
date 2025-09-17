#!/bin/bash
# Comprehensive test runner using uv

set -e

echo "🧪 Running comprehensive test suite..."

# Ensure virtual environment is activated
if [[ "$VIRTUAL_ENV" == "" ]]; then
    echo "🔧 Activating virtual environment..."
    source .venv/bin/activate
fi

# Run Python linting and formatting checks
echo "🔍 Running Python code quality checks..."
uv run ruff check . --fix
uv run black . --check --diff
uv run mypy . --ignore-missing-imports

# Run Python tests with coverage
echo "🐍 Running Python tests with coverage..."
uv run pytest tests/ \
    --cov=mcp \
    --cov=server \
    --cov-report=term-missing \
    --cov-report=html:htmlcov \
    --cov-fail-under=80 \
    -v

# Run JavaScript linting and tests
echo "🟨 Running JavaScript tests..."
npm run lint
npm run test

# Run integration tests
echo "🔗 Running integration tests..."
uv run pytest tests/test_api_integration.py -v

# Performance check (if performance dependencies are installed)
if uv pip show memory-profiler &> /dev/null; then
    echo "⚡ Running performance checks..."
    uv run python -m memory_profiler mcp/elevation/server.py
fi

echo "✅ All tests completed successfully!"
echo "📊 Coverage report available at: htmlcov/index.html"
