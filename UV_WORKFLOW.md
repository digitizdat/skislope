# UV Workflow Guide

## Overview

This project uses `uv` for ultra-fast Python dependency management and virtual environment handling. This guide covers best practices for using `uv` effectively in the Ski Slope project.

## Why uv?

- **Speed**: 10-100x faster than pip for dependency resolution and installation
- **Reliability**: Consistent dependency resolution across environments
- **Modern**: Built-in support for PEP 621 (pyproject.toml) and modern Python packaging
- **Virtual Environment Management**: Integrated venv creation and management
- **Lock Files**: Deterministic builds with `uv.lock`

## Quick Commands

### Environment Management
```bash
# Create virtual environment with specific Python version
uv venv --python 3.11

# Activate virtual environment
source .venv/bin/activate

# Install project in development mode
uv pip install -e ".[dev,mcp]"

# Install specific dependency groups
uv pip install -e ".[dev]"      # Development tools only
uv pip install -e ".[mcp]"      # MCP functionality only
uv pip install -e ".[perf]"     # Performance monitoring tools
uv pip install -e ".[all]"      # Everything
```

### Dependency Management
```bash
# Add new dependency
uv add httpx>=0.25.0

# Add development dependency
uv add --dev pytest>=7.0.0

# Remove dependency
uv remove httpx

# Update all dependencies
uv pip install --upgrade -e ".[dev,mcp]"

# Sync dependencies (install exactly what's in lock file)
uv pip sync requirements.txt
```

### Running Commands
```bash
# Run Python scripts with uv
uv run python server.py
uv run python run_elevation_server.py

# Run tests
uv run pytest tests/ -v

# Run linting
uv run ruff check .
uv run black .

# Run with specific Python version
uv run --python 3.11 python server.py
```

## Project Structure

```
skislope/
├── pyproject.toml          # Project metadata and dependencies
├── uv.toml                 # UV-specific configuration
├── uv.lock                 # Lock file (committed to git)
├── requirements.txt        # Compatibility with pip
├── .venv/                  # Virtual environment (gitignored)
├── scripts/
│   ├── setup-dev.sh       # Automated development setup
│   └── run-tests.sh       # Comprehensive test runner
└── Makefile               # Convenient command shortcuts
```

## Configuration Files

### pyproject.toml
- Defines project metadata, dependencies, and optional dependency groups
- Configured for Python 3.11+ with modern packaging standards
- Includes tool configurations for ruff, black, and pytest

### uv.toml
- UV-specific settings for dependency resolution and caching
- Workspace configuration for multi-package projects
- Development workflow optimizations

### uv.lock
- Deterministic dependency lock file
- Should be committed to version control
- Ensures reproducible builds across environments

## Development Workflows

### Daily Development
```bash
# Start development session
source .venv/bin/activate
make run-server              # Start HTTP server
# or
make run-mcp                # Start MCP server

# Run tests during development
make test                   # Full test suite
uv run pytest tests/specific_test.py  # Specific test

# Code quality checks
make lint                   # Check code quality
make format                 # Auto-format code
```

### Adding Dependencies

#### Runtime Dependencies
```bash
# Add to main dependencies in pyproject.toml
uv add "fastapi>=0.104.0"

# Or edit pyproject.toml manually and sync
uv pip install -e .
```

#### Development Dependencies
```bash
# Add to dev group
uv add --dev "pytest-cov>=4.0.0"

# Or edit pyproject.toml [project.optional-dependencies.dev] and sync
uv pip install -e ".[dev]"
```

### Dependency Updates
```bash
# Update all dependencies to latest compatible versions
uv pip install --upgrade -e ".[dev,mcp]"

# Update specific dependency
uv add "httpx>=0.26.0"  # This will upgrade httpx

# Check for outdated packages
uv pip list --outdated
```

### Environment Isolation

#### Multiple Python Versions
```bash
# Create environment with specific Python version
uv venv --python 3.11 .venv-311
uv venv --python 3.12 .venv-312

# Activate specific environment
source .venv-311/bin/activate
```

#### Clean Environment Setup
```bash
# Remove existing environment
rm -rf .venv

# Create fresh environment
uv venv --python 3.11

# Install from lock file for reproducible build
source .venv/bin/activate
uv pip install -e ".[dev,mcp]"
```

## Performance Optimization

### Caching
```bash
# UV automatically caches packages in ~/.cache/uv/
# Project-specific cache in .uv-cache/ (gitignored)

# Clear cache if needed
uv cache clean
```

### Parallel Installation
```bash
# UV automatically parallelizes package installation
# No additional configuration needed
```

### Bytecode Compilation
```bash
# Enabled by default in uv.toml
# Speeds up Python import times
compile-bytecode = true
```

## Troubleshooting

### Common Issues

#### Virtual Environment Not Found
```bash
# Ensure you're in project root and venv exists
ls -la .venv/
# If missing, recreate:
uv venv --python 3.11
```

#### Dependency Conflicts
```bash
# Check dependency tree
uv pip show --verbose package-name

# Force reinstall problematic package
uv pip install --force-reinstall package-name
```

#### Lock File Issues
```bash
# Regenerate lock file
rm uv.lock
uv pip install -e ".[dev,mcp]"
```

### Environment Variables
```bash
# UV respects these environment variables:
export UV_CACHE_DIR=~/.cache/uv          # Cache directory
export UV_PYTHON_PREFERENCE=only-managed # Use only UV-managed Python
export UV_RESOLUTION=highest              # Always use latest compatible versions
```

## Integration with Other Tools

### Git Hooks (Lefthook)
- Pre-commit hooks run `uv run ruff check` and `uv run black --check`
- Pre-push hooks run full test suite with `uv run pytest`

### CI/CD
```yaml
# Example GitHub Actions integration
- name: Set up Python with uv
  uses: astral-sh/setup-uv@v1
  with:
    python-version: "3.11"

- name: Install dependencies
  run: uv pip install -e ".[dev,mcp]"

- name: Run tests
  run: uv run pytest
```

### IDE Integration
- Configure your IDE to use `.venv/bin/python` as the Python interpreter
- Set up linting to use `uv run ruff` and `uv run black`

## Best Practices

1. **Always use virtual environments**: Never install packages globally
2. **Pin major versions**: Use `>=` for flexibility, `~=` for stability
3. **Commit lock files**: Ensure reproducible builds
4. **Regular updates**: Keep dependencies current for security
5. **Use dependency groups**: Separate dev, test, and optional dependencies
6. **Cache awareness**: Leverage UV's caching for faster installs
7. **Environment isolation**: Use separate environments for different projects

## Migration from pip/pipenv/poetry

### From pip + requirements.txt
```bash
# Your existing requirements.txt is still supported
uv pip install -r requirements.txt

# Migrate to pyproject.toml for better dependency management
# Edit pyproject.toml dependencies section
uv pip install -e .
```

### From pipenv
```bash
# Convert Pipfile to pyproject.toml manually
# UV doesn't directly import Pipfiles yet
```

### From poetry
```bash
# Convert pyproject.toml poetry sections to standard format
# Update [tool.poetry.dependencies] to [project.dependencies]
# Update [tool.poetry.group.dev.dependencies] to [project.optional-dependencies.dev]
```

This workflow ensures fast, reliable, and reproducible Python development with modern tooling.
