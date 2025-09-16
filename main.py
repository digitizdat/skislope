#!/usr/bin/env python3
"""
Main entry point for the Ski! 3D Alpine Ski Terrain Rendering System.

This is a placeholder main file that can be used to launch different components
of the ski terrain rendering system. Currently minimal - the main functionality
is distributed across:

- Web-based 3D renderer: Launch via `python server.py` and open index.html
- MCP elevation server: Launch via `python run_elevation_server.py`
- Individual MCP agents: Located in mcp/ directory

Usage:
    python main.py          # Shows basic project info
    python server.py        # Start HTTP server for 3D terrain renderer
    python run_elevation_server.py  # Start MCP elevation data server

For development and testing, see README.md for detailed instructions.
"""

def main():
    print("🎿 Ski! - 3D Alpine Ski Terrain Rendering System")
    print("=" * 50)
    print()
    print("Available components:")
    print("  • 3D Terrain Renderer: python server.py (then open index.html)")
    print("  • MCP Elevation Server: python run_elevation_server.py")
    print("  • Tests: pytest tests/ -v")
    print()
    print("See README.md for detailed usage instructions.")
    print()


if __name__ == "__main__":
    main()
