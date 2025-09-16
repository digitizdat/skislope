/**
 * MCP Client for Elevation Data - Ski! 3D Alpine Ski Terrain Rendering System
 * 
 * This client provides a bridge between the browser-based 3D terrain renderer
 * and the MCP elevation server. Due to browser limitations with stdio-based
 * MCP protocol, this implementation uses HTTP bridging to communicate with
 * the elevation data sources.
 * 
 * Architecture:
 * - Browser 3D Renderer → MCP Client (this file) → HTTP Bridge → MCP Server
 * - Supports 5 major ski resorts with real topographical data
 * - Handles elevation data normalization for 3D rendering
 * - Implements MCP-style resource and tool interfaces
 * 
 * Usage:
 *   const mcpClient = new MCPElevationClient();
 *   await mcpClient.initialize();
 *   const elevationData = await mcpClient.fetchElevationData('chamonix', 128, 2000);
 * 
 * Note: This is a browser-compatible MCP client implementation.
 * For true MCP protocol communication, use the Python MCP server directly.
 */

class MCPElevationClient {
    constructor() {
        this.serverProcess = null;
        this.requestId = 0;
        this.pendingRequests = new Map();
        this.isInitialized = false;
        this.capabilities = null;
        this.resources = [];
    }

    /**
     * Initialize connection to MCP elevation server
     */
    async initialize() {
        try {
            console.log('🤖 Initializing MCP Elevation Client...');
            
            // In a browser environment, we need to communicate through a bridge
            // For now, we'll simulate MCP protocol over HTTP until we have proper MCP client support
            this.isInitialized = true;
            
            // Fetch available resources from MCP server
            await this.listResources();
            
            console.log('✅ MCP Client initialized successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize MCP client:', error);
            return false;
        }
    }

    /**
     * List available elevation resources from MCP server
     */
    async listResources() {
        try {
            // Resource URIs matching the actual MCP elevation server structure
            // These correspond to the resources exposed by mcp/elevation/server.py
            this.resources = [
                'elevation://grid/chamonix',
                'elevation://metadata/chamonix',
                'elevation://grid/whistler', 
                'elevation://metadata/whistler',
                'elevation://grid/zermatt',
                'elevation://metadata/zermatt',
                'elevation://grid/stanton',
                'elevation://metadata/stanton',
                'elevation://grid/valdisere',
                'elevation://metadata/valdisere'
            ];
            
            console.log(`📋 Found ${this.resources.length} elevation resources`);
            return this.resources;
            
        } catch (error) {
            console.error('Failed to list MCP resources:', error);
            throw error;
        }
    }

    /**
     * Read elevation data resource from MCP server
     */
    async readResource(uri) {
        try {
            console.log(`📖 Reading MCP resource: ${uri}`);
            
            // Parse the URI to extract resort and resource type
            // Updated to match actual MCP server URI format: elevation://grid/{resort} or elevation://metadata/{resort}
            const match = uri.match(/elevation:\/\/(grid|metadata)\/(\w+)/);
            if (!match) {
                throw new Error(`Invalid resource URI: ${uri}`);
            }
            
            const [, resourceType, resortKey] = match;
            
            if (resourceType === 'grid') {
                // Use the MCP tool to fetch elevation grid
                // Tool name matches actual MCP server: 'get_elevation_data'
                return await this.callTool('get_elevation_data', {
                    resort_key: resortKey,
                    resolution: 128,
                    area_size: 2000
                });
            } else if (resourceType === 'metadata') {
                // Return resort metadata directly (matches MCP server data structure)
                return await this.callTool('get_resort_info', {
                    resort_key: resortKey
                });
            }
            
        } catch (error) {
            console.error(`Failed to read MCP resource ${uri}:`, error);
            throw error;
        }
    }

    /**
     * Call MCP tool for elevation operations
     */
    async callTool(toolName, args) {
        try {
            console.log(`🔧 Calling MCP tool: ${toolName}`, args);
            
            // For browser compatibility, we'll bridge to our existing HTTP server
            // In a full MCP implementation, this would be JSON-RPC over stdio
            const response = await this.bridgeToHttpServer(toolName, args);
            
            return response;
            
        } catch (error) {
            console.error(`Failed to call MCP tool ${toolName}:`, error);
            throw error;
        }
    }

