class WeatherSystem {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;
        this.particles = null;
        this.fog = null;
        this.lighting = {
            directionalLight: null,
            ambientLight: null
        };
        
        this.weatherConditions = {
            sunny: {
                fogNear: 1000,
                fogFar: 3000,
                fogColor: 0x87CEEB,
                lightIntensity: 1.0,
                ambientIntensity: 0.6,
                particleCount: 0
            },
            cloudy: {
                fogNear: 500,
                fogFar: 2000,
                fogColor: 0xcccccc,
                lightIntensity: 0.7,
                ambientIntensity: 0.8,
                particleCount: 0
            },
            snowing: {
                fogNear: 200,
                fogFar: 800,
                fogColor: 0xdddddd,
                lightIntensity: 0.5,
                ambientIntensity: 0.9,
                particleCount: 2000
            },
            foggy: {
                fogNear: 50,
                fogFar: 300,
                fogColor: 0xaaaaaa,
                lightIntensity: 0.3,
                ambientIntensity: 1.0,
                particleCount: 0
            }
        };
        
        this.initializeLighting();
    }
    
    initializeLighting() {
        // Directional light (sun)
        this.lighting.directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        this.lighting.directionalLight.position.set(100, 200, 100);
        this.lighting.directionalLight.castShadow = true;
        
        // Configure shadow properties
        this.lighting.directionalLight.shadow.mapSize.width = 2048;
        this.lighting.directionalLight.shadow.mapSize.height = 2048;
        this.lighting.directionalLight.shadow.camera.near = 0.5;
        this.lighting.directionalLight.shadow.camera.far = 1000;
        this.lighting.directionalLight.shadow.camera.left = -500;
        this.lighting.directionalLight.shadow.camera.right = 500;
        this.lighting.directionalLight.shadow.camera.top = 500;
        this.lighting.directionalLight.shadow.camera.bottom = -500;
        
        this.scene.add(this.lighting.directionalLight);
        
        // Ambient light
        this.lighting.ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(this.lighting.ambientLight);
        
        // Enable shadows
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    
    setWeatherCondition(condition) {
        const weather = this.weatherConditions[condition];
        if (!weather) return;
        
        // Update fog
        this.updateFog(weather);
        
        // Update lighting
        this.updateLighting(weather);
        
        // Update particles (snow)
        this.updateParticles(weather);
        
        // Update sky color
        this.updateSkyColor(weather);
    }
    
    updateFog(weather) {
        // Remove existing fog
        if (this.fog) {
            this.scene.fog = null;
        }
        
        // Add new fog
        this.fog = new THREE.Fog(weather.fogColor, weather.fogNear, weather.fogFar);
        this.scene.fog = this.fog;
        
        // Update renderer clear color to match fog
        this.renderer.setClearColor(weather.fogColor);
    }
    
    updateLighting(weather) {
        // Update directional light intensity
        this.lighting.directionalLight.intensity = weather.lightIntensity;
        
        // Update ambient light intensity
        this.lighting.ambientLight.intensity = weather.ambientIntensity;
        
        // Adjust light color based on weather
        if (weather.fogColor === 0x87CEEB) {
            // Sunny - warm light
            this.lighting.directionalLight.color.setHex(0xffffff);
        } else {
            // Overcast - cooler light
            this.lighting.directionalLight.color.setHex(0xf0f0ff);
        }
    }
    
    updateParticles(weather) {
        // Remove existing particles
        if (this.particles) {
            this.scene.remove(this.particles);
            this.particles.geometry.dispose();
            this.particles.material.dispose();
        }
        
        if (weather.particleCount === 0) return;
        
        // Create snow particles
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const velocities = [];
        
        for (let i = 0; i < weather.particleCount; i++) {
            // Random position in a large area above the terrain
            positions.push(
                (Math.random() - 0.5) * 2000, // x
                Math.random() * 500 + 100,    // y
                (Math.random() - 0.5) * 2000  // z
            );
            
            // Random falling velocity
            velocities.push(
                (Math.random() - 0.5) * 2,    // x drift
                -Math.random() * 5 - 2,       // y fall speed
                (Math.random() - 0.5) * 2     // z drift
            );
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.Float32BufferAttribute(velocities, 3));
        
        // Snow particle material
        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 2,
            transparent: true,
            opacity: 0.8
        });
        
        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }
    
    updateSkyColor(weather) {
        // Create a simple sky gradient effect by adjusting the clear color
        let skyColor;
        
        switch(weather.fogColor) {
            case 0x87CEEB: // Sunny
                skyColor = 0x87CEEB;
                break;
            case 0xcccccc: // Cloudy
                skyColor = 0xb0b0b0;
                break;
            case 0xdddddd: // Snowing
                skyColor = 0xc0c0c0;
                break;
            case 0xaaaaaa: // Foggy
                skyColor = 0x909090;
                break;
            default:
                skyColor = 0x87CEEB;
        }
        
        this.renderer.setClearColor(skyColor);
    }
    
    animate() {
        if (!this.particles) return;
        
        // Animate snow particles
        const positions = this.particles.geometry.attributes.position.array;
        const velocities = this.particles.geometry.attributes.velocity.array;
        
        for (let i = 0; i < positions.length; i += 3) {
            // Update position based on velocity
            positions[i] += velocities[i] * 0.016; // x
            positions[i + 1] += velocities[i + 1] * 0.016; // y
            positions[i + 2] += velocities[i + 2] * 0.016; // z
            
            // Reset particles that fall below ground
            if (positions[i + 1] < 0) {
                positions[i] = (Math.random() - 0.5) * 2000;
                positions[i + 1] = Math.random() * 200 + 300;
                positions[i + 2] = (Math.random() - 0.5) * 2000;
            }
            
            // Reset particles that drift too far
            if (Math.abs(positions[i]) > 1000 || Math.abs(positions[i + 2]) > 1000) {
                positions[i] = (Math.random() - 0.5) * 2000;
                positions[i + 2] = (Math.random() - 0.5) * 2000;
            }
        }
        
        this.particles.geometry.attributes.position.needsUpdate = true;
    }
    
    // Get current weather conditions for UI display
    getCurrentConditions() {
        return {
            visibility: this.fog ? `${Math.round(this.fog.far)}m` : 'Unlimited',
            lightLevel: `${Math.round(this.lighting.directionalLight.intensity * 100)}%`,
            precipitation: this.particles ? 'Snow' : 'None'
        };
    }
}

// Expose globally for browser usage
if (typeof window !== 'undefined') {
    window.WeatherSystem = WeatherSystem;
}
