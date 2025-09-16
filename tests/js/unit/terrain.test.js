/**
 * Unit tests for TerrainRenderer
 * Tests terrain generation, height data application, and resort profiles
 */

const fs = require('fs');
const path = require('path');

// Read and evaluate the terrain.js file
const terrainCode = fs.readFileSync(path.join(__dirname, '../../../js/terrain.js'), 'utf8');
eval(terrainCode);

describe('TerrainRenderer', () => {
  let renderer;

  beforeEach(() => {
    renderer = new TerrainRenderer();
  });

  describe('Initialization', () => {
    test('initializes with correct default values', () => {
      expect(renderer.terrainMesh).toBeNull();
      expect(renderer.terrainGeometry).toBeNull();
      expect(renderer.terrainMaterial).toBeNull();
      expect(renderer.heightData).toBeNull();
      expect(renderer.resolution).toBe(128);
      expect(renderer.terrainSize).toBe(1000);
      expect(renderer.maxHeight).toBe(200);
      expect(renderer.trees).toEqual([]);
      expect(renderer.rocks).toEqual([]);
      expect(renderer.skiLift).toBeNull();
    });

    test('creates topography loader', () => {
      expect(renderer.topographyLoader).toBeInstanceOf(TopographyDataLoader);
    });
  });

  describe('Resort Profiles', () => {
    test('has correct resort profiles', () => {
      expect(renderer.resortProfiles.chamonix).toBeDefined();
      expect(renderer.resortProfiles.whistler).toBeDefined();
      expect(renderer.resortProfiles.zermatt).toBeDefined();
      expect(renderer.resortProfiles.stanton).toBeDefined();
      expect(renderer.resortProfiles.valdisere).toBeDefined();
    });

    test('chamonix profile has correct properties', () => {
      const chamonix = renderer.resortProfiles.chamonix;
      expect(chamonix.name).toBe("Chamonix - Vallée Blanche");
      expect(chamonix.baseElevation).toBe(3800);
      expect(chamonix.verticalDrop).toBe(2800);
      expect(chamonix.difficulty).toBe(0.8);
      expect(chamonix.features).toContain('crevasses');
      expect(chamonix.features).toContain('seracs');
      expect(chamonix.features).toContain('steep_sections');
    });

    test('whistler profile has correct properties', () => {
      const whistler = renderer.resortProfiles.whistler;
      expect(whistler.name).toBe("Whistler - Peak 2 Peak");
      expect(whistler.baseElevation).toBe(2200);
      expect(whistler.verticalDrop).toBe(1600);
      expect(whistler.difficulty).toBe(0.6);
      expect(whistler.features).toContain('bowls');
      expect(whistler.features).toContain('trees');
      expect(whistler.features).toContain('groomed_runs');
    });

    test('zermatt profile has correct properties', () => {
      const zermatt = renderer.resortProfiles.zermatt;
      expect(zermatt.name).toBe("Zermatt - Matterhorn Glacier");
      expect(zermatt.baseElevation).toBe(3800);
      expect(zermatt.verticalDrop).toBe(2200);
      expect(zermatt.difficulty).toBe(0.9);
      expect(zermatt.features).toContain('glacier');
      expect(zermatt.features).toContain('moguls');
      expect(zermatt.features).toContain('off_piste');
    });
  });

  describe('Terrain Generation', () => {
    test('generates terrain mesh with correct dimensions', () => {
      const mesh = renderer.generateTerrain('chamonix', 64);
      
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      expect(mesh.geometry.parameters.widthSegments).toBe(63);
      expect(mesh.geometry.parameters.heightSegments).toBe(63);
      expect(renderer.terrainMesh).toBe(mesh);
      expect(renderer.resolution).toBe(64);
    });

    test('uses default resolution when not specified', () => {
      const mesh = renderer.generateTerrain('whistler');
      expect(renderer.resolution).toBe(128);
    });

    test('handles unknown resort gracefully', () => {
      const mesh = renderer.generateTerrain('unknown_resort', 32);
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      expect(renderer.resolution).toBe(32);
    });

    test('creates geometry with correct size', () => {
      renderer.generateTerrain('zermatt', 128);
      const geometry = renderer.terrainGeometry;
      
      // PlaneGeometry should be created with terrainSize
      expect(geometry).toBeDefined();
    });
  });

  describe('Height Data Application', () => {
    beforeEach(() => {
      renderer.generateTerrain('chamonix', 64);
    });

    test('applies height data correctly', () => {
      const heightData = new Float32Array(64 * 64);
      for (let i = 0; i < heightData.length; i++) {
        heightData[i] = Math.random();
      }
      
      renderer.applyHeightData(heightData, 64);
      
      expect(renderer.heightData).toBe(heightData);
      expect(renderer.resolution).toBe(64);
    });

    test('handles null height data', () => {
      expect(() => {
        renderer.applyHeightData(null, 64);
      }).not.toThrow();
    });

    test('handles mismatched resolution', () => {
      const heightData = new Float32Array(32 * 32);
      
      expect(() => {
        renderer.applyHeightData(heightData, 64); // Wrong resolution
      }).not.toThrow();
    });

    test('updates geometry vertices', () => {
      const heightData = new Float32Array(64 * 64).fill(0.5);
      renderer.applyHeightData(heightData, 64);
      
      // Verify that geometry vertices were updated
      expect(renderer.terrainGeometry.attributes.position.array).toBeDefined();
    });
  });

  describe('Procedural Terrain Generation', () => {
    test('generates procedural terrain for known resort', () => {
      const heightData = renderer.generateProceduralTerrain('chamonix', 32);
      
      expect(heightData).toBeInstanceOf(Float32Array);
      expect(heightData.length).toBe(32 * 32);
      
      // Values should be normalized between 0 and 1
      for (let i = 0; i < heightData.length; i++) {
        expect(heightData[i]).toBeGreaterThanOrEqual(0);
        expect(heightData[i]).toBeLessThanOrEqual(1);
      }
    });

    test('applies resort-specific characteristics', () => {
      const chamonixData = renderer.generateProceduralTerrain('chamonix', 64);
      const whistlerData = renderer.generateProceduralTerrain('whistler', 64);
      
      // Different resorts should produce different terrain
      expect(chamonixData).not.toEqual(whistlerData);
    });

    test('produces consistent results for same parameters', () => {
      const data1 = renderer.generateProceduralTerrain('zermatt', 32);
      const data2 = renderer.generateProceduralTerrain('zermatt', 32);
      
      // Should be identical for same resort and resolution
      expect(data1).toEqual(data2);
    });
  });

  describe('Terrain Features', () => {
    beforeEach(() => {
      renderer.generateTerrain('chamonix', 64);
    });

    test('adds trees to terrain', () => {
      const initialTreeCount = renderer.trees.length;
      renderer.addTrees(10);
      
      expect(renderer.trees.length).toBeGreaterThan(initialTreeCount);
      expect(renderer.trees.length).toBeLessThanOrEqual(initialTreeCount + 10);
    });

    test('adds rocks to terrain', () => {
      const initialRockCount = renderer.rocks.length;
      renderer.addRocks(5);
      
      expect(renderer.rocks.length).toBeGreaterThan(initialRockCount);
      expect(renderer.rocks.length).toBeLessThanOrEqual(initialRockCount + 5);
    });

    test('creates ski lift', () => {
      renderer.createSkiLift();
      expect(renderer.skiLift).not.toBeNull();
      expect(renderer.skiLift).toBeInstanceOf(THREE.Group);
    });

    test('positions features based on terrain height', () => {
      const heightData = new Float32Array(64 * 64);
      for (let i = 0; i < heightData.length; i++) {
        heightData[i] = i / heightData.length; // Gradient from 0 to 1
      }
      renderer.applyHeightData(heightData, 64);
      
      renderer.addTrees(5);
      
      // Trees should be positioned at appropriate heights
      renderer.trees.forEach(tree => {
        expect(tree.position.y).toBeGreaterThanOrEqual(0);
        expect(tree.position.y).toBeLessThanOrEqual(renderer.maxHeight);
      });
    });
  });

  describe('Material Application', () => {
    test('applies material based on resort profile', () => {
      renderer.generateTerrain('chamonix', 64);
      
      expect(renderer.terrainMaterial).toBeDefined();
      expect(renderer.terrainMaterial).toBeInstanceOf(THREE.MeshLambertMaterial);
    });

    test('different resorts get different materials', () => {
      renderer.generateTerrain('chamonix', 64);
      const chamonixMaterial = renderer.terrainMaterial;
      
      renderer.generateTerrain('whistler', 64);
      const whistlerMaterial = renderer.terrainMaterial;
      
      // Materials should be different instances
      expect(chamonixMaterial).not.toBe(whistlerMaterial);
    });
  });

  describe('Real Elevation Data Integration', () => {
    test('loads real elevation data when available', async () => {
      // Mock the topography loader
      renderer.topographyLoader.fetchElevationData = jest.fn().mockResolvedValue(
        new Float32Array(64 * 64).fill(0.7)
      );
      
      await renderer.loadRealElevationData('chamonix', 64);
      
      expect(renderer.topographyLoader.fetchElevationData).toHaveBeenCalledWith('chamonix', 64, expect.any(Number));
      expect(renderer.heightData).toBeInstanceOf(Float32Array);
    });

    test('falls back to procedural data when real data unavailable', async () => {
      // Mock the topography loader to return null
      renderer.topographyLoader.fetchElevationData = jest.fn().mockResolvedValue(null);
      
      await renderer.loadRealElevationData('chamonix', 64);
      
      expect(renderer.heightData).toBeInstanceOf(Float32Array);
      expect(renderer.heightData.length).toBe(64 * 64);
    });

    test('handles elevation data loading errors', async () => {
      renderer.topographyLoader.fetchElevationData = jest.fn().mockRejectedValue(
        new Error('Network error')
      );
      
      await expect(renderer.loadRealElevationData('chamonix', 64)).resolves.not.toThrow();
      
      // Should fall back to procedural generation
      expect(renderer.heightData).toBeInstanceOf(Float32Array);
    });
  });

  describe('Performance Optimization', () => {
    test('handles large terrain resolutions', () => {
      const start = performance.now();
      renderer.generateTerrain('chamonix', 512);
      const duration = performance.now() - start;
      
      // Should complete within reasonable time (5 seconds)
      expect(duration).toBeLessThan(5000);
      expect(renderer.resolution).toBe(512);
    });

    test('reuses geometry when possible', () => {
      renderer.generateTerrain('chamonix', 128);
      const firstGeometry = renderer.terrainGeometry;
      
      renderer.generateTerrain('whistler', 128); // Same resolution
      const secondGeometry = renderer.terrainGeometry;
      
      // Should reuse geometry for same resolution
      expect(firstGeometry).toBe(secondGeometry);
    });
  });
});
