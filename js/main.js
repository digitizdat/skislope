class SkiTerrainApp {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.terrainRenderer = null;
        this.weatherSystem = null;
        this.cameraController = null;
        
        this.clock = new THREE.Clock();
        this.frameCount = 0;
        this.lastFPSUpdate = 0;
        
        this.currentResort = 'chamonix';
        this.currentDetail = 128;
        
        this.init();
        this.setupUI();
        this.animate();
    }
    
    init() {
        // Create scene
        this.scene = new THREE.Scene();
        
        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            75, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            5000
        );
        this.camera.position.set(0, 100, 300);
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('container').appendChild(this.renderer.domElement);
        
        // Initialize systems
        this.terrainRenderer = new TerrainRenderer();
        this.weatherSystem = new WeatherSystem(this.scene, this.renderer);
        this.cameraController = new CameraController(this.camera, this.renderer.domElement);
        
        // Generate initial terrain
        this.generateTerrain();
        
        // Set initial weather
        this.weatherSystem.setWeatherCondition('sunny');
        
        // Set better initial camera position for mountain view
        this.cameraController.target.set(0, 100, 0);
        this.cameraController.targetDistance = 400;
        this.cameraController.phi = Math.PI / 3;
        this.cameraController.theta = 0;
        this.cameraController.updateCamera();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    setupUI() {
        // Resort selection
        const resortSelect = document.getElementById('resortSelect');
        resortSelect.addEventListener('change', (event) => {
            this.currentResort = event.target.value;
            this.generateTerrain();
        });
        
        // Detail slider
        const detailSlider = document.getElementById('detailSlider');
        const detailValue = document.getElementById('detailValue');
        detailSlider.addEventListener('input', (event) => {
            this.currentDetail = parseInt(event.target.value);
            detailValue.textContent = `${this.currentDetail}x${this.currentDetail}`;
            this.terrainRenderer.resolution = this.currentDetail;
        });
        
        // Snow conditions
        const snowConditions = document.getElementById('snowConditions');
        snowConditions.addEventListener('change', (event) => {
            this.terrainRenderer.updateSnowConditions(event.target.value);
        });
        
        // Weather
        const weather = document.getElementById('weather');
        weather.addEventListener('change', (event) => {
            this.weatherSystem.setWeatherCondition(event.target.value);
        });
        
        // Generate terrain button
        const generateButton = document.getElementById('generateTerrain');
        generateButton.addEventListener('click', () => {
            this.generateTerrain();
        });
        
        // Reset camera button
        const resetButton = document.getElementById('resetCamera');
        resetButton.addEventListener('click', () => {
            this.cameraController.resetView();
        });
        
        // Add preset view buttons
        this.addPresetViewButtons();
    }
    
    addPresetViewButtons() {
        const ui = document.getElementById('ui');
        
        const presetGroup = document.createElement('div');
        presetGroup.className = 'control-group';
        presetGroup.innerHTML = '<label>Preset Views:</label>';
        
        const presets = [
            { name: 'Overview', key: 'overview' },
            { name: 'Slope View', key: 'slope' },
            { name: 'Summit', key: 'summit' },
            { name: 'Base Lodge', key: 'base' }
        ];
        
        presets.forEach(preset => {
            const button = document.createElement('button');
            button.textContent = preset.name;
            button.style.fontSize = '11px';
            button.style.padding = '4px 8px';
            button.addEventListener('click', () => {
                this.cameraController.setPresetView(preset.key);
            });
            presetGroup.appendChild(button);
        });
        
        ui.appendChild(presetGroup);
    }
    
    generateTerrain() {
        const loading = document.getElementById('loading');
        loading.style.display = 'block';
        
        // Use async terrain generation
        this.terrainRenderer.createTerrainMesh(this.scene, this.currentResort)
            .then(() => {
                loading.style.display = 'none';
                // Update UI with resort info
                this.updateResortInfo();
            })
            .catch((error) => {
                console.error('Terrain generation failed:', error);
                loading.style.display = 'none';
            });
    }
    
    updateResortInfo() {
        const profile = this.terrainRenderer.resortProfiles[this.currentResort];
        if (!profile) return;
        
        // You could add a resort info panel here
        console.log(`Generated terrain for: ${profile.name}`);
        console.log(`Base elevation: ${profile.baseElevation}m`);
        console.log(`Vertical drop: ${profile.verticalDrop}m`);
        console.log(`Difficulty: ${Math.round(profile.difficulty * 100)}%`);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = this.clock.getDelta();
        
        // Update systems
        this.cameraController.update(deltaTime);
        this.weatherSystem.animate();
        
        // Update UI info
        this.updateUI();
        
        // Render
        this.renderer.render(this.scene, this.camera);
        
        // Calculate FPS
        this.frameCount++;
        const currentTime = performance.now();
        if (currentTime - this.lastFPSUpdate > 1000) {
            const fps = Math.round(this.frameCount * 1000 / (currentTime - this.lastFPSUpdate));
            document.getElementById('fps').textContent = fps;
            this.frameCount = 0;
            this.lastFPSUpdate = currentTime;
        }
    }
    
    updateUI() {
        // Update camera position
        const cameraInfo = this.cameraController.getCameraInfo();
        document.getElementById('cameraPos').textContent = 
            `${cameraInfo.position.x}, ${cameraInfo.position.y}, ${cameraInfo.position.z}`;
        
        // Update elevation and slope at camera target
        const elevation = this.terrainRenderer.getElevationAt(
            cameraInfo.target.x, 
            cameraInfo.target.z
        );
        const slope = this.terrainRenderer.getSlopeAt(
            cameraInfo.target.x, 
            cameraInfo.target.z
        );
        
        document.getElementById('elevation').textContent = `${Math.round(elevation)}m`;
        document.getElementById('slope').textContent = `${Math.round(slope)}°`;
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new SkiTerrainApp();
});

// Add some helpful keyboard shortcuts info
document.addEventListener('DOMContentLoaded', () => {
    const info = document.getElementById('info');
    const controls = document.createElement('div');
    controls.style.marginTop = '10px';
    controls.style.fontSize = '10px';
    controls.style.opacity = '0.8';
    controls.innerHTML = `
        <strong>Controls:</strong><br>
        Mouse: Look around<br>
        WASD/Arrows: Move<br>
        Q/E: Up/Down<br>
        Wheel: Zoom
    `;
    info.appendChild(controls);
});
