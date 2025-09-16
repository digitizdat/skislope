/**
 * Unit tests for MCPElevationClient
 * Tests MCP protocol integration, resource management, and data fetching
 */

// MCPElevationClient is already mocked in setup.js

describe('MCPElevationClient', () => {
  let client;

  beforeEach(() => {
    client = new MCPElevationClient();
    // Reset fetch mock
    global.fetch.mockClear();
  });

  describe('Initialization', () => {
    test('initializes with correct default state', () => {
      expect(client.isInitialized).toBe(false);
      expect(client.resources).toEqual([]);
      expect(client.requestId).toBe(0);
      expect(client.pendingRequests).toBeInstanceOf(Map);
    });

    test('initializes successfully', async () => {
      const result = await client.initialize();
      expect(result).toBe(true);
      expect(client.isInitialized).toBe(true);
      expect(client.resources.length).toBeGreaterThan(0);
    });
  });

  describe('Resource Management', () => {
    test('lists correct resource URIs', async () => {
      const resources = await client.listResources();
      
      expect(resources).toContain('elevation://grid/chamonix');
      expect(resources).toContain('elevation://metadata/chamonix');
      expect(resources).toContain('elevation://grid/whistler');
      expect(resources).toContain('elevation://metadata/whistler');
      expect(resources).toContain('elevation://grid/zermatt');
      expect(resources).toContain('elevation://metadata/zermatt');
      expect(resources).toContain('elevation://grid/stanton');
      expect(resources).toContain('elevation://metadata/stanton');
      expect(resources).toContain('elevation://grid/valdisere');
      expect(resources).toContain('elevation://metadata/valdisere');
    });

    test('parses resource URIs correctly', async () => {
      // Mock successful HTTP response
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'success',
          elevation_data: new Array(128 * 128).fill(1500),
          resort: 'chamonix',
          resolution: 128,
          area_size: 2000,
          data_points: 128 * 128
        })
      });

      const result = await client.readResource('elevation://grid/chamonix');
      expect(result.success).toBe(true);
      expect(result.resort).toBe('chamonix');
    });

    test('handles invalid resource URIs', async () => {
      await expect(client.readResource('invalid://uri')).rejects.toThrow('Invalid resource URI');
    });
  });

  describe('Data Normalization', () => {
    test('normalizes elevation data correctly', () => {
      const input = new Float32Array([1000, 1500, 2000]);
      const normalized = client.normalizeElevationData(input);
      
      expect(normalized[0]).toBe(0);    // min -> 0
      expect(normalized[2]).toBe(1);    // max -> 1
      expect(normalized[1]).toBe(0.5);  // middle -> 0.5
    });

    test('handles uniform elevation data', () => {
      const input = new Float32Array([1500, 1500, 1500]);
      const normalized = client.normalizeElevationData(input);
      
      // All values should be 0.5 when range is 0
      expect(normalized[0]).toBe(0.5);
      expect(normalized[1]).toBe(0.5);
      expect(normalized[2]).toBe(0.5);
    });

    test('handles empty elevation data', () => {
      const result = client.normalizeElevationData(new Float32Array(0));
      expect(result).toBeNull();
    });

    test('handles null elevation data', () => {
      const result = client.normalizeElevationData(null);
      expect(result).toBeNull();
    });
  });

  describe('MCP Tool Calls', () => {
    test('calls get_elevation_data tool successfully', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'success',
          elevation_data: new Array(64 * 64).fill(1200),
          resort: 'whistler',
          resolution: 64,
          area_size: 1500
        })
      });

      const result = await client.callTool('get_elevation_data', {
        resort_key: 'whistler',
        resolution: 64,
        area_size: 1500
      });

      expect(result.success).toBe(true);
      expect(result.resort).toBe('whistler');
      expect(result.elevation_data).toHaveLength(64 * 64);
    });

    test('handles HTTP errors gracefully', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(client.callTool('get_elevation_data', {
        resort_key: 'invalid'
      })).rejects.toThrow('HTTP 500: Internal Server Error');
    });

    test('handles network errors', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      await expect(client.callTool('get_elevation_data', {
        resort_key: 'chamonix'
      })).rejects.toThrow('Network error');
    });

    test('returns resort info for get_resort_info tool', async () => {
      const result = await client.callTool('get_resort_info', {
        resort_key: 'chamonix'
      });

      expect(result.name).toBe('Chamonix-Mont-Blanc');
      expect(result.country).toBe('France');
      expect(result.lat).toBe(45.9237);
      expect(result.lon).toBe(6.8694);
      expect(result.base_elevation).toBe(1035);
    });

    test('returns null for unknown resort', async () => {
      const result = await client.callTool('get_resort_info', {
        resort_key: 'unknown'
      });

      expect(result).toBeNull();
    });

    test('throws error for unknown tool', async () => {
      await expect(client.callTool('unknown_tool', {})).rejects.toThrow('Unknown tool: unknown_tool');
    });
  });

  describe('Elevation Data Fetching', () => {
    test('fetches elevation data successfully', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'success',
          elevation_data: new Array(128 * 128).fill(1800),
          resort: 'zermatt',
          resolution: 128,
          area_size: 2000,
          data_points: 128 * 128
        })
      });

      const result = await client.fetchElevationData('zermatt', 128, 2000);
      
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(128 * 128);
    });

    test('initializes client if not already initialized', async () => {
      client.isInitialized = false;
      
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'success',
          elevation_data: new Array(64 * 64).fill(1000),
          resort: 'stanton',
          data_points: 64 * 64
        })
      });

      await client.fetchElevationData('stanton', 64, 1000);
      expect(client.isInitialized).toBe(true);
    });

    test('handles API failure gracefully', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'error',
          message: 'Resort not found'
        })
      });

      await expect(client.fetchElevationData('invalid')).rejects.toThrow('Resort not found');
    });
  });

  describe('Available Resorts', () => {
    test('returns correct list of available resorts', () => {
      const resorts = client.getAvailableResorts();
      expect(resorts).toEqual(['chamonix', 'whistler', 'zermatt', 'stanton', 'valdisere']);
    });
  });

  describe('Cleanup', () => {
    test('cleans up client state', async () => {
      client.isInitialized = true;
      client.serverProcess = { kill: jest.fn() };
      
      await client.cleanup();
      
      expect(client.isInitialized).toBe(false);
      expect(client.serverProcess).toBeNull();
    });
  });
});
