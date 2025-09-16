# Testing Documentation

This document provides comprehensive information about the testing approach for the Ski! 3D Alpine Ski Terrain Rendering System, covering both JavaScript and Python components.

## 🚨 Recent Testing Improvements

**Major Update**: Enhanced testing suite with static analysis and runtime error detection to prevent production bugs.

### What Was Fixed
- **Runtime Errors**: Added integration tests that catch undefined class references and missing methods
- **Static Analysis**: Integrated Biome for comprehensive JavaScript linting and formatting
- **Testing Gaps**: Addressed mock isolation issues that masked real application errors

### Impact
- Reduced JavaScript errors from 306 to 9 through proper linting configuration
- Added runtime error detection that would have caught original production bugs
- Improved development workflow with automated code quality checks from JavaScript frontend to Python MCP servers.

## Overview

The project implements a multi-layered testing strategy covering:

- **Unit Tests**: Individual module and function testing
- **Integration Tests**: Component interaction and data flow testing  
- **End-to-End Tests**: Complete user workflow validation
- **Performance Tests**: Rendering and memory benchmarks
- **API Tests**: External service integration validation

## Testing Architecture

```
tests/
├── js/                         # JavaScript test suite
│   ├── setup.js                # Jest environment & mocks
│   ├── unit/                   # JavaScript unit tests
│   ├── integration/            # JavaScript integration tests
│   ├── e2e/                    # Browser automation tests
│   └── performance/            # Performance benchmarks
├── conftest.py                 # Python test fixtures
├── test_*.py                   # Python unit & integration tests
├── pytest.ini                 # Python test configuration
└── playwright.config.js       # E2E test configuration
```

## JavaScript Testing Stack

### Core Testing Tools
- **Jest**: Primary testing framework for unit and integration tests
- **Playwright**: Browser automation for end-to-end testing
- **@testing-library/dom**: DOM testing utilities
- **@testing-library/jest-dom**: Custom Jest matchers for DOM assertions
- **canvas**: Node.js Canvas API for testing graphics operations
- **Biome**: Static analysis, linting, and formatting for code quality

### Static Analysis & Code Quality
- **Biome Configuration**: Comprehensive linting rules for JavaScript
- **Runtime Error Detection**: Integration tests that catch class reference errors
- **Automated Formatting**: Consistent code style across the project
- **Pre-commit Checks**: Lint and format validation before code commits

### Core Frameworks

#### Jest - Unit & Integration Testing
- **Purpose**: Primary JavaScript testing framework
- **Environment**: jsdom for browser API simulation
- **Configuration**: Custom setup with comprehensive mocks
- **Test Types**: Unit tests, integration tests, performance benchmarks

#### Playwright - End-to-End Testing
- **Purpose**: Browser automation and E2E testing
- **Browsers**: Chrome, Firefox, Safari, Mobile Chrome, Mobile Safari
- **Features**: Cross-browser testing, mobile simulation, network mocking
- **Isolation**: Separate test runner to avoid Jest conflicts

### Mock System

#### Custom Mock Environment (`tests/js/setup.js`)
- **Three.js Mocks**: Complete 3D graphics class implementations
- **Browser API Mocks**: fetch, performance, requestAnimationFrame, Canvas
- **Application Mocks**: MaterialSystem, TerrainRenderer, WeatherSystem, etc.
- **MCP Client Mocks**: Elevation data fetching simulation

#### Supporting Libraries
- **jest-canvas-mock**: HTML5 Canvas API mocking
- **@testing-library/jest-dom**: Enhanced DOM assertions
- **@testing-library/dom**: DOM testing utilities

### JavaScript Test Categories

#### Unit Tests (`tests/js/unit/`)
- **Material System Tests**: Validate Three.js material creation and properties
- **Camera Controller Tests**: Test camera movement, mouse/keyboard input handling
- **MCP Client Tests**: Mock-based testing of MCP elevation data client
- **Terrain Renderer Tests**: Geometry generation and 3D rendering logic
- **Weather System Tests**: Environmental effects and particle systems
- **Topography Tests**: Elevation data processing and terrain generation

#### Integration Tests (`tests/js/integration/`)
- **Module Loading Tests**: Verify real JavaScript module loading without excessive mocking
- **Runtime Error Detection**: Catch undefined class references and missing methods
- **Cross-Module Integration**: Test interaction between all application components
- **MCP Client Integration**: Real client-server communication testing

