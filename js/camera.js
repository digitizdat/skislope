class CameraController {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;
        
        // Camera state
        this.isMouseDown = false;
        this.mouseX = 0;
        this.mouseY = 0;
        this.targetDistance = 200;
        this.currentDistance = 200;
        this.phi = Math.PI / 4; // Vertical angle
        this.theta = 0; // Horizontal angle
        
        // Camera limits
        this.minDistance = 50;
        this.maxDistance = 1000;
        this.minPhi = 0.1;
        this.maxPhi = Math.PI / 2 - 0.1;
        
        // Movement
        this.target = new THREE.Vector3(0, 0, 0);
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            up: false,
            down: false
        };
        
        this.moveSpeed = 5.0;
        this.rotateSpeed = 0.005;
        this.zoomSpeed = 0.1;
        
        this.setupEventListeners();
        this.updateCamera();
    }
    
    setupEventListeners() {
        // Mouse controls
        this.domElement.addEventListener('mousedown', (event) => {
            this.isMouseDown = true;
            this.mouseX = event.clientX;
            this.mouseY = event.clientY;
            this.domElement.style.cursor = 'grabbing';
        });
        
        this.domElement.addEventListener('mousemove', (event) => {
            if (!this.isMouseDown) return;
            
            const deltaX = event.clientX - this.mouseX;
            const deltaY = event.clientY - this.mouseY;
            
            this.theta -= deltaX * this.rotateSpeed;
            this.phi += deltaY * this.rotateSpeed;
            
            // Clamp phi to prevent camera flipping
            this.phi = Math.max(this.minPhi, Math.min(this.maxPhi, this.phi));
            
            this.mouseX = event.clientX;
            this.mouseY = event.clientY;
        });
        
        this.domElement.addEventListener('mouseup', () => {
            this.isMouseDown = false;
            this.domElement.style.cursor = 'grab';
        });
        
        // Mouse wheel for zooming
        this.domElement.addEventListener('wheel', (event) => {
            event.preventDefault();
            
            this.targetDistance += event.deltaY * this.zoomSpeed;
            this.targetDistance = Math.max(this.minDistance, Math.min(this.maxDistance, this.targetDistance));
        });
        
        // Keyboard controls
        document.addEventListener('keydown', (event) => {
            switch(event.code) {
                case 'KeyW':
                case 'ArrowUp':
                    this.keys.forward = true;
                    break;
                case 'KeyS':
                case 'ArrowDown':
                    this.keys.backward = true;
                    break;
                case 'KeyA':
                case 'ArrowLeft':
                    this.keys.left = true;
                    break;
                case 'KeyD':
                case 'ArrowRight':
                    this.keys.right = true;
                    break;
                case 'KeyQ':
                    this.keys.up = true;
                    break;
                case 'KeyE':
                    this.keys.down = true;
                    break;
            }
        });
        
        document.addEventListener('keyup', (event) => {
            switch(event.code) {
                case 'KeyW':
                case 'ArrowUp':
                    this.keys.forward = false;
                    break;
                case 'KeyS':
                case 'ArrowDown':
                    this.keys.backward = false;
                    break;
                case 'KeyA':
                case 'ArrowLeft':
                    this.keys.left = false;
                    break;
                case 'KeyD':
                case 'ArrowRight':
                    this.keys.right = false;
                    break;
                case 'KeyQ':
                    this.keys.up = false;
                    break;
                case 'KeyE':
                    this.keys.down = false;
                    break;
            }
        });
        
        // Prevent context menu
        this.domElement.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
        
        // Set initial cursor
        this.domElement.style.cursor = 'grab';
    }
    
    update(deltaTime) {
        // Handle keyboard movement
        const moveVector = new THREE.Vector3();
        
        if (this.keys.forward) {
            moveVector.z -= this.moveSpeed * deltaTime;
        }
        if (this.keys.backward) {
            moveVector.z += this.moveSpeed * deltaTime;
        }
        if (this.keys.left) {
            moveVector.x -= this.moveSpeed * deltaTime;
        }
        if (this.keys.right) {
            moveVector.x += this.moveSpeed * deltaTime;
        }
        if (this.keys.up) {
            moveVector.y += this.moveSpeed * deltaTime;
        }
        if (this.keys.down) {
            moveVector.y -= this.moveSpeed * deltaTime;
        }
        
        // Apply movement relative to camera orientation
        if (moveVector.length() > 0) {
            const cameraDirection = new THREE.Vector3();
            this.camera.getWorldDirection(cameraDirection);
            
            const right = new THREE.Vector3();
            right.crossVectors(cameraDirection, this.camera.up).normalize();
            
            const forward = new THREE.Vector3();
            forward.crossVectors(this.camera.up, right).normalize();
            
            const movement = new THREE.Vector3();
            movement.addScaledVector(right, moveVector.x);
            movement.addScaledVector(this.camera.up, moveVector.y);
            movement.addScaledVector(forward, moveVector.z);
            
            this.target.add(movement);
        }
        
        // Smooth zoom
        this.currentDistance += (this.targetDistance - this.currentDistance) * 0.1;
        
        this.updateCamera();
    }
    
    updateCamera() {
        // Calculate camera position based on spherical coordinates
        const x = this.target.x + this.currentDistance * Math.sin(this.phi) * Math.cos(this.theta);
        const y = this.target.y + this.currentDistance * Math.cos(this.phi);
        const z = this.target.z + this.currentDistance * Math.sin(this.phi) * Math.sin(this.theta);
        
        this.camera.position.set(x, y, z);
        this.camera.lookAt(this.target);
    }
    
    resetView() {
        this.target.set(0, 0, 0);
        this.targetDistance = 200;
        this.currentDistance = 200;
        this.phi = Math.PI / 4;
        this.theta = 0;
        this.updateCamera();
    }
    
    focusOnPoint(x, y, z) {
        this.target.set(x, y, z);
        this.updateCamera();
    }
    
    setDistance(distance) {
        this.targetDistance = Math.max(this.minDistance, Math.min(this.maxDistance, distance));
    }
    
    // Get camera information for UI display
    getCameraInfo() {
        return {
            position: {
                x: Math.round(this.camera.position.x),
                y: Math.round(this.camera.position.y),
                z: Math.round(this.camera.position.z)
            },
            target: {
                x: Math.round(this.target.x),
                y: Math.round(this.target.y),
                z: Math.round(this.target.z)
            },
            distance: Math.round(this.currentDistance)
        };
    }
    
    // Preset camera positions for different views
    setPresetView(preset) {
        switch(preset) {
            case 'overview':
                this.target.set(0, 0, 0);
                this.targetDistance = 500;
                this.phi = Math.PI / 3;
                this.theta = Math.PI / 4;
                break;
                
            case 'slope':
                this.target.set(0, 50, 200);
                this.targetDistance = 150;
                this.phi = Math.PI / 6;
                this.theta = 0;
                break;
                
            case 'summit':
                this.target.set(0, 150, -300);
                this.targetDistance = 200;
                this.phi = Math.PI / 4;
                this.theta = Math.PI;
                break;
                
            case 'base':
                this.target.set(0, 20, 400);
                this.targetDistance = 100;
                this.phi = Math.PI / 8;
                this.theta = 0;
                break;
        }
        
        this.updateCamera();
    }
}
