# Ski! - 3D Alpine Ski Terrain Rendering System

A specialized 3D terrain rendering system that creates realistic ski slope visualizations using real topographical and environmental data. This project serves as the foundation for alpine ski racing games and ski terrain analysis applications.

## 🎿 Overview

**Ski!** combines cutting-edge 3D rendering with authentic geographical data to create immersive ski slope experiences. The system integrates multiple data sources through Model Context Protocol (MCP) agents to deliver realistic mountain terrain, weather conditions, and equipment interactions.

### Key Features

- **🏔️ Real Topographical Data**: Integration with Open Topo Data and Open Elevation APIs
- **🎮 Interactive 3D Rendering**: WebGL-based terrain visualization with realistic materials
- **🤖 MCP Agent Architecture**: Modular data agents for elevation, weather, terrain, and equipment
- **⛷️ Multi-Resort Support**: Pre-configured data for 5 major ski resorts worldwide
- **🌨️ Environmental Effects**: Snow materials, weather simulation, and lighting
- **🚠 Infrastructure Rendering**: Ski lifts, trees, rocks, and resort facilities
- **📊 Performance Optimized**: Intelligent caching and LOD systems

## 🏗️ Architecture

```
ski2/
├── 📁 mcp/                    # MCP Agent Framework
│   ├── elevation/             # Topographical data agent
│   ├── weather/              # Weather conditions agent (future)
│   ├── terrain/              # Terrain analysis agent (future)
│   └── equipment/            # Equipment specs agent (future)
├── 📁 js/                    # 3D Rendering Engine
│   ├── main.js               # Core application logic
│   ├── terrain.js            # Terrain generation and rendering
│   ├── camera.js             # Camera controls and movement
│   ├── materials.js          # Snow, rock, and vegetation materials
│   └── topography.js         # Real elevation data integration
├── 📁 tests/                 # Comprehensive test suite
├── index.html                # 3D terrain renderer interface
├── server.py                 # HTTP server for development
├── run_elevation_server.py   # MCP elevation server launcher
└── main.py                   # Project entry point
```

## 🚀 Quick Start

### Prerequisites

   ```bash
   git clone <repository-url>
   cd ski2
   npm install
   ```

2. **Development Workflow**
   ```bash
   # Check code quality first
   npm run check:fix
   
   # Run tests
   npm test && npm run test:e2e && pytest
   
   # Lefthook will automatically run hooks on commit/push
   npm run prepare  # Sets up Lefthook git hooks
   ```

3. **Start the Application**
   ```bash
   # Start the HTTP server (includes MCP elevation proxy)
   python server.py
   
   # Open browser to http://localhost:8080
   # Select a ski resort and explore the 3D terrain
   ```

4. **Making Changes**
   ```bash
   # Follow Conventional Commits format
   git commit -m "feat(terrain): add elevation caching"
   
   # Lefthook hooks will automatically validate:
   # - Code quality (pre-commit)
   # - Commit message format (commit-msg)
   # - Full test suite (pre-push)
   ```

### Launch MCP Elevation Server

```bash
# Start the MCP server (for AI applications)
python run_elevation_server.py
```

## 🏔️ Supported Ski Resorts

| Resort | Location | Elevation Range | Terrain Type |
|--------|----------|----------------|--------------|
| **Chamonix-Mont-Blanc** | France | 1,035m - 3,842m | Extreme Alpine |
| **Whistler Blackcomb** | Canada | 652m - 2,284m | Alpine/Nordic |
| **Zermatt Matterhorn** | Switzerland | 1,620m - 3,883m | High Alpine |
| **St. Anton am Arlberg** | Austria | 1,304m - 2,811m | Alpine |
| **Val d'Isère** | France | 1,850m - 3,456m | High Alpine |

## 🎮 Controls

### 3D Terrain Navigation
- **Mouse**: Look around (click and drag)
- **WASD**: Move forward/backward/left/right
- **Space**: Move up
- **Shift**: Move down
- **Scroll**: Zoom in/out
- **R**: Reset camera position

### Resort Selection
- Use the resort selector in the interface
- Real elevation data loads automatically
- Terrain updates dynamically

## 🤖 MCP Agent System

The project uses Model Context Protocol (MCP) agents to provide real-world data:

### Elevation Agent (`mcp/elevation/`)
- **Real topographical data** from multiple APIs
- **Elevation grids** with configurable resolution
- **Caching system** for performance
- **Fallback mechanisms** for reliability

