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
     * Call MCP server via HTTP JSON-RPC (proper MCP protocol over HTTP)
     */
    async bridgeToHttpServer(toolName, args) {
        console.log(`🌐 Bridging to HTTP server: ${toolName}`, args);
        
        try {
            // Extract parameters from args
            const resortKey = args.resort || args.resort_key || 'whistler';
            const resolution = args.resolution || 16;
            const areaSize = args.area_size || args.areaSize || 1000;
            const requestId = `req_${Date.now()}_${Math.floor(Math.random()*1e6)}`; // Generate client-side request ID
            
            console.log(`📡 Calling MCP tool with params:`, {
                resort_key: resortKey,
                resolution: resolution,
                area_size: areaSize,
                request_id: requestId
            });
            
            // Show initial progress
            this.showProgress(0, 'Starting elevation data fetch...');
            // Start progress polling BEFORE the POST so the user sees updates during the long-running request
            if (!this._progressAbort) this._progressAbort = {};
            this._progressAbort[requestId] = false;
            const _polling = this.pollProgress(requestId);
            
            // Make JSON-RPC call to MCP server
            const response = await fetch('http://localhost:8081/mcp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'tools/call',
                    params: {
                        name: 'fetch_elevation_grid',
                        arguments: {
                            resort_key: resortKey,
                            resolution: resolution,
                            area_size: areaSize,
                            request_id: requestId
                        }
                    }
                })
            });
            
            if (!response.ok) {
                this.hideProgress();
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const jsonRpcResponse = await response.json();
            console.log('📥 MCP JSON-RPC Response:', jsonRpcResponse);
            
            if (jsonRpcResponse.error) {
                this.hideProgress();
                throw new Error(`MCP Error: ${jsonRpcResponse.error.message}`);
            }
            
            // Extract result from JSON-RPC response
            const result = jsonRpcResponse.result;
            if (result?.content?.[0]) {
                const elevationData = JSON.parse(result.content[0].text);
                console.log('✅ Parsed elevation data:', elevationData);
                
                // Stop polling as operation is complete (server response received)
                this._progressAbort[requestId] = true;
                // Await one tick so any in-flight poll can resolve gracefully
                await Promise.resolve();
                
                this.hideProgress();
                
                if (elevationData?.elevation_data) {
                    console.log(`📊 Received ${elevationData.elevation_data.length} elevation points`);
                    
                    // Normalize elevation data to expected format
                    return {
                        elevationData: elevationData.elevation_data,
                        metadata: {
                            resort: elevationData.resort,
                            resolution: elevationData.resolution,
                            area_size: elevationData.area_size,
                            source: elevationData.source,
                            request_id: elevationData.request_id || requestId
                        }
                    };
                } else {
                    console.warn('⚠️ No elevation_data found in response');
                    return null;
                }
            } else {
                this.hideProgress();
                console.warn('⚠️ Invalid response structure');
                return null;
            }
            
        } catch (error) {
            this.hideProgress();
            console.error('❌ Bridge to HTTP server failed:', error);
            
            // Fallback to resort info if elevation fetch fails
            try {
                return await this.handleResortInfo(args.resort || args.resort_key || 'whistler');
            } catch (fallbackError) {
                console.error('❌ Fallback also failed:', fallbackError);
                return null;
            }
        }
    }

    async pollProgress(requestId) {
        console.log(`📊 Starting progress polling for request: ${requestId}`);
        
        const pollInterval = 500; // Poll every 500ms
        const maxPolls = 600; // Allow up to 5 minutes of polling
        let pollCount = 0;
        const warmupMs = 5000; // During warmup, treat non-OK as not-yet-ready and retry
        const startTs = Date.now();
        
        return new Promise((resolve) => {
            const poll = async () => {
                try {
                    if (this._progressAbort?.[requestId]) {
                        console.log(`🛑 Progress polling aborted for ${requestId}`);
                        return resolve();
                    }
                    const response = await fetch(`http://localhost:8081/progress/${requestId}`);
                    
                    if (response.ok) {
                        const progressData = await response.json();
                        console.log(`📈 Progress update:`, progressData);
                        
                        this.showProgress(
                            progressData.progress,
                            progressData.message || 'Processing...',
                            progressData.current,
                            progressData.total
                        );
                        
                        // Continue polling if not complete
                        if (progressData.progress < 100 && pollCount < maxPolls && !(this._progressAbort?.[requestId])) {
                            pollCount++;
                            setTimeout(poll, pollInterval);
                        } else {
                            resolve();
                        }
                    } else {
                        // Non-OK response; keep retrying unless aborted or out of time
                        console.log(`ℹ️ Progress endpoint non-OK status ${response.status}; retrying...`);
                        if (pollCount < maxPolls && !(this._progressAbort?.[requestId])) {
                            pollCount++;
                            setTimeout(poll, (Date.now() - startTs) < warmupMs ? 250 : pollInterval);
                        } else {
                            resolve();
                        }
                    }
                } catch (error) {
                    console.warn(`⚠️ Progress polling error:`, error);
                    if (pollCount < maxPolls && !(this._progressAbort?.[requestId])) {
                        pollCount++;
                        setTimeout(poll, pollInterval);
                    } else {
                        resolve();
                    }
                }
            };
            
            // Slight delay to reduce race with server-side initialization
            setTimeout(poll, 200);
        });
    }
    
    showProgress(percentage, message = '', current = null, total = null) {
        // Create or update progress indicator
        let progressContainer = document.getElementById('elevation-progress');
        
        if (!progressContainer) {
            progressContainer = document.createElement('div');
            progressContainer.id = 'elevation-progress';
            progressContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 15px;
                border-radius: 8px;
                font-family: monospace;
                z-index: 10000;
                min-width: 300px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            `;
            document.body.appendChild(progressContainer);
        }
        
        const progressText = current && total ? 
            `${current}/${total} (${percentage.toFixed(1)}%)` : 
            `${percentage.toFixed(1)}%`;
        
        progressContainer.innerHTML = `
            <div style="margin-bottom: 8px; font-weight: bold;">🏔️ Fetching Elevation Data</div>
            <div style="background: #333; border-radius: 4px; overflow: hidden; margin-bottom: 8px;">
                <div style="background: linear-gradient(90deg, #4CAF50, #8BC34A); height: 20px; width: ${percentage}%; transition: width 0.3s ease;"></div>
            </div>
            <div style="font-size: 12px; opacity: 0.8;">${progressText}</div>
            <div style="font-size: 11px; opacity: 0.6; margin-top: 4px;">${message}</div>
        `;
    }
    
    hideProgress() {
        const progressContainer = document.getElementById('elevation-progress');
        if (progressContainer) {
            progressContainer.remove();
        }
    }

    /**
     * Handle resort info requests (fallback for non-elevation tools)
     */
    async handleResortInfo(resortKey) {
        console.log(`🏔️ Fetching resort info for: ${resortKey}`);
        
        try {
            const response = await fetch('http://localhost:8081/mcp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 2,
                    method: 'tools/call',
                    params: {
                        name: 'get_resort_info',
                        arguments: {
                            resort_key: resortKey
                        }
                    }
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const jsonRpcResponse = await response.json();
            
            if (jsonRpcResponse.error) {
                throw new Error(`MCP Error: ${jsonRpcResponse.error.message}`);
            }
            
            const result = jsonRpcResponse.result;
            if (result?.content?.[0]) {
                const resortInfo = JSON.parse(result.content[0].text);
                console.log('🏔️ Resort info:', resortInfo);
                
                // Generate synthetic elevation data based on resort info
                const syntheticData = this.generateSyntheticElevation(resortInfo);
                
                return {
                    elevationData: syntheticData,
                    metadata: {
                        resort: resortKey,
                        source: 'Synthetic (Resort Info Fallback)',
                        base_elevation: resortInfo.base_elevation,
                        peak_elevation: resortInfo.peak_elevation
                    }
                };
            }
            
            return null;
            
        } catch (error) {
            console.error('❌ Resort info fetch failed:', error);
            return null;
        }
    }

    /**
     * Fetch elevation data for a ski resort using MCP protocol
     */
    async fetchElevationData(resortKey, resolution = 16, areaSize = 1000) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            console.log(`🗺️ MCP Client fetching elevation data for ${resortKey}`);
            
            // Call MCP tool to fetch elevation grid via HTTP JSON-RPC
            const result = await this.callTool('fetch_elevation_grid', {
                resort_key: resortKey,
                resolution: resolution,
                area_size: areaSize
            });
            
            if (result?.elevation_data) {
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

  // Export for use in other modules (browser and Node/CommonJS safe)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MCPElevationClient;
  } else if (typeof window !== 'undefined') {
    window.MCPElevationClient = MCPElevationClient;
  }
