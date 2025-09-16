"""Integration tests for MCP server resource and tool handlers."""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from mcp.types import Resource, TextResourceContents, Tool, TextContent
from mcp_elevation_server import server, elevation_provider


class TestMCPServerResources:
    """Test cases for MCP server resource handlers."""

    @pytest.mark.asyncio
    async def test_list_resources(self):
        """Test listing available MCP resources."""
        # Get the handler function and call it
        handler = server._resource_handlers.get("list_resources")
        resources = await handler()
        
        assert len(resources) > 0
        
        # Check for expected resource types
        grid_resources = [r for r in resources if "grid" in r.uri]
        metadata_resources = [r for r in resources if "metadata" in r.uri]
        
        assert len(grid_resources) == 5  # One for each ski resort
        assert len(metadata_resources) == 5  # One for each ski resort
        
        # Verify resource structure
        for resource in resources:
            assert isinstance(resource, Resource)
            assert resource.uri.startswith("elevation://")
            assert resource.name is not None
            assert resource.description is not None

    @pytest.mark.asyncio
    async def test_read_grid_resource_valid(self):
        """Test reading valid elevation grid resource."""
        uri = "elevation://ski-resort/chamonix/grid"
        
        # Get the handler function and call it
        handler = server._resource_handlers.get("read_resource")
        content = await handler(uri)
        
        assert isinstance(content, list)
        assert len(content) == 1
        assert isinstance(content[0], TextResourceContents)
        
        # Parse JSON content - should be elevation data
        data = json.loads(content[0].text)
        assert isinstance(data, list)  # Should be elevation grid data

    @pytest.mark.asyncio
    async def test_read_metadata_resource_valid(self):
        """Test reading valid metadata resource."""
        uri = "elevation://ski-resort/chamonix/metadata"
        
        # Get the handler function and call it
        handler = server._resource_handlers.get("read_resource")
        content = await handler(uri)
        
        assert isinstance(content, list)
        assert len(content) == 1
        assert isinstance(content[0], TextResourceContents)
        
        # Parse JSON content
        metadata = json.loads(content[0].text)
        assert "name" in metadata
        assert "country" in metadata
        assert "lat" in metadata
        assert "lon" in metadata

    @pytest.mark.asyncio
    async def test_read_resource_invalid(self):
        """Test reading invalid resource."""
        uri = "elevation://ski-resort/nonexistent/grid"
        
        # Get the handler function and call it
        handler = server._resource_handlers.get("read_resource")
        with pytest.raises(ValueError):
            await handler(uri)

    @pytest.mark.asyncio
    @patch('mcp_elevation_server.elevation_provider.get_elevation_data')
    async def test_read_elevation_grid_resource(self, mock_get_elevation):
        """Test reading elevation grid resource."""
        # Mock elevation data
        mock_elevation_data = {
            "elevations": [[1000, 1050], [1020, 1070]],
            "coordinates": {"min_lat": 45.9, "max_lat": 46.0, "min_lon": 6.8, "max_lon": 6.9},
            "resolution": 2
        }
        mock_get_elevation.return_value = mock_elevation_data
        
        uri = "ski-resort/chamonix/elevation-grid"
        
        content = await server.read_resource(uri)
        
        assert isinstance(content, list)
        assert len(content) == 1
        assert isinstance(content[0], TextResourceContents)
        
        # Parse JSON content
        grid_data = json.loads(content[0].text)
        assert "elevations" in grid_data
        assert "coordinates" in grid_data
        assert "resolution" in grid_data

    @pytest.mark.asyncio
    async def test_read_invalid_resource_format(self):
        """Test reading resource with invalid URI format."""
        uri = "invalid-resource-uri"
        
        with pytest.raises(ValueError, match="Invalid resource URI"):
            await server.read_resource(uri)


