/**
 * Unit tests for TopographyDataLoader
 * Tests real elevation data fetching, MCP client integration, and data caching
 */

const fs = require('fs');
const path = require('path');

// Read and evaluate the topography.js file
const topographyCode = fs.readFileSync(path.join(__dirname, '../../../js/topography.js'), 'utf8');
eval(topographyCode);

describe('TopographyDataLoader', () => {
  let loader;

  beforeEach(() => {
    loader = new TopographyDataLoader();
    global.fetch.mockClear();
  });

  describe('Initialization', () => {
    test('initializes with correct default state', () => {
      expect(loader.apiKey).toBeNull();
      expect(loader.cache).toBeInstanceOf(Map);
      expect(loader.mcpClient).toBeNull();
    });

    test('has correct resort coordinates', () => {
      expect(loader.resortCoordinates.chamonix).toEqual({
        lat: 45.9237,
        lon: 6.8694,
        name: "Chamonix, France"
      });
      expect(loader.resortCoordinates.whistler).toEqual({
        lat: 50.1163,
        lon: -122.9574,
        name: "Whistler, Canada"
      });
      expect(loader.resortCoordinates.zermatt).toEqual({
        lat: 46.0207,
        lon: 7.7491,
        name: "Zermatt, Switzerland"
      });
      expect(loader.resortCoordinates.stanton).toEqual({
        lat: 47.1333,
        lon: 10.2667,
        name: "St. Anton, Austria"
      });
      expect(loader.resortCoordinates.valdisere).toEqual({
        lat: 45.4489,
        lon: 6.9797,
        name: "Val d'Isère, France"
      });
    });

    test('has configured data sources', () => {
      expect(loader.dataSources.opentopography).toBeDefined();
      expect(loader.dataSources.usgs).toBeDefined();
      expect(loader.dataSources.mapbox).toBeDefined();
      
      expect(loader.dataSources.opentopography.requiresKey).toBe(false);
      expect(loader.dataSources.usgs.requiresKey).toBe(false);
      expect(loader.dataSources.mapbox.requiresKey).toBe(true);
    });
  });

  describe('MCP Client Integration', () => {
    test('initializes MCP client when needed', async () => {
      // Mock MCPElevationClient
      global.MCPElevationClient = jest.fn(() => ({
        initialize: jest.fn().mockResolvedValue(true),
        fetchElevationData: jest.fn().mockResolvedValue(new Float32Array(64 * 64).fill(0.5))
      }));

      const result = await loader.fetchElevationData('chamonix', 64, 2000);
      
      expect(global.MCPElevationClient).toHaveBeenCalled();
      expect(loader.mcpClient).toBeDefined();
      expect(result).toBeInstanceOf(Float32Array);
    });

    test('reuses existing MCP client', async () => {
      const mockClient = {
        initialize: jest.fn().mockResolvedValue(true),
        fetchElevationData: jest.fn().mockResolvedValue(new Float32Array(64 * 64).fill(0.7))
      };
      loader.mcpClient = mockClient;

      await loader.fetchElevationData('whistler', 128, 1500);
      
      expect(mockClient.initialize).not.toHaveBeenCalled(); // Should not reinitialize
      expect(mockClient.fetchElevationData).toHaveBeenCalledWith('whistler', 128, 1500);
    });

    test('handles MCP client initialization failure', async () => {
      global.MCPElevationClient = jest.fn(() => ({
        initialize: jest.fn().mockRejectedValue(new Error('MCP init failed'))
      }));

      const result = await loader.fetchElevationData('zermatt', 64, 2000);
      expect(result).toBeNull();
    });
  });

  describe('Cache Management', () => {
    test('caches elevation data', async () => {
      const mockData = new Float32Array(64 * 64).fill(0.8);
      const mockClient = {
        initialize: jest.fn().mockResolvedValue(true),
        fetchElevationData: jest.fn().mockResolvedValue(mockData)
      };
      loader.mcpClient = mockClient;

      // First call
      const result1 = await loader.fetchElevationData('chamonix', 64, 2000);
      expect(mockClient.fetchElevationData).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await loader.fetchElevationData('chamonix', 64, 2000);
      expect(mockClient.fetchElevationData).toHaveBeenCalledTimes(1); // Not called again
      expect(result1).toBe(result2);
    });

    test('uses different cache keys for different parameters', async () => {
      const mockClient = {
        initialize: jest.fn().mockResolvedValue(true),
        fetchElevationData: jest.fn()
          .mockResolvedValueOnce(new Float32Array(64 * 64).fill(0.5))
          .mockResolvedValueOnce(new Float32Array(128 * 128).fill(0.6))
      };
      loader.mcpClient = mockClient;

      await loader.fetchElevationData('chamonix', 64, 2000);
      await loader.fetchElevationData('chamonix', 128, 2000); // Different resolution

      expect(mockClient.fetchElevationData).toHaveBeenCalledTimes(2);
    });

    test('clears cache when requested', () => {
      loader.cache.set('test-key', new Float32Array(10));
      expect(loader.cache.size).toBe(1);
      
      loader.clearCache();
      expect(loader.cache.size).toBe(0);
    });

    test('has cache size limit', async () => {
      const mockClient = {
        initialize: jest.fn().mockResolvedValue(true),
        fetchElevationData: jest.fn().mockResolvedValue(new Float32Array(64 * 64))
      };
      loader.mcpClient = mockClient;

      // Fill cache beyond limit
      for (let i = 0; i < 15; i++) {
        await loader.fetchElevationData(`resort${i}`, 64, 2000);
      }

      // Cache should not exceed reasonable size
      expect(loader.cache.size).toBeLessThanOrEqual(10);
    });
  });

  describe('Fallback Data Generation', () => {
    test('generates synthetic data when real data unavailable', async () => {
      const mockClient = {
        initialize: jest.fn().mockResolvedValue(true),
        fetchElevationData: jest.fn().mockResolvedValue(null)
      };
      loader.mcpClient = mockClient;

      const result = await loader.fetchElevationData('chamonix', 64, 2000);
      
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(64 * 64);
      
      // Should contain reasonable elevation values
      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toBeGreaterThanOrEqual(0);
        expect(result[i]).toBeLessThanOrEqual(1);
      }
    });

    test('applies resort-specific characteristics to synthetic data', () => {
      const chamonixData = loader.generateSyntheticElevation('chamonix', 32);
      const whistlerData = loader.generateSyntheticElevation('whistler', 32);
      
      expect(chamonixData).not.toEqual(whistlerData);
      expect(chamonixData.length).toBe(32 * 32);
      expect(whistlerData.length).toBe(32 * 32);
    });

    test('handles unknown resorts in synthetic generation', () => {
      const result = loader.generateSyntheticElevation('unknown', 16);
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(16 * 16);
    });
  });

  describe('Data Validation', () => {
    test('validates resort keys', () => {
      expect(loader.isValidResort('chamonix')).toBe(true);
      expect(loader.isValidResort('whistler')).toBe(true);
      expect(loader.isValidResort('invalid')).toBe(false);
      expect(loader.isValidResort('')).toBe(false);
      expect(loader.isValidResort(null)).toBe(false);
    });

    test('validates resolution parameters', () => {
      expect(loader.isValidResolution(64)).toBe(true);
      expect(loader.isValidResolution(128)).toBe(true);
      expect(loader.isValidResolution(256)).toBe(true);
      expect(loader.isValidResolution(0)).toBe(false);
      expect(loader.isValidResolution(-1)).toBe(false);
      expect(loader.isValidResolution(1025)).toBe(false); // Too large
    });

    test('validates area size parameters', () => {
      expect(loader.isValidAreaSize(1000)).toBe(true);
      expect(loader.isValidAreaSize(2000)).toBe(true);
      expect(loader.isValidAreaSize(5000)).toBe(true);
      expect(loader.isValidAreaSize(0)).toBe(false);
      expect(loader.isValidAreaSize(-100)).toBe(false);
      expect(loader.isValidAreaSize(50000)).toBe(false); // Too large
    });

    test('validates elevation data arrays', () => {
      const validData = new Float32Array(64 * 64);
      for (let i = 0; i < validData.length; i++) {
        validData[i] = Math.random();
      }
      
      expect(loader.isValidElevationData(validData, 64)).toBe(true);
      expect(loader.isValidElevationData(null, 64)).toBe(false);
      expect(loader.isValidElevationData(new Float32Array(32 * 32), 64)).toBe(false); // Wrong size
      
      const invalidData = new Float32Array(64 * 64).fill(-1); // Invalid values
      expect(loader.isValidElevationData(invalidData, 64)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('handles network errors gracefully', async () => {
      const mockClient = {
        initialize: jest.fn().mockResolvedValue(true),
        fetchElevationData: jest.fn().mockRejectedValue(new Error('Network error'))
      };
      loader.mcpClient = mockClient;

      const result = await loader.fetchElevationData('chamonix', 64, 2000);
      
      // Should fall back to synthetic data
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(64 * 64);
    });

    test('handles invalid parameters gracefully', async () => {
      const result = await loader.fetchElevationData('invalid_resort', -1, 0);
      expect(result).toBeNull();
    });

    test('handles MCP client creation failure', async () => {
      global.MCPElevationClient = jest.fn(() => {
        throw new Error('Client creation failed');
      });

      const result = await loader.fetchElevationData('chamonix', 64, 2000);
      expect(result).toBeInstanceOf(Float32Array); // Should fall back to synthetic
    });
  });

  describe('Performance', () => {
    test('completes elevation data fetch within time limit', async () => {
      const mockClient = {
        initialize: jest.fn().mockResolvedValue(true),
        fetchElevationData: jest.fn().mockResolvedValue(new Float32Array(128 * 128).fill(0.5))
      };
      loader.mcpClient = mockClient;

      const start = performance.now();
      await loader.fetchElevationData('chamonix', 128, 2000);
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(5000); // 5 seconds max
    });

    test('synthetic data generation is fast', () => {
      const start = performance.now();
      loader.generateSyntheticElevation('chamonix', 256);
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(1000); // 1 second max
    });
  });

  describe('Data Source Configuration', () => {
    test('selects appropriate data source based on requirements', () => {
      const source = loader.selectDataSource(false); // No API key
      expect(source.requiresKey).toBe(false);
    });

    test('prioritizes higher quality sources when available', () => {
      loader.apiKey = 'test-key';
      const source = loader.selectDataSource(true); // Has API key
      expect(source.resolution).toBeGreaterThanOrEqual(30);
    });
  });

  describe('Coordinate System Handling', () => {
    test('converts between coordinate systems correctly', () => {
      const latLon = { lat: 45.9237, lon: 6.8694 };
      const utm = loader.latLonToUTM(latLon.lat, latLon.lon);
      
      expect(utm.x).toBeDefined();
      expect(utm.y).toBeDefined();
      expect(utm.zone).toBeDefined();
    });

    test('calculates grid coordinates for elevation sampling', () => {
      const resort = loader.resortCoordinates.chamonix;
      const grid = loader.calculateElevationGrid(resort, 64, 2000);
      
      expect(grid).toHaveLength(64 * 64);
      grid.forEach(point => {
        expect(point.lat).toBeDefined();
        expect(point.lon).toBeDefined();
      });
    });
  });
});
