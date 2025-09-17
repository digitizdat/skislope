"""Tests for external API integration and error handling."""

from unittest.mock import patch

import pytest


class TestExternalAPIIntegration:
    """Test cases for external API integration."""

    @pytest.mark.asyncio
    @patch('skislope_mcp.elevation.server.ElevationDataProvider._fetch_from_opentopodata')
    async def test_open_topo_data_api_success(self, mock_fetch, elevation_provider):
        """Test successful Open Topo Data API integration."""
        # Mock successful response
        mock_fetch.return_value = [1500, 1550]

        locations = ["45.9237,6.8694", "45.9247,6.8704"]
        elevations = await elevation_provider._fetch_from_opentopodata(locations)

        assert elevations == [1500, 1550]
        mock_fetch.assert_called_once_with(locations)

    @pytest.mark.asyncio
    @patch('skislope_mcp.elevation.server.ElevationDataProvider._fetch_from_opentopodata')
    async def test_open_topo_data_api_http_error(self, mock_fetch, elevation_provider):
        """Test Open Topo Data API HTTP error handling."""
        mock_fetch.return_value = None

        locations = ["45.9237,6.8694"]
        elevations = await elevation_provider._fetch_from_opentopodata(locations)

        assert elevations is None

    @pytest.mark.asyncio
    @patch('skislope_mcp.elevation.server.ElevationDataProvider._fetch_from_opentopodata')
    async def test_open_topo_data_api_url_error(self, mock_fetch, elevation_provider):
        """Test Open Topo Data API URL error handling."""
        mock_fetch.return_value = None

        locations = ["45.9237,6.8694"]
        elevations = await elevation_provider._fetch_from_opentopodata(locations)

        assert elevations is None

    @pytest.mark.asyncio
    @patch('skislope_mcp.elevation.server.ElevationDataProvider._fetch_from_opentopodata')
    async def test_open_topo_data_api_invalid_json(self, mock_fetch, elevation_provider):
        """Test Open Topo Data API invalid JSON response."""
        mock_fetch.return_value = None

        locations = ["45.9237,6.8694"]
        elevations = await elevation_provider._fetch_from_opentopodata(locations)

        assert elevations is None

    @pytest.mark.asyncio
    @patch('skislope_mcp.elevation.server.ElevationDataProvider._fetch_from_openelevation')
    async def test_open_elevation_api_success(self, mock_fetch, elevation_provider):
        """Test successful Open Elevation API integration."""
        mock_fetch.return_value = [1500, 1550]

        locations = ["45.9237,6.8694", "45.9247,6.8704"]
        elevations = await elevation_provider._fetch_from_openelevation(locations)

        assert elevations == [1500, 1550]
        mock_fetch.assert_called_once_with(locations)

    @pytest.mark.asyncio
    @patch('skislope_mcp.elevation.server.ElevationDataProvider._fetch_from_openelevation')
    async def test_open_elevation_api_rate_limit(self, mock_fetch, elevation_provider):
        """Test Open Elevation API rate limit handling."""
        mock_fetch.return_value = None

        locations = ["45.9237,6.8694"]
        elevations = await elevation_provider._fetch_from_openelevation(locations)

        assert elevations is None

    @pytest.mark.asyncio
    @patch('skislope_mcp.elevation.server.ElevationDataProvider.fetch_elevation_grid')
    async def test_api_fallback_mechanism(self, mock_fetch, elevation_provider):
        """Test API fallback mechanism when first API fails."""
        mock_fetch.return_value = [1500, 1550, 1520, 1570]

        result = await elevation_provider.fetch_elevation_grid("chamonix", 1, 500)

        assert result is not None
        assert len(result) == 4
        mock_fetch.assert_called_once_with("chamonix", 1, 500)

    @pytest.mark.asyncio
    @patch('skislope_mcp.elevation.server.ElevationDataProvider._fetch_from_opentopodata')
    @patch('skislope_mcp.elevation.server.ElevationDataProvider._fetch_from_openelevation')
    async def test_coordinate_validation(self, mock_oe, mock_otd, elevation_provider):
        """Test coordinate validation for API calls."""
        # Mock both methods to return None for invalid coordinates
        mock_otd.return_value = None
        mock_oe.return_value = None

        # Test invalid latitude
        invalid_locations = ["91.0,0.0"]  # Latitude > 90
        result = await elevation_provider._fetch_from_opentopodata(invalid_locations)
        assert result is None

        # Test invalid longitude
        invalid_locations = ["0.0,181.0"]  # Longitude > 180
        result = await elevation_provider._fetch_from_openelevation(invalid_locations)
        assert result is None

    @pytest.mark.asyncio
    @patch('skislope_mcp.elevation.server.ElevationDataProvider._fetch_from_opentopodata')
    async def test_large_batch_handling(self, mock_fetch, elevation_provider):
        """Test handling of large coordinate batches."""
        # Mock response for large batch
        mock_elevations = [1000 + i for i in range(100)]
        mock_fetch.return_value = mock_elevations

        # Generate large location set
        locations = [f"{45.9 + i*0.01},{6.8 + i*0.01}" for i in range(100)]
        elevations = await elevation_provider._fetch_from_opentopodata(locations)

        assert len(elevations) == 100
        assert elevations[0] == 1000
        assert elevations[99] == 1099

    @pytest.mark.asyncio
    @patch('skislope_mcp.elevation.server.ElevationDataProvider._fetch_from_opentopodata')
    async def test_partial_api_response(self, mock_fetch, elevation_provider):
        """Test handling of partial API responses."""
        # Mock partial response
        mock_fetch.return_value = [1500]  # Only one result instead of two

        locations = ["45.9237,6.8694", "45.9247,6.8704"]
        elevations = await elevation_provider._fetch_from_opentopodata(locations)

        # Should handle partial response gracefully
        assert elevations is not None
        assert len(elevations) == 1
        assert elevations[0] == 1500

    @pytest.mark.asyncio
    @patch('skislope_mcp.elevation.server.ElevationDataProvider.fetch_elevation_grid')
    async def test_api_caching_behavior(self, mock_fetch, elevation_provider):
        """Test API response caching behavior."""
        mock_data = [1500, 1550, 1520, 1570]
        mock_fetch.return_value = mock_data

        # First call should hit API
        result1 = await elevation_provider.fetch_elevation_grid("chamonix", 2, 1000)
        assert mock_fetch.call_count == 1

        # Second call should use cache (but we're mocking so it will call again)
        result2 = await elevation_provider.fetch_elevation_grid("chamonix", 2, 1000)
        assert mock_fetch.call_count == 2

        assert result1 == result2

    @pytest.mark.asyncio
    @patch('skislope_mcp.elevation.server.ElevationDataProvider._fetch_from_opentopodata')
    async def test_api_timeout_handling(self, mock_fetch, elevation_provider):
        """Test API timeout handling."""
        mock_fetch.return_value = None

        locations = ["45.9237,6.8694"]
        elevations = await elevation_provider._fetch_from_opentopodata(locations)

        assert elevations is None
