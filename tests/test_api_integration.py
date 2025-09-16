"""Tests for external API integration and error handling."""

import json
from unittest.mock import patch, MagicMock
import pytest
import urllib.error

from mcp_elevation_server import ElevationDataProvider


class TestExternalAPIIntegration:
    """Test cases for external API integration."""

    @patch('urllib.request.urlopen')
    def test_open_topo_data_api_success(self, mock_urlopen, elevation_provider):
        """Test successful Open Topo Data API integration."""
        # Mock successful response
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            "results": [
                {"elevation": 1500, "location": {"lat": 45.9237, "lng": 6.8694}},
                {"elevation": 1550, "location": {"lat": 45.9247, "lng": 6.8704}},
            ]
        }).encode()
        mock_response.getcode.return_value = 200
        mock_urlopen.return_value.__enter__.return_value = mock_response
        
        points = [(45.9237, 6.8694), (45.9247, 6.8704)]
        elevations = elevation_provider._fetch_open_topo_data(points)
        
        assert elevations == [1500, 1550]
        mock_urlopen.assert_called_once()

    @patch('urllib.request.urlopen')
    def test_open_topo_data_api_http_error(self, mock_urlopen, elevation_provider):
        """Test Open Topo Data API HTTP error handling."""
        mock_urlopen.side_effect = urllib.error.HTTPError(
            url="test", code=429, msg="Too Many Requests", hdrs=None, fp=None
        )
        
        points = [(45.9237, 6.8694)]
        elevations = elevation_provider._fetch_open_topo_data(points)
        
        assert elevations is None

    @patch('urllib.request.urlopen')
    def test_open_topo_data_api_url_error(self, mock_urlopen, elevation_provider):
        """Test Open Topo Data API URL error handling."""
        mock_urlopen.side_effect = urllib.error.URLError("Connection failed")
        
        points = [(45.9237, 6.8694)]
        elevations = elevation_provider._fetch_open_topo_data(points)
        
        assert elevations is None

    @patch('urllib.request.urlopen')
    def test_open_topo_data_api_invalid_json(self, mock_urlopen, elevation_provider):
        """Test Open Topo Data API invalid JSON response."""
        mock_response = MagicMock()
        mock_response.read.return_value = b"invalid json"
        mock_response.getcode.return_value = 200
        mock_urlopen.return_value.__enter__.return_value = mock_response
        
        points = [(45.9237, 6.8694)]
        elevations = elevation_provider._fetch_open_topo_data(points)
        
        assert elevations is None

    @patch('urllib.request.urlopen')
    def test_open_elevation_api_success(self, mock_urlopen, elevation_provider):
        """Test successful Open Elevation API integration."""
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            "results": [
                {"elevation": 1500, "latitude": 45.9237, "longitude": 6.8694},
                {"elevation": 1550, "latitude": 45.9247, "longitude": 6.8704},
            ]
        }).encode()
        mock_response.getcode.return_value = 200
        mock_urlopen.return_value.__enter__.return_value = mock_response
        
        points = [(45.9237, 6.8694), (45.9247, 6.8704)]
        elevations = elevation_provider._fetch_open_elevation_data(points)
        
        assert elevations == [1500, 1550]
        mock_urlopen.assert_called_once()

    @patch('urllib.request.urlopen')
    def test_open_elevation_api_rate_limit(self, mock_urlopen, elevation_provider):
        """Test Open Elevation API rate limit handling."""
        mock_urlopen.side_effect = urllib.error.HTTPError(
            url="test", code=429, msg="Rate limit exceeded", hdrs=None, fp=None
        )
        
        points = [(45.9237, 6.8694)]
        elevations = elevation_provider._fetch_open_elevation_data(points)
        
        assert elevations is None

    @patch('urllib.request.urlopen')
    def test_api_fallback_mechanism(self, mock_urlopen, elevation_provider):
        """Test API fallback mechanism when first API fails."""
        # First call (Open Topo Data) fails, second call (Open Elevation) succeeds
        responses = [
            urllib.error.HTTPError(url="test", code=500, msg="Server Error", hdrs=None, fp=None),
            MagicMock()
        ]
        
        # Configure second response (Open Elevation success)
        responses[1].read.return_value = json.dumps({
            "results": [
                {"elevation": 1500, "latitude": 45.95, "longitude": 6.85},
            ]
        }).encode()
        responses[1].getcode.return_value = 200
        responses[1].__enter__ = lambda x: responses[1]
        responses[1].__exit__ = lambda x, y, z, w: None
        
        mock_urlopen.side_effect = [responses[0], responses[1]]
        
        result = elevation_provider.get_elevation_data("test_resort", 1, 500)
        
        assert result is not None
        assert "elevations" in result
        assert mock_urlopen.call_count == 2

    def test_coordinate_validation(self, elevation_provider):
        """Test coordinate validation for API calls."""
        # Test invalid latitude
        invalid_points = [(91.0, 0.0)]  # Latitude > 90
        result = elevation_provider._fetch_open_topo_data(invalid_points)
        assert result is None
        
        # Test invalid longitude
        invalid_points = [(0.0, 181.0)]  # Longitude > 180
        result = elevation_provider._fetch_open_elevation_data(invalid_points)
        assert result is None

    @patch('urllib.request.urlopen')
    def test_large_batch_handling(self, mock_urlopen, elevation_provider):
        """Test handling of large coordinate batches."""
        # Mock response for large batch
        mock_response = MagicMock()
        elevations_data = [{"elevation": 1000 + i, "location": {"lat": 45.9 + i*0.01, "lng": 6.8 + i*0.01}} 
                          for i in range(100)]
        mock_response.read.return_value = json.dumps({"results": elevations_data}).encode()
        mock_response.getcode.return_value = 200
        mock_urlopen.return_value.__enter__.return_value = mock_response
        
        # Generate large point set
        points = [(45.9 + i*0.01, 6.8 + i*0.01) for i in range(100)]
        elevations = elevation_provider._fetch_open_topo_data(points)
        
        assert len(elevations) == 100
        assert elevations[0] == 1000
        assert elevations[99] == 1099

    @patch('urllib.request.urlopen')
    def test_partial_api_response(self, mock_urlopen, elevation_provider):
        """Test handling of partial API responses."""
        # Mock response with fewer results than requested
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            "results": [
                {"elevation": 1500, "location": {"lat": 45.9237, "lng": 6.8694}},
                # Missing second result
            ]
        }).encode()
        mock_response.getcode.return_value = 200
        mock_urlopen.return_value.__enter__.return_value = mock_response
        
        points = [(45.9237, 6.8694), (45.9247, 6.8704)]
        elevations = elevation_provider._fetch_open_topo_data(points)
        
        # Should handle partial response gracefully
        assert elevations is not None
        assert len(elevations) == 1
        assert elevations[0] == 1500

    @patch('time.time')
    @patch('urllib.request.urlopen')
    def test_api_caching_behavior(self, mock_urlopen, mock_time, elevation_provider):
        """Test API response caching behavior."""
        mock_time.return_value = 1000
        
        # Mock successful API response
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            "results": [{"elevation": 1500, "location": {"lat": 45.9237, "lng": 6.8694}}]
        }).encode()
        mock_response.getcode.return_value = 200
        mock_urlopen.return_value.__enter__.return_value = mock_response
        
        # First call should hit API
        result1 = elevation_provider.get_elevation_data("test_resort", 2, 1000)
        assert mock_urlopen.call_count == 1
        
        # Second call should use cache
        result2 = elevation_provider.get_elevation_data("test_resort", 2, 1000)
        assert mock_urlopen.call_count == 1  # No additional API call
        
        assert result1 == result2

    @patch('urllib.request.urlopen')
    def test_api_timeout_handling(self, mock_urlopen, elevation_provider):
        """Test API timeout handling."""
        import socket
        mock_urlopen.side_effect = socket.timeout("Request timed out")
        
        points = [(45.9237, 6.8694)]
        elevations = elevation_provider._fetch_open_topo_data(points)
        
        assert elevations is None
