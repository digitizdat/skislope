# Development Guide

## Project Overview

The Ski! 3D Alpine Ski Terrain Rendering System is a specialized JavaScript/Python application that renders realistic 3D ski terrain using real topographical data and MCP (Model Context Protocol) agents.

## Architecture

```
Frontend (JavaScript)     Backend (Python)        External APIs
├── js/main.js           ├── server.py            ├── Open Topo Data
├── js/terrain.js        ├── mcp/elevation/       ├── USGS Elevation
├── js/camera.js         ├── mcp/weather/         └── Mapbox Terrain
├── js/materials.js      └── run_elevation_server.py
└── js/topography.js
```

## Technology Stack

### Frontend
- **Three.js**: 3D rendering and WebGL graphics
- **Vanilla JavaScript**: No framework dependencies for performance
- **WebGL**: Hardware-accelerated 3D graphics
- **HTML5 Canvas**: 2D UI elements and overlays

### Backend
- **Python 3.11+**: MCP server implementation
- **uv**: Ultra-fast Python package manager and virtual environment
- **FastAPI/HTTP**: REST API for elevation data proxy
- **MCP Protocol**: Standardized AI agent communication
- **Real Topographical APIs**: USGS, Open Topo Data, Mapbox

### Development Tools
- **uv**: Python dependency management and virtual environments
- **Biome**: JavaScript linting, formatting, and static analysis
- **Jest**: Unit and integration testing
- **Playwright**: End-to-end browser testing
- **Lefthook**: Git hooks for code quality and commit validation
- **Commitlint**: Conventional Commits enforcement
- **pytest**: Python testing with coverage reporting
- **ruff**: Fast Python linter and formatter
- **mypy**: Static type checking

## Development Workflow

### 1. Initial Setup with uv

#### Quick Setup (Recommended)
```bash
# Clone repository
git clone <repository-url>
cd skislope

# Run automated setup script
make setup
```

#### Manual Setup
```bash
# Install uv if not already installed
curl -LsSf https://astral.sh/uv/install.sh | sh

# Create virtual environment with Python 3.11
uv venv --python 3.11

# Activate virtual environment
source .venv/bin/activate

# Install project with development dependencies
uv pip install -e ".[dev,mcp]"

# Install JavaScript dependencies
npm install

# Set up git hooks
npx lefthook install  # Installs Lefthook hooks

# Verify setup
make check
```

### 2. Code Quality Standards

#### Static Analysis (Biome)
```bash
# Check code quality
npm run check

# Auto-fix issues
npm run check:fix

# Lint only
npm run lint

# Format only
npm run format
```

#### Testing Strategy
```bash
# Unit & integration tests
npm test

# E2E browser tests
npm run test:e2e

# Python MCP tests
pytest

# Full test suite
npm run test:all && pytest
```

### 3. Git Workflow (Lefthook)

#### Automated Hooks
- **Pre-commit**: Runs `npm run check` for code quality
- **Commit-msg**: Validates Conventional Commits format
- **Pre-push**: Runs full test suite (JS + Python + E2E)

#### Commit Message Format
```bash
# Format: <type>[optional scope]: <description>
feat(terrain): add elevation caching system
fix(mcp): resolve undefined class reference
docs: update development workflow
test(js): add integration tests for runtime errors
```

#### Development Process
```bash
# 1. Create feature branch
git checkout -b feat/your-feature

# 2. Make changes and test
npm run check:fix
npm test

# 3. Commit (hooks run automatically)
git commit -m "feat(terrain): add new feature"

# 4. Push (full test suite runs)
git push origin feat/your-feature
```

### 4. Testing Guidelines

#### JavaScript Testing
- **Unit Tests**: Individual functions/classes in `tests/js/unit/`
- **Integration Tests**: Module interactions in `tests/js/integration/`
- **E2E Tests**: User workflows in `tests/js/e2e/`
- **Runtime Error Tests**: Catch undefined references and missing methods

#### Python Testing
- **Unit Tests**: MCP server functions
- **Integration Tests**: API endpoints and external services
- **Mock Tests**: External API responses

#### Test Coverage Goals
- **Static Analysis**: 100% linting compliance
- **Unit Tests**: >90% line coverage
- **Integration Tests**: >80% module interaction coverage
- **E2E Tests**: 100% critical user workflows

## Code Organization

### JavaScript Modules
```
js/
├── main.js          # Application entry point and initialization
├── terrain.js       # 3D terrain generation and rendering
├── camera.js        # Camera controls and movement
├── materials.js     # Three.js materials and shaders
├── topography.js    # Elevation data processing
└── weather.js       # Weather effects and particles
```

### Python MCP Servers
```
mcp/
├── elevation/       # Topographical data MCP server
├── weather/         # Weather data MCP server
├── equipment/       # Ski equipment data
└── terrain/         # Terrain analysis tools
```

### Test Structure
```
tests/
├── js/
│   ├── unit/        # Individual module tests
│   ├── integration/ # Module interaction tests
│   ├── e2e/         # Browser automation tests
│   └── performance/ # Rendering benchmarks
└── *.py             # Python MCP server tests
```

## Performance Considerations

### 3D Rendering Optimization
- **Terrain LOD**: Level-of-detail for distant terrain
- **Frustum Culling**: Only render visible terrain sections
- **Texture Atlasing**: Combine textures to reduce draw calls
- **Geometry Instancing**: Reuse geometry for trees/rocks

### Data Management
- **Elevation Caching**: Cache topographical data locally
- **Progressive Loading**: Load terrain data as needed
- **Memory Management**: Dispose of unused Three.js resources

## Debugging

### JavaScript Debugging
```bash
# Run tests in watch mode
npm run test:watch

# Debug E2E tests with browser UI
npx playwright test --headed --slowMo=1000

# Check specific linting rules
npm run lint -- --max-diagnostics=50
```

### Python Debugging
```bash
# Run specific test categories
pytest -m unit
pytest -m integration

# Run with verbose output
pytest -v

# Debug MCP server
python -m pdb run_elevation_server.py
```

## Contributing

### Pull Request Process
1. **Branch Naming**: `feat/feature-name`, `fix/bug-name`, `docs/update-name`
2. **PR Title**: Use Conventional Commits format
3. **Description**: Include what, why, and how to test
4. **Checklist**: Code style, tests, documentation

### Code Review Guidelines
- **Functionality**: Does it work as intended?
- **Performance**: Any rendering or data processing impacts?
- **Testing**: Adequate test coverage for changes?
- **Documentation**: Updated docs for new features?

## Deployment

### Local Development
```bash
# Start development server
python server.py

# Access application
open http://localhost:8080
```

### Production Considerations
- **Asset Optimization**: Minify JavaScript and compress textures
- **CDN Integration**: Serve Three.js and assets from CDN
- **Error Monitoring**: Track JavaScript errors in production
- **Performance Monitoring**: Monitor 3D rendering performance

## Troubleshooting

### Common Issues
1. **Three.js Import Errors**: Ensure globals are properly configured in Biome
2. **MCP Client Failures**: Check network connectivity and API keys
3. **Test Failures**: Verify mock configurations match real APIs
4. **Lefthook Issues**: Ensure hooks are installed with `npm run prepare`

### Getting Help
- **Issues**: GitHub Issues for bugs and feature requests
- **Discussions**: GitHub Discussions for questions
- **Documentation**: `README.md`, `TESTING.md`, `CONTRIBUTING.md`
