#!/usr/bin/env python3
"""
Convenience script to run the MCP Elevation Server.

This script launches the Model Context Protocol (MCP) server that provides
real topographical elevation data for ski terrain rendering. Supports dual
transport modes for maximum compatibility.

Features:
- Dual transport modes: stdio (AI agents) and HTTP (web browsers)
- True MCP protocol implementation with JSON-RPC
- Real elevation data from Open Topo Data and Open Elevation APIs
- Support for 5 major ski resorts (Chamonix, Whistler, Zermatt, St. Anton, Val d'Isère)
- Intelligent caching and API fallback mechanisms
- Resource and tool interfaces for elevation data access

Usage:
    # stdio mode (default - for AI agents)
    python run_elevation_server.py

    # HTTP mode (for web browsers)
    python run_elevation_server.py --http
    python run_elevation_server.py --http --port 8081

    # Help
    python run_elevation_server.py --help

Note: This is different from server.py which is an HTTP server for the 3D renderer.
This script runs the actual MCP server that can be consumed by MCP clients.
"""

import os
import sys

import click

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import elevation server components
from skislope_mcp.elevation.server import (
    elevation_provider,
    logger,
    run_http_server,
    run_stdio_server,
)


@click.command()
@click.option(
    '--http',
    is_flag=True,
    help='Run in HTTP mode for web browsers (default: stdio mode for AI agents)'
)
@click.option(
    '--port',
    type=int,
    default=8081,
    help='Port for HTTP mode (default: 8081)'
)
@click.option(
    '--verbose',
    '-v',
    is_flag=True,
    help='Enable verbose logging'
)
def main(http, port, verbose):
    """
    MCP Elevation Server - Dual Transport Mode

    Provides real topographical elevation data for ski terrain rendering
    via Model Context Protocol (MCP) with support for both stdio and HTTP transports.
    """
    if verbose:
        import logging
        logging.getLogger().setLevel(logging.DEBUG)

    logger.info("🎿 Starting MCP Elevation Server for Ski Terrain Rendering")

    # Log available ski resorts
    for key, resort in elevation_provider.ski_resorts.items():
        logger.info(f"📍 Available resort: {resort['name']} ({key})")

    if http:
        # Run HTTP server (blocking)
        logger.info(f"🌐 Starting HTTP mode on port {port}")
        run_http_server(port)
    else:
        # Run stdio server (async)
        logger.info("🔌 Starting stdio mode for AI agent integration")
        import asyncio
        asyncio.run(run_stdio_server())


if __name__ == "__main__":
    main()
