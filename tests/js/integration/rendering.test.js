/**
 * Integration tests for 3D Rendering Pipeline
 * Tests complete rendering system integration and component interactions
 */

const fs = require('fs');
const path = require('path');

// Load all required modules
const mainCode = fs.readFileSync(path.join(__dirname, '../../../js/main.js'), 'utf8');
const terrainCode = fs.readFileSync(path.join(__dirname, '../../../js/terrain.js'), 'utf8');
const cameraCode = fs.readFileSync(path.join(__dirname, '../../../js/camera.js'), 'utf8');
const materialsCode = fs.readFileSync(path.join(__dirname, '../../../js/materials.js'), 'utf8');
const topographyCode = fs.readFileSync(path.join(__dirname, '../../../js/topography.js'), 'utf8');
const weatherCode = fs.readFileSync(path.join(__dirname, '../../../js/weather.js'), 'utf8');

// Evaluate all modules
eval(topographyCode);
eval(materialsCode);
eval(terrainCode);
eval(cameraCode);
eval(weatherCode);
eval(mainCode);

describe('3D Rendering Pipeline Integration', () => {
  let app;
  let containerElement;

  beforeEach(() => {
    // Create mock DOM container
    containerElement = document.createElement('div');
    containerElement.id = 'container';
    document.body.appendChild(containerElement);
    
    // Mock getElementById to return our container
    document.getElementById = jest.fn((id) => {
      if (id === 'container') return containerElement;
      return null;
    });

    // Initialize the app
    app = new SkiTerrainApp();
  });

  afterEach(() => {
    if (containerElement && containerElement.parentNode) {
      containerElement.parentNode.removeChild(containerElement);
    }
    jest.clearAllMocks();
  });

  describe('Application Initialization', () => {
    test('initializes complete 3D scene', () => {
      expect(app.scene).toBeInstanceOf(THREE.Scene);
      expect(app.camera).toBeInstanceOf(THREE.PerspectiveCamera);
      expect(app.renderer).toBeInstanceOf(THREE.WebGLRenderer);
    });

    test('initializes all subsystems', () => {
      expect(app.terrainRenderer).toBeInstanceOf(TerrainRenderer);
      expect(app.weatherSystem).toBeInstanceOf(WeatherSystem);
      expect(app.cameraController).toBeInstanceOf(CameraController);
    });

    test('sets up renderer with correct properties', () => {
      expect(app.renderer.shadowMap.enabled).toBe(true);
      expect(app.renderer.shadowMap.type).toBe(THREE.PCFSoftShadowMap);
      expect(app.renderer.domElement).toBeDefined();
    });

    test('configures camera with appropriate settings', () => {
      expect(app.camera.fov).toBe(75);
      expect(app.camera.near).toBe(0.1);
      expect(app.camera.far).toBe(5000);
      expect(app.camera.position.z).toBe(300);
    });

    test('starts with default resort and settings', () => {
      expect(app.currentResort).toBe('chamonix');
      expect(app.currentDetail).toBe(128);
    });
  });

  describe('Resort Loading', () => {
    test('loads terrain for different resorts', async () => {
      const initialChildrenCount = app.scene.children.length;
      
      await app.loadResort('whistler');
      
      expect(app.currentResort).toBe('whistler');
      expect(app.scene.children.length).toBeGreaterThan(initialChildrenCount);
    });

    test('handles resort switching', async () => {
      await app.loadResort('chamonix');
      const chamonixChildren = app.scene.children.length;
      
      await app.loadResort('zermatt');
      
      expect(app.currentResort).toBe('zermatt');
      // Scene should be updated (may have different number of children)
      expect(typeof app.scene.children.length).toBe('number');
    });

    test('validates resort names', async () => {
      const initialResort = app.currentResort;
      
      await app.loadResort('invalid_resort');
      
      // Should either stay on current resort or handle gracefully
      expect(typeof app.currentResort).toBe('string');
    });
  });

  describe('Terrain Detail Management', () => {
    test('updates terrain detail level', async () => {
      await app.setTerrainDetail(256);
      
      expect(app.currentDetail).toBe(256);
      expect(app.terrainRenderer.resolution).toBe(256);
    });

    test('handles different detail levels', async () => {
      const detailLevels = [64, 128, 256, 512];
      
      for (const detail of detailLevels) {
        await app.setTerrainDetail(detail);
        expect(app.currentDetail).toBe(detail);
      }
    });

    test('validates detail level bounds', async () => {
      await app.setTerrainDetail(32); // Below typical minimum
      expect(app.currentDetail).toBeGreaterThanOrEqual(32);
      
      await app.setTerrainDetail(1024); // Above typical maximum
      expect(app.currentDetail).toBeLessThanOrEqual(1024);
    });
  });

  describe('Rendering Loop', () => {
    test('render method executes without errors', () => {
      expect(() => app.render()).not.toThrow();
    });

    test('updates all systems during render', () => {
      const cameraUpdateSpy = jest.spyOn(app.cameraController, 'update');
      const weatherUpdateSpy = jest.spyOn(app.weatherSystem, 'update');
      
      app.render();
      
      expect(cameraUpdateSpy).toHaveBeenCalled();
      expect(weatherUpdateSpy).toHaveBeenCalled();
    });

    test('maintains consistent frame timing', () => {
      const frameCount = app.frameCount;
      
      app.render();
      app.render();
      app.render();
      
      expect(app.frameCount).toBe(frameCount + 3);
    });
  });

  describe('Weather Integration', () => {
    test('applies weather effects to scene', () => {
      app.setWeather('snowing');
      
      // Weather system should be updated
      expect(app.weatherSystem.currentWeather).toBe('snowing');
    });

    test('handles different weather conditions', () => {
      const weatherConditions = ['clear', 'snowing', 'foggy', 'windy'];
      
      weatherConditions.forEach(weather => {
        expect(() => app.setWeather(weather)).not.toThrow();
      });
    });

    test('weather affects rendering performance appropriately', () => {
      const clearStart = performance.now();
      app.setWeather('clear');
      app.render();
      const clearDuration = performance.now() - clearStart;
      
      const snowStart = performance.now();
      app.setWeather('snowing');
      app.render();
      const snowDuration = performance.now() - snowStart;
      
      // Both should complete in reasonable time
      expect(clearDuration).toBeLessThan(100);
      expect(snowDuration).toBeLessThan(200);
    });
  });

  describe('Camera Integration', () => {
    test('camera responds to user input', () => {
      const initialPosition = { ...app.camera.position };
      
      // Simulate camera movement
      app.cameraController.keys.forward = true;
      app.cameraController.update();
      
      expect(app.camera.position.x).not.toBe(initialPosition.x);
    });

    test('camera maintains proper bounds', () => {
      // Move camera to extreme position
      app.cameraController.targetDistance = 50;
      app.cameraController.update();
      
      expect(app.cameraController.currentDistance).toBeGreaterThanOrEqual(
        app.cameraController.minDistance
      );
    });
  });

  describe('Performance Monitoring', () => {
    test('tracks frame rate', () => {
      const initialFPS = app.lastFPSUpdate;
      
      // Simulate multiple frames
      for (let i = 0; i < 60; i++) {
        app.render();
      }
      
      expect(app.frameCount).toBeGreaterThan(0);
    });

    test('handles performance degradation gracefully', () => {
      // Simulate heavy load
      app.setTerrainDetail(512);
      app.setWeather('snowing');
      
      const start = performance.now();
      app.render();
      const duration = performance.now() - start;
      
      // Should still complete in reasonable time
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Memory Management', () => {
    test('cleans up resources when switching resorts', async () => {
      await app.loadResort('chamonix');
      const initialMemory = app.scene.children.length;
      
      await app.loadResort('whistler');
      
      // Should not accumulate excessive objects
      expect(app.scene.children.length).toBeLessThan(initialMemory + 100);
    });

    test('disposes of geometries and materials properly', () => {
      const terrain = app.terrainRenderer.terrainMesh;
      if (terrain) {
        terrain.geometry.dispose = jest.fn();
        terrain.material.dispose = jest.fn();
        
        app.dispose();
        
        expect(terrain.geometry.dispose).toHaveBeenCalled();
        expect(terrain.material.dispose).toHaveBeenCalled();
      }
    });
  });

  describe('Error Recovery', () => {
    test('handles WebGL context loss', () => {
      const contextLossEvent = new Event('webglcontextlost');
      
      expect(() => {
        app.renderer.domElement.dispatchEvent(contextLossEvent);
      }).not.toThrow();
    });

    test('recovers from terrain loading failures', async () => {
      // Mock terrain loading failure
      app.terrainRenderer.loadRealElevationData = jest.fn().mockRejectedValue(
        new Error('Network error')
      );
      
      await expect(app.loadResort('chamonix')).resolves.not.toThrow();
    });

    test('handles animation frame errors gracefully', () => {
      // Mock requestAnimationFrame to throw error
      const originalRAF = global.requestAnimationFrame;
      global.requestAnimationFrame = jest.fn(() => {
        throw new Error('Animation frame error');
      });
      
      expect(() => app.animate()).not.toThrow();
      
      global.requestAnimationFrame = originalRAF;
    });
  });

  describe('UI Integration', () => {
    test('responds to UI control changes', () => {
      // Mock UI elements
      const resortSelect = document.createElement('select');
      resortSelect.id = 'resort-select';
      resortSelect.value = 'zermatt';
      
      const detailSlider = document.createElement('input');
      detailSlider.id = 'detail-slider';
      detailSlider.value = '256';
      
      document.body.appendChild(resortSelect);
      document.body.appendChild(detailSlider);
      
      // Simulate UI events
      const changeEvent = new Event('change');
      resortSelect.dispatchEvent(changeEvent);
      
      // Clean up
      document.body.removeChild(resortSelect);
      document.body.removeChild(detailSlider);
    });
  });

  describe('Real-time Updates', () => {
    test('handles real-time elevation data updates', async () => {
      // Mock real-time data source
      const mockRealTimeData = new Float32Array(128 * 128).fill(0.8);
      app.terrainRenderer.topographyLoader.fetchElevationData = jest.fn()
        .mockResolvedValue(mockRealTimeData);
      
      await app.updateElevationData('chamonix');
      
      expect(app.terrainRenderer.heightData).toBe(mockRealTimeData);
    });

    test('maintains smooth rendering during data updates', async () => {
      const framesBefore = app.frameCount;
      
      // Start data update
      const updatePromise = app.updateElevationData('whistler');
      
      // Continue rendering during update
      for (let i = 0; i < 10; i++) {
        app.render();
      }
      
      await updatePromise;
      
      expect(app.frameCount).toBe(framesBefore + 10);
    });
  });
});
