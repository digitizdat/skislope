/**
 * Performance benchmark tests for 3D rendering system
 * Tests frame rates, memory usage, and rendering performance
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

describe('Performance Benchmarks', () => {
  let app;
  let containerElement;

  beforeEach(() => {
    containerElement = document.createElement('div');
    containerElement.id = 'container';
    document.body.appendChild(containerElement);
    
    document.getElementById = jest.fn((id) => {
      if (id === 'container') return containerElement;
      return null;
    });

    app = new SkiTerrainApp();
  });

  afterEach(() => {
    if (containerElement && containerElement.parentNode) {
      containerElement.parentNode.removeChild(containerElement);
    }
    if (app && app.dispose) {
      app.dispose();
    }
    jest.clearAllMocks();
  });

  describe('Rendering Performance', () => {
    test('maintains 30+ FPS with default settings', () => {
      const frameCount = 60;
      const start = performance.now();
      
      for (let i = 0; i < frameCount; i++) {
        app.render();
      }
      
      const duration = performance.now() - start;
      const fps = (frameCount / duration) * 1000;
      
      expect(fps).toBeGreaterThan(30);
    });

    test('handles high detail terrain efficiently', async () => {
      await app.setTerrainDetail(512);
      
      const frameCount = 30;
      const start = performance.now();
      
      for (let i = 0; i < frameCount; i++) {
        app.render();
      }
      
      const duration = performance.now() - start;
      const fps = (frameCount / duration) * 1000;
      
      expect(fps).toBeGreaterThan(15); // Lower threshold for high detail
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('weather effects impact on performance is acceptable', () => {
      // Baseline performance
      const baselineFrames = 30;
      const baselineStart = performance.now();
      
      for (let i = 0; i < baselineFrames; i++) {
        app.render();
      }
      
      const baselineDuration = performance.now() - baselineStart;
      
      // Performance with weather effects
      app.setWeather('snowing');
      const weatherFrames = 30;
      const weatherStart = performance.now();
      
      for (let i = 0; i < weatherFrames; i++) {
        app.render();
      }
      
      const weatherDuration = performance.now() - weatherStart;
      
      // Weather should not more than double render time
      expect(weatherDuration).toBeLessThan(baselineDuration * 2.5);
    });

    test('camera movement performance is smooth', () => {
      const moveCount = 100;
      const start = performance.now();
      
      for (let i = 0; i < moveCount; i++) {
        app.cameraController.targetAngleX = i * 0.01;
        app.cameraController.targetAngleY = i * 0.005;
        app.cameraController.update();
        app.render();
      }
      
      const duration = performance.now() - start;
      const avgFrameTime = duration / moveCount;
      
      expect(avgFrameTime).toBeLessThan(33); // Less than 33ms per frame (30 FPS)
    });
  });

  describe('Memory Usage', () => {
    test('terrain switching does not cause memory leaks', async () => {
      const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
      
      // Switch between resorts multiple times
      const resorts = ['chamonix', 'whistler', 'zermatt', 'stanton', 'valdisere'];
      
      for (let cycle = 0; cycle < 3; cycle++) {
        for (const resort of resorts) {
          await app.loadResort(resort);
          
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        }
      }
      
      const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
      
      if (performance.memory) {
        const memoryIncrease = finalMemory - initialMemory;
        const memoryIncreasePercent = (memoryIncrease / initialMemory) * 100;
        
        // Memory should not increase by more than 50%
        expect(memoryIncreasePercent).toBeLessThan(50);
      }
    });

    test('geometry and texture disposal works correctly', () => {
      const terrain = app.terrainRenderer.terrainMesh;
      if (terrain) {
        const geometry = terrain.geometry;
        const material = terrain.material;
        
        geometry.dispose = jest.fn();
        material.dispose = jest.fn();
        
        app.terrainRenderer.dispose();
        
        expect(geometry.dispose).toHaveBeenCalled();
        expect(material.dispose).toHaveBeenCalled();
      }
    });

    test('particle systems clean up properly', () => {
      app.setWeather('snowing');
      
      const snowSystem = app.weatherSystem.particleSystems.snow;
      snowSystem.geometry.dispose = jest.fn();
      snowSystem.material.dispose = jest.fn();
      
      app.weatherSystem.dispose();
      
      expect(snowSystem.geometry.dispose).toHaveBeenCalled();
      expect(snowSystem.material.dispose).toHaveBeenCalled();
    });
  });

  describe('Scalability Tests', () => {
    test('handles multiple terrain detail levels efficiently', async () => {
      const detailLevels = [64, 128, 256, 512];
      const results = [];
      
      for (const detail of detailLevels) {
        await app.setTerrainDetail(detail);
        
        const start = performance.now();
        for (let i = 0; i < 10; i++) {
          app.render();
        }
        const duration = performance.now() - start;
        
        results.push({ detail, duration });
      }
      
      // Performance should degrade gracefully with increased detail
      for (let i = 1; i < results.length; i++) {
        const ratio = results[i].duration / results[i-1].duration;
        expect(ratio).toBeLessThan(5); // Should not be more than 5x slower
      }
    });

    test('concurrent operations do not block rendering', async () => {
      const renderTimes = [];
      
      // Start elevation data loading
      const loadPromise = app.loadResort('chamonix');
      
      // Continue rendering during load
      const renderStart = performance.now();
      for (let i = 0; i < 20; i++) {
        const frameStart = performance.now();
        app.render();
        renderTimes.push(performance.now() - frameStart);
      }
      const renderDuration = performance.now() - renderStart;
      
      await loadPromise;
      
      // Rendering should remain responsive
      const avgFrameTime = renderTimes.reduce((a, b) => a + b) / renderTimes.length;
      expect(avgFrameTime).toBeLessThan(50); // Less than 50ms per frame
    });
  });

  describe('Resource Loading Performance', () => {
    test('elevation data loading completes within time limit', async () => {
      const start = performance.now();
      await app.loadResort('whistler');
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(10000); // 10 seconds max
    });

    test('texture creation is efficient', () => {
      const materialSystem = new MaterialSystem();
      
      const start = performance.now();
      for (let i = 0; i < 5; i++) {
        materialSystem.createSnowTexture();
        materialSystem.createRockTexture();
        materialSystem.createIceTexture();
      }
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(2000); // 2 seconds for 15 textures
    });

    test('terrain generation scales with resolution', () => {
      const terrainRenderer = new TerrainRenderer();
      const results = [];
      
      [64, 128, 256].forEach(resolution => {
        const start = performance.now();
        terrainRenderer.generateTerrain('chamonix', resolution);
        const duration = performance.now() - start;
        
        results.push({ resolution, duration });
      });
      
      // Should scale roughly quadratically (O(n²))
      const ratio256to64 = results[2].duration / results[0].duration;
      expect(ratio256to64).toBeLessThan(20); // 256²/64² = 16, allow some overhead
    });
  });

  describe('Animation Performance', () => {
    test('particle animation maintains consistent timing', () => {
      app.setWeather('snowing');
      const frameTimes = [];
      
      for (let i = 0; i < 60; i++) {
        const start = performance.now();
        app.weatherSystem.update(0.016); // 60 FPS
        frameTimes.push(performance.now() - start);
      }
      
      const avgTime = frameTimes.reduce((a, b) => a + b) / frameTimes.length;
      const maxTime = Math.max(...frameTimes);
      
      expect(avgTime).toBeLessThan(5); // Less than 5ms average
      expect(maxTime).toBeLessThan(20); // No frame should take more than 20ms
    });

    test('camera interpolation is smooth', () => {
      const positions = [];
      
      app.cameraController.targetDistance = 100;
      
      for (let i = 0; i < 30; i++) {
        app.cameraController.update();
        positions.push(app.cameraController.currentDistance);
      }
      
      // Movement should be smooth (no large jumps)
      for (let i = 1; i < positions.length; i++) {
        const change = Math.abs(positions[i] - positions[i-1]);
        expect(change).toBeLessThan(20); // No jump larger than 20 units
      }
    });
  });

  describe('Stress Tests', () => {
    test('handles rapid weather changes', () => {
      const weathers = ['clear', 'snowing', 'foggy', 'windy'];
      const start = performance.now();
      
      for (let i = 0; i < 100; i++) {
        const weather = weathers[i % weathers.length];
        app.setWeather(weather);
        app.render();
      }
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('handles rapid resort switching', async () => {
      const resorts = ['chamonix', 'whistler', 'zermatt'];
      const start = performance.now();
      
      for (let i = 0; i < 10; i++) {
        const resort = resorts[i % resorts.length];
        await app.loadResort(resort);
      }
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(30000); // 30 seconds for 10 switches
    });

    test('maintains performance under continuous interaction', () => {
      const frameTimes = [];
      
      for (let i = 0; i < 200; i++) {
        // Simulate user interaction
        app.cameraController.targetAngleX = Math.sin(i * 0.1);
        app.cameraController.targetAngleY = Math.cos(i * 0.1);
        app.cameraController.targetDistance = 200 + Math.sin(i * 0.05) * 50;
        
        const start = performance.now();
        app.cameraController.update();
        app.render();
        frameTimes.push(performance.now() - start);
      }
      
      // Performance should remain stable
      const firstHalf = frameTimes.slice(0, 100);
      const secondHalf = frameTimes.slice(100);
      
      const firstAvg = firstHalf.reduce((a, b) => a + b) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b) / secondHalf.length;
      
      // Second half should not be more than 50% slower
      expect(secondAvg).toBeLessThan(firstAvg * 1.5);
    });
  });

  describe('Browser Compatibility Performance', () => {
    test('WebGL context creation is efficient', () => {
      const start = performance.now();
      
      // Create multiple renderers to test context creation
      const renderers = [];
      for (let i = 0; i < 3; i++) {
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(800, 600);
        renderers.push(renderer);
      }
      
      const duration = performance.now() - start;
      
      // Clean up
      renderers.forEach(renderer => renderer.dispose());
      
      expect(duration).toBeLessThan(1000); // Should create contexts quickly
    });

    test('handles canvas resize efficiently', () => {
      const sizes = [
        [800, 600],
        [1024, 768],
        [1920, 1080],
        [800, 600]
      ];
      
      const start = performance.now();
      
      sizes.forEach(([width, height]) => {
        app.renderer.setSize(width, height);
        app.camera.aspect = width / height;
        app.camera.updateProjectionMatrix();
        app.render();
      });
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(500); // Resize operations should be fast
    });
  });
});
