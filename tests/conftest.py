"""Test configuration and fixtures for MCP elevation server tests."""

import asyncio
import json

import pytest

from skislope_mcp.elevation.server import ElevationDataProvider, server


@pytest.fixture
def mock_elevation_data():
    """Mock elevation data for testing."""
    return {
        "elevations": [
            [1000, 1050, 1100, 1150],
            [1020, 1070, 1120, 1170],
            [1040, 1090, 1140, 1190],
            [1060, 1110, 1160, 1210],
        ],
        "coordinates": {
            "min_lat": 45.9,
            "max_lat": 46.0,
            "min_lon": 6.8,
            "max_lon": 6.9,
        },
        "resolution": 4,
    }


@pytest.fixture
def mock_ski_resort_data():
    """Mock ski resort data for testing."""
    return {
        "test_resort": {
            "name": "Test Resort",
            "country": "Test Country",
            "lat": 45.95,
            "lon": 6.85,
            "base_elevation": 1000,
            "peak_elevation": 3000,
            "vertical_drop": 2000,
            "terrain_type": "test_alpine",
        }
    }


@pytest.fixture
def elevation_provider(mock_ski_resort_data):
    """Create ElevationDataProvider instance with mock data."""
    provider = ElevationDataProvider()
    provider.ski_resorts = mock_ski_resort_data
    return provider


@pytest.fixture
def mock_http_response():
    """Mock HTTP response for external API calls."""

    class MockResponse:
        def __init__(self, json_data, status_code=200):
            self.json_data = json_data
            self.status_code = status_code

        def read(self):
            return json.dumps(self.json_data).encode()

        def getcode(self):
            return self.status_code

    return MockResponse


@pytest.fixture
def mock_open_topo_response(mock_http_response):
    """Mock Open Topo Data API response."""
    return mock_http_response({
        "results": [
            {"elevation": 1000, "location": {"lat": 45.9, "lng": 6.8}},
            {"elevation": 1050, "location": {"lat": 45.9, "lng": 6.85}},
            {"elevation": 1100, "location": {"lat": 45.9, "lng": 6.9}},
            {"elevation": 1020, "location": {"lat": 45.95, "lng": 6.8}},
        ]
    })


@pytest.fixture
def mock_open_elevation_response(mock_http_response):
    """Mock Open Elevation API response."""
    return mock_http_response({
        "results": [
            {"elevation": 1000, "latitude": 45.9, "longitude": 6.8},
            {"elevation": 1050, "latitude": 45.9, "longitude": 6.85},
            {"elevation": 1100, "latitude": 45.9, "longitude": 6.9},
            {"elevation": 1020, "latitude": 45.95, "longitude": 6.8},
        ]
    })


@pytest.fixture
async def mcp_server():
    """Create MCP server instance for testing."""
    return server


@pytest.fixture
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()