    /**
     * Bridge MCP calls to HTTP server (temporary solution for browser compatibility)
     */
    async bridgeToHttpServer(toolName, args) {
        if (toolName === 'get_elevation_data' || toolName === 'fetch_elevation_grid') {
            const { resort_key, resolution = 128, area_size = 2000 } = args;
            
            // Call our existing HTTP endpoint
            const url = `/api/elevation?resort=${resort_key}&resolution=${resolution}&area_size=${area_size}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.status === 'success') {
                return {
                    success: true,
                    resort: data.resort,
                    resolution: data.resolution,
                    area_size: data.area_size,
                    elevation_data: data.elevation_data,
                    data_points: data.elevation_data.length,
                    source: 'MCP Elevation Server (via HTTP bridge)'
                };
            } else {
                throw new Error(data.message || 'Failed to fetch elevation data');
            }
        }
        
        if (toolName === 'get_resort_info') {
            const { resort_key } = args;
            
            // Return resort metadata (we have this locally)
            const resortInfo = {
                chamonix: {
                    name: 'Chamonix-Mont-Blanc',
                    country: 'France',
                    lat: 45.9237,
                    lon: 6.8694,
                    base_elevation: 1035,
                    peak_elevation: 3842,
                    vertical_drop: 2807,
                    terrain_type: 'glacial_alpine'
                },
                whistler: {
                    name: 'Whistler Blackcomb',
                    country: 'Canada',
                    lat: 50.1163,
                    lon: -122.9574,
                    base_elevation: 652,
                    peak_elevation: 2182,
                    vertical_drop: 1530,
                    terrain_type: 'coastal_range'
                },
                zermatt: {
                    name: 'Zermatt Matterhorn',
                    country: 'Switzerland',
                    lat: 46.0207,
                    lon: 7.7491,
                    base_elevation: 1608,
                    peak_elevation: 3883,
                    vertical_drop: 2275,
                    terrain_type: 'high_alpine'
                },
                stanton: {
                    name: 'St. Anton am Arlberg',
                    country: 'Austria',
                    lat: 47.1333,
                    lon: 10.2667,
                    base_elevation: 1304,
                    peak_elevation: 2811,
                    vertical_drop: 1507,
                    terrain_type: 'alpine_bowl'
                },
                valdisere: {
                    name: "Val d'Isère",
                    country: 'France',
                    lat: 45.4489,
                    lon: 6.9797,
                    base_elevation: 1550,
                    peak_elevation: 3456,
                    vertical_drop: 1906,
                    terrain_type: 'high_alpine'
                }
            };
            
            return resortInfo[resort_key] || null;
        }
        
        throw new Error(`Unknown tool: ${toolName}`);
    }

    /**
     * Fetch elevation data for a ski resort using MCP protocol
     */
    async fetchElevationData(resortKey, resolution = 128, areaSize = 2000) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            console.log(`🗺️ MCP Client fetching elevation data for ${resortKey}`);
            
            // Call MCP tool to fetch elevation grid (matches actual MCP server tool name)
            const result = await this.callTool('get_elevation_data', {
                resort_key: resortKey,
                resolution: resolution,
                area_size: areaSize
            });
            
            if (result && result.elevation_data) {
                console.log(`✅ MCP Client received ${result.data_points} elevation points`);
                
                // Convert to normalized Float32Array for terrain rendering
                const elevationArray = new Float32Array(result.elevation_data);
                return this.normalizeElevationData(elevationArray);
            }
            
            return null;
            
        } catch (error) {
            console.error(`MCP Client error for ${resortKey}:`, error);
            throw error;
        }
    }

    /**
     * Normalize elevation data to 0-1 range for terrain rendering
     */
    normalizeElevationData(elevationData) {
        if (!elevationData || elevationData.length === 0) {
            return null;
        }
        
        // Find min and max elevations
        let minElevation = elevationData[0];
        let maxElevation = elevationData[0];
        
        for (let i = 1; i < elevationData.length; i++) {
            if (elevationData[i] < minElevation) minElevation = elevationData[i];
            if (elevationData[i] > maxElevation) maxElevation = elevationData[i];
        }
        
        const elevationRange = maxElevation - minElevation;
        if (elevationRange === 0) {
            return new Float32Array(elevationData.length).fill(0.5);
        }
        
        // Normalize to 0-1 range
        const normalizedData = new Float32Array(elevationData.length);
        for (let i = 0; i < elevationData.length; i++) {
            normalizedData[i] = (elevationData[i] - minElevation) / elevationRange;
        }
        
        return normalizedData;
    }

    /**
     * Get available ski resorts
     */
    getAvailableResorts() {
        return ['chamonix', 'whistler', 'zermatt', 'stanton', 'valdisere'];
    }

    /**
     * Cleanup MCP client connection
     */
    async cleanup() {
        if (this.serverProcess) {
            this.serverProcess.kill();
            this.serverProcess = null;
        }
        this.isInitialized = false;
        console.log('🧹 MCP Client cleaned up');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MCPElevationClient;
} else if (typeof window !== 'undefined') {
    window.MCPElevationClient = MCPElevationClient;
}
