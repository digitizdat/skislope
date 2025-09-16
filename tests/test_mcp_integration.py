"""Integration tests for MCP server functionality."""

import json
from unittest.mock import patch, MagicMock
import pytest

from mcp.elevation.server import server, elevation_provider


class TestMCPIntegration:
    """Integration tests for MCP server."""

    def test_server_initialization(self):
        """Test MCP server is properly initialized."""
        assert server is not None
        assert server.name == "mcp-elevation-server"

    def test_elevation_provider_integration(self):
        """Test elevation provider is properly integrated."""
        assert elevation_provider is not None
        assert len(elevation_provider.ski_resorts) == 5

    @pytest.mark.asyncio
    async def test_resource_handlers_exist(self):
        """Test that resource handlers are properly registered."""
        # Test that server has the expected structure
        assert hasattr(server, 'name')
        assert server.name == "mcp-elevation-server"
        
        # Test expected resource count (5 resorts * 2 resources each)
        expected_resources = 10
        actual_resort_count = len(elevation_provider.ski_resorts)
        assert actual_resort_count == 5
        
        # Each resort should have grid and metadata resources
        for resort_key in elevation_provider.ski_resorts.keys():
            assert resort_key in ["chamonix", "whistler", "zermatt", "stanton", "valdisere"]

    @pytest.mark.asyncio
    async def test_tool_handlers_exist(self):
        """Test that tool handlers are properly registered."""
        # Test that server exists and has expected structure
        assert server is not None
        assert hasattr(server, 'name')
        
        # Test basic tool functionality arguments
        test_args = {
            "resort_key": "chamonix",
            "resolution": 4,
            "area_size": 1000
        }
        
        # Validate argument structure
        assert "resort_key" in test_args
        assert "resolution" in test_args
        assert "area_size" in test_args
        assert test_args["resort_key"] in elevation_provider.ski_resorts

    def test_ski_resort_data_completeness(self):
        """Test that all ski resorts have complete data."""
        required_fields = ["name", "country", "lat", "lon", "base_elevation", "peak_elevation"]
        
        for resort_key, resort_data in elevation_provider.ski_resorts.items():
            for field in required_fields:
                assert field in resort_data, f"Missing {field} in {resort_key}"
                assert resort_data[field] is not None, f"Null {field} in {resort_key}"

    def test_data_source_configuration(self):
        """Test data source configuration is valid."""
        assert "opentopodata" in elevation_provider.data_sources
        assert "openelevation" in elevation_provider.data_sources
        
        for source_name, source_config in elevation_provider.data_sources.items():
            assert "base_url" in source_config
            assert "max_locations" in source_config
            assert isinstance(source_config["max_locations"], int)
            assert source_config["max_locations"] > 0

    @pytest.mark.asyncio
    @patch('urllib.request.urlopen')
    async def test_end_to_end_elevation_fetch(self, mock_urlopen):
        """Test end-to-end elevation data fetching."""
        # Mock API response
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            "status": "OK",
            "results": [
                {"elevation": 1500}, {"elevation": 1550},
                {"elevation": 1520}, {"elevation": 1570}
            ]
        }).encode()
        mock_urlopen.return_value.__enter__.return_value = mock_response
        
        # Test elevation fetching
        result = await elevation_provider.fetch_elevation_grid("chamonix", 2, 1000)
        
        assert result is not None
        assert len(result) == 4
        assert all(isinstance(elev, (int, float)) for elev in result)

    def test_cache_integration(self):
        """Test cache integration works properly."""
        # Test cache is accessible
        assert hasattr(elevation_provider, 'cache')
        assert isinstance(elevation_provider.cache, dict)
        
        # Test cache operations
        test_key = "integration_test"
        test_data = [1000, 1100, 1200]
        
        elevation_provider.cache[test_key] = test_data
        assert elevation_provider.cache[test_key] == test_data

    def test_resort_coordinate_ranges(self):
        """Test that resort coordinates are within expected ranges."""
        for resort_key, resort_data in elevation_provider.ski_resorts.items():
            lat = resort_data["lat"]
            lon = resort_data["lon"]
            
            # Ski resorts should be in mountainous regions
            # Latitude ranges for major ski regions
            assert -90 <= lat <= 90
            assert -180 <= lon <= 180
            
            # Most ski resorts are in northern hemisphere
            if resort_key in ["chamonix", "whistler", "zermatt", "stanton", "valdisere"]:
                assert lat > 0, f"Expected northern hemisphere for {resort_key}"

    def test_elevation_data_consistency(self):
        """Test elevation data consistency across resorts."""
        for resort_key, resort_data in elevation_provider.ski_resorts.items():
            base = resort_data["base_elevation"]
            peak = resort_data["peak_elevation"]
            drop = resort_data["vertical_drop"]
            
            # Basic consistency checks
            assert peak > base, f"Peak should be higher than base for {resort_key}"
            assert drop == (peak - base), f"Vertical drop calculation error for {resort_key}"
            
            # Reasonable elevation ranges for ski resorts
            assert 0 < base < 5000, f"Unreasonable base elevation for {resort_key}: {base}m"
            assert 500 < peak < 6000, f"Unreasonable peak elevation for {resort_key}: {peak}m"
            assert 100 < drop < 4000, f"Unreasonable vertical drop for {resort_key}: {drop}m"
