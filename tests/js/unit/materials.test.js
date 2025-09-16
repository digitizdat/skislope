/**
 * Unit tests for MaterialSystem
 * Tests material creation, texture generation, and terrain material blending
 */

const fs = require('fs');
const path = require('path');

// Read and evaluate the materials.js file
const materialsCode = fs.readFileSync(path.join(__dirname, '../../../js/materials.js'), 'utf8');
eval(materialsCode);

describe('MaterialSystem', () => {
  let materialSystem;

  beforeEach(() => {
    materialSystem = new MaterialSystem();
  });

  describe('Initialization', () => {
    test('initializes with empty materials and textures objects', () => {
      const newSystem = new MaterialSystem();
      expect(newSystem.materials).toBeDefined();
      expect(newSystem.textures).toBeDefined();
    });

    test('creates all required textures during initialization', () => {
      expect(materialSystem.textures.snow).toBeDefined();
      expect(materialSystem.textures.snowNormal).toBeDefined();
      expect(materialSystem.textures.ice).toBeDefined();
      expect(materialSystem.textures.iceNormal).toBeDefined();
      expect(materialSystem.textures.rock).toBeDefined();
      expect(materialSystem.textures.rockNormal).toBeDefined();
      expect(materialSystem.textures.groomed).toBeDefined();
      expect(materialSystem.textures.groomedNormal).toBeDefined();
    });

    test('creates all required materials during initialization', () => {
      expect(materialSystem.materials.snow).toBeDefined();
      expect(materialSystem.materials.ice).toBeDefined();
      expect(materialSystem.materials.rock).toBeDefined();
      expect(materialSystem.materials.groomed).toBeDefined();
    });
  });

  describe('Texture Creation', () => {
    test('creates snow texture with correct properties', () => {
      const snowTexture = materialSystem.createSnowTexture();
      expect(snowTexture).toBeInstanceOf(THREE.CanvasTexture);
      expect(snowTexture.wrapS).toBe(THREE.RepeatWrapping);
      expect(snowTexture.wrapT).toBe(THREE.RepeatWrapping);
    });

    test('creates ice texture with transparency', () => {
      const iceTexture = materialSystem.createIceTexture();
      expect(iceTexture).toBeInstanceOf(THREE.CanvasTexture);
    });

    test('creates rock texture with rough appearance', () => {
      const rockTexture = materialSystem.createRockTexture();
      expect(rockTexture).toBeInstanceOf(THREE.CanvasTexture);
    });

    test('creates groomed snow texture with patterns', () => {
      const groomedTexture = materialSystem.createGroomedTexture();
      expect(groomedTexture).toBeInstanceOf(THREE.CanvasTexture);
    });

    test('creates normal maps for all textures', () => {
      expect(materialSystem.createSnowNormalMap()).toBeInstanceOf(THREE.CanvasTexture);
      expect(materialSystem.createIceNormalMap()).toBeInstanceOf(THREE.CanvasTexture);
      expect(materialSystem.createRockNormalMap()).toBeInstanceOf(THREE.CanvasTexture);
      expect(materialSystem.createGroomedNormalMap()).toBeInstanceOf(THREE.CanvasTexture);
    });
  });

  describe('Material Properties', () => {
    test('snow material has correct properties', () => {
      const snowMaterial = materialSystem.materials.snow;
      expect(snowMaterial).toBeInstanceOf(THREE.MeshLambertMaterial);
      expect(snowMaterial.name).toContain('snow');
      expect(snowMaterial.map).toBe(materialSystem.textures.snow);
      expect(snowMaterial.normalMap).toBe(materialSystem.textures.snowNormal);
    });

    test('ice material has transparency', () => {
      const iceMaterial = materialSystem.materials.ice;
      expect(iceMaterial.transparent).toBe(true);
      expect(iceMaterial.opacity).toBeLessThan(1);
      expect(iceMaterial.map).toBe(materialSystem.textures.ice);
    });

    test('rock material has high roughness', () => {
      const rockMaterial = materialSystem.materials.rock;
      expect(rockMaterial.roughness).toBeGreaterThan(0.8);
      expect(rockMaterial.map).toBe(materialSystem.textures.rock);
      expect(rockMaterial.normalMap).toBe(materialSystem.textures.rockNormal);
    });

    test('groomed material has appropriate properties', () => {
      const groomedMaterial = materialSystem.materials.groomed;
      expect(groomedMaterial.map).toBe(materialSystem.textures.groomed);
      expect(groomedMaterial.normalMap).toBe(materialSystem.textures.groomedNormal);
    });
  });

  describe('Terrain Material Blending', () => {
    test('returns snow material for gentle slopes at high elevation', () => {
      const material = materialSystem.getTerrainMaterial(0.1, 2500); // Gentle slope, high elevation
      expect(material.name).toContain('snow');
    });

    test('returns rock material for steep slopes', () => {
      const material = materialSystem.getTerrainMaterial(0.8, 1500); // Steep slope
      expect(material.name).toContain('rock');
    });

    test('returns ice material for very steep slopes at high elevation', () => {
      const material = materialSystem.getTerrainMaterial(0.9, 3000); // Very steep, very high
      expect(material.name).toContain('ice');
    });

    test('returns groomed material for moderate slopes at ski area elevation', () => {
      const material = materialSystem.getTerrainMaterial(0.3, 1800); // Moderate slope, ski area elevation
      expect(material.name).toContain('groomed');
    });

    test('handles edge cases gracefully', () => {
      // Test with extreme values
      expect(() => materialSystem.getTerrainMaterial(0, 0)).not.toThrow();
      expect(() => materialSystem.getTerrainMaterial(1, 5000)).not.toThrow();
      expect(() => materialSystem.getTerrainMaterial(-0.1, -100)).not.toThrow();
    });
  });

  describe('Texture Quality', () => {
    test('textures have appropriate dimensions', () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 512;
      
      // Mock texture creation to verify canvas size
      const originalCreateElement = document.createElement;
      document.createElement = jest.fn((tagName) => {
        if (tagName === 'canvas') {
          const mockCanvas = originalCreateElement.call(document, tagName);
          mockCanvas.width = mockCanvas.height = 512;
          return mockCanvas;
        }
        return originalCreateElement.call(document, tagName);
      });

      const texture = materialSystem.createSnowTexture();
      expect(texture).toBeDefined();

      document.createElement = originalCreateElement;
    });

    test('normal maps provide surface detail', () => {
      const normalMap = materialSystem.createRockNormalMap();
      expect(normalMap).toBeInstanceOf(THREE.CanvasTexture);
      expect(normalMap.format).toBe(THREE.RGBFormat);
    });
  });

  describe('Material Caching', () => {
    test('reuses materials for same parameters', () => {
      const material1 = materialSystem.getTerrainMaterial(0.5, 2000);
      const material2 = materialSystem.getTerrainMaterial(0.5, 2000);
      
      expect(material1).toBe(material2);
    });

    test('creates different materials for different parameters', () => {
      const material1 = materialSystem.getTerrainMaterial(0.2, 1500);
      const material2 = materialSystem.getTerrainMaterial(0.7, 2500);
      
      expect(material1).not.toBe(material2);
    });
  });

  describe('Seasonal Variations', () => {
    test('applies seasonal material variations', () => {
      const winterMaterial = materialSystem.getSeasonalMaterial('winter', 0.3, 2000);
      const summerMaterial = materialSystem.getSeasonalMaterial('summer', 0.3, 2000);
      
      expect(winterMaterial).not.toBe(summerMaterial);
    });

    test('handles unknown seasons gracefully', () => {
      expect(() => {
        materialSystem.getSeasonalMaterial('unknown', 0.5, 1500);
      }).not.toThrow();
    });
  });

  describe('Weather Effects', () => {
    test('applies weather-based material modifications', () => {
      const clearMaterial = materialSystem.getWeatherMaterial('clear', 0.4, 1800);
      const snowyMaterial = materialSystem.getWeatherMaterial('snowing', 0.4, 1800);
      
      expect(clearMaterial).not.toBe(snowyMaterial);
    });

    test('handles different weather conditions', () => {
      const weatherConditions = ['clear', 'snowing', 'foggy', 'windy'];
      
      weatherConditions.forEach(condition => {
        expect(() => {
          materialSystem.getWeatherMaterial(condition, 0.5, 2000);
        }).not.toThrow();
      });
    });
  });

  describe('Performance', () => {
    test('material creation completes within time limit', () => {
      const start = performance.now();
      new MaterialSystem();
      const duration = performance.now() - start;
      
      // Should complete within 1 second
      expect(duration).toBeLessThan(1000);
    });

    test('texture generation is efficient', () => {
      const start = performance.now();
      
      for (let i = 0; i < 10; i++) {
        materialSystem.createSnowTexture();
      }
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(500); // Should be fast
    });
  });

  describe('Memory Management', () => {
    test('disposes of materials properly', () => {
      const material = materialSystem.materials.snow;
      material.dispose = jest.fn();
      
      materialSystem.dispose();
      expect(material.dispose).toHaveBeenCalled();
    });

    test('disposes of textures properly', () => {
      const texture = materialSystem.textures.snow;
      texture.dispose = jest.fn();
      
      materialSystem.dispose();
      expect(texture.dispose).toHaveBeenCalled();
    });
  });
});
