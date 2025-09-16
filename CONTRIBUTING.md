# Contributing to Ski! 3D Alpine Ski Terrain Rendering System

## Development Workflow

### 1. Code Quality First
Before making any changes, ensure your development environment is set up:

```bash
# Install dependencies
npm install

# Set up Lefthook git hooks (automatic)
npm run prepare

# Check current code quality
npm run check
```

### 2. Making Changes

#### Commit Message Guidelines
We follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

**Format**: `<type>[optional scope]: <description>`

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code formatting (no logic changes)
- `refactor`: Code restructuring (no feature/bug changes)
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `build`: Build system changes
- `ci`: CI/CD changes
- `chore`: Maintenance tasks

**Scopes** (optional):
- `js`: JavaScript frontend code
- `py`: Python backend/MCP code
- `test`: Testing related
- `terrain`: Terrain rendering system
- `mcp`: MCP client/server
- `ui`: User interface
- `camera`, `materials`, `weather`, `topography`: Specific modules

**Examples**:
```bash
feat(terrain): add real elevation data integration
fix(mcp): resolve undefined class reference error
test(js): add integration tests for runtime error detection
docs: update testing documentation with Biome integration
style(js): format code with Biome
```

#### Breaking Changes
Add `!` after type/scope or include `BREAKING CHANGE:` in footer:
```bash
feat(mcp)!: change elevation data API format
```

### 3. Development Process

```bash
# 1. Create feature branch
git checkout -b feat/your-feature-name

# 2. Make changes and test locally
npm run check:fix    # Fix code quality issues
npm test            # Run unit/integration tests
npm run test:e2e    # Run E2E tests

# 3. Commit with conventional format
git add .
git commit          # Uses template, will be validated

# 4. Push and create PR
git push origin feat/your-feature-name
```

### 4. Pre-commit Hooks (Lefthook)

Automated checks run before each commit:
- **Pre-commit**: Code quality via Biome (`npm run check`)
- **Commit-msg**: Conventional Commits validation via commitlint
- **Pre-push**: Full test suite (unit, E2E, Python tests)

If checks fail, fix issues before committing:
```bash
npm run check:fix   # Auto-fix most issues
git add .
git commit          # Try again
```

**Lefthook Configuration**: See `lefthook.yml` for hook details

### 5. Testing Requirements

All contributions must include appropriate tests:

#### JavaScript Changes
- **Unit tests**: For individual functions/classes
- **Integration tests**: For module interactions
- **E2E tests**: For user-facing features

#### Python Changes
- **Unit tests**: For MCP server functions
- **Integration tests**: For API endpoints
- **Mock tests**: For external service calls

#### Running Tests
```bash
# Full test suite
npm run check && npm run test:all && pytest

# Individual test categories
npm test                    # Unit/integration tests
npm run test:e2e           # E2E tests
pytest                     # Python tests
pytest -m unit             # Python unit tests only
```

## Code Style

### JavaScript
- Use Biome for formatting and linting
- Follow existing patterns in the codebase
- Add JSDoc comments for public APIs
- Use meaningful variable names

### Python
- Follow PEP 8 style guidelines
- Use type hints where appropriate
- Add docstrings for functions and classes
- Use meaningful variable names

## Project Structure

```
ski2/
├── js/                     # Frontend JavaScript modules
├── mcp/                    # Python MCP servers
├── tests/                  # All test files
│   ├── js/                # JavaScript tests
│   └── *.py               # Python tests
├── docs/                   # Documentation
└── config files           # Various config files
```

## Pull Request Process

1. **Branch Naming**: Use conventional format
   - `feat/feature-name`
   - `fix/bug-description`
   - `docs/update-readme`

2. **PR Title**: Use conventional commit format
   - `feat(terrain): add elevation caching system`

3. **PR Description**: Include
   - What changes were made
   - Why changes were needed
   - How to test the changes
   - Any breaking changes

4. **Checklist**:
   - [ ] Code follows style guidelines
   - [ ] Tests pass locally
   - [ ] New tests added for new features
   - [ ] Documentation updated if needed
   - [ ] Commit messages follow conventional format

## Getting Help

- **Issues**: Check existing issues or create new ones
- **Discussions**: Use GitHub Discussions for questions
- **Documentation**: See `README.md`, `TESTING.md`, `TESTING_IMPROVEMENTS.md`

## Release Process

Releases are automated based on conventional commits:
- `feat:` → Minor version bump
- `fix:` → Patch version bump
- `BREAKING CHANGE:` → Major version bump

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Follow the project's technical standards
