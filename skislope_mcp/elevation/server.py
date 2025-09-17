#!/usr/bin/env python3
"""
MCP Elevation Server - Topographical Data Provider

A Model Context Protocol (MCP) server that provides real topographical elevation data
for ski resorts worldwide. Supports dual transport modes:

1. stdio mode: Standard MCP protocol over stdin/stdout for AI agent integration
2. http mode: HTTP JSON-RPC server for browser/web client integration

Usage:
    # stdio mode (default - for AI agents)
    python mcp_elevation_server.py

    # HTTP mode (for web browsers)
    python mcp_elevation_server.py --http --port 8081

MCP Client Integration:
    - stdio: Connect via stdio transport for AI agents
    - HTTP: POST JSON-RPC requests to http://localhost:8081/mcp
"""

import argparse
import asyncio
import http.server
import json
import logging
import random
import threading
import time
import urllib.parse
import urllib.request
from datetime import datetime
from http.server import ThreadingHTTPServer
from typing import Any

from pydantic import BaseModel

# MCP SDK imports - Required for MCP server functionality
try:
    from mcp.server import Server
    from mcp.server.models import InitializationOptions
    from mcp.server.stdio import stdio_server
    from mcp.types import (
        Resource,
        TextContent,
        TextResourceContents,
        Tool,
    )
    MCP_AVAILABLE = True
except ImportError:
    # Mock classes for development without MCP SDK
    MCP_AVAILABLE = False

    class Server:
        def __init__(self, name, version):
            self.name = name
            self.version = version

    class Resource:
        pass

    class TextContent:
        def __init__(self, text):
            self.text = text

    class Tool:
        pass

    class TextResourceContents:
        pass


class NotificationOptions(BaseModel):
    """Notification options for MCP server capabilities"""
    resources_changed: bool = False
    tools_changed: bool = False
    prompts_changed: bool = False

# Configure logging with millisecond-level ISO 8601 timestamps
class MillisecondFormatter(logging.Formatter):
    def formatTime(self, record, datefmt=None):
        dt = datetime.fromtimestamp(record.created)
        return dt.isoformat(timespec='milliseconds')

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)

