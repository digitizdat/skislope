"""Simple functional tests for MCP elevation server."""

import pytest
from mcp.elevation.server import ElevationDataProvider, elevation_provider


class TestSimpleFunctionality:
    """Simple tests to verify basic functionality."""

    def test_elevation_provider_initialization(self):
        """Test that ElevationDataProvider initializes correctly."""
        provider = ElevationDataProvider()
        assert provider.cache == {}
        assert len(provider.ski_resorts) == 5
        assert "chamonix" in provider.ski_resorts
        assert "whistler" in provider.ski_resorts
        assert "zermatt" in provider.ski_resorts

    def test_ski_resort_data_structure(self):
        """Test ski resort data has expected structure."""
        provider = ElevationDataProvider()
        
        for resort_key, resort_data in provider.ski_resorts.items():
            assert "name" in resort_data
            assert "country" in resort_data
            assert "lat" in resort_data
            assert "lon" in resort_data
            assert "base_elevation" in resort_data
            assert "peak_elevation" in resort_data
            assert isinstance(resort_data["lat"], (int, float))
            assert isinstance(resort_data["lon"], (int, float))

    def test_data_sources_configuration(self):
        """Test data sources are properly configured."""
        provider = ElevationDataProvider()
        
        assert "opentopodata" in provider.data_sources
        assert "openelevation" in provider.data_sources
        
        otd = provider.data_sources["opentopodata"]
        assert "base_url" in otd
        assert "max_locations" in otd
        assert otd["max_locations"] == 100
        
        oe = provider.data_sources["openelevation"]
        assert "base_url" in oe
        assert "max_locations" in oe
        assert oe["max_locations"] == 512

    def test_global_elevation_provider_instance(self):
        """Test global elevation provider instance exists."""
        assert elevation_provider is not None
        assert isinstance(elevation_provider, ElevationDataProvider)
        assert len(elevation_provider.ski_resorts) == 5

    def test_cache_basic_operations(self):
        """Test basic cache operations."""
        provider = ElevationDataProvider()
        
        # Test empty cache
        assert len(provider.cache) == 0
        
        # Test adding to cache
        test_key = "test_key"
        test_data = [1000, 1100, 1200]
        provider.cache[test_key] = test_data
        
        # Test retrieving from cache
        assert provider.cache[test_key] == test_data
        assert len(provider.cache) == 1

    @pytest.mark.asyncio
    async def test_fetch_elevation_grid_invalid_resort(self):
        """Test fetch_elevation_grid with invalid resort."""
        provider = ElevationDataProvider()
        result = await provider.fetch_elevation_grid("invalid_resort", 4, 1000)
        assert result is None

    def test_ski_resort_coordinates_validity(self):
        """Test that ski resort coordinates are valid."""
        provider = ElevationDataProvider()
        
        for resort_key, resort_data in provider.ski_resorts.items():
            lat = resort_data["lat"]
            lon = resort_data["lon"]
            
            # Valid latitude range: -90 to 90
            assert -90 <= lat <= 90, f"Invalid latitude for {resort_key}: {lat}"
            
            # Valid longitude range: -180 to 180
            assert -180 <= lon <= 180, f"Invalid longitude for {resort_key}: {lon}"

    def test_elevation_data_validity(self):
        """Test that elevation data is reasonable."""
        provider = ElevationDataProvider()
        
        for resort_key, resort_data in provider.ski_resorts.items():
            base_elev = resort_data["base_elevation"]
            peak_elev = resort_data["peak_elevation"]
            
            # Base elevation should be positive and reasonable
            assert base_elev > 0, f"Invalid base elevation for {resort_key}: {base_elev}"
            assert base_elev < 10000, f"Unreasonably high base elevation for {resort_key}: {base_elev}"
            
            # Peak should be higher than base
            assert peak_elev > base_elev, f"Peak elevation not higher than base for {resort_key}"
            
            # Vertical drop should match
            expected_drop = peak_elev - base_elev
            actual_drop = resort_data["vertical_drop"]
            assert abs(expected_drop - actual_drop) < 10, f"Vertical drop mismatch for {resort_key}"
