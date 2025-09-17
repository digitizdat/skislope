class TerrainRenderer {
    constructor() {
        this.terrainMesh = null;
        this.terrainGeometry = null;
        this.terrainMaterial = null;
        this.heightData = null;
        this.resolution = 128;
        this.terrainSize = 1000; // meters
        this.maxHeight = 200; // meters
        this.materialSystem = null;
        this.trees = [];
        this.rocks = [];
        this.skiLift = null;
        this.topographyLoader = new TopographyDataLoader();
        
        // Real ski resort elevation profiles (simplified)
        this.resortProfiles = {
            chamonix: {
                name: "Chamonix - Vallée Blanche",
                baseElevation: 3800,
                verticalDrop: 2800,
                difficulty: 0.8,
                features: ['crevasses', 'seracs', 'steep_sections']
            },
            whistler: {
                name: "Whistler - Peak 2 Peak",
                baseElevation: 2200,
                verticalDrop: 1600,
                difficulty: 0.6,
                features: ['bowls', 'trees', 'groomed_runs']
            },
            zermatt: {
                name: "Zermatt - Matterhorn Glacier",
                baseElevation: 3800,
                verticalDrop: 2200,
                difficulty: 0.9,
                features: ['glacier', 'moguls', 'off_piste']
            },
            stanton: {
                name: "St. Anton - Hahnenkamm",
                baseElevation: 2800,
                verticalDrop: 1300,
                difficulty: 0.85,
                features: ['steep_pitch', 'jumps', 'compression']
            },
            valdisere: {
                name: "Val d'Isère - Face de Bellevarde",
                baseElevation: 3400,
                verticalDrop: 1800,
                difficulty: 0.7,
                features: ['wide_pistes', 'varied_terrain', 'high_altitude']
            }
        };
    }
    
    async generateHeightMap(resortKey) {
        const profile = this.resortProfiles[resortKey];
        
        // Try to fetch real topographical data first
        try {
            const realElevationData = await this.topographyLoader.fetchElevationData(
                resortKey, 
                this.resolution, 
                this.terrainSize
            );
            
            if (realElevationData) {
                console.log(`Using real topographical data for ${profile.name}`);
                this.heightData = realElevationData;
                return realElevationData;
            }
        } catch (error) {
            console.warn(`Failed to load real topographical data for ${profile.name}:`, error);
        }
        
        // Fallback to procedural generation
        console.log(`Using procedural terrain generation for ${profile.name}`);
        const heightData = new Float32Array(this.resolution * this.resolution);
        
        // Generate realistic ski slope terrain based on resort profile
        for (let z = 0; z < this.resolution; z++) {
            for (let x = 0; x < this.resolution; x++) {
                const index = z * this.resolution + x;
                
                // Normalize coordinates to -1 to 1
                const nx = (x / (this.resolution - 1)) * 2 - 1;
                const nz = (z / (this.resolution - 1)) * 2 - 1;
                
                // Create a realistic mountain slope with proper 3D shape
                // Distance from center for radial mountain shape
                const distanceFromCenter = Math.sqrt(nx * nx + nz * nz);
                
                // Create mountain peak in center, sloping down to edges
                let baseHeight = Math.max(0, 1 - distanceFromCenter * 0.8);
                
                // Add directional slope (higher at back, lower at front for ski runs)
                const slopeEffect = Math.max(0, 0.8 - nz * 0.3); // Higher at back (nz = -1)
                baseHeight *= slopeEffect;
                
                // Scale by profile characteristics
                let height = baseHeight * 0.8;
                
                // Add terrain features based on resort characteristics
                height += this.addTerrainFeatures(nx, nz, profile) * 0.3;
                
                // Add realistic noise for natural terrain variation
                height += this.generateNoise(nx, nz, profile.difficulty) * 0.2;
                
                // Ensure minimum base level and clamp
                height = Math.max(0.1, Math.min(1.0, height));
                
                heightData[index] = height;
            }
        }
        
        this.heightData = heightData;
        return heightData;
    }
    
    addTerrainFeatures(x, z, profile) {
        let featureHeight = 0;
        
        profile.features.forEach(feature => {
            switch(feature) {
                case 'steep_sections':
                    // Add steep drops in middle section
                    if (z > -0.2 && z < 0.4 && Math.abs(x) < 0.4) {
                        featureHeight += -0.15 * Math.sin((z + 0.2) * Math.PI * 3);
                    }
                    break;
                    
                case 'bowls': {
                    // Natural bowl formations
                    const bowlDist = Math.sqrt(x * x + (z + 0.3) * (z + 0.3));
                    if (bowlDist < 0.3) {
                        featureHeight += -0.1 * (1 - bowlDist / 0.3);
                    }
                    break;
                }
                    
                case 'moguls':
                    // Mogul field in lower sections
                    if (z > 0.0 && z < 0.6) {
                        featureHeight += 0.02 * Math.sin(x * 15) * Math.sin(z * 12);
                    }
                    break;
                    
                case 'jumps':
                    // Natural jumps and lips
                    if (z > 0.2 && z < 0.4 && Math.abs(x) < 0.3) {
                        featureHeight += 0.05 * Math.exp(-Math.pow((z - 0.3) * 8, 2));
                    }
                    break;
                    
                case 'crevasses': {
                    // Glacier crevasses - use deterministic placement
                    const crevHash = Math.sin(x * 47.3 + z * 23.7) * 0.5 + 0.5;
                    if (crevHash < 0.05 && z < -0.3) {
                        featureHeight += -0.2;
                    }
                    break;
                }
            }
        });
        
        return featureHeight;
    }
    
    generateNoise(x, z, difficulty) {
        // Multi-octave noise for natural terrain variation
        let noise = 0;
        let amplitude = 0.05;
        let frequency = 2;
        
        for (let i = 0; i < 3; i++) {
            const nx = x * frequency;
            const nz = z * frequency;
            noise += amplitude * (Math.sin(nx * Math.PI) * Math.cos(nz * Math.PI) +
                                Math.sin(nx * 2.7 + 1.3) * Math.cos(nz * 2.7 + 2.1));
            amplitude *= 0.6;
            frequency *= 1.8;
        }
        
        // Scale noise by difficulty - harder slopes have more variation
        return noise * difficulty * 0.5;
    }
    
    async createTerrainMesh(scene, resortKey) {
        // Remove existing terrain
        if (this.terrainMesh) {
            scene.remove(this.terrainMesh);
            this.terrainGeometry.dispose();
            this.terrainMaterial.dispose();
        }
        
        // Generate height data (now async)
        const heightData = await this.generateHeightMap(resortKey);
        
        // Create geometry as a proper heightfield
        this.terrainGeometry = new THREE.PlaneGeometry(
            this.terrainSize, 
            this.terrainSize, 
            this.resolution - 1, 
            this.resolution - 1
        );
        
        // Rotate geometry to be horizontal ground plane
        this.terrainGeometry.rotateX(-Math.PI / 2);
        
        // Apply height data to vertices (Y is now up after rotation)
        const vertices = this.terrainGeometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            const vertexIndex = i / 3;
            const x = vertexIndex % this.resolution;
            const z = Math.floor(vertexIndex / this.resolution);
            const heightIndex = z * this.resolution + x;
            
            if (heightIndex < heightData.length) {
                // Y coordinate is height after rotation
                vertices[i + 1] = heightData[heightIndex] * this.maxHeight;
            }
        }
        
        // Recalculate normals for proper lighting
        this.terrainGeometry.computeVertexNormals();
        
        // Initialize material system if not already done
        if (!this.materialSystem) {
            this.materialSystem = new MaterialSystem();
        }
        
        // Create realistic snow material with proper textures
        this.terrainMaterial = this.materialSystem.getMaterial('powder');
        
        // Add vertex colors and texture blending based on slope and elevation
        this.addAdvancedMaterials();
        
        // Add terrain features
        this.addTerrainObjects(scene);
        
        // Create mesh - no rotation, keep it vertical
        this.terrainMesh = new THREE.Mesh(this.terrainGeometry, this.terrainMaterial);
        this.terrainMesh.position.set(0, 0, 0);
        this.terrainMesh.receiveShadow = true;
        this.terrainMesh.castShadow = true;
        
        scene.add(this.terrainMesh);
        
        return this.terrainMesh;
    }
    
    addAdvancedMaterials() {
        const colors = [];
        const _uvs = [];
        const vertices = this.terrainGeometry.attributes.position.array;
        const normals = this.terrainGeometry.attributes.normal.array;
        
        for (let i = 0; i < vertices.length; i += 3) {
            const height = vertices[i + 1];
            const normalizedHeight = height / this.maxHeight;
            
            // Calculate slope from normal
            const normalIndex = i;
            const _nx = normals[normalIndex];
            const ny = normals[normalIndex + 1];
            const _nz = normals[normalIndex + 2];
            const slope = Math.acos(ny); // Angle from vertical
            
            // Blend materials based on height and slope
            let r, g, b;
            
            if (slope > 1.2) { // Very steep - exposed rock
                r = 0.55; g = 0.45; b = 0.35;
            } else if (normalizedHeight > 0.9) {
                // High elevation - pristine snow
                r = 0.98; g = 0.99; b = 1.0;
            } else if (normalizedHeight > 0.7) {
                // Mid-high elevation - clean snow with slight blue tint
                r = 0.95; g = 0.97; b = 1.0;
            } else if (normalizedHeight > 0.4) {
                // Mid elevation - tracked snow
                r = 0.92; g = 0.94; b = 0.97;
            } else if (normalizedHeight > 0.2) {
                // Lower elevation - dirty snow
                r = 0.88; g = 0.90; b = 0.92;
            } else {
                // Very low - mixed snow and rock
                r = 0.75; g = 0.77; b = 0.80;
            }
            
            colors.push(r, g, b);
        }
        
        this.terrainGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        this.terrainMaterial.vertexColors = true;
    }
    
    addTerrainObjects(scene) {
        // Clear existing objects
        this.clearTerrainObjects(scene);
        
        // Add trees at lower elevations
        this.addTrees(scene);
        
        // Add rocks and boulders
        this.addRocks(scene);
        
        // Add ski lift infrastructure
        this.addSkiLift(scene);
    }
    
    clearTerrainObjects(scene) {
        // Remove existing trees
        this.trees.forEach((tree) => { scene.remove(tree); });
        this.trees = [];
        
        // Remove existing rocks
        this.rocks.forEach((rock) => { scene.remove(rock); });
        this.rocks = [];
        
        // Remove ski lift
        if (this.skiLift) {
            scene.remove(this.skiLift);
            this.skiLift = null;
        }
    }
    
    addTrees(scene) {
        const treeCount = 50;
        
        for (let i = 0; i < treeCount; i++) {
            const x = (Math.random() - 0.5) * this.terrainSize * 0.8;
            const z = (Math.random() - 0.5) * this.terrainSize * 0.8;
            const elevation = this.getElevationAt(x, z);
            
            // Only place trees at reasonable elevations with proper terrain check
            if (elevation > 10 && elevation < this.maxHeight * 0.4) {
                const tree = this.createTree();
                tree.position.set(x, elevation, z);
                
                // Random rotation and scale
                tree.rotation.y = Math.random() * Math.PI * 2;
                const scale = 0.8 + Math.random() * 0.4;
                tree.scale.set(scale, scale, scale);
                
                scene.add(tree);
                this.trees.push(tree);
            }
        }
    }
    
    createTree() {
        const treeGroup = new THREE.Group();
        
        // Trunk
        const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.8, 8, 8);
        const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x4a3728 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 4;
        treeGroup.add(trunk);
        
        // Foliage layers
        for (let i = 0; i < 3; i++) {
            const foliageGeometry = new THREE.ConeGeometry(3 - i * 0.5, 4, 8);
            const foliageMaterial = new THREE.MeshLambertMaterial({ color: 0x0d4f0d });
            const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
            foliage.position.y = 6 + i * 2;
            treeGroup.add(foliage);
        }
        
        return treeGroup;
    }
    
    addRocks(scene) {
        const rockCount = 30;
        
        for (let i = 0; i < rockCount; i++) {
            const x = (Math.random() - 0.5) * this.terrainSize;
            const z = (Math.random() - 0.5) * this.terrainSize;
            const elevation = this.getElevationAt(x, z);
            
            // Place rocks at various elevations
            if (elevation > 5 && Math.random() < 0.3) {
                const rock = this.createRock();
                rock.position.set(x, elevation, z);
                
                // Random rotation and scale
                rock.rotation.set(
                    Math.random() * 0.5,
                    Math.random() * Math.PI * 2,
                    Math.random() * 0.5
                );
                const scale = 0.5 + Math.random() * 2;
                rock.scale.set(scale, scale, scale);
                
                scene.add(rock);
                this.rocks.push(rock);
            }
        }
    }
    
    createRock() {
        const rockGeometry = new THREE.DodecahedronGeometry(2, 0);
        
        // Deform the rock for more natural look
        const vertices = rockGeometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            vertices[i] += (Math.random() - 0.5) * 0.5;
            vertices[i + 1] += (Math.random() - 0.5) * 0.5;
            vertices[i + 2] += (Math.random() - 0.5) * 0.5;
        }
        rockGeometry.attributes.position.needsUpdate = true;
        rockGeometry.computeVertexNormals();
        
        const rockMaterial = new THREE.MeshLambertMaterial({ color: 0x666666 });
        return new THREE.Mesh(rockGeometry, rockMaterial);
    }
    
    addSkiLift(scene) {
        const liftGroup = new THREE.Group();
        
        // Create lift line from bottom to top
        const startZ = this.terrainSize * 0.4;
        const endZ = -this.terrainSize * 0.4;
        const towerCount = 8;
        
        for (let i = 0; i <= towerCount; i++) {
            const t = i / towerCount;
            const z = startZ + (endZ - startZ) * t;
            const x = 0;
            const elevation = this.getElevationAt(x, z);
            
            // Tower
            const towerGeometry = new THREE.CylinderGeometry(0.3, 0.3, 25, 8);
            const towerMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });
            const tower = new THREE.Mesh(towerGeometry, towerMaterial);
            tower.position.set(x, elevation + 12.5, z);
            liftGroup.add(tower);
            
            // Cross beam
            const beamGeometry = new THREE.BoxGeometry(8, 0.5, 0.5);
            const beam = new THREE.Mesh(beamGeometry, towerMaterial);
            beam.position.set(x, elevation + 24, z);
            liftGroup.add(beam);
        }
        
        // Lift cables
        const cableGeometry = new THREE.BufferGeometry();
        const cablePoints = [];
        
        for (let i = 0; i <= 100; i++) {
            const t = i / 100;
            const z = startZ + (endZ - startZ) * t;
            const x = 0;
            const elevation = this.getElevationAt(x, z);
            cablePoints.push(new THREE.Vector3(x - 2, elevation + 22, z));
            cablePoints.push(new THREE.Vector3(x + 2, elevation + 22, z));
        }
        
        cableGeometry.setFromPoints(cablePoints);
        const cableMaterial = new THREE.LineBasicMaterial({ color: 0x333333 });
        const cables = new THREE.Line(cableGeometry, cableMaterial);
        liftGroup.add(cables);
        
        this.skiLift = liftGroup;
        scene.add(this.skiLift);
    }
    
    getElevationAt(x, z) {
        if (!this.heightData) return 0;
        
        // Convert world coordinates to height map coordinates
        const normalizedX = (x + this.terrainSize / 2) / this.terrainSize;
        const normalizedZ = (z + this.terrainSize / 2) / this.terrainSize;
        
        // Clamp to valid range
        const clampedX = Math.max(0, Math.min(1, normalizedX));
        const clampedZ = Math.max(0, Math.min(1, normalizedZ));
        
        const hx = Math.floor(clampedX * (this.resolution - 1));
        const hz = Math.floor(clampedZ * (this.resolution - 1));
        
        const index = hz * this.resolution + hx;
        if (index >= 0 && index < this.heightData.length) {
            return this.heightData[index] * this.maxHeight;
        }
        return 0;
    }
    
    getSlopeAt(x, z) {
        if (!this.heightData) return 0;
        
        const hx = Math.floor(((x + this.terrainSize / 2) / this.terrainSize) * this.resolution);
        const hz = Math.floor(((z + this.terrainSize / 2) / this.terrainSize) * this.resolution);
        
        if (hx < 1 || hx >= this.resolution - 1 || hz < 1 || hz >= this.resolution - 1) {
            return 0;
        }
        
        // Calculate slope using neighboring points
        const h1 = this.heightData[hz * this.resolution + (hx - 1)] * this.maxHeight;
        const h2 = this.heightData[hz * this.resolution + (hx + 1)] * this.maxHeight;
        const h3 = this.heightData[(hz - 1) * this.resolution + hx] * this.maxHeight;
        const h4 = this.heightData[(hz + 1) * this.resolution + hx] * this.maxHeight;
        
        const dx = (h2 - h1) / 2;
        const dz = (h4 - h3) / 2;
        
        const slope = Math.sqrt(dx * dx + dz * dz);
        return Math.atan(slope) * (180 / Math.PI); // Convert to degrees
    }
    
    updateSnowConditions(condition) {
        if (!this.terrainMaterial || !this.materialSystem) return;
        
        // Get new material from material system
        const newMaterial = this.materialSystem.getMaterial(condition);
        
        // Update the terrain mesh material
        if (this.terrainMesh) {
            this.terrainMesh.material = newMaterial;
            this.terrainMaterial = newMaterial;
        }
    }
}