class TestMCPServerTools:
    """Test cases for MCP server tool handlers."""

    @pytest.mark.asyncio
    async def test_list_tools(self):
        """Test listing available MCP tools."""
        tools = await server.list_tools()
        
        assert len(tools) == 1
        
        tool = tools[0]
        assert isinstance(tool, Tool)
        assert tool.name == "get_elevation_data"
        assert tool.description is not None
        assert "properties" in tool.inputSchema
        
        # Check required parameters
        properties = tool.inputSchema["properties"]
        assert "resort_key" in properties
        assert "resolution" in properties
        assert "area_size" in properties

    @pytest.mark.asyncio
    @patch('mcp_elevation_server.elevation_provider.get_elevation_data')
    async def test_call_elevation_tool_success(self, mock_get_elevation):
        """Test successful elevation data tool call."""
        # Mock elevation data
        mock_elevation_data = {
            "elevations": [[1000, 1050], [1020, 1070]],
            "coordinates": {"min_lat": 45.9, "max_lat": 46.0, "min_lon": 6.8, "max_lon": 6.9},
            "resolution": 2
        }
        mock_get_elevation.return_value = mock_elevation_data
        
        arguments = {
            "resort_key": "chamonix",
            "resolution": 2,
            "area_size": 1000
        }
        
        result = await server.call_tool("get_elevation_data", arguments)
        
        assert len(result.content) == 1
        assert isinstance(result.content[0], TextContent)
        
        # Parse result
        elevation_data = json.loads(result.content[0].text)
        assert "elevations" in elevation_data
        assert "coordinates" in elevation_data
        assert "resolution" in elevation_data
        assert elevation_data["resolution"] == 2

    @pytest.mark.asyncio
    async def test_call_elevation_tool_invalid_resort(self):
        """Test elevation tool call with invalid resort."""
        arguments = {
            "resort_key": "nonexistent_resort",
            "resolution": 2,
            "area_size": 1000
        }
        
        result = await server.call_tool("get_elevation_data", arguments)
        
        assert len(result.content) == 1
        assert isinstance(result.content[0], TextContent)
        
        # Should return error message
        response = json.loads(result.content[0].text)
        assert "error" in response

    @pytest.mark.asyncio
    @patch('mcp_elevation_server.elevation_provider.get_elevation_data')
    async def test_call_elevation_tool_api_failure(self, mock_get_elevation):
        """Test elevation tool call when API fails."""
        mock_get_elevation.return_value = None
        
        arguments = {
            "resort_key": "chamonix",
            "resolution": 2,
            "area_size": 1000
        }
        
        result = await server.call_tool("get_elevation_data", arguments)
        
        assert len(result.content) == 1
        assert isinstance(result.content[0], TextContent)
        
        # Should return error message
        response = json.loads(result.content[0].text)
        assert "error" in response

    @pytest.mark.asyncio
    async def test_call_elevation_tool_missing_arguments(self):
        """Test elevation tool call with missing arguments."""
        arguments = {
            "resort_key": "chamonix"
            # Missing resolution and area_size
        }
        
        with pytest.raises(Exception):  # Should raise validation error
            await server.call_tool("get_elevation_data", arguments)

    @pytest.mark.asyncio
    async def test_call_elevation_tool_invalid_arguments(self):
        """Test elevation tool call with invalid argument types."""
        arguments = {
            "resort_key": "chamonix",
            "resolution": "invalid",  # Should be int
            "area_size": "invalid"    # Should be int
        }
        
        with pytest.raises(Exception):  # Should raise validation error
            await server.call_tool("get_elevation_data", arguments)

    @pytest.mark.asyncio
    async def test_call_nonexistent_tool(self):
        """Test calling a tool that doesn't exist."""
        with pytest.raises(Exception):  # Should raise tool not found error
            await server.call_tool("nonexistent_tool", {})


class TestMCPServerIntegration:
    """Integration tests for MCP server functionality."""

    @pytest.mark.asyncio
    @patch('mcp_elevation_server.elevation_provider.get_elevation_data')
    async def test_full_workflow(self, mock_get_elevation):
        """Test complete MCP workflow: list resources, read resource, call tool."""
        # Mock elevation data
        mock_elevation_data = {
            "elevations": [[1000, 1050], [1020, 1070]],
            "coordinates": {"min_lat": 45.9, "max_lat": 46.0, "min_lon": 6.8, "max_lon": 6.9},
            "resolution": 2
        }
        mock_get_elevation.return_value = mock_elevation_data
        
        # 1. List resources
        resources = await server.list_resources()
        assert len(resources) > 0
        
        # 2. Read metadata resource
        metadata_uri = "ski-resort/chamonix/metadata"
        metadata_content = await server.read_resource(metadata_uri)
        assert len(metadata_content) == 1
        
        # 3. Call elevation tool
        tool_result = await server.call_tool("get_elevation_data", {
            "resort_key": "chamonix",
            "resolution": 2,
            "area_size": 1000
        })
        assert len(tool_result.content) == 1
        
        # 4. Read elevation grid resource
        grid_uri = "ski-resort/chamonix/elevation-grid"
        grid_content = await server.read_resource(grid_uri)
        assert len(grid_content) == 1
        
        # Verify all operations returned valid data
        metadata = json.loads(metadata_content[0].text)
        tool_data = json.loads(tool_result.content[0].text)
        grid_data = json.loads(grid_content[0].text)
        
        assert "name" in metadata
        assert "elevations" in tool_data
        assert "elevations" in grid_data
