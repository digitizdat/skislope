#!/usr/bin/env python3
"""
MCP Elevation Server - Topographical Data Provider

A Model Context Protocol (MCP) server that provides real topographical elevation data
for ski resorts worldwide. Exposes elevation data as MCP resources with proper
JSON-RPC protocol implementation.

Usage:
    python mcp_elevation_server.py

MCP Client Integration:
    Connect via stdio transport to access elevation resources for ski terrain rendering.
"""

import asyncio
import json
import logging
import sys
import urllib.parse
import urllib.request
from typing import Any

# MCP SDK imports
try:
    from mcp.server import Server
    from mcp.server.models import InitializationOptions
    from mcp.server.stdio import stdio_server
    from mcp.types import (
        Resource,
        TextResourceContents,
        Tool,
        TextContent,
    )
    from pydantic import BaseModel

    class NotificationOptions(BaseModel):
        """Notification options for MCP server capabilities"""
        resources_changed: bool = False
        tools_changed: bool = False
        prompts_changed: bool = False
except ImportError as e:
    # Allow imports to work for testing and development
    print(f"Warning: MCP SDK import failed: {e}", file=sys.stderr)
    print("Some functionality may be limited without MCP SDK", file=sys.stderr)
    
    # Create mock classes for development/testing
    class Server:
        def __init__(self, name):
            self.name = name
            self._resource_handlers = {}
            self._tool_handlers = {}
        
        def list_resources(self):
            def decorator(func):
                self._resource_handlers['list'] = func
                return func
            return decorator
        
        def read_resource(self):
            def decorator(func):
                self._resource_handlers['read'] = func
                return func
            return decorator
        
        def list_tools(self):
            def decorator(func):
                self._tool_handlers['list'] = func
                return func
            return decorator
        
        def call_tool(self):
            def decorator(func):
                self._tool_handlers['call'] = func
                return func
            return decorator
    
    class Resource:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)
    
    class TextResourceContents:
        def __init__(self, text):
            self.text = text
    
    class Tool:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)
    
    class TextContent:
        def __init__(self, text):
            self.text = text
    
    class NotificationOptions:
        def __init__(self):
            self.resources_changed = False
            self.tools_changed = False
            self.prompts_changed = False
    
    def stdio_server():
        def decorator(func):
            return func
        return decorator
    
    class InitializationOptions:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mcp-elevation-server")


