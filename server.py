#!/usr/bin/env python3
"""
HTTP Server for Ski! 3D Alpine Ski Terrain Rendering System.

This server provides:
1. Static file serving for the 3D terrain renderer (index.html, JS, assets)
2. REST API proxy for elevation data (/api/elevation endpoint)
3. CORS support for local development

Note: This is NOT a true MCP server - it's an HTTP REST API proxy.
For the actual MCP elevation server, use: python run_elevation_server.py

The server includes a legacy ElevationMCPAgent class that fetches real
topographical data from Open Topo Data and Open Elevation APIs. This
functionality has been superseded by the true MCP server in mcp/elevation/

Usage:
    python server.py
    # Then open http://localhost:8080 in your browser

Architecture:
    - HTTP server serves static files and API endpoints
    - ElevationMCPAgent handles external API integration
    - CORS headers enable local file access for development
    - Caching reduces API calls and improves performance
"""
import http.server
import json
import os
import socketserver
import sys
import urllib.parse
import urllib.request
from urllib.parse import parse_qs, urlparse

# Change to the directory containing this script
os.chdir(os.path.dirname(os.path.abspath(__file__)))

PORT = 8080


class ElevationMCPAgent:
    """MCP Agent for fetching real topographical data from multiple sources"""

    def __init__(self):
        self.data_sources = {
            "opentopodata": {
                "name": "Open Topo Data",
                "base_url": "https://api.opentopodata.org/v1",
                "datasets": ["srtm30m", "aster30m", "mapzen", "ned10m"],
                "rate_limit": 1.0,  # 1 second between requests
                "max_locations": 100,
            },
            "openelevation": {
                "name": "Open Elevation",
                "base_url": "https://api.open-elevation.com/api/v1/lookup",
                "rate_limit": 1.0,
                "max_locations": 512,
            },
        }
        self.cache = {}

    def fetch_elevation_grid(self, resort_coords, resolution=64, area_size=2000):
        """Fetch elevation data for a grid around resort coordinates"""
        cache_key = f"{resort_coords['lat']},{resort_coords['lon']},{resolution},{area_size}"

        if cache_key in self.cache:
            return self.cache[cache_key]

        try:
            # Calculate grid points
            lat_range = area_size / 111000  # ~111km per degree
            lon_range = area_size / (
                111000 * abs(resort_coords["lat"]) * 0.017453
            )  # Adjust for latitude

            locations = []
            for i in range(resolution):
                for j in range(resolution):
                    lat = resort_coords["lat"] + (i / (resolution - 1) - 0.5) * lat_range
                    lon = resort_coords["lon"] + (j / (resolution - 1) - 0.5) * lon_range
                    locations.append(f"{lat},{lon}")

            # Try Open Topo Data first (more reliable for ski areas)
            elevation_data = self._fetch_from_opentopodata(locations, "srtm30m")

            if not elevation_data:
                # Fallback to Open Elevation
                elevation_data = self._fetch_from_openelevation(locations)

            if elevation_data:
                self.cache[cache_key] = elevation_data
                return elevation_data

            return None

        except Exception as e:
            print(f"MCP Agent error: {e}")
            return None

    def _fetch_from_opentopodata(self, locations, dataset="srtm30m"):
        """Fetch from Open Topo Data API"""
        try:
            # Batch locations (max 100 per request)
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
            print(f"Open Topo Data error: {e}")
            return None

    def _fetch_from_openelevation(self, locations):
        """Fetch from Open Elevation API"""
        try:
            # Batch locations (max 512 per request)
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
            print(f"Open Elevation error: {e}")
            return None


class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.elevation_agent = ElevationMCPAgent()
        super().__init__(*args, **kwargs)

    def do_GET(self):
        # Handle elevation API requests
        if self.path.startswith("/api/elevation"):
            self.handle_elevation_request()
        else:
            super().do_GET()

    def handle_elevation_request(self):
        """Handle elevation data requests via MCP agent"""
        try:
            parsed_url = urlparse(self.path)
            params = parse_qs(parsed_url.query)

            # Extract parameters
            resort = params.get("resort", [""])[0]
            resolution = int(params.get("resolution", ["64"])[0])
            area_size = int(params.get("area_size", ["2000"])[0])

            # Resort coordinates
            resort_coords = {
                "chamonix": {"lat": 45.9237, "lon": 6.8694, "name": "Chamonix, France"},
                "whistler": {"lat": 50.1163, "lon": -122.9574, "name": "Whistler, Canada"},
                "zermatt": {"lat": 46.0207, "lon": 7.7491, "name": "Zermatt, Switzerland"},
                "stanton": {"lat": 47.1333, "lon": 10.2667, "name": "St. Anton, Austria"},
                "valdisere": {"lat": 45.4489, "lon": 6.9797, "name": "Val d'Isère, France"},
            }

            if resort not in resort_coords:
                self.send_error(400, "Invalid resort")
                return

            print(f"🗺️ MCP Agent fetching elevation data for {resort_coords[resort]['name']}")

            # Fetch elevation data via MCP agent
            elevation_data = self.elevation_agent.fetch_elevation_grid(
                resort_coords[resort], resolution, area_size
            )

            if elevation_data:
                response = {
                    "status": "success",
                    "resort": resort,
                    "resolution": resolution,
                    "area_size": area_size,
                    "elevation_data": elevation_data,
                    "source": "MCP Agent (Real Topographical Data)",
                }
                print(f"✅ Successfully fetched {len(elevation_data)} elevation points")
            else:
                response = {
                    "status": "error",
                    "message": "Failed to fetch elevation data",
                    "resort": resort,
                }
                print(f"❌ Failed to fetch elevation data for {resort}")

            # Send JSON response
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())

        except Exception as e:
            print(f"Error handling elevation request: {e}")
            self.send_error(500, str(e))

    def end_headers(self):
        # Add CORS headers to allow local file access
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        super().end_headers()

    def log_message(self, format, *args):
        # Custom logging
        print(f"[{self.address_string()}] {format % args}")


if __name__ == "__main__":
    try:
        with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
            print("🎿 Ski Terrain Renderer Server")
            print(f"Serving at http://localhost:{PORT}")
            print("Press Ctrl+C to stop the server")
            print("-" * 40)
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Server stopped")
        sys.exit(0)
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        sys.exit(1)
