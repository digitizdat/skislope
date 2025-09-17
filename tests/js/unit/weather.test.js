/**
 * Unit tests for WeatherSystem
 * Tests weather effects, particle systems, and environmental conditions
 */

const fs = require('fs');
const path = require('path');

// Read and evaluate the weather.js file
const weatherCode = fs.readFileSync(path.join(__dirname, '../../../js/weather.js'), 'utf8');
eval(weatherCode);

describe('WeatherSystem', () => {
  let weatherSystem;
  let mockScene;

  beforeEach(() => {
    mockScene = new THREE.Scene();
    weatherSystem = new WeatherSystem(mockScene);
  });

  describe('Initialization', () => {
    test('initializes with default clear weather', () => {
      expect(weatherSystem.currentWeather).toBe('clear');
      expect(weatherSystem.scene).toBe(mockScene);
      expect(weatherSystem.particleSystems).toBeDefined();
      expect(weatherSystem.fog).toBeNull();
    });

    test('creates particle system pools', () => {
      expect(weatherSystem.particleSystems.snow).toBeDefined();
      expect(weatherSystem.particleSystems.rain).toBeDefined();
      expect(weatherSystem.particleSystems.wind).toBeDefined();
    });

    test('initializes weather parameters', () => {
      expect(weatherSystem.windSpeed).toBe(0);
      expect(weatherSystem.windDirection).toBe(0);
      expect(weatherSystem.visibility).toBe(1);
      expect(weatherSystem.temperature).toBe(0);
    });
  });

  describe('Weather Conditions', () => {
    test('sets clear weather correctly', () => {
      weatherSystem.setWeather('clear');
      
      expect(weatherSystem.currentWeather).toBe('clear');
      expect(weatherSystem.visibility).toBe(1);
      expect(weatherSystem.fog).toBeNull();
    });

    test('sets snowing weather with particles', () => {
      weatherSystem.setWeather('snowing');
      
      expect(weatherSystem.currentWeather).toBe('snowing');
      expect(weatherSystem.visibility).toBeLessThan(1);
      expect(weatherSystem.particleSystems.snow.visible).toBe(true);
    });

    test('sets foggy weather with reduced visibility', () => {
      weatherSystem.setWeather('foggy');
      
      expect(weatherSystem.currentWeather).toBe('foggy');
      expect(weatherSystem.visibility).toBeLessThan(0.5);
      expect(weatherSystem.fog).toBeDefined();
    });

    test('sets windy weather with particle movement', () => {
      weatherSystem.setWeather('windy');
      
      expect(weatherSystem.currentWeather).toBe('windy');
      expect(weatherSystem.windSpeed).toBeGreaterThan(0);
      expect(weatherSystem.particleSystems.wind.visible).toBe(true);
    });

    test('handles unknown weather conditions gracefully', () => {
      const initialWeather = weatherSystem.currentWeather;
      
      weatherSystem.setWeather('unknown');
      
      // Should either stay on current weather or default to clear
      expect(['clear', initialWeather]).toContain(weatherSystem.currentWeather);
    });
  });

  describe('Particle Systems', () => {
    test('creates snow particles with correct properties', () => {
      const snowSystem = weatherSystem.createSnowParticles();
      
      expect(snowSystem).toBeInstanceOf(THREE.Points);
      expect(snowSystem.geometry.attributes.position).toBeDefined();
      expect(snowSystem.material).toBeInstanceOf(THREE.PointsMaterial);
    });

    test('creates rain particles with appropriate behavior', () => {
      const rainSystem = weatherSystem.createRainParticles();
      
      expect(rainSystem).toBeInstanceOf(THREE.Points);
      expect(rainSystem.geometry.attributes.position).toBeDefined();
      expect(rainSystem.material.size).toBeLessThan(weatherSystem.particleSystems.snow.material.size);
    });

    test('creates wind particles for visual effects', () => {
      const windSystem = weatherSystem.createWindParticles();
      
      expect(windSystem).toBeInstanceOf(THREE.Points);
      expect(windSystem.geometry.attributes.position).toBeDefined();
      expect(windSystem.material.transparent).toBe(true);
    });

    test('updates particle positions over time', () => {
      weatherSystem.setWeather('snowing');
      const initialPositions = [...weatherSystem.particleSystems.snow.geometry.attributes.position.array];
      
      weatherSystem.update(0.016); // 60fps frame
      
      const updatedPositions = weatherSystem.particleSystems.snow.geometry.attributes.position.array;
      expect(updatedPositions).not.toEqual(initialPositions);
    });
  });

  describe('Environmental Effects', () => {
    test('applies fog based on weather conditions', () => {
      weatherSystem.setWeather('foggy');
      
      expect(mockScene.fog).toBeDefined();
      expect(mockScene.fog.near).toBeGreaterThan(0);
      expect(mockScene.fog.far).toBeGreaterThan(mockScene.fog.near);
    });

    test('adjusts fog density for different conditions', () => {
      weatherSystem.setWeather('foggy');
      const foggyDensity = mockScene.fog.density || (mockScene.fog.far - mockScene.fog.near);
      
      weatherSystem.setWeather('snowing');
      const snowyDensity = mockScene.fog ? (mockScene.fog.density || (mockScene.fog.far - mockScene.fog.near)) : 0;
      
      expect(foggyDensity).toBeGreaterThan(snowyDensity);
    });

    test('removes fog for clear weather', () => {
      weatherSystem.setWeather('foggy');
      expect(mockScene.fog).toBeDefined();
      
      weatherSystem.setWeather('clear');
      expect(mockScene.fog).toBeNull();
    });
  });

  describe('Wind Effects', () => {
    test('calculates wind direction correctly', () => {
      weatherSystem.setWindDirection(90); // East
      expect(weatherSystem.windDirection).toBe(90);
      
      weatherSystem.setWindDirection(270); // West
      expect(weatherSystem.windDirection).toBe(270);
    });

    test('applies wind to particle movement', () => {
      weatherSystem.setWeather('snowing');
      weatherSystem.setWindSpeed(5);
      weatherSystem.setWindDirection(180); // South
      
      const initialPositions = [...weatherSystem.particleSystems.snow.geometry.attributes.position.array];
      
      weatherSystem.update(0.1);
      
      const updatedPositions = weatherSystem.particleSystems.snow.geometry.attributes.position.array;
      
      // Particles should move in wind direction
      let movedCount = 0;
      for (let i = 0; i < initialPositions.length; i += 3) {
        if (Math.abs(updatedPositions[i] - initialPositions[i]) > 0.01 ||
            Math.abs(updatedPositions[i + 2] - initialPositions[i + 2]) > 0.01) {
          movedCount++;
        }
      }
      expect(movedCount).toBeGreaterThan(0);
    });

    test('handles extreme wind speeds', () => {
      weatherSystem.setWindSpeed(50); // Very high wind
      expect(weatherSystem.windSpeed).toBeLessThanOrEqual(50);
      
      weatherSystem.setWindSpeed(-10); // Negative wind
      expect(weatherSystem.windSpeed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Temperature Effects', () => {
    test('adjusts particle behavior based on temperature', () => {
      weatherSystem.setTemperature(-10); // Cold
      weatherSystem.setWeather('snowing');
      
      const coldSnowSystem = weatherSystem.particleSystems.snow;
      
      weatherSystem.setTemperature(5); // Warmer
      weatherSystem.setWeather('snowing');
      
      const warmSnowSystem = weatherSystem.particleSystems.snow;
      
      // Different temperatures should affect particle properties
      expect(coldSnowSystem.material.size).not.toBe(warmSnowSystem.material.size);
    });

    test('transitions between snow and rain based on temperature', () => {
      weatherSystem.setTemperature(-5);
      weatherSystem.setWeather('precipitation');
      expect(weatherSystem.particleSystems.snow.visible).toBe(true);
      expect(weatherSystem.particleSystems.rain.visible).toBe(false);
      
      weatherSystem.setTemperature(5);
      weatherSystem.setWeather('precipitation');
      expect(weatherSystem.particleSystems.snow.visible).toBe(false);
      expect(weatherSystem.particleSystems.rain.visible).toBe(true);
    });
  });

  describe('Seasonal Variations', () => {
    test('applies winter weather characteristics', () => {
      weatherSystem.setSeason('winter');
      weatherSystem.setWeather('snowing');
      
      expect(weatherSystem.temperature).toBeLessThan(0);
      expect(weatherSystem.particleSystems.snow.visible).toBe(true);
    });

    test('applies summer weather characteristics', () => {
      weatherSystem.setSeason('summer');
      weatherSystem.setWeather('clear');
      
      expect(weatherSystem.temperature).toBeGreaterThan(0);
      expect(weatherSystem.visibility).toBe(1);
    });

    test('handles season transitions smoothly', () => {
      weatherSystem.setSeason('winter');
      const winterTemp = weatherSystem.temperature;
      
      weatherSystem.setSeason('spring');
      const springTemp = weatherSystem.temperature;
      
      expect(springTemp).toBeGreaterThan(winterTemp);
    });
  });

  describe('Performance Optimization', () => {
    test('limits particle count for performance', () => {
      weatherSystem.setWeather('snowing');
      const particleCount = weatherSystem.particleSystems.snow.geometry.attributes.position.count;
      
      expect(particleCount).toBeLessThanOrEqual(10000); // Reasonable limit
    });

    test('culls particles outside view range', () => {
      weatherSystem.setWeather('snowing');
      
      // Simulate particles moving far from origin
      const positions = weatherSystem.particleSystems.snow.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] = 1000; // Move far away
      }
      
      weatherSystem.update(0.016);
      
      // Some particles should be reset to visible range
      let visibleCount = 0;
      for (let i = 0; i < positions.length; i += 3) {
        if (Math.abs(positions[i]) < 500) {
          visibleCount++;
        }
      }
      expect(visibleCount).toBeGreaterThan(0);
    });

    test('updates efficiently with large particle counts', () => {
      weatherSystem.setWeather('snowing');
      
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        weatherSystem.update(0.016);
      }
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Weather Transitions', () => {
    test('smoothly transitions between weather states', () => {
      weatherSystem.setWeather('clear');
      const _clearVisibility = weatherSystem.visibility;
      
      weatherSystem.transitionToWeather('foggy', 1.0); // 1 second transition
      
      // Should start transitioning
      expect(weatherSystem.isTransitioning).toBe(true);
      expect(weatherSystem.targetWeather).toBe('foggy');
    });

    test('completes weather transitions over time', () => {
      weatherSystem.setWeather('clear');
      weatherSystem.transitionToWeather('snowing', 0.5);
      
      // Simulate transition completion
      weatherSystem.update(0.6); // More than transition time
      
      expect(weatherSystem.currentWeather).toBe('snowing');
      expect(weatherSystem.isTransitioning).toBe(false);
    });

    test('handles interrupted transitions', () => {
      weatherSystem.setWeather('clear');
      weatherSystem.transitionToWeather('foggy', 1.0);
      
      // Interrupt with new transition
      weatherSystem.transitionToWeather('snowing', 0.5);
      
      expect(weatherSystem.targetWeather).toBe('snowing');
    });
  });

  describe('Memory Management', () => {
    test('disposes of particle systems properly', () => {
      weatherSystem.setWeather('snowing');
      
      const snowSystem = weatherSystem.particleSystems.snow;
      snowSystem.geometry.dispose = jest.fn();
      snowSystem.material.dispose = jest.fn();
      
      weatherSystem.dispose();
      
      expect(snowSystem.geometry.dispose).toHaveBeenCalled();
      expect(snowSystem.material.dispose).toHaveBeenCalled();
    });

    test('removes weather objects from scene on disposal', () => {
      weatherSystem.setWeather('snowing');
      const initialChildren = mockScene.children.length;
      
      weatherSystem.dispose();
      
      expect(mockScene.children.length).toBeLessThanOrEqual(initialChildren);
    });
  });

  describe('Real-time Updates', () => {
    test('responds to real-time weather data', () => {
      const weatherData = {
        condition: 'snowing',
        temperature: -5,
        windSpeed: 15,
        windDirection: 225,
        visibility: 0.3
      };
      
      weatherSystem.updateFromRealTimeData(weatherData);
      
      expect(weatherSystem.currentWeather).toBe('snowing');
      expect(weatherSystem.temperature).toBe(-5);
      expect(weatherSystem.windSpeed).toBe(15);
      expect(weatherSystem.windDirection).toBe(225);
      expect(weatherSystem.visibility).toBe(0.3);
    });

    test('validates real-time weather data', () => {
      const invalidData = {
        condition: 'invalid_weather',
        temperature: 'not_a_number',
        windSpeed: -50,
        visibility: 2.0 // > 1.0
      };
      
      expect(() => {
        weatherSystem.updateFromRealTimeData(invalidData);
      }).not.toThrow();
      
      // Should use safe defaults for invalid values
      expect(weatherSystem.windSpeed).toBeGreaterThanOrEqual(0);
      expect(weatherSystem.visibility).toBeLessThanOrEqual(1);
    });
  });

  describe('Audio Integration', () => {
    test('provides audio cues for weather conditions', () => {
      weatherSystem.setWeather('windy');
      const audioData = weatherSystem.getAudioCues();
      
      expect(audioData.windVolume).toBeGreaterThan(0);
      expect(audioData.windFrequency).toBeDefined();
    });

    test('adjusts audio based on weather intensity', () => {
      weatherSystem.setWeather('snowing');
      weatherSystem.setWindSpeed(20);
      
      const highWindAudio = weatherSystem.getAudioCues();
      
      weatherSystem.setWindSpeed(5);
      const lowWindAudio = weatherSystem.getAudioCues();
      
      expect(highWindAudio.windVolume).toBeGreaterThan(lowWindAudio.windVolume);
    });
  });
});
