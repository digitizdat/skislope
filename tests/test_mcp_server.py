"""Integration tests for MCP server resource and tool handlers."""

import json
from unittest.mock import patch

import pytest

from mcp.types import Resource, TextContent, TextResourceContents, Tool
from skislope_mcp.elevation.server import server


class TestMCPServerResources:
    """Test cases for MCP server resource handlers."""

    @pytest.mark.asyncio
    async def test_list_resources(self):
        """Test listing available MCP resources."""
        # Use the real MCP server list_resources handler
        from skislope_mcp.elevation.server import handle_list_resources
        resources = await handle_list_resources()

        assert len(resources) > 0

        # Check for expected resource types
        grid_resources = [r for r in resources if "grid" in str(r.uri)]
        metadata_resources = [r for r in resources if "metadata" in str(r.uri)]

        assert len(grid_resources) >= 5  # One for each ski resort
        assert len(metadata_resources) >= 5  # One for each ski resort

        # Verify resource structure
        for resource in resources:
            assert isinstance(resource, Resource)
            assert str(resource.uri).startswith("elevation://")
            assert resource.name is not None
            assert resource.description is not None

    @pytest.mark.asyncio
    @patch('skislope_mcp.elevation.server.elevation_provider.fetch_elevation_grid')
    async def test_read_grid_resource_valid(self, mock_fetch_elevation):
        """Test reading valid elevation grid resource."""
        # Mock elevation data to avoid external API calls
        mock_elevation_data = [1000.0, 1050.0, 1020.0, 1070.0]
        mock_fetch_elevation.return_value = mock_elevation_data

        uri = "elevation://ski-resort/chamonix/grid"

        # Use the real MCP server read_resource handler
        from skislope_mcp.elevation.server import handle_read_resource
        result = await handle_read_resource(uri)

        assert result is not None
        assert isinstance(result, TextResourceContents)
        assert "chamonix" in result.text.lower()
        assert "elevation_data" in result.text

        # Parse JSON content - should be elevation data
        data = json.loads(result.text)
        assert "elevation_data" in data  # Should contain elevation grid data

    @pytest.mark.asyncio
    async def test_read_metadata_resource_valid(self):
        """Test reading valid metadata resource."""
        uri = "elevation://ski-resort/whistler/metadata"

        # Use the real MCP server read_resource handler
        from skislope_mcp.elevation.server import handle_read_resource
        result = await handle_read_resource(uri)

        assert result is not None
        assert isinstance(result, TextResourceContents)
        assert "whistler" in result.text.lower()
        assert "lat" in result.text and "lon" in result.text

        # Parse JSON content
        metadata = json.loads(result.text)
        assert "name" in metadata
        assert "country" in metadata
        assert "lat" in metadata
        assert "lon" in metadata

    @pytest.mark.asyncio
    async def test_read_resource_invalid(self):
        """Test reading invalid resource URI."""
        uri = "elevation://invalid/resource"

        # Use the real MCP server read_resource handler
        from skislope_mcp.elevation.server import handle_read_resource
        with pytest.raises(ValueError, match="Unknown resource URI"):
            await handle_read_resource(uri)

    @pytest.mark.asyncio
    @patch('skislope_mcp.elevation.server.elevation_provider.fetch_elevation_grid')
    async def test_read_elevation_grid_resource(self, mock_fetch_elevation):
        """Test reading elevation grid resource."""
        # Mock elevation data
        mock_elevation_data = [1000.0, 1050.0, 1020.0, 1070.0]
        mock_fetch_elevation.return_value = mock_elevation_data

        uri = "elevation://ski-resort/chamonix/grid"

        from skislope_mcp.elevation.server import handle_read_resource
        content = await handle_read_resource(uri)

        assert isinstance(content, TextResourceContents)
        assert "elevation_data" in content.text
        assert "coordinates" in content.text
        assert "resolution" in content.text

        # Parse JSON content
        grid_data = json.loads(content.text)
        assert "elevation_data" in grid_data
        assert "coordinates" in grid_data
        assert "resolution" in grid_data

    @pytest.mark.asyncio
    async def test_read_invalid_resource_format(self):
        """Test reading resource with invalid URI format."""
        uri = "invalid-resource-uri"

        from skislope_mcp.elevation.server import handle_read_resource
        with pytest.raises(ValueError, match="Unknown resource URI"):
            await handle_read_resource(uri)


