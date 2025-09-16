"""Unit tests for ElevationDataProvider class."""

import json
from unittest.mock import patch, MagicMock
import pytest

from mcp.elevation.server import ElevationDataProvider


class TestElevationDataProvider:
    """Test cases for ElevationDataProvider class."""

    def test_init(self):
        """Test ElevationDataProvider initialization."""
        provider = ElevationDataProvider()
        assert provider.cache == {}
        assert len(provider.ski_resorts) == 5
        assert "chamonix" in provider.ski_resorts
        assert "whistler" in provider.ski_resorts

    def test_get_resort_info_valid(self, elevation_provider):
        """Test getting valid resort information."""
        resort_info = elevation_provider.ski_resorts.get("test_resort")
        assert resort_info is not None
        assert resort_info["name"] == "Test Resort"
        assert resort_info["country"] == "Test Country"

    def test_get_resort_info_invalid(self, elevation_provider):
        """Test getting invalid resort information."""
        resort_info = elevation_provider.ski_resorts.get("nonexistent_resort")
        assert resort_info is None

    @pytest.mark.asyncio
    @patch('urllib.request.urlopen')
    async def test_fetch_elevation_grid_success(self, mock_urlopen, elevation_provider):
        """Test successful elevation grid fetching."""
        # Mock successful API response
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            "status": "OK",
            "results": [
                {"elevation": 1000}, {"elevation": 1050},
                {"elevation": 1020}, {"elevation": 1070}
            ]
        }).encode()
        mock_urlopen.return_value.__enter__.return_value = mock_response
        
        result = await elevation_provider.fetch_elevation_grid("test_resort", 2, 1000)
        
        assert result is not None
        assert len(result) == 4

    @pytest.mark.asyncio
    async def test_fetch_elevation_grid_invalid_resort(self, elevation_provider):
        """Test elevation grid fetching for invalid resort."""
        result = await elevation_provider.fetch_elevation_grid("nonexistent_resort", 2, 1000)
        
        assert result is None

    @pytest.mark.asyncio
    @patch('urllib.request.urlopen')
    async def test_fetch_from_opentopodata_success(self, mock_urlopen, elevation_provider):
        """Test successful Open Topo Data API call."""
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            "status": "OK",
            "results": [
                {"elevation": 1000}, {"elevation": 1050}
            ]
        }).encode()
        mock_urlopen.return_value.__enter__.return_value = mock_response
        
        locations = ["45.9,6.8", "45.9,6.85"]
        elevations = await elevation_provider._fetch_from_opentopodata(locations)
        
        assert len(elevations) == 2
        assert elevations[0] == 1000
        assert elevations[1] == 1050

    @pytest.mark.asyncio
    @patch('urllib.request.urlopen')
    async def test_fetch_from_opentopodata_failure(self, mock_urlopen, elevation_provider):
        """Test Open Topo Data API failure handling."""
        mock_urlopen.side_effect = Exception("API Error")
        
        locations = ["45.9,6.8", "45.9,6.85"]
        elevations = await elevation_provider._fetch_from_opentopodata(locations)
        
        assert elevations is None

    @pytest.mark.asyncio
    @patch('urllib.request.urlopen')
    async def test_fetch_from_openelevation_success(self, mock_urlopen, elevation_provider):
        """Test successful Open Elevation API call."""
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            "results": [
                {"elevation": 1000}, {"elevation": 1050}
            ]
        }).encode()
        mock_urlopen.return_value.__enter__.return_value = mock_response
        
        locations = ["45.9,6.8", "45.9,6.85"]
        elevations = await elevation_provider._fetch_from_openelevation(locations)
        
        assert len(elevations) == 2
        assert elevations[0] == 1000
        assert elevations[1] == 1050

    @pytest.mark.asyncio
    @patch('urllib.request.urlopen')
    async def test_fetch_from_openelevation_failure(self, mock_urlopen, elevation_provider):
        """Test Open Elevation API failure handling."""
        mock_urlopen.side_effect = Exception("API Error")
        
        locations = ["45.9,6.8", "45.9,6.85"]
        elevations = await elevation_provider._fetch_from_openelevation(locations)
        
        assert elevations is None

    def test_cache_functionality(self, elevation_provider):
        """Test caching mechanism."""
        cache_key = "test_key"
        test_data = [1000, 1050, 1020, 1070]
        
        # Test cache miss
        assert elevation_provider.cache.get(cache_key) is None
        
        # Test cache set
        elevation_provider.cache[cache_key] = test_data
        
        # Test cache hit
        cached_data = elevation_provider.cache.get(cache_key)
        assert cached_data == test_data
