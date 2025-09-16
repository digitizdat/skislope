class MaterialSystem {
    constructor() {
        this.materials = {};
        this.textures = {};
        this.createProceduralTextures();
        this.createMaterials();
    }
    
    createProceduralTextures() {
        // Create snow texture
        this.textures.snow = this.createSnowTexture();
        this.textures.snowNormal = this.createSnowNormalMap();
        
        // Create ice texture
        this.textures.ice = this.createIceTexture();
        this.textures.iceNormal = this.createIceNormalMap();
        
        // Create rock texture
        this.textures.rock = this.createRockTexture();
        this.textures.rockNormal = this.createRockNormalMap();
        
        // Create groomed snow texture
        this.textures.groomed = this.createGroomedTexture();
        this.textures.groomedNormal = this.createGroomedNormalMap();
    }
    
    createSnowTexture() {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Base snow color with subtle variations
        const imageData = ctx.createImageData(size, size);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 0.1;
            const baseColor = 0.95 + noise;
            
            data[i] = Math.floor(baseColor * 255);     // R
            data[i + 1] = Math.floor(baseColor * 255); // G  
            data[i + 2] = Math.floor((baseColor + 0.02) * 255); // B (slightly blue)
            data[i + 3] = 255; // A
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(8, 8);
        return texture;
    }
    
    createSnowNormalMap() {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        const imageData = ctx.createImageData(size, size);
        const data = imageData.data;
        
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const i = (y * size + x) * 4;
                
                // Generate subtle normal variations for snow surface
                const nx = (Math.random() - 0.5) * 0.2;
                const ny = (Math.random() - 0.5) * 0.2;
                const nz = Math.sqrt(1 - nx * nx - ny * ny);
                
                data[i] = Math.floor((nx + 1) * 127.5);     // R (X normal)
                data[i + 1] = Math.floor((ny + 1) * 127.5); // G (Y normal)
                data[i + 2] = Math.floor(nz * 255);         // B (Z normal)
                data[i + 3] = 255; // A
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(8, 8);
        return texture;
    }
    
    createIceTexture() {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        const imageData = ctx.createImageData(size, size);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const noise = Math.random() * 0.15;
            const baseColor = 0.85 + noise;
            
            data[i] = Math.floor((baseColor - 0.1) * 255);     // R (less red)
            data[i + 1] = Math.floor((baseColor - 0.05) * 255); // G
            data[i + 2] = Math.floor(baseColor * 255);         // B (more blue)
            data[i + 3] = 255; // A
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 4);
        return texture;
    }
    
    createIceNormalMap() {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        const imageData = ctx.createImageData(size, size);
        const data = imageData.data;
        
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const i = (y * size + x) * 4;
                
                // Smoother normals for ice
                const nx = (Math.random() - 0.5) * 0.1;
                const ny = (Math.random() - 0.5) * 0.1;
                const nz = Math.sqrt(1 - nx * nx - ny * ny);
                
                data[i] = Math.floor((nx + 1) * 127.5);
                data[i + 1] = Math.floor((ny + 1) * 127.5);
                data[i + 2] = Math.floor(nz * 255);
                data[i + 3] = 255;
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 4);
        return texture;
    }
    
    createRockTexture() {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        const imageData = ctx.createImageData(size, size);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const noise = Math.random() * 0.3;
            const baseGray = 0.4 + noise;
            
            data[i] = Math.floor(baseGray * 200);     // R
            data[i + 1] = Math.floor(baseGray * 180); // G (slightly less green)
            data[i + 2] = Math.floor(baseGray * 160); // B (less blue for warmer rock)
            data[i + 3] = 255; // A
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);
        return texture;
    }
    
    createRockNormalMap() {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        const imageData = ctx.createImageData(size, size);
        const data = imageData.data;
        
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const i = (y * size + x) * 4;
                
                // Rougher normals for rock
                const nx = (Math.random() - 0.5) * 0.6;
                const ny = (Math.random() - 0.5) * 0.6;
                const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
                
                data[i] = Math.floor((nx + 1) * 127.5);
                data[i + 1] = Math.floor((ny + 1) * 127.5);
                data[i + 2] = Math.floor(nz * 255);
                data[i + 3] = 255;
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);
        return texture;
    }
    
    createGroomedTexture() {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Create groomed snow pattern with corduroy lines
        ctx.fillStyle = '#f8f8ff';
        ctx.fillRect(0, 0, size, size);
        
        // Add corduroy pattern
        ctx.strokeStyle = '#f0f0f5';
        ctx.lineWidth = 2;
        
        for (let y = 0; y < size; y += 8) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(size, y);
            ctx.stroke();
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(16, 16);
        return texture;
    }
    
    createGroomedNormalMap() {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        const imageData = ctx.createImageData(size, size);
        const data = imageData.data;
        
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const i = (y * size + x) * 4;
                
                // Create corduroy normal pattern
                const corduroyPattern = Math.sin(y * 0.8) * 0.3;
                const nx = 0;
                const ny = corduroyPattern;
                const nz = Math.sqrt(1 - ny * ny);
                
                data[i] = Math.floor((nx + 1) * 127.5);
                data[i + 1] = Math.floor((ny + 1) * 127.5);
                data[i + 2] = Math.floor(nz * 255);
                data[i + 3] = 255;
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(16, 16);
        return texture;
    }
    
    createMaterials() {
        // Fresh powder snow
        this.materials.powder = new THREE.MeshLambertMaterial({
            map: this.textures.snow,
            color: 0xffffff
        });
        
        // Packed powder
        this.materials.packed = new THREE.MeshLambertMaterial({
            map: this.textures.snow,
            color: 0xf8f8ff
        });
        
        // Groomed snow
        this.materials.groomed = new THREE.MeshLambertMaterial({
            map: this.textures.groomed,
            color: 0xf0f8ff
        });
        
        
        // Icy conditions
        this.materials.icy = new THREE.MeshLambertMaterial({
            map: this.textures.ice,
            color: 0xe6f3ff,
            transparent: true,
            opacity: 0.95
        });
        
        // Spring snow
        this.materials.spring = new THREE.MeshLambertMaterial({
            map: this.textures.snow,
            color: 0xf5f5dc
        });
        
        // Rock/exposed terrain
        this.materials.rock = new THREE.MeshLambertMaterial({
            map: this.textures.rock,
            color: 0x8b7355
        });
    }
    
    getMaterial(condition) {
        return this.materials[condition] || this.materials.powder;
    }
    
    // Create a blended material based on terrain properties
    createBlendedMaterial(heightData, resolution, terrainSize, maxHeight) {
        // For now, return the base material - we could implement texture splatting here
        return this.materials.powder;
    }
}