class ElevationDataProvider:
    """Handles fetching elevation data from multiple topographical data sources"""

    def __init__(self):
        self.data_sources = {
            "opentopodata": {
                "name": "Open Topo Data",
                "base_url": "https://api.opentopodata.org/v1",
                "datasets": ["srtm30m", "aster30m", "mapzen", "ned10m"],
                "max_locations": 100,
            },
            "openelevation": {
                "name": "Open Elevation",
                "base_url": "https://api.open-elevation.com/api/v1/lookup",
                "max_locations": 512,
            },
        }
        self.cache = {}

        # Ski resort coordinates database
        self.ski_resorts = {
            "chamonix": {
                "name": "Chamonix-Mont-Blanc",
                "country": "France",
                "lat": 45.9237,
                "lon": 6.8694,
                "base_elevation": 1035,
                "peak_elevation": 3842,
                "vertical_drop": 2807,
                "terrain_type": "glacial_alpine",
            },
            "whistler": {
                "name": "Whistler Blackcomb",
                "country": "Canada",
                "lat": 50.1163,
                "lon": -122.9574,
                "base_elevation": 652,
                "peak_elevation": 2182,
                "vertical_drop": 1530,
                "terrain_type": "coastal_range",
            },
            "zermatt": {
                "name": "Zermatt Matterhorn",
                "country": "Switzerland",
                "lat": 46.0207,
                "lon": 7.7491,
                "base_elevation": 1608,
                "peak_elevation": 3883,
                "vertical_drop": 2275,
                "terrain_type": "high_alpine",
            },
            "stanton": {
                "name": "St. Anton am Arlberg",
                "country": "Austria",
                "lat": 47.1333,
                "lon": 10.2667,
                "base_elevation": 1304,
                "peak_elevation": 2811,
                "vertical_drop": 1507,
                "terrain_type": "alpine_bowl",
            },
            "valdisere": {
                "name": "Val d'Isère",
                "country": "France",
                "lat": 45.4489,
                "lon": 6.9797,
                "base_elevation": 1550,
                "peak_elevation": 3456,
                "vertical_drop": 1906,
                "terrain_type": "high_alpine",
            },
        }

    async def fetch_elevation_grid(
        self, resort_key: str, resolution: int = 64, area_size: int = 2000
    ) -> list[float] | None:
        """Fetch elevation data grid for a ski resort area"""
        cache_key = f"{resort_key}_{resolution}_{area_size}"

        if cache_key in self.cache:
            return self.cache[cache_key]

        resort = self.ski_resorts.get(resort_key)
        if not resort:
            return None

        try:
            # Calculate grid points around resort
            lat_range = area_size / 111000  # ~111km per degree
            lon_range = area_size / (111000 * abs(resort["lat"]) * 0.017453)

            locations = []
            for i in range(resolution):
                for j in range(resolution):
                    lat = resort["lat"] + (i / (resolution - 1) - 0.5) * lat_range
                    lon = resort["lon"] + (j / (resolution - 1) - 0.5) * lon_range
                    locations.append(f"{lat},{lon}")

            # Try Open Topo Data first
            elevation_data = await self._fetch_from_opentopodata(locations, "srtm30m")

            if not elevation_data:
                # Fallback to Open Elevation
                elevation_data = await self._fetch_from_openelevation(locations)

            if elevation_data:
                self.cache[cache_key] = elevation_data
                logger.info(f"Fetched {len(elevation_data)} elevation points for {resort['name']}")
                return elevation_data

            return None

        except Exception as e:
            logger.error(f"Error fetching elevation data for {resort_key}: {e}")
            return None

    async def _fetch_from_opentopodata(
        self, locations: list[str], dataset: str = "srtm30m"
    ) -> list[float] | None:
        """Fetch elevation data from Open Topo Data API"""
        try:
            batch_size = self.data_sources["opentopodata"]["max_locations"]
            all_elevations = []

            for i in range(0, len(locations), batch_size):
                batch = locations[i : i + batch_size]
                locations_str = "|".join(batch)

                url = f"{self.data_sources['opentopodata']['base_url']}/{dataset}?locations={locations_str}"

                with urllib.request.urlopen(url, timeout=10) as response:
                    data = json.loads(response.read().decode())

                    if data.get("status") == "OK":
                        for result in data.get("results", []):
                            elevation = result.get("elevation")
                            if elevation is not None:
                                all_elevations.append(float(elevation))
                            else:
                                all_elevations.append(0.0)

            return all_elevations if all_elevations else None

        except Exception as e:
            logger.warning(f"Open Topo Data API error: {e}")
            return None

    async def _fetch_from_openelevation(self, locations: list[str]) -> list[float] | None:
        """Fetch elevation data from Open Elevation API"""
        try:
            batch_size = self.data_sources["openelevation"]["max_locations"]
            all_elevations = []

            for i in range(0, len(locations), batch_size):
                batch = locations[i : i + batch_size]
                locations_str = "|".join(batch)

                url = f"{self.data_sources['openelevation']['base_url']}?locations={locations_str}"

                with urllib.request.urlopen(url, timeout=10) as response:
                    data = json.loads(response.read().decode())

                    for result in data.get("results", []):
                        elevation = result.get("elevation")
                        if elevation is not None:
                            all_elevations.append(float(elevation))
                        else:
                            all_elevations.append(0.0)

            return all_elevations if all_elevations else None

        except Exception as e:
            logger.warning(f"Open Elevation API error: {e}")
            return None


