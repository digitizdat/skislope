/**
 * Integration tests for MCP Client and HTTP Server Bridge
 * Tests the complete MCP protocol integration with the HTTP server proxy
 */

const fs = require('fs');
const path = require('path');

// Load MCP client
const mcpClientCode = fs.readFileSync(path.join(__dirname, '../../../mcp_client.js'), 'utf8');
eval(mcpClientCode);

describe('MCP Integration Tests', () => {
  let client;

  beforeEach(() => {
    client = new MCPElevationClient();
    global.fetch.mockClear();
  });

  describe('End-to-End MCP Communication', () => {
    test('fetches real elevation data through complete pipeline', async () => {
      // Mock successful HTTP response from server.py
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'success',
          elevation_data: new Array(128 * 128).fill(1500),
          resort: 'chamonix',
          resolution: 128,
          area_size: 2000,
          data_points: 128 * 128,
          source: 'Open Topo Data API',
          cache_hit: false
        })
      });

      const result = await client.fetchElevationData('chamonix', 128, 2000);
      
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(128 * 128);
      expect(global.fetch).toHaveBeenCalledWith('/api/elevation?resort=chamonix&resolution=128&area_size=2000');
    });

    test('handles HTTP server API fallback chain', async () => {
      // Mock server response indicating fallback to secondary API
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'success',
          elevation_data: new Array(64 * 64).fill(1200),
          resort: 'whistler',
          resolution: 64,
          area_size: 1500,
          data_points: 64 * 64,
          source: 'Open Elevation API (fallback)',
          cache_hit: false,
          primary_api_failed: true
        })
      });

      const result = await client.fetchElevationData('whistler', 64, 1500);
      
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(64 * 64);
    });

    test('integrates with HTTP server caching', async () => {
      // First request - cache miss
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'success',
          elevation_data: new Array(128 * 128).fill(1800),
          resort: 'zermatt',
          cache_hit: false,
          data_points: 128 * 128
        })
      });

      // Second request - cache hit
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'success',
          elevation_data: new Array(128 * 128).fill(1800),
          resort: 'zermatt',
          cache_hit: true,
          data_points: 128 * 128
        })
      });

      const result1 = await client.fetchElevationData('zermatt', 128, 2000);
      const result2 = await client.fetchElevationData('zermatt', 128, 2000);
      
      expect(result1).toEqual(result2);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('MCP Resource Protocol Compliance', () => {
    test('lists resources in MCP format', async () => {
      const resources = await client.listResources();
      
      // Should follow MCP resource URI format
      resources.forEach(uri => {
        expect(uri).toMatch(/^elevation:\/\/(grid|metadata)\/\w+$/);
      });
      
      expect(resources).toContain('elevation://grid/chamonix');
      expect(resources).toContain('elevation://metadata/chamonix');
    });

    test('reads grid resources correctly', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'success',
          elevation_data: new Array(64 * 64).fill(2000),
          resort: 'stanton',
          resolution: 64,
          area_size: 1500
        })
      });

      const result = await client.readResource('elevation://grid/stanton');
      
      expect(result.success).toBe(true);
      expect(result.resort).toBe('stanton');
      expect(result.elevation_data).toHaveLength(64 * 64);
    });

    test('reads metadata resources correctly', async () => {
      const result = await client.readResource('elevation://metadata/valdisere');
      
      expect(result.name).toBe("Val d'Isère");
      expect(result.country).toBe('France');
      expect(result.lat).toBe(45.4489);
      expect(result.lon).toBe(6.9797);
    });

    test('handles invalid resource URIs', async () => {
      await expect(client.readResource('invalid://uri/format')).rejects.toThrow('Invalid resource URI');
      await expect(client.readResource('elevation://invalid/resource')).rejects.toThrow('Invalid resource URI');
    });
  });

  describe('MCP Tool Protocol Compliance', () => {
    test('calls get_elevation_data tool with correct parameters', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'success',
          elevation_data: new Array(256 * 256).fill(1600),
          resort: 'chamonix',
          resolution: 256,
          area_size: 3000
        })
      });

      const result = await client.callTool('get_elevation_data', {
        resort_key: 'chamonix',
        resolution: 256,
        area_size: 3000
      });

      expect(result.success).toBe(true);
      expect(result.elevation_data).toHaveLength(256 * 256);
      expect(global.fetch).toHaveBeenCalledWith('/api/elevation?resort=chamonix&resolution=256&area_size=3000');
    });

    test('calls get_resort_info tool correctly', async () => {
      const result = await client.callTool('get_resort_info', {
        resort_key: 'whistler'
      });

      expect(result.name).toBe('Whistler Blackcomb');
      expect(result.country).toBe('Canada');
      expect(result.terrain_type).toBe('coastal_range');
    });

    test('handles unknown tools gracefully', async () => {
      await expect(client.callTool('unknown_tool', {})).rejects.toThrow('Unknown tool: unknown_tool');
    });
  });

  describe('HTTP Bridge Error Handling', () => {
    test('handles HTTP 404 errors', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(client.fetchElevationData('unknown_resort')).rejects.toThrow('HTTP 404: Not Found');
    });

    test('handles HTTP 500 server errors', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(client.fetchElevationData('chamonix')).rejects.toThrow('HTTP 500: Internal Server Error');
    });

    test('handles network timeouts', async () => {
      global.fetch.mockRejectedValue(new Error('Network timeout'));

      await expect(client.fetchElevationData('chamonix')).rejects.toThrow('Network timeout');
    });

    test('handles malformed JSON responses', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      await expect(client.fetchElevationData('chamonix')).rejects.toThrow('Invalid JSON');
    });
  });

  describe('Data Consistency and Validation', () => {
    test('validates elevation data consistency across calls', async () => {
      const mockData = new Array(128 * 128).fill(1750);
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'success',
          elevation_data: mockData,
          resort: 'zermatt',
          resolution: 128,
          area_size: 2000
        })
      });

      const result1 = await client.fetchElevationData('zermatt', 128, 2000);
      const result2 = await client.fetchElevationData('zermatt', 128, 2000);
      
      expect(result1).toEqual(result2);
    });

    test('validates resort coordinate consistency', async () => {
      const chamonixInfo = await client.callTool('get_resort_info', { resort_key: 'chamonix' });
      const zermattInfo = await client.callTool('get_resort_info', { resort_key: 'zermatt' });
      
      // Coordinates should be different for different resorts
      expect(chamonixInfo.lat).not.toBe(zermattInfo.lat);
      expect(chamonixInfo.lon).not.toBe(zermattInfo.lon);
      
      // But should be within reasonable European Alpine ranges
      expect(chamonixInfo.lat).toBeGreaterThan(45);
      expect(chamonixInfo.lat).toBeLessThan(48);
      expect(zermattInfo.lat).toBeGreaterThan(45);
      expect(zermattInfo.lat).toBeLessThan(48);
    });

    test('validates elevation data ranges', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'success',
          elevation_data: new Array(64 * 64).fill(2500),
          resort: 'chamonix',
          resolution: 64,
          area_size: 2000
        })
      });

      const result = await client.fetchElevationData('chamonix', 64, 2000);
      
      // Normalized data should be between 0 and 1
      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toBeGreaterThanOrEqual(0);
        expect(result[i]).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Performance and Scalability', () => {
    test('handles concurrent elevation data requests', async () => {
      global.fetch.mockImplementation((url) => {
        const resort = url.includes('chamonix') ? 'chamonix' : 'whistler';
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            status: 'success',
            elevation_data: new Array(64 * 64).fill(1500),
            resort: resort,
            resolution: 64,
            area_size: 2000
          })
        });
      });

      const promises = [
        client.fetchElevationData('chamonix', 64, 2000),
        client.fetchElevationData('whistler', 64, 2000),
        client.fetchElevationData('chamonix', 64, 2000)
      ];

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeInstanceOf(Float32Array);
        expect(result.length).toBe(64 * 64);
      });
    });

    test('maintains performance with large elevation grids', async () => {
      const largeDataArray = new Array(512 * 512).fill(1800);
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'success',
          elevation_data: largeDataArray,
          resort: 'chamonix',
          resolution: 512,
          area_size: 5000
        })
      });

      const start = performance.now();
      const result = await client.fetchElevationData('chamonix', 512, 5000);
      const duration = performance.now() - start;
      
      expect(result.length).toBe(512 * 512);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe('Client State Management', () => {
    test('maintains client state across operations', async () => {
      expect(client.isInitialized).toBe(false);
      
      await client.initialize();
      expect(client.isInitialized).toBe(true);
      
      const resources = await client.listResources();
      expect(resources.length).toBeGreaterThan(0);
      expect(client.isInitialized).toBe(true);
    });

    test('handles client cleanup properly', async () => {
      await client.initialize();
      expect(client.isInitialized).toBe(true);
      
      await client.cleanup();
      expect(client.isInitialized).toBe(false);
      expect(client.serverProcess).toBeNull();
    });

    test('auto-initializes when needed', async () => {
      expect(client.isInitialized).toBe(false);
      
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'success',
          elevation_data: new Array(64 * 64).fill(1400),
          resort: 'stanton'
        })
      });

      await client.fetchElevationData('stanton', 64, 1500);
      expect(client.isInitialized).toBe(true);
    });
  });

  describe('Protocol Compliance Edge Cases', () => {
    test('handles empty elevation data responses', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'success',
          elevation_data: [],
          resort: 'chamonix',
          message: 'No data available for this area'
        })
      });

      const result = await client.fetchElevationData('chamonix', 64, 2000);
      expect(result).toBeNull();
    });

    test('handles partial elevation data responses', async () => {
      const partialData = new Array(32 * 32).fill(1600); // Half the expected size
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'success',
          elevation_data: partialData,
          resort: 'whistler',
          resolution: 64, // Mismatch with actual data size
          area_size: 2000
        })
      });

      const result = await client.fetchElevationData('whistler', 64, 2000);
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(32 * 32);
    });

    test('handles API rate limiting responses', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Map([['Retry-After', '60']])
      });

      await expect(client.fetchElevationData('chamonix')).rejects.toThrow('HTTP 429: Too Many Requests');
    });
  });
});