# Apply millisecond formatter to all handlers
for handler in logging.root.handlers:
    handler.setFormatter(MillisecondFormatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    ))

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
                "rate_limit_delay": 1.0,  # Minimum seconds between requests
                "max_retries": 3,
                "backoff_factor": 2.0,
            },
            "openelevation": {
                "name": "Open Elevation",
                "base_url": "https://api.open-elevation.com/api/v1/lookup",
                "max_locations": 512,
                "rate_limit_delay": 0.5,
                "max_retries": 3,
                "backoff_factor": 1.5,
            },
        }
        self.cache = {}
        self.last_request_time = {"opentopodata": 0, "openelevation": 0}
        self.progress_callbacks = {}  # Store progress callbacks by request ID
        self.request_counter = 0
        self.request_lock = threading.Lock()

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

    def _get_request_id(self):
        """Generate unique request ID for progress tracking"""
        with self.request_lock:
            self.request_counter += 1
            return f"req_{self.request_counter}_{int(time.time() * 1000)}"

    def _update_progress(self, request_id, current, total, message=""):
        """Update progress for a request"""
        progress = (current / total) * 100 if total > 0 else 0
        logger.info(f"📊 Progress [{request_id}]: {current}/{total} ({progress:.1f}%) {message}")

        # Store progress info for potential client polling
        self.progress_callbacks[request_id] = {
            "current": current,
            "total": total,
            "progress": progress,
            "message": message,
            "timestamp": datetime.now().isoformat(timespec='milliseconds')
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
            # Progress tracking request id for async path
            request_id = self._get_request_id()
            # Calculate grid points around resort
            lat_range = area_size / 111000  # ~111km per degree
            lon_range = area_size / (111000 * abs(resort["lat"]) * 0.017453)

            locations = []
            for i in range(resolution):
                for j in range(resolution):
                    lat = resort["lat"] + (i / (resolution - 1) - 0.5) * lat_range
                    lon = resort["lon"] + (j / (resolution - 1) - 0.5) * lon_range
                    locations.append(f"{lat},{lon}")

            # Initialize progress tracking
            self.progress_callbacks[request_id] = {
                "current": 0,
                "total": len(locations),
                "progress": 0,
                "message": "Starting elevation data fetch",
                "timestamp": datetime.now().isoformat(timespec='milliseconds')
            }

            self._update_progress(request_id, 0, len(locations), "Fetching from Open Topo Data API")
            logger.info(f"🌍 Trying Open Topo Data API for {len(locations)} locations [{request_id}]")
            elevations = await self._fetch_from_opentopodata(locations, request_id)

            if elevations is None:
                # Fallback to Open Elevation
                self._update_progress(request_id, 0, len(locations), "Falling back to Open Elevation API")
                logger.info(f"🌍 Falling back to Open Elevation API for {len(locations)} locations [{request_id}]")
                elevations = await self._fetch_from_openelevation(locations, request_id)

                if elevations:
                    self.cache[cache_key] = elevations
                    self._update_progress(request_id, len(locations), len(locations), "Elevation fetch completed successfully")
                    logger.info(f"✅ Successfully fetched {len(elevations)} elevation points [{request_id}]")
                    # Clean up progress tracking
                    if request_id in self.progress_callbacks:
                        del self.progress_callbacks[request_id]
                    return elevations
                else:
                    self._update_progress(request_id, 0, len(locations), "Failed to fetch elevation data")
                    logger.warning(f"❌ Failed to fetch elevation data from all sources [{request_id}]")
                    # Clean up progress tracking
                    if request_id in self.progress_callbacks:
                        del self.progress_callbacks[request_id]
                    return None

        except Exception as e:
            logger.error(f"Error fetching elevation data for {resort_key}: {e}")
            return None

    async def _fetch_from_opentopodata(
        self, locations: list[str], request_id=None, dataset="srtm30m"
    ) -> list[float] | None:
        """Fetch elevation data from Open Topo Data API"""
        try:
            batch_size = self.data_sources["opentopodata"]["max_locations"]
            all_elevations = []

            batch_count = (len(locations) + batch_size - 1) // batch_size
            for batch_idx, i in enumerate(range(0, len(locations), batch_size)):
                batch = locations[i : i + batch_size]
                locations_str = "|".join(batch)

                url = f"{self.data_sources['opentopodata']['base_url']}/{dataset}?locations={locations_str}"

                if request_id:
                    self._update_progress(request_id, len(all_elevations), len(locations),
                                        f"Processing batch {batch_idx + 1}/{batch_count} (Open Topo Data)")

                # Implement rate limiting and retry logic
                success = False
                for attempt in range(self.data_sources['opentopodata']['max_retries']):
                    try:
                        # Rate limiting: ensure minimum delay between requests
                        current_time = time.time()
                        time_since_last = current_time - self.last_request_time["opentopodata"]
                        min_delay = self.data_sources['opentopodata']['rate_limit_delay']

                        if time_since_last < min_delay:
                            sleep_time = min_delay - time_since_last
                            logger.info(f"⏱️ Rate limiting: waiting {sleep_time:.1f}s before next request")
                            time.sleep(sleep_time)

                        self.last_request_time["opentopodata"] = time.time()

                        with urllib.request.urlopen(url, timeout=15) as response:
                            data = json.loads(response.read().decode())

                            if data.get("status") == "OK":
                                for result in data.get("results", []):
                                    elevation = result.get("elevation")
                                    if elevation is not None:
                                        all_elevations.append(float(elevation))
                                    else:
                                        all_elevations.append(0.0)
                                success = True
                                break
                            else:
                                logger.warning(f"API returned status: {data.get('status')}")

                    except urllib.error.HTTPError as e:
                        if e.code == 429:  # Too Many Requests
                            backoff_time = (self.data_sources['opentopodata']['backoff_factor'] ** attempt) + random.uniform(0, 1)
                            logger.warning(f"🚫 Rate limited (attempt {attempt + 1}/{self.data_sources['opentopodata']['max_retries']}). Backing off for {backoff_time:.1f}s")
                            if attempt < self.data_sources['opentopodata']['max_retries'] - 1:
                                time.sleep(backoff_time)
                            continue
                        else:
                            logger.warning(f"HTTP error {e.code}: {e.reason}")
                            break
                    except Exception as e:
                        logger.warning(f"Request error: {e}")
                        break

                if not success:
                    # Fill with zeros for failed batch
                    logger.warning(f"❌ Failed to fetch batch after {self.data_sources['opentopodata']['max_retries']} attempts, using zeros")
                    all_elevations.extend([0.0] * len(batch))

            return all_elevations if all_elevations else None

        except Exception as e:
            logger.warning(f"Open Topo Data API error: {e}")
            return None

    async def _fetch_from_openelevation(self, locations: list[str], request_id=None) -> list[float] | None:
        """Fetch elevation data from Open Elevation API"""
        try:
            batch_size = self.data_sources["openelevation"]["max_locations"]
            all_elevations = []

            batch_count = (len(locations) + batch_size - 1) // batch_size
            for batch_idx, i in enumerate(range(0, len(locations), batch_size)):
                batch = locations[i : i + batch_size]
                locations_str = "|".join(batch)

                url = f"{self.data_sources['openelevation']['base_url']}?locations={locations_str}"

                if request_id:
                    self._update_progress(request_id, len(all_elevations), len(locations),
                                        f"Processing batch {batch_idx + 1}/{batch_count} (Open Elevation)")

                # Implement rate limiting and retry logic
                success = False
                for attempt in range(self.data_sources['openelevation']['max_retries']):
                    try:
                        # Rate limiting: ensure minimum delay between requests
                        current_time = time.time()
                        time_since_last = current_time - self.last_request_time["openelevation"]
                        min_delay = self.data_sources['openelevation']['rate_limit_delay']

                        if time_since_last < min_delay:
                            sleep_time = min_delay - time_since_last
                            logger.info(f"⏱️ Rate limiting: waiting {sleep_time:.1f}s before next request")
                            time.sleep(sleep_time)

                        self.last_request_time["openelevation"] = time.time()

                        with urllib.request.urlopen(url, timeout=15) as response:
                            data = json.loads(response.read().decode())

                            for result in data.get("results", []):
                                elevation = result.get("elevation")
                                if elevation is not None:
                                    all_elevations.append(float(elevation))
                                else:
                                    all_elevations.append(0.0)
                            success = True
                            break

                    except urllib.error.HTTPError as e:
                        if e.code == 429:  # Too Many Requests
                            backoff_time = (self.data_sources['openelevation']['backoff_factor'] ** attempt) + random.uniform(0, 1)
                            logger.warning(f"🚫 Rate limited (attempt {attempt + 1}/{self.data_sources['openelevation']['max_retries']}). Backing off for {backoff_time:.1f}s")
                            if attempt < self.data_sources['openelevation']['max_retries'] - 1:
                                time.sleep(backoff_time)
                            continue
                        elif e.code == 414:  # URI Too Large
                            logger.warning(f"❌ URI too large for batch of {len(batch)} locations, skipping")
                            break
                        else:
                            logger.warning(f"HTTP error {e.code}: {e.reason}")
                            break
                    except Exception as e:
                        logger.warning(f"Request error: {e}")
                        break

                if not success:
                    # Fill with zeros for failed batch
                    logger.warning(f"❌ Failed to fetch batch after {self.data_sources['openelevation']['max_retries']} attempts, using zeros")
                    all_elevations.extend([0.0] * len(batch))

            return all_elevations if all_elevations else None

        except Exception as e:
            logger.warning(f"Open Elevation API error: {e}")
            return None

    def fetch_elevation_grid_sync(self, resort_coords, resolution=16, area_size=1000, request_id=None):
        """Synchronous version of fetch_elevation_grid for HTTP server with detailed logging"""
        if request_id is None:
            request_id = self._get_request_id()
        start_t = time.perf_counter()
        total_points = resolution * resolution
        cache_key = f"{resort_coords['lat']},{resort_coords['lon']},{resolution},{area_size}"
        logger.info(
            f"🎿 [req={request_id}] Starting sync elevation fetch: lat={resort_coords['lat']}, lon={resort_coords['lon']}, "
            f"resolution={resolution} ({total_points} pts), area_size={area_size}m"
        )

        # Initialize progress at 0% immediately so the client can display progress right away
        self._update_progress(request_id, 0, total_points, "Starting elevation data fetch")

        if cache_key in self.cache:
            logger.info(f"📦 [req={request_id}] Using cached elevation data for {cache_key}")
            return self.cache[cache_key]

        try:
            # Calculate grid points
            grid_t0 = time.perf_counter()
            lat_range = area_size / 111000  # ~111km per degree
            lon_range = area_size / (111000 * abs(resort_coords["lat"]) * 0.017453)

            locations = []
            for i in range(resolution):
                for j in range(resolution):
                    lat = resort_coords["lat"] + (i / (resolution - 1) - 0.5) * lat_range
                    lon = resort_coords["lon"] + (j / (resolution - 1) - 0.5) * lon_range
                    locations.append(f"{lat},{lon}")
            grid_elapsed = (time.perf_counter() - grid_t0) * 1000.0
            logger.info(f"🧭 [req={request_id}] Grid generated: {len(locations)} points in {grid_elapsed:.1f} ms")

            # Try Open Topo Data first (synchronous)
            batch_size = self.data_sources["opentopodata"]["max_locations"]
            batch_count = (len(locations) + batch_size - 1) // batch_size
            all_elevations = []

            for batch_index, i in enumerate(range(0, len(locations), batch_size), start=1):
                batch = locations[i : i + batch_size]
                locations_str = "|".join(batch)
                url = f"{self.data_sources['opentopodata']['base_url']}/srtm30m?locations={locations_str}"
                logger.info(
                    f"📦 [req={request_id}] Batch {batch_index}/{batch_count} start: size={len(batch)}, url_len={len(url)}"
                )

                # Implement rate limiting and retry logic for sync version
                success = False
                for attempt in range(self.data_sources['opentopodata']['max_retries']):
                    try:
                        # Rate limiting: ensure minimum delay between requests
                        current_time = time.time()
                        time_since_last = current_time - self.last_request_time["opentopodata"]
                        min_delay = self.data_sources['opentopodata']['rate_limit_delay']

                        if time_since_last < min_delay:
                            sleep_time = min_delay - time_since_last
                            logger.info(f"⏳ [req={request_id}] Sleeping {sleep_time:.2f}s to respect rate limit")
                            time.sleep(sleep_time)

                        self.last_request_time["opentopodata"] = time.time()
                        net_t0 = time.perf_counter()
                        with urllib.request.urlopen(url, timeout=20) as response:
                            raw = response.read()
                            data = json.loads(raw.decode())
                            net_elapsed = (time.perf_counter() - net_t0) * 1000.0
                            logger.info(
                                f"🌐 [req={request_id}] HTTP {getattr(response, 'status', '200')} in {net_elapsed:.1f} ms, bytes={len(raw)}"
                            )

                            if data.get("status") == "OK":
                                for result in data.get("results", []):
                                    elevation = result.get("elevation")
                                    if elevation is not None:
                                        all_elevations.append(float(elevation))
                                    else:
                                        all_elevations.append(0.0)
                                logger.info(
                                    f"✅ [req={request_id}] Batch {batch_index}/{batch_count} ok. "
                                    f"batch_pts={len(batch)}, total_pts={len(all_elevations)}/{len(locations)}"
                                )
                                # Progress update
                                self._update_progress(
                                    request_id,
                                    len(all_elevations),
                                    len(locations),
                                    f"Processed batch {batch_index}/{batch_count}"
                                )
                                success = True
                                break
                            else:
                                logger.warning(f"⚠️ [req={request_id}] API returned status: {data.get('status')}")

                    except urllib.error.HTTPError as e:
                        if e.code == 429:  # Too Many Requests
                            backoff_time = (self.data_sources['opentopodata']['backoff_factor'] ** attempt) + random.uniform(0, 1)
                            logger.warning(
                                f"🚫 [req={request_id}] Rate limited (attempt {attempt + 1}/"
                                f"{self.data_sources['opentopodata']['max_retries']}). Backing off {backoff_time:.2f}s"
                            )
                            if attempt < self.data_sources['opentopodata']['max_retries'] - 1:
                                time.sleep(backoff_time)
                            continue
                        else:
                            logger.warning(f"HTTP error {e.code}: {e.reason}")
                            break
                    except Exception as api_error:
                        logger.warning(f"Request error: {api_error}")
                        break

                if not success:
                    # Fill with zeros for failed batch
                    logger.warning(f"❌ [req={request_id}] Failed batch {batch_index}/{batch_count}, using zeros")
                    all_elevations.extend([0.0] * len(batch))
                    # Progress update even on failure
                    self._update_progress(
                        request_id,
                        len(all_elevations),
                        len(locations),
                        f"Failed batch {batch_index}/{batch_count} (zeros inserted)"
                    )

            if all_elevations:
                self.cache[cache_key] = all_elevations
                total_elapsed = (time.perf_counter() - start_t) * 1000.0
                logger.info(
                    f"🏁 [req={request_id}] Completed sync elevation fetch: points={len(all_elevations)} in {total_elapsed:.1f} ms"
                )
                # Mark progress complete and retain record for client to observe 100%
                self._update_progress(
                    request_id,
                    len(all_elevations),
                    len(locations),
                    "Elevation fetch completed successfully"
                )
                return all_elevations

            logger.warning(f"⚠️ [req={request_id}] No elevations collected")
            return None

        except Exception as e:
            logger.error(f"Sync elevation fetch error: {e}")
            # Return synthetic elevation data as fallback
            logger.info(f"🏔️ [req={request_id}] Generating synthetic elevation data as fallback")
            return self._generate_synthetic_elevation_data(resort_coords, resolution)

    def _generate_synthetic_elevation_data(self, resort_coords, resolution):
        """Generate synthetic elevation data based on resort characteristics"""
        base_elevation = resort_coords.get('base_elevation', 1000)
        peak_elevation = resort_coords.get('peak_elevation', 2000)

        elevations = []
        for i in range(resolution * resolution):
            # Create a simple gradient with some randomness
            progress = i / (resolution * resolution)
            elevation = base_elevation + (peak_elevation - base_elevation) * progress
            # Add some realistic variation
            variation = random.uniform(-50, 50)
            elevations.append(max(base_elevation, elevation + variation))

        return elevations


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
                return TextResourceContents(uri=uri, text=json.dumps(resort_info, indent=2))

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
                    return TextResourceContents(uri=uri, text=json.dumps(grid_response, indent=2))
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
        return TextResourceContents(uri=uri, text=json.dumps(sources_info, indent=2))

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





class MCPHTTPHandler(http.server.BaseHTTPRequestHandler):
    """HTTP handler for MCP JSON-RPC requests"""

    def do_POST(self):
        """Handle POST requests for MCP JSON-RPC"""
        try:
            if self.path == "/mcp":
                self._handle_mcp_request()
            else:
                self._send_error(404, "Not Found")
        except Exception as e:
            logger.error(f"HTTP handler error: {e}")
            self._send_error(500, "Internal Server Error")

    def _handle_mcp_request(self):
        """Handle MCP JSON-RPC request"""
        try:
            start_t = time.perf_counter()
            content_length = int(self.headers.get('Content-Length', 0))
            request_body = self.rfile.read(content_length).decode('utf-8')
            logger.info(f"📨 Received MCP request: {request_body[:200]}...")

            request_data = json.loads(request_body)
            response_data = self.handle_mcp_request_sync(request_data)

            # Send response
            response_json = json.dumps(response_data)
            logger.info(f"📤 Sending MCP response: {response_json[:200]}...")

            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(response_json)))
            self.end_headers()
            self.wfile.write(response_json.encode())
            elapsed = (time.perf_counter() - start_t) * 1000.0
            logger.info(f"⏱️ MCP request handled in {elapsed:.1f} ms for path {self.path}")

        except Exception as e:
            logger.error(f"MCP request handling error: {e}")
            self._send_error(500, f"MCP request error: {str(e)}")

    def do_GET(self):
        """Handle GET requests for progress polling"""
        try:
            if self.path.startswith("/progress/"):
                request_id = self.path.split("/")[-1]
                self._handle_progress_request(request_id)
            else:
                self._send_error(404, "Not Found")
        except Exception as e:
            logger.error(f"HTTP handler error: {e}")
            self._send_error(500, "Internal Server Error")

    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        logger.info(f"🔄 CORS preflight request for {self.path}")
        self.send_response(200)
        self._send_cors_headers()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _handle_progress_request(self, request_id):
        """Handle progress polling request"""
        logger.info(f"📊 Progress request for {request_id}")

        if request_id in elevation_provider.progress_callbacks:
            progress_data = elevation_provider.progress_callbacks[request_id]
            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json")
            response_json = json.dumps(progress_data)
            self.send_header("Content-Length", str(len(response_json)))
            self.end_headers()
            self.wfile.write(response_json.encode())
        else:
            # Request not found or completed
            self.send_response(404)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json")
            error_response = {
                "error": "Request not found or completed",
                "request_id": request_id
            }
            response_json = json.dumps(error_response)
            self.send_header("Content-Length", str(len(response_json)))
            self.end_headers()
            self.wfile.write(response_json.encode())

    def _send_error(self, code, message):
        """Send HTTP error response"""
        self.send_response(code)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json")
        error_response = {"error": {"code": code, "message": message}}
        response_json = json.dumps(error_response)
        self.send_header("Content-Length", str(len(response_json)))
        self.end_headers()
        self.wfile.write(response_json.encode())

    def _send_cors_headers(self):
        """Send CORS headers for browser compatibility"""
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
        self.send_header("Access-Control-Max-Age", "86400")  # Cache preflight for 24 hours
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")

    async def handle_mcp_request(self, request_data):
        """Handle MCP JSON-RPC request and return response"""
        method = request_data.get('method')
        params = request_data.get('params', {})
        request_id = request_data.get('id')

        try:
            if method == 'resources/list':
                resources = await handle_list_resources()
                result = {'resources': [r.__dict__ for r in resources]}

            elif method == 'resources/read':
                uri = params.get('uri')
                content = await handle_read_resource(uri)
                result = {'contents': [{'type': 'text', 'text': content.text}]}

            elif method == 'tools/call':
                name = params.get('name')
                arguments = params.get('arguments', {})
                tool_result = await handle_call_tool(name, arguments)
                result = {'content': [{'type': 'text', 'text': tr.text} for tr in tool_result]}

            elif method == 'tools/list':
                tools = await handle_list_tools()
                result = {'tools': [t.__dict__ for t in tools]}

            else:
                raise ValueError(f"Unknown method: {method}")

            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'result': result
            }

        except Exception as e:
            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'error': {
                    'code': -32603,
                    'message': str(e)
                }
            }

    def handle_mcp_request_sync(self, request_data):
        """Handle MCP JSON-RPC request synchronously"""
        method = request_data.get('method')
        params = request_data.get('params', {})
        request_id = request_data.get('id')

        try:
            if method == 'tools/call':
                name = params.get('name')
                arguments = params.get('arguments', {})

                if method == "tools/call" and params.get("name") == "fetch_elevation_grid":
                    args = params.get("arguments", {})
                    resort_key = args.get("resort_key")
                    resolution = args.get("resolution", 16)
                    area_size = args.get("area_size", 1000)
                    client_request_id = args.get("request_id")

                    # Use client-provided request ID if present, otherwise generate one
                    progress_request_id = client_request_id or elevation_provider._get_request_id()

                    # Initialize a 0% progress record immediately so polling has something to read
                    try:
                        elevation_provider.progress_callbacks[progress_request_id] = {
                            "current": 0,
                            "total": int(resolution) * int(resolution),
                            "progress": 0.0,
                            "message": "Request received",
                            "timestamp": datetime.now().isoformat(timespec='milliseconds'),
                        }
                    except Exception:
                        # Best effort; even if this fails, fetch_elevation_grid_sync will initialize
                        pass

                    if resort_key in elevation_provider.ski_resorts:
                        resort_coords = elevation_provider.ski_resorts[resort_key]
                        elevations = elevation_provider.fetch_elevation_grid_sync(
                            resort_coords, resolution, area_size, progress_request_id
                        )

                        if elevations:
                            result_data = {
                                'resort': resort_key,
                                'resolution': resolution,
                                'area_size': area_size,
                                "elevation_data": elevations,
                                "source": "MCP Elevation Server",
                                "request_id": progress_request_id,
                            }
                            result = {'content': [{'type': 'text', 'text': json.dumps(result_data)}]}
                        else:
                            raise ValueError("Failed to fetch elevation data")

                elif name == 'get_resort_info':
                    resort_key = arguments.get('resort_key')
                    if not resort_key or resort_key not in elevation_provider.ski_resorts:
                        raise ValueError(f"Invalid resort key: {resort_key}")

                    resort_info = elevation_provider.ski_resorts[resort_key]
                    result = {'content': [{'type': 'text', 'text': json.dumps(resort_info, indent=2)}]}

                else:
                    raise ValueError(f"Unknown tool: {name}")

            else:
                raise ValueError(f"Unknown method: {method}")

            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'result': result
            }

        except Exception as e:
            logger.error(f"💥 MCP Request Error: {e}")
            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'error': {
                    'code': -32603,
                    'message': str(e)
                }
            }

    def log_message(self, format, *args):
        """Custom logging for HTTP requests"""
        logger.info(f"[{self.address_string()}] {format % args}")