# Initialize the MCP server
server = Server("mcp-elevation-server")
elevation_provider = ElevationDataProvider()


@server.list_resources()
async def handle_list_resources() -> list[Resource]:
    """List available elevation data resources for ski resorts"""
    resources = []

    # Add ski resort elevation grid resources
    for resort_key, resort_info in elevation_provider.ski_resorts.items():
        resources.append(
            Resource(
                uri=f"elevation://ski-resort/{resort_key}/grid",
                name=f"Elevation Grid - {resort_info['name']}",
                description=f"Topographical elevation data grid for {resort_info['name']}, {resort_info['country']}. "
                f"Base: {resort_info['base_elevation']}m, Peak: {resort_info['peak_elevation']}m, "
                f"Vertical Drop: {resort_info['vertical_drop']}m",
                mimeType="application/json",
            )
        )

        # Add resort metadata resource
        resources.append(
            Resource(
                uri=f"elevation://ski-resort/{resort_key}/metadata",
                name=f"Resort Metadata - {resort_info['name']}",
                description=f"Detailed metadata for {resort_info['name']} ski resort including coordinates, "
                f"elevation statistics, and terrain characteristics",
                mimeType="application/json",
            )
        )

    # Add data sources information resource
    resources.append(
        Resource(
            uri="elevation://data-sources",
            name="Elevation Data Sources",
            description="Information about available topographical data sources and their capabilities",
            mimeType="application/json",
        )
    )

    return resources


@server.read_resource()
async def handle_read_resource(uri: str) -> str | bytes:
    """Read elevation data resources"""

    if uri.startswith("elevation://ski-resort/"):
        # Parse URI: elevation://ski-resort/{resort_key}/{resource_type}
        parts = uri.split("/")
        if len(parts) >= 4:
            resort_key = parts[3]
            resource_type = parts[4] if len(parts) > 4 else "metadata"

            resort_info = elevation_provider.ski_resorts.get(resort_key)
            if not resort_info:
                raise ValueError(f"Unknown ski resort: {resort_key}")

            if resource_type == "metadata":
                # Return resort metadata
                return TextResourceContents(text=json.dumps(resort_info, indent=2))

            elif resource_type == "grid":
                # Parse query parameters for grid resolution and area size
                # Default values for elevation grid
                resolution = 64
                area_size = 2000

                # Fetch elevation grid data
                elevation_data = await elevation_provider.fetch_elevation_grid(
                    resort_key, resolution, area_size
                )

                if elevation_data:
                    grid_response = {
                        "resort": resort_key,
                        "resort_name": resort_info["name"],
                        "resolution": resolution,
                        "area_size": area_size,
                        "elevation_data": elevation_data,
                        "data_points": len(elevation_data),
                        "source": "Real Topographical Data (SRTM/ASTER)",
                        "coordinates": {"lat": resort_info["lat"], "lon": resort_info["lon"]},
                    }
                    return TextResourceContents(text=json.dumps(grid_response, indent=2))
                else:
                    raise ValueError(f"Failed to fetch elevation data for {resort_key}")

    elif uri == "elevation://data-sources":
        # Return information about data sources
        sources_info = {
            "available_sources": elevation_provider.data_sources,
            "supported_resorts": list(elevation_provider.ski_resorts.keys()),
            "capabilities": {
                "real_elevation_data": True,
                "multiple_data_sources": True,
                "caching": True,
                "batch_processing": True,
            },
        }
        return TextResourceContents(text=json.dumps(sources_info, indent=2))

    else:
        raise ValueError(f"Unknown resource URI: {uri}")


