/**
 * Integration tests for module loading and class instantiation
 * These tests catch runtime errors that unit tests with mocks miss
 */

const fs = require('fs');
const path = require('path');

describe('Module Loading Integration Tests', () => {
  let globalScope;
  
  beforeEach(() => {
    // Save current global state
    globalScope = { ...global };
    
    // Set up minimal browser-like environment
    global.window = {
      innerWidth: 1920,
      innerHeight: 1080,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };
    
    global.document = {
      createElement: jest.fn(() => ({
        getContext: jest.fn(() => ({
          canvas: { width: 1920, height: 1080 }
        })),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        style: {}
      })),
      body: {
        appendChild: jest.fn()
      },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };
    
    // Mock THREE.js with essential classes
    global.THREE = {
      Scene: class Scene {
        add() {}
        remove() {}
      },
      PerspectiveCamera: class PerspectiveCamera {
        constructor(fov, aspect, near, far) {
          this.fov = fov;
          this.aspect = aspect;
          this.near = near;
          this.far = far;
          this.position = { set: jest.fn(), copy: jest.fn() };
          this.up = { set: jest.fn() };
        }
        lookAt() {}
        getWorldDirection() {}
      },
      WebGLRenderer: class WebGLRenderer {
        constructor(options) {
          this.domElement = global.document.createElement('canvas');
          this.shadowMap = { enabled: false, type: null };
        }
        setSize() {}
        setClearColor() {}
        render() {}
        dispose() {}
      },
      Vector3: class Vector3 {
        constructor(x = 0, y = 0, z = 0) {
          this.x = x; this.y = y; this.z = z;
        }
        set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
        copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
        add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
        addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
        crossVectors(a, b) { return this; }
        normalize() { return this; }
        length() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); }
      },
      Clock: class Clock {
        getDelta() { return 0.016; }
        getElapsedTime() { return 1.0; }
      },
      PCFSoftShadowMap: 'PCFSoftShadowMap'
    };
  });
  
  afterEach(() => {
    // Restore global state
    Object.keys(global).forEach(key => {
      if (!(key in globalScope)) {
        delete global[key];
      }
    });
    Object.assign(global, globalScope);
  });

  describe('MCPElevationClient Module', () => {
    test('loads and instantiates without errors', () => {
      const clientCode = fs.readFileSync(
        path.join(__dirname, '../../../mcp_client.js'), 
        'utf8'
      );
      
      // This should not throw any reference errors
      expect(() => {
        eval(clientCode);
      }).not.toThrow();
      
      // MCPElevationClient should be defined
      expect(global.MCPElevationClient).toBeDefined();
      expect(typeof global.MCPElevationClient).toBe('function');
      
      // Should be able to instantiate
      expect(() => {
        new global.MCPElevationClient();
      }).not.toThrow();
    });
    
    test('has required methods', () => {
      const clientCode = fs.readFileSync(
        path.join(__dirname, '../../../mcp_client.js'), 
        'utf8'
      );
      eval(clientCode);
      
      const client = new global.MCPElevationClient();
      
      // Check for required methods
      expect(typeof client.initialize).toBe('function');
      expect(typeof client.fetchElevationData).toBe('function');
      expect(typeof client.normalizeElevationData).toBe('function');
      expect(typeof client.cleanup).toBe('function');
    });
  });

  describe('TopographyDataLoader Module', () => {
    test('loads and instantiates without errors', () => {
      // First load MCPElevationClient
      const clientCode = fs.readFileSync(
        path.join(__dirname, '../../../mcp_client.js'), 
        'utf8'
      );
      eval(clientCode);
      
      // Then load topography module
      const topographyCode = fs.readFileSync(
        path.join(__dirname, '../../../js/topography.js'), 
        'utf8'
      );
      
      // This should not throw any reference errors
      expect(() => {
        eval(topographyCode);
      }).not.toThrow();
      
      // TopographyDataLoader should be defined
      expect(global.TopographyDataLoader).toBeDefined();
      expect(typeof global.TopographyDataLoader).toBe('function');
    });
    
    test('initializes MCP client on first use', async () => {
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
      
      // MCP client should be null initially (lazy initialization)
      expect(loader.mcpClient).toBeNull();
      
      // Mock the MCP client's initialize and fetchElevationData methods
      global.MCPElevationClient.prototype.initialize = jest.fn().mockResolvedValue(true);
      global.MCPElevationClient.prototype.fetchElevationData = jest.fn().mockRejectedValue(new Error('MCP failed'));
      
      // After calling fetchElevationData, should fall back to synthetic data
      const result = await loader.fetchElevationData('chamonix');
      
      // Should have fallen back to synthetic data generation
      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(128 * 128); // Default resolution
      
      // MCP client should be initialized
      expect(loader.mcpClient).toBeDefined();
      expect(loader.mcpClient).toBeInstanceOf(global.MCPElevationClient);
    });
    
    test('has all required methods', () => {
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
      
      // Check for required methods
      expect(typeof loader.fetchElevationData).toBe('function');
      expect(typeof loader.generateSyntheticElevationData).toBe('function');
      expect(typeof loader.interpolateElevation).toBe('function');
      expect(typeof loader.latLonToUTM).toBe('function');
      
      // Verify the method that was missing exists
      expect(typeof loader.generateSyntheticElevationData).toBe('function');
      expect(typeof loader.generateEnhancedElevationData).toBe('undefined'); // Should not exist
    });
  });

  describe('Main Application Module', () => {
    test('loads without reference errors', () => {
      // Load all dependencies first
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
      
      // Mock other required classes
      global.MaterialSystem = class MaterialSystem {
        constructor() {}
        createSnowMaterial() { return {}; }
        createRockMaterial() { return {}; }
        createTreeMaterial() { return {}; }
      };
      
      global.TerrainRenderer = class TerrainRenderer {
        constructor() {}
        generateTerrain() { return {}; }
        addTrees() {}
        addRocks() {}
      };
      
      global.CameraController = class CameraController {
        constructor() {}
        update() {}
      };
      
      global.WeatherSystem = class WeatherSystem {
        constructor() {}
        update() {}
      };
      
      // Load main application
      const mainCode = fs.readFileSync(
        path.join(__dirname, '../../../js/main.js'), 
        'utf8'
      );
      
      expect(() => {
        eval(mainCode);
      }).not.toThrow();
      
      expect(global.SkiTerrainApp).toBeDefined();
    });
  });

  describe('Cross-Module Integration', () => {
    test('all modules load together without conflicts', () => {
      const modules = [
        '../../../mcp_client.js',
        '../../../js/materials.js',
        '../../../js/terrain.js', 
        '../../../js/camera.js',
        '../../../js/topography.js',
        '../../../js/main.js'
      ];
      
      // Load all modules in sequence
      modules.forEach(modulePath => {
        const moduleCode = fs.readFileSync(
          path.join(__dirname, modulePath), 
          'utf8'
        );
        
        expect(() => {
          eval(moduleCode);
        }).not.toThrow(`Failed to load ${modulePath}`);
      });
      
      // Verify all expected classes are available
      expect(global.MCPElevationClient).toBeDefined();
      expect(global.MaterialSystem).toBeDefined();
      expect(global.TerrainRenderer).toBeDefined();
      expect(global.CameraController).toBeDefined();
      expect(global.TopographyDataLoader).toBeDefined();
      expect(global.SkiTerrainApp).toBeDefined();
    });
    
    test('main application can instantiate with all dependencies', () => {
      // Load all modules
      const modules = [
        '../../../mcp_client.js',
        '../../../js/materials.js',
        '../../../js/terrain.js',
        '../../../js/camera.js', 
        '../../../js/topography.js',
        '../../../js/main.js'
      ];
      
      modules.forEach(modulePath => {
        const moduleCode = fs.readFileSync(
          path.join(__dirname, modulePath), 
          'utf8'
        );
        eval(moduleCode);
      });
      
      // Should be able to create main app instance
      expect(() => {
        new global.SkiTerrainApp();
      }).not.toThrow();
    });
  });
});
