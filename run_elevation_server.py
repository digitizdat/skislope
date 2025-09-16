#!/usr/bin/env python3
"""
Convenience script to run the MCP Elevation Server.

This script launches the true Model Context Protocol (MCP) server that provides
real topographical elevation data for ski terrain rendering. The server exposes
elevation data through standardized MCP resources and tools.

Features:
- True MCP protocol implementation with JSON-RPC over stdio
- Real elevation data from Open Topo Data and Open Elevation APIs
- Support for 5 major ski resorts (Chamonix, Whistler, Zermatt, St. Anton, Val d'Isère)
- Intelligent caching and API fallback mechanisms
- Resource and tool interfaces for elevation data access

Usage:
    python run_elevation_server.py

Note: This is different from server.py which is an HTTP server for the 3D renderer.
This script runs the actual MCP server that can be consumed by MCP clients.

For development without MCP SDK:
    The server includes mock classes and will run in development mode
    if the full MCP SDK is not installed.
"""

import sys
import os

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import and run the elevation server
from mcp.elevation.server import main

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
