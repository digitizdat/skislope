/**
 * Unit tests for CameraController
 * Tests camera movement, rotation, and user input handling
 */

// Mock the CameraController class by loading it
const fs = require('fs');
const path = require('path');

// Read and evaluate the camera.js file in test environment
const cameraCode = fs.readFileSync(path.join(__dirname, '../../../js/camera.js'), 'utf8');
eval(cameraCode);

describe('CameraController', () => {
  let camera, domElement, controller;

  beforeEach(() => {
    // Create mock camera and DOM element
    camera = new THREE.PerspectiveCamera();
    domElement = document.createElement('canvas');
    controller = new CameraController(camera, domElement);
  });

  describe('Initialization', () => {
    test('initializes with correct default values', () => {
      expect(controller.camera).toBe(camera);
      expect(controller.domElement).toBe(domElement);
      expect(controller.isMouseDown).toBe(false);
      expect(controller.targetDistance).toBe(200);
      expect(controller.currentDistance).toBe(200);
      expect(controller.phi).toBe(Math.PI / 4);
      expect(controller.theta).toBe(0);
    });

    test('sets up camera limits correctly', () => {
      expect(controller.minDistance).toBe(50);
      expect(controller.maxDistance).toBe(1000);
      expect(controller.minPhi).toBe(0.1);
      expect(controller.maxPhi).toBe(Math.PI / 2 - 0.1);
    });

    test('initializes movement keys state', () => {
      expect(controller.keys.forward).toBe(false);
      expect(controller.keys.backward).toBe(false);
      expect(controller.keys.left).toBe(false);
      expect(controller.keys.right).toBe(false);
      expect(controller.keys.up).toBe(false);
      expect(controller.keys.down).toBe(false);
    });

    test('creates target vector', () => {
      expect(controller.target).toBeInstanceOf(THREE.Vector3);
      expect(controller.target.x).toBe(0);
      expect(controller.target.y).toBe(0);
      expect(controller.target.z).toBe(0);
    });
  });

  describe('Distance Control', () => {
    test('respects minimum distance limit', () => {
      controller.targetDistance = 10; // Below minimum
      controller.update();
      expect(controller.currentDistance).toBeGreaterThanOrEqual(controller.minDistance);
    });

    test('respects maximum distance limit', () => {
      controller.targetDistance = 2000; // Above maximum
      controller.update();
      expect(controller.currentDistance).toBeLessThanOrEqual(controller.maxDistance);
    });

    test('smoothly interpolates distance changes', () => {
      const initialDistance = controller.currentDistance;
      controller.targetDistance = 500;
      
      controller.update();
      
      // Should move towards target but not reach it immediately
      expect(controller.currentDistance).not.toBe(initialDistance);
      expect(controller.currentDistance).not.toBe(controller.targetDistance);
    });
  });

  describe('Angle Control', () => {
    test('respects phi (vertical angle) limits', () => {
      controller.phi = -0.5; // Below minimum
      controller.update();
      expect(controller.phi).toBeGreaterThanOrEqual(controller.minPhi);

      controller.phi = Math.PI; // Above maximum
      controller.update();
      expect(controller.phi).toBeLessThanOrEqual(controller.maxPhi);
    });

    test('allows full theta (horizontal angle) rotation', () => {
      controller.theta = Math.PI * 3; // Multiple rotations
      controller.update();
      // Theta should be normalized but still functional
      expect(typeof controller.theta).toBe('number');
    });
  });

  describe('Keyboard Input', () => {
    test('handles forward movement', () => {
      const initialZ = controller.target.z;
      controller.keys.forward = true;
      controller.update();
      // Target should move (exact direction depends on camera orientation)
      expect(controller.target.z).not.toBe(initialZ);
    });

    test('handles backward movement', () => {
      const initialZ = controller.target.z;
      controller.keys.backward = true;
      controller.update();
      expect(controller.target.z).not.toBe(initialZ);
    });

    test('handles left movement', () => {
      const initialX = controller.target.x;
      controller.keys.left = true;
      controller.update();
      expect(controller.target.x).not.toBe(initialX);
    });

    test('handles right movement', () => {
      const initialX = controller.target.x;
      controller.keys.right = true;
      controller.update();
      expect(controller.target.x).not.toBe(initialX);
    });

    test('handles up movement', () => {
      const initialY = controller.target.y;
      controller.keys.up = true;
      controller.update();
      expect(controller.target.y).toBeGreaterThan(initialY);
    });

    test('handles down movement', () => {
      const initialY = controller.target.y;
      controller.keys.down = true;
      controller.update();
      expect(controller.target.y).toBeLessThan(initialY);
    });

    test('handles multiple keys simultaneously', () => {
      const initialTarget = { ...controller.target };
      controller.keys.forward = true;
      controller.keys.right = true;
      controller.keys.up = true;
      
      controller.update();
      
      // All three axes should have changed
      expect(controller.target.x).not.toBe(initialTarget.x);
      expect(controller.target.y).not.toBe(initialTarget.y);
      expect(controller.target.z).not.toBe(initialTarget.z);
    });
  });

  describe('Mouse Input', () => {
    test('tracks mouse down state', () => {
      const mockEvent = { button: 0, preventDefault: jest.fn() };
      controller.onMouseDown(mockEvent);
      expect(controller.isMouseDown).toBe(true);
    });

    test('tracks mouse up state', () => {
      controller.isMouseDown = true;
      const mockEvent = { preventDefault: jest.fn() };
      controller.onMouseUp(mockEvent);
      expect(controller.isMouseDown).toBe(false);
    });

    test('handles mouse movement when mouse is down', () => {
      controller.isMouseDown = true;
      controller.mouseX = 100;
      controller.mouseY = 100;
      
      const initialTheta = controller.theta;
      const initialPhi = controller.phi;
      
      const mockEvent = {
        clientX: 150,
        clientY: 120,
        preventDefault: jest.fn()
      };
      
      controller.onMouseMove(mockEvent);
      
      // Angles should change based on mouse movement
      expect(controller.theta).not.toBe(initialTheta);
      expect(controller.phi).not.toBe(initialPhi);
    });

    test('ignores mouse movement when mouse is up', () => {
      controller.isMouseDown = false;
      const initialTheta = controller.theta;
      const initialPhi = controller.phi;
      
      const mockEvent = {
        clientX: 150,
        clientY: 120,
        preventDefault: jest.fn()
      };
      
      controller.onMouseMove(mockEvent);
      
      // Angles should not change
      expect(controller.theta).toBe(initialTheta);
      expect(controller.phi).toBe(initialPhi);
    });
  });

  describe('Wheel Input', () => {
    test('handles zoom in', () => {
      const initialDistance = controller.targetDistance;
      const mockEvent = {
        deltaY: -100, // Negative for zoom in
        preventDefault: jest.fn()
      };
      
      controller.onWheel(mockEvent);
      expect(controller.targetDistance).toBeLessThan(initialDistance);
    });

    test('handles zoom out', () => {
      const initialDistance = controller.targetDistance;
      const mockEvent = {
        deltaY: 100, // Positive for zoom out
        preventDefault: jest.fn()
      };
      
      controller.onWheel(mockEvent);
      expect(controller.targetDistance).toBeGreaterThan(initialDistance);
    });

    test('respects zoom limits', () => {
      // Test zoom in limit
      controller.targetDistance = controller.minDistance + 10;
      const mockEvent1 = {
        deltaY: -1000, // Large zoom in
        preventDefault: jest.fn()
      };
      controller.onWheel(mockEvent1);
      expect(controller.targetDistance).toBeGreaterThanOrEqual(controller.minDistance);

      // Test zoom out limit
      controller.targetDistance = controller.maxDistance - 10;
      const mockEvent2 = {
        deltaY: 1000, // Large zoom out
        preventDefault: jest.fn()
      };
      controller.onWheel(mockEvent2);
      expect(controller.targetDistance).toBeLessThanOrEqual(controller.maxDistance);
    });
  });

  describe('Camera Position Updates', () => {
    test('updates camera position based on spherical coordinates', () => {
      const initialPosition = { ...camera.position };
      controller.theta = Math.PI / 4;
      controller.phi = Math.PI / 3;
      controller.currentDistance = 300;
      
      controller.update();
      
      // Camera position should change
      expect(camera.position.x).not.toBe(initialPosition.x);
      expect(camera.position.y).not.toBe(initialPosition.y);
      expect(camera.position.z).not.toBe(initialPosition.z);
    });

    test('maintains correct distance from target', () => {
      controller.target.set(100, 50, -200);
      controller.currentDistance = 250;
      
      controller.update();
      
      // Calculate actual distance
      const dx = camera.position.x - controller.target.x;
      const dy = camera.position.y - controller.target.y;
      const dz = camera.position.z - controller.target.z;
      const actualDistance = Math.sqrt(dx*dx + dy*dy + dz*dz);
      
      expect(actualDistance).toBeCloseTo(controller.currentDistance, 1);
    });
  });

  describe('Event Listener Management', () => {
    test('sets up event listeners on initialization', () => {
      const addEventListenerSpy = jest.spyOn(domElement, 'addEventListener');
      const windowAddEventListenerSpy = jest.spyOn(window, 'addEventListener');
      
      // Create new controller to trigger event listener setup
      new CameraController(camera, domElement);
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('wheel', expect.any(Function));
      expect(windowAddEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(windowAddEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
      expect(windowAddEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(windowAddEventListenerSpy).toHaveBeenCalledWith('keyup', expect.any(Function));
    });
  });
});
