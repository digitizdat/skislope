"""MCP (Model Context Protocol) agents for ski terrain rendering.

This package contains specialized MCP agents that provide real-world data
for realistic ski terrain rendering and alpine ski racing applications.

Available agents:
- elevation: Topographical elevation data from multiple sources
- weather: Weather conditions and forecasts for ski resorts
- terrain: Terrain analysis and slope metrics
- equipment: Ski equipment specifications and performance data
"""

__version__ = "1.0.0"
__author__ = "Ski Terrain Rendering Team"

# Import main agents for easy access
from .elevation.server import ElevationDataProvider, server as elevation_server

__all__ = [
    "ElevationDataProvider",
    "elevation_server",
]