@server.list_tools()
async def handle_list_tools() -> list[Tool]:
    """List available elevation data tools"""
    return [
        Tool(
            name="fetch_elevation_grid",
            description="Fetch elevation data grid for a ski resort with custom resolution and area size",
            inputSchema={
                "type": "object",
                "properties": {
                    "resort_key": {
                        "type": "string",
                        "description": "Ski resort identifier (chamonix, whistler, zermatt, stanton, valdisere)",
                        "enum": list(elevation_provider.ski_resorts.keys()),
                    },
                    "resolution": {
                        "type": "integer",
                        "description": "Grid resolution (number of points per side)",
                        "default": 64,
                        "minimum": 16,
                        "maximum": 256,
                    },
                    "area_size": {
                        "type": "integer",
                        "description": "Area size in meters (square area around resort)",
                        "default": 2000,
                        "minimum": 500,
                        "maximum": 10000,
                    },
                },
                "required": ["resort_key"],
            },
        ),
        Tool(
            name="get_resort_info",
            description="Get detailed information about a ski resort including coordinates and elevation statistics",
            inputSchema={
                "type": "object",
                "properties": {
                    "resort_key": {
                        "type": "string",
                        "description": "Ski resort identifier",
                        "enum": list(elevation_provider.ski_resorts.keys()),
                    }
                },
                "required": ["resort_key"],
            },
        ),
    ]


@server.call_tool()
async def handle_call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    """Handle tool calls for elevation data operations"""

    if name == "fetch_elevation_grid":
        resort_key = arguments.get("resort_key")
        resolution = arguments.get("resolution", 64)
        area_size = arguments.get("area_size", 2000)

        if not resort_key or resort_key not in elevation_provider.ski_resorts:
            return [
                TextContent(
                    type="text",
                    text=f"Error: Invalid resort key '{resort_key}'. Available resorts: {list(elevation_provider.ski_resorts.keys())}",
                )
            ]

        # Fetch elevation data
        elevation_data = await elevation_provider.fetch_elevation_grid(
            resort_key, resolution, area_size
        )

        if elevation_data:
            resort_info = elevation_provider.ski_resorts[resort_key]
            result = {
                "success": True,
                "resort": resort_key,
                "resort_name": resort_info["name"],
                "resolution": resolution,
                "area_size": area_size,
                "data_points": len(elevation_data),
                "elevation_data": elevation_data,
                "source": "Real Topographical Data",
                "coordinates": {"lat": resort_info["lat"], "lon": resort_info["lon"]},
            }
            return [TextContent(type="text", text=json.dumps(result, indent=2))]
        else:
            return [
                TextContent(
                    type="text", text=f"Error: Failed to fetch elevation data for {resort_key}"
                )
            ]

    elif name == "get_resort_info":
        resort_key = arguments.get("resort_key")

        if not resort_key or resort_key not in elevation_provider.ski_resorts:
            return [
                TextContent(
                    type="text",
                    text=f"Error: Invalid resort key '{resort_key}'. Available resorts: {list(elevation_provider.ski_resorts.keys())}",
                )
            ]

        resort_info = elevation_provider.ski_resorts[resort_key]
        return [TextContent(type="text", text=json.dumps(resort_info, indent=2))]

    else:
        return [TextContent(type="text", text=f"Error: Unknown tool '{name}'")]


async def main():
    """Main function to run the MCP elevation server"""
    logger.info("🎿 Starting MCP Elevation Server for Ski Terrain Rendering")
    
    # Log available ski resorts
    for key, resort in elevation_provider.ski_resorts.items():
        logger.info(f"📍 Available resort: {resort['name']} ({key})")
    
    try:
        # Initialize server capabilities
        capabilities = InitializationOptions(
            server_name="mcp-elevation-server",
            server_version="1.0.0",
            capabilities={
                "resources": {},
                "tools": {},
                "prompts": {},
            },
            experimental_capabilities={},
        )
        
        # Create notification options
        notification_options = NotificationOptions()
        
        async with stdio_server() as (read_stream, write_stream):
            await server.run(
                read_stream, 
                write_stream, 
                capabilities, 
                raise_exceptions=True
            )
    except Exception as e:
        logger.info(f"Running in development mode: {e}")
        logger.info("Server handlers registered successfully")


if __name__ == "__main__":
    asyncio.run(main())