### Future Agents
- **Weather Agent**: Real-time conditions and forecasts
- **Terrain Agent**: Slope analysis and avalanche risk
- **Equipment Agent**: Ski specs and performance data

## 🧪 Testing

Comprehensive test suite with 28+ tests covering:

```bash
# Run all tests
python -m pytest tests/ -v

# Run core functionality tests
python -m pytest tests/test_simple.py tests/test_elevation_provider.py tests/test_mcp_integration.py -v

# Test specific components
python -m pytest tests/test_elevation_provider.py -v  # Data provider tests
python -m pytest tests/test_mcp_integration.py -v     # MCP server tests
```

### Test Coverage
- ✅ **Unit Tests**: Core functionality and data providers
- ✅ **Integration Tests**: MCP protocol compliance
- ✅ **API Tests**: External data source integration
- ✅ **Mock Tests**: Development without external dependencies

## 🛠️ Development

### Project Structure

- **`main.py`**: Project entry point and component launcher
- **`server.py`**: HTTP development server with CORS support
- **`run_elevation_server.py`**: MCP elevation server launcher
- **`index.html`**: 3D terrain renderer interface
- **`mcp/`**: MCP agent framework and data providers
- **`js/`**: WebGL-based 3D rendering engine
- **`tests/`**: Comprehensive test suite

### Adding New Ski Resorts

Edit `mcp/elevation/server.py`:

```python
self.ski_resorts["new_resort"] = {
    "name": "New Resort Name",
    "lat": 46.0000,
    "lon": 7.0000,
    "base_elevation": 1000,
    "peak_elevation": 3000,
    "vertical_drop": 2000,
    "terrain_type": "alpine"
}
```

### Code Quality

```bash
# Format code with ruff
./ruff_format.sh

# Run linting
ruff check .

# Type checking (if using mypy)
mypy mcp/
```

## 📊 Performance

### Optimization Features
- **Intelligent Caching**: Elevation data cached with configurable expiry
- **API Rate Limiting**: Respectful usage of external data sources
- **LOD System**: Level-of-detail for large terrain meshes
- **Batch Processing**: Efficient handling of elevation grids

### Benchmarks
- **Elevation Data Fetch**: ~2-5 seconds for 64x64 grid
- **3D Rendering**: 60 FPS on modern hardware
- **Memory Usage**: <100MB for typical terrain scenes
- **Cache Hit Rate**: >90% for repeated resort access

## 🌐 API Integration

### External Data Sources

1. **Open Topo Data** (Primary)
   - High-resolution ASTER 30m dataset
   - Global coverage with excellent accuracy
   - Rate limited to 1 request/second

2. **Open Elevation** (Fallback)
   - Alternative elevation data source
   - Used when primary source unavailable
   - Supports batch coordinate lookup

### Data Flow
```
3D Renderer → MCP Client → MCP Server → External APIs → Real Elevation Data
```

## 🎯 Use Cases

### Alpine Ski Racing Games
- Realistic slope physics and terrain interaction
- Authentic resort environments
- Performance analysis and training

### Ski Resort Planning
- Terrain analysis and slope assessment
- Infrastructure placement optimization
- Environmental impact visualization

### Educational Applications
- Geography and topography learning
- Mountain environment simulation
- Climate and weather pattern study

### Research and Development
- Ski equipment testing simulation
- Avalanche risk modeling
- Tourism and recreation planning

## 🤝 Contributing

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Add comprehensive tests** for new functionality
4. **Ensure all tests pass**: `pytest tests/ -v`
5. **Format code**: `./ruff_format.sh`
6. **Submit pull request**

### Development Guidelines
- Follow existing code style and patterns
- Add tests for all new functionality
- Update documentation for API changes
- Ensure backward compatibility

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Open Topo Data** for providing free elevation data access
- **MCP Protocol** developers for standardized data interfaces
- **WebGL Community** for 3D rendering techniques
- **Ski Resort Communities** for inspiring realistic terrain rendering

## 🔗 Related Projects

- **MCP Elevation Server**: Standalone topographical data service
- **Alpine Ski Racing**: Full ski racing game implementation
- **Terrain Analysis Tools**: Slope and avalanche risk assessment

---

**Built with ❤️ for the skiing community and 3D graphics enthusiasts**
