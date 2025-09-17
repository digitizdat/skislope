#!/bin/bash
# Development environment setup script using uv

set -e

echo "🎿 Setting up Ski Slope development environment with uv..."

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "❌ uv is not installed. Please install it first:"
    echo "   curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# Create virtual environment with specific Python version
echo "📦 Creating virtual environment..."
uv venv --python 3.11

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source .venv/bin/activate

# Install project in development mode with all dependencies
echo "📥 Installing project dependencies..."
uv pip install -e ".[dev,mcp]"

# Install pre-commit hooks
echo "🪝 Setting up pre-commit hooks..."
pre-commit install

# Install Node.js dependencies for JavaScript testing
echo "🟨 Installing JavaScript dependencies..."
npm install

# Install Lefthook git hooks
echo "⚡ Installing Lefthook git hooks..."
npx lefthook install

# Run initial code quality checks
echo "🔍 Running initial code quality checks..."
uv run ruff check .
uv run black --check .
uv run pytest tests/ -v

echo "✅ Development environment setup complete!"
echo ""
echo "🚀 Quick start commands:"
echo "   source .venv/bin/activate    # Activate virtual environment"
echo "   uv run python server.py      # Start HTTP server"
echo "   uv run pytest               # Run Python tests"
echo "   npm test                     # Run JavaScript tests"
echo "   uv run ruff check .          # Run linting"
echo ""
echo "📚 See DEVELOPMENT.md for detailed workflow information"