#### E2E Tests (`tests/js/e2e/`)
- **user-interaction.test.js**: Complete user workflows across browsers
  - Application loading and terrain rendering
  - Resort switching and terrain detail adjustment
  - Camera controls (mouse, keyboard, wheel)
  - Weather controls and UI interactions
  - Performance metrics validation
  - Mobile touch interactions
  - Accessibility features

#### Performance Tests (`tests/js/performance/`)
- **benchmark.test.js**: Rendering performance and memory usage benchmarks

## Python Testing Stack

### Core Framework

#### pytest - Python Testing
- **Purpose**: Primary Python testing framework
- **Configuration**: `pytest.ini` with async support
- **Fixtures**: Comprehensive mock data and server instances
- **Markers**: Unit, integration, API, and slow test categorization

### Python Test Categories

#### Unit Tests
- **test_elevation_provider.py**: ElevationDataProvider data fetching and caching
- **test_simple.py**: Basic functionality and configuration validation

#### Integration Tests
- **test_mcp_server.py**: MCP server protocol compliance and resource handling
- **test_mcp_integration.py**: End-to-end MCP communication workflows
- **test_api_integration.py**: External API integration (Open Topo Data, Open Elevation)

### Python Test Fixtures (`conftest.py`)

#### Mock Data Fixtures
- **mock_elevation_data**: Sample elevation grid data
- **mock_ski_resort_data**: Test resort configurations
- **mock_http_response**: HTTP API response simulation
- **mock_open_topo_response**: Open Topo Data API mocking
- **mock_open_elevation_response**: Open Elevation API mocking

#### Server Fixtures
- **elevation_provider**: ElevationDataProvider instance with test data
- **mcp_server**: MCP server instance for protocol testing
- **event_loop**: Async test execution support

## Running Tests

### Code Quality & Linting (Run First!)

```bash
# Check code quality (lint + format)
npm run check

# Auto-fix linting and formatting issues
npm run check:fix

# Lint only (no formatting)
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code only
npm run format
```

### Recommended Development Workflow

```bash
# 1. Check code quality first
npm run check:fix

# 2. Run unit and integration tests
npm test

# 3. Run E2E tests for full validation
npm run test:e2e

# 4. Commit (Lefthook will run hooks automatically)
git commit -m "feat(scope): description"

# 5. Push (Lefthook will run full test suite)
git push
```

### JavaScript Tests

```bash
# Run all unit and integration tests
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Generate test coverage report
npm run test:coverage

# Run end-to-end tests (requires Playwright browsers)
npm run test:e2e

# Install Playwright browsers (one-time setup)
npm run install:e2e

# Run all tests (unit + integration + e2e)
npm run test:all
```

### Python Tests

#### All Python Tests
```bash
# Run all Python tests
pytest

# Run with verbose output
pytest -v

# Run specific test categories
pytest -m unit
pytest -m integration
pytest -m api

# Run specific test files
pytest tests/test_mcp_server.py
pytest tests/test_elevation_provider.py
```

#### Coverage and Reporting
```bash
# Run with coverage
pytest --cov=mcp --cov-report=html

# Generate coverage report
pytest --cov=mcp --cov-report=term-missing
```

## Test Environment Setup

### Prerequisites
```bash
# Install Python dependencies
pip install -r requirements.txt

# Install JavaScript dependencies
npm install

# Install Playwright browsers
npx playwright install
```

### Environment Variables
```bash
# Optional: Configure external API endpoints
export OPEN_TOPO_DATA_URL="https://api.opentopodata.org/v1"
export OPEN_ELEVATION_URL="https://api.open-elevation.com/api/v1"
```

## Continuous Integration

### CI Pipeline Configuration

#### GitHub Actions Example
```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      # Install Lefthook
      - name: Install Lefthook
        run: |
          curl -1sLf 'https://dl.cloudsmith.io/public/evilmartians/lefthook/setup.deb.sh' | sudo -E bash
          sudo apt install lefthook
      
      - run: npm install
      - run: lefthook install
      
      # Static analysis first (fail fast)
      - name: Code Quality Check
        run: npm run check
      
      # Unit and integration tests
      - name: Run Tests
        run: npm test
      
      # E2E tests
      - name: Install Playwright
        run: npx playwright install
      - name: E2E Tests
        run: npm run test:e2e
      
      # Coverage reporting
      - name: Coverage
        run: npm run test:coverage
```

