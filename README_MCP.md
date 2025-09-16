# MCP Elevation Server for Ski Terrain Rendering

This project implements a Model Context Protocol (MCP) server that provides real topographical elevation data for realistic 3D ski terrain rendering. The server integrates with multiple external APIs to deliver comprehensive elevation datasets for major ski resorts worldwide.

## Overview

The MCP Elevation Server acts as a bridge between ski terrain rendering applications and real-world topographical data sources. It exposes elevation data through the standardized MCP protocol, allowing AI applications and terrain renderers to access authentic mountain terrain data.

### Key Features

- **Real Topographical Data**: Integration with Open Topo Data and Open Elevation APIs
- **Multiple Ski Resorts**: Pre-configured data for Chamonix, Whistler, Zermatt, St. Anton, and Val d'Isère
- **MCP Protocol Compliance**: Full implementation of MCP resource and tool interfaces
- **Caching System**: Intelligent caching to minimize API calls and improve performance
- **Fallback Mechanisms**: Automatic failover between data sources for reliability
- **Modular Architecture**: Organized MCP agents under structured directory layout

## Architecture

The project is organized with a modular MCP agent architecture:

```
mcp/
├── __init__.py                 # Main MCP package
├── elevation/                  # Elevation data agent
│   ├── __init__.py
│   └── server.py              # MCP elevation server
├── weather/                   # Weather data agent (future)
├── terrain/                   # Terrain analysis agent (future)
└── equipment/                 # Equipment data agent (future)
```

### Components

1. **ElevationDataProvider**: Core class handling API integration and data management
2. **MCP Server**: Protocol implementation with resource and tool handlers
3. **External API Integration**: Open Topo Data and Open Elevation API clients
4. **Caching Layer**: In-memory caching with configurable expiry

## Installation

### Prerequisites

- Python 3.11+
- MCP SDK: `pip install mcp` (optional for development)
- Required packages: `pip install -r requirements.txt`

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd ski2

# Install dependencies
pip install -r requirements.txt

# Run the MCP elevation server
python run_elevation_server.py
const mcpClient = new MCPElevationClient();
await mcpClient.initialize();

// Fetch elevation data for Chamonix
const elevationData = await mcpClient.fetchElevationData('chamonix', 128, 2000);

// Get resort information
const resortInfo = await mcpClient.callTool('get_resort_info', {
    resort_key: 'chamonix'
});
```

## Data Sources

- **Open Topo Data**: SRTM 30m, ASTER 30m, NED 10m datasets
- **Open Elevation**: Global elevation data with 30m resolution
- **Caching**: Intelligent caching to minimize API calls
- **Fallback**: Enhanced synthetic data when APIs unavailable

This MCP server provides a standardized, reusable interface for accessing real topographical data across multiple ski terrain applications.
