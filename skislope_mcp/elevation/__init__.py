"""Elevation data MCP agent for ski terrain rendering.

This module provides real topographical elevation data through a Model Context Protocol
server, integrating with multiple external APIs for comprehensive terrain data.
"""

from .server import ElevationDataProvider, elevation_provider, server

__all__ = [
    "ElevationDataProvider",
    "server",
    "elevation_provider",
]
