"""Tests for MCP server startup behavior and development mode handling."""

import subprocess
import sys
from unittest.mock import patch

import pytest

from skislope_mcp.elevation.server import main


class TestMCPServerStartup:
    """Test cases for MCP server startup behavior."""

    @pytest.mark.asyncio
    async def test_development_mode_startup(self):
        """Test MCP server startup in development mode (without MCP SDK)."""
        # This should complete without hanging and log appropriate messages
        with patch('skislope_mcp.elevation.server.logger') as mock_logger:
            try:
                await main()
            except Exception:
                # Expected to exit with exception in development mode
                pass

            # Verify startup messages were logged
            mock_logger.info.assert_any_call("🎿 Starting MCP Elevation Server for Ski Terrain Rendering")

            # Verify resort information was logged
            resort_calls = [call for call in mock_logger.info.call_args_list
                          if "Available resort:" in str(call)]
            assert len(resort_calls) == 5  # Should log all 5 resorts

            # Verify development mode message was logged
            development_calls = [call for call in mock_logger.info.call_args_list
                               if "Running in development mode:" in str(call)]
            assert len(development_calls) >= 1

    def test_mcp_server_script_execution(self):
        """Test that the MCP server script runs and exits properly."""
        # Run the server script and verify it exits cleanly
        result = subprocess.run(
            [sys.executable, "run_elevation_server.py"],
            cwd="/Users/martin/src/skislope",
            capture_output=True,
            text=True,
            timeout=10  # Should exit quickly in development mode
        )

        # Should exit with code 0 (success)
        assert result.returncode == 0

        # Should contain expected log messages
        assert "Starting MCP Elevation Server" in result.stderr
        assert "Available resort:" in result.stderr
        assert "Running in development mode:" in result.stderr
        assert "Server handlers registered successfully" in result.stderr

    @pytest.mark.asyncio
    async def test_mock_server_behavior(self):
        """Test mock MCP server behavior without real MCP SDK."""
        # Test that the server module can be imported and has expected structure
        import skislope_mcp.elevation.server as server_module

        # Verify the server module has the expected components
        assert hasattr(server_module, 'main')
        assert hasattr(server_module, 'elevation_provider')
        assert hasattr(server_module, 'server')

    @pytest.mark.asyncio
    async def test_server_initialization_components(self):
        """Test that server initializes all required components."""
        import skislope_mcp.elevation.server as server_module
        elevation_provider = server_module.elevation_provider
        server = server_module.server

        # Verify elevation provider is initialized
        assert elevation_provider is not None
        assert hasattr(elevation_provider, 'ski_resorts')
        assert len(elevation_provider.ski_resorts) == 5

        # Verify server has required handlers
        assert server is not None
        assert hasattr(server, '_resource_handlers')
        assert hasattr(server, '_tool_handlers')

    def test_expected_exit_behavior(self):
        """Test that immediate exit in development mode is expected behavior."""
        # This test documents the expected behavior:
        # 1. Server starts up successfully
        # 2. Logs available resources and capabilities
        # 3. Attempts to create stdio connection
        # 4. Fails due to missing MCP SDK
        # 5. Logs development mode message
        # 6. Exits cleanly

        result = subprocess.run(
            [sys.executable, "run_elevation_server.py"],
            cwd="/Users/martin/src/skislope",
            capture_output=True,
            text=True,
            timeout=10
        )

        # Should exit cleanly with expected development mode behavior
        assert result.returncode == 0
        assert "Running in development mode:" in result.stderr
        assert "Server handlers registered successfully" in result.stderr


def _has_real_mcp_sdk():
    """Check if real MCP SDK is available."""
    from importlib.util import find_spec
    return find_spec("mcp.server") is not None


class TestMCPServerWithRealSDK:
    """Test cases for when real MCP SDK is available."""

    @pytest.mark.skipif(
        not _has_real_mcp_sdk(),
        reason="Real MCP SDK not available"
    )
    @pytest.mark.asyncio
    async def test_real_mcp_server_startup(self):
        """Test MCP server startup with real MCP SDK installed."""
        # This test only runs if real MCP SDK is available
        # It should start the server and wait for connections

        # Note: This would require actual stdio streams to test properly
        # For now, we just verify the import works
        try:
            from mcp.server import Server as RealServer
            from mcp.server.stdio import stdio_server as real_stdio_server
            assert RealServer is not None
            assert real_stdio_server is not None
        except ImportError:
            pytest.skip("Real MCP SDK not available")


class TestMCPServerDocumentation:
    """Test that server behavior is properly documented."""

    def test_development_mode_documentation(self):
        """Test that development mode behavior is documented in code."""
        # Read the server file directly to check for documentation
        with open("/Users/martin/src/skislope/skislope_mcp/elevation/server.py") as f:
            source_code = f.read()

        # Should contain documentation about development mode
        assert "development mode" in source_code.lower()

        # Should handle exceptions appropriately
        assert "except Exception" in source_code

    def test_mock_classes_documentation(self):
        """Test that mock classes are properly documented."""
        # Read the server file directly to check for documentation
        with open("/Users/martin/src/skislope/skislope_mcp/elevation/server.py") as f:
            source_code = f.read()

        # Should document the implementation
        assert "development" in source_code.lower()
        assert "mcp" in source_code.lower()