async def run_stdio_server():
    """Run MCP server in stdio mode for AI agents"""
    logger.info("🔌 Starting MCP server in stdio mode (AI agent integration)")

    if not MCP_AVAILABLE:
        logger.error("❌ MCP SDK not available. Install with: pip install mcp")
        return

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

        async with stdio_server() as (read_stream, write_stream):
            await server.run(
                read_stream,
                write_stream,
                capabilities,
                raise_exceptions=True
            )
    except Exception as e:
        logger.error(f"💥 Failed to start stdio MCP server: {e}")
        raise


def run_http_server(port=8081):
    """Run MCP server in HTTP mode for web browsers"""
    logger.info(f"🌐 Starting MCP server in HTTP mode on port {port} (web browser integration)")
    logger.info(f"📡 MCP JSON-RPC endpoint: http://localhost:{port}/mcp")

    try:
        # Use a threaded HTTP server so progress (GET) can be served while a long-running POST is in-flight
        with ThreadingHTTPServer(("", port), MCPHTTPHandler) as httpd:
            logger.info("🎿 MCP Elevation Server ready for HTTP requests (threaded)")
            logger.info("Press Ctrl+C to stop the server")
            logger.info("-" * 50)
            httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("\n👋 HTTP MCP server stopped")
    except Exception as e:
        logger.error(f"💥 Failed to start HTTP MCP server: {e}")
        raise


async def main():
    """Main function to run the MCP elevation server"""
    parser = argparse.ArgumentParser(description='MCP Elevation Server - Dual Transport Mode')
    parser.add_argument('--http', action='store_true', help='Run in HTTP mode for web browsers')
    parser.add_argument('--port', type=int, default=8081, help='Port for HTTP mode (default: 8081)')
    args = parser.parse_args()

    logger.info("🎿 Starting MCP Elevation Server for Ski Terrain Rendering")

    # Log available ski resorts
    for key, resort in elevation_provider.ski_resorts.items():
        logger.info(f"📍 Available resort: {resort['name']} ({key})")

    if args.http:
        # Run HTTP server (blocking)
        run_http_server(args.port)
    else:
        # Run stdio server (async)
        await run_stdio_server()


if __name__ == "__main__":
    asyncio.run(main())