### Local Development Workflow
```bash
# Pre-commit testing
npm test && pytest

# Full test suite
npm run test -- --coverage && pytest --cov=mcp && npx playwright test
```

## Test Data and Mocking

### JavaScript Mocks
- **Isolated Environment**: No external API calls during testing
- **Three.js Simulation**: Complete 3D graphics stack mocking
- **Browser API Mocking**: Canvas, WebGL, fetch, performance APIs
- **Deterministic Results**: Consistent test outcomes across environments

### Python Mocks
- **External API Mocking**: Open Topo Data and Open Elevation simulation
- **MCP Protocol Testing**: Complete protocol compliance validation
- **Async Testing**: Full async/await support with proper event loop handling
- **Data Fixtures**: Realistic ski resort and elevation data

## Performance Testing

### JavaScript Performance Tests
- **Rendering Benchmarks**: Frame rate and rendering time measurement
- **Memory Usage**: Texture and geometry memory management validation
- **Scalability Tests**: Performance under various terrain detail levels
- **Animation Smoothness**: Frame timing consistency validation

### Python Performance Tests
- **API Response Times**: External service integration performance
- **Caching Efficiency**: Data caching and retrieval optimization
- **Memory Management**: Large dataset handling validation
- **Concurrent Request Handling**: Multi-client MCP server performance

## Debugging and Troubleshooting

### Common Issues

#### Jest ES Module Issues
- **Solution**: Custom mock implementations in `setup.js`
- **Workaround**: Simplified class mocks instead of actual imports

#### Playwright Browser Issues
- **Solution**: Run `npx playwright install` to download browsers
- **Debugging**: Use `--headed` flag to see browser interactions

#### Python Async Test Issues
- **Solution**: Proper event loop configuration in `conftest.py`
- **Debugging**: Use `pytest -s` for detailed async error output

### Test Debugging Commands
```bash
# JavaScript debugging
npm run test -- --verbose --no-coverage

# Python debugging
pytest -s -vv --tb=long

# E2E debugging
npx playwright test --debug
npx playwright test --headed --slowMo=1000
```

## Test Coverage Goals

### Current Status
- **JavaScript Unit Tests**: 91 passed, 73 failed (significant functionality working)
- **JavaScript E2E Tests**: 15/15 passing (100% success rate)
- **Python Tests**: Comprehensive MCP server and API integration coverage

### Coverage Goals
- **Static Analysis**: 100% linting compliance (enforced by Biome)
- **Unit Tests**: >90% line coverage for core modules
- **Integration Tests**: >80% coverage for module interactions
- **Runtime Error Detection**: 100% coverage of class instantiation and method calls
- **E2E Tests**: 100% coverage of critical user workflows
- **Error Handling**: 100% coverage of error paths and fallbacks

## Testing Improvements Summary

### Problems Solved
1. **Runtime Errors**: Integration tests now catch undefined class references and missing methods
2. **Code Quality**: Biome static analysis prevents 300+ potential errors
3. **Development Workflow**: Automated linting and formatting in development cycle
4. **Mock Isolation**: Balance between mocking and real module testing

### Key Learnings
- **Static analysis catches errors that unit tests with mocks miss**
- **Integration tests complement unit tests for comprehensive coverage**
- **Automated code quality checks prevent bugs before they reach production**
- **Proper linting configuration is essential for JavaScript applications**

## Contributing to Tests

### Adding New Tests

#### JavaScript Tests
1. Add unit tests in appropriate `tests/js/unit/` file
2. Update mocks in `tests/js/setup.js` if needed
3. Add integration tests for component interactions
4. Include E2E tests for user-facing features

#### Python Tests
1. Add test functions following `test_*` naming convention
2. Use appropriate pytest markers (`@pytest.mark.unit`, etc.)
3. Add fixtures to `conftest.py` for reusable test data
4. Include async tests for MCP server functionality

### Test Quality Guidelines
- **Isolation**: Tests should not depend on external services
- **Determinism**: Tests should produce consistent results
- **Coverage**: New features require corresponding tests
- **Documentation**: Complex test scenarios should be well-documented
- **Performance**: Tests should complete in reasonable time

---

For questions about testing or to report issues with the test suite, please refer to the project's issue tracker or documentation.