class TestMCPServerTools:
    """Test cases for MCP server tool handlers."""

    @pytest.mark.asyncio
    async def test_list_tools(self):
        """Test listing available MCP tools."""
        # Use the real MCP server list_tools handler
        from skislope_mcp.elevation.server import handle_list_tools
        tools = await handle_list_tools()

        assert len(tools) > 0

        # Check for expected tools
        tool_names = [tool.name for tool in tools]
        assert "fetch_elevation_grid" in tool_names
        assert "get_resort_info" in tool_names

        # Verify tool structure
        for tool in tools:
            assert isinstance(tool, Tool)
            assert tool.name is not None
            assert tool.description is not None
            assert tool.inputSchema is not None

    @pytest.mark.asyncio
    @patch('skislope_mcp.elevation.server.elevation_provider.fetch_elevation_grid')
    async def test_call_elevation_tool_success(self, mock_fetch_elevation):
        """Test successful elevation data tool call."""
        # Mock elevation data
        mock_elevation_data = [1000.0, 1050.0, 1020.0, 1070.0]
        mock_fetch_elevation.return_value = mock_elevation_data

        arguments = {
            "resort_key": "chamonix",
            "resolution": 2,
            "area_size": 1000
        }

        from skislope_mcp.elevation.server import handle_call_tool
        result = await handle_call_tool("fetch_elevation_grid", arguments)

        assert len(result) == 1
        assert isinstance(result[0], TextContent)

        # Parse result
        elevation_data = json.loads(result[0].text)
        assert "success" in elevation_data
        assert "elevation_data" in elevation_data
        assert "resort" in elevation_data
        assert elevation_data["resort"] == "chamonix"

    @pytest.mark.asyncio
    async def test_call_elevation_tool_invalid_resort(self):
        """Test calling elevation tool with invalid resort."""
        tool_name = "fetch_elevation_grid"
        arguments = {
            "resort_key": "invalid_resort",
            "resolution": 30,
            "area_size": 5.0
        }

        # Use the real MCP server call_tool handler
        from skislope_mcp.elevation.server import handle_call_tool
        result = await handle_call_tool(tool_name, arguments)

        assert result is not None
        assert len(result) > 0
        assert isinstance(result[0], TextContent)
        assert "Error" in result[0].text
        assert "invalid_resort" in result[0].text

    @pytest.mark.asyncio
    @patch('skislope_mcp.elevation.server.elevation_provider.fetch_elevation_grid')
    async def test_call_elevation_tool_api_failure(self, mock_fetch_elevation):
        """Test elevation tool call when API fails."""
        mock_fetch_elevation.return_value = None

        arguments = {
            "resort_key": "chamonix",
            "resolution": 2,
            "area_size": 1000
        }

        from skislope_mcp.elevation.server import handle_call_tool
        result = await handle_call_tool("fetch_elevation_grid", arguments)

        assert len(result) == 1
        assert isinstance(result[0], TextContent)
        assert "Error" in result[0].text or "Failed" in result[0].text

    @pytest.mark.asyncio
    async def test_call_elevation_tool_missing_arguments(self):
        """Test elevation tool call with missing arguments."""
        arguments = {
            "resort_key": "chamonix"
            # Missing resolution and area_size
        }

        with pytest.raises(ValueError):  # Should raise validation error
            await server.call_tool("get_elevation_data", arguments)

    @pytest.mark.asyncio
    async def test_call_elevation_tool_invalid_arguments(self):
        """Test elevation tool call with invalid argument types."""
        arguments = {
            "resort_key": "chamonix",
            "resolution": "invalid",  # Should be int
            "area_size": "invalid"    # Should be int
        }

        with pytest.raises(ValueError):  # Should raise validation error
            await server.call_tool("get_elevation_data", arguments)

    @pytest.mark.asyncio
    async def test_call_nonexistent_tool(self):
        """Test calling a tool that doesn't exist."""
        with pytest.raises(ValueError):  # Should raise tool not found error
            await server.call_tool("nonexistent_tool", {})


class TestMCPServerIntegration:
    """Integration tests for MCP server functionality."""

    @pytest.mark.asyncio
    @patch('skislope_mcp.elevation.server.elevation_provider.fetch_elevation_grid')
    async def test_full_workflow(self, mock_fetch_elevation):
        """Test complete MCP workflow: list resources, read resource, call tool."""
        # Mock elevation data
        mock_elevation_data = [1000, 1050, 1020, 1070]
        mock_fetch_elevation.return_value = mock_elevation_data

        # Use the real MCP server handlers
        from skislope_mcp.elevation.server import (
            handle_call_tool,
            handle_list_resources,
            handle_read_resource,
        )

        # 1. List resources
        resources = await handle_list_resources()
        assert len(resources) > 0

        # 2. Read metadata resource
        metadata_uri = "elevation://ski-resort/chamonix/metadata"
        metadata_content = await handle_read_resource(metadata_uri)
        assert metadata_content is not None

        # 3. Call elevation tool
        tool_result = await handle_call_tool("fetch_elevation_grid", {
            "resort_key": "chamonix",
            "resolution": 2,
            "area_size": 1000
        })
        assert len(tool_result) == 1

        # 4. Read elevation grid resource
        grid_uri = "elevation://ski-resort/chamonix/grid"
        grid_content = await handle_read_resource(grid_uri)
        assert grid_content is not None

        # Verify all operations returned valid data
        metadata = json.loads(metadata_content.text)
        tool_data = json.loads(tool_result[0].text)
        grid_data = json.loads(grid_content.text)

        assert "name" in metadata
        assert "elevation_data" in tool_data
        assert "elevation_data" in grid_data
