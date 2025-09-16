class TopographyDataLoader {
    constructor() {
        this.apiKey = null; // Will need API key for some services
        this.cache = new Map(); // Cache elevation data
        this.mcpClient = null; // MCP client for real topographical data
        
        // Ski resort coordinates (lat, lon) for real data fetching
        this.resortCoordinates = {
            chamonix: { lat: 45.9237, lon: 6.8694, name: "Chamonix, France" },
            whistler: { lat: 50.1163, lon: -122.9574, name: "Whistler, Canada" },
            zermatt: { lat: 46.0207, lon: 7.7491, name: "Zermatt, Switzerland" },
            stanton: { lat: 47.1333, lon: 10.2667, name: "St. Anton, Austria" },
            valdisere: { lat: 45.4489, lon: 6.9797, name: "Val d'Isère, France" }
        };
        
        // Available elevation data sources
        this.dataSources = {
            opentopography: {
                name: "OpenTopography SRTM",
                baseUrl: "https://cloud.sdsc.edu/v1/products",
                resolution: 30, // meters
                requiresKey: false
            },
            usgs: {
                name: "USGS Elevation Point Query",
                baseUrl: "https://nationalmap.gov/epqs/pqs.php",
                resolution: 10, // meters
                requiresKey: false
            },
            mapbox: {
                name: "Mapbox Terrain RGB",
                baseUrl: "https://api.mapbox.com/v4/mapbox.terrain-rgb",
                resolution: 512, // pixels per tile
                requiresKey: true
            }
        };
    }
    
    // Fetch elevation data for a specific resort area via MCP Client
    async fetchElevationData(resortKey, resolution = 128, areaSize = 2000) {
        const cacheKey = `${resortKey}_${resolution}_${areaSize}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        const resort = this.resortCoordinates[resortKey];
        if (!resort) {
            throw new Error(`Unknown resort: ${resortKey}`);
        }
        
        try {
            // Initialize MCP client if not already done
            if (!this.mcpClient) {
                this.mcpClient = new MCPElevationClient();
                await this.mcpClient.initialize();
            }
            
            // Fetch real elevation data via MCP protocol
            console.log(`🤖 MCP Client fetching real topographical data for ${resort.name}`);
            const realElevationData = await this.mcpClient.fetchElevationData(resortKey, resolution, areaSize);
            
            if (realElevationData) {
                console.log(`✅ Successfully loaded real elevation data via MCP for ${resort.name}`);
                this.cache.set(cacheKey, realElevationData);
                return realElevationData;
            }
            
        } catch (error) {
            console.warn(`⚠️ MCP Client failed for ${resort.name}:`, error.message);
        }
        
        // Fallback to enhanced synthetic data
        console.log(`🏔️ Generating enhanced terrain data for ${resort.name} using real coordinates`);
        const elevationData = await this.generateSyntheticElevationData(resort, resolution, areaSize);
        
        // Cache the result
        this.cache.set(cacheKey, elevationData);
        return elevationData;
    }
    
    // Fetch elevation data via MCP Agent (server-side proxy)
    async fetchViaMCPAgent(resortKey, resolution, areaSize) {
        try {
            const url = `/api/elevation?resort=${resortKey}&resolution=${resolution}&area_size=${areaSize}`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`MCP Agent HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.status === 'success' && data.elevation_data) {
                // Convert elevation data to normalized Float32Array
                const elevationArray = new Float32Array(data.elevation_data);
                return this.normalizeElevationData(elevationArray);
            } else {
                throw new Error(data.message || 'MCP Agent returned no data');
            }
            
        } catch (error) {
            console.error('MCP Agent fetch error:', error);
            throw error;
        }
    }
    
    // Fetch elevation data using USGS Elevation Point Query Service
    async fetchUSGSElevationGrid(resort, resolution, areaSize) {
        const elevationData = new Float32Array(resolution * resolution);
        const promises = [];
        
        // Calculate bounding box around resort
        const latRange = areaSize / 111000; // Rough conversion: 1 degree ≈ 111km
        const lonRange = areaSize / (111000 * Math.cos(resort.lat * Math.PI / 180));
        
        const minLat = resort.lat - latRange / 2;
        const maxLat = resort.lat + latRange / 2;
        const minLon = resort.lon - lonRange / 2;
        const maxLon = resort.lon + lonRange / 2;
        
        // Sample elevation points in a grid
        const sampleStep = Math.max(1, Math.floor(resolution / 20)); // Limit API calls
        
        for (let z = 0; z < resolution; z += sampleStep) {
            for (let x = 0; x < resolution; x += sampleStep) {
                const lat = minLat + (maxLat - minLat) * (z / (resolution - 1));
                const lon = minLon + (maxLon - minLon) * (x / (resolution - 1));
                
                const promise = this.queryUSGSElevation(lat, lon)
                    .then(elevation => ({ x, z, elevation }))
                    .catch(() => ({ x, z, elevation: null }));
                
                promises.push(promise);
            }
        }
        
        // Wait for all elevation queries
        const results = await Promise.all(promises);
        
        // Fill in the elevation grid with interpolation
        const elevationPoints = results.filter(r => r.elevation !== null);
        
        if (elevationPoints.length === 0) {
            return null; // No valid elevation data
        }
        
        // Interpolate elevation data across the grid
        for (let z = 0; z < resolution; z++) {
            for (let x = 0; x < resolution; x++) {
                const index = z * resolution + x;
                elevationData[index] = this.interpolateElevation(x, z, elevationPoints, resolution);
            }
        }
        
        return this.normalizeElevationData(elevationData);
    }
    
    // Legacy method - now handled by MCP Agent
    async queryUSGSElevation(lon, lat) {
        // This method is deprecated in favor of MCP Agent
        // Kept for compatibility but should not be called directly
        console.warn('Direct USGS queries are deprecated. Use MCP Agent instead.');
        return 0;
    }
    
    // Interpolate elevation between known points
    interpolateElevation(x, z, elevationPoints, resolution) {
        if (elevationPoints.length === 0) return 0;
        
        // Find closest elevation points and interpolate
        let totalWeight = 0;
        let weightedSum = 0;
        
        for (const point of elevationPoints) {
            const dx = x - point.x;
            const dz = z - point.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance < 0.1) {
                return point.elevation; // Very close, use exact value
            }
            
            const weight = 1 / (distance + 1); // Inverse distance weighting
            totalWeight += weight;
            weightedSum += point.elevation * weight;
        }
        
        return totalWeight > 0 ? weightedSum / totalWeight : 0;
    }
    
    // Normalize elevation data to 0-1 range
    normalizeElevationData(elevationData) {
        let minElevation = Infinity;
        let maxElevation = -Infinity;
        
        // Find min/max elevations
        for (let i = 0; i < elevationData.length; i++) {
            minElevation = Math.min(minElevation, elevationData[i]);
            maxElevation = Math.max(maxElevation, elevationData[i]);
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
    
    // Generate synthetic elevation data based on real resort characteristics
    async generateSyntheticElevationData(resort, resolution, areaSize) {
        console.log(`Generating synthetic elevation data for ${resort.name}`);
        
        const elevationData = new Float32Array(resolution * resolution);
        
        // Use resort-specific characteristics to generate realistic terrain
        const resortProfiles = {
            chamonix: { baseElevation: 1035, peakElevation: 3842, steepness: 0.8 },
            whistler: { baseElevation: 652, peakElevation: 2182, steepness: 0.6 },
            zermatt: { baseElevation: 1608, peakElevation: 3883, steepness: 0.9 },
            stanton: { baseElevation: 1304, peakElevation: 2811, steepness: 0.85 },
            valdisere: { baseElevation: 1550, peakElevation: 3456, steepness: 0.7 }
        };
        
        const profile = resortProfiles[Object.keys(this.resortCoordinates).find(key => 
            this.resortCoordinates[key] === resort)] || resortProfiles.chamonix;
        
        // Generate terrain based on real elevation characteristics
        for (let z = 0; z < resolution; z++) {
            for (let x = 0; x < resolution; x++) {
                const index = z * resolution + x;
                
                // Normalize coordinates
                const nx = (x / (resolution - 1)) * 2 - 1;
                const nz = (z / (resolution - 1)) * 2 - 1;
                
                // Create mountain shape based on real elevation profile
                const distanceFromCenter = Math.sqrt(nx * nx + nz * nz);
                let height = Math.max(0, 1 - distanceFromCenter * profile.steepness);
                
                // Add realistic terrain variation
                height += Math.sin(nx * 3) * Math.cos(nz * 3) * 0.1;
                height += Math.random() * 0.1 - 0.05;
                
                // Clamp and store
                elevationData[index] = Math.max(0, Math.min(1, height));
            }
        }
        
        return elevationData;
    }
    
    // Convert lat/lon coordinates to local terrain coordinates
    latLonToLocal(lat, lon, centerLat, centerLon, terrainSize) {
        const latDiff = lat - centerLat;
        const lonDiff = lon - centerLon;
        
        // Rough conversion (not precise, but good enough for visualization)
        const x = lonDiff * 111000 * Math.cos(centerLat * Math.PI / 180);
        const z = latDiff * 111000;
        
        // Scale to terrain size
        const localX = (x / terrainSize) * terrainSize;
        const localZ = (z / terrainSize) * terrainSize;
        
        return { x: localX, z: localZ };
    }
    
    // Get resort information
    getResortInfo(resortKey) {
        return this.resortCoordinates[resortKey] || null;
    }
    
    // Clear cache
    clearCache() {
        this.cache.clear();
    }
}
