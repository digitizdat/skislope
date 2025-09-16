/**
 * Integration tests specifically designed to catch the runtime errors
 * that our original testing missed
 */

const fs = require('fs');
const path = require('path');

describe('Runtime Error Detection', () => {
  let originalConsole;
  
  beforeEach(() => {
    // Capture console output to detect errors
    originalConsole = { ...console };
    console.error = jest.fn();
    console.warn = jest.fn();
    
    // Set up minimal browser environment
    global.window = { innerWidth: 1920, innerHeight: 1080 };
    global.document = {
      createElement: jest.fn(() => ({
        getContext: jest.fn(() => ({ canvas: {} })),
        style: {}
      })),
      body: { appendChild: jest.fn() }
    };
    
    // Mock THREE.js
    global.THREE = {
      Scene: class Scene {},
      PerspectiveCamera: class PerspectiveCamera { 
        constructor() { this.position = { set: jest.fn() }; }
      },
      WebGLRenderer: class WebGLRenderer { 
        constructor() { 
          this.domElement = {}; 
          this.shadowMap = {}; 
        } 
      },
      Vector3: class Vector3 { 
        constructor() { this.x = 0; this.y = 0; this.z = 0; }
      },
      Clock: class Clock {}
    };
  });
  
  afterEach(() => {
    Object.assign(console, originalConsole);
  });

  test('detects undefined class references', () => {
    // Test code that would fail with undefined MCPClient
    const problematicCode = `
      class TestLoader {
        constructor() {
          this.client = new MCPClient(); // This should fail
        }
      }
      new TestLoader();
    `;
    
    expect(() => {
      eval(problematicCode);
    }).toThrow(/MCPClient is not defined/);
  });
  
  test('detects missing method calls', () => {
    // Test code that would fail with missing method
    const problematicCode = `
      class TestLoader {
        constructor() {}
        
        async loadData() {
          return await this.generateEnhancedElevationData(); // This should fail
        }
      }
      
      const loader = new TestLoader();
      loader.loadData();
    `;
    
    expect(() => {
      eval(problematicCode);
    }).toThrow(/generateEnhancedElevationData is not a function/);
  });

  test('verifies MCPElevationClient is properly referenced in topography.js', () => {
    // Load MCP client first
    const clientCode = fs.readFileSync(
      path.join(__dirname, '../../../mcp_client.js'), 
      'utf8'
    );
    
    // Should not throw
    expect(() => eval(clientCode)).not.toThrow();
    expect(global.MCPElevationClient).toBeDefined();
    
    // Now load topography - should reference MCPElevationClient, not MCPClient
    const topographyCode = fs.readFileSync(
      path.join(__dirname, '../../../js/topography.js'), 
      'utf8'
    );
    
    // This should not throw undefined variable errors
    expect(() => eval(topographyCode)).not.toThrow();
    expect(global.TopographyDataLoader).toBeDefined();
  });
  
  test('verifies generateSyntheticElevationData method exists', () => {
    // Load dependencies
    const clientCode = fs.readFileSync(
      path.join(__dirname, '../../../mcp_client.js'), 
      'utf8'
    );
    eval(clientCode);
    
    const topographyCode = fs.readFileSync(
      path.join(__dirname, '../../../js/topography.js'), 
      'utf8'
    );
    eval(topographyCode);
    
    const loader = new global.TopographyDataLoader();
    
    // The method that was called in the error should exist
    expect(typeof loader.generateSyntheticElevationData).toBe('function');
    
    // The method that was incorrectly referenced should NOT exist
    expect(typeof loader.generateEnhancedElevationData).toBe('undefined');
  });
  
  test('simulates the original error conditions', async () => {
    // This test simulates the exact conditions that caused the original runtime errors
    
    // Load all dependencies
    const clientCode = fs.readFileSync(
      path.join(__dirname, '../../../mcp_client.js'), 
      'utf8'
    );
    eval(clientCode);
    
    const topographyCode = fs.readFileSync(
      path.join(__dirname, '../../../js/topography.js'), 
      'utf8'
    );
    eval(topographyCode);
    
    // Mock MCP client to fail (simulating network error)
    global.MCPElevationClient.prototype.initialize = jest.fn().mockResolvedValue(true);
    global.MCPElevationClient.prototype.fetchElevationData = jest.fn().mockRejectedValue(
      new Error('Network error')
    );
    
    const loader = new global.TopographyDataLoader();
    
    // This should work without throwing undefined errors
    const result = await loader.fetchElevationData('chamonix', 64, 1000);
    
    // Should fall back to synthetic data
    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(64 * 64);
    
    // Verify MCP client was attempted
    expect(loader.mcpClient).toBeInstanceOf(global.MCPElevationClient);
    expect(loader.mcpClient.initialize).toHaveBeenCalled();
  });
});
